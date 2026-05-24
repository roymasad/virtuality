import * as THREE from "three";
import type { SceneSettings, ThreeScene, ThreeSceneContext } from "../engine/types";
import { numberSetting, stringSetting } from "./settings";

type DunePalette = {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  fog: string;
  sun: string;
  sand: string[];
  ruin: string;
  trace: string;
};

type FlightPath = {
  x: number;
  z: number;
  lookX: number;
  lookZ: number;
  forwardX: number;
  forwardZ: number;
  rightX: number;
  rightZ: number;
  bank: number;
};

const palettes: Record<string, DunePalette> = {
  dusk: {
    skyTop: "#16092e",
    skyMid: "#633078",
    skyBottom: "#e18a51",
    fog: "#b8614a",
    sun: "#ffd46a",
    sand: ["#3c1f24", "#623022", "#8b4d26", "#b86d2d", "#d99a45", "#ffd77a"],
    ruin: "#18070c",
    trace: "#65e8ff",
  },
  noon: {
    skyTop: "#24518f",
    skyMid: "#4d91bf",
    skyBottom: "#f1b86b",
    fog: "#d69958",
    sun: "#fff2a8",
    sand: ["#5b351e", "#805024", "#a96c2b", "#d08a39", "#e6b35b", "#ffe08a"],
    ruin: "#201008",
    trace: "#b7f6ff",
  },
  night: {
    skyTop: "#05061f",
    skyMid: "#10194a",
    skyBottom: "#5b3565",
    fog: "#4d335f",
    sun: "#ff8a54",
    sand: ["#171424", "#25203a", "#3f2b46", "#64425b", "#95625f", "#d79670"],
    ruin: "#05050a",
    trace: "#78fff0",
  },
};

const terrainWidth = 16000;
const terrainLength = 13000;
const ruinLoopLength = 6200;
const cameraZ = 210;

const ruinPlacements = [
  { lane: -620, offset: 1400, height: 1.04, width: 1.05 },
  { lane: 760, offset: 4550, height: 0.82, width: 0.82 },
];

