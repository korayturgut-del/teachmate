"""DÖA Cloud Brain — Soru Segmentasyon Servisi (PATCH v1.9).

OCR çıktısındaki satırları (text + bbox) soru bölgelerine gruplar.
question-segmentation TS paketiyle AYNI algoritma (dikey boşluk analizi):
soru blokları arası boşluk, blok-içi satır boşluğundan büyüktür.

Şablon varsa (template-engine) onun bbox'ları tercih edilir — en güvenilir.
"""
from typing import Any


def _center_y(bbox: list) -> float:
    return (bbox[0] + bbox[2]) / 2


def _vertical_gap(a: list, b: list) -> float:
    return max(0.0, b[0] - a[2])


def segment_lines(
    lines: list[dict[str, Any]],
    gap_factor: float = 2.2,
) -> list[dict[str, Any]]:
    """OCR satırlarını soru bölgelerine grupla.

    Args:
        lines: [{text, confidence, bbox:[ymin,xmin,ymax,xmax]}]
        gap_factor: ortalama satır boşluğunun kaç katı → yeni soru

    Returns:
        [{question_no, text, confidence, line_count, bbox}]
    """
    # bbox'ı olan satırları al
    valid = [l for l in lines if l.get("bbox")]
    if not valid:
        # bbox yoksa: her satır ayrı soru olamaz → tüm metni tek bölge yap
        if lines:
            text = "\n".join(l.get("text", "") for l in lines)
            conf = sum(l.get("confidence", 0) for l in lines) / len(lines)
            return [{
                "question_no": 1, "text": text, "confidence": round(conf, 3),
                "line_count": len(lines), "bbox": None,
            }]
        return []

    # Dikey sıraya diz
    ordered = sorted(valid, key=lambda l: _center_y(l["bbox"]))

    # Ortalama satır-arası boşluk
    gaps = [
        _vertical_gap(ordered[i - 1]["bbox"], ordered[i]["bbox"])
        for i in range(1, len(ordered))
    ]
    avg_gap = sum(gaps) / len(gaps) if gaps else 0.0
    threshold = avg_gap * gap_factor

    # Eşiği aşan boşlukta yeni grup başlat
    groups: list[list[dict]] = [[ordered[0]]]
    for i in range(1, len(ordered)):
        gap = _vertical_gap(ordered[i - 1]["bbox"], ordered[i]["bbox"])
        if avg_gap > 0 and gap > threshold:
            groups.append([ordered[i]])
        else:
            groups[-1].append(ordered[i])

    # Her grubu bir soru bölgesine sar
    regions: list[dict[str, Any]] = []
    for idx, group in enumerate(groups):
        text = "\n".join(l.get("text", "") for l in group)
        conf = sum(l.get("confidence", 0) for l in group) / len(group)
        ymin = min(l["bbox"][0] for l in group)
        xmin = min(l["bbox"][1] for l in group)
        ymax = max(l["bbox"][2] for l in group)
        xmax = max(l["bbox"][3] for l in group)
        regions.append({
            "question_no": idx + 1,
            "text": text,
            "confidence": round(conf, 3),
            "line_count": len(group),
            "bbox": [ymin, xmin, ymax, xmax],
        })
    return regions


def segment_from_template(
    template_questions: list[dict[str, Any]],
    lines: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Şablon bbox'ları varsa: her OCR satırını içine düştüğü soru kutusuna ata.

    template_questions: [{question_no, bbox:[ymin,xmin,ymax,xmax], max_score}]
    """
    regions = []
    for q in template_questions:
        qb = q.get("bbox")
        if not qb:
            continue
        # Bu kutunun içine düşen satırları topla (merkez nokta testi)
        inside = [
            l for l in lines
            if l.get("bbox") and
            qb[0] <= _center_y(l["bbox"]) <= qb[2]
        ]
        text = "\n".join(l.get("text", "") for l in inside)
        conf = (sum(l.get("confidence", 0) for l in inside) / len(inside)
                if inside else 0.0)
        regions.append({
            "question_no": q["question_no"],
            "text": text,
            "confidence": round(conf, 3),
            "line_count": len(inside),
            "bbox": qb,
            "max_score": q.get("max_score"),
        })
    return regions
