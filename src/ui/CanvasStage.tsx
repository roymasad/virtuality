import { useEffect, useMemo, useRef } from "react";
import { createDrawApi } from "../engine/draw";
import type { InputState, RenderMode, SceneMeta, SceneSettings } from "../engine/types";

interface CanvasStageProps {
  scene: SceneMeta;
  mode: RenderMode;
  settings: SceneSettings;
  onExit: () => void;
  onSceneAction?: (action: string) => void;
}

export function CanvasStage({ scene, mode, settings, onExit, onSceneAction }: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneInstance = useMemo(() => scene.create(), [scene]);
  const settingsRef = useRef(settings);
  const modeRef = useRef(mode);
  const actionRef = useRef(onSceneAction);
  const inputRef = useRef<InputState>({
    pointer: { x: 160, y: 100, down: false, justPressed: false, active: false },
    keys: new Set(),
    lastKey: "",
  });

  settingsRef.current = settings;
  modeRef.current = mode;
  actionRef.current = onSceneAction;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let raf = 0;
    let last = performance.now();
    let lastMode = modeRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const classic = modeRef.current === "classic";
      canvas.width = classic ? 320 : Math.max(640, Math.floor(rect.width * dpr));
      canvas.height = classic ? 200 : Math.max(400, Math.floor(rect.height * dpr));
      canvas.style.imageRendering = classic ? "pixelated" : "auto";
    };

    const toCanvasPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const classic = modeRef.current === "classic";
      const width = classic ? 320 : canvas.width;
      const height = classic ? 200 : canvas.height;
      return {
        x: ((event.clientX - rect.left) / rect.width) * width,
        y: ((event.clientY - rect.top) / rect.height) * height,
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
        onExit();
        return;
      }
      inputRef.current.keys.add(event.key);
      inputRef.current.lastKey = event.key;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      inputRef.current.keys.delete(event.key);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    const loop = (now: number) => {
      if (lastMode !== modeRef.current) {
        updateSize();
        lastMode = modeRef.current;
      }
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const draw = createDrawApi(
        ctx,
        canvas.width,
        canvas.height,
        modeRef.current,
        Boolean(settingsRef.current.antialias),
        Number(settingsRef.current.modernLineWidth) || 1,
      );
      const sceneContext = {
        mode: modeRef.current,
        time: now / 1000,
        delta,
        frame,
        settings: settingsRef.current,
        input: inputRef.current,
        action: actionRef.current,
      };
      sceneInstance.update?.(draw, sceneContext);
      sceneInstance.render(draw, sceneContext);
      inputRef.current.pointer.justPressed = false;
      frame += 1;
      raf = requestAnimationFrame(loop);
    };

    sceneInstance.init?.(createDrawApi(
      ctx,
      canvas.width,
      canvas.height,
      modeRef.current,
      Boolean(settingsRef.current.antialias),
      Number(settingsRef.current.modernLineWidth) || 1,
    ), {
      mode: modeRef.current,
      time: 0,
      delta: 0,
      frame: 0,
      settings: settingsRef.current,
      input: inputRef.current,
      action: actionRef.current,
    });
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      sceneInstance.dispose?.();
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [sceneInstance, onExit]);

  return (
    <canvas
      ref={canvasRef}
      className={`stage-canvas ${mode}`}
      aria-label={`${scene.title} canvas`}
    />
  );
}
