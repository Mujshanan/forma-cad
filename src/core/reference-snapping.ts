import type { Segment, Vec2 } from "./geometry";
import { distance, midpoint, segmentIntersection } from "./geometry";
import type { ReferenceImage } from "./model";
import { referenceImageWorldPoint } from "./reference-image";

export type ReferenceSnapKind = "endpoint" | "intersection" | "midpoint" | "horizontal" | "vertical";
export type ReferenceSnapGuide = { axis: "horizontal" | "vertical"; anchor: Vec2; coordinate: number };
export type ReferenceSnapResult = { point: Vec2; kind: ReferenceSnapKind; distancePx: number; guides: ReferenceSnapGuide[] };

type WorldSegment = { id: string; segment: Segment };

/** Derives world-space linework and snap features from analyzed calibrated references. */
export function referenceSegments(references: ReferenceImage[]): WorldSegment[] {
  const result: WorldSegment[] = [];
  for (const reference of references) {
    if (!reference.visible || !reference.detectedSegments?.length) continue;
    for (const segment of reference.detectedSegments) {
      result.push({
        id: reference.id,
        segment: {
          start: referenceImageWorldPoint(reference, segment.start),
          end: referenceImageWorldPoint(reference, segment.end),
        },
      });
    }
  }
  return result;
}

/** Endpoint > intersection > midpoint, followed by horizontal/vertical alignment guides. */
export function snapToReferenceGeometry(
  cursor: Vec2,
  references: ReferenceImage[],
  viewScale: number,
  tolerancePx = 10,
): ReferenceSnapResult | null {
  const segments = referenceSegments(references);
  if (!segments.length || viewScale <= 0) return null;
  const candidates: { point: Vec2; kind: ReferenceSnapKind; priority: number; distancePx: number }[] = [];
  const addCandidate = (point: Vec2, kind: ReferenceSnapKind, priority: number) => {
    const distancePx = distance(point, cursor) * viewScale;
    if (distancePx <= tolerancePx) candidates.push({ point, kind, priority, distancePx });
  };
  const anchors: Vec2[] = [];
  for (const { segment } of segments) {
    addCandidate(segment.start, "endpoint", 3);
    addCandidate(segment.end, "endpoint", 3);
    const middle = midpoint(segment.start, segment.end);
    addCandidate(middle, "midpoint", 1);
    anchors.push(segment.start, segment.end, middle);
  }
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const intersection = segmentIntersection(segments[i].segment, segments[j].segment);
    if (intersection) {
      addCandidate(intersection, "intersection", 2);
      anchors.push(intersection);
    }
  }
  candidates.sort((a, b) => b.priority - a.priority || a.distancePx - b.distancePx ||
    a.point.x - b.point.x || a.point.y - b.point.y);
  if (candidates.length) return { ...candidates[0], guides: [] };

  let horizontal: ReferenceSnapGuide | null = null;
  let vertical: ReferenceSnapGuide | null = null;
  let horizontalDistance = tolerancePx, verticalDistance = tolerancePx;
  for (const anchor of anchors) {
    const dy = Math.abs(anchor.y - cursor.y) * viewScale;
    const dx = Math.abs(anchor.x - cursor.x) * viewScale;
    if (dy < horizontalDistance) { horizontalDistance = dy; horizontal = { axis: "horizontal", anchor, coordinate: anchor.y }; }
    if (dx < verticalDistance) { verticalDistance = dx; vertical = { axis: "vertical", anchor, coordinate: anchor.x }; }
  }
  if (!horizontal && !vertical) return null;
  const guides = [horizontal, vertical].filter((guide): guide is ReferenceSnapGuide => guide !== null);
  const point = horizontal && vertical
    ? { x: vertical.coordinate, y: horizontal.coordinate }
    : horizontal ? { x: cursor.x, y: horizontal.coordinate } : { x: vertical!.coordinate, y: cursor.y };
  const kind = horizontal && vertical ? "intersection" : horizontal ? "horizontal" : "vertical";
  return { point, kind, distancePx: distance(point, cursor) * viewScale, guides };
}
