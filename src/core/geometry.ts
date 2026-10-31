/** Pure 2D geometry primitives. World coordinates are millimetres, Y-up. */
export interface Vec2 { x: number; y: number }
export interface Segment { start: Vec2; end: Vec2 }
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const lengthSq = (v: Vec2): number => dot(v, v);
export const length = (v: Vec2): number => Math.hypot(v.x, v.y);
export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));
export const normalize = (v: Vec2): Vec2 => { const n = length(v); return n <= 1e-12 ? { x: 0, y: 0 } : scale(v, 1 / n); };
export const midpoint = (a: Vec2, b: Vec2): Vec2 => scale(add(a, b), 0.5);
export const almostEqual = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;
export const projectPointOnLine = (p: Vec2, line: Segment): Vec2 => {
  const d = sub(line.end, line.start); const den = lengthSq(d);
  return den <= 1e-18 ? { ...line.start } : add(line.start, scale(d, dot(sub(p, line.start), d) / den));
};
export const projectPointOnSegment = (p: Vec2, segment: Segment): Vec2 => {
  const d = sub(segment.end, segment.start); const den = lengthSq(d);
  if (den <= 1e-18) return { ...segment.start };
  const t = Math.max(0, Math.min(1, dot(sub(p, segment.start), d) / den));
  return add(segment.start, scale(d, t));
};
export const pointOnSegment = (p: Vec2, s: Segment, eps = 1e-8): boolean => {
  const d = sub(s.end, s.start); const q = sub(p, s.start);
  return Math.abs(cross(d, q)) <= eps * Math.max(1, length(d)) && dot(q, sub(p, s.end)) <= eps;
};
/** Infinite-line intersection; parallel or coincident lines return null. */
export const lineIntersection = (a: Segment, b: Segment, eps = 1e-12): Vec2 | null => {
  const r = sub(a.end, a.start), s = sub(b.end, b.start), den = cross(r, s);
  if (Math.abs(den) <= eps) return null;
  const t = cross(sub(b.start, a.start), s) / den;
  return add(a.start, scale(r, t));
};
/** Finite segment intersection. */
export const segmentIntersection = (a: Segment, b: Segment, eps = 1e-9): Vec2 | null => {
  const p = lineIntersection(a, b, eps); return p && pointOnSegment(p, a, eps) && pointOnSegment(p, b, eps) ? p : null;
};
export const angleOf = (v: Vec2): number => Math.atan2(v.y, v.x);
export const fromAngle = (angle: number, magnitude = 1): Vec2 => ({ x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude });
export const perpendicular = (v: Vec2): Vec2 => ({ x: -v.y, y: v.x });
export const distancePointToLine = (p: Vec2, s: Segment): number => distance(p, projectPointOnLine(p, s));
export const distancePointToSegment = (p: Vec2, s: Segment): number => distance(p, projectPointOnSegment(p, s));
export const boundsOfSegment = (s: Segment) => ({ minX: Math.min(s.start.x, s.end.x), minY: Math.min(s.start.y, s.end.y), maxX: Math.max(s.start.x, s.end.x), maxY: Math.max(s.start.y, s.end.y) });