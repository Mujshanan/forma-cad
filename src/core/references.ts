import type { Segment, Vec2 } from "./geometry";
import type { Entity } from "./model";

export type ReferencePointRole = "center" | "corner" | "edge-midpoint" | "endpoint" | "arc-midpoint";
export type ReferenceSegmentRole = "edge" | "centerline" | "axis";

export type ReferencePoint = { point: Vec2; role: ReferencePointRole };
export type ReferenceSegment = { segment: Segment; role: ReferenceSegmentRole };
export type EntityReferenceGeometry = { points: ReferencePoint[]; segments: ReferenceSegment[] };

const point = (x: number, y: number): Vec2 => ({ x, y });

/**
 * Exposes reusable world-space reference geometry for inference.
 * The returned geometry is derived from the document entity and never mutates it.
 */
export function getReferenceGeometry(entity: Entity): EntityReferenceGeometry {
  switch (entity.type) {
    case "line":
    case "grid":
      return {
        points: [
          { point: entity.start, role: "endpoint" },
          { point: entity.end, role: "endpoint" },
        ],
        segments: [{ segment: { start: entity.start, end: entity.end }, role: entity.type === "grid" ? "axis" : "edge" }],
      };
    case "beam":
    case "wall":
      return {
        points: [
          { point: entity.start, role: "endpoint" },
          { point: entity.end, role: "endpoint" },
        ],
        segments: [{ segment: { start: entity.start, end: entity.end }, role: "centerline" }],
      };
    case "polyline": {
      const segments = entity.points.slice(1).map((p, i) => ({ segment: { start: entity.points[i], end: p }, role: "edge" as const }));
      if (entity.closed && entity.points.length > 2) {
        segments.push({ segment: { start: entity.points[entity.points.length - 1], end: entity.points[0] }, role: "edge" });
      }
      return { points: entity.points.map(p => ({ point: p, role: "corner" })), segments };
    }
    case "column": {
      const left = entity.center.x - entity.width / 2;
      const right = entity.center.x + entity.width / 2;
      const bottom = entity.center.y - entity.height / 2;
      const top = entity.center.y + entity.height / 2;
      const corners = [point(left, bottom), point(right, bottom), point(right, top), point(left, top)];
      const segments = corners.map((p, i) => ({ segment: { start: p, end: corners[(i + 1) % corners.length] }, role: "edge" as const }));
      const edgeMidpoints = segments.map(({ segment }) => ({ x: (segment.start.x + segment.end.x) / 2, y: (segment.start.y + segment.end.y) / 2 }));
      return {
        points: [
          { point: entity.center, role: "center" },
          ...corners.map(p => ({ point: p, role: "corner" as const })),
          ...edgeMidpoints.map(p => ({ point: p, role: "edge-midpoint" as const })),
        ],
        segments,
      };
    }
    case "circle":
      return { points: [{ point: entity.center, role: "center" }], segments: [] };
    case "arc": {
      const tau = Math.PI * 2;
      const rawSweep = entity.endAngle - entity.startAngle;
      const sweep = Math.abs(rawSweep) >= tau - 1e-9 ? tau : ((rawSweep % tau) + tau) % tau;
      const at = (angle: number): Vec2 => point(
        entity.center.x + Math.cos(angle) * entity.radius,
        entity.center.y + Math.sin(angle) * entity.radius,
      );
      return {
        points: [
          { point: entity.center, role: "center" },
          { point: at(entity.startAngle), role: "endpoint" },
          { point: at(entity.endAngle), role: "endpoint" },
          { point: at(entity.startAngle + sweep / 2), role: "arc-midpoint" },
        ],
        segments: [],
      };
    }
    case "text":
      return { points: [], segments: [] };
  }
}
