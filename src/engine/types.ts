export type RenderMode = "classic" | "modern";
export type SceneRenderer = "canvas2d" | "three";

export type SettingKind = "range" | "select" | "toggle";

export type SceneSetting =
  | {
      kind: "range";
      id: string;
      label: string;
      description?: string;
      min: number;
      max: number;
      step: number;
      defaultValue: number;
    }
  | {
      kind: "select";
      id: string;
      label: string;
      description?: string;
      options: Array<{ label: string; value: string; description?: string }>;
      defaultValue: string;
    }
  | {
      kind: "toggle";
      id: string;
      label: string;
      description?: string;
      defaultValue: boolean;
    };

export type SceneSettings = Record<string, number | string | boolean>;

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  justPressed: boolean;
  active: boolean;
}

export interface InputState {
  pointer: PointerState;
  keys: Set<string>;
  lastKey: string;
}

export interface SceneAnnotation {
  file: string;
  subroutine: string;
  startLine: number;
  endLine: number;
}

export interface SceneMeta {
  id: string;
  title: string;
  key: string;
  originalName: string;
  note: string;
  renderer: SceneRenderer;
  badge?: string;
  annotation?: SceneAnnotation;
  settings: SceneSetting[];
  create?: () => Scene;
  createThree?: () => ThreeScene;
}

export interface SceneContext {
  mode: RenderMode;
  time: number;
  delta: number;
  frame: number;
  settings: SceneSettings;
  input: InputState;
  action?: (action: string) => void;
}

export interface Scene {
  init?: (draw: DrawApi, ctx: SceneContext) => void;
  update?: (draw: DrawApi, ctx: SceneContext) => void;
  render: (draw: DrawApi, ctx: SceneContext) => void;
  dispose?: () => void;
}

export interface ThreeSceneContext extends SceneContext {
  width: number;
  height: number;
  pixelRatio: number;
  nativeFrameBridge?: boolean;
  nativeHost?: boolean;
}

export interface ThreeScene {
  init: (canvas: HTMLCanvasElement, ctx: ThreeSceneContext) => void;
  resize?: (ctx: ThreeSceneContext) => void;
  update?: (ctx: ThreeSceneContext) => void;
  render: (ctx: ThreeSceneContext) => void;
  dispose?: () => void;
}

export interface DrawApi {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  mode: RenderMode;
  antialias: boolean;
  lineScale: number;
  cls: (color?: number | string, alpha?: number) => void;
  color: (index: number, alpha?: number) => string;
  pset: (x: number, y: number, color?: number | string, size?: number) => void;
  line: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color?: number | string,
    width?: number,
    alpha?: number,
  ) => void;
  circle: (
    x: number,
    y: number,
    radius: number,
    color?: number | string,
    fill?: boolean,
    alpha?: number,
  ) => void;
  box: (
    x: number,
    y: number,
    width: number,
    height: number,
    color?: number | string,
    fill?: boolean,
    alpha?: number,
  ) => void;
  locateText: (
    row: number,
    col: number,
    text: string,
    color?: number | string,
    scale?: number,
  ) => void;
}
