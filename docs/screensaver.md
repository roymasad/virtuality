# Virtuality Screensaver Module Plan

This document tracks the plan for turning the modern browser remaster into downloadable desktop screensavers. The first implementation target is macOS because we can sign and notarize it with an Apple Developer account. Windows remains a planned follow-up that should build remotely through GitHub Actions and, if accepted, sign releases through SignPath Foundation.

## Goals

- Reuse the existing TypeScript scene registry, settings metadata, and Canvas rendering loop.
- Keep the browser catalog intact while adding a dedicated screensaver runtime.
- Ship a macOS `.saver` bundle first.
- Preserve scene selection and per-scene settings in the native screensaver settings UI.
- Keep the Windows implementation documented so it can be added later without rethinking the architecture.

## Current Web Pieces To Reuse

- `src/scenes/registry.ts`: scene list, titles, source annotations, keyboard IDs, and factory functions.
- `src/scenes/settings.ts`: shared setting definitions and defaults.
- `src/ui/CanvasStage.tsx`: current canvas animation loop and input handling.
- `src/ui/SettingsPanel.tsx`: existing browser controls that can inform native screensaver settings.
- `src/engine/*`: palette, drawing API, and shared rendering types.

The main browser `App` is catalog/player UI. The screensaver should reuse the engine and scenes, but it should have its own entrypoint that boots directly into a selected scene.

## Shared Screensaver Runtime

Recommended web entrypoints:

- `src/main.tsx`: existing gallery and browser demo.
- `src/screensaver/main.tsx`: fullscreen screensaver player loaded by native wrappers.
- `src/screensaver/settings.tsx`: compact settings/preview UI loaded by native wrappers where appropriate.

Recommended shared runtime responsibilities:

- Load current settings from native-provided JSON or `localStorage` fallback.
- Pick a default scene when no preference exists.
- Render a single full-window `<canvas>`.
- Support classic and modern render modes.
- Hide catalog navigation and source links in screensaver mode.
- Exit or ignore input depending on the host platform's screensaver conventions.

Configuration shape should be plain JSON so every host can share it:

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

## macOS Plan

Deliverable:

- A signed and notarized `Virtuality.saver` bundle.
- Optional `.dmg` or `.pkg` installer for website downloads.

Current scaffold:

- `screensaver.html`: Vite entrypoint for the standalone screensaver runtime.
- `settings.html`: Vite entrypoint for the macOS configure sheet.
- `src/screensaver/`: React fullscreen screensaver runtime, shared config helpers, and web-backed settings UI.
- `platform/macos/Sources/VirtualityView.m`: native `ScreenSaverView` host with an embedded `WKWebView`.
- `platform/macos/build.sh`: local `.saver` bundle build script.

Native host:

- Create a macOS Screen Saver bundle using `ScreenSaver.framework`.
- Implement a `ScreenSaverView` subclass.
- Embed a `WKWebView` inside the `ScreenSaverView`.
- Load the built local Vite screensaver runtime from the bundle resources.
- Use `init(frame:isPreview:)` to distinguish System Settings preview from full-screen mode.
- Use `hasConfigureSheet` and `configureSheet` for scene/settings selection.
- Store preferences with `ScreenSaverDefaults`, not ordinary app defaults.

Build flow:

1. Run `npm run build` for the web assets.
2. Copy the screensaver web bundle into the `.saver` bundle resources.
3. Build the macOS screensaver host with Xcode.
4. Sign the `.saver` bundle with a `Developer ID Application` certificate.
5. Package for distribution, likely as a `.dmg` or `.pkg`.
6. Notarize with Apple.
7. Staple the notarization ticket.
8. Test installation on a Gatekeeper-enabled Mac.

Local debug build:

```sh
npm run build
platform/macos/build.sh
```

The local build script creates an ad-hoc signed `.saver` bundle for testing and attempts to build a universal `arm64`/`x86_64` binary.

Release build with Developer ID signing:

```sh
SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" platform/macos/build.sh
```

Manual test install:

Double-click `build/macos/Virtuality.saver` and accept the macOS install prompt.

Then open System Settings, select Virtuality under Screen Saver, use Options to configure it, and use Preview to run it. Options changes save automatically; use the in-panel X to close Options. Remove the local test build with:

