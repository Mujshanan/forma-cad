import { describe, expect, it } from "vitest";
import { infer } from "../src/core/inference";
import { AlignmentTracker } from "../src/core/alignment-tracker";
import { SpatialIndex } from "../src/core/spatial";

describe("alignment reference inference", () => {
  it("keeps a vertical tracking guide after the source endpoint leaves the spatial query", () => {
    const index = new SpatialIndex(100);
    index.insert({
      id: "REF",
      type: "line",
      layer: "S-ANNO",
      start: { x: 0, y: 100 },
      end: { x: 100, y: 100 },
    });
    const alignmentTracker = new AlignmentTracker();

    infer({ x: 100, y: 100 }, { lastPoint: { x: 0, y: 0 }, alignmentTracker }, index, 1);
    const result = infer(
      { x: 100, y: 140 },
      { lastPoint: { x: 0, y: 0 }, alignmentTracker },
      index,
      1,
    );

    expect(result.guides.some(guide =>
      guide.type === "vertical" &&
      guide.entityId === "REF" &&
      guide.start.x === 100 &&
      guide.end.x === 100
    )).toBe(true);
  });
});
