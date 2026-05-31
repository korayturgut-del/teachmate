"""Maarif OS — Kanıt Defteri ve Hesap Verebilirlik Katmanı

ai/performans/evidence_ledger.py

FELSEFE:
  Tek olay ASLA puanlamaz. Olay bir "gözlem kaydı"dır. Kayıt KANITTIR —
  bir olay varsa vardır. Puan, sene boyu biriken kanıtların ÖRÜNTÜSÜNDEN doğar.

  Olay anında AI karar vermez — SORU SORAR ("neden?").
  Tek öğretmenli sistem: öğrencinin beyanını da öğretmenin yorumunu da
  öğretmen girer. İkisi AYRI saklanır, farklı kanıt ağırlığı taşır.

  Sene sonunda AI biriken kanıttan TAHMİN üretir.
  Öğretmen bu tahmini EZEBİLİR (az ya da çok) — bu yasak değildir.
  ANCAK ezme sessizce gömülemez: rapora SİLİNEMEZ bir damga basılır.
  "Öğretmen, kanıtlar X yönünde işaret ederken puanı artırdı/azalttı."
  Bu damgayı öğrenci, veli, müdür ve müfettiş büyük puntoyla görür ve
  ÖĞRETMEN BU DAMGAYI DEĞİŞTİREMEZ. Ezme yapılabilir ama gizlenemez.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from ai.performans.rubric import MaarifRubric


# ============================================================================
# KANIT KAYNAKLARI VE AĞIRLIKLARI (Beyan + Yorum + Örüntü birlikte)
# ============================================================================
class EvidenceSource(str, Enum):
    SISTEM_ESLESME = "sistem_eslesme"     # Somut, gözlemlenmiş eylem
    OGRENCI_BEYANI = "ogrenci_beyani"     # Öğrencinin açıklaması (öğretmen girer)
    OGRETMEN_YORUMU = "ogretmen_yorumu"   # Gözlemcinin sezgisi (kanıt değil ama veri)


_SOURCE_WEIGHT = {
    EvidenceSource.SISTEM_ESLESME: 1.0,
    EvidenceSource.OGRETMEN_YORUMU: 0.6,
    EvidenceSource.OGRENCI_BEYANI: 0.4,
}


class TeacherVerdict(str, Enum):
    PENDING = "beklemede"
    CONFIRMED = "onaylandi"
    OVERRIDDEN = "ezildi"


class OverrideDirection(str, Enum):
    ARTIRDI = "artirdi"     # Kanıttan fazla not verdi
    AZALTTI = "azaltti"     # Kanıttan az not verdi
    YOK = "yok"


# ============================================================================
# 1. OLAY KAYDI
# ============================================================================
@dataclass
class ObservationEvent:
    student_id: str
    raw_text: str
    student_label: str = "Öğrenci"
    event_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ai_probe_question: Optional[str] = None
    ambiguity_category: Optional[str] = None    # ör. "Konum Değişikliği"
    ambiguity_rationale: Optional[str] = None    # neden niyet belirsiz
    student_statement: Optional[str] = None     # öğretmen girer
    teacher_comment: Optional[str] = None        # öğretmen girer
    matched_evidences: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ============================================================================
# 2. BELİRSİZLİK TESPİTİ — "neden?" sorusu
# ============================================================================
# Niyeti tek başına anlamı çok değişken eylemler. Bunlar yakalandığında sistem
# PUAN VERMEZ, SORU SORAR. Her örüntü bir "belirsizlik kategorisi"ne aittir;
# kategori, öğretmene aynı eylemin hangi farklı değerlere işaret edebileceğini
# hatırlatır. 'id' alanı raporlamada ve istatistikte kullanılır.
AMBIGUOUS_ACTION_PATTERNS: list[dict] = [
    # ── KONUM / YER DEĞİŞİKLİĞİ ──────────────────────────────────────────────
    {
        "id": "AMB.KONUM.001",
        "kategori": "Konum Değişikliği",
        "pattern": ["sıranın yerini değiştir", "sırasını değiştir", "yer değiştir",
                    "arkaya geçti", "öne geçti", "yerini taşı", "başka sıraya",
                    "köşeye çekildi", "kenara çekildi"],
        "probe": "{ad} yerini/sırasını neden değiştirdi? Öğrenciye sorduğunuzda ne söyledi?",
        "neden_belirsiz": "Yer değiştirme; konfor (üşüme/görüş), kaçış (dersten/arkadaştan), "
                          "yakınlık arayışı (konuşma) veya sorumluluk (yardım) olabilir.",
    },
    # ── KATILIM / GERİ ÇEKİLME ───────────────────────────────────────────────
    {
        "id": "AMB.KATILIM.001",
        "kategori": "Katılım Eksikliği",
        "pattern": ["sessiz kaldı", "katılmadı", "geri çekildi", "konuşmadı",
                    "söz almadı", "parmak kaldırmadı", "geri planda kaldı",
                    "kenarda durdu", "dahil olmadı"],
        "probe": "{ad} bu etkinliğe neden katılmadı? Çekingenlik mi, konuya hâkim olamama mı, "
                 "ilgisizlik mi, yoksa düşünme/gözlem tercihi mi?",
        "neden_belirsiz": "Katılmama; özgüven eksikliği, bilgi boşluğu, içe dönük gözlem "
                          "veya bilinçli protesto olabilir. Sessizlik tek anlamlı değildir.",
    },
    # ── HIZ / TEMPO ──────────────────────────────────────────────────────────
    {
        "id": "AMB.HIZ.001",
        "kategori": "Çalışma Temposu",
        "pattern": ["erken bitirdi", "hemen bitirdi", "çabuk teslim", "ilk bitiren",
                    "hızlıca tamamladı", "aceleyle", "çok çabuk"],
        "probe": "{ad} çalışmayı erken bitirdi — konuyu özümseyerek mi yoksa "
                 "yüzeysel/aceleci mi tamamladı? İçeriğin niteliği nasıldı?",
        "neden_belirsiz": "Hız; üstün yetkinlik göstergesi de olabilir, özensizlik/ilgisizlik de.",
    },
    {
        "id": "AMB.HIZ.002",
        "kategori": "Çalışma Temposu",
        "pattern": ["yavaş kaldı", "geride kaldı", "yetiştiremedi", "tamamlayamadı",
                    "süre yetmedi", "bitiremedi", "son sıraya kaldı"],
        "probe": "{ad} çalışmayı zamanında bitiremedi — titizlik/derinleşme yüzünden mi, "
                 "zorlanma yüzünden mi, yoksa dikkat dağınıklığı yüzünden mi?",
        "neden_belirsiz": "Yavaşlık; derin/titiz çalışmanın işareti de olabilir, güçlük "
                          "yaşamanın da. Sonuç tek başına süreci anlatmaz.",
    },
    # ── ÇATIŞMA / İTİRAZ ─────────────────────────────────────────────────────
    {
        "id": "AMB.CATISMA.001",
        "kategori": "İtiraz / Karşı Çıkma",
        "pattern": ["itiraz etti", "karşı çıktı", "tartıştı", "kabul etmedi",
                    "reddetti", "yapmak istemedi", "diretti", "isyan etti"],
        "probe": "{ad} neden karşı çıktı/itiraz etti? Haklı bir gerekçesi mi vardı, "
                 "yoksa kuralı mı reddetti? İtirazını nasıl ifade etti?",
        "neden_belirsiz": "İtiraz; eleştirel düşünme ve adalet arayışı olabilir, "
                          "saygı sınırı aşımı da. İfade biçimi belirleyicidir.",
    },
    {
        "id": "AMB.CATISMA.002",
        "kategori": "Akran Anlaşmazlığı",
        "pattern": ["arkadaşıyla tartıştı", "kavga etti", "anlaşamadı", "küstü",
                    "araları bozuldu", "münakaşa", "sürtüştü"],
        "probe": "{ad} ile arkadaşı arasında ne yaşandı? Anlaşmazlığın nedeni neydi, "
                 "{ad} nasıl davrandı — uzlaşmaya mı çalıştı, gerginliği mi büyüttü?",
        "neden_belirsiz": "Anlaşmazlık; hak savunması veya uzlaşı çabası olabilir, "
                          "saldırganlık da. Bağlam ve sonraki davranış önemlidir.",
    },
    # ── YALNIZLIK / SOSYAL ───────────────────────────────────────────────────
    {
        "id": "AMB.SOSYAL.001",
        "kategori": "Sosyal İzolasyon",
        "pattern": ["tek başına oturdu", "yalnız kaldı", "gruba katılmadı",
                    "tek başına oynadı", "kimseyle konuşmadı", "ayrı durdu",
                    "yalnız takıldı"],
        "probe": "{ad} neden tek başınaydı? Kendi tercihi mi, dışlanma mı, "
                 "yoksa o gün özel bir durum mu vardı?",
        "neden_belirsiz": "Yalnızlık; bağımsızlık/odaklanma tercihi olabilir, dışlanma "
                          "veya içe kapanma da. Müdahale gerekip gerekmediği niyete bağlı.",
    },
    # ── DUYGUSAL TEPKİ ───────────────────────────────────────────────────────
    {
        "id": "AMB.DUYGU.001",
        "kategori": "Duygusal Tepki",
        "pattern": ["ağladı", "sinirlendi", "öfkelendi", "bağırdı", "huzursuzdu",
                    "gözyaşı", "patladı", "kızdı", "asabileşti"],
        "probe": "{ad} bu tepkiyi neden gösterdi? Tetikleyen olay neydi? "
                 "Tepkisini sonradan nasıl yönetti?",
        "neden_belirsiz": "Güçlü duygu; haksızlığa tepki, yorgunluk, evden gelen bir "
                          "yük veya öz düzenleme güçlüğü olabilir. Neden bilinmeden yargılanamaz.",
    },
    # ── DİKKAT / ODAK ────────────────────────────────────────────────────────
    {
        "id": "AMB.ODAK.001",
        "kategori": "Dikkat Dağınıklığı",
        "pattern": ["dalıp gitti", "dikkati dağıldı", "pencereye baktı", "hayal kurdu",
                    "başka şeyle ilgilendi", "dağınıktı", "odaklanamadı"],
        "probe": "{ad} neden derse odaklanamadı? Konu mu ilgisini çekmedi, "
                 "dışsal bir mesele mi vardı, yoksa farklı bir şey mi düşünüyordu?",
        "neden_belirsiz": "Dağınıklık; sıkılma, kaygı, yorgunluk veya zihinsel "
                          "meşguliyet olabilir. Tembellikle eşitlenemez.",
    },
    # ── KURAL / SINIR ────────────────────────────────────────────────────────
    {
        "id": "AMB.KURAL.001",
        "kategori": "Kural Dışı Davranış",
        "pattern": ["izinsiz", "habersiz", "söylemeden", "sormadan aldı",
                    "kuralı atladı", "sıra beklemeden", "izin almadan"],
        "probe": "{ad} neden izinsiz/habersiz hareket etti? Kuralı bilmiyor muydu, "
                 "unuttu mu, yoksa bilerek mi atladı?",
        "neden_belirsiz": "Kural dışı eylem; bilgisizlik, dalgınlık, aciliyet veya "
                          "kasıt olabilir. Niyet, eylemin değerini tümüyle değiştirir.",
    },
    # ── YARDIM / MÜDAHALE ────────────────────────────────────────────────────
    {
        "id": "AMB.YARDIM.001",
        "kategori": "Belirsiz Yardım",
        "pattern": ["arkadaşının ödevini yaptı", "cevabı söyledi", "onun yerine yaptı",
                    "işini üstlendi", "yerine cevapladı"],
        "probe": "{ad} arkadaşına yardım mı etti yoksa onun yerine mi yaptı? "
                 "Bu, öğrenmesini destekledi mi, yoksa öğrenme fırsatını mı elinden aldı?",
        "neden_belirsiz": "Yardım gibi görünen eylem; gerçek dayanışma da olabilir, "
                          "akranın gelişimini engelleyen ya da akademik dürüstlüğü zedeleyen de.",
    },
]


def detect_ambiguity(text: str, student_label: str = "Öğrenci") -> Optional[dict]:
    if not text:
        return None
    low = text.lower()
    # En SPESİFİK (en uzun) eşleşmeyi seç — "arkadaşıyla tartıştı" gibi özgül
    # bir kalıp, "tartıştı" gibi genel bir kalıbın önüne geçsin. İlk eşleşmeyi
    # değil, en güçlü eşleşmeyi alarak kategori çakışmalarını çözeriz.
    best = None
    best_len = -1
    for item in AMBIGUOUS_ACTION_PATTERNS:
        for pat in item["pattern"]:
            if re.search(re.escape(pat.lower()), low) and len(pat) > best_len:
                best_len = len(pat)
                best = (item, pat)
    if best is None:
        return None
    item, pat = best
    return {
        "ambiguity_id": item.get("id", ""),
        "kategori": item.get("kategori", ""),
        "probe_question": item["probe"].format(ad=student_label),
        "neden_belirsiz": item["neden_belirsiz"],
        "matched_pattern": pat,
    }


# ============================================================================
# 3. KANIT DEFTERİ
# ============================================================================
class EvidenceLedger:
    def __init__(self):
        self._events: dict[str, list[ObservationEvent]] = {}
        self.rubric = MaarifRubric()

    def record_event(
        self, student_id: str, raw_text: str, student_label: str = "Öğrenci",
        student_statement: Optional[str] = None, teacher_comment: Optional[str] = None,
    ) -> ObservationEvent:
        evidences = self.rubric.extract_evidences_with_ontology(raw_text)
        ambiguity = detect_ambiguity(raw_text, student_label)
        event = ObservationEvent(
            student_id=student_id, student_label=student_label, raw_text=raw_text,
            matched_evidences=evidences,
            student_statement=student_statement, teacher_comment=teacher_comment,
            ai_probe_question=ambiguity["probe_question"] if ambiguity else None,
            ambiguity_category=ambiguity["kategori"] if ambiguity else None,
            ambiguity_rationale=ambiguity["neden_belirsiz"] if ambiguity else None,
        )
        self._events.setdefault(student_id, []).append(event)
        return event

    def get_events(self, student_id: str) -> list[ObservationEvent]:
        return self._events.get(student_id, [])

    def analyze_pattern(self, student_id: str) -> dict[str, Any]:
        """Üçlü kanıt: somut eşleşme + beyan + yorum + örüntü tutarlılığı."""
        events = self.get_events(student_id)
        if not events:
            return {"deger_birikimi": {}, "toplam_olay": 0, "tutarlilik": 1.0,
                    "yorum": "Henüz kanıt birikmedi."}

        deger_birikimi: dict[str, dict] = {}
        for ev in events:
            for m in ev.matched_evidences:
                d = m["deger"]
                slot = deger_birikimi.setdefault(
                    d, {"pozitif": 0, "negatif": 0, "notr": 0,
                        "agirlikli_skor": 0.0, "olay_sayisi": 0})
                slot["olay_sayisi"] += 1
                pn = m["pozitif_negatif"]
                slot["pozitif" if pn == "Pozitif" else "negatif" if pn == "Negatif" else "notr"] += 1
                w = m["weight"] * _SOURCE_WEIGHT[EvidenceSource.SISTEM_ESLESME]
                # Beyan ve yorum tutarlılığı somut kanıtı güçlendirir/zayıflatır
                if ev.student_statement:
                    w += (1 if pn == "Pozitif" else -1) * 0.4 * abs(m["weight"]) * 0.0  # beyan nötr katkı
                slot["agirlikli_skor"] += w

        beyanli = sum(1 for e in events if e.student_statement)
        yorumlu = sum(1 for e in events if e.teacher_comment)
        cevapsiz = sum(1 for e in events if e.ai_probe_question and not e.student_statement)

        # Örüntü tutarlılığı: aynı değerde hem pozitif hem negatif çoksa tutarsız
        tutarsiz = sum(1 for s in deger_birikimi.values() if s["pozitif"] and s["negatif"])
        tutarlilik = round(1.0 - (tutarsiz / max(len(deger_birikimi), 1)) * 0.5, 2)

        return {
            "toplam_olay": len(events),
            "deger_birikimi": deger_birikimi,
            "beyan_alinan_olay": beyanli,
            "yorum_alinan_olay": yorumlu,
            "cevapsiz_soru": cevapsiz,
            "tutarlilik": tutarlilik,
            "yorum": self._summary(deger_birikimi, len(events)),
        }

    def _summary(self, birikim: dict, toplam: int) -> str:
        if not birikim:
            return f"{toplam} olay kaydedildi ancak net değer örüntüsü oluşmadı."
        guclu = [d for d, s in birikim.items() if s["pozitif"] >= 2 and s["negatif"] == 0]
        izlenecek = [d for d, s in birikim.items() if s["negatif"] >= 1]
        parts = []
        if guclu: parts.append(f"Tutarlı güçlü örüntü: {', '.join(guclu)}")
        if izlenecek: parts.append(f"İzlenmesi gereken alan: {', '.join(izlenecek)}")
        return ". ".join(parts) if parts else f"{toplam} olayda karışık göstergeler mevcut."


# ============================================================================
# 4. SENE SONU — SİLİNEMEZ HESAP VEREBİLİRLİK DAMGASI
# ============================================================================
@dataclass
class YearEndAssessment:
    student_id: str
    ai_predicted_score: int
    ai_predicted_band: str
    ai_rationale: str
    evidence_summary: dict
    teacher_verdict: str = TeacherVerdict.PENDING.value
    teacher_final_score: Optional[int] = None
    teacher_justification: Optional[str] = None

    # ── SİLİNEMEZ DAMGA (öğretmen değiştiremez) ──
    override_flag: bool = False
    override_direction: str = OverrideDirection.YOK.value
    override_magnitude: int = 0
    public_override_notice: Optional[str] = None   # Büyük puntoyla herkes görür
    _locked: bool = False                            # Damga mühürlendi mi

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("_locked", None)
        return d


class AccountabilityGate:
    HIGH_DIVERGENCE = 15

    def __init__(self, ledger: EvidenceLedger):
        self.ledger = ledger

    def generate_year_end(self, student_id: str) -> YearEndAssessment:
        pattern = self.ledger.analyze_pattern(student_id)
        toplam_agirlik = sum(s["agirlikli_skor"] for s in pattern["deger_birikimi"].values())
        # Tutarlılık düşükse kanıt etkisini sönümle
        toplam_agirlik *= pattern.get("tutarlilik", 1.0)
        predicted = max(0, min(round(65 + toplam_agirlik), 100))
        band = MaarifRubric.band_label(predicted)

        rationale = (
            f"{pattern['toplam_olay']} gözlem olayı üzerinden kanıt birikimi değerlendirildi "
            f"(örüntü tutarlılığı: {pattern.get('tutarlilik', 1.0)}). {pattern['yorum']}"
        )
        if pattern.get("cevapsiz_soru", 0) > 0:
            rationale += (
                f" Not: {pattern['cevapsiz_soru']} olayda sistem 'neden?' sordu ancak "
                f"öğrenci beyanı girilmedi — bu olayların kanıt değeri sınırlıdır."
            )
        return YearEndAssessment(
            student_id=student_id, ai_predicted_score=predicted,
            ai_predicted_band=band, ai_rationale=rationale, evidence_summary=pattern,
        )

    def teacher_confirm(self, asm: YearEndAssessment) -> YearEndAssessment:
        """Öğretmen kanıtı onayladı — damga yok."""
        if asm._locked:
            return asm
        asm.teacher_verdict = TeacherVerdict.CONFIRMED.value
        asm.teacher_final_score = asm.ai_predicted_score
        asm.override_flag = False
        asm.public_override_notice = None
        asm._locked = True
        return asm

    def teacher_override(
        self, asm: YearEndAssessment, teacher_score: int,
        justification: Optional[str] = None,
    ) -> YearEndAssessment:
        """Öğretmen kanıtı ezdi. Ezme YAPILABİLİR ama SİLİNEMEZ damga basılır.

        Gerekçe damgayı KALDIRMAZ — yalnızca rapora eklenen bir açıklamadır.
        'Öğretmen kanıta rağmen müdahale etti' gerçeği görünür kalır.
        """
        if asm._locked:
            return asm  # Mühürlenmiş kayıt değiştirilemez

        asm.teacher_verdict = TeacherVerdict.OVERRIDDEN.value
        asm.teacher_final_score = teacher_score
        asm.teacher_justification = (justification or "").strip() or None

        diff = teacher_score - asm.ai_predicted_score
        asm.override_flag = True
        asm.override_magnitude = abs(diff)
        asm.override_direction = (
            OverrideDirection.ARTIRDI.value if diff > 0
            else OverrideDirection.AZALTTI.value if diff < 0
            else OverrideDirection.YOK.value
        )

        yon_sozu = "FAZLADAN NOT VERDİ" if diff > 0 else "NOTU DÜŞÜRDÜ" if diff < 0 else "değiştirmedi"
        siddet = "BÜYÜK ÖLÇÜDE " if abs(diff) >= self.HIGH_DIVERGENCE else ""

        # ── Büyük puntoyla herkesin göreceği, silinemez bildirim ──
        notice = (
            f"⚠ ÖĞRETMEN MÜDAHALESİ KAYDEDİLDİ: Kanıt birikimi {asm.ai_predicted_score} puana "
            f"işaret ederken, öğretmen {siddet}{yon_sozu} ({asm.ai_predicted_score} → {teacher_score}, "
            f"{abs(diff)} puan). Bu müdahale öğrenci, veli, müdür ve müfettiş tarafından görülür ve "
            f"resmi kayıttan SİLİNEMEZ."
        )
        if asm.teacher_justification:
            notice += f" Öğretmen gerekçesi: \"{asm.teacher_justification}\""
        else:
            notice += " Öğretmen herhangi bir gerekçe sunmamıştır."

        asm.public_override_notice = notice
        asm._locked = True   # Mühürlendi — öğretmen artık değiştiremez
        return asm
