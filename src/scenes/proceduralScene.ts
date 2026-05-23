import { createDrawApi } from "../engine/draw";
import type { DrawApi, Scene, SceneContext } from "../engine/types";
import { originalData } from "../data/originalData";
import { numberSetting, stringSetting } from "./settings";

export type SceneKind =
  | "intro"
  | "info"
  | "saver"
  | "omega"
  | "laser"
  | "craper"
  | "cooler"
  | "cyber"
  | "delta"
  | "ball"
  | "lines"
  | "shella"
  | "type1"
  | "type2"
  | "tunnels"
  | "coolx"
  | "disco"
  | "spheres"
  | "spots";

type Point = { x: number; y: number };
type MovingPoint = Point & { dx: number; dy: number; color: number };
type InfoParticle = Point & { phase: number; speed: number };
type WalkerState = { x: number; y: number; color: number; tick: number };
type WormState = Point & { color: number };
type DoorwayState = {
  r: number;
  r2: number;
  r1: number;
  r21: number;
  g: number;
  color: number;
  tick: number;
  lineDebt: number;
};

const LW = 320;
const LH = 200;

export class ProceduralScene implements Scene {
  private stars = makeStars(300);
  private movers = makeMovers(120);
  private dots = makeDots(180);
  private infoParticles = makeInfoParticles(150);
  private craperWalker: WalkerState = { x: 160, y: 100, color: 20, tick: 0 };
  private wormPoints = makeWormPoints(100);
  private doorway = makeDoorwayState();
  private coolBuffer: HTMLCanvasElement | null = null;
  private coolBufferVariant = "";
  private menuNoise = makeMenuNoise();
  private lastMode = "";
  private lastKind = "";
  private noiseTick = 0;

  constructor(private readonly kind: SceneKind) {}

  render(draw: DrawApi, scene: SceneContext) {
    const speed = numberSetting(scene.settings, "speed", 1);
    const density = numberSetting(scene.settings, "density", 1);
    const trail = numberSetting(scene.settings, "trail", 0.35);
    const variant = stringSetting(scene.settings, "variant", "original");
    const modern = scene.mode === "modern";
    const rawTime = scene.time * speed;
    const t = this.kind === "intro" || this.kind === "info" ? Math.floor(rawTime * 30) / 30 : rawTime;
    const g = geo(draw);
    const shouldClear = this.lastMode !== scene.mode || this.lastKind !== this.kind;
    this.lastMode = scene.mode;
    this.lastKind = this.kind;

    if (this.kind === "intro") {
      draw.cls(0);
      this.drawMainMenu(draw, scene, t, modern, g);
      return;
    }

    if (shouldClear) {
      this.resetSceneState();
      draw.cls(0);
    }
    else draw.cls(0, clearAlphaForScene(this.kind, trail, modern));

    switch (this.kind) {
      case "info":
        this.drawInfo(draw, t, modern, g);
        break;
      case "saver":
        this.drawSaver(draw, t, density, modern, g);
        break;
      case "omega":
        this.drawOmega(draw, t, density, modern, g);
        break;
      case "laser":
        this.drawLaser(draw, t, density, modern, g);
        break;
      case "craper":
        this.drawCraper(draw, t, density, modern, g, variant);
        break;
      case "cooler":
        this.drawCooler(draw, t, density, modern, g, variant);
        break;
      case "cyber":
        this.drawCyber(draw, t, density, modern, g, variant);
        break;
      case "delta":
        this.drawDelta(draw, t, density, modern, g, variant);
        break;
      case "ball":
        this.drawBall(draw, t, density, modern, g, variant);
        break;
      case "lines":
        this.drawLines(draw, t, density, modern, g, variant);
        break;
      case "shella":
        this.drawShella(draw, t, density, modern, g, variant);
        break;
      case "type1":
        this.drawType1(draw, t, density, modern, g);
        break;
      case "type2":
        this.drawType2(draw, t, scene.delta * speed, density, modern, g, variant);
        break;
      case "tunnels":
        this.drawTunnels(draw, t, density, modern, g, variant);
        break;
      case "coolx":
        this.drawCoolX(draw, t, density, trail, modern, g, variant);
        break;
      case "disco":
        this.drawDisco(draw, t, density, modern, g);
        break;
      case "spheres":
        this.drawSpheres(draw, t, density, modern, g);
        break;
      case "spots":
        this.drawSpots(draw, t, density, modern, g, variant);
        break;
    }
  }

  private resetSceneState() {
    this.craperWalker = { x: 160, y: 100, color: 20, tick: 0 };
    this.wormPoints = makeWormPoints(140);
    this.doorway = makeDoorwayState();
    this.coolBuffer = null;
    this.coolBufferVariant = "";
  }

  update(draw: DrawApi, scene: SceneContext) {
    if (this.kind !== "intro" || !scene.input.pointer.justPressed) return;
    const g = geo(draw);
    const x = scene.input.pointer.x / g.sx;
    const y = scene.input.pointer.y / g.sy;
    if (inRect({ x, y }, 24, 134, 92, 30)) scene.action?.("open-info");
    if (inRect({ x, y }, 98, 72, 124, 54)) scene.action?.("open-gallery");
    if (inRect({ x, y }, 204, 136, 88, 32)) scene.action?.("open-gallery");
  }

