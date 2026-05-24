import { ChevronsRight, ExternalLink, Maximize2, Moon, PanelRightOpen, Sun } from "lucide-react";
import type { RenderMode, SceneMeta, SceneSettings } from "../engine/types";

const sourceUrl = "https://github.com/roymasad/virtuality/blob/main/VIRT.BAS";

interface SettingsPanelProps {
  scene: SceneMeta;
  mode: RenderMode;
  settings: SceneSettings;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onModeChange: (mode: RenderMode) => void;
  onSettingsChange: (settings: SceneSettings) => void;
  onFullscreen: () => void;
}

export function SettingsPanel({
  scene,
  mode,
  settings,
  collapsed,
  onToggleCollapsed,
  onModeChange,
  onSettingsChange,
  onFullscreen,
}: SettingsPanelProps) {
  if (collapsed) {
    return (
      <aside className="panel collapsed-panel" aria-label="Scene controls collapsed">
        <button className="top-icon" onClick={onToggleCollapsed} title="Open controls">
          <PanelRightOpen size={18} />
        </button>
        <span>{scene.key}</span>
      </aside>
    );
  }

  return (
    <aside className="panel" aria-label="Scene controls">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Scene</p>
          <h2>{scene.title}</h2>
        </div>
        <button className="top-icon" onClick={onToggleCollapsed} title="Collapse controls">
          <ChevronsRight size={18} />
        </button>
      </div>

      <div className="panel-summary">
        <p>{scene.note}</p>
      </div>

      <div className="segmented" aria-label="Render mode">
        <button className={mode === "classic" ? "active" : ""} onClick={() => onModeChange("classic")}>
          <Moon size={16} /> Classic
        </button>
        <button className={mode === "modern" ? "active" : ""} onClick={() => onModeChange("modern")}>
          <Sun size={16} /> Modern
        </button>
      </div>
      <p className="mode-note">
        {scene.renderer === "three"
          ? mode === "classic"
            ? "Classic renders the live 3D scene at a lower internal resolution with crisp pixel scaling."
            : "Modern keeps the retro-CG style while increasing render clarity, terrain detail, and atmosphere."
          : mode === "classic"
            ? "Classic keeps the 320x200 VGA coordinate system and pixelated scaling."
            : "Modern renders to the live canvas resolution with smoothing and richer timing where the scene supports it."}
      </p>

      <div className="control-list">
        {scene.settings.map((setting) => {
          if (setting.id === "antialias" && mode !== "classic") return null;
          if (setting.id === "modernLineWidth" && mode !== "modern") return null;

          if (setting.kind === "range") {
            return (
              <label className="control" key={setting.id}>
                <span>
                  {setting.label}
                  <b>{Number(settings[setting.id]).toFixed(setting.step < 1 ? 2 : 0)}</b>
                </span>
                {setting.description ? <small>{setting.description}</small> : null}
                <input
                  type="range"
                  min={setting.min}
                  max={setting.max}
                  step={setting.step}
                  value={Number(settings[setting.id])}
                  onChange={(event) =>
                    onSettingsChange({ ...settings, [setting.id]: Number(event.target.value) })
                  }
                />
              </label>
            );
          }
          if (setting.kind === "select") {
            return (
              <label className="control" key={setting.id}>
                <span>{setting.label}</span>
                {setting.description ? <small>{setting.description}</small> : null}
                <select
                  value={String(settings[setting.id])}
                  onChange={(event) => onSettingsChange({ ...settings, [setting.id]: event.target.value })}
                >
                  {setting.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>
                  {setting.options.find((option) => option.value === settings[setting.id])?.description}
                </small>
              </label>
            );
          }
          return (
            <label className="toggle control" key={setting.id}>
              <span>
                {setting.label}
                {setting.description ? <small>{setting.description}</small> : null}
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings[setting.id])}
                onChange={(event) => onSettingsChange({ ...settings, [setting.id]: event.target.checked })}
              />
            </label>
          );
        })}
      </div>

      <button className="icon-button wide" onClick={onFullscreen} title="Fullscreen">
        <Maximize2 size={16} /> Fullscreen
      </button>

      {scene.annotation ? (
        <a className="icon-button wide secondary-action" href={sourceUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Original GitHub
        </a>
      ) : null}
    </aside>
  );
}