export class DuneFlyoverScene implements ThreeScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 16 / 10, 0.5, 16000);
  private terrain: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> | null = null;
  private terrainSignature = "";
  private skyTexture: THREE.CanvasTexture | null = null;
  private skyCanvas: HTMLCanvasElement | null = null;
  private skyContext: CanvasRenderingContext2D | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private sunWorld = new THREE.Vector3(-118, 150, 1180);
  private sunScreenX = 0.36;
  private sunScreenY = 0.43;
  private sunAmount = 0.35;
  private sunElevation = 0;
  private sunVisibility = 1;
  private moonVisibility = 0;
  private moonWorld = new THREE.Vector3(380, 260, 1700);
  private moonScreenX = 0.64;
  private moonScreenY = 0.33;
  private nightAmount = 0;
  private starAmount = 0;
  private skyPitchOffset = 0;
  private skyTime = 0;
  private ruins = new THREE.Group();
  private terrainCols = 0;
  private terrainRows = 0;
  private lastRenderWidth = 0;
  private lastRenderHeight = 0;
  private lastPaletteId = "";
  private cameraPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private cameraRoll = 0;
  private cameraReady = false;
  private worldOffset = 0;

  init(canvas: HTMLCanvasElement, ctx: ThreeSceneContext) {
    this.renderer?.dispose();
    this.renderer = null;
    this.resetScene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera.position.set(0, 78, cameraZ);
    this.ambientLight = new THREE.AmbientLight(0xa06658, 0.82);
    this.scene.add(this.ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffd39a, 2.65);
    sunLight.position.set(-82, 118, -760);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.bias = -0.00008;
    sunLight.shadow.normalBias = 0.75;
    sunLight.shadow.camera.left = -2300;
    sunLight.shadow.camera.right = 2300;
    sunLight.shadow.camera.top = 2300;
    sunLight.shadow.camera.bottom = -2300;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 4200;
    this.sunLight = sunLight;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.scene.add(this.ruins);

    this.buildRuins();
    this.resize(ctx);
  }

  resize(ctx: ThreeSceneContext) {
    if (!this.renderer) return;

    const pixelation = numberSetting(ctx.settings, "pixelation", 2);
    const modeScale = ctx.mode === "classic"
      ? clamp((0.56 - pixelation * 0.095) * 1.55, 0.3, 0.58)
      : clamp(1 - Math.max(0, pixelation - 1) * 0.07, 0.66, 1);
    const dpr = ctx.mode === "modern" ? ctx.pixelRatio : 1;
    const renderWidth = Math.max(160, Math.floor(ctx.width * dpr * modeScale));
    const renderHeight = Math.max(100, Math.floor(ctx.height * dpr * modeScale));

    if (renderWidth === this.lastRenderWidth && renderHeight === this.lastRenderHeight) return;

    this.lastRenderWidth = renderWidth;
    this.lastRenderHeight = renderHeight;
    this.renderer.setSize(renderWidth, renderHeight, false);
    this.camera.aspect = renderWidth / renderHeight;
    this.camera.updateProjectionMatrix();
  }

  update(ctx: ThreeSceneContext) {
    const speed = numberSetting(ctx.settings, "speed", 1);
    this.worldOffset += ctx.delta * speed * 56;
    this.skyTime = ctx.time;

    const paletteId = stringSetting(ctx.settings, "palette", "dusk");
    const palette = palettes[paletteId] ?? palettes.dusk;
    if (paletteId !== this.lastPaletteId) {
      this.lastPaletteId = paletteId;
      this.applyPalette(palette);
    }
    this.updateCamera(ctx);
    this.ensureTerrain(ctx, palette);
    this.updateTerrain(ctx.settings, palette);
    this.updateSky(palette);
    this.updateRuins(ctx.settings);
  }

  render() {
    this.renderer?.render(this.scene, this.camera);
  }

  dispose() {
    this.resetScene();
    this.renderer?.dispose();
    this.renderer = null;
  }

  private resetScene() {
    this.disposeTerrain();
    this.disposeRuins();
    this.skyTexture?.dispose();
    this.skyTexture = null;
    this.skyCanvas = null;
    this.skyContext = null;
    this.ambientLight = null;
    this.sunLight = null;
    this.lastPaletteId = "";
    this.lastRenderWidth = 0;
    this.lastRenderHeight = 0;
    this.cameraRoll = 0;
    this.cameraReady = false;
    this.scene.clear();
  }

  private disposeTerrain() {
    if (!this.terrain) return;

    this.scene.remove(this.terrain);
    this.terrain.geometry.dispose();
    this.terrain.material.dispose();
    this.terrain = null;
    this.terrainSignature = "";
    this.terrainCols = 0;
    this.terrainRows = 0;
  }

  private disposeRuins() {
    this.ruins.traverse((item) => {
      const mesh = item as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | undefined;
      material?.dispose?.();
    });
    this.ruins.clear();
  }

  private ensureTerrain(ctx: ThreeSceneContext, palette: DunePalette) {
    const detail = numberSetting(ctx.settings, "terrainDetail", 1);
    const cols = Math.round((ctx.mode === "classic" ? 78 : 118) + detail * (ctx.mode === "classic" ? 18 : 34));
    const rows = Math.round((ctx.mode === "classic" ? 118 : 172) + detail * (ctx.mode === "classic" ? 28 : 46));
    const signature = `${ctx.mode}:${cols}:${rows}`;
    if (signature === this.terrainSignature) return;

    this.disposeTerrain();
    this.terrainSignature = signature;
    this.terrainCols = cols;
    this.terrainRows = rows;

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let zIndex = 0; zIndex <= rows; zIndex += 1) {
      const z = -1200 + (zIndex / rows) * terrainLength;
      for (let xIndex = 0; xIndex <= cols; xIndex += 1) {
        const x = (xIndex / cols - 0.5) * terrainWidth;
        positions.push(x, 0, z);
        colors.push(1, 1, 1);
      }
    }

    for (let zIndex = 0; zIndex < rows; zIndex += 1) {
      for (let xIndex = 0; xIndex < cols; xIndex += 1) {
        const a = zIndex * (cols + 1) + xIndex;
        const b = a + 1;
        const c = a + cols + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geometry.setIndex(indices);
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      fog: true,
      side: THREE.DoubleSide,
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    // The flyover rewrites terrain vertices in world space every frame.
    // A stale bounding sphere can otherwise make Three.js cull the whole desert.
    this.terrain.frustumCulled = false;
    this.scene.add(this.terrain);
    this.updateTerrain(ctx.settings, palette);
  }

  private updateTerrain(settings: SceneSettings, palette: DunePalette) {
    if (!this.terrain) return;

    const positions = this.terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colors = this.terrain.geometry.getAttribute("color") as THREE.BufferAttribute;
    const color = new THREE.Color();
    const nextColor = new THREE.Color();
    const flight = this.flightPath();
    const sandRamp = this.sandRamp(palette);
    const cellWidth = terrainWidth / Math.max(1, this.terrainCols);
    const cellLength = terrainLength / Math.max(1, this.terrainRows);
    const centerX = Math.round(flight.x / cellWidth) * cellWidth;
    const centerZ = Math.round(flight.z / cellLength) * cellLength;

    for (let index = 0; index < positions.count; index += 1) {
      const xIndex = index % (this.terrainCols + 1);
      const zIndex = Math.floor(index / (this.terrainCols + 1));
      const localX = (xIndex / this.terrainCols - 0.5) * terrainWidth;
      const localZ = -1200 + (zIndex / this.terrainRows) * terrainLength;
      const worldX = centerX + localX;
      const worldZ = centerZ + localZ;
      const height = this.sampleHeight(worldX, worldZ, settings);
      positions.setX(index, worldX);
      positions.setY(index, height);
      positions.setZ(index, worldZ);

      const distance = worldZ - flight.z;
      const horizonFade = smoothstep(2500, 11600, distance);
      const nearLight = smoothstep(1000, 120, distance) * 0.03;
      const moonFill = this.nightAmount * this.moonVisibility * 0.24;
      const sunFill = 0.26 + this.sunAmount * 0.28 + moonFill;
      const shade = clamp(sunFill + (height + 30) / 160 - horizonFade * 0.12 + nearLight, 0.1, 0.98);
      const ramp = shade * (sandRamp.length - 1);
      const paletteIndex = Math.floor(ramp);
      color.set(sandRamp[paletteIndex]);
      color.lerp(nextColor.set(sandRamp[paletteIndex + 1]), ramp - paletteIndex);
      colors.setXYZ(index, color.r, color.g, color.b);
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
  }

  private updateCamera(ctx: ThreeSceneContext) {
    const cameraHeight = numberSetting(ctx.settings, "cameraHeight", 1);
    const flight = this.flightPath();
    const crossTrack =
      Math.sin(this.worldOffset * 0.00018 + 1.7) * 42 +
      Math.sin(this.worldOffset * 0.00007 - 0.8) * 24;
    const cameraX = flight.x + flight.rightX * crossTrack;
    const cameraZPosition = flight.z - 96;
    const ground =
      this.sampleHeight(cameraX, cameraZPosition + 120, ctx.settings) * 0.5 +
      this.sampleHeight(flight.lookX, flight.z + 920, ctx.settings) * 0.25 +
      this.sampleHeight(cameraX + flight.rightX * 520, cameraZPosition + 520, ctx.settings) * 0.125 +
      this.sampleHeight(cameraX - flight.rightX * 520, cameraZPosition + 520, ctx.settings) * 0.125;
    const lookGround = this.sampleHeight(flight.lookX, flight.lookZ, ctx.settings);
    const thermalLift =
      Math.sin(this.worldOffset * 0.00012 + 1.3) * 11 +
      Math.sin(this.worldOffset * 0.00028 - 0.2) * 5;
    const y = ground + 126 + cameraHeight * 42 + thermalLift;
    const lookSide =
      (flight.lookX - flight.x) * 0.2 -
      crossTrack * 0.12 +
      Math.sin(this.worldOffset * 0.00015 + 0.6) * 22;
    const lookX = flight.lookX + flight.rightX * lookSide;
    const lookZ = flight.lookZ + flight.rightZ * lookSide;
    const lookY = lookGround + 14 - Math.abs(flight.bank) * 8;
    const desiredPosition = new THREE.Vector3(cameraX, y, cameraZPosition);
    const desiredTarget = new THREE.Vector3(lookX, lookY, lookZ);
    const positionEase = dampFactor(ctx.delta, 2.25);
    const targetEase = dampFactor(ctx.delta, 1.85);
    const rollEase = dampFactor(ctx.delta, 2.8);
    const desiredRoll = clamp(flight.bank * 0.055 + crossTrack * 0.000025, -0.055, 0.055);

    if (!this.cameraReady) {
      this.cameraPosition.copy(desiredPosition);
      this.cameraTarget.copy(desiredTarget);
      this.cameraRoll = desiredRoll;
      this.cameraReady = true;
    } else {
      this.cameraPosition.lerp(desiredPosition, positionEase);
      this.cameraTarget.lerp(desiredTarget, targetEase);
      this.cameraRoll += (desiredRoll - this.cameraRoll) * rollEase;
    }

    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
    this.camera.rotation.z += this.cameraRoll;
    const lookDistance = Math.hypot(
      this.cameraTarget.x - this.cameraPosition.x,
      this.cameraTarget.z - this.cameraPosition.z,
    ) || 1;
    const lookPitch = this.cameraTarget.y - this.cameraPosition.y;
    this.skyPitchOffset = clamp(Math.atan2(lookPitch, lookDistance) * 0.9, -0.16, 0.16);
    this.updateSun(ctx);
  }

  private updateRuins(settings: SceneSettings) {
    const palette = palettes[this.lastPaletteId] ?? palettes.dusk;
    const nightStone = "#07070c";
    const twilightStone = "#211817";
    const dayStone = "#34312d";
    const ruinColor = mixHex(mixHex(nightStone, twilightStone, 1 - this.nightAmount), dayStone, this.sunAmount * 0.72);
    const flight = this.flightPath();
    this.ruins.children.forEach((child, index) => {
      const placement = ruinPlacements[index % ruinPlacements.length];
      const cycle = Math.floor((flight.z + 5200 - placement.offset) / ruinLoopLength);
      const seed = cycle * 23.41 + index * 19.17 + 4.2;
      const worldZ = cycle * ruinLoopLength + placement.offset;
      const worldX = placement.lane + (hash(seed) - 0.5) * 360;
      const scaleY = placement.height + hash(seed + 8) * 0.18;
      child.position.set(worldX, this.sampleHeight(worldX, worldZ, settings) + 14 * scaleY - 0.4, worldZ);
      child.scale.set(placement.width + hash(seed + 3) * 0.16, scaleY, 0.85 + hash(seed + 6) * 0.2);
      child.traverse((item) => {
        const mesh = item as THREE.Mesh;
        const material = mesh.material as THREE.MeshLambertMaterial | undefined;
        material?.color?.set(ruinColor);
      });
    });
    this.ruins.updateMatrixWorld(true);
    this.terrain?.updateMatrixWorld(true);
    if (this.sunLight) {
      this.sunLight.shadow.needsUpdate = true;
    }
  }

  private sandRamp(palette: DunePalette) {
    return palette.sand.map((base, index) => {
      const nightColor = palettes.night.sand[index] ?? palettes.night.sand[palettes.night.sand.length - 1];
      const dayColor = palettes.noon.sand[index] ?? palettes.noon.sand[palettes.noon.sand.length - 1];
      const twilightColor = palettes.dusk.sand[index] ?? palettes.dusk.sand[palettes.dusk.sand.length - 1];
      const nightMixed = mixHex(base, nightColor, this.nightAmount * 0.72);
      const twilightMixed = mixHex(nightMixed, twilightColor, (1 - this.sunAmount) * (1 - this.nightAmount) * 0.42);
      return mixHex(twilightMixed, dayColor, this.sunAmount * 0.58);
    });
  }

  private sampleHeight(x: number, z: number, settings: SceneSettings) {
    const duneScale = numberSetting(settings, "duneScale", 1);
    const scale = clamp(duneScale, 0.45, 2.2);
    const windX = x + Math.sin(z * 0.00036) * 230 * scale + Math.sin(z * 0.00011 + 2.4) * 320 * scale;
    const windZ = z + Math.sin(x * 0.00024 + z * 0.00013) * 140 * scale;
    const transverse = this.transverseDunes(windX, windZ, scale);
    const barchan = this.crescentDunes(windX, windZ, scale);
    const rippleMask = smoothstep(12, 38, transverse + barchan + 8);
    const ripples =
      Math.sin(windZ * 0.033 / scale + windX * 0.009 + Math.sin(windX * 0.0024) * 1.1) * 0.7;
    const lowRelief =
      Math.sin((windX * 0.0011 + windZ * 0.0014) / scale) * 11 +
      Math.sin((windX * -0.0008 + windZ * 0.0011) / scale + 1.7) * 7;
    return transverse + barchan + ripples * rippleMask + lowRelief - 42;
  }

  private transverseDunes(x: number, z: number, scale: number) {
    const spacing = 780 * scale;
    const axisWarp = Math.sin(x * 0.00072 + z * 0.00018) * 220 * scale + Math.sin(x * 0.00155) * 105 * scale;
    const phase = fract((z + axisWarp) / spacing);
    const windward = smoothstep(0.1, 0.72, phase);
    const lee = 1 - smoothstep(0.72, 0.9, phase);
    const crest = Math.pow(Math.max(0, 1 - Math.abs(phase - 0.72) / 0.16), 2.1);
    const broken = 0.78 + Math.sin(x * 0.00054 + z * 0.00025) * 0.16;
    return (windward * lee * 32 + crest * 9) * broken;
  }

  private crescentDunes(x: number, z: number, scale: number) {
    const spacing = 1420 * scale;
    const lane = Math.sin(x * 0.00072 + Math.sin(z * 0.00019) * 1.15);
    const phase = fract((z + lane * 190 * scale) / spacing);
    const center = phase - 0.52;
    const body = Math.exp(-(center * center * 16));
    const hornSpread = Math.abs(Math.sin(x * 0.00138 + z * 0.00022));
    const horns = Math.exp(-Math.pow(hornSpread - 0.72, 2) * 14) * Math.exp(-Math.pow(phase - 0.66, 2) * 16);
    const hollow = Math.exp(-Math.pow(hornSpread, 2) * 7) * Math.exp(-Math.pow(phase - 0.69, 2) * 16);
    return body * 14 + horns * 7 - hollow * 5;
  }

  private applyPalette(palette: DunePalette) {
    const sky = this.createSkyTexture(palette);
    this.scene.fog = new THREE.Fog(palette.fog, 2400, 10400);
    this.scene.background = sky;
    if (this.sunLight) this.sunLight.color.set(palette.sun);
  }

  private createSkyTexture(palette: DunePalette) {
    this.skyTexture?.dispose();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create dune sky texture");

    this.skyCanvas = canvas;
    this.skyContext = ctx;
    this.drawSkyTexture(palette, canvas.width * 0.36, canvas.height * 0.43);

    this.skyTexture = new THREE.CanvasTexture(canvas);
    this.skyTexture.magFilter = THREE.LinearFilter;
    this.skyTexture.minFilter = THREE.LinearFilter;
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    return this.skyTexture;
  }

  private updateSky(palette: DunePalette) {
    if (!this.skyTexture || !this.skyCanvas || !this.skyContext) return;

    const sunX = this.sunScreenX * this.skyCanvas.width;
    const skyShift = this.skyPitchOffset * this.skyCanvas.height;
    const sunY = this.sunScreenY * this.skyCanvas.height + skyShift;
    const moonX = this.moonScreenX * this.skyCanvas.width;
    const moonY = this.moonScreenY * this.skyCanvas.height + skyShift;
    this.drawSkyTexture(palette, sunX, sunY, moonX, moonY);
    this.skyTexture.needsUpdate = true;
  }

  private drawSkyTexture(palette: DunePalette, sunX: number, sunY: number, moonX = 0, moonY = 0) {
    const canvas = this.skyCanvas;
    const ctx = this.skyContext;
    if (!canvas || !ctx) return;

    const h = canvas.height;
    const w = canvas.width;
    const skyShift = this.skyPitchOffset * h;
    const day = this.sunAmount;
    const night = this.nightAmount;
    const twilight = clamp(1 - day - night * 0.6, 0, 1);
    const horizonWarmth = twilight * 0.35 + this.sunVisibility * 0.16;
    const gradient = ctx.createLinearGradient(0, -skyShift * 0.6, 0, canvas.height - skyShift * 0.35);
    gradient.addColorStop(0, mixHex(mixHex("#05071f", "#21113e", twilight), "#55aee4", day * 0.74));
    gradient.addColorStop(0.46, mixHex(mixHex("#101640", "#60306c", twilight), "#9bd7f1", day * 0.5));
    gradient.addColorStop(0.82, mixHex(mixHex("#2d2148", "#d66f50", horizonWarmth), "#dda77a", day * 0.18));
    gradient.addColorStop(1, mixHex(mixHex("#34213e", palette.fog, twilight), "#d09266", day * 0.16));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.starAmount > 0.01) {
      for (let index = 0; index < 95; index += 1) {
        const x = hash(index * 8.31 + 0.7) * w;
        const y = hash(index * 13.73 + 2.4) * h * 0.58 + skyShift;
        const size = hash(index * 17.19 + 4.1) > 0.83 ? 2 : 1;
        const phase = hash(index * 21.11 + 6.8) * Math.PI * 2;
        const rate = 1.2 + hash(index * 4.37 + 9.1) * 2.2;
        const twinkle = 0.42 + Math.sin(this.skyTime * rate + phase) * 0.28 + Math.sin(this.skyTime * rate * 0.37 + phase * 1.7) * 0.16;
        const alpha = clamp(this.starAmount * twinkle, 0.08, 0.86);
        ctx.fillStyle = `rgba(245, 239, 205, ${alpha})`;
        ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
      }
    }

    if (this.moonVisibility > 0.01) {
      const moonGlow = ctx.createRadialGradient(moonX, moonY, h * 0.012, moonX, moonY, h * 0.19);
      moonGlow.addColorStop(0, `rgba(204, 221, 255, ${0.12 * this.moonVisibility})`);
      moonGlow.addColorStop(1, "rgba(110, 138, 220, 0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = this.moonVisibility;
      ctx.fillStyle = "#d8e2ff";
      ctx.beginPath();
      ctx.arc(moonX, moonY, h * 0.027, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(114, 130, 180, 0.22)";
      ctx.fillRect(Math.floor(moonX - h * 0.01), Math.floor(moonY + h * 0.005), 2, 2);
      ctx.fillRect(Math.floor(moonX + h * 0.008), Math.floor(moonY - h * 0.01), 1, 1);
      ctx.globalAlpha = 1;
    }

    const atmosphere = ctx.createLinearGradient(0, h * 0.4 + skyShift, 0, h + skyShift);
    atmosphere.addColorStop(0, "rgba(255, 209, 124, 0)");
    atmosphere.addColorStop(0.56, `rgba(255, 176, 96, ${0.08 + twilight * 0.18})`);
    atmosphere.addColorStop(1, `rgba(255, 127, 74, ${0.06 + twilight * 0.14})`);
    ctx.fillStyle = atmosphere;
    ctx.fillRect(0, h * 0.3 + skyShift, w, h * 0.7);

    const sunAlpha = this.sunVisibility;
    if (sunAlpha > 0.01) {
      const sunRadius = h * 0.038 * (1 - day * 0.15);
      const sunAura = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.85, sunX, sunY, h * (0.34 + twilight * 0.18));
      sunAura.addColorStop(0, `rgba(255, 220, 128, ${0.12 * sunAlpha})`);
      sunAura.addColorStop(0.38, `rgba(255, 190, 96, ${0.07 * sunAlpha})`);
      sunAura.addColorStop(1, "rgba(255, 190, 96, 0)");
      ctx.fillStyle = sunAura;
      ctx.fillRect(0, 0, w, h);

      const sunCore = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.18, sunX, sunY, sunRadius * 1.55);
      sunCore.addColorStop(0, `rgba(255, 242, 178, ${0.92 * sunAlpha})`);
      sunCore.addColorStop(0.58, `rgba(255, 214, 105, ${0.76 * sunAlpha})`);
      sunCore.addColorStop(0.9, `rgba(255, 196, 92, ${0.22 * sunAlpha})`);
      sunCore.addColorStop(1, "rgba(255, 196, 92, 0)");
      ctx.fillStyle = sunCore;
      ctx.fillRect(sunX - sunRadius * 1.9, sunY - sunRadius * 1.9, sunRadius * 3.8, sunRadius * 3.8);
    }

    const horizon = ctx.createLinearGradient(0, h * 0.6 + skyShift, 0, h * 0.84 + skyShift);
    horizon.addColorStop(0, "rgba(255, 219, 132, 0)");
    horizon.addColorStop(0.55, `rgba(255, 184, 103, ${0.08 + twilight * 0.26})`);
    horizon.addColorStop(1, "rgba(86, 40, 76, 0)");
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.55 + skyShift, w, h * 0.36);
  }

  private buildRuins() {
    for (let index = 0; index < ruinPlacements.length; index += 1) {
      const group = new THREE.Group();
      const towerMaterial = new THREE.MeshLambertMaterial({ color: palettes.dusk.ruin, flatShading: true, fog: true });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 42, 10, 1, 1, 1), towerMaterial);
      tower.position.set(0, 7, 0);
      tower.rotation.z = index === 0 ? -0.04 : 0.05;
      tower.castShadow = true;
      tower.receiveShadow = false;
      group.add(tower);
      group.rotation.y = 0;
      this.ruins.add(group);
    }
  }

  private updateSun(ctx: ThreeSceneContext) {
    const flight = this.flightPath();
    const cyclePhase = positiveModulo(ctx.time * 0.052, Math.PI * 2);
    this.sunElevation = Math.sin(cyclePhase);
    this.sunAmount = smoothstep(-0.08, 0.55, this.sunElevation);
    this.sunVisibility = smoothstep(-0.08, 0.08, this.sunElevation);
    this.nightAmount = 1 - smoothstep(-0.32, 0.12, this.sunElevation);
    this.starAmount = 1 - smoothstep(-0.26, 0.04, this.sunElevation);
    const sunProgress = clamp(cyclePhase / Math.PI, 0, 1);
    this.sunScreenX = 0.12 + sunProgress * 0.76;
    this.sunScreenY = 0.67 - Math.max(0, this.sunElevation) * 0.5;
    const sunX = flight.x + (sunProgress - 0.5) * 1200;
    const sunY = 28 + this.sunElevation * 420;
    const sunZ = flight.z + 1800;
    const moonElevation = -this.sunElevation;
    const moonPhase = positiveModulo(cyclePhase - Math.PI, Math.PI * 2);
    const moonProgress = clamp(moonPhase / Math.PI, 0, 1);
    this.moonVisibility = smoothstep(0.05, 0.28, moonElevation);
    this.moonScreenX = 0.12 + moonProgress * 0.76;
    this.moonScreenY = 0.66 - Math.max(0, moonElevation) * 0.46;
    const moonX = flight.x + (moonProgress - 0.5) * 980;
    const moonY = 92 + moonElevation * 310;
    const moonZ = flight.z + 1720;
    this.sunWorld.set(sunX, sunY, sunZ);
    this.moonWorld.set(moonX, moonY, moonZ);
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.48 + this.sunAmount * 0.62 + this.moonVisibility * this.nightAmount * 0.36;
      this.ambientLight.color.set(mixHex(mixHex("#46588e", "#a76755", 1 - this.nightAmount), "#db9d72", this.sunAmount));
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.set(mixHex(mixHex("#241b3e", "#a94b3d", 1 - this.nightAmount), "#c77754", this.sunAmount));
    }
    if (this.sunLight) {
      if (this.sunVisibility > 0.02 || this.sunAmount > this.moonVisibility * 0.72) {
        this.sunLight.position.set(sunX, Math.max(90, sunY), sunZ);
      } else {
        this.sunLight.position.set(moonX, Math.max(120, moonY), moonZ);
      }
      this.sunLight.target.position.set(flight.x, -12, flight.z + 420);
      this.sunLight.intensity = 0.16 + this.sunAmount * 3.15 + this.moonVisibility * this.nightAmount * 0.92;
      this.sunLight.color.set(mixHex("#b7c9ff", mixHex("#ff9f69", "#ffe0a5", this.sunAmount), 1 - this.nightAmount * 0.78));
      this.sunLight.target.updateMatrix();
      this.sunLight.updateMatrix();
      this.sunLight.updateMatrixWorld();
      this.sunLight.target.updateMatrixWorld();
      this.sunLight.shadow.camera.updateMatrixWorld();
      this.sunLight.shadow.camera.updateProjectionMatrix();
      this.sunLight.shadow.needsUpdate = true;
      this.renderer!.shadowMap.needsUpdate = true;
    }
  }

  private flightPath(): FlightPath {
    const z = this.worldOffset;
    const t = z * 0.00025;
    const x = this.pathX(t);
    const lookDistance = 1720 + Math.sin(t * 0.58 + 0.5) * 150;
    const lookZ = z + lookDistance;
    const lookT = lookZ * 0.00025;
    const lookX = this.pathX(lookT) + Math.sin(t * 0.5 + 1.1) * 32;
    const dx = lookX - x;
    const dz = lookZ - z;
    const length = Math.hypot(dx, dz) || 1;
    const forwardX = dx / length;
    const forwardZ = dz / length;
    return {
      x,
      z,
      lookX,
      lookZ,
      forwardX,
      forwardZ,
      rightX: forwardZ,
      rightZ: -forwardX,
      bank: clamp((lookX - x) / 1800 + Math.cos(t * 0.45 + 0.2) * 0.045, -1, 1),
    };
  }

  private pathX(t: number) {
    return (
      Math.sin(t) * 380 +
      Math.sin(t * 0.41 + 1.8) * 160 +
      Math.sin(t * 1.07 + 0.4) * 42
    );
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fract(value: number) {
  return value - Math.floor(value);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function dampFactor(delta: number, smoothing: number) {
  return 1 - Math.exp(-Math.max(0, delta) * smoothing);
}

function mixHex(from: string, to: string, amount: number) {
  return new THREE.Color(from).lerp(new THREE.Color(to), clamp(amount, 0, 1)).getStyle();
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash(value: number) {
  const raw = Math.sin(value * 127.1) * 43758.5453;
  return raw - Math.floor(raw);
}