  private drawMainMenu(draw: DrawApi, scene: SceneContext, t: number, modern: boolean, g: Geometry) {
    const pointer = {
      x: scene.input.pointer.x / g.sx,
      y: scene.input.pointer.y / g.sy,
    };
    const hoverInfo = inRect(pointer, 24, 134, 92, 30);
    const hoverExit = inRect(pointer, 204, 136, 88, 32);

    this.drawStars(draw, g, 300, false);

    // Lines 148-173 in VIRT.BAS construct the gray title shadow only.
    const firstPass = originalData.DATA.slice(0, 465);
    const secondPass = originalData.DATA.slice(465, 844).reverse();
    firstPass.forEach((point, index) => this.drawTitleShadowLine(draw, g, point, index, false, modern));
    secondPass.forEach((point, index) => this.drawTitleShadowLine(draw, g, point, index, true, modern));
    this.drawPointText(draw, originalData.DATA, g, 0, -50, 10, modern ? 2 : 1, false);

    let oo = 30;
    oo = this.drawMenuWord(draw, originalData.DATA2, g, 10, 0, oo, modern);
    oo = this.drawMenuWord(draw, originalData.DATA3, g, 100, 50, oo, modern);
    this.drawMenuWord(draw, originalData.DATA4, g, -100, 50, oo, modern);
    this.drawByline(draw, g, modern);

    this.drawNoiseBox(draw, t, g, modern);
    const selection = hoverInfo
      ? { x: 60, y: 150 }
      : hoverExit
        ? { x: 250, y: 150 }
        : { x: 160, y: 95 };
    const selectorColor = 20 + ((t * 18) % 10);
    this.ellipse(draw, g.x(selection.x), g.y(selection.y), g.w(61), g.h(36.6), selectorColor, modern ? 2 : 1, 1);
  }

  private drawStars(draw: DrawApi, g: Geometry, count: number, bright: boolean) {
    for (let index = 0; index < count; index += 1) {
      const star = this.stars[index % this.stars.length];
      const size = g.pixel(1);
      draw.pset(g.x(star.x * LW), g.y(star.y * LH), bright ? 18 + index * 0.03 : 7, size);
    }
  }

  private drawTitleShadowLine(
    draw: DrawApi,
    g: Geometry,
    point: Point,
    index: number,
    reversePass: boolean,
    modern: boolean,
  ) {
    const color = reversePass ? 25.51 - (index + 1) * 0.01 : 19 + (index + 1) * 0.007;
    const x = reversePass ? point.x - 1 : point.x;
    const y = reversePass ? point.y + 1 : point.y;
    this.pixelLine(
      draw,
      g.x(160),
      g.y(70),
      g.x(x),
      g.y(y - 50),
      color,
      modern ? 1.6 : 1,
      modern,
    );
  }

  private drawMenuWord(
    draw: DrawApi,
    points: Point[],
    g: Geometry,
    offsetX: number,
    offsetY: number,
    startColor: number,
    modern: boolean,
  ) {
    let color = startColor;
    for (const point of points) {
      color += 0.1;
      this.pixelLine(
        draw,
        g.x(point.x + offsetX),
        g.y(point.y + offsetY),
        g.x(point.x + offsetX + 3),
        g.y(point.y + offsetY + 3),
        color,
        modern ? 2.2 : 1,
        modern,
      );
    }
    return color;
  }

  private drawByline(draw: DrawApi, g: Geometry, modern: boolean) {
    let color = 35;
    for (const point of originalData.DATA5) {
      color += 0.1;
      draw.pset(g.x(point.x + 20), g.y(point.y + 100), color, modern ? g.pixel(1.4) : 1);
    }
  }

  private drawPointText(
    draw: DrawApi,
    points: Point[],
    g: Geometry,
    offsetX: number,
    offsetY: number,
    color: number,
    size: number,
    gradient: boolean,
  ) {
    points.forEach((point, index) => {
      draw.pset(
        g.x(point.x + offsetX),
        g.y(point.y + offsetY),
        gradient ? color + index * 0.08 : color,
        g.pixel(size),
      );
    });
  }

  private drawNoiseBox(draw: DrawApi, t: number, g: Geometry, modern: boolean) {
    draw.box(g.x(130), g.y(120), g.w(52), g.h(52), 0, true);
    draw.box(g.x(131), g.y(121), g.w(49), g.h(49), 10, false);
    const tick = Math.floor(t * 30);
    if (tick !== this.noiseTick) this.noiseTick = tick;
    const phase = tick % 16;
    for (let y = 1; y <= 48; y += 1) {
      for (let x = 1; x <= 48; x += 1) {
        const value = 16 + ((this.menuNoise[y * 48 + x] + phase) % 16);
        draw.pset(g.x(131 + x), g.y(121 + y), value, modern ? g.pixel(1.15) : 1);
      }
    }
  }

  private drawInfo(draw: DrawApi, t: number, modern: boolean, g: Geometry) {
    this.drawInfoTitle(draw, g, modern);
    this.drawInfoParticles(draw, t, g, modern);

    const col = Math.floor(t * 70) % 500;
    for (let x = 1; x <= 35; x += 1) {
      this.pixelBox(draw, g.x(85 + x), g.y(35 + x), g.x(225 - x), g.y(175 - x), x + col, modern);
    }

    const coc = 24 + Math.sin(t * 3.6) * 7;
    this.drawInfoCredits(draw, g, coc, modern);
  }

  private drawInfoCredits(draw: DrawApi, g: Geometry, color: number, modern: boolean) {
    if (modern) {
      draw.ctx.save();
      draw.ctx.scale(g.sx, g.sy);
    }

    draw.locateText(11, 18, "CODED", color, 1);
    draw.locateText(13, 20, "B", color, 1);
    draw.locateText(14, 20, "Y", color, 1);
    draw.locateText(16, 19, "ROY", color, 1);

    if (modern) draw.ctx.restore();
  }

