import type { RenderMode, SceneSettings } from "../engine/types";
import { findScreensaverScene } from "../scenes/registry";
import { defaultsFor } from "../scenes/settings";

export type ScreensaverConfig = {
  sceneId: string;
  mode: RenderMode;
  settings: SceneSettings;
};

declare global {
  interface Window {
    __VIRTUALITY_CONFIG__?: Partial<ScreensaverConfig> & {
      nativeFrameBridge?: boolean;
    };
  }
}

const storageKey = "virtuality:screensaver";

export function readScreensaverConfig(): ScreensaverConfig {
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = window.__VIRTUALITY_CONFIG__;
  const queryConfig = parseConfig(params.get("config"));
  const stored = readStoredConfig();
  const sceneId = params.get("scene") ?? params.get("sceneId") ?? nativeConfig?.sceneId ?? queryConfig?.sceneId ?? stored?.sceneId ?? "omega";
  const mode = normalizeMode(params.get("mode") ?? nativeConfig?.mode ?? queryConfig?.mode ?? stored?.mode);
  const scene = findScreensaverScene(sceneId);
  const settings: SceneSettings = {
    ...defaultsFor(scene.settings),
    ...(stored?.settings ?? {}),
    ...(queryConfig?.settings ?? {}),
    ...(nativeConfig?.settings ?? {}),
  };

  for (const setting of scene.settings) {
    const raw = params.get(setting.id);
    if (raw === null) continue;

    if (setting.kind === "range") settings[setting.id] = Number(raw);
    if (setting.kind === "toggle") settings[setting.id] = raw === "true" || raw === "1";
    if (setting.kind === "select") settings[setting.id] = raw;
  }

  return { sceneId: scene.id, mode, settings };
}

export function saveLocalScreensaverConfig(config: ScreensaverConfig) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizeScreensaverConfig(config)));
  } catch {
    // Native hosts are the source of truth when localStorage is unavailable.
  }
}

export function configForScene(config: ScreensaverConfig, sceneId: string): ScreensaverConfig {
  const scene = findScreensaverScene(sceneId);
  return {
    sceneId: scene.id,
    mode: config.mode,
    settings: defaultsFor(scene.settings),
  };
}

export function normalizeScreensaverConfig(config: ScreensaverConfig): ScreensaverConfig {
  const scene = findScreensaverScene(config.sceneId);
  const defaults = defaultsFor(scene.settings);
  const settings = { ...defaults };

  for (const key of Object.keys(defaults)) {
    if (config.settings[key] !== undefined) settings[key] = config.settings[key];
  }

  return {
    sceneId: scene.id,
    mode: normalizeMode(config.mode),
    settings,
  };
}

function readStoredConfig(): Partial<ScreensaverConfig> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? parseConfig(raw) : null;
  } catch {
    return null;
  }
}

function parseConfig(raw: string | null): Partial<ScreensaverConfig> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ScreensaverConfig>;
    if (!value || typeof value !== "object") return null;
    return value;
  } catch {
    return null;
  }
}

function normalizeMode(value: string | null | undefined): RenderMode {
  return value === "classic" ? "classic" : "modern";
}
