import { describe, it, expect } from "vitest";
import { projectPointOnSegment, pointOnSegment, distance } from "../src/core/geometry";

describe("seeded geometry invariants", () => {
  it("keeps projected points on their source segments for deterministic samples", () => {
    let seed = 0x5eed1234;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    for (let i = 0; i < 500; i++) {
      const start = { x: random() * 2000 - 1000, y: random() * 2000 - 1000 };
      const end = { x: random() * 2000 - 1000, y: random() * 2000 - 1000 };
      const cursor = { x: random() * 4000 - 2000, y: random() * 4000 - 2000 };
      const projected = projectPointOnSegment(cursor, { start, end });
      expect(pointOnSegment(projected, { start, end }, 1e-7)).toBe(true);
      expect(distance(projected, start)).toBeLessThanOrEqual(distance(end, start) + 1e-7);
    }
  });

  it("returns the same projection when projecting an already projected point", () => {
    const segment = { start: { x: -125, y: 70 }, end: { x: 830, y: -415 } };
    let seed = 123456789;
    for (let i = 0; i < 200; i++) {
      seed = (1103515245 * seed + 12345) >>> 0;
      const cursor = { x: (seed % 10000) - 5000, y: ((seed * 7) % 10000) - 5000 };
      const once = projectPointOnSegment(cursor, segment);
      const twice = projectPointOnSegment(once, segment);
      expect(distance(once, twice)).toBeLessThan(1e-7);
    }
  });
});
