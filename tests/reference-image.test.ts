import { describe, expect, it } from "vitest";
import { referenceImageCorners, referenceImageHeight, referenceImageLocalOffset } from "../src/core/reference-image";
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

  it("rejects invalid image dimensions", () => {
    expect(() => referenceImageHeight(image({ widthMm: 0 }))).toThrow();
  });
});
