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

/** Small keyboard-input state holder for one in-progress segment. */
export class TemporaryDimensionSession {
  text = "";

  get isEmpty(): boolean { return this.text.length === 0; }
  get isValid(): boolean { return this.isEmpty || parseDraftInput(this.text) !== null; }

  append(character: string): boolean {
    const key = character.toLowerCase();
    const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
    const allowedSymbol = /^[0-9.+@<°-]$/.test(character);
    const allowedSuffix = (key === "d" && numeric.test(this.text))
      || (key === "e" && /d$/i.test(this.text))
      || (key === "g" && /de$/i.test(this.text));
    if (!allowedSymbol && !allowedSuffix) return false;
    this.text += character;
    return true;
  }

  backspace(): void { this.text = this.text.slice(0, -1); }
  clear(): void { this.text = ""; }

  /** Returns null for malformed input; otherwise returns the constrained preview point. */
  resolve(start: Vec2, current: Vec2): Vec2 | null {
    if (this.isEmpty) return current;
    const input = parseDraftInput(this.text);
    return input ? applyDraftInput(start, current, input) : null;
  }

  /** Commits a valid preview value and resets the keyboard session. */
  commit(start: Vec2, current: Vec2): Vec2 | null {
    const point = this.resolve(start, current);
    if (point !== null) this.clear();
    return point;
  }
}
