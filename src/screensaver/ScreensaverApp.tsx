import { useMemo } from "react";
import { findScreensaverScene } from "../scenes/registry";
import { defaultsFor } from "../scenes/settings";
import { CanvasStage } from "../ui/CanvasStage";
import { readScreensaverConfig } from "./config";

export function ScreensaverApp() {
  const config = useMemo(() => readScreensaverConfig(), []);
  const nativeFrameBridge = Boolean(window.__VIRTUALITY_CONFIG__?.nativeFrameBridge);
  const scene = findScreensaverScene(config.sceneId);
  const settings = {
    ...defaultsFor(scene.settings),
    ...config.settings,
  };

  return (
    <main className="screensaver-page">
      <div className="screensaver-stage">
        <CanvasStage
          scene={scene}
          mode={config.mode}
          settings={settings}
          onExit={() => undefined}
          nativeFrameBridge={nativeFrameBridge}
        />
      </div>
    </main>
  );
}
