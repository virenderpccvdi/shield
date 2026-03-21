#!/bin/bash
# ============================================================
# Shield APK Deploy Script
# Usage: ./deploy-apk.sh [release_notes...]
# Builds the APK, copies it to static/, and updates the website
# version badge + release notes automatically.
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
WEBSITE_INDEX="/var/www/ai/FamilyShield/shield-website/index.html"
STATIC_APK="/var/www/ai/FamilyShield/static/shield-app.apk"

# ── 1. Read current version from pubspec.yaml ────────────────
CURRENT_VERSION=$(grep '^version:' "$APP_DIR/pubspec.yaml" | sed 's/version: //' | cut -d'+' -f1)
CURRENT_BUILD=$(grep '^version:' "$APP_DIR/pubspec.yaml" | sed 's/version: //' | cut -d'+' -f2)

# ── 2. Bump patch version ────────────────────────────────────
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_BUILD=$((CURRENT_BUILD + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
FULL_VERSION="$NEW_VERSION+$NEW_BUILD"
RELEASE_DATE=$(date '+%d %b %Y')

echo "Bumping version: $CURRENT_VERSION → $NEW_VERSION (build $NEW_BUILD)"

# ── 3. Update pubspec.yaml ───────────────────────────────────
sed -i "s/^version: .*/version: $FULL_VERSION/" "$APP_DIR/pubspec.yaml"

# ── 4. Build APK ─────────────────────────────────────────────
echo "Building APK..."
cd "$APP_DIR"
flutter build apk --debug --no-tree-shake-icons

# ── 5. Copy APK to static/ ───────────────────────────────────
cp "$APP_DIR/build/app/outputs/flutter-apk/app-debug.apk" "$STATIC_APK"
APK_MB=$(du -sh "$STATIC_APK" | cut -f1)
echo "Deployed: $STATIC_APK ($APK_MB)"

# ── 6. Update website ────────────────────────────────────────
# Replace old version strings with new version
OLD_VERSION=$(echo "$CURRENT_VERSION" | sed 's/\./\\./g')
sed -i "s/$OLD_VERSION/$NEW_VERSION/g" "$WEBSITE_INDEX"
sed -i "s/v$OLD_VERSION/v$NEW_VERSION/g" "$WEBSITE_INDEX"

# Update file size in download note and release-meta
sed -i "s/[0-9]\+\([ ]*\)MB &nbsp;·&nbsp; Released [^<]*/$(echo $APK_MB) \&nbsp;\&middot;\&nbsp; Released $RELEASE_DATE/" "$WEBSITE_INDEX"
# Update btn-sub size line
sed -i "s/Android 8.0+ \&nbsp;·\&nbsp; [0-9]\+ MB/Android 8.0+ \&nbsp;\&middot;\&nbsp; $APK_MB/" "$WEBSITE_INDEX"
# Update release-meta size
sed -i "s/[0-9]\+ MB \&nbsp;(release build)/$APK_MB \&nbsp;(release build)/" "$WEBSITE_INDEX"

echo ""
echo "✓ Website updated: v$NEW_VERSION · $APK_MB · $RELEASE_DATE"
echo "✓ APK live at: https://shield.rstglobal.in/static/shield-app.apk"
