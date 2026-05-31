# ADR-019 — Native Crate Yapısının Sadeleştirilmesi

## Durum
FREEZE CHANGE REQUEST onaylandı — Phase 4.5

## Bağlam
Phase 0'da `native/pdf-engine-rust/`, `native/qr-engine-rust/`, `native/scanner-engine-rust/`
üç ayrı Rust crate'i planlanmıştı. Phase 4 pratiği gösterdi ki Tauri 2.x'in
`src-tauri/src/commands/` yapısı yeterli — tüm native kod doğrudan `commands/`
altına yazıldı (pdf.rs, qr.rs, scanner.rs, crypto.rs). İki yapının birden
var olması kafa karışıklığı yaratıyor: hangisi "doğru kaynak"?

## Karar
**SEÇENEK 2 — `native/` klasörü kaldırılır.** Tauri commands tek doğru kaynak olur.

- `native/pdf-engine-rust/` → zaten `commands/pdf.rs`'te implement edildi
- `native/qr-engine-rust/` → zaten `commands/qr.rs`'te implement edildi
- `native/scanner-engine-rust/` → zaten `commands/scanner.rs`'te implement edildi
- `Cargo.toml`'daki `doa-pdf-engine` vb. path bağımlılıkları kaldırılır

## Sonuçlar
- ✅ Tek doğru kaynak — hangi dosyanın değiştirileceği belli
- ✅ Daha az crate = daha hızlı derleme
- ✅ Monorepo yapısı sadeleşir
- ❌ Monorepo klasörü kaldırılır → Architecture Freeze değişikliği (kabul edilebilir)

## Freeze Etkisi
⚠️ FREEZE CHANGE REQUEST. `native/` klasörü kaldırılır. Monorepo'da hiçbir şey
bu klasöre bağımlı değil — silinmesi sıfır etki yaratır.

## Tarih ve İmza
Governor Agent · Phase 4.5 · 2026-05-25
