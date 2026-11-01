import { describe, expect, it } from "vitest";
import { DirectionLock } from "../src/interaction/direction-lock";

describe("Shift direction lock", () => {
  it("captures the cursor vector from the active segment origin", () => {
    const lock = new DirectionLock();
    expect(lock.lock({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual({ x: 100, y: 50 });
    expect(lock.direction).toEqual({ x: 100, y: 50 });
  });

  it("keeps the first direction until explicitly cleared", () => {
    const lock = new DirectionLock();
    lock.lock({ x: 0, y: 0 }, { x: 0, y: 100 });
    expect(lock.lock({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 0, y: 100 });
  });

  it("does not create a lock from a zero-length cursor vector", () => {
    const lock = new DirectionLock();
    expect(lock.lock({ x: 4, y: 8 }, { x: 4, y: 8 })).toBeNull();
    expect(lock.direction).toBeNull();
  });

  it("returns defensive copies so callers cannot mutate the captured direction", () => {
    const lock = new DirectionLock();
    lock.lock({ x: 0, y: 0 }, { x: 3, y: 4 });
    const direction = lock.direction!;
    direction.x = 999;
    expect(lock.direction).toEqual({ x: 3, y: 4 });
  });

  it("clears the captured direction for the next Shift press", () => {
    const lock = new DirectionLock();
    lock.lock({ x: 0, y: 0 }, { x: 0, y: 100 });
    lock.clear();
    expect(lock.direction).toBeNull();
    expect(lock.lock({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({ x: 100, y: 0 });
  });
});
