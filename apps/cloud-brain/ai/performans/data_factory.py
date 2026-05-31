"""Maarif OS — Sentetik Davranış Verisi Üretim Fabrikası

ai/performans/data_factory.py

BEHAVIOR_SEED_DATABASE'deki tohum kayıtları; kademe × mekân × durum ×
linguistik varyasyon permütasyonuyla binlerce deterministik satıra çoğaltır.
Üretilen her kayıt, seed ile AYNI şemayı taşır (rubric motoru doğrudan okur).

Çıktı: JSON dosyası veya doğrudan Python listesi. LLM KULLANMAZ — tamamen
şablon tabanlı, tekrar üretilebilir (seed parametresiyle deterministik).
"""

from __future__ import annotations

import json
import random
from typing import Any, Optional

from ai.performans.prompts import BEHAVIOR_SEED_DATABASE, MAARIF_ONTOLOGY_TREE


# ── Varyasyon eksenleri ──────────────────────────────────────────────────────
MEKANLAR = {
    "İlkokul": ["sınıfta", "okul bahçesinde", "kütüphanede", "yemekhanede", "koridorda"],
    "Ortaokul": ["sınıfta", "laboratuvarda", "okul bahçesinde", "kütüphanede",
                 "spor salonunda", "yemekhanede"],
    "Lise": ["sınıfta", "laboratuvarda", "kütüphanede", "atölyede",
             "konferans salonunda", "spor salonunda"],
}

# Davranış kalıbına eklenebilecek doğal dil önekleri (linguistik varyasyon)
ONEKLER = [
    "{mekan} ", "Bugün {mekan} ", "Ders esnasında {mekan} ",
    "Etkinlik sırasında ", "Gözlemlendiği üzere {mekan} ", "",
]

# Pozitif/Negatif duruma göre pekiştirici son ekler
SONEKLER_POZITIF = [
    " ve bu davranışı öz motivasyonuyla sergiledi.",
    " ve süreç boyunca tutarlılık gösterdi.",
    " — kendiliğinden ve isteyerek.",
    ".",
]
SONEKLER_NEGATIF = [
    " ve bu konuda desteğe açık olduğu görüldü.",
    " — gelişim için izlenmesi uygun olacaktır.",
    ".",
]
SONEKLER_NOTR = [" (süreç gözlemlenmeye devam ediyor).", "."]


def _vary_text(davranis: str, mekan: str, pn: str, rng: random.Random) -> str:
    """Bir davranış cümlesine mekân + önek + sonek varyasyonu uygular."""
    onek = rng.choice(ONEKLER).format(mekan=mekan)
    # Önek varsa çekirdeğin ilk harfini küçült (cümle ortasında kalıyor)
    cekirdek = davranis
    if onek.strip():
        cekirdek = davranis[0].lower() + davranis[1:]
    if pn == "Pozitif":
        sonek = rng.choice(SONEKLER_POZITIF)
    elif pn == "Negatif":
        sonek = rng.choice(SONEKLER_NEGATIF)
    else:
        sonek = rng.choice(SONEKLER_NOTR)
    base = (onek + cekirdek).strip()
    base = base[0].upper() + base[1:] if base else base
    if base.endswith("."):
        base = base[:-1]
    return base + sonek


def generate(
    target_count: int = 1000,
    seed: int = 42,
    include_seed_originals: bool = True,
) -> list[dict[str, Any]]:
    """Tohum kayıtlardan target_count adet sentetik kayıt üretir.

    - Her sentetik kayıt benzersiz ID alır: <seed_id>.V<sıra>
    - Şema seed ile birebir aynıdır → rubric motoru ek kod olmadan okur.
    - seed parametresi sabit → çıktı tekrar üretilebilir (deterministik).
    """
    rng = random.Random(seed)
    out: list[dict[str, Any]] = []

    if include_seed_originals:
        out.extend(json.loads(json.dumps(BEHAVIOR_SEED_DATABASE, ensure_ascii=False)))

    if not BEHAVIOR_SEED_DATABASE:
        return out

    variant_counter: dict[str, int] = {}
    # Hedefe ulaşana kadar tohumlar üzerinde döngüsel gezerek varyasyon üret
    idx = 0
    while len(out) < target_count:
        base = BEHAVIOR_SEED_DATABASE[idx % len(BEHAVIOR_SEED_DATABASE)]
        idx += 1

        kademe = base.get("kademe", "Ortaokul")
        mekan = rng.choice(MEKANLAR.get(kademe, ["sınıfta"]))
        pn = base.get("pozitif_negatif", "Pozitif")

        n = variant_counter.get(base["id"], 0) + 1
        variant_counter[base["id"]] = n

        new_text = _vary_text(base["davranis"], mekan, pn, rng)

        # evidence_patterns'i koru; bağlam zenginleştikçe mekânı da kalıp yap
        patterns = list(base["evidence_patterns"])

        rec = {
            "id": f"{base['id']}.V{n:03d}",
            "kademe": kademe,
            "davranis": new_text,
            "deger": base["deger"],
            "alt_kategori": base.get("alt_kategori", ""),
            "gosterge": base.get("gosterge", ""),
            "egilim": base["egilim"],
            "beceri": base["beceri"],
            "guven_puani": max(60, base.get("guven_puani", 90) - rng.randint(0, 8)),
            "pozitif_negatif": pn,
            "evidence_patterns": patterns,
            "aciklama": base.get("aciklama", ""),
            "_kaynak_tohum": base["id"],
            "_mekan": mekan,
        }
        out.append(rec)

    return out[:target_count] if not include_seed_originals else out


def generate_to_file(
    path: str = "behavior_corpus.json",
    target_count: int = 1000,
    seed: int = 42,
) -> dict[str, Any]:
    """Korpusu üretip JSON dosyasına yazar; özet istatistik döndürür."""
    corpus = generate(target_count=target_count, seed=seed)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(corpus, f, ensure_ascii=False, indent=2)

    from collections import Counter
    deger_dag = Counter(r["deger"] for r in corpus)
    kademe_dag = Counter(r["kademe"] for r in corpus)
    pn_dag = Counter(r["pozitif_negatif"] for r in corpus)
    return {
        "toplam_kayit": len(corpus),
        "cikti_dosyasi": path,
        "deger_dagilimi": dict(deger_dag),
        "kademe_dagilimi": dict(kademe_dag),
        "durum_dagilimi": dict(pn_dag),
        "benzersiz_id": len({r["id"] for r in corpus}),
    }


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    stats = generate_to_file(target_count=n)
    print(json.dumps(stats, ensure_ascii=False, indent=2))
