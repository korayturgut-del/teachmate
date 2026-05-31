#!/bin/bash
# Dijital Öğretmen Asistanı — Credential Tarama Scripti
# Kodda hardcoded kalmış credential'ları tespit eder.
# Phase 1 öncesinde ve her release'de çalıştırılmalıdır.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 DÖA Credential Taraması başlıyor..."
echo "========================================="

FOUND=0
TARGET_DIRS="apps/ packages/ native/"

# Aranacak hardcoded pattern'ler
PATTERNS=(
  "maarif:maarif"
  "googleapis\.com"
  "AUTH_CLIENT_ID"
  "githubToken"
  "gistId"
  "ghp_"
  "postgresql://.*:.*@"
  "redis://.*:.*@"
  "SECRET_KEY.*=.*\"[^\"]{10,}\""
  "PASSWORD.*=.*\"[^\"]{1,}\""
  "GEMINI_API_KEY.*=.*\"[^\"]{3,}\""
  "DEEPSEEK_API_KEY.*=.*\"[^\"]{3,}\""
)

for pattern in "${PATTERNS[@]}"; do
  for dir in $TARGET_DIRS; do
    if [ -d "$dir" ]; then
      matches=$(grep -rn "$pattern" "$dir" \
        --include="*.py" --include="*.ts" --include="*.tsx" \
        --include="*.js" --include="*.json" --include="*.html" \
        2>/dev/null || true)
      if [ -n "$matches" ]; then
        echo -e "${RED}⚠ HARDCODED CREDENTIAL BULUNDU:${NC}"
        echo "$matches"
        echo ""
        FOUND=$((FOUND + 1))
      fi
    fi
  done
done

if [ $FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ Temiz! Hiç hardcoded credential tespit edilmedi.${NC}"
else
  echo -e "${RED}❌ $FOUND hardcoded credential bulundu. Düzeltmeden devam etme!${NC}"
  exit 1
fi

# Ayrıca .env dosyasının varlığını kontrol et
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠ .env dosyası bulunamadı. .env.example'dan kopyalayın.${NC}"
else
  echo -e "${GREEN}✅ .env dosyası mevcut.${NC}"
fi
