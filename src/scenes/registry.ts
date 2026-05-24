import type { SceneMeta } from "../engine/types";
import { ProceduralScene, type SceneKind } from "./proceduralScene";
import { commonSettings, settingsWithOptions, settingsWithVariants } from "./settings";

function scene(
  id: string,
  title: string,
  key: string,
  originalName: string,
  note: string,
  startLine: number,
  endLine: number,
  kind: SceneKind,
  settings = commonSettings,
): SceneMeta {
  return {
    id,
    title,
    key,
    originalName,
    note,
    settings,
    annotation: {
      file: "VIRT.BAS",
      subroutine: originalName,
      startLine,
      endLine,
    },
    create: () => new ProceduralScene(kind),
  };
}

export const systemScenes: SceneMeta[] = [
  scene("intro", "Intro and Title", "I", "program start", "The opening star field, title data art, and menu identity remade for canvas.", 27, 258, "intro"),
  scene("info", "Info", "N", "INFO", "The old credits chamber, now with readable archive notes beside it.", 1588, 1661, "info"),
  scene("saver", "Screen Savers", "S", "SAVER/SAVER2/SAVER3", "Idle animations from the menus, preserved as standalone scenes.", 2172, 2316, "saver"),
];

export const demoScenes: SceneMeta[] = [
  scene("omega", "Omega Beams", "1", "OMEGA", "Radial beam geometry with density and length controls.", 2069, 2170, "omega", settingsWithOptions({ trail: 0.05 })),
  scene("laser", "Laser Beams", "2", "LASER", "Triangular laser traces driven by speed and color motion.", 1663, 1827, "laser", settingsWithOptions({ trail: 0.05 })),
  scene("craper", "Random Walker", "3", "CRAPER", "Slow random-walk line drawing from the original mode selector.", 1070, 1105, "craper", settingsWithVariants([
    { label: "Original", value: "original", description: "Colorful random-walk line drawing." },
    { label: "Variant 1", value: "dense", description: "Circle traces around the walker." },
    { label: "Variant 2", value: "wide", description: "Box traces around the walker." },
  ])),
  scene("cooler", "Cooler", "4", "COOLER", "Orbiting line structures with two classic motion modes.", 893, 951, "cooler", settingsWithVariants([
    { label: "Original", value: "original", description: "Orbiting line structure." },
    { label: "Variant 1", value: "wide", description: "Contracting spiral line mode." },
  ])),
  scene("cyber", "Cyber Storm", "5", "CYBER", "Tunnel and storm forms pulled from the old custom/random selector.", 1107, 1196, "cyber", settingsWithVariants([
    { label: "Original", value: "original", description: "Central storm tunnel." },
    { label: "Variant 1", value: "wide", description: "Corner-to-center beam traces." },
    { label: "Variant 2", value: "dense", description: "Triangular storm traces." },
  ])),
  scene("delta", "Delta", "6", "DELTA", "Rotating triangular forms and mirrored line fields.", 1198, 1390, "delta", settingsWithVariants([
    { label: "Original", value: "original", description: "Rotating triangular arms." },
    { label: "Variant 1", value: "wide", description: "Wider radius arm motion." },
    { label: "Variant 2", value: "dense", description: "Dense radial line field." },
    { label: "Variant 3", value: "orbit", description: "Orbiting anchor points." },
  ])),
  scene("ball", "Space", "7", "BALL", "The bouncing/orbiting space particle routines grouped under SPACE.", 267, 725, "ball", settingsWithVariants([
    { label: "Original", value: "original", description: "Radiating space particle trails." },
    { label: "Variant 1", value: "dense", description: "More particle trails." },
    { label: "Variant 2", value: "orbit", description: "Orbital point field." },
  ])),
  scene("lines", "Lines", "8", "LINES", "The line experiments, boxes, bounces, and perspective traces.", 1829, 2067, "lines", settingsWithVariants([
    { label: "Original", value: "wide", description: "Single bouncing line mode." },
    { label: "Variant 1", value: "original", description: "Random edge-to-edge line traces." },
    { label: "Variant 2", value: "orbit", description: "Orbital line mode." },
  ], "wide")),
  scene("shella", "Gravity", "A", "SHELLA", "Gravity-style orbiting strokes and multi-arm motion.", 2318, 2510, "shella", settingsWithVariants([
    { label: "Original", value: "original", description: "Three-arm gravity trace." },
    { label: "Variant 1", value: "dense", description: "Nine-arm gravity trace." },
  ])),
  scene("type1", "Warp", "B", "TYPE1", "Concentric warp rings from the original WARP routine.", 3027, 3042, "type1"),
  scene("type2", "Doorway", "C", "TYPE2", "Doorway rectangles that pull the eye into the center.", 3044, 3067, "type2", settingsWithVariants([
    { label: "Original", value: "original", description: "Faithful accumulating TYPE2 line loop." },
    { label: "Variant 1", value: "trail", description: "Smooth fading doorway cloud." },
  ])),
  scene("tunnels", "Bugs and Worms", "D", "TUNNELS", "Tunnel crawlers and worm-like line motion.", 2918, 3025, "tunnels", settingsWithVariants([
    { label: "Original", value: "original", description: "Large-step worm motion." },
    { label: "Variant 1", value: "wide", description: "Small-step worm motion." },
    { label: "Variant 2", value: "dense", description: "Small-step color-cycling motion." },
    { label: "Variant 3", value: "orbit", description: "Diagonal worm motion." },
  ])),
  scene("coolx", "Cool", "E", "COOLX", "Random custom cool-stuff generator remade from the original lissajous and bounce modes.", 953, 1068, "coolx", settingsWithVariants([
    { label: "Original", value: "original", description: "Lissajous point field." },
    { label: "Variant 1", value: "wide", description: "Offset line field." },
    { label: "Variant 2", value: "dense", description: "Circle field." },
  ], "original", { trail: 0, modernLineWidth: 8 })),
  scene("disco", "Morph", "F", "DISCO", "Morphing disco blobs and shifting colorful trails.", 1392, 1563, "disco"),
  scene("spheres", "Spheres", "G", "SPHERES", "Sphere arcs, center points, and orbital shell motion.", 2539, 2605, "spheres"),
  scene("spots", "Spots", "H", "SPOTS", "Spot, box, circle, and floating particle variants.", 2607, 2916, "spots", settingsWithVariants([
    { label: "Original", value: "dense", description: "Expanding spot circles from the original routine." },
    { label: "Variant 1", value: "wide", description: "Circle-and-cross spot field." },
    { label: "Variant 2", value: "original", description: "Vertical spot streaks." },
  ], "dense")),
];

export const scenes = [...systemScenes, ...demoScenes];
export const screensaverScenes = scenes.filter((item) => item.id !== "intro" && item.id !== "info");

export function findScene(id: string | null) {
  return scenes.find((item) => item.id === id) ?? scenes[0];
}

export function findScreensaverScene(id: string | null) {
  return screensaverScenes.find((item) => item.id === id) ?? demoScenes[0];
}

export function findSceneByKey(key: string) {
  return scenes.find((item) => item.key.toLowerCase() === key.toLowerCase());
}
