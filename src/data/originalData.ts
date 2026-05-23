import dataRaw from "../../DATA?raw";
import data2Raw from "../../DATA2?raw";
import data3Raw from "../../DATA3?raw";
import data4Raw from "../../DATA4?raw";
import data5Raw from "../../DATA5?raw";
import virtSource from "../../VIRT.BAS?raw";

export type Point = { x: number; y: number };

export const originalData = {
  DATA: parsePairs(dataRaw),
  DATA2: parsePairs(data2Raw),
  DATA3: parsePairs(data3Raw),
  DATA4: parsePairs(data4Raw),
  DATA5: parsePairs(data5Raw),
};

export const originalSourceLines = virtSource.split(/\r?\n/);

function parsePairs(raw: string): Point[] {
  const values = raw
    .trim()
    .split(/\s+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  const points: Point[] = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  return points;
}
