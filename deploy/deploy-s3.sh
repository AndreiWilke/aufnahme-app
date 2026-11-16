#!/usr/bin/env bash
# Veröffentlicht die gebaute App in einem S3-Bucket hinter CloudFront.
# Aufruf:  BUCKET=mein-bucket DISTRIBUTION=E123ABC ./deploy/deploy-s3.sh
# Voraussetzung: AWS CLI v2 installiert und angemeldet (aws configure / aws sso login).
set -euo pipefail

: "${BUCKET:?BUCKET setzen, z. B. BUCKET=aufnahme-green-aktiv}"
: "${DISTRIBUTION:?DISTRIBUTION setzen (CloudFront-Distribution-ID)}"
PREFIX="${PREFIX:-}"   # optional Unterordner im Bucket, z. B. PREFIX=aufnahme/

cd "$(dirname "$0")/.."
npm ci
npm test
npm run build

# 1. Dateien mit Hash im Namen: lange cachen
aws s3 sync dist/assets "s3://$BUCKET/${PREFIX}assets" --delete \
  --cache-control "public, max-age=31536000, immutable"

# 2. Alles andere (index.html, sw.js, manifest, Icons): nie cachen, damit Updates sofort ankommen
aws s3 sync dist "s3://$BUCKET/${PREFIX}" --delete --exclude "assets/*" \
  --cache-control "no-cache, no-store, must-revalidate"

# Richtige Inhaltstypen sicherstellen
aws s3 cp "dist/manifest.webmanifest" "s3://$BUCKET/${PREFIX}manifest.webmanifest" \
  --content-type "application/manifest+json" --cache-control "no-cache"
aws s3 cp "dist/sw.js" "s3://$BUCKET/${PREFIX}sw.js" \
  --content-type "text/javascript; charset=utf-8" --cache-control "no-cache, no-store, must-revalidate"

# 3. CloudFront-Cache für die ungehashten Dateien leeren
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" \
  --paths "/${PREFIX}index.html" "/${PREFIX}sw.js" "/${PREFIX}manifest.webmanifest" "/${PREFIX}" >/dev/null

echo "Fertig. Auf dem iPad die App einmal online öffnen, damit der Service Worker die neue Version lädt."
