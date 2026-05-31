#!/bin/bash
# Dijital Öğretmen Asistanı — Cloud Brain Deploy
# Phase 4: FastAPI Docker deployment

set -euo pipefail

echo "☁️ DÖA Cloud Brain deploy başlıyor..."
echo "========================================"

cd apps/cloud-brain

# Build Docker image
echo "[1/3] Docker imajı oluşturuluyor..."
docker build -t doa-cloud-brain:latest .

# Deploy (fly.io veya railway)
echo "[2/3] Deploy ediliyor..."
if command -v flyctl &> /dev/null; then
    flyctl deploy --app doa-cloud-brain
elif command -v railway &> /dev/null; then
    railway up --service cloud-brain
else
    echo "⚠ flyctl veya railway bulunamadı. Manuel deploy gerekli."
    echo "  Docker image: doa-cloud-brain:latest"
fi

# Health check
echo "[3/3] Sağlık kontrolü..."
sleep 5
curl -s https://doa-cloud-brain.fly.dev/api/health || echo "⚠ Health check başarısız"
