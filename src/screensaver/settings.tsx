import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RenderMode, SceneSettings } from "../engine/types";
import { findScreensaverScene, screensaverScenes } from "../scenes/registry";
import { CanvasStage } from "../ui/CanvasStage";
import {
  configForScene,
  normalizeScreensaverConfig,
  readScreensaverConfig,
  saveLocalScreensaverConfig,
  type ScreensaverConfig,
} from "./config";
import "../styles.css";
import "./styles.css";

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        virtualitySettings?: {
          postMessage: (message: SettingsMessage) => void;
        };
      };
    };
  }
}

type SettingsMessage =
  | { type: "save"; config: ScreensaverConfig }
  | { type: "close" }
  | { type: "openUrl"; url: string }
  | { type: "ready" };

function SettingsApp() {
  const initialConfig = useMemo(() => normalizeScreensaverConfig(readScreensaverConfig()), []);
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(true);
  const lastSavedRef = useRef(JSON.stringify(initialConfig));
  const skipInitialSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const scene = findScreensaverScene(config.sceneId);
  const settings = {
    ...config.settings,
  };

  const saveConfig = useCallback((nextConfig: ScreensaverConfig) => {
    const normalizedConfig = normalizeScreensaverConfig(nextConfig);
    const serialized = JSON.stringify(normalizedConfig);

    if (serialized === lastSavedRef.current) {
      setSaved(true);
      return;
    }

    saveLocalScreensaverConfig(normalizedConfig);
    postNativeMessage({ type: "save", config: normalizedConfig });
    lastSavedRef.current = serialized;
    setSaved(true);
  }, []);

  useEffect(() => {
    postNativeMessage({ type: "ready" });
  }, []);

  useEffect(() => {
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }

    setSaved(false);
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveConfig(config);
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [config, saveConfig]);

  const updateConfig = (updater: (current: ScreensaverConfig) => ScreensaverConfig) => {
    setSaved(false);
    setConfig((current) => normalizeScreensaverConfig(updater(current)));
  };

  const updateSettings = (nextSettings: SceneSettings) => {
    updateConfig((current) => ({ ...current, settings: nextSettings }));
  };

  const close = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveConfig(config);
    postNativeMessage({ type: "close" });
  };

  const openWebsite = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.webkit?.messageHandlers?.virtualitySettings) {
      event.preventDefault();
      postNativeMessage({ type: "openUrl", url: "https://virtuality.roymassaad.com" });
    }
  };

  return (
    <main className="settings-page">
      <section className="settings-preview" aria-label="Screensaver preview">
        <CanvasStage
          scene={scene}
          mode={config.mode}
          settings={settings}
          onExit={() => undefined}
        />
        <a
          className="preview-website-link"
          href="https://virtuality.roymassaad.com"
          target="_blank"
          rel="noreferrer"
          onClick={openWebsite}
        >
          virtuality.roymassaad.com
        </a>
      </section>

      <aside className="settings-controls" aria-label="Screensaver settings">
        <div className="settings-head">
          <div>
            <p className="eyebrow">Virtuality</p>
            <h1>Screen Saver</h1>
          </div>
          <div className="settings-head-actions">
            <span className={saved ? "save-state visible" : "save-state"}>Saved</span>
            <button className="settings-close" type="button" onClick={close} aria-label="Close settings">
              X
            </button>
          </div>
        </div>

        <label className="control">
          <span>Scene</span>
          <select
            value={scene.id}
            onChange={(event) => {
              updateConfig((current) => configForScene(current, event.target.value));
            }}
          >
            {screensaverScenes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <div className="segmented" aria-label="Render mode">
          {(["classic", "modern"] satisfies RenderMode[]).map((mode) => (
            <button
              key={mode}
              className={config.mode === mode ? "active" : ""}
              onClick={() => {
                updateConfig((current) => ({ ...current, mode }));
              }}
            >
              {mode === "classic" ? "Classic" : "Modern"}
            </button>
          ))}
        </div>

        <div className="control-list">
          {scene.settings.map((setting) => {
            if (setting.id === "antialias" && config.mode !== "classic") return null;
            if (setting.id === "modernLineWidth" && config.mode !== "modern") return null;

            if (setting.kind === "range") {
              return (
                <label className="control" key={setting.id}>
                  <span>
                    {setting.label}
                    <b>{Number(settings[setting.id]).toFixed(setting.step < 1 ? 2 : 0)}</b>
                  </span>
                  <input
                    type="range"
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    value={Number(settings[setting.id])}
                    onChange={(event) =>
                      updateSettings({ ...settings, [setting.id]: Number(event.target.value) })
                    }
                  />
                </label>
              );
            }

            if (setting.kind === "select") {
              return (
                <label className="control" key={setting.id}>
                  <span>{setting.label}</span>
                  <select
                    value={String(settings[setting.id])}
                    onChange={(event) => updateSettings({ ...settings, [setting.id]: event.target.value })}
                  >
                    {setting.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return (
              <label className="toggle control" key={setting.id}>
                <span>{setting.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[setting.id])}
                  onChange={(event) => updateSettings({ ...settings, [setting.id]: event.target.checked })}
                />
              </label>
            );
          })}
        </div>
      </aside>
    </main>
  );
}

function postNativeMessage(message: SettingsMessage) {
  window.webkit?.messageHandlers?.virtualitySettings?.postMessage(message);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>,
);
