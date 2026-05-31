#!/bin/bash
# Dijital Öğretmen Asistanı — EXE/Paket Derleme
# Phase 4: Tauri 2.x native build
#
# Gereksinimler:
#   - Rust 1.77+ (https://rustup.rs)
#   - Node.js 20+ (https://nodejs.org)
#   - Platform build tools (Windows: MSVC, macOS: Xcode, Linux: GTK)

set -euo pipefail

echo "🔨 DÖA Build başlıyor..."
echo "========================================"

# 0. Credential kontrolü
echo "[0/4] Credential taraması..."
bash tools/check-credentials.sh

# 1. Frontend build
echo "[1/4] Frontend derleniyor..."
cd apps/desktop
npm ci
npm run build

# 2. Tauri build
echo "[2/4] Tauri 2.x native build..."
cd src-tauri
cargo build --release

# 3. Paketleme
echo "[3/4] Platform paketi oluşturuluyor..."
cd ../..
npx tauri build

# 4. Çıktı
echo "[4/4] Tamamlandı!"
echo ""
echo "Çıktılar:"
echo "  Windows: src-tauri/target/release/bundle/msi/dijital-ogretmen-asistani_1.0.0_x64_en-US.msi"
echo "  macOS:   src-tauri/target/release/bundle/dmg/dijital-ogretmen-asistani_1.0.0_x64.dmg"
echo "  Linux:   src-tauri/target/release/bundle/appimage/dijital-ogretmen-asistani_1.0.0_amd64.AppImage"
