/// Dijital Öğretmen Asistanı — ADF Tarayıcı Sürücüsü
///
/// Phase 4: TWAIN/SANE/WIA protokolü ile ADF (Automatic Document Feeder) tarama.
/// Phase 5: Platform-specific driver bindings (Windows: WIA, macOS: ICA, Linux: SANE).

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;

/// Tarayıcı bilgisi
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScannerDevice {
    pub name: String,
    pub vendor: String,
    pub has_adf: bool,
    pub max_dpi: u32,
    pub is_default: bool,
}

/// Tarama seçenekleri
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanOptions {
    pub dpi: u32,
    pub color_mode: String,     // "color" | "grayscale" | "bw"
    pub paper_size: String,     // "A4" | "A3" | "Letter"
    pub duplex: bool,           // Çift taraflı
    pub auto_crop: bool,
    pub auto_deskew: bool,
    pub max_pages: u32,         // 0 = sınırsız
}

/// Tarama oturumu durumu
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanSession {
    pub session_id: String,
    pub pages_scanned: u32,
    pub total_pages: u32,
    pub status: String,  // "scanning" | "completed" | "cancelled" | "error"
    pub errors: Vec<String>,
}

// Cancellation flag
// v1.12 UYARI: static AtomicBool global — tek aktif tarama varsayımıyla doğru çalışır.
// Birden fazla eşzamanlı tarama oturumu gerekirse Phase 5'te session-ID bazlı
// HashMap<String, AtomicBool> yapısına geçilmeli.
static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

/// Sistemdeki tarayıcıları listele.
///
/// Phase 5: Platform-specific driver binding'leri ile gerçek implement.
#[tauri::command]
pub fn get_scanner_list() -> Result<Vec<ScannerDevice>, String> {
    // Phase 5: WIA (Windows), SANE (Linux), ICA (macOS) API çağrıları
    // Şimdilik: mock döndür
    let devices = vec![
        ScannerDevice {
            name: "Fujitsu fi-7160".into(),
            vendor: "Fujitsu".into(),
            has_adf: true,
            max_dpi: 600,
            is_default: true,
        },
        ScannerDevice {
            name: "Canon DR-C230".into(),
            vendor: "Canon".into(),
            has_adf: true,
            max_dpi: 600,
            is_default: false,
        },
    ];

    tracing::info!("{} tarayıcı bulundu", devices.len());
    Ok(devices)
}

/// ADF toplu tarama başlat.
///
/// Tüm sayfaları sırayla tarar, her sayfa için `PageScanned` event'i üretir.
/// İptal için `cancel_scan()` çağrılır.
#[tauri::command]
pub async fn scan_adf_pages(
    scanner_name: String,
    options: ScanOptions,
    output_dir: String,
    app_handle: tauri::AppHandle,
) -> Result<ScanSession, String> {
    CANCEL_FLAG.store(false, Ordering::SeqCst);

    let session_id = format!("scan_{}", chrono::Utc::now().timestamp());
    let mut session = ScanSession {
        session_id: session_id.clone(),
        pages_scanned: 0,
        total_pages: 0,
        status: "scanning".into(),
        errors: vec![],
    };

    tracing::info!(
        "ADF tarama başladı: {} (dpi: {}, duplex: {}, max: {})",
        scanner_name, options.dpi, options.duplex, options.max_pages
    );

    // Event: ScanSessionStarted
    app_handle.emit("scan:session-started", serde_json::json!({
        "session_id": session_id,
        "scanner": scanner_name,
        "options": options,
    })).ok();

    // Phase 5: Gerçek tarama döngüsü — platform driver API çağrıları
    // Şimdilik: simülasyon
    let max_pages = if options.max_pages == 0 { 50 } else { options.max_pages };

    for page_no in 1..=max_pages {
        // İptal kontrolü
        if CANCEL_FLAG.load(Ordering::SeqCst) {
            session.status = "cancelled".into();
            app_handle.emit("scan:cancelled", serde_json::json!({
                "session_id": session_id,
            })).ok();
            tracing::info!("ADF tarama iptal edildi: {} sayfa taranmıştı", page_no - 1);
            break;
        }

        // Sayfa tara (Phase 5: gerçek tarama)
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        let page_path = std::path::PathBuf::from(&output_dir)
            .join(format!("page_{:04}.jpg", page_no));

        // Event: PageScanned
        app_handle.emit("scan:page-scanned", serde_json::json!({
            "session_id": session_id,
            "page_no": page_no,
            "image_path": page_path.to_string_lossy(),
            "width": 2480,  // A4 @ 300dpi
            "height": 3508,
        })).ok();

        session.pages_scanned = page_no;
        tracing::debug!("Sayfa tarandı: {}/{}", page_no, max_pages);
    }

    if session.status != "cancelled" {
        session.status = "completed".into();
        session.total_pages = session.pages_scanned;
    }

    // Event: scan completed
    app_handle.emit("scan:completed", serde_json::json!({
        "session_id": session_id,
        "pages_scanned": session.pages_scanned,
        "status": session.status,
    })).ok();

    tracing::info!(
        "ADF tarama tamamlandı: {} sayfa ({})",
        session.pages_scanned, session.status
    );

    Ok(session)
}

/// Devam eden taramayı iptal et.
#[tauri::command]
pub fn cancel_scan() -> Result<String, String> {
    CANCEL_FLAG.store(true, Ordering::SeqCst);
    tracing::info!("ADF tarama iptal sinyali gönderildi");
    Ok("Tarama iptal ediliyor...".into())
}