  private drawInfoTitle(draw: DrawApi, g: Geometry, modern: boolean) {
    let phase = 0;
    let color = 20;
    for (const point of originalData.DATA) {
      phase += 0.1;
      color += 0.1;
      const x = point.x / 2 + Math.cos(phase) * 2 + 80;
      const y = point.y / 2 + Math.sin(phase) * 2 - 30;
      draw.pset(g.x(x), g.y(y), color, modern ? g.pixel(1.7) : 1);
    }
  }

  private drawInfoParticles(draw: DrawApi, t: number, g: Geometry, modern: boolean) {
    this.infoParticles.forEach((particle) => {
      if (particle.x > 85 && particle.x < 225 && particle.y > 35 && particle.y < 175) return;
      const color = 25 + Math.sin(t * particle.speed + particle.phase) * 5;
      draw.pset(g.x(particle.x), g.y(particle.y), color, g.pixel(1));
    });
  }

  private drawSaver(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry) {
    const count = Math.floor(50 * density);
    for (let i = 0; i < count; i += 1) {
      const m = this.movers[i];
      const x = bounce(m.x + t * 25 * m.dx, LW);
      const y = bounce(m.y + t * 18 * m.dy, LH);
      const r1 = Math.cos(t * 4 + i) * 15;
      const r2 = Math.sin(t * 4 + i) * 15;
      if (i % 3 === 0) draw.line(g.x(x + r1), g.y(y + r2), g.x(LW / 2), g.y(LH / 2), 40 + i, modern ? 1.4 : 1, modern ? 0.7 : 1);
      else draw.pset(g.x(x), g.y(y), 20 + i, g.pixel(modern ? 2 : 1));
    }
  }

  private drawOmega(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry) {
    const len = 200;
    const step = Math.max(5, Math.floor(24 / density));
    const vertices = triangleBounce(t, 0.25, 0.55, 0.74);
    for (let h = 0; h < len; h += step) {
      const old = triangleBounce(t - h * 0.02, 0.25, 0.55, 0.74);
      draw.line(g.x(old[0].x), g.y(old[0].y), g.x(old[1].x), g.y(old[1].y), 18 + h * 0.12, modern ? 1.2 : 1, modern ? 0.35 : 0.75);
      draw.line(g.x(old[1].x), g.y(old[1].y), g.x(old[2].x), g.y(old[2].y), 19 + h * 0.12, modern ? 1.2 : 1, modern ? 0.35 : 0.75);
      draw.line(g.x(old[2].x), g.y(old[2].y), g.x(old[0].x), g.y(old[0].y), 20 + h * 0.12, modern ? 1.2 : 1, modern ? 0.35 : 0.75);
    }
    draw.line(g.x(vertices[0].x), g.y(vertices[0].y), g.x(vertices[1].x), g.y(vertices[1].y), 30, modern ? 2 : 1);
    draw.line(g.x(vertices[1].x), g.y(vertices[1].y), g.x(vertices[2].x), g.y(vertices[2].y), 33, modern ? 2 : 1);
    draw.line(g.x(vertices[2].x), g.y(vertices[2].y), g.x(vertices[0].x), g.y(vertices[0].y), 36, modern ? 2 : 1);
  }

  private drawLaser(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry) {
    this.drawStars(draw, g, 200, true);
    const a = triangleBounce(t * 1.5, 1.2, 0.8, 1.7);
    const b = triangleBounce(t * 0.9 + 80, 0.5, 1.7, 1.1);
    const offsets = [0, -5, -9];
    offsets.forEach((off, idx) => {
      draw.line(g.x(a[0].x + off), g.y(a[0].y + off), g.x(b[0].x + off), g.y(b[0].y + off), 25 + t * 12 + idx, modern ? 1.6 : 1);
      draw.line(g.x(a[1].x + off), g.y(a[1].y + off), g.x(b[1].x + off), g.y(b[1].y + off), 28 + t * 12 + idx, modern ? 1.6 : 1);
      draw.line(g.x(a[2].x + off), g.y(a[2].y + off), g.x(b[2].x + off), g.y(b[2].y + off), 31 + t * 12 + idx, modern ? 1.6 : 1);
      draw.line(g.x(a[0].x + off), g.y(a[0].y + off), g.x(a[1].x + off), g.y(a[1].y + off), 18 + t * 12 + idx, modern ? 1.3 : 1);
      draw.line(g.x(a[1].x + off), g.y(a[1].y + off), g.x(a[2].x + off), g.y(a[2].y + off), 21 + t * 12 + idx, modern ? 1.3 : 1);
      draw.line(g.x(a[2].x + off), g.y(a[2].y + off), g.x(a[0].x + off), g.y(a[0].y + off), 24 + t * 12 + idx, modern ? 1.3 : 1);
    });
  }

