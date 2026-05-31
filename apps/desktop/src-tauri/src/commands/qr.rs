/// Dijital Öğretmen Asistanı — QR / DataMatrix Tespit (Native Rust)
///
/// Phase 4: rxing (Zebra-crossing Rust port) ile QR ve DataMatrix okuma.
/// ADR-015: QR artık exam_id + template_version taşır.
///
/// K5 düzeltme: rxing 0.6.0 API'sine uygun hale getirildi.
/// - BufferedImageLuminanceSource::new() doğrudan DynamicImage alır (ImageBuffer yok).
/// - DecodeHints yok → DecodingHintDictionary (HashMap<DecodeHintType, DecodeHintValue>).
/// - QR encode için MultiFormatWriter + Writer::encode() kullanılır.

use std::collections::HashMap;
use std::path::PathBuf;

use rxing::{
    BarcodeFormat, DecodeHintType, DecodeHintValue, DecodingHintDictionary,
    MultiFormatReader, MultiFormatWriter,
    BufferedImageLuminanceSource, BinaryBitmap,
    common::{BitMatrix, HybridBinarizer},
    Reader, Writer,
};

/// Görüntüden QR kod tespit et.
///
/// Döndürdüğü payload: exam_id ve template_version içerir (ADR-015).
#[tauri::command]
pub fn detect_qr(image_path: String) -> Result<serde_json::Value, String> {
    let img = image::open(&image_path)
        .map_err(|e| format!("Görüntü açılamadı: {}", e))?;

    // rxing 0.6: BufferedImageLuminanceSource doğrudan DynamicImage alır
    let source = BufferedImageLuminanceSource::new(img);
    let mut bitmap = BinaryBitmap::new(HybridBinarizer::new(source));

    // rxing 0.6: MultiFormatReader::decode() — hint'siz varsayılan decode
    let mut reader = MultiFormatReader::default();
    let result = reader
        .decode(&mut bitmap)
        .map_err(|e| format!("QR tespit edilemedi: {:?}", e))?;

    let text = result.getText().to_string();
    let format = format!("{:?}", result.getBarcodeFormat());

    // ADR-015: QR payload'ından exam_id + version ayrıştır
    let (exam_id, version) = parse_qr_payload(&text);

    tracing::info!("QR tespit edildi: {} (format: {})", text, format);

    Ok(serde_json::json!({
        "text": text,
        "format": format,
        "exam_id": exam_id,
        "template_version": version,
        "raw_payload": text,
        "from_file": image_path,
    }))
}

/// QR kod oluştur — sınav şablonu için.
///
/// Adı-soyadı, numara, sınıf ve exam_id+version kodlar.
#[tauri::command]
pub fn generate_qr(
    payload: String,
    output_path: String,
    size: u32,
) -> Result<String, String> {
    // rxing 0.6: MultiFormatWriter + Writer::encode() → BitMatrix
    let writer = MultiFormatWriter::default();
    let matrix: BitMatrix = writer
        .encode(
            &payload,
            &BarcodeFormat::QR_CODE,
            size as i32,
            size as i32,
        )
        .map_err(|e| format!("QR encode hatası: {:?}", e))?;

    // BitMatrix'i görüntü olarak render et
    let cell_size = size / matrix.getWidth();
    let img_size = matrix.getWidth() * cell_size;

    let mut img = image::DynamicImage::new_luma8(img_size, img_size);

    for y in 0..matrix.getHeight() {
        for x in 0..matrix.getWidth() {
            let val = if matrix.get(x, y) { 0u8 } else { 255u8 };
            for dy in 0..cell_size {
                for dx in 0..cell_size {
                    img.as_mut_luma8()
                        .unwrap()
                        .put_pixel(
                            (x * cell_size + dx) as u32,
                            (y * cell_size + dy) as u32,
                            image::Luma([val]),
                        );
                }
            }
        }
    }

    img.save(&output_path)
        .map_err(|e| format!("QR kaydedilemedi: {}", e))?;

    tracing::info!("QR oluşturuldu: {} → {}", payload, output_path);
    Ok(output_path)
}

/// DataMatrix tespit et (endüstriyel sınav formları için).
#[tauri::command]
pub fn detect_datamatrix(image_path: String) -> Result<serde_json::Value, String> {
    let img = image::open(&image_path)
        .map_err(|e| format!("Görüntü açılamadı: {}", e))?;

    // rxing 0.6: BufferedImageLuminanceSource doğrudan DynamicImage alır
    let source = BufferedImageLuminanceSource::new(img);
    let mut bitmap = BinaryBitmap::new(HybridBinarizer::new(source));

    // rxing 0.6: hints → DecodingHintDictionary (HashMap)
    let mut hints: DecodingHintDictionary = HashMap::new();
    hints.insert(DecodeHintType::TRY_HARDER, DecodeHintValue::TryHarder(true));

    let mut reader = MultiFormatReader::default();
    let result = reader
        .decode_with_hints(&mut bitmap, &hints)
        .map_err(|e| format!("DataMatrix tespit edilemedi: {:?}", e))?;

    Ok(serde_json::json!({
        "text": result.getText().to_string(),
        "format": format!("{:?}", result.getBarcodeFormat()),
    }))
}

/// QR payload'ından exam_id ve template_version ayrıştır.
///
/// Beklenen format: "e0001-v2" veya "exam=e0001&version=2"
fn parse_qr_payload(payload: &str) -> (Option<String>, Option<u32>) {
    // Format: "eXXXX-vY"
    if let Some((exam, ver)) = payload.split_once("-v") {
        return (Some(exam.to_string()), ver.parse::<u32>().ok());
    }

    // Format: "exam=XXXX&version=Y"
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

    // Fallback: tüm payload exam_id, version=1
    if exam_id.is_none() && !payload.is_empty() {
        exam_id = Some(payload.to_string());
        version = Some(1);
    }

    (exam_id, version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_qr_payload() {
        assert_eq!(parse_qr_payload("e0001-v2"), (Some("e0001".into()), Some(2)));
        assert_eq!(parse_qr_payload("exam=e0001&version=3"), (Some("e0001".into()), Some(3)));
        assert_eq!(parse_qr_payload("e0001"), (Some("e0001".into()), Some(1)));
    }
}
