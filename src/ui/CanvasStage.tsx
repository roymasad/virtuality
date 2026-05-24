import { useLayoutEffect, useMemo, useRef } from "react";
import { createDrawApi } from "../engine/draw";
import type { InputState, RenderMode, SceneMeta, SceneSettings } from "../engine/types";

interface CanvasStageProps {
  scene: SceneMeta;
  mode: RenderMode;
  settings: SceneSettings;
  onExit: () => void;
  onSceneAction?: (action: string) => void;
  nativeHost?: boolean;
  nativeFrameBridge?: boolean;
}

declare global {
  interface Window {
    __VIRTUALITY_STATUS__?: {
      error?: string;
      frame: number;
      height: number;
      mode: RenderMode;
      sceneId: string;
      width: number;
    };
    __VIRTUALITY_RENDER_FRAME__?: () => {
      ok: boolean;
      width: number;
      height: number;
      cssWidth: number;
      cssHeight: number;
      pixelRatio: number;
      frame: number;
      sampleNonBlack: number;
      sampleTotal: number;
      dataURL: string;
    };
    __VIRTUALITY_STOP__?: () => void;
  }
}

export function CanvasStage({ scene, mode, settings, onExit, onSceneAction, nativeHost = false, nativeFrameBridge = false }: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneInstance = useMemo(() => {
    const instance = scene.create?.();
    if (!instance) throw new Error(`${scene.title} does not provide a canvas renderer`);
    return instance;
  }, [scene]);
  const settingsRef = useRef(settings);
  const modeRef = useRef(mode);
  const exitRef = useRef(onExit);
  const actionRef = useRef(onSceneAction);
  const inputRef = useRef<InputState>({
    pointer: { x: 160, y: 100, down: false, justPressed: false, active: false },
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
    let lastMode = modeRef.current;
    let lastRenderedAt = 0;
    let stopped = false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const classic = modeRef.current === "classic";
      // The macOS host either PNG-decodes frames or runs inside ScreenSaverEngine.
      // Full CSS resolution avoids blur without paying the cost of Retina-sized canvases.
      const dpr = nativeHost || nativeFrameBridge ? 1 : window.devicePixelRatio || 1;
      let nextWidth = classic ? 320 : Math.max(640, Math.floor(rect.width * dpr));
      let nextHeight = classic ? 200 : Math.max(400, Math.floor(rect.height * dpr));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
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
        exitRef.current();
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

    const renderFrame = (now: number) => {
      if (stopped) return;
      if (lastMode !== modeRef.current) {
        updateSize();
        lastMode = modeRef.current;
      }
      const elapsed = (now - last) / 1000;
      const delta = Number.isFinite(elapsed) && elapsed > 0 ? Math.min(0.05, elapsed) : 1 / 30;
      last = now;
      const draw = createDrawApi(
        ctx,
        canvas.width,
        canvas.height,
        modeRef.current,
        modeRef.current === "modern" || Boolean(settingsRef.current.antialias),
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
      try {
        sceneInstance.update?.(draw, sceneContext);
        sceneInstance.render(draw, sceneContext);
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

    const renderFrameForNative = () => {
      updateSize();
      renderFrame(performance.now());
      const rect = canvas.getBoundingClientRect();
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const stride = Math.max(4, Math.floor((canvas.width * canvas.height) / 1200) * 4);
      let sampleNonBlack = 0;
      let sampleTotal = 0;

      for (let index = 0; index < image.data.length; index += stride) {
        sampleTotal += 1;
        if (image.data[index] || image.data[index + 1] || image.data[index + 2]) {
          sampleNonBlack += 1;
        }
      }

      return {
        ok: true,
        width: canvas.width,
        height: canvas.height,
        cssWidth: Math.round(rect.width),
        cssHeight: Math.round(rect.height),
        pixelRatio: nativeHost || nativeFrameBridge ? 1 : window.devicePixelRatio || 1,
        frame,
        sampleNonBlack,
        sampleTotal,
        dataURL: canvas.toDataURL("image/png"),
      };
    };

    const stopNativeRendering = () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearInterval(fallbackTimer);
    };

    sceneInstance.init?.(createDrawApi(
      ctx,
      canvas.width,
      canvas.height,
      modeRef.current,
      modeRef.current === "modern" || Boolean(settingsRef.current.antialias),
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
    window.__VIRTUALITY_STOP__ = stopNativeRendering;
    if (nativeFrameBridge) {
      window.__VIRTUALITY_RENDER_FRAME__ = renderFrameForNative;
    }
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
      if (nativeFrameBridge && window.__VIRTUALITY_RENDER_FRAME__ === renderFrameForNative) {
        delete window.__VIRTUALITY_RENDER_FRAME__;
      }
      if (window.__VIRTUALITY_STOP__ === stopNativeRendering) {
        delete window.__VIRTUALITY_STOP__;
      }
      sceneInstance.dispose?.();
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [sceneInstance, nativeHost, nativeFrameBridge]);

  return (
    <canvas
      ref={canvasRef}
      className={`stage-canvas ${mode}`}
      aria-label={`${scene.title} canvas`}
    />
  );
}