  private drawCraper(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    const steps = Math.max(4, Math.floor(14 * density));
    for (let step = 0; step < steps; step += 1) {
      const seed = this.craperWalker.tick * 7 + step;
      const angle = (Math.floor(rand(seed) * 63) + 1) / 10;
      const length = Math.floor(rand(seed + 3) * 15) + 1;
      const nx = this.craperWalker.x + Math.cos(angle) * length;
      const ny = this.craperWalker.y + Math.sin(angle) * length;
      const color = this.craperWalker.color;

      if (variant === "dense") {
        for (let radius = 1; radius <= 10; radius += 1) draw.circle(g.x(this.craperWalker.x), g.y(this.craperWalker.y), g.w(radius), color + radius, false, modern ? 0.35 : 0.75);
      } else if (variant === "wide") {
        draw.box(g.x(this.craperWalker.x - 5), g.y(this.craperWalker.y - 5), g.w(10), g.h(10), color, false, modern ? 0.55 : 1);
      } else {
        draw.line(g.x(this.craperWalker.x), g.y(this.craperWalker.y), g.x(nx), g.y(ny), color, modern ? 1.2 : 1, modern ? 0.75 : 1);
      }

      this.craperWalker.x = nx < 0 || nx > LW ? 160 : nx;
      this.craperWalker.y = ny < 0 || ny > LH ? 100 : ny;
      this.craperWalker.color = this.craperWalker.color > 300 ? 20 : this.craperWalker.color + 0.01;
      this.craperWalker.tick += 1;
    }
  }

  private drawCooler(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    const mode2 = variant === "wide";
    if (mode2) {
      let radius = 150 - ((t * 45) % 350);
      for (let k = 0; k < 38 * density; k += 1) {
        const a = t * 4 + k * 2;
        radius -= 1.2;
        draw.line(g.x(150 + Math.cos(a) * radius), g.y(100 + Math.sin(a) * radius), g.x(150 + Math.cos(a + 1) * radius), g.y(100 + Math.sin(a + 1) * radius), 18 + k, modern ? 1.4 : 1);
      }
      return;
    }
    const ff = 52 + Math.sin(t) * 48;
    for (let a = 2; a <= 7.2; a += 1.26) {
      const x = Math.cos(a + t) * (40 + ff) + 160;
      const y = Math.sin(a + t) * (40 + ff) + 100;
      draw.line(g.x(x), g.y(y), g.x(Math.cos(a + 0.62 + t) * (10 + ff) + 160), g.y(Math.sin(a + 0.62 + t) * (10 + ff) + 100), 30 + t * 8, modern ? 2 : 1);
      draw.line(g.x(x), g.y(y), g.x(Math.cos(a - 0.62 + t) * (10 + ff) + 160), g.y(Math.sin(a - 0.62 + t) * (10 + ff) + 100), 30 + t * 8, modern ? 2 : 1);
    }
  }

  private drawCyber(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    this.drawStars(draw, g, 150, true);
    const count = Math.floor(180 * density);
    const cl = variant === "wide" ? 4 : variant === "dense" ? 6 : 1;
    for (let i = 0; i < count; i += 1) {
      const a = i * 0.08 + t;
      const x = Math.cos(a);
      const y = Math.sin(a);
      const big = 12 + i * 0.7 + Math.sin(t) * 8;
      const big2 = 10 + i * 0.45 + Math.cos(t * 0.7) * 8;
      const px = x * big + 150;
      const py = y * big2 + 100;
      const color = 20 + i * 0.25 + t * 8;
      if (cl === 4) {
        draw.line(g.x(1), g.y(1), g.x(px), g.y(py), color, modern ? 1.1 : 1, modern ? 0.28 : 0.55);
        draw.line(g.x(315), g.y(199), g.x(px), g.y(py), color, modern ? 1.1 : 1, modern ? 0.28 : 0.55);
      } else if (cl === 6) {
        draw.line(g.x(px - 15), g.y(py), g.x(px + 15), g.y(py), color);
        draw.line(g.x(px - 15), g.y(py), g.x(px), g.y(py - 15), color);
        draw.line(g.x(px + 15), g.y(py), g.x(px), g.y(py - 15), color);
      } else {
        draw.line(g.x(px + Math.sin(t) * 20), g.y(py), g.x(x * (big + 18) + 150), g.y(y * big2 + 100), color, modern ? 1.5 : 1, modern ? 0.55 : 1);
      }
    }
  }

  private drawDelta(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    if (variant === "dense") {
      for (let y = 1; y < LH; y += 4) {
        for (let x = 1; x < LW; x += 12) draw.line(g.x(160), g.y(100), g.x(x), g.y(y), 16 + x / 10 + t * 20, modern ? 0.8 : 1, modern ? 0.22 : 0.45);
      }
      return;
    }
    const ff = variant === "wide" ? 50 + Math.sin(t) * 50 : 50;
    for (let a = 2; a <= 7.2; a += 1.26) {
      const orbit = variant === "orbit" ? t : 0;
      const x = Math.cos(a + orbit) * 80 + 160;
      const y = Math.sin(a + orbit) * 80 + 100;
      draw.line(g.x(x), g.y(y), g.x(Math.cos(a + 0.62 + t) * ff + 160), g.y(Math.sin(a + 0.62 + t) * ff + 100), 30 + t * 10, modern ? 2 : 1);
      draw.line(g.x(x), g.y(y), g.x(Math.cos(a - 0.62 + t) * ff + 160), g.y(Math.sin(a - 0.62 + t) * ff + 100), 30 + t * 10, modern ? 2 : 1);
    }
  }

  private drawBall(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    if (modern && variant !== "orbit") {
      this.drawModernSpaceDepth(draw, t, density, g, variant);
      return;
    }

    const count = Math.floor((variant === "dense" ? 150 : 100) * density);
    for (let i = 0; i < count; i += 1) {
      const angle = rand(i) * 7.3;
      const speed = 5 + rand(i * 2) * 5;
      const s = (rand(i * 3) * 95 + t * speed * 18) % 180;
      const x = Math.cos(angle) * s + 160;
      const y = Math.sin(angle) * s + 100;
      const px = Math.cos(angle) * (s - speed) + 160;
      const py = Math.sin(angle) * (s - speed) + 100;
      if (variant === "orbit") draw.pset(g.x(Math.cos(t + i) * (20 + rand(i) * 130) + 160), g.y(Math.sin(t + i) * (20 + rand(i + 4) * 80) + 100), 19 + i, g.pixel(modern ? 2 : 1));
      else draw.line(g.x(px), g.y(py), g.x(x), g.y(y), 18 + i * 0.1, modern ? 1.2 : 1, modern ? 0.7 : 1);
    }
    draw.box(g.x(0), g.y(0), g.w(319), g.h(199), 0, false);
  }

