const ega = [
  "#000000",
  "#0000aa",
  "#00aa00",
  "#00aaaa",
  "#aa0000",
  "#aa00aa",
  "#aa5500",
  "#aaaaaa",
  "#555555",
  "#5555ff",
  "#55ff55",
  "#55ffff",
  "#ff5555",
  "#ff55ff",
  "#ffff55",
  "#ffffff",
];

export function paletteColor(index: number, alpha = 1): string {
  const safe = Number.isFinite(index) ? Math.max(0, Math.round(index)) : 0;
  const wrapped = safe % 256;
  if (wrapped < ega.length) {
    return withAlpha(ega[wrapped], alpha);
  }

  if (wrapped < vga.length) return `rgba(${vga[wrapped][0]}, ${vga[wrapped][1]}, ${vga[wrapped][2]}, ${alpha})`;

  return `rgba(255, 255, 255, ${alpha})`;
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const vga = makeVgaPalette();

function makeVgaPalette(): Array<[number, number, number]> {
  const palette: Array<[number, number, number]> = ega.map((hex) => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  });

  const graySteps = [0, 5, 8, 11, 14, 17, 20, 24, 28, 32, 36, 40, 45, 50, 56, 63];
  graySteps.forEach((value) => palette.push(dac(value, value, value)));

  const brightRing = makeHueRing(63, [0, 16, 31, 47, 63]).map(([red, green, blue]) => dac(red, green, blue));
  palette.push(...brightRing);
  palette.push(...brightRing.map((color) => mixRgb(color, [255, 255, 255], 0.24)));
  palette.push(...brightRing.map((color) => mixRgb(color, [255, 255, 255], 0.46)));
  addHueRing(palette, 31, [0, 8, 16, 24, 31]);
  addHueRing(palette, 47, [0, 12, 24, 35, 47]);
  addHueRing(palette, 39, [0, 10, 19, 29, 39]);
  addHueRing(palette, 55, [0, 14, 27, 41, 55]);
  addHueRing(palette, 23, [0, 6, 11, 17, 23]);
  addHueRing(palette, 63, [16, 27, 39, 51, 63]);
  addHueRing(palette, 45, [8, 17, 26, 35, 45]);

  while (palette.length < 256) palette.push([0, 0, 0]);
  return palette.slice(0, 256);
}

function addHueRing(palette: Array<[number, number, number]>, high: number, ramp: number[]) {
  makeHueRing(high, ramp).forEach(([red, green, blue]) => palette.push(dac(red, green, blue)));
}

function makeHueRing(high: number, ramp: number[]) {
  const [low, a, b, c] = ramp;
  return [
    [low, low, high],
    [a, low, high],
    [b, low, high],
    [c, low, high],
    [high, low, high],
    [high, low, c],
    [high, low, b],
    [high, low, a],
    [high, low, low],
    [high, a, low],
    [high, b, low],
    [high, c, low],
    [high, high, low],
    [c, high, low],
    [b, high, low],
    [a, high, low],
    [low, high, low],
    [low, high, a],
    [low, high, b],
    [low, high, c],
    [low, high, high],
    [low, c, high],
    [low, b, high],
    [low, a, high],
  ] satisfies Array<[number, number, number]>;
}

function dac(red: number, green: number, blue: number): [number, number, number] {
  return [
    Math.round((red / 63) * 255),
    Math.round((green / 63) * 255),
    Math.round((blue / 63) * 255),
  ];
}

function mixRgb(from: [number, number, number], to: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}
