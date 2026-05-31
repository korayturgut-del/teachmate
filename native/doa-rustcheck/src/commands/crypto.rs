//! crypto.rs mantık doğrulama — rusqlite/Tauri stub ile
//! Gerçek implementasyon: apps/desktop/src-tauri/src/commands/crypto.rs

use rand::Rng;
use sha2::{Sha256, Digest};

/// Anahtar tipi (Tauri State<CipherKey> yerine doğrudan)
pub struct CipherKey(pub String);

/// Yeni 256-bit SQLCipher anahtarı üret
pub fn generate_key() -> CipherKey {
    let mut rng = rand::thread_rng();
    let raw: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    CipherKey(hex::encode(&raw))
}

/// Anahtar hash'i (log için — ilk 4 byte)
pub fn key_hash_prefix(key: &CipherKey) -> String {
    hex::encode(&Sha256::digest(key.0.as_bytes())[..4])
}

/// Anahtar rotasyonu — yeni anahtar üret
pub fn rotate_key() -> CipherKey {
    generate_key()
}

/// SQLCipher PRAGMA dizisi oluştur (bağlantı açılışında uygulanır)
pub fn cipher_pragma(key: &CipherKey) -> String {
    format!(
        "PRAGMA key = 'x\\'\\'{}\\'\\'';\
         PRAGMA cipher_page_size = 4096;\
         PRAGMA kdf_iter = 256000;\
         PRAGMA cipher_hmac_algorithm = HMAC_SHA512;\
         PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;",
        key.0.replace("'", "''")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_is_64_hex_chars() {
        let k = generate_key();
        assert_eq!(k.0.len(), 64, "256-bit = 32 byte = 64 hex karakter");
        assert!(k.0.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn key_hash_prefix_is_8_chars() {
        let k = generate_key();
        let h = key_hash_prefix(&k);
        assert_eq!(h.len(), 8); // 4 byte = 8 hex
    }

    #[test]
    fn rotate_gives_different_key() {
        let k1 = generate_key();
        let k2 = rotate_key();
        // Rastgele üretim — aynı olma ihtimali astronomik ölçüde düşük
        assert_ne!(k1.0, k2.0);
    }

    #[test]
    fn cipher_pragma_contains_key() {
        let k = CipherKey("deadbeef".repeat(8));
        let p = cipher_pragma(&k);
        assert!(p.contains(&k.0));
        assert!(p.contains("kdf_iter = 256000"));
        assert!(p.contains("HMAC_SHA512"));
    }

    #[test]
    fn key_sql_injection_escaped() {
        // Anahtar içinde tek tırnak varsa PRAGMA'da kaçılmalı
        let k = CipherKey("abc'def".to_string());
        let p = cipher_pragma(&k);
        assert!(!p.contains("abc'def"), "Kaçılmamış tek tırnak PRAGMA'ya girmemeli");
        assert!(p.contains("abc''def"), "Tek tırnak '' ile kaçılmalı");
    }
}
