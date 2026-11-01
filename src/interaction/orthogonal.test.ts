import { describe, expect, it } from "vitest";
import { constrainOrthogonal, resolveDraftPoint } from "./orthogonal";

describe("orthogonal drafting", () => {
  it("locks to horizontal when horizontal movement dominates", () => {
    expect(constrainOrthogonal({ x: 10, y: 20 }, { x: 90, y: 35 })).toEqual({ x: 90, y: 20 });
  });
  it("locks to vertical when vertical movement dominates", () => {
    expect(constrainOrthogonal({ x: 10, y: 20 }, { x: 25, y: 95 })).toEqual({ x: 10, y: 95 });
  });
  it("returns the origin for a zero-length vector", () => {
    expect(constrainOrthogonal({ x: 10, y: 20 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });
  it("allows free-angle drafting when orthogonal mode is disabled", () => {
    expect(resolveDraftPoint({ x: 0, y: 0 }, { x: 40, y: 30 }, false)).toEqual({ x: 40, y: 30 });
  });
});
