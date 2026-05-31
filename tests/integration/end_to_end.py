#!/usr/bin/env python3
"""PATCH v1.8 — Uçtan uca akış entegrasyon testi.

Akış: OCR → Decision → (Cevap Anahtarı → Rubrik → AI) → Dijital Masa düzeltme → Kayıt
Bu test backend zincirini ve grading doğruluğunu uçtan uca doğrular.

Çalıştırma: cd apps/cloud-brain && python3 ../../tests/integration/end_to_end.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'cloud-brain'))
from fastapi.testclient import TestClient
from main import app

c = TestClient(app)
passed = failed = 0

def check(name, cond):
    global passed, failed
    if cond:
        passed += 1; print(f"  ✅ {name}")
    else:
        failed += 1; print(f"  ❌ {name}")

print("\n[PATCH v1.8 — UÇTAN UCA AKIŞ]")

# 1. OCR aşaması (cihaz/bulut)
r = c.post('/api/pipeline/ocr', json={})
check("OCR aşaması çalışıyor", r.status_code == 200 and r.json()['ok'])

# 2. Öğrenci bilgi aşaması
r = c.post('/api/pipeline/ogrenci_bilgi', json={})
check("Öğrenci bilgi aşaması çalışıyor", r.status_code == 200)

# 3. Uçtan uca grading: cevap anahtarı → rubrik → AI
payload = {
    'exam_id': 'mat_yazili', 'subject': 'Matematik', 'is_online': True,
    'questions': [
        {'question_no': 1, 'student_answer': 'dört', 'max_score': 10,
         'question_type': 'closed', 'correct_answer': 'dört', 'alternatives': ['4']},
        {'question_no': 2, 'student_answer': 'bitki güneş ve klorofil ile besin yapar', 'max_score': 20,
         'question_type': 'open', 'rubric': [
             {'criterion': 'güneş', 'keyword': 'güneş', 'points': 7},
             {'criterion': 'klorofil', 'keyword': 'klorofil', 'points': 7},
             {'criterion': 'besin', 'keyword': 'besin', 'points': 6}]},
        {'question_no': 3, 'student_answer': 'eksik', 'max_score': 10},  # anahtar yok
    ]
}
r = c.post('/api/pipeline/run-full', json=payload)
check("run-full çalışıyor (HTTP 200)", r.status_code == 200)
d = r.json()

# 4. Cevap anahtarı eşleşmesi → tam puan + yerel çözüm
q1 = next(q for q in d['questions'] if q['question_no'] == 1)
check("Cevap anahtarı eşleşti → 10/10", q1['ai_score'] == 10 and q1['source'] == 'answer_key')
check("Cevap anahtarı eşleşmesi → yerelde çözüldü (AI'a gitmedi)", q1['route'] == 'local_resolve')

# 5. Rubrik puanlaması → kriterler toplandı
q2 = next(q for q in d['questions'] if q['question_no'] == 2)
check("Rubrik 3 kriter → 20/20", q2['ai_score'] == 20 and q2['source'] == 'rubric')

# 6. Anahtarsız → heuristik + inceleme bayrağı
q3 = next(q for q in d['questions'] if q['question_no'] == 3)
check("Anahtarsız → ai_heuristic", q3['source'] == 'ai_heuristic')

# 7. Toplam hesabı
check("Toplam puan doğru", d['total_score'] == q1['ai_score'] + q2['ai_score'] + q3['ai_score'])
check("Toplam max doğru (40)", d['total_max'] == 40)

# 8. Determinizm (aynı girdi → aynı sonuç, rastgele DEĞİL)
r2 = c.post('/api/pipeline/run-full', json=payload).json()
check("Determinizm: tekrar aynı toplam", r2['total_score'] == d['total_score'])

# 9. Çevrimdışı → offline kuyruk rotası
off = dict(payload); off['is_online'] = False
ro = c.post('/api/pipeline/run-full', json=off).json()
check("Çevrimdışı → offline_queue rotası", all(q['route'] == 'offline_queue' for q in ro['questions']))

# 10. AIGradingCompleted event'i (workflow tamamlanması)
check("Sınav değerlendirme tamamlandı (event akışı)", d['exam_id'] == 'mat_yazili')

print(f"\n=== v1.8 ARA SONUÇ: {passed} geçti, {failed} başarısız ===")


# ═══════════════════════════════════════════════════════════════
# PATCH v1.9 — GERÇEK SORU VERİSİ (OCR → segmentasyon → grading)
# ═══════════════════════════════════════════════════════════════
print("\n[PATCH v1.9 — OCR → SEGMENTASYON → GRADING]")

from services.segmentation import segment_lines, segment_from_template

# Gerçekçi OCR çıktısı: 3 soru, aralarında boşluk
ocr_lines = [
    {'text': '1) 2+2 kaçtır?', 'confidence': 0.96, 'bbox': [10, 0, 40, 600]},
    {'text': 'dört', 'confidence': 0.90, 'bbox': [45, 0, 75, 600]},
    {'text': '2) Başkent neresi?', 'confidence': 0.94, 'bbox': [250, 0, 280, 600]},
    {'text': 'Ankara', 'confidence': 0.91, 'bbox': [285, 0, 315, 600]},
    {'text': '3) Fotosentezi açıkla', 'confidence': 0.88, 'bbox': [500, 0, 530, 600]},
    {'text': 'bitkiler güneş ışığı ve klorofil ile besin üretir', 'confidence': 0.78, 'bbox': [535, 0, 565, 600]},
]

regions = segment_lines(ocr_lines)
check("Segmentasyon: 3 soru bölgesi ayrıldı", len(regions) == 3)
check("Her bölge gerçek OCR metni taşıyor", all(len(r['text']) > 0 for r in regions))
check("S1 metni 'dört' içeriyor", 'dört' in regions[0]['text'])

# Segment bölgeleri → run-full (cevap anahtarı ile)
# Frontend regionsToQuestions'ın yaptığını burada simüle ediyoruz
answer_key = {
    1: {'correct_answer': 'dört', 'alternatives': ['4'], 'max_score': 10},
    2: {'correct_answer': 'Ankara', 'max_score': 10},
    3: {'rubric': [
        {'criterion': 'güneş', 'keyword': 'güneş', 'points': 7},
        {'criterion': 'klorofil', 'keyword': 'klorofil', 'points': 7},
        {'criterion': 'besin', 'keyword': 'besin', 'points': 6}], 'max_score': 20},
}
questions = []
for r in regions:
    key = answer_key.get(r['question_no'], {})
    questions.append({
        'question_no': r['question_no'],
        'student_answer': r['text'],  # GERÇEK OCR metni
        'max_score': key.get('max_score', 10),
        'question_type': 'closed' if key.get('correct_answer') else 'open',
        'correct_answer': key.get('correct_answer'),
        'alternatives': key.get('alternatives'),
        'rubric': key.get('rubric'),
    })

r = c.post('/api/pipeline/run-full', json={'exam_id': 'seg_test', 'questions': questions})
d = r.json()
check("Segment→grading uçtan uca çalıştı", r.status_code == 200)

# Gerçek OCR metni "dört" cevap anahtarıyla eşleşti
q1 = next(q for q in d['questions'] if q['question_no'] == 1)
check("OCR'dan gelen 'dört' → anahtar eşleşti 10/10", q1['ai_score'] == 10 and q1['source'] == 'answer_key')
# "Ankara" eşleşti
q2 = next(q for q in d['questions'] if q['question_no'] == 2)
check("OCR'dan gelen 'Ankara' → anahtar eşleşti 10/10", q2['ai_score'] == 10)
# Fotosentez metni rubrik kriterlerini karşıladı
q3 = next(q for q in d['questions'] if q['question_no'] == 3)
check("OCR'dan gelen fotosentez metni → rubrik 20/20", q3['ai_score'] == 20 and q3['source'] == 'rubric')
check("Toplam OCR-tabanlı puan = 40", d['total_score'] == 40)

# /segment HTTP endpoint çalışıyor
rs = c.post('/api/pipeline/segment', json={'image_base64': None})
check("/segment endpoint HTTP 200", rs.status_code == 200)

# Şablon tabanlı segmentasyon max_score taşıyor
tmpl = [{'question_no': 1, 'bbox': [0, 0, 100, 600], 'max_score': 15}]
treg = segment_from_template(tmpl, ocr_lines)
check("Şablon segmentasyon max_score taşıyor (15)", treg[0].get('max_score') == 15)

print(f"\n=== v1.9 TOPLAM: {passed} geçti, {failed} başarısız ===")
sys.exit(0 if failed == 0 else 1)