```sh
rm -rf "$HOME/Library/Screen Savers/Virtuality.saver"
```

For public downloads, the preferred install flow is to unzip if needed, double-click `Virtuality.saver`, and accept the macOS install prompt.

If macOS keeps showing an older or black full-screen saver after replacing the bundle, quit System Settings and restart the cached helper processes with:

```sh
killall legacyScreenSaver "Screen Saver"
```

Signing notes:

- A paid Apple Developer Program account can create the required Developer ID certificates.
- Public distribution outside the Mac App Store should use Developer ID signing plus notarization.
- If we ship an installer package, the package may also need signing with a `Developer ID Installer` certificate.

Local prerequisites:

- Xcode command line tools.
- Node.js and npm.
- Apple Developer account credentials for final signing and notarization.
- Developer ID certificates installed in Keychain for release builds.

## Windows Plan

Deliverable:

- A real `Virtuality.scr` screensaver and installer.
- GitHub Actions workflow that can be triggered from macOS.
- Signed release artifacts if SignPath Foundation accepts the project.

Native host:

- Build a Windows executable and package/rename it as `.scr`.
- Use WebView2 or another local webview host to load the same Vite screensaver runtime.
- Implement standard screensaver modes:
  - `/s`: run full-screen.
  - `/c`: show configuration UI.
  - `/p <hwnd>`: render preview inside the Windows Screen Saver Settings preview window.
- Store preferences in an app data JSON file or registry key.
- Provide an installer and uninstaller.

GitHub Actions flow:

1. Run on `windows-latest`.
2. Install Node and .NET or native build dependencies.
3. Run `npm ci`.
4. Run `npm run build`.
5. Build the Windows screensaver host.
6. Package the `.scr` and installer.
7. Upload the unsigned artifact.
8. Submit the artifact to SignPath.
9. Wait for signing approval/completion.
10. Download the signed artifact.
11. Attach the signed artifact to a GitHub Release.

SignPath Foundation requirements to prepare for:

- Project must be open source under an OSI-approved license.
- Project must be actively maintained, documented, and already released in the form to be signed.
- Signed artifacts must be built from the project's own source and verifiable through an automated build.
- GitHub and SignPath accounts used by maintainers must have MFA enabled.
- The project must define code signing roles: authors/committers, reviewers, and signing approvers.
- The repository or website must include a `Code signing policy` section.
- Installer behavior must clearly announce system changes and provide uninstall support.
- Signed binaries need consistent product name and version metadata.

Suggested code signing policy text:

> Code signing policy: Free code signing is provided by SignPath.io, certificate by SignPath Foundation. Release artifacts are built from this repository using GitHub Actions and submitted to SignPath for origin-verified signing. This program does not transfer information to networked systems unless specifically requested by the user or the person installing or operating it.

## Milestones

### 1. Shared Runtime

- Add a dedicated screensaver web entrypoint.
- Make `CanvasStage` usable outside the catalog player.
- Add settings serialization/deserialization helpers.
- Add a fullscreen player mode with no catalog chrome.

### 2. macOS Screensaver

- Add macOS screensaver host project.
- Embed the built web runtime in a `.saver` bundle.
- Implement preview and full-screen modes.
- Implement settings sheet.
- Add local debug/install scripts.
- Document signing and notarization commands.

### 3. macOS Release

- Produce unsigned local debug build.
- Produce Developer ID signed build.
- Notarize and staple.
- Upload signed artifact to the website or GitHub Releases.

### 4. Windows Screensaver

- Add Windows host project.
- Add GitHub Actions build workflow.
- Implement `/s`, `/c`, and `/p` modes.
- Package installer and uninstaller.
- Apply for SignPath Foundation.
- Add SignPath signing workflow after approval.

## Open Decisions

- Whether the macOS download should be a `.dmg`, `.pkg`, or both.
- Whether the Windows host should be .NET/WPF with WebView2, native Win32 with WebView2, or another small host.
- Whether Windows preferences should live in registry or an app data JSON file.
- Whether release artifacts should be attached to GitHub Releases, uploaded to the website, or both.
