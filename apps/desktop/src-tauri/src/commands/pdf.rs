/// Dijital Öğretmen Asistanı — PDF İşlemleri (Native Rust)
///
/// Phase 4 + v1.12: pdf-utils.ts → Rust port.
/// Kaynak C: extractPdfPages, isPdf. Kaynak A: Z-Kitap PDF crop.
///
/// v1.12 DÜZELTME: lopdf 0.32 API hataları giderildi.
///   YANLIŞ: get_page_content() → Vec<u8>, ama objects.insert() Object bekler
///   DOĞRU:  clone() + delete_pages() ile sayfa ayrıştırma
///           objects.extend() ile birleştirme (Object→Object)

use lopdf::Document;
use std::path::PathBuf;

/// PDF'i sayfalara böl — her sayfayı ayrı tek-sayfalık PDF olarak kaydet.
///
/// lopdf 0.32 DOĞRU desen: tüm belgeyi klonla, hedef dışındakileri sil.
/// Bu yöntem Page dict + Resources + MediaBox'u doğru korur.
#[tauri::command]
pub fn split_pages(pdf_path: String, output_dir: String) -> Result<Vec<String>, String> {
    let doc = Document::load(&pdf_path)
        .map_err(|e| format!("PDF yüklenemedi: {}", e))?;

    let mut page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
    page_numbers.sort_unstable();

    let page_count = page_numbers.len();
    let mut saved_files = Vec::with_capacity(page_count);

    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Çıktı klasörü oluşturulamadı: {}", e))?;

    for &target in &page_numbers {
        let mut single = doc.clone();

        // Hedef DIŞINDAKİ sayfaları sil
        let to_delete: Vec<u32> = page_numbers
            .iter()
            .copied()
            .filter(|&p| p != target)
            .collect();
        single.delete_pages(&to_delete);
        single.prune_objects();
        single.renumber_objects();

        let output_path = PathBuf::from(&output_dir)
            .join(format!("page_{:03}.pdf", target));

        single.save(&output_path)
            .map_err(|e| format!("Sayfa {} kaydedilemedi: {}", target, e))?;

        saved_files.push(output_path.to_string_lossy().to_string());
        tracing::debug!("PDF sayfa {} kaydedildi", target);
    }

    tracing::info!("PDF bölündü: {} sayfa → {}", page_count, output_dir);
    Ok(saved_files)
}

/// PDF sayfasının boyut/geometri bilgisini döndürür.
///
/// NOT: Raster render (sayfa → JPEG piksel) lopdf ile mümkün değil —
/// lopdf ayrıştırıcıdır, rasterizer değil. Gerçek render Phase 5'te
/// pdfium veya poppler binding ile; şimdilik geometri döndürülür.
#[tauri::command]
pub fn render_page_to_image(
    pdf_path: String,
    page_number: u32,
    output_path: String,
    scale: f32,
) -> Result<serde_json::Value, String> {
    let doc = Document::load(&pdf_path)
        .map_err(|e| format!("PDF yüklenemedi: {}", e))?;

    let pages = doc.get_pages();
    if page_number == 0 || page_number > pages.len() as u32 {
        return Err(format!("Geçersiz sayfa numarası: {}", page_number));
    }

    let page_id = pages
        .get(&page_number)
        .ok_or_else(|| format!("Sayfa {} bulunamadı", page_number))?;

    let media_box = doc
        .get_page_media_box(*page_id)
        .unwrap_or([0.0, 0.0, 595.0, 842.0]);

    let width = ((media_box[2] - media_box[0]) * scale) as u32;
    let height = ((media_box[3] - media_box[1]) * scale) as u32;

    tracing::info!(
        "PDF sayfa {} geometrisi: {}x{} @ {}x → {}",
        page_number, width, height, scale, output_path
    );

    Ok(serde_json::json!({
        "page_number": page_number,
        "width_px": width,
        "height_px": height,
        "scale": scale,
        "output_path": output_path,
        "rasterized": false,
        "note": "Raster Phase 5 (pdfium). UI tarafı pdf.js kullanır."
    }))
}

/// PDF metadata çıkar.
#[tauri::command]
pub fn extract_metadata(pdf_path: String) -> Result<serde_json::Value, String> {
    let doc = Document::load(&pdf_path)
        .map_err(|e| format!("PDF yüklenemedi: {}", e))?;

    let page_count = doc.get_pages().len();
    let file_size = std::fs::metadata(&pdf_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(serde_json::json!({
        "page_count": page_count,
        "file_size_bytes": file_size,
        "pdf_version": doc.version.clone(),
        "is_encrypted": doc.is_encrypted(),
        "path": pdf_path,
    }))
}

/// Birden çok PDF'i tek belgede birleştir.
///
/// lopdf 0.32 DOĞRU desen: ilk belge temel, sonrakiler renumber + extend.
#[tauri::command]
pub fn merge_pdfs(input_paths: Vec<String>, output_path: String) -> Result<String, String> {
    if input_paths.is_empty() {
        return Err("Birleştirilecek PDF listesi boş.".into());
    }

    let mut base = Document::load(&input_paths[0])
        .map_err(|e| format!("İlk PDF yüklenemedi ({}): {}", input_paths[0], e))?;

    for path in input_paths.iter().skip(1) {
        let mut next = Document::load(path)
            .map_err(|e| format!("PDF yüklenemedi ({}): {}", path, e))?;

        // ID çakışmasını önle
        let offset = base.max_id + 1;
        next.renumber_objects_with(offset);

        // Tüm nesneleri taşı (Object→Object — tip doğru)
        base.objects.extend(next.objects);
        base.max_id = next.max_id;

        tracing::debug!("PDF birleştirildi: {}", path);
    }

    base.save(&output_path)
        .map_err(|e| format!("Birleşik PDF kaydedilemedi: {}", e))?;

    tracing::info!("{} PDF birleştirildi → {}", input_paths.len(), output_path);
    Ok(output_path)
}
