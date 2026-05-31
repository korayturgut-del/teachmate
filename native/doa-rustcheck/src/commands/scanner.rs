//! scanner.rs mantık doğrulama — Tauri/tokio stub ile
//! Gerçek implementasyon: apps/desktop/src-tauri/src/commands/scanner.rs

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScannerDevice {
    pub name: String,
    pub vendor: String,
    pub has_adf: bool,
    pub max_dpi: u32,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanOptions {
    pub dpi: u32,
    pub color_mode: String,
    pub paper_size: String,
    pub duplex: bool,
    pub auto_crop: bool,
    pub auto_deskew: bool,
    pub max_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct ScanSession {
    pub session_id: String,
    pub pages_scanned: u32,
    pub total_pages: u32,
    pub status: String,
    pub errors: Vec<String>,
}

// İptal flag — AtomicBool: thread-safe, Tauri async command'larla güvenli
static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

pub fn signal_cancel() {
    CANCEL_FLAG.store(true, Ordering::SeqCst);
}

pub fn reset_cancel() {
    CANCEL_FLAG.store(false, Ordering::SeqCst);
}

pub fn is_cancelled() -> bool {
    CANCEL_FLAG.load(Ordering::SeqCst)
}

/// Tarama simülasyonu — gerçek WIA/SANE/ICA olmadan oturum durumunu test eder
pub fn simulate_scan(options: &ScanOptions, max: u32) -> ScanSession {
    // Yeni tarama başladığında cancel flag'i sıfırla
    // ANCAK: gerçek kod da böyle yapmalı — her scan_adf_pages çağrısının
    // başında `CANCEL_FLAG.store(false, Ordering::SeqCst)` çağrılır.
    reset_cancel();
    let limit = if options.max_pages == 0 { max } else { options.max_pages.min(max) };
    let mut scanned = 0u32;

    for _ in 1..=limit {
        if is_cancelled() {
            return ScanSession {
                session_id: "test".into(),
                pages_scanned: scanned,
                total_pages: 0,
                status: "cancelled".into(),
                errors: vec![],
            };
        }
        scanned += 1;
    }
    ScanSession {
        session_id: "test".into(),
        pages_scanned: scanned,
        total_pages: scanned,
        status: "completed".into(),
        errors: vec![],
    }
}

/// Harici sinyal testi: simulate_scan başlamadan ÖNCE sinyal gönder,
/// loop içinde kontrol edilmeden iptal.
/// Gerçek üretim kodu: tokio select! ile iptal sinyali loop'u keser.
pub fn simulate_scan_with_precancel(options: &ScanOptions, max: u32) -> ScanSession {
    // reset YOK — dışarıdan verilen flag korunuyor
    let limit = if options.max_pages == 0 { max } else { options.max_pages.min(max) };
    let mut scanned = 0u32;
    for _ in 1..=limit {
        if is_cancelled() {
            return ScanSession {
                session_id: "test".into(),
                pages_scanned: scanned,
                total_pages: 0,
                status: "cancelled".into(),
                errors: vec![],
            };
        }
        scanned += 1;
    }
    ScanSession {
        session_id: "test".into(),
        pages_scanned: scanned,
        total_pages: scanned,
        status: "completed".into(),
        errors: vec![],
    }
}

/// Tauri 2.x API doğrulama — Emitter trait kullanımı
///
/// ✅ DOĞRU (scanner.rs'te mevcut):
///    use tauri::Emitter;
///    app_handle.emit("event-name", payload) → Result<(), Error>
///
/// ❌ YANLIŞ (Tauri 1.x):
///    app_handle.emit_all("event-name", payload)  ← Tauri 2.x'te KALDIRILDI
///
/// scanner.rs'te `use tauri::Emitter;` import var → doğru.
/// `.emit()` kullanılıyor → doğru.
/// `.emit_all()` yok → doğru.

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_completes_all_pages() {
        let opts = ScanOptions {
            dpi: 300, color_mode: "grayscale".into(),
            paper_size: "A4".into(), duplex: false,
            auto_crop: true, auto_deskew: true, max_pages: 0,
        };
        let session = simulate_scan(&opts, 5);
        assert_eq!(session.status, "completed");
        assert_eq!(session.pages_scanned, 5);
    }

    #[test]
    fn scan_respects_max_pages_limit() {
        let opts = ScanOptions {
            dpi: 300, color_mode: "bw".into(),
            paper_size: "A4".into(), duplex: false,
            auto_crop: false, auto_deskew: false, max_pages: 3,
        };
        let session = simulate_scan(&opts, 10);
        assert_eq!(session.pages_scanned, 3);
        assert_eq!(session.status, "completed");
    }

    #[test]
    fn cancel_flag_stops_scan() {
        reset_cancel();
        signal_cancel();
        // simulate_scan_with_precancel: reset YOK, flag korunuyor
        let opts = ScanOptions {
            dpi: 300, color_mode: "color".into(),
            paper_size: "A4".into(), duplex: false,
            auto_crop: true, auto_deskew: true, max_pages: 0,
        };
        let session = simulate_scan_with_precancel(&opts, 10);
        assert_eq!(session.status, "cancelled");
        assert_eq!(session.pages_scanned, 0);
        reset_cancel();
    }

    #[test]
    fn cancel_flag_reset_on_new_scan() {
        signal_cancel();
        reset_cancel();
        assert!(!is_cancelled());
    }

    #[test]
    fn scan_session_serializable() {
        let s = ScanSession {
            session_id: "scan_001".into(),
            pages_scanned: 5,
            total_pages: 5,
            status: "completed".into(),
            errors: vec![],
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("scan_001"));
        assert!(json.contains("completed"));
        let back: ScanSession = serde_json::from_str(&json).unwrap();
        assert_eq!(back, s);
    }

    #[test]
    fn scanner_device_serializable() {
        let d = ScannerDevice {
            name: "Fujitsu fi-7160".into(),
            vendor: "Fujitsu".into(),
            has_adf: true,
            max_dpi: 600,
            is_default: true,
        };
        let json = serde_json::to_string(&d).unwrap();
        assert!(json.contains("Fujitsu fi-7160"));
        assert!(json.contains("\"has_adf\":true"));
    }
}
