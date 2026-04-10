#!/bin/bash
set -e
echo "Building Shield App release..."

# Ensure flutter is on path
export PATH="$PATH:/usr/local/flutter/bin:/opt/flutter/bin"

cd "$(dirname "$0")"

# google-services.json is gitignored — copy from known server path if missing
GSF="/var/www/ai/FamilyShield/shield-app/android/app/google-services.json"
if [ -f "$GSF" ] && [ ! -f "android/app/google-services.json" ]; then
  cp "$GSF" "android/app/google-services.json"
  echo "Copied google-services.json"
fi

# Clean
flutter clean

# Get dependencies
flutter pub get

# Build release APK
flutter build apk \
  --release \
  --tree-shake-icons \
  --obfuscate \
  --split-debug-info=build/debug-info

echo ""
echo "Build complete!"
echo "APK: build/app/outputs/flutter-apk/app-release.apk"
ls -lh build/app/outputs/flutter-apk/app-release.apk 2>/dev/null || echo "(build needed)"
