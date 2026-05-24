# Screen Saver Packaging Notes

This document tracks the desktop screen saver work for Virtuality. The current implementation targets macOS. Windows remains planned, but is not implemented yet.

## Shared Web Runtime

The screen saver builds on the same TypeScript/canvas code used by the browser catalog:

- `src/scenes/registry.ts`: scene metadata and factory functions.
- `src/scenes/settings.ts`: shared setting definitions and defaults.
- `src/ui/CanvasStage.tsx`: canvas renderer used by both the catalog and screen saver UI.
- `src/screensaver/`: dedicated runtime, settings UI, and configuration helpers.
- `src/engine/`: shared drawing API, palette helpers, and render types.

The native hosts load a compact screen saver entrypoint instead of the full catalog UI. Configuration is stored as JSON with this shape:

```json
{
  "sceneId": "omega",
  "mode": "modern",
  "settings": {
    "speed": 1,
    "density": 1,
    "trail": 0.35,
    "modernLineWidth": 4,
    "antialias": true
  }
}
```

## macOS

The macOS host lives in `platform/macos/`. It creates a `Virtuality.saver` bundle using `ScreenSaver.framework`, embeds a `WKWebView`, and loads the built Vite screen saver page from the bundle resources.

Main pieces:

- `screensaver.html`: full-screen screen saver entrypoint.
- `settings.html`: configure sheet entrypoint.
- `platform/macos/Sources/VirtualityView.m`: native `ScreenSaverView` host.
- `platform/macos/build.sh`: local bundle build script.

Local debug build:

```sh
npm run build
platform/macos/build.sh
```

Output:

```text
build/macos/Virtuality.saver
```

The local build uses ad-hoc signing unless `SIGN_IDENTITY` is provided.

Release builds should be signed with a Developer ID Application certificate, notarized, and stapled before public distribution:

```sh
SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" platform/macos/build.sh
```

The current website download is a zip file containing the `.saver` bundle:

```text
public/downloads/Virtuality-macOS-screensaver.zip
```

Vite copies that file to `dist/downloads/` during `npm run build`, and Netlify serves it from:

```text
/downloads/Virtuality-macOS-screensaver.zip
```

## macOS Install Notes

Normal install from the website:

1. Download and unzip `Virtuality-macOS-screensaver.zip`.
2. Double-click `Virtuality.saver`.
3. Accept the macOS install prompt.
4. Open System Settings -> Screen Saver.
5. Select Virtuality.
6. Use Options to configure it and Preview to test it.

On some macOS versions, the Screen Saver pane opened automatically by the installer can show the Options button before the screen saver extension is ready to open its configure sheet. Closing System Settings and reopening Screen Saver fixes that state.

For local development, if macOS keeps an old helper process or stale bundle loaded, quit System Settings and restart the helper:

```sh
killall legacyScreenSaver "Screen Saver"
```

## Windows Plan

The Windows build is not implemented yet. The intended deliverables are:

- A real `Virtuality.scr` screen saver.
- A small configuration UI.
- A GitHub Actions workflow that can build Windows artifacts from macOS-triggered releases.
- A signed installer if the project qualifies for open-source signing.

Expected Windows behavior:

- `/s`: run full-screen.
- `/c`: open configuration.
- `/p <hwnd>`: render the Screen Saver Settings preview.

Possible host choices include WebView2 with a small native or .NET wrapper. Preferences can be stored in app data JSON or the registry; that decision is still open.

## Signing Notes

macOS public distribution should use Developer ID signing and notarization.

Windows signing is intentionally deferred. Possible paths include:

- SignPath Foundation, if the project qualifies as open source and the release process meets their requirements.
- Microsoft Store/MSIX distribution, where applicable.
- Paid code-signing certificates, if the project later justifies the cost.

If SignPath is pursued, the repository should include a code signing policy and the release workflow should build artifacts from source in a reproducible CI process.
