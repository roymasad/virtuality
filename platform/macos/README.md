# Virtuality macOS Screensaver

This folder contains the native macOS host for `Virtuality.saver`. The host is intentionally small: it embeds a `WKWebView` inside a `ScreenSaverView` and loads the Vite-built screensaver page from the bundle resources.

## Local Debug Build

From the repository root:

```sh
npm run build
platform/macos/build.sh
```

By default the script applies an ad-hoc signature for local testing. To skip signing:

```sh
SIGN_IDENTITY=skip platform/macos/build.sh
```

The build script writes:

```text
build/macos/Virtuality.saver
```

The debug bundle is ad-hoc signed and universal where the local SDK supports both `arm64` and `x86_64`.

## Manual Install And Test

Do not install from this script automatically. To test manually, double-click `build/macos/Virtuality.saver` and accept the macOS install prompt.

Then test it:

1. Open macOS System Settings.
2. Go to Screen Saver.
3. Select Virtuality.
4. Use Options to choose the scene, render mode, and scene parameters. Changes save automatically; use the in-panel X to close Options.
5. Use Preview to run it full-screen.

If the preview or full-screen saver is black after replacing an older build, quit System Settings and restart the macOS screen saver helpers:

```sh
killall legacyScreenSaver "Screen Saver"
```

Then reopen System Settings and test again. Check the screensaver host log for the installed version, frame size, and canvas size:

```sh
cat "$HOME/Library/Logs/VirtualityScreensaver.log"
cat /tmp/VirtualityScreensaver.log
```

Terminal fallback install:

```sh
mkdir -p "$HOME/Library/Screen Savers"
cp -R build/macos/Virtuality.saver "$HOME/Library/Screen Savers/"
```

To uninstall the local test build:

```text
rm -rf "$HOME/Library/Screen Savers/Virtuality.saver"
```

## Install From Website Download

If the downloaded file is a `.zip`, double-click it first to extract `Virtuality.saver`.

Normal install:

1. Double-click `Virtuality.saver`.
2. Accept the macOS install prompt.
3. Open System Settings.
4. Go to Screen Saver.
5. Select Virtuality.
6. Use Options to configure it, then Preview to test it. Changes save automatically; use the in-panel X to close Options.

If you are replacing an older test build, quit System Settings first, then remove the old copy:

```sh
rm -rf "$HOME/Library/Screen Savers/Virtuality.saver"
```

Terminal fallback install:

```sh
mkdir -p "$HOME/Library/Screen Savers"
cp -R /path/to/Virtuality.saver "$HOME/Library/Screen Savers/"
```

## Release Signing

Release builds should be signed with a Developer ID Application certificate and notarized before public distribution. If the final download is a `.pkg`, sign the package with a Developer ID Installer certificate too.

```sh
SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" platform/macos/build.sh
```
