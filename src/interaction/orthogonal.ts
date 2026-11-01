import type { Vec2 } from "../core/geometry";

/** Default 90-degree drafting constraint. Keeps the dominant cursor axis. */
export function constrainOrthogonal(origin: Vec2, cursor: Vec2): Vec2 {
  const dx = cursor.x - origin.x;
  const dy = cursor.y - origin.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { ...origin };
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: cursor.x, y: origin.y }
    : { x: origin.x, y: cursor.y };
}

/** Revit-style temporary free-angle override while the modifier is held. */
export function resolveDraftPoint(origin: Vec2, cursor: Vec2, orthogonal: boolean): Vec2 {
  return orthogonal ? constrainOrthogonal(origin, cursor) : { ...cursor };
}
