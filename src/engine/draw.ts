import { paletteColor } from "./palette";
import type { DrawApi, RenderMode } from "./types";

export function createDrawApi(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: RenderMode,
  antialias = mode === "modern",
  lineScale = 1,
): DrawApi {
  const smoothPrimitives = mode === "modern" || antialias;
  const strokeScale = mode === "modern" ? lineScale : 1;
  ctx.imageSmoothingEnabled = smoothPrimitives;
  ctx.lineCap = mode === "modern" ? "round" : "butt";
  ctx.lineJoin = mode === "modern" ? "round" : "miter";

  const resolve = (color: number | string = 15, alpha = 1) =>
    typeof color === "number" ? paletteColor(color, alpha) : color;

  return {
    width,
    height,
    ctx,
    mode,
    antialias: smoothPrimitives,
    lineScale: strokeScale,
    color: (index, alpha = 1) => paletteColor(index, alpha),
    cls: (color: number | string = 0, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = resolve(color);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    },
    pset: (x, y, color: number | string = 15, size = mode === "classic" ? 1 : 2) => {
      ctx.fillStyle = resolve(color);
      const left = mode === "classic" ? Math.round(x) : Math.floor(x);
      const top = mode === "classic" ? Math.round(y) : Math.floor(y);
      const side = mode === "classic" ? size : Math.max(1, Math.ceil(size));
      ctx.fillRect(left, top, side, side);
    },
    line: (x1, y1, x2, y2, color: number | string = 15, lineWidth = 1, alpha = 1) => {
      if (!smoothPrimitives) {
        pixelLine(ctx, Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), resolve(color), lineWidth, alpha);
        return;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = resolve(color);
      ctx.lineWidth = lineWidth * strokeScale;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    },
    circle: (x, y, radius, color: number | string = 15, fill = false, alpha = 1) => {
      if (!smoothPrimitives) {
        pixelCircle(ctx, Math.round(x), Math.round(y), Math.round(radius), resolve(color), fill, alpha);
        return;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = resolve(color);
        ctx.fill();
      } else {
        ctx.strokeStyle = resolve(color);
        ctx.lineWidth = (mode === "modern" ? 1.5 : 1) * strokeScale;
        ctx.stroke();
      }
      ctx.restore();
    },
    box: (x, y, boxWidth, boxHeight, color: number | string = 15, fill = false, alpha = 1) => {
      if (!smoothPrimitives) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = resolve(color);
        if (fill) {
          ctx.fillRect(Math.round(x), Math.round(y), Math.round(boxWidth), Math.round(boxHeight));
        } else {
          const left = Math.round(x);
          const top = Math.round(y);
          const right = Math.round(x + boxWidth);
          const bottom = Math.round(y + boxHeight);
          pixelLine(ctx, left, top, right, top, resolve(color), 1, alpha);
          pixelLine(ctx, right, top, right, bottom, resolve(color), 1, alpha);
          pixelLine(ctx, right, bottom, left, bottom, resolve(color), 1, alpha);
          pixelLine(ctx, left, bottom, left, top, resolve(color), 1, alpha);
        }
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      if (fill) {
        ctx.fillStyle = resolve(color);
        ctx.fillRect(x, y, boxWidth, boxHeight);
      } else {
        ctx.strokeStyle = resolve(color);
        ctx.lineWidth = strokeScale;
        ctx.strokeRect(x, y, boxWidth, boxHeight);
      }
      ctx.restore();
    },
    locateText: (row, col, text, color: number | string = 15, scale = 1) => {
      const cellW = 8 * scale;
      const cellH = 8 * scale;
      ctx.fillStyle = resolve(color);
      drawBitmapText(ctx, text, (col - 1) * cellW, (row - 1) * cellH, scale);
    },
  };
}

function pixelLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const size = Math.max(1, Math.round(lineWidth));
  let x = x1;
  let y = y1;
  const dx = Math.abs(x2 - x);
  const sx = x < x2 ? 1 : -1;
  const dy = -Math.abs(y2 - y);
  const sy = y < y2 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    ctx.fillRect(x, y, size, size);
    if (x === x2 && y === y2) break;
    const twice = error * 2;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
  ctx.restore();
}

function pixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  fill: boolean,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (fill) {
    for (let y = -radius; y <= radius; y += 1) {
      const width = Math.floor(Math.sqrt(radius * radius - y * y));
      ctx.fillRect(cx - width, cy + y, width * 2 + 1, 1);
    }
    ctx.restore();
    return;
  }

  let x = radius;
  let y = 0;
  let err = 0;
  while (x >= y) {
    plotCirclePoints(ctx, cx, cy, x, y);
    y += 1;
    if (err <= 0) err += 2 * y + 1;
    if (err > 0) {
      x -= 1;
      err -= 2 * x + 1;
    }
  }
  ctx.restore();
}

function plotCirclePoints(ctx: CanvasRenderingContext2D, cx: number, cy: number, x: number, y: number) {
  ctx.fillRect(cx + x, cy + y, 1, 1);
  ctx.fillRect(cx + y, cy + x, 1, 1);
  ctx.fillRect(cx - y, cy + x, 1, 1);
  ctx.fillRect(cx - x, cy + y, 1, 1);
  ctx.fillRect(cx - x, cy - y, 1, 1);
  ctx.fillRect(cx - y, cy - x, 1, 1);
  ctx.fillRect(cx + y, cy - x, 1, 1);
  ctx.fillRect(cx + x, cy - y, 1, 1);
}

const font8x8: Record<string, string[]> = {
  " ": [
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
    "00000000",
  ],
  B: [
    "11111100",
    "01100110",
    "01100110",
    "01111100",
    "01100110",
    "01100110",
    "01100110",
    "11111100",
  ],
  C: [
    "00111100",
    "01100110",
    "11000000",
    "11000000",
    "11000000",
    "11000000",
    "01100110",
    "00111100",
  ],
  D: [
    "11111000",
    "01101100",
    "01100110",
    "01100110",
    "01100110",
    "01100110",
    "01101100",
    "11111000",
  ],
  E: [
    "11111110",
    "01100010",
    "01101000",
    "01111000",
    "01101000",
    "01100000",
    "01100010",
    "11111110",
  ],
  O: [
    "00111000",
    "01101100",
    "11000110",
    "11000110",
    "11000110",
    "11000110",
    "01101100",
    "00111000",
  ],
  R: [
    "11111100",
    "01100110",
    "01100110",
    "01111100",
    "01101100",
    "01100110",
    "01100110",
    "11100110",
  ],
  Y: [
    "11000110",
    "11000110",
    "01101100",
    "00111000",
    "00010000",
    "00010000",
    "00010000",
    "00111000",
  ],
};

function drawBitmapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
) {
  const pixel = Math.max(1, Math.round(scale));
  [...text.toUpperCase()].forEach((char, charIndex) => {
    const rows = font8x8[char] ?? font8x8[" "];
    rows.forEach((rowBits, row) => {
      [...rowBits].forEach((bit, column) => {
        if (bit === "1") ctx.fillRect(Math.round(x + charIndex * 8 * scale + column * scale), Math.round(y + row * scale), pixel, pixel);
      });
    });
  });
}
