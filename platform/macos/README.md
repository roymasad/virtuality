# Virtuality macOS Screen Saver

This folder contains the native macOS host for `Virtuality.saver`.

The host is intentionally small. It embeds a `WKWebView` inside a `ScreenSaverView`, loads the Vite-built screen saver page from the bundle resources, and stores settings with `ScreenSaverDefaults`.

## Build

From the repository root:

```sh
npm run build
platform/macos/build.sh
```

The build script writes:

```text
build/macos/Virtuality.saver
```

By default, local builds are ad-hoc signed for testing. To skip signing:

```sh
SIGN_IDENTITY=skip platform/macos/build.sh
```

To sign with a Developer ID Application certificate:

```sh
SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" platform/macos/build.sh
```

Public release builds should also be notarized and stapled before distribution.

## Test Install

Double-click:

```text
build/macos/Virtuality.saver
```

Then accept the macOS install prompt.

To test:

1. Open System Settings -> Screen Saver.
2. Select Virtuality.
3. Use Options to choose a scene, render mode, and scene parameters.
4. Use Preview to run it full-screen.

Settings changes save automatically. Use the X inside the Options window to close it.

If Options does not open in the System Settings window that macOS opens immediately after install, close System Settings and open Screen Saver again. The installer-opened pane can briefly show the Options button before it is ready to call the screen saver configure sheet.

## Website Download

The website download is a zip containing `Virtuality.saver`:

```text
public/downloads/Virtuality-macOS-screensaver.zip
```

Install flow for users:

1. Download and unzip the file.
2. Double-click `Virtuality.saver`.
3. Accept the macOS install prompt.
4. Open System Settings -> Screen Saver.
5. Select Virtuality and use Options or Preview.

## Development Cleanup

During local testing, macOS may keep an older screen saver helper alive. Quit System Settings, then run:

```sh
killall legacyScreenSaver "Screen Saver"
```

To remove a local test install:

```sh
rm -rf "$HOME/Library/Screen Savers/Virtuality.saver"
```

Debug logs are written to `/tmp/VirtualityScreensaver.log`.
