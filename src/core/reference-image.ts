import type { Vec2 } from "./geometry";
import type { ReferenceImage } from "./model";

export function referenceImageHeight(reference: Pick<ReferenceImage, "pixelWidth" | "pixelHeight" | "widthMm">): number {
  if (reference.pixelWidth <= 0 || reference.pixelHeight <= 0 || reference.widthMm <= 0) {
    throw new Error("Reference image dimensions and scale must be positive");
  }
  return reference.widthMm * reference.pixelHeight / reference.pixelWidth;
}

/** Returns the image's four world-space corners after scale, anchor and rotation. */
export function referenceImageCorners(reference: ReferenceImage): Vec2[] {
  const height = referenceImageHeight(reference);
  const left = reference.anchor === "center" ? -reference.widthMm / 2 : 0;
  const top = reference.anchor === "center" ? height / 2 : 0;
  const local = [
    { x: left, y: top },
    { x: left + reference.widthMm, y: top },
    { x: left + reference.widthMm, y: top - height },
    { x: left, y: top - height },
  ];
  const angle = reference.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return local.map(point => ({
    x: reference.position.x + point.x * cos - point.y * sin,
    y: reference.position.y + point.x * sin + point.y * cos,
  }));
}

export function referenceImageSvgTransform(reference: ReferenceImage): string {
  return `translate(${reference.position.x} ${-reference.position.y}) rotate(${-reference.rotation})`;
}

export function referenceImageLocalOffset(reference: ReferenceImage): Vec2 {
  const height = referenceImageHeight(reference);
  return reference.anchor === "center"
    ? { x: -reference.widthMm / 2, y: -height / 2 }
    : { x: 0, y: 0 };
}

const rotate = (point: Vec2, angle: number): Vec2 => ({
  x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
  y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
});

/** Converts a world-space pick into normalized image coordinates, or null outside the image. */
export function referenceImageNormalizedPoint(reference: ReferenceImage, worldPoint: Vec2): Vec2 | null {
  const height = referenceImageHeight(reference);
  const angle = -reference.rotation * Math.PI / 180;
  const local = rotate({ x: worldPoint.x - reference.position.x, y: worldPoint.y - reference.position.y }, angle);
  const left = reference.anchor === "center" ? -reference.widthMm / 2 : 0;
  const top = reference.anchor === "center" ? height / 2 : 0;
  const x = (local.x - left) / reference.widthMm;
  const y = (top - local.y) / height;
  const epsilon = 1e-6;
  if (x < -epsilon || x > 1 + epsilon || y < -epsilon || y > 1 + epsilon) return null;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

/**
 * Scales an image so two picked points match a known distance. The first picked
 * point remains fixed in world space, regardless of image anchor or rotation.
 */
export function calibrateReferenceImage(
  reference: ReferenceImage,
  pointA: Vec2,
  pointB: Vec2,
  actualDistanceMm: number,
): ReferenceImage {
  if (!Number.isFinite(actualDistanceMm) || actualDistanceMm <= 0) {
    throw new Error("Calibration distance must be a positive number");
  }
  const measuredDistance = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
  if (!Number.isFinite(measuredDistance) || measuredDistance <= 1e-9) {
    throw new Error("Calibration points must be different");
  }
  const normalizedA = referenceImageNormalizedPoint(reference, pointA);
  const normalizedB = referenceImageNormalizedPoint(reference, pointB);
  if (!normalizedA || !normalizedB) throw new Error("Calibration points must be inside the reference image");

  const factor = actualDistanceMm / measuredDistance;
  const widthMm = reference.widthMm * factor;
  const heightMm = referenceImageHeight({ ...reference, widthMm });
  const left = reference.anchor === "center" ? -widthMm / 2 : 0;
  const top = reference.anchor === "center" ? heightMm / 2 : 0;
  const localA = { x: left + normalizedA.x * widthMm, y: top - normalizedA.y * heightMm };
  const rotatedA = rotate(localA, reference.rotation * Math.PI / 180);
  return {
    ...reference,
    widthMm,
    position: { x: pointA.x - rotatedA.x, y: pointA.y - rotatedA.y },
    calibration: { actualDistanceMm, pointA: normalizedA, pointB: normalizedB },
  };
}


/** Converts normalized source-image coordinates to world coordinates. */
export function referenceImageWorldPoint(reference: ReferenceImage, normalized: Vec2): Vec2 {
  const height = referenceImageHeight(reference);
  const left = reference.anchor === "center" ? -reference.widthMm / 2 : 0;
  const top = reference.anchor === "center" ? height / 2 : 0;
  const local = { x: left + normalized.x * reference.widthMm, y: top - normalized.y * height };
  const angle = reference.rotation * Math.PI / 180;
  return {
    x: reference.position.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
    y: reference.position.y + local.x * Math.sin(angle) + local.y * Math.cos(angle),
  };
}
