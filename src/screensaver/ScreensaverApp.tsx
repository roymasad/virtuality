import { useMemo } from "react";
import { findScreensaverScene } from "../scenes/registry";
import { defaultsFor } from "../scenes/settings";
import { StageHost } from "../ui/StageHost";
import { readScreensaverConfig } from "./config";

export function ScreensaverApp() {
  const config = useMemo(() => readScreensaverConfig(), []);
  const nativeHost = Boolean(window.__VIRTUALITY_CONFIG__?.nativeHost);
  const nativeFrameBridge = Boolean(window.__VIRTUALITY_CONFIG__?.nativeFrameBridge);
  const scene = findScreensaverScene(config.sceneId);
  const settings = {
    ...defaultsFor(scene.settings),
    ...config.settings,
  };

  return (
    <main className="screensaver-page">
      <div className="screensaver-stage">
        <StageHost
          scene={scene}
          mode={config.mode}
          settings={settings}
          onExit={() => undefined}
          nativeHost={nativeHost}
          nativeFrameBridge={nativeFrameBridge}
        />
      </div>
    </main>
  );
}
