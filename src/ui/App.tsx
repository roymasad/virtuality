import {
  ArrowLeft,
  Atom,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Disc3,
  Download,
  ExternalLink,
  Grid3X3,
  Orbit,
  PanelRightOpen,
  Play,
  ScanLine,
  Share2,
  Sparkles,
  Triangle,
  Waves,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import screenshotUrl from "../../screenshot.png";
import type { RenderMode, SceneSettings } from "../engine/types";
import { originalSourceLines } from "../data/originalData";
import { findScene, scenes } from "../scenes/registry";
import { defaultsFor } from "../scenes/settings";
import { StageHost } from "./StageHost";
import { navigate, useHashRoute } from "./useHashRoute";
import { SettingsPanel } from "./SettingsPanel";

const repoUrl = "https://github.com/roymasad/virtuality";
const macScreensaverDownloadUrl = "/downloads/Virtuality-macOS-screensaver.zip";

export function App() {
  const route = useHashRoute();

  if (route.name === "scene") {
    return <ScenePage sceneId={route.sceneId} />;
  }

  if (route.name === "source") {
    return <SourcePage sceneId={route.sceneId} />;
  }

  return <Gallery />;
}

function Gallery() {
  return (
    <main className="gallery-page">
      <section className="gallery-hero">
        <img src={screenshotUrl} alt="Original Virtuality DOSBox screenshot" />
        <div className="gallery-hero-copy">
          <p className="eyebrow">QBasic MSDOS archive, circa 1996</p>
          <h1>Virtuality</h1>
          <p>Classic VGA demo scenes and modern remixes in one playable catalog.</p>
          <div className="hero-actions">
            <a className="download-cta" href={macScreensaverDownloadUrl} download>
              <Download size={18} />
              Download macOS Screen Saver
            </a>
          </div>
        </div>
      </section>

      <section className="catalog">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow">Scene catalog</p>
            <h2>Pick a card</h2>
          </div>
        </div>

        <div className="catalog-grid">
          {scenes.map((scene, index) => {
            const Icon = iconForScene(scene.id);
            return (
            <article className={`catalog-card accent-${index % 6}`} key={scene.id}>
              <button className="catalog-main" onClick={() => navigate({ name: "scene", sceneId: scene.id })}>
                <span className="scene-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span>
                  <b>{scene.title}</b>
                  {scene.badge ? <small className="scene-badge">{scene.badge}</small> : null}
                </span>
              </button>
              <p>{scene.note}</p>
              <div className="scene-card-actions">
                <button
                  className="play-cta"
                  onClick={() => navigate({ name: "scene", sceneId: scene.id })}
                  aria-label={`Play ${scene.title}`}
                  title={`Play ${scene.title}`}
                >
                  <Play size={22} />
                </button>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <footer className="site-footer">
        <span>Virtuality Remaster</span>
        <span>Original QBasic/VGA archive by Roy Massaad.</span>
        <a href={repoUrl} target="_blank" rel="noreferrer">
          Original GitHub
        </a>
      </footer>
    </main>
  );
}

function iconForScene(id: string) {
  const icons = {
    intro: Sparkles,
    info: CircleDot,
    saver: ScanLine,
    omega: Orbit,
    laser: Zap,
    craper: Waves,
    cooler: Atom,
    cyber: Grid3X3,
    delta: Triangle,
    ball: CircleDot,
    lines: ScanLine,
    shella: Orbit,
    type1: Waves,
    type2: Grid3X3,
    tunnels: Sparkles,
    coolx: Atom,
    disco: Disc3,
    spheres: CircleDot,
    spots: Sparkles,
    "dune-flyover": Waves,
  };
  return icons[id as keyof typeof icons] ?? Sparkles;
}

function ScenePage({ sceneId }: { sceneId: string }) {
  const scene = findScene(sceneId);
  const [mode, setMode] = useState<RenderMode>("classic");
  const [settings, setSettings] = useState<SceneSettings>(() => defaultsFor(scene.settings));
  const [panelOpen, setPanelOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [modeChanged, setModeChanged] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneIndex = Math.max(0, scenes.findIndex((item) => item.id === scene.id));
  const previousScene = scenes[(sceneIndex - 1 + scenes.length) % scenes.length];
  const nextScene = scenes[(sceneIndex + 1) % scenes.length];

  useEffect(() => {
    setSettings(defaultsFor(scene.settings));
  }, [scene]);

  const shareScene = async () => {
    const url = window.location.href;
    const title = `${scene.title} - Virtuality Remaster`;
    const mobileShare = navigator.maxTouchPoints > 0 && window.matchMedia("(max-width: 780px)").matches;
    if (mobileShare && navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard?.writeText(url);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1400);
  };

  const toggleMode = () => {
    setMode((current) => (current === "classic" ? "modern" : "classic"));
    setModeChanged(true);
    window.setTimeout(() => setModeChanged(false), 1400);
  };

  return (
    <main className="player-page">
      <header className="topbar">
        <button className="top-icon" onClick={() => navigate({ name: "gallery" })} title="Gallery">
          <ArrowLeft size={18} />
        </button>
        <div className="top-title">
          <div className="scene-switcher">
            <button
              className="top-icon mini"
              onClick={() => navigate({ name: "scene", sceneId: previousScene.id })}
              title={`Previous: ${previousScene.title}`}
            >
              <ChevronLeft size={17} />
            </button>
            <div>
              <strong>Virtuality Remaster</strong>
              <span>{scene.title}</span>
            </div>
            <button
              className="top-icon mini"
              onClick={() => navigate({ name: "scene", sceneId: nextScene.id })}
              title={`Next: ${nextScene.title}`}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="top-actions">
          <button
            className={`top-icon mode-toggle ${mode} ${modeChanged ? "changed" : ""}`}
            onClick={toggleMode}
            title={mode === "classic" ? "Switch to Modern" : "Switch to Classic"}
            aria-label={mode === "classic" ? "Switch to Modern" : "Switch to Classic"}
          >
            {mode === "classic" ? <ScanLine size={18} /> : <Sparkles size={18} />}
            <span className="mode-tooltip">
              {modeChanged ? `${mode === "classic" ? "Classic" : "Modern"} mode` : mode === "classic" ? "Classic mode" : "Modern mode"}
            </span>
          </button>
          <button className="top-icon share-button" onClick={shareScene} title={shareCopied ? "Copied" : "Copy link"}>
            <Share2 size={18} />
            {shareCopied ? <span className="copy-tooltip">Copied</span> : null}
          </button>
          <button className="top-icon" onClick={() => setPanelOpen((current) => !current)} title="Controls">
            <PanelRightOpen size={18} />
          </button>
        </div>
      </header>
      <section className={`player-layout ${panelOpen ? "" : "panel-collapsed"}`}>
        <div
          className="stage-shell"
          ref={(node) => {
            stageRef.current = node;
          }}
        >
          <StageHost
            scene={scene}
            mode={mode}
            settings={settings}
            onExit={() => navigate({ name: "gallery" })}
            onSceneAction={(action) => {
              if (action === "open-info") navigate({ name: "scene", sceneId: "info" });
              if (action === "open-gallery") navigate({ name: "gallery" });
            }}
          />
        </div>
        {panelOpen ? (
          <SettingsPanel
            scene={scene}
            mode={mode}
            settings={settings}
            collapsed={false}
            onToggleCollapsed={() => setPanelOpen((current) => !current)}
            onModeChange={setMode}
            onSettingsChange={setSettings}
            onFullscreen={() => stageRef.current?.requestFullscreen?.()}
          />
        ) : null}
      </section>
    </main>
  );
}

function SourcePage({ sceneId }: { sceneId: string }) {
  const scene = findScene(sceneId);
  useEffect(() => {
    if (!scene.annotation) navigate({ name: "scene", sceneId: scene.id });
  }, [scene]);

  if (!scene.annotation) return null;

  const annotation = scene.annotation;
  const excerpt = originalSourceLines.slice(annotation.startLine - 1, annotation.endLine);

  return (
    <main className="source-page">
      <header className="topbar">
        <button className="top-icon" onClick={() => navigate({ name: "gallery" })} title="Gallery">
          <ArrowLeft size={18} />
        </button>
        <div className="top-title">
          <strong>{scene.title} Source</strong>
          <span>{annotation.file} lines {annotation.startLine}-{annotation.endLine}</span>
        </div>
        <button className="top-icon" onClick={() => navigate({ name: "scene", sceneId: scene.id })} title="Play">
          <Play size={18} />
        </button>
      </header>
      <section className="source-layout">
        <aside className="panel">
          <p className="eyebrow">Original archive</p>
          <h1>{scene.originalName}</h1>
          <p>
            This excerpt is imported directly from the preserved QBasic file and shown as
            historical context for the canvas remaster.
          </p>
          <a className="external" href={`${repoUrl}/blob/main/VIRT.BAS`} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Open full source
          </a>
        </aside>
        <pre className="source-code">
          {excerpt.map((line, index) => {
            const number = annotation.startLine + index;
            return `${String(number).padStart(4, " ")}  ${line}`;
          }).join("\n")}
        </pre>
      </section>
    </main>
  );
}
