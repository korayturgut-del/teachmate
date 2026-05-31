"""Dijital Öğretmen Asistanı — Performans AI · Değerlendirici Çekirdek Motoru

ai/performans/evaluator.py
Maarif OS Çoklu Ajan Orkestrasyonu ve Deterministik Akış Katmanı.

İZOLASYON:
  - Sağlayıcıya ai/ortak/provider.py üzerinden erişir
  - ai/yazili_okuma/* dosyalarını ASLA import etmez
  - Sağlayıcı yoksa MaarifRubric ile deterministik puanlama yapar
"""

import json
import re
from typing import Any, Optional

from ai.ortak.provider import ai_provider
from ai.performans.prompts import (
    GRADE_TYPE_FOCUS, build_maarif_system_prompt, build_maarif_user_prompt,
    MAARIF_SYSTEM_PERSONA,
)
from ai.performans.rubric import MaarifRubric


class PerformansEvaluator:
    """Maarif Muallimi üslubuyla süreç değerlendirme motoru.

    Dış API (evaluate_performance, analyze_exam) korunur; iç mantık
    deterministik kural motoruna ve çoklu ajan mimarisine bağlanır.
    """

    def __init__(self):
        self.rubric = MaarifRubric()

    @property
    def active_provider(self) -> str:
        return ai_provider.active

    # ── Mod 1: Performans Değerlendirme ─────────────────────────────────────
    async def evaluate_performance(
        self,
        grade_type: str,
        observation: str,
        student_name: str = "Öğrenci",
        image_base64: Optional[str] = None,
    ) -> dict[str, Any]:
        """EDE çerçevesinde performans değerlendiren ana pipeline."""
        focus = GRADE_TYPE_FOCUS.get(grade_type, {
            "label": grade_type,
            "primary_dimension": "entelektuel",
            "hint": "Genel süreç değerlendirmesi.",
        })

        # 1. DETERMİNİSTİK KATMAN: LLM'e gitmeden veriyi süz, puanı mühürle.
        evidences = self.rubric.extract_evidences_with_ontology(
            observation, focus["primary_dimension"],
        )
        calculated_score = self.rubric.calculate_deterministic_score(evidences)

        # 2. ÇOKLU AJAN DÖNGÜSÜ: Gerçek bir LLM sağlayıcı aktifse dene.
        #    "none"/"mock"/"rubric" → LLM yok, doğrudan deterministik motora git.
        if ai_provider.active not in ("none", "mock", "rubric"):
            result = await self._try_multi_agent_evaluate(
                student_name, observation, focus,
                evidences, calculated_score,
                bool(image_base64), image_base64,
            )
            if result is not None:
                return result

        # 3. GÜVENLİ MOD: Sağlayıcı yoksa / validator reddettiyse kural motoru.
        return self._execute_deterministic_fallback(
            student_name, focus, evidences, calculated_score,
        )

    async def _try_multi_agent_evaluate(
        self, student_name, observation, focus,
        evidences, calculated_score, has_image, image_base64,
    ) -> Optional[dict[str, Any]]:
        """[ÇOKLU AJAN REFINEMENT] Generator yazar, Validator denetler."""
        system_prompt = build_maarif_system_prompt(focus)
        max_retries = 3
        feedback_loop_note = ""

        for _attempt in range(max_retries):
            user_prompt = build_maarif_user_prompt(student_name, focus, observation)
            if feedback_loop_note:
                user_prompt += f"\n\n[DENETÇİ AJAN UYARISI]: {feedback_loop_note}"

            raw = await ai_provider.grade(
                question=system_prompt,
                answer=user_prompt,
                max_score=100,
                needs_vision=has_image,
                image_base64=image_base64,
            )
            if not raw:
                continue

            parsed_json = self._parse_ai_json(raw.get("explanation", ""))
            if not parsed_json:
                feedback_loop_note = (
                    "Çıktı geçerli bir JSON formatında değil. "
                    "Lütfen sadece istenen JSON şemasını ver."
                )
                continue

            is_valid, validation_note = self._validate_report(
                parsed_json, calculated_score, evidences,
            )
            if is_valid:
                # Skoru ve ontolojik düğümü motor mühürler — LLM değiştiremez.
                parsed_json["score_100"] = calculated_score
                parsed_json["band"] = MaarifRubric.band_label(calculated_score)
                parsed_json["provider"] = ai_provider.active
                parsed_json["maarif"] = self._build_maarif_payload_node(evidences)
                return parsed_json

            feedback_loop_note = validation_note

        return None  # Max retry aşıldı → güvenli fallback.

    def _validate_report(
        self, parsed_json: dict, expected_score: int, evidences: list,
    ) -> tuple[bool, str]:
        """[VALIDATOR AGENT] Halüsinasyon ve guardrail ihlallerini avlar."""
        # A) Dil Guardrail — doğru anahtar: yasakli_klinik_kelimeler
        forbidden_words = MAARIF_SYSTEM_PERSONA["dil_barajlari"]["yasakli_klinik_kelimeler"]
        report_str = json.dumps(parsed_json, ensure_ascii=False).lower()
        for word in forbidden_words:
            if re.search(r'\b' + re.escape(word.lower()) + r'\b', report_str):
                return False, (
                    f"Raporda yasaklı klinik kelime tespit edildi: '{word}'. "
                    "Lütfen dili Maarif üslubuna göre yeniden düzenle."
                )

        # B) Kavram halüsinasyonu — veride hiç gösterge yokken spesifik değer uydurma.
        observed_values = {ev["deger"].lower() for ev in evidences}
        comment_lower = parsed_json.get("maarif_muallimi_yorumu", "").lower()
        if not observed_values and (
            "adalet" in comment_lower or "merhamet" in comment_lower
        ):
            return False, (
                "Ham veride gözlemlenmeyen kök değerler hakkında yorum üretildi. "
                "Lütfen sadece sağlanan verilere sadık kal."
            )

        return True, ""

    def _execute_deterministic_fallback(
        self, student_name: str, focus: dict, evidences: list, score: int,
    ) -> dict[str, Any]:
        """AI devre dışı / denetimden geçemediğinde çalışan hatasız kural motoru."""
        band = MaarifRubric.band_label(score)
        maarif_node = self._build_maarif_payload_node(evidences)
        observed = (
            ", ".join(maarif_node["cati_degerler"])
            if maarif_node["cati_degerler"] else "gelişim alanları"
        )

        return {
            "score_100": score,
            "maarif": maarif_node,
            "maarif_muallimi_yorumu": (
                f"{student_name} için {focus['label'].lower()} sürecini "
                f"Erdem-Değer-Eylem zincirinde inceledim. Öğrencinin sergilediği "
                f"eylemler neticesinde süreç gelişimi '{band}' olarak belirlenmiştir. "
                f"Süreç boyunca {observed} odakları üzerinde izler gözlemlenmiştir. "
                f"Maarif Modeli gereği çocuğun gayreti ve potansiyeli sürekli izlenecektir."
            ),
            "guclu_yonler": (
                f"{student_name}, süreç içerisinde {observed} temelli olumlu "
                f"eylem göstergeleri sergilemiştir."
            ),
            "gelisim_alanlari": (
                "Gözlem kayıtları zenginleştikçe, öğrencinin içsel potansiyeli "
                "daha net akl-ı selim ve kalb-i selim çıktılarına dönüşecektir."
            ),
            "yansitici_sorular": [
                "Bu çalışmayı yaparken içindeki hangi güçlü değeri kullandığını düşünüyorsun?",
                "Bir sonraki etkinlikte arkadaşlarına daha fazla nasıl destek olabilirsin?",
            ],
            "feedback_for_student": (
                f"Sevgili {student_name}, bu süreçteki her bir gayretin, senin "
                f"gelecekteki şahsiyetini inşa ediyor. Çaban çok değerli, yürümeye devam edelim."
            ),
            "band": band,
            "provider": "rubric_engine",
        }

    def _build_maarif_payload_node(self, evidences: list) -> dict:
        """Yakalanan kayıtları frontend JSON şemasına eşler."""
        payload = {
            "cati_degerler": [],
            "egilimler": {"entelektuel": [], "sosyal": [], "benlik": []},
            "beceriler": [],
        }
        for ev in evidences:
            if ev["deger"].lower() not in [v.lower() for v in payload["cati_degerler"]]:
                payload["cati_degerler"].append(ev["deger"])

            kategori = ev["egilim_turu"]  # entelektuel | sosyal | benlik
            if ev["egilim"] not in payload["egilimler"][kategori]:
                payload["egilimler"][kategori].append(ev["egilim"])

            if ev["beceri"] not in payload["beceriler"]:
                payload["beceriler"].append(ev["beceri"])
        return payload

    def _parse_ai_json(self, text: str) -> Optional[dict]:
        """Metin içinden JSON bloğunu ayıklar."""
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                return None
        return None

    # ── Mod 2: Sınav Analizi ────────────────────────────────────────────────
    async def analyze_exam(
        self,
        questions: list[dict],
        image_base64: Optional[str] = None,
        student_name: str = "Öğrenci",
    ) -> dict[str, Any]:
        """Sınav kağıdını okur, soru bazlı puanlar (uyumluluk korunur)."""
        max_total = sum(int(q.get("puan", 10)) for q in questions)

        if ai_provider.has_vision and image_base64:
            findings = []
            total = 0
            for q in questions:
                q_max = int(q.get("puan", 10))
                raw = await ai_provider.grade(
                    question=q.get("soru", ""),
                    answer=q.get("cevap", ""),
                    max_score=q_max,
                    needs_vision=True,
                    image_base64=image_base64,
                )
                score = int(raw.get("score", 0)) if raw else 0
                total += score
                findings.append({
                    "questionId": q.get("num", len(findings) + 1),
                    "ocrText": raw.get("ocr_text", "") if raw else "",
                    "score": score,
                    "critique": raw.get("explanation", "") if raw else "",
                })
            percent = round((total / max_total) * 100) if max_total else 0
            return {
                "findings": findings, "studentName": student_name,
                "total_score": total, "max_score": max_total, "percent": percent,
                "overall_feedback": f"{student_name} sınavda {total}/{max_total} puan aldı.",
                "provider": ai_provider.active,
            }

        return {
            "findings": [
                {
                    "questionId": q.get("num", i + 1),
                    "ocrText": "", "score": 0,
                    "critique": "AI sağlayıcı pasif — bu soruyu manuel puanlayın.",
                }
                for i, q in enumerate(questions)
            ],
            "studentName": student_name, "total_score": 0,
            "max_score": max_total, "percent": 0,
            "overall_feedback": (
                "AI sağlayıcı yapılandırılmadığı için sınav iskeleti hazırlandı. "
                "Puanları manuel girebilirsiniz."
            ),
            "provider": "manual",
        }


# Performans AI singleton
performans_evaluator = PerformansEvaluator()
