#!/bin/bash
# Build and deploy the Shield dashboard
# Usage: ./deploy.sh
set -e
cd "$(dirname "$0")"

echo "[1/3] Building..."
npm run build

echo "[2/3] Deploying to nginx..."
DEST="/var/www/ai/FamilyShield/shield-website/app"
rm -rf "$DEST/assets"
cp -r dist/. "$DEST/"

echo "[3/3] Done — https://shield.rstglobal.in/app/"
