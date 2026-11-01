import { describe, expect, it } from "vitest";
import { calibrateReferenceImage, referenceImageCorners, referenceImageHeight, referenceImageLocalOffset, referenceImageNormalizedPoint } from "../src/core/reference-image";
import type { ReferenceImage } from "../src/core/model";

const image = (overrides: Partial<ReferenceImage> = {}): ReferenceImage => ({
  id: "REF1", name: "plan.png", dataUrl: "data:image/png;base64,AA==",
  pixelWidth: 2000, pixelHeight: 1000, widthMm: 10000,
  position: { x: 0, y: 0 }, rotation: 0, opacity: 0.5,
  visible: true, locked: false, anchor: "origin", ...overrides,
});

describe("reference image geometry", () => {
  it("preserves source aspect ratio when width is adjusted", () => {
    expect(referenceImageHeight(image())).toBe(5000);
    expect(referenceImageHeight(image({ widthMm: 12000 }))).toBe(6000);
  });

  it("uses the insertion point as the top-left image origin", () => {
    expect(referenceImageCorners(image())).toEqual([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: -5000 }, { x: 0, y: -5000 },
    ]);
  });

  it("aligns the image center to the insertion point for center-to-center placement", () => {
    expect(referenceImageCorners(image({ anchor: "center" }))).toEqual([
      { x: -5000, y: 2500 }, { x: 5000, y: 2500 }, { x: 5000, y: -2500 }, { x: -5000, y: -2500 },
    ]);
    expect(referenceImageLocalOffset(image({ anchor: "center" }))).toEqual({ x: -5000, y: -2500 });
  });

  it("rotates the image around its insertion point", () => {
    const corners = referenceImageCorners(image({ rotation: 90, position: { x: 100, y: 200 } }));
    expect(corners[0].x).toBeCloseTo(100);
    expect(corners[0].y).toBeCloseTo(200);
    expect(corners[1].x).toBeCloseTo(100);
    expect(corners[1].y).toBeCloseTo(10200);
  });

  it("converts picked world points to normalized coordinates on rotated, centered images", () => {
    const ref = image({ anchor: "center", position: { x: 1200, y: -800 }, rotation: 30 });
    const corners = referenceImageCorners(ref);
    const center = { x: corners.reduce((sum,p)=>sum+p.x,0)/4, y: corners.reduce((sum,p)=>sum+p.y,0)/4 };
    expect(referenceImageNormalizedPoint(ref, center)).toEqual({ x: 0.5, y: 0.5 });
    expect(referenceImageNormalizedPoint(ref, { x: 1e7, y: 1e7 })).toBeNull();
  });

  it("calibrates to a known distance and preserves the first picked world point", () => {
    const ref = image({ position: { x: 300, y: 700 }, rotation: 23, anchor: "center" });
    const corners = referenceImageCorners(ref);
    const pointA = { x: corners[0].x * 0.7 + corners[1].x * 0.3, y: corners[0].y * 0.7 + corners[1].y * 0.3 };
    const pointB = { x: corners[3].x * 0.7 + corners[2].x * 0.3, y: corners[3].y * 0.7 + corners[2].y * 0.3 };
    const calibrated = calibrateReferenceImage(ref, pointA, pointB, 6000);
    expect(Math.hypot(calibrated.widthMm, referenceImageHeight(calibrated))).toBeGreaterThan(0);
    const after = referenceImageCorners(calibrated);
    const preservedA = { x: after[0].x * 0.7 + after[1].x * 0.3, y: after[0].y * 0.7 + after[1].y * 0.3 };
    expect(preservedA.x).toBeCloseTo(pointA.x, 6);
    expect(preservedA.y).toBeCloseTo(pointA.y, 6);
    expect(Math.hypot(pointB.x-pointA.x, pointB.y-pointA.y) * calibrated.widthMm / ref.widthMm).toBeCloseTo(6000, 6);
    expect(calibrated.calibration?.actualDistanceMm).toBe(6000);
  });

  it("rejects zero calibration distance and coincident points", () => {
    const ref = image();
    expect(() => calibrateReferenceImage(ref, {x:0,y:0}, {x:1,y:0}, 0)).toThrow();
    expect(() => calibrateReferenceImage(ref, {x:0,y:0}, {x:0,y:0}, 100)).toThrow();
  });

  it("rejects invalid image dimensions", () => {
    expect(() => referenceImageHeight(image({ widthMm: 0 }))).toThrow();
  });
});
