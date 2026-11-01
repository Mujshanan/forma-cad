import type { Vec2 } from "../core/geometry";
import { sub } from "../core/geometry";

/** Captures the cursor direction at Shift-down and keeps that vector until Shift-up. */
export class DirectionLock {
  private locked: Vec2 | null = null;

  get direction(): Vec2 | null {
    return this.locked ? { ...this.locked } : null;
  }

  lock(origin: Vec2, cursor: Vec2): Vec2 | null {
    if (this.locked) return this.direction;
    const vector = sub(cursor, origin);
    if (Math.hypot(vector.x, vector.y) <= 1e-9) return null;
    this.locked = vector;
    return this.direction;
  }

  clear(): void {
    this.locked = null;
  }
}
