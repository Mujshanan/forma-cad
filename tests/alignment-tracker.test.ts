import { describe, expect, it } from "vitest";
import { AlignmentTracker } from "../src/core/alignment-tracker";

describe("persistent alignment tracker", () => {
  it("captures horizontal and vertical references independently", () => {
    const tracker = new AlignmentTracker();
    const references = tracker.update(
      { x: 100, y: 100 },
      [{ id: "A", point: { x: 100, y: 100 } }],
      10,
    );
    expect(references.map(reference => reference.axis)).toEqual(["horizontal", "vertical"]);
  });

  it("retains a captured reference after its source leaves the nearby anchor set", () => {
    const tracker = new AlignmentTracker();
    tracker.update({ x: 100, y: 100 }, [{ id: "A", point: { x: 100, y: 100 } }], 10);
    const references = tracker.update({ x: 100, y: 140 }, [], 10, 50);
    expect(references.some(reference =>
      reference.axis === "vertical" &&
      reference.coordinate === 100 &&
      reference.entityId === "A"
    )).toBe(true);
  });

  it("releases a reference after the cursor leaves its release band", () => {
    const tracker = new AlignmentTracker();
    tracker.update({ x: 100, y: 100 }, [{ id: "A", point: { x: 100, y: 100 } }], 10);
    const references = tracker.update({ x: 100, y: 151 }, [], 10, 50);
    expect(references.some(reference => reference.axis === "vertical")).toBe(true);
    expect(references.some(reference => reference.axis === "horizontal")).toBe(false);
  });

  it("uses deterministic tie-breaking when multiple anchors are equally close", () => {
    const tracker = new AlignmentTracker();
    const references = tracker.update(
      { x: 100, y: 100 },
      [
        { id: "B", point: { x: 100, y: 102 } },
        { id: "A", point: { x: 100, y: 98 } },
      ],
      10,
    );
    expect(references.find(reference => reference.axis === "vertical")?.entityId).toBe("A");
  });

  it("returns defensive anchor copies and clears both axes", () => {
    const tracker = new AlignmentTracker();
    const references = tracker.update({ x: 10, y: 20 }, [{ id: "A", point: { x: 10, y: 20 } }], 10);
    references[0].anchor.x = 999;
    expect(tracker.update({ x: 10, y: 20 }, [], 10)[0].anchor.x).toBe(10);
    tracker.clear();
    expect(tracker.update({ x: 10, y: 20 }, [], 10)).toEqual([]);
  });
});
