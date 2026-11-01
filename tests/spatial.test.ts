import { describe, it, expect } from "vitest";
import { SpatialIndex } from "../src/core/spatial";
import type { Entity } from "../src/core/model";

const line = (id: string, x: number): Entity => ({
  id, type: "line", layer: "S-BEAM",
  start: { x, y: 0 }, end: { x: x + 100, y: 0 },
});

describe("SpatialIndex lifecycle and boundaries", () => {
  it("returns no results for an empty index", () => {
    expect(new SpatialIndex(100).query({ x: 0, y: 0 }, 10)).toEqual([]);
  });

  it("finds entities touching a query at an exact cell boundary", () => {
    const index = new SpatialIndex(100);
    index.insert(line("edge", 100));
    expect(index.query({ x: 100, y: 0 }, 0).map(e => e.id)).toEqual(["edge"]);
  });

  it("deduplicates entities spanning multiple cells", () => {
    const index = new SpatialIndex(100);
    index.insert(line("long", -50));
    expect(index.query({ x: 0, y: 0 }, 200).filter(e => e.id === "long")).toHaveLength(1);
  });

  it("updates an existing ID without leaving stale cell entries", () => {
    const index = new SpatialIndex(100);
    index.insert(line("moving", 0));
    index.insert(line("moving", 1000));
    expect(index.query({ x: 0, y: 0 }, 20)).toEqual([]);
    expect(index.query({ x: 1000, y: 0 }, 20).map(e => e.id)).toEqual(["moving"]);
  });

  it("removes an entity from every occupied cell", () => {
    const index = new SpatialIndex(100);
    index.insert(line("wide", -250));
    index.remove("wide");
    expect(index.query({ x: -200, y: 0 }, 500)).toEqual([]);
  });

  it("rebuilds from the supplied entity collection", () => {
    const index = new SpatialIndex(100);
    index.insert(line("old", 0));
    index.rebuild([line("new", 500)]);
    expect(index.query({ x: 0, y: 0 }, 1000).map(e => e.id)).toEqual(["new"]);
  });

  it("rejects non-positive cell sizes", () => {
    expect(() => new SpatialIndex(0)).toThrow("cellSize must be positive");
    expect(() => new SpatialIndex(-1)).toThrow("cellSize must be positive");
  });
});
