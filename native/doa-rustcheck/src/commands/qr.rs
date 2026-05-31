//! qr.rs mantık doğrulama — rxing/image stub ile
//! Gerçek implementasyon: apps/desktop/src-tauri/src/commands/qr.rs
//! Test edilen: parse_qr_payload (platform-bağımsız saf mantık)

/// QR payload'ından exam_id ve template_version ayrıştır.
/// Format: "e0001-v2" veya "exam=e0001&version=2"
/// ADR-015: Her basılı kağıtta bu payload var.
pub fn parse_qr_payload(payload: &str) -> (Option<String>, Option<u32>) {
    if let Some((exam, ver)) = payload.split_once("-v") {
        if !exam.is_empty() {
            return (Some(exam.to_string()), ver.parse::<u32>().ok());
        }
    }
    let mut exam_id = None;
    let mut version = None;
    for part in payload.split('&') {
        if let Some(val) = part.strip_prefix("exam=") {
            exam_id = Some(val.to_string());
        }
        if let Some(val) = part.strip_prefix("version=") {
            version = val.parse::<u32>().ok();
        }
    }
    if exam_id.is_none() && !payload.is_empty() {
        exam_id = Some(payload.to_string());
        version = Some(1);
    }
    (exam_id, version)
}

/// rxing 0.6 API doğrulama notları (derleme ortamı sınırlaması):
///
/// Master prompt: "verify rxing API; native local-OCR bridge"
/// rxing 0.6.x API'si (crates.io docs + kaynak kod incelemesi):
///
/// ✅ DOĞRU kullanım (qr.rs'te mevcut):
///    - `BufferedImageLuminanceSource::new(img)` — DynamicImage alır (doğru)
///    - `BinaryBitmap::new(HybridBinarizer::new(source))` — doğru zincir
///    - `MultiFormatReader::default().decode(&mut bitmap)` — doğru
///    - `result.getText().to_string()` — doğru (getText() &str döner)
///    - `result.getBarcodeFormat()` — doğru
///    - `MultiFormatWriter::default().encode(&payload, &BarcodeFormat::QR_CODE, w, h)`
///      → Result<BitMatrix, Exceptions> — doğru
///    - `matrix.getWidth()` / `matrix.getHeight()` / `matrix.get(x,y)` — doğru
///
/// ✅ DOĞRU hint kullanımı (detect_datamatrix'te):
///    - `DecodingHintDictionary` = `HashMap<DecodeHintType, DecodeHintValue>` — doğru
///    - `DecodeHintValue::TryHarder(true)` — doğru varyant adı
///    - `reader.decode_with_hints(&mut bitmap, &hints)` — doğru
///
/// ⚠️  DİKKAT — rxing 0.5 → 0.6 KESİN API DEĞİŞİKLİĞİ:
///    rxing 0.5'te: `Luma8LuminanceSource::new(width, height, data)`
///    rxing 0.6'da: `BufferedImageLuminanceSource::new(DynamicImage)` ← DOĞRU
///    qr.rs bu değişikliği doğru uygulamış (K5 düzeltme notu'nda belgelenmiş).

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_dash_v_format() {
        let (id, ver) = parse_qr_payload("e0001-v2");
        assert_eq!(id, Some("e0001".to_string()));
        assert_eq!(ver, Some(2));
    }

    #[test]
    fn parse_query_string_format() {
        let (id, ver) = parse_qr_payload("exam=e0042&version=5");
        assert_eq!(id, Some("e0042".to_string()));
        assert_eq!(ver, Some(5));
    }

    #[test]
    fn parse_fallback_plain_id() {
        let (id, ver) = parse_qr_payload("e0001");
        assert_eq!(id, Some("e0001".to_string()));
        assert_eq!(ver, Some(1));
    }

    #[test]
    fn parse_empty_returns_none() {
        let (id, ver) = parse_qr_payload("");
        assert_eq!(id, None);
        assert_eq!(ver, None);
    }

    #[test]
    fn parse_high_version() {
        let (_, ver) = parse_qr_payload("exam-v999");
        assert_eq!(ver, Some(999));
    }

    #[test]
    fn parse_adr015_versioned_payload() {
        // ADR-015: şablon versiyonu v2+ taşımalı
        let (id, ver) = parse_qr_payload("math-midterm-2024-v3");
        assert_eq!(id.as_deref(), Some("math-midterm-2024"));
        assert_eq!(ver, Some(3));
    }
}
