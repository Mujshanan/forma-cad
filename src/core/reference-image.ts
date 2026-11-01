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
  const x = reference.anchor === "center" ? -reference.widthMm / 2 : 0;
  const height = referenceImageHeight(reference);
  const y = reference.anchor === "center" ? -height / 2 : 0;
  return `translate(${reference.position.x} ${-reference.position.y}) rotate(${-reference.rotation})`;
}

export function referenceImageLocalOffset(reference: ReferenceImage): Vec2 {
  const height = referenceImageHeight(reference);
  return reference.anchor === "center"
    ? { x: -reference.widthMm / 2, y: -height / 2 }
    : { x: 0, y: 0 };
}
