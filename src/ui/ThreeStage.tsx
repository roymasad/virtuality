import { useLayoutEffect, useMemo, useRef } from "react";
import type { InputState, RenderMode, SceneMeta, SceneSettings, ThreeSceneContext } from "../engine/types";

interface ThreeStageProps {
  scene: SceneMeta;
  mode: RenderMode;
  settings: SceneSettings;
  onExit: () => void;
  onSceneAction?: (action: string) => void;
  nativeHost?: boolean;
  nativeFrameBridge?: boolean;
}

export function ThreeStage({ scene, mode, settings, onExit, onSceneAction, nativeHost = false, nativeFrameBridge = false }: ThreeStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneInstance = useMemo(() => {
    const instance = scene.createThree?.();
    if (!instance) throw new Error(`${scene.title} does not provide a Three.js renderer`);
    return instance;
  }, [scene]);
  const settingsRef = useRef(settings);
  const modeRef = useRef(mode);
  const exitRef = useRef(onExit);
  const actionRef = useRef(onSceneAction);
  const inputRef = useRef<InputState>({
    pointer: { x: 0, y: 0, down: false, justPressed: false, active: false },
    keys: new Set(),
    lastKey: "",
  });

  settingsRef.current = settings;
  modeRef.current = mode;
  exitRef.current = onExit;
  actionRef.current = onSceneAction;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let raf = 0;
    let fallbackTimer = 0;
    let last = performance.now();
    let lastRenderedAt = 0;
    let stopped = false;

    const stageContext = (now: number, delta: number): ThreeSceneContext => {
      const rect = canvas.getBoundingClientRect();
      const dpr = nativeHost || nativeFrameBridge ? 1 : window.devicePixelRatio || 1;
      return {
        mode: modeRef.current,
        time: now / 1000,
        delta,
        frame,
        settings: settingsRef.current,
        input: inputRef.current,
        action: actionRef.current,
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        pixelRatio: dpr,
      };
    };

    const toCanvasPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = toCanvasPoint(event);
      inputRef.current.pointer = { ...inputRef.current.pointer, ...point, active: true };
    };
    const onPointerDown = (event: PointerEvent) => {
      const point = toCanvasPoint(event);
      inputRef.current.pointer = { ...point, down: true, justPressed: true, active: true };
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerUp = () => {
      inputRef.current.pointer = { ...inputRef.current.pointer, down: false };
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitRef.current();
        return;
      }
      inputRef.current.keys.add(event.key);
      inputRef.current.lastKey = event.key;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      inputRef.current.keys.delete(event.key);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    const initialContext = stageContext(performance.now(), 0);
    sceneInstance.init(canvas, initialContext);
    sceneInstance.resize?.(initialContext);

    const renderFrame = (now: number) => {
      if (stopped) return;
      const elapsed = (now - last) / 1000;
      const delta = Number.isFinite(elapsed) && elapsed > 0 ? Math.min(0.05, elapsed) : 1 / 30;
      last = now;

      const context = stageContext(now, delta);
      try {
        sceneInstance.resize?.(context);
        sceneInstance.update?.(context);
        sceneInstance.render(context);
        window.__VIRTUALITY_STATUS__ = {
          frame,
          height: canvas.height,
          mode: modeRef.current,
          sceneId: scene.id,
          width: canvas.width,
        };
      } catch (error) {
        window.__VIRTUALITY_STATUS__ = {
          error: error instanceof Error ? error.message : String(error),
          frame,
          height: canvas.height,
          mode: modeRef.current,
          sceneId: scene.id,
          width: canvas.width,
        };
        throw error;
      }

      inputRef.current.pointer.justPressed = false;
      frame += 1;
      lastRenderedAt = performance.now();
    };

    const loop = (now: number) => {
      if (stopped) return;
      renderFrame(now);
      raf = requestAnimationFrame(loop);
    };

    renderFrame(performance.now());
    if (!nativeFrameBridge) {
      raf = requestAnimationFrame(loop);
      fallbackTimer = window.setInterval(() => {
        if (performance.now() - lastRenderedAt > 120) {
          renderFrame(performance.now());
        }
      }, 100);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearInterval(fallbackTimer);
      sceneInstance.dispose?.();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [scene, sceneInstance, mode, nativeHost, nativeFrameBridge]);

  return (
    <canvas
      ref={canvasRef}
      className={`stage-canvas three-stage ${mode}`}
      aria-label={`${scene.title} canvas`}
    />
  );
}
