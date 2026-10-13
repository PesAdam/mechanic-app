#!/usr/bin/env bash
# Builds the web app and places it into api/public, so one Laravel deployment
# serves both the PWA (/, /m, /admin…) and the API (/api/v1, /storage).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"
npm ci --no-audit --no-fund
npm run build
# Hashed assets are replaced wholesale; everything else is copied next to index.php.
mkdir -p "$ROOT/api/public/assets"
find "$ROOT/api/public/assets" -mindepth 1 -delete
cp -R dist/. "$ROOT/api/public/"
echo "SPA copied to api/public ($(ls dist/assets | wc -l | tr -d ' ') asset files)"