  private drawModernSpaceDepth(draw: DrawApi, t: number, density: number, g: Geometry, variant: string) {
    const count = Math.floor((variant === "dense" ? 260 : 190) * density);
    const vanishingX = 160 + Math.sin(t * 0.18) * 8;
    const vanishingY = 100 + Math.cos(t * 0.14) * 5;

    for (let i = 0; i < count; i += 1) {
      const spread = variant === "dense" ? 3.5 : 3.1;
      const baseX = (rand(i * 17 + 3) - 0.5) * spread;
      const baseY = (rand(i * 19 + 7) - 0.5) * spread * 0.72;
      const speed = 0.22 + rand(i * 23 + 11) * 0.6;
      const progress = (rand(i * 29 + 13) + t * speed) % 1;
      const previousProgress = Math.max(0, progress - (0.018 + rand(i * 31 + 17) * 0.026));
      const depth = 1 - progress * 0.96;
      const previousDepth = 1 - previousProgress * 0.96;
      const scale = 22 / Math.max(0.08, depth);
      const previousScale = 22 / Math.max(0.08, previousDepth);
      const x = vanishingX + baseX * scale;
      const y = vanishingY + baseY * scale;
      const px = vanishingX + baseX * previousScale;
      const py = vanishingY + baseY * previousScale;

      if (x < -20 || x > LW + 20 || y < -20 || y > LH + 20) continue;

      const color = variant === "original" ? 7 + progress * 3 : 18 + progress * 16 + i * 0.02;
      const alpha = 0.25 + progress * 0.65;
      const width = 0.35 + progress * 1.5;
      draw.line(g.x(px), g.y(py), g.x(x), g.y(y), color, width, alpha);
      draw.pset(g.x(x), g.y(y), color + 2, g.pixel(0.6 + progress * 0.7));
    }
    draw.box(g.x(0), g.y(0), g.w(319), g.h(199), 0, false);
  }

  private drawLines(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    if (variant === "wide") {
      const p1 = bouncePoint(t * 0.35, 1, 1);
      const p2 = bouncePoint(t * 0.35 + 90, 1, -1);
      draw.line(g.x(p1.x), g.y(p1.y), g.x(p2.x), g.y(p2.y), 20 + t * 4, modern ? 2 : 1);
      return;
    }
    if (variant === "orbit") {
      for (let i = 0; i < 6; i += 1) {
        const a = t * 0.45 + i;
        const b = t * 0.6 + i * 0.7;
        draw.line(g.x(160 + Math.cos(a) * 70), g.y(100 + Math.sin(a) * 50), g.x(160 + Math.cos(b) * 70), g.y(100 + Math.sin(b) * 50), 20 + i * 4 + t * 6);
      }
      return;
    }
    const count = Math.floor(32 * density);
    for (let i = 0; i < count; i += 1) {
      const tick = Math.floor(t * 12);
      const x = rand(i + tick) * 315;
      const x1 = rand(i * 3 + tick) * 315;
      const y = rand(i * 4) > 0.5 ? 199 : 0;
      const y1 = rand(i * 5) > 0.5 ? 199 : 0;
      draw.line(g.x(x), g.y(y), g.x(x1), g.y(y1), rand(i) * 300, modern ? 1.1 : 1, modern ? 0.28 : 0.55);
    }
  }

  private drawShella(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    const arms = variant === "dense" ? 9 : 3;
    for (let arm = 0; arm < arms; arm += 1) {
      const d = 30 + arm * 11;
      const phase = arm * 1.7;
      for (let x = 1; x <= 7.25 * density; x += 0.14) {
        const xx = Math.cos(x + t + phase) * d + 160;
        const yy = Math.sin(x + t * 0.7 + phase) * (d * 0.8) + 100;
        const xx2 = Math.cos(x + 2.1 + phase) * (d + 15) + 160;
        const yy2 = Math.sin(x + 1.6 + phase) * (d + 10) + 100;
        draw.line(g.x(xx), g.y(yy), g.x(xx2), g.y(yy2), 10 + arm * 5 + x * 2, modern ? 1.3 : 1, modern ? 0.35 : 0.75);
      }
    }
  }

  private drawType1(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry) {
    const count = Math.floor(70 * density);
    for (let x = 5; x < count; x += 8) {
      for (let s = 1; s <= 100; s += 20) {
        const radius = ((x + s + t * 12) % 130) + 4;
        draw.circle(g.x(150), g.y(100), g.w(radius), 20 + radius * 0.2, false, modern ? 0.5 : 0.8);
      }
    }
  }

