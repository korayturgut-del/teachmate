//! Dijital Öğretmen Asistanı — Tauri 2.x Giriş Noktası
//! Uygulama mantığı lib.rs'te (doa_lib). Bu dosya yalnızca onu çağırır.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { doa_lib::run() }
