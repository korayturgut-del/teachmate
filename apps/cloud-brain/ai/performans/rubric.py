"""Dijital Öğretmen Asistanı — Performans AI · Rubrik Motoru

ai/performans/rubric.py
Gözlem Notlarından Deterministik Kalıp ve Örüntü Yakalama Altyapısı.

Bu dosya YALNIZCA performans AI'ına aittir.
"""

import re

from ai.performans.prompts import BEHAVIOR_SEED_DATABASE, MAARIF_ONTOLOGY_TREE

# Eğilimin hangi gelişim boyutuna ait olduğunu belirleyen statik harita.
# (prompts.py içindeki EGILIMLER ile tutarlıdır.)
_EGILIM_SOSYAL = {
    "iş birliği", "iletişim", "empati", "liderlik",
    "sorumluluk bilinci", "saygı", "uzlaşma",
}
_EGILIM_BENLIK = {
    "öz farkındalık", "öz düzenleme", "azim", "sabır",
    "öz güven", "estetik duyarlılık", "merhamet",
}

# Karar motoru ağırlık katsayıları (pedagojik önem)
_WEIGHT = {"Pozitif": 8, "Negatif": -5, "Nötr": 0}


class MaarifRubric:
    """Süreç odaklı, matematiksel ve ontolojik kural motoru."""

    BANDS = [
        (90, "Üst Düzey — Çok sayıda bütüncül Maarif eğilimi ve kök değeri somut kanıtlarla gözlendi."),
        (75, "İleri Düzey — Birden fazla değer ve süreç becerisi başarıyla sergilendi."),
        (60, "Gelişmekte Olan Düzey — Karakter ve süreç eğilimleri kısmen görünürlük sağladı."),
        (45, "Başlangıç Düzeyi — Sınırlı eylem göstergesi; içsel farkındalık desteği gerekli."),
        (0,  "Geliştirilmesi Gereken Düzey — Değerlendirme için daha fazla somut eylem gözlemi gerekli."),
    ]

    @staticmethod
    def _egilim_kategorisi(egilim: str) -> str:
        """Eğilimi entelektuel / sosyal / benlik boyutuna eşler."""
        if egilim in _EGILIM_SOSYAL:
            return "sosyal"
        if egilim in _EGILIM_BENLIK:
            return "benlik"
        return "entelektuel"

    def extract_evidences_with_ontology(
        self, observation_text: str, primary_dimension: str = "entelektuel",
    ) -> list[dict]:
        """[RETRIEVAL ENGINE] Ham gözlem metnini örüntü kütüphanesiyle tarar.

        LLM'e hiç uğramadan, eşleşen davranış kodlarını ve ontolojik üst
        boyutlarını (Akl-ı Selim vb.) deterministik biçimde döndürür.
        """
        if not observation_text or len(observation_text.strip()) < 5:
            return []

        text_lower = observation_text.lower()
        matched_evidences: list[dict] = []
        activated_codes: set[str] = set()

        for entry in BEHAVIOR_SEED_DATABASE:
            if entry["id"] in activated_codes:
                continue

            for pattern in entry["evidence_patterns"]:
                # Türkçe ek esnekliğini yakalamak için kalıbın sonuna \w* ekliyoruz.
                if re.search(r'\b' + re.escape(pattern.lower()) + r'\w*', text_lower):
                    deger_adi = entry["deger"]
                    ontology_node = MAARIF_ONTOLOGY_TREE.get(
                        deger_adi, {"ust_boyut": "Bütüncül Gelişim"},
                    )
                    pn = entry.get("pozitif_negatif", "Pozitif")

                    matched_evidences.append({
                        "id": entry["id"],
                        "deger": deger_adi,
                        # gosterge artık seed'de var; yoksa davranis'e düş (güvenli).
                        "gosterge": entry.get("gosterge", entry.get("davranis", "")),
                        "alt_kategori": entry.get("alt_kategori", ""),
                        "egilim": entry["egilim"],
                        "egilim_turu": self._egilim_kategorisi(entry["egilim"]),
                        "beceri": entry["beceri"],
                        "ust_boyut": ontology_node["ust_boyut"],
                        "pozitif_negatif": pn,
                        "weight": _WEIGHT.get(pn, 0),
                    })
                    activated_codes.add(entry["id"])
                    break  # Bu davranış kodu için tek eşleşme yeterli.

        return matched_evidences

    def calculate_deterministic_score(
        self, matched_evidences: list, base_score: int = 65,
    ) -> int:
        """[KARAR MOTORU] Puanı LLM'den tamamen soyutlayıp matematiksel mühürler."""
        if not matched_evidences:
            return base_score  # Hiç gösterge tetiklenmediyse nötr taban.

        score_modifier = sum(item["weight"] for item in matched_evidences)
        final_score = base_score + score_modifier
        return max(0, min(final_score, 100))

    @staticmethod
    def band_label(score: int) -> str:
        """Skorun hangi gelişim bandına denk geldiğini bulur."""
        for threshold, label in MaarifRubric.BANDS:
            if score >= threshold:
                return label
        return MaarifRubric.BANDS[-1][1]

    # ── Geriye dönük uyumluluk: eski statik metot imzaları korunur ──────────
    @staticmethod
    def score_from_observation(observation: str, has_photo: bool = False) -> int:
        engine = MaarifRubric()
        return engine.calculate_deterministic_score(
            engine.extract_evidences_with_ontology(observation, "entelektuel"),
        )

    @staticmethod
    def detect_tendencies(observation: str, dimension: str = "entelektuel") -> list[str]:
        engine = MaarifRubric()
        evs = engine.extract_evidences_with_ontology(observation, dimension)
        return [e["egilim"] for e in evs] if evs else ["merak"]

    @staticmethod
    def detect_values(observation: str) -> list[str]:
        engine = MaarifRubric()
        evs = engine.extract_evidences_with_ontology(observation, "entelektuel")
        return [e["deger"] for e in evs] if evs else ["Sorumluluk"]

    @staticmethod
    def detect_skills(observation: str) -> list[str]:
        engine = MaarifRubric()
        evs = engine.extract_evidences_with_ontology(observation, "entelektuel")
        return [e["beceri"] for e in evs] if evs else ["problem çözme"]