  private drawType2(draw: DrawApi, t: number, delta: number, density: number, modern: boolean, g: Geometry, variant: string) {
    if (variant === "trail") {
      draw.cls(0, modern ? 0.065 : 0.1);
      const count = Math.floor(420 * density);
      for (let i = 0; i < count; i += 1) {
        const k = rand(i * 11 + 5) * 70 + t * 0.18;
        const r = 35 + rand(i * 13 + 7) * 70;
        const r2 = 35 + rand(i * 17 + 11) * 70;
        const r1 = 35 + rand(i * 19 + 13) * 70;
        const r21 = 35 + rand(i * 23 + 17) * 70;
        const phase = t * (0.8 + rand(i * 29) * 0.35) + i * 0.0025;
        draw.line(
          g.x(Math.cos(k) * r + 150),
          g.y(Math.sin(k) * r2 + 100),
          g.x(Math.cos(k + phase) * r1 + 150),
          g.y(Math.sin(k + phase) * r21 + 100),
          18 + i * 0.05 + t * 2,
          modern ? 1.1 : 1,
          modern ? 0.35 : 0.7,
        );
      }
      return;
    }

    this.doorway.lineDebt += Math.max(0, delta) * 520 * density;
    const count = Math.min(32, Math.floor(this.doorway.lineDebt));
    this.doorway.lineDebt -= count;

    for (let i = 0; i < count; i += 1) {
      const k = (Math.floor(rand(this.doorway.tick * 17 + 3) * 700) + 1) / 10;
      this.doorway.color += 0.01;
      if (this.doorway.color > 300) this.doorway.color = 18;
      this.doorway.g += 0.01;

      const x = Math.cos(k) * this.doorway.r;
      const y = Math.sin(k) * this.doorway.r2;
      const x2 = Math.cos(k + this.doorway.g) * this.doorway.r1;
      const y2 = Math.sin(k + this.doorway.g) * this.doorway.r21;
      draw.line(g.x(x + 150), g.y(y + 100), g.x(x2 + 150), g.y(y2 + 100), this.doorway.color, modern ? 1.1 : 1, modern ? 0.55 : 1);
      this.doorway.tick += 1;
    }
  }

  private drawTunnels(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    const updates = Math.max(6, Math.floor(16 * density));
    for (let update = 0; update < updates; update += 1) {
      const tick = Math.floor(t * 60) + update;
      const index = tick % this.wormPoints.length;
      const worm = this.wormPoints[index];
      const previous = { x: worm.x, y: worm.y };
      const diagonal = variant === "orbit";
      const step = variant === "original" ? 10 : variant === "wide" ? 2 : 1;
      const directions = diagonal
        ? [[-step, 0], [step, 0], [0, -step], [0, step], [-step, -step], [step, step], [step, -step], [-step, step]]
        : [[-step, 0], [step, 0], [0, -step], [0, step]];
      const direction = directions[Math.floor(rand(tick * 11) * directions.length)];
      worm.x += direction[0];
      worm.y += direction[1];
      worm.color = variant === "original" ? index + 1 : worm.color + 1;
      if (worm.color > 95) worm.color = 33;
      draw.line(g.x(previous.x), g.y(previous.y), g.x(worm.x), g.y(worm.y), worm.color, modern ? 1.2 : 1, modern ? 0.65 : 1);
    }
  }

  private drawCoolX(draw: DrawApi, t: number, density: number, trail: number, modern: boolean, g: Geometry, variant: string) {
    this.drawStars(draw, g, 150, true);
    const effectDraw = this.getCoolBufferDraw(draw, variant);
    const effectGeometry = geo(effectDraw);
    fadeCanvas(effectDraw.ctx, coolTrailFadeAlpha(trail, modern), draw.width, draw.height);
    const mode = variant === "wide" ? 2 : variant === "dense" ? 3 : 1;
    let previous: Point | null = null;
    for (let a = 1; a <= 8 * density; a += 0.01) {
      const xx = Math.cos((2 + mode) * a + t) * 42 + 150;
      const yy = Math.sin((4 + mode) * a) * 42 + 100;
      const x = Math.cos(a) * 42 + xx;
      const y = Math.sin(a) * 42 + yy;
      const color = 25 + a * 8 + t * 5;
      if (mode === 1) {
        if (modern && previous) effectDraw.line(effectGeometry.x(previous.x), effectGeometry.y(previous.y), effectGeometry.x(x), effectGeometry.y(y), color, 1.1, 0.75);
        else effectDraw.pset(effectGeometry.x(x), effectGeometry.y(y), color, 1);
        previous = { x, y };
      }
      if (mode === 2) effectDraw.line(effectGeometry.x(x), effectGeometry.y(y), effectGeometry.x(x + 5), effectGeometry.y(y + 5), color, modern ? 1.3 : 1);
      if (mode === 3) effectDraw.circle(effectGeometry.x(x), effectGeometry.y(y), effectGeometry.w(5), color, false, modern ? 0.45 : 0.8);
    }
    if (this.coolBuffer) draw.ctx.drawImage(this.coolBuffer, 0, 0);
  }

  private getCoolBufferDraw(draw: DrawApi, variant: string) {
    const needsReset =
      !this.coolBuffer ||
      this.coolBuffer.width !== draw.width ||
      this.coolBuffer.height !== draw.height ||
      this.coolBufferVariant !== variant;

    if (needsReset) {
      this.coolBuffer = document.createElement("canvas");
      this.coolBuffer.width = draw.width;
      this.coolBuffer.height = draw.height;
      this.coolBufferVariant = variant;
    }

    const buffer = this.coolBuffer;
    if (!buffer) throw new Error("Could not create Cool scene buffer");
    const context = buffer.getContext("2d");
    if (!context) throw new Error("Could not create Cool scene buffer");
    return createDrawApi(context, draw.width, draw.height, draw.mode, draw.antialias, draw.lineScale);
  }

