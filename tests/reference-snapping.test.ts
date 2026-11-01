import { describe, expect, it } from "vitest";
import { snapToReferenceGeometry } from "../src/core/reference-snapping";
import type { ReferenceImage } from "../src/core/model";

const reference = (segments: ReferenceImage["detectedSegments"]): ReferenceImage => ({
  id: "REF1", name: "plan.png", dataUrl: "data:image/png;base64,AA==",
  pixelWidth: 1000, pixelHeight: 1000, widthMm: 10000,
  position: { x: 0, y: 0 }, rotation: 0, opacity: 0.5,
  visible: true, locked: false, anchor: "origin", calibration: {
    actualDistanceMm: 6000, pointA: { x: 0.1, y: 0.5 }, pointB: { x: 0.7, y: 0.5 },
  }, detectedSegments: segments,
});

describe("calibrated raster reference snapping", () => {
  it("snaps to detected line endpoints", () => {
    const ref = reference([{ start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } }]);
    const result = snapToReferenceGeometry({ x: 1010, y: -5000 }, [ref], 0.08);
    expect(result?.kind).toBe("endpoint");
    expect(result?.point).toEqual({ x: 1000, y: -5000 });
  });

  it("snaps to segment midpoints", () => {
    const ref = reference([{ start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } }]);
    const result = snapToReferenceGeometry({ x: 5000, y: -4990 }, [ref], 0.08);
    expect(result?.kind).toBe("midpoint");
    expect(result?.point.x).toBeCloseTo(5000);
  });

  it("snaps to intersections between extracted segments from the same image", () => {
    const ref = reference([
      { start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } },
      { start: { x: 0.5, y: 0.1 }, end: { x: 0.5, y: 0.9 } },
    ]);
    const result = snapToReferenceGeometry({ x: 5010, y: -4990 }, [ref], 0.08);
    expect(result?.kind).toBe("intersection");
    expect(result?.point).toEqual({ x: 5000, y: -5000 });
  });

  it("provides horizontal and vertical alignment guides without forcing a snap", () => {
    const ref = reference([
      { start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } },
      { start: { x: 0.5, y: 0.1 }, end: { x: 0.5, y: 0.9 } },
    ]);
    const horizontal = snapToReferenceGeometry({ x: 3000, y: -4990 }, [ref], 0.08);
    expect(horizontal?.kind).toBe("horizontal");
    expect(horizontal?.guides).toHaveLength(1);
    const dual = snapToReferenceGeometry({ x: 5010, y: -3000 }, [ref], 0.08);
    expect(dual?.guides).toHaveLength(2);
    expect(dual?.point).toEqual({ x: 5000, y: -5000 });
  });

  it("ignores hidden or unanalyzed references", () => {
    const ref = reference(undefined);
    expect(snapToReferenceGeometry({ x: 1000, y: -5000 }, [ref], 0.08)).toBeNull();
    expect(snapToReferenceGeometry({ x: 1000, y: -5000 }, [{ ...ref, visible: false, detectedSegments: [{ start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 } }] }], 0.08)).toBeNull();
  });
});
