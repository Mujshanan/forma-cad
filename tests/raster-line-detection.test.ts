import { describe, expect, it } from "vitest";
import { detectRasterSegments } from "../src/core/raster-line-detection";

function raster(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255; data[i * 4 + 1] = 255; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255;
  }
  return data;
}
function ink(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const at = (y * width + x) * 4;
  data[at] = 20; data[at + 1] = 20; data[at + 2] = 20;
}

describe("architectural raster line detection", () => {
  it("extracts horizontal and vertical plan strokes as normalized segments", () => {
    const width = 120, height = 100, data = raster(width, height);
    for (let x = 12; x <= 108; x++) ink(data, width, x, 30);
    for (let y = 10; y <= 90; y++) ink(data, width, 65, y);
    const segments = detectRasterSegments(data, width, height);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.every(s => [s.start.x,s.start.y,s.end.x,s.end.y].every(v => v >= 0 && v <= 1))).toBe(true);
    expect(segments.some(s => Math.abs(s.start.y-s.end.y) < 0.03 && Math.abs(s.end.x-s.start.x) > 0.5)).toBe(true);
    expect(segments.some(s => Math.abs(s.start.x-s.end.x) < 0.03 && Math.abs(s.end.y-s.start.y) > 0.5)).toBe(true);
  });

  it("ignores blank and very small raster inputs", () => {
    expect(detectRasterSegments(raster(100, 80), 100, 80)).toEqual([]);
    expect(detectRasterSegments(new Uint8ClampedArray(4), 1, 1)).toEqual([]);
  });
});
