import type { RenderMode, SceneMeta, SceneSettings } from "../engine/types";
import { CanvasStage } from "./CanvasStage";
import { ThreeStage } from "./ThreeStage";

interface StageHostProps {
  scene: SceneMeta;
  mode: RenderMode;
  settings: SceneSettings;
  onExit: () => void;
  onSceneAction?: (action: string) => void;
  nativeHost?: boolean;
  nativeFrameBridge?: boolean;
}

export function StageHost(props: StageHostProps) {
  if (props.scene.renderer === "three") {
    return <ThreeStage {...props} />;
  }

  return <CanvasStage {...props} />;
}
