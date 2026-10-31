import { describe, expect, it } from "vitest";
import { screenToWorld, worldToScreen, zoomAt } from "../src/core/view";

describe("view transforms", () => {
  it("round-trips world and screen coordinates", () => {
    const view = { origin: { x: 420, y: 280 }, scale: 0.08 };
    const point = { x: 1250, y: -740 };
    const screen = worldToScreen(point, view);
    expect(screenToWorld(screen, view).x).toBeCloseTo(point.x);
    expect(screenToWorld(screen, view).y).toBeCloseTo(point.y);
  });

  it("keeps the world point under the cursor fixed while zooming", () => {
    const view = { origin: { x: 400, y: 300 }, scale: 0.1 };
    const anchor = { x: 560, y: 220 };
    const before = screenToWorld(anchor, view);
    const after = screenToWorld(anchor, zoomAt(view, anchor, 1.5));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("clamps zoom to a safe range", () => {
    expect(zoomAt({ origin: { x: 0, y: 0 }, scale: 1 }, { x: 0, y: 0 }, 100).scale).toBe(4);
  });
});