  private drawDisco(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry) {
    const count = Math.floor(100 * density);
    for (let i = 0; i < count; i += 1) {
      const targetA = i * 0.0627;
      const start = makeTrianglePath(i);
      const target = {
        x: Math.cos(targetA) * 55 + 160,
        y: Math.sin(targetA) * 45 + 100,
      };
      const mix = (Math.sin(t * 0.4) + 1) / 2;
      const x = start.x + (target.x - start.x) * mix;
      const y = start.y + (target.y - start.y) * mix;
      draw.circle(g.x(x), g.y(y), g.w(modern ? 1.1 : 1), 20 + i * 0.1 + t * 3, true, modern ? 0.7 : 1);
    }
  }

  private drawSpheres(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry) {
    this.drawStars(draw, g, 150, true);
    const count = Math.floor(90 * density);
    for (let i = 0; i < count; i += 1) {
      const edge = i % 2;
      const z = edge ? 310 : 0;
      const w = (i * 17 + t * 35) % 260;
      const mix = (i / count + (t * 0.04)) % 1;
      const x = 150 + (z - 150) * mix;
      const y = 100 + (w - 100) * mix;
      const radius = 1 + ((i + t * 10) % 50);
      draw.circle(g.x(x), g.y(y), g.w(radius), 18 + i + t * 3, false, modern ? 0.32 : 0.65);
      draw.pset(g.x(x), g.y(y), 10, g.pixel(modern ? 2 : 1));
    }
  }

  private drawSpots(draw: DrawApi, t: number, density: number, modern: boolean, g: Geometry, variant: string) {
    if (variant === "wide") {
      for (let i = 0; i < 40 * density; i += 1) {
        const x = rand(i + Math.floor(t * 6)) * LW;
        const y = rand(i * 5 + Math.floor(t * 8)) * LH;
        for (let r = 1; r < 30; r += 2) {
          draw.circle(g.x(x), g.y(y), g.w(r), 30 + r + i, false, modern ? 0.18 : 0.35);
          draw.line(g.x(x), g.y(y - r), g.x(x - r), g.y(y), 30 + r + i, modern ? 1.1 : 1, modern ? 0.18 : 0.35);
          draw.line(g.x(x), g.y(y + r), g.x(x + r), g.y(y), 30 + r + i, modern ? 1.1 : 1, modern ? 0.18 : 0.35);
        }
      }
      return;
    }
    if (variant === "dense") {
      for (let i = 0; i < 50; i += 1) {
        const angle = rand(i) * 7.3;
        const radius = (t * 30 + i * 8) % 180;
        draw.circle(g.x(Math.cos(angle) * radius + 160), g.y(Math.sin(angle) * radius + 100), g.w(4 + rand(i) * 24), 20 + i, false, modern ? 0.5 : 1);
      }
      draw.box(g.x(0), g.y(0), g.w(319), g.h(199), 0, false);
      return;
    }
    const count = Math.floor(36 * density);
    for (let i = 0; i < count; i += 1) {
      const tick = Math.floor(t * 12);
      const x = rand(i + tick) * LW;
      const y1 = rand(i * 2) * LH;
      const y2 = y1 + rand(i * 3) * (LH - y1);
      draw.line(g.x(x), g.y(y1), g.x(x), g.y(y2), 20 + i * 0.1, modern ? 1.2 : 1, modern ? 0.35 : 0.75);
      draw.circle(g.x(x), g.y(y2), g.w(1 + rand(i) * 25), 25 + i, false, modern ? 0.32 : 0.65);
    }
  }

  private ellipse(draw: DrawApi, x: number, y: number, rx: number, ry: number, color: number, width: number, alpha: number) {
    if (!draw.antialias) {
      const steps = Math.max(48, Math.round(Math.max(rx, ry) * 3));
      let previous = {
        x: x + rx,
        y,
      };
      for (let step = 1; step <= steps; step += 1) {
        const angle = (step / steps) * Math.PI * 2;
        const next = {
          x: x + Math.cos(angle) * rx,
          y: y + Math.sin(angle) * ry,
        };
        draw.line(previous.x, previous.y, next.x, next.y, color, width, alpha);
        previous = next;
      }
      return;
    }

    draw.ctx.save();
    draw.ctx.globalAlpha = alpha;
    draw.ctx.strokeStyle = draw.color(color);
    draw.ctx.lineWidth = width * draw.lineScale;
    draw.ctx.beginPath();
    draw.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    draw.ctx.stroke();
    draw.ctx.restore();
  }

  private pixelLine(
    draw: DrawApi,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: number,
    lineWidth: number,
    modern: boolean,
  ) {
    if (modern) {
      draw.line(x1, y1, x2, y2, color, lineWidth);
      return;
    }

    let ax = Math.round(x1);
    let ay = Math.round(y1);
    const bx = Math.round(x2);
    const by = Math.round(y2);
    const dx = Math.abs(bx - ax);
    const sx = ax < bx ? 1 : -1;
    const dy = -Math.abs(by - ay);
    const sy = ay < by ? 1 : -1;
    let error = dx + dy;

    while (true) {
      draw.pset(ax, ay, color, 1);
      if (ax === bx && ay === by) break;
      const twice = error * 2;
      if (twice >= dy) {
        error += dy;
        ax += sx;
      }
      if (twice <= dx) {
        error += dx;
        ay += sy;
      }
    }
  }

