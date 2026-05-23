import type { SceneSetting, SceneSettings } from "../engine/types";

type VariantOption = {
  label: string;
  value: string;
  description: string;
};

type SettingsOverride = {
  trail?: number;
  modernLineWidth?: number;
};

const timingSettings: SceneSetting[] = [
  {
    kind: "range",
    id: "speed",
    label: "Speed",
    description: "Animation timing multiplier. Classic defaults to the original pacing target.",
    min: 0.25,
    max: 3,
    step: 0.05,
    defaultValue: 1,
  },
  {
    kind: "range",
    id: "density",
    label: "Density",
    description: "How many particles, beams, or repeated elements the scene draws where the routine allows it.",
    min: 0.35,
    max: 2,
    step: 0.05,
    defaultValue: 1,
  },
  {
    kind: "range",
    id: "trail",
    label: "Trail",
    description: "Persistence amount for demos with afterimages. Set to 0 for no trail where supported.",
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.35,
  },
];

const renderSettings: SceneSetting[] = [
  {
    kind: "toggle",
    id: "antialias",
    label: "Classic anti-aliasing",
    description: "Smoothing for Classic mode. On by default for a softer browser presentation.",
    defaultValue: true,
  },
  {
    kind: "range",
    id: "modernLineWidth",
    label: "Modern line width",
    description: "Stroke multiplier for high-resolution rendering, where one-pixel DOS lines become too thin.",
    min: 1,
    max: 8,
    step: 0.1,
    defaultValue: 4,
  },
];

export const commonSettings: SceneSetting[] = [...timingSettings, ...renderSettings];

export function settingsWithOptions(overrides: SettingsOverride = {}): SceneSetting[] {
  return [
    ...timingSettings.map((setting): SceneSetting => {
      if (setting.kind === "range" && setting.id === "trail" && overrides.trail !== undefined) {
        return { ...setting, defaultValue: overrides.trail };
      }
      return setting;
    }),
    ...renderSettings.map((setting): SceneSetting => {
      if (setting.kind === "range" && setting.id === "modernLineWidth" && overrides.modernLineWidth !== undefined) {
        return { ...setting, defaultValue: overrides.modernLineWidth };
      }
      return setting;
    }),
  ];
}

export function settingsWithVariants(
  options: VariantOption[],
  defaultValue = "original",
  overrides: SettingsOverride = {},
): SceneSetting[] {
  return [
    ...timingSettings.map((setting): SceneSetting => {
      if (setting.kind === "range" && setting.id === "trail" && overrides.trail !== undefined) {
        return { ...setting, defaultValue: overrides.trail };
      }
      return setting;
    }),
    {
      kind: "select",
      id: "variant",
      label: "Variant",
      description: "Original branches from this specific routine.",
      options,
      defaultValue,
    },
    ...renderSettings.map((setting): SceneSetting => {
      if (setting.kind === "range" && setting.id === "modernLineWidth" && overrides.modernLineWidth !== undefined) {
        return { ...setting, defaultValue: overrides.modernLineWidth };
      }
      return setting;
    }),
  ];
}

export function defaultsFor(settings = commonSettings): SceneSettings {
  return Object.fromEntries(
    settings.map((setting) => [setting.id, setting.defaultValue]),
  );
}

export function numberSetting(
  settings: SceneSettings,
  id: string,
  fallback: number,
): number {
  const value = settings[id];
  return typeof value === "number" ? value : fallback;
}

export function stringSetting(
  settings: SceneSettings,
  id: string,
  fallback: string,
): string {
  const value = settings[id];
  return typeof value === "string" ? value : fallback;
}

export function booleanSetting(
  settings: SceneSettings,
  id: string,
  fallback: boolean,
): boolean {
  const value = settings[id];
  return typeof value === "boolean" ? value : fallback;
}
