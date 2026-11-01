import { describe, it, expect } from "vitest";
import { getReferenceGeometry } from "../src/core/references";
import type { Entity } from "../src/core/model";

describe("shared entity reference geometry", () => {
  it("exposes a column center, corners, edge midpoints and four edges", () => {
    const column: Entity = { id: "C1", type: "column", layer: "S-COLS", center: { x: 100, y: 200 }, width: 400, height: 600 };
    const refs = getReferenceGeometry(column);
    expect(refs.points).toHaveLength(9);
    expect(refs.points.find(ref => ref.role === "center")?.point).toEqual({ x: 100, y: 200 });
    expect(refs.points.filter(ref => ref.role === "corner")).toHaveLength(4);
    expect(refs.points.filter(ref => ref.role === "edge-midpoint")).toHaveLength(4);
    expect(refs.segments).toHaveLength(4);
  });

  it("exposes beam endpoints and its centerline", () => {
    const beam: Entity = { id: "B1", type: "beam", layer: "S-BEAM", start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } };
    const refs = getReferenceGeometry(beam);
    expect(refs.points.map(ref => ref.point)).toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
    expect(refs.segments[0].role).toBe("centerline");
  });

  it("closes polygonal reference geometry only for closed polylines", () => {
    const polyline: Entity = { id: "P1", type: "polyline", layer: "S-ANNO", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true };
    expect(getReferenceGeometry(polyline).segments).toHaveLength(3);
  });
});
