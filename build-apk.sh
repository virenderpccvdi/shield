#!/bin/bash
set -e
cd /var/www/ai/FamilyShield/shield-app

echo "=== Building Shield APK (release, arm64) ==="
flutter build apk --release --target-platform android-arm64 --no-tree-shake-icons

echo "=== Building AAB (App Bundle) ==="
flutter build appbundle --release --no-tree-shake-icons

echo "=== Copying artifacts ==="
cp build/app/outputs/flutter-apk/app-release.apk /var/www/ai/FamilyShield/static/shield-app.apk
echo "APK size: $(du -sh /var/www/ai/FamilyShield/static/shield-app.apk)"
echo "AAB size: $(du -sh build/app/outputs/bundle/release/app-release.aab)"
echo "Done!"
