//! Dijital Öğretmen Asistanı — Tauri 2.x Uygulama Kütüphanesi
//! v1.12: Tauri 2.x deseni — main.rs ince, lib.rs uygulama mantığı.

pub mod commands;

use commands::{crypto, pdf, qr, scanner};
use sha2::Digest;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_dir = directories::ProjectDirs::from("ai", "doa", "DijitalOgretmenAsistani")
        .map(|d| d.data_local_dir().join("logs"))
        .unwrap_or_else(|| std::path::PathBuf::from("logs"));

    std::fs::create_dir_all(&log_dir).ok();
    let file_appender = RollingFileAppender::new(Rotation::DAILY, log_dir, "doa.log");
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_writer(std::io::stdout))
        .with(fmt::layer().json().with_writer(file_appender))
        .init();

    tracing::info!("DÖA v{} başlatılıyor...", env!("CARGO_PKG_VERSION"));

    let db_key = crypto::init_cipher()
        .expect("SQLCipher başlatılamadı — uygulama devam edemez");
    tracing::info!("SQLCipher AES-256 aktif (hash: {})",
        sha2::Sha256::digest(db_key.0.as_bytes()).iter()
            .take(4).map(|b| format!("{:02x}", b))
            .collect::<Vec<_>>().join(""));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(db_key)
        .invoke_handler(tauri::generate_handler![
            scanner::scan_adf_pages, scanner::get_scanner_list, scanner::cancel_scan,
            pdf::split_pages, pdf::render_page_to_image, pdf::merge_pdfs, pdf::extract_metadata,
            qr::detect_qr, qr::generate_qr, qr::detect_datamatrix,
            crypto::verify_cipher, crypto::rotate_key,
        ])
        .run(tauri::generate_context!())
        .expect("DÖA başlatılamadı");
}
