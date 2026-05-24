#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/build/macos"
BUNDLE="$BUILD_DIR/Virtuality.saver"
SDK_PATH="$(xcrun --sdk macosx --show-sdk-path)"
SIGN_IDENTITY="${SIGN_IDENTITY:--}"

if [ ! -f "$ROOT_DIR/dist/screensaver.html" ]; then
  echo "Missing dist/screensaver.html. Run npm run build first." >&2
  exit 1
fi

rm -rf "$BUNDLE"
mkdir -p "$BUNDLE/Contents/MacOS"
mkdir -p "$BUNDLE/Contents/Resources/web"

cp "$ROOT_DIR/platform/macos/Resources/Info.plist" "$BUNDLE/Contents/Info.plist"
cp -R "$ROOT_DIR/dist/"* "$BUNDLE/Contents/Resources/web/"
rm -rf "$BUNDLE/Contents/Resources/web/downloads"

xcrun clang \
  -fobjc-arc \
  -bundle \
  -arch arm64 \
  -arch x86_64 \
  -isysroot "$SDK_PATH" \
  -mmacosx-version-min=13.0 \
  -framework Cocoa \
  -framework ApplicationServices \
  -framework ScreenSaver \
  -framework WebKit \
  "$ROOT_DIR/platform/macos/Sources/VirtualityView.m" \
  -o "$BUNDLE/Contents/MacOS/Virtuality"

if [ "$SIGN_IDENTITY" != "skip" ]; then
  codesign --force --deep --sign "$SIGN_IDENTITY" "$BUNDLE"
fi

echo "$BUNDLE"
