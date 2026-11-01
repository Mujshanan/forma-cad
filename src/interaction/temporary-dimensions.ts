import type { Vec2 } from "../core/geometry";

export type TemporaryDimensions = {
  dx: number;
  dy: number;
  length: number;
  angleDeg: number;
};

export type DraftInput =
  | { kind: "length"; value: number }
  | { kind: "angle"; value: number }
  | { kind: "polar"; length: number; angleDeg: number };

/** Calculates live dimensions in world units (millimetres) and degrees. */
export function calculateTemporaryDimensions(start: Vec2, end: Vec2): TemporaryDimensions {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return { dx, dy, length: Math.hypot(dx, dy), angleDeg: Math.atan2(dy, dx) * 180 / Math.PI };
}

/**
 * Parses drafting input without changing document geometry.
 * Examples: "450" (length), "30°" (angle), "@450<30" (length at angle).
 */
export function parseDraftInput(raw: string): DraftInput | null {
  const input = raw.trim().replace(/\s+/g, "");
  if (!input) return null;

  const polar = input.match(/^@([+]?(?:\d+\.?\d*|\.\d+))<([+-]?(?:\d+\.?\d*|\.\d+))$/);
  if (polar) {
    const length = Number(polar[1]);
    const angleDeg = Number(polar[2]);
    return Number.isFinite(length) && length > 0 && Number.isFinite(angleDeg)
      ? { kind: "polar", length, angleDeg } : null;
  }

  const angle = input.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:°|deg)$/i);
  if (angle) {
    const value = Number(angle[1]);
    return Number.isFinite(value) ? { kind: "angle", value } : null;
  }

  const length = input.match(/^([+]?(?:\d+\.?\d*|\.\d+))$/);
  if (length) {
    const value = Number(length[1]);
    return Number.isFinite(value) && value > 0 ? { kind: "length", value } : null;
  }
  return null;
}

/** Applies typed input to a live preview point; never mutates the start point. */
export function applyDraftInput(start: Vec2, current: Vec2, input: DraftInput): Vec2 {
  const live = calculateTemporaryDimensions(start, current);
  const angleDeg = input.kind === "angle" ? input.value
    : input.kind === "polar" ? input.angleDeg : live.angleDeg;
  const magnitude = input.kind === "length" ? input.value
    : input.kind === "polar" ? input.length : live.length;
  const radians = angleDeg * Math.PI / 180;
  return { x: start.x + Math.cos(radians) * magnitude, y: start.y + Math.sin(radians) * magnitude };
}
