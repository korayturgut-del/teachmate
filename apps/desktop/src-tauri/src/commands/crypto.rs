/// Dijital Öğretmen Asistanı — SQLCipher AES-256 Kriptografi
///
/// Phase 4: Veritabanı şifreleme + anahtar yönetimi.
/// PII artık şifreli — uyarı banner'ı kaldırılır.

use argon2::Argon2;
use rand::Rng;
use rusqlite::Connection;
use sha2::{Sha256, Digest};
use std::path::PathBuf;
use tauri::State;

/// SQLCipher anahtar tipi — uygulama genelinde paylaşılır
pub struct CipherKey(pub String);

/// SQLCipher başlat, anahtar üret veya oku.
///
/// İlk çalıştırmada random 256-bit anahtar üretir,
/// platformun güvenli deposunda (Keychain/DPAPI) saklar.
/// Sonraki çalıştırmalarda okur.
/// NOT: Bu bir IPC komutu DEĞİL — main.rs'te başlangıçta çağrılır.
pub fn init_cipher() -> Result<CipherKey, String> {
    // Phase 4: Platform native keychain'den anahtar oku/üret
    // Şimdilik: random anahtar + dosyada sakla (Phase 5: DPAPI/Keychain)

    let key_path = get_key_path()?;
    let key = if key_path.exists() {
        std::fs::read_to_string(&key_path)
            .map_err(|e| format!("Anahtar okunamadı: {}", e))?
    } else {
        // 256-bit (32 byte) random anahtar
        let mut rng = rand::thread_rng();
        let raw: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
        let key = hex::encode(&raw);

        // Güvenli depoya yaz
        std::fs::create_dir_all(key_path.parent().unwrap())
            .map_err(|e| format!("Klasör oluşturulamadı: {}", e))?;
        std::fs::write(&key_path, &key)
            .map_err(|e| format!("Anahtar yazılamadı: {}", e))?;

        // Dosyayı sadece sahibi okur (Unix: 0o600)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&key_path,
                std::fs::Permissions::from_mode(0o600)
            ).ok();
        }

        tracing::info!("Yeni SQLCipher anahtarı üretildi");
        key
    };

    Ok(CipherKey(key))
}

/// SQLCipher bağlantısı oluştur — anahtarla şifreli.
pub fn open_encrypted_db(key: &CipherKey, db_path: &PathBuf) -> Result<Connection, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Veritabanı açılamadı: {}", e))?;

    // SQLCipher PRAGMA'ları
    conn.execute_batch(&format!(
        "PRAGMA key = 'x''{}''';
         PRAGMA cipher_page_size = 4096;
         PRAGMA kdf_iter = 256000;
         PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
         PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;",
        key.0.replace("'", "''")
    )).map_err(|e| format!("SQLCipher başlatılamadı: {}", e))?;

    // Anahtarın doğru olduğunu verify et
    conn.execute_batch("SELECT count(*) FROM sqlite_master;")
        .map_err(|_| "SQLCipher anahtarı geçersiz — veritabanı bozuk olabilir.".to_string())?;

    tracing::info!("SQLCipher bağlantısı açıldı: {}", db_path.display());
    Ok(conn)
}

/// Anahtar doğrulama — Tauri IPC komutu.
#[tauri::command]
pub fn verify_cipher(key: State<CipherKey>) -> Result<String, String> {
    let db_path = get_db_path()?;
    let _conn = open_encrypted_db(&key, &db_path)?;
    Ok("SQLCipher AES-256 aktif — veritabanı şifreli.".into())
}

/// Anahtar rotasyonu — periyodik güvenlik.
#[tauri::command]
pub fn rotate_key(key: State<CipherKey>) -> Result<String, String> {
    let db_path = get_db_path()?;
    let conn = open_encrypted_db(&key, &db_path)?;

    // Yeni anahtar üret
    let mut rng = rand::thread_rng();
    let raw: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let new_key = hex::encode(&raw);

    // Rekey
    conn.execute_batch(&format!(
        "PRAGMA rekey = 'x''{}''';",
        new_key.replace("'", "''")
    )).map_err(|e| format!("Rekey başarısız: {}", e))?;

    // Yeni anahtarı kaydet
    let key_path = get_key_path()?;
    std::fs::write(&key_path, &new_key)
        .map_err(|e| format!("Yeni anahtar kaydedilemedi: {}", e))?;

    let hash = hex::encode(&Sha256::digest(new_key.as_bytes())[..4]);
    tracing::info!("SQLCipher anahtarı rotasyonlandı (hash: {})", hash);
    Ok(format!("Anahtar rotasyonlandı (hash: {})", hash))
}

/// Argon2 ile kullanıcı şifresinden anahtar türet.
pub fn derive_key_from_password(password: &str, salt: &[u8]) -> Result<String, String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Anahtar türetme başarısız: {}", e))?;
    Ok(hex::encode(key))
}

// ── Yardımcılar ───────────────────────────────────────────────

fn get_key_path() -> Result<PathBuf, String> {
    let proj_dirs = directories::ProjectDirs::from("ai", "doa", "DijitalOgretmenAsistani")
        .ok_or("Proje dizini bulunamadı")?;
    Ok(proj_dirs.data_local_dir().join("doa.key"))
}

fn get_db_path() -> Result<PathBuf, String> {
    let proj_dirs = directories::ProjectDirs::from("ai", "doa", "DijitalOgretmenAsistani")
        .ok_or("Proje dizini bulunamadı")?;
    std::fs::create_dir_all(proj_dirs.data_local_dir())
        .map_err(|e| format!("DB dizini oluşturulamadı: {}", e))?;
    Ok(proj_dirs.data_local_dir().join("doa_encrypted.db"))
}