  private pixelBox(draw: DrawApi, left: number, top: number, right: number, bottom: number, color: number, modern: boolean) {
    this.pixelLine(draw, left, top, right, top, color, modern ? 1.4 : 1, modern);
    this.pixelLine(draw, right, top, right, bottom, color, modern ? 1.4 : 1, modern);
    this.pixelLine(draw, right, bottom, left, bottom, color, modern ? 1.4 : 1, modern);
    this.pixelLine(draw, left, bottom, left, top, color, modern ? 1.4 : 1, modern);
  }
}

type Geometry = {
  sx: number;
  sy: number;
  x: (value: number) => number;
  y: (value: number) => number;
  w: (value: number) => number;
  h: (value: number) => number;
  pixel: (value: number) => number;
};

function geo(draw: DrawApi): Geometry {
  const sx = draw.width / LW;
  const sy = draw.height / LH;
  return {
    sx,
    sy,
    x: (value) => value * sx,
    y: (value) => value * sy,
    w: (value) => value * sx,
    h: (value) => value * sy,
    pixel: (value) => Math.max(1, Math.round(value * Math.min(sx, sy))),
  };
}

function clearAlphaForScene(kind: SceneKind, trail: number, modern: boolean) {
  if (trail <= 0) return 1;
  if (kind === "craper") return modern ? 0.018 : 0.012;
  if (kind === "lines") return modern ? 0.065 : 0.04;
  if (kind === "type1") return modern ? 0.045 : 0.03;
  if (kind === "type2") return 0;
  if (kind === "tunnels") return modern ? 0.045 : 0.03;
  if (kind === "coolx") return 1;
  if (kind === "spots") return modern ? 0.08 : 0.055;
  return modern ? Math.max(0.04, 0.18 - trail * 0.12) : Math.max(0.1, 0.35 - trail * 0.2);
}

function makeStars(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    x: rand(index * 2),
    y: rand(index * 3),
    speed: 0.2 + rand(index * 5) * 1.6,
    size: 1 + Math.floor(rand(index * 7) * 2),
  }));
}

function makeMovers(count: number): MovingPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: rand(index) * LW,
    y: rand(index * 2) * LH,
    dx: (rand(index * 3) > 0.5 ? 1 : -1) * (0.5 + rand(index * 4) * 2),
    dy: (rand(index * 5) > 0.5 ? 1 : -1) * (0.5 + rand(index * 6) * 2),
    color: 20 + rand(index * 7) * 60,
  }));
}

function makeDots(count: number): Point[] {
  return Array.from({ length: count }, (_, index) => ({
    x: rand(index * 11) * LW,
    y: rand(index * 13) * LH,
  }));
}

function makeInfoParticles(count: number): InfoParticle[] {
  return Array.from({ length: count }, (_, index) => ({
    x: Math.floor(rand(index * 19) * 360) + 1,
    y: Math.floor(rand(index * 23) * 200) + 1,
    phase: rand(index * 29) * Math.PI * 2,
    speed: (Math.floor(rand(index * 31) * 10) + 1) / 5,
  }));
}

function makeWormPoints(count: number): WormState[] {
  return Array.from({ length: count }, (_, index) => ({
    x: Math.floor(rand(index * 41) * 360) + 1,
    y: Math.floor(rand(index * 43) * 200) + 1,
    color: 33 + Math.floor(rand(index * 47) * 30),
  }));
}

function makeDoorwayState(): DoorwayState {
  return {
    r: Math.floor(rand(103) * 100) + 1,
    r2: Math.floor(rand(107) * 100) + 1,
    r1: Math.floor(rand(109) * 100) + 1,
    r21: Math.floor(rand(113) * 100) + 1,
    g: 0,
    color: 18,
    tick: 0,
    lineDebt: 0,
  };
}

function fadeCanvas(ctx: CanvasRenderingContext2D, alpha: number, width: number, height: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function coolTrailFadeAlpha(trail: number, modern: boolean) {
  if (trail <= 0) return 1;
  return modern ? Math.max(0.04, 0.18 - trail * 0.12) : Math.max(0.1, 0.35 - trail * 0.2);
}

function makeMenuNoise() {
  return Array.from({ length: 48 * 48 + 49 }, (_, index) => Math.floor(rand(index * 17) * 10));
}

function rand(seed: number) {
  return fract(Math.sin(seed * 12.9898 + 78.233) * 43758.5453);
}

function fract(value: number) {
  return value - Math.floor(value);
}

function bounce(value: number, max: number) {
  const period = max * 2;
  const wrapped = ((value % period) + period) % period;
  return wrapped > max ? period - wrapped : wrapped;
}

function bouncePoint(t: number, sx: number, sy: number): Point {
  return {
    x: bounce(40 + t * 45 * sx, LW),
    y: bounce(30 + t * 31 * sy, LH),
  };
}

function triangleBounce(t: number, s1: number, s2: number, s3: number): [Point, Point, Point] {
  return [
    { x: bounce(20 + t * 45 * s1, LW), y: bounce(40 + t * 35 * s1, LH) },
    { x: bounce(160 + t * 45 * s2, LW), y: bounce(20 + t * 35 * s2, LH) },
    { x: bounce(300 + t * 45 * s3, LW), y: bounce(160 + t * 35 * s3, LH) },
  ];
}

function makeTrianglePath(index: number): Point {
  const side = Math.floor(index / 33);
  const pos = index % 33;
  const v = 1 + rand(index) * 2;
  if (side === 0) return { x: 80 + pos * v, y: 60 + pos * v };
  if (side === 1) return { x: 80 + 33 * v - pos * v * 2, y: 60 + 33 * v };
  return { x: 80 - 33 * v + pos * v, y: 60 + 33 * v - pos * v };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function inRect(point: Point, x: number, y: number, width: number, height: number) {
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}
