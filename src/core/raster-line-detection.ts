import type { Segment } from "./geometry";

/**
 * Detect long, approximately straight dark strokes in a raster plan using a
 * bounded Hough transform. Returns normalized image-space segments (0..1).
 * This is deliberately conservative: it favors long plan edges over text detail.
 */
export function detectRasterSegments(
  rgba: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension = 600,
): Segment[] {
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) || sourceWidth < 2 || sourceHeight < 2) return [];
  if (rgba.length < sourceWidth * sourceHeight * 4) throw new Error("Raster pixel buffer is incomplete");
  const factor = Math.max(1, Math.ceil(Math.max(sourceWidth, sourceHeight) / maxDimension));
  const width = Math.max(2, Math.floor(sourceWidth / factor));
  const height = Math.max(2, Math.floor(sourceHeight / factor));
  const pixels: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const sx = Math.min(sourceWidth - 1, x * factor), sy = Math.min(sourceHeight - 1, y * factor);
    const at = (sy * sourceWidth + sx) * 4;
    const alpha = rgba[at + 3];
    if (alpha < 128) continue;
    const gray = rgba[at] * 0.299 + rgba[at + 1] * 0.587 + rgba[at + 2] * 0.114;
    if (gray < 150) pixels.push({ x, y });
  }
  if (pixels.length < 20) return [];

  const diagonal = Math.ceil(Math.hypot(width, height));
  const rhoCount = diagonal * 2 + 1;
  const thetaCount = 180;
  const cos = Array.from({ length: thetaCount }, (_, t) => Math.cos(t * Math.PI / thetaCount));
  const sin = Array.from({ length: thetaCount }, (_, t) => Math.sin(t * Math.PI / thetaCount));
  const accumulator = new Uint32Array(thetaCount * rhoCount);
  // Bound work on unusually dense scans while retaining a spatially distributed sample.
  const stride = Math.max(1, Math.ceil(pixels.length / 70000));
  for (let p = 0; p < pixels.length; p += stride) {
    const point = pixels[p];
    for (let t = 0; t < thetaCount; t++) {
      const rho = Math.round(point.x * cos[t] + point.y * sin[t]) + diagonal;
      accumulator[t * rhoCount + rho]++;
    }
  }

  const threshold = Math.max(12, Math.min(width, height) * 0.055 / stride);
  const peaks: { theta: number; rho: number; votes: number }[] = [];
  for (let t = 0; t < thetaCount; t++) for (let r = 1; r < rhoCount - 1; r++) {
    const votes = accumulator[t * rhoCount + r];
    if (votes < threshold) continue;
    let maximum = true;
    for (let dt = -2; dt <= 2 && maximum; dt++) for (let dr = -4; dr <= 4; dr++) {
      if (!dt && !dr) continue;
      const nt = (t + dt + thetaCount) % thetaCount;
      const nr = r + dr;
      if (nr >= 0 && nr < rhoCount && accumulator[nt * rhoCount + nr] > votes) { maximum = false; break; }
    }
    if (maximum) peaks.push({ theta: t, rho: r - diagonal, votes });
  }
  peaks.sort((a, b) => b.votes - a.votes);

  const results: Segment[] = [];
  const minLength = Math.max(18, Math.min(width, height) * 0.025);
  for (const peak of peaks) {
    if (results.length >= 100) break;
    const c = cos[peak.theta], s = sin[peak.theta];
    const direction = { x: -s, y: c };
    const inliers = pixels
      .filter(p => Math.abs(p.x * c + p.y * s - peak.rho) <= 1.6)
      .map(p => p.x * direction.x + p.y * direction.y)
      .sort((a, b) => a - b);
    if (inliers.length < Math.max(10, threshold)) continue;
    let start = inliers[0], previous = start;
    const ranges: [number, number][] = [];
    for (let i = 1; i < inliers.length; i++) {
      const value = inliers[i];
      if (value - previous > 9) {
        if (previous - start >= minLength) ranges.push([start, previous]);
        start = value;
      }
      previous = value;
    }
    if (previous - start >= minLength) ranges.push([start, previous]);
    for (const [a, b] of ranges) {
      const origin = { x: c * peak.rho, y: s * peak.rho };
      const p1 = { x: origin.x + direction.x * a, y: origin.y + direction.y * a };
      const p2 = { x: origin.x + direction.x * b, y: origin.y + direction.y * b };
      if (p1.x < -2 || p1.y < -2 || p2.x > width + 2 || p2.y > height + 2) continue;
      const candidate: Segment = {
        start: { x: Math.max(0, Math.min(1, p1.x * factor / sourceWidth)), y: Math.max(0, Math.min(1, p1.y * factor / sourceHeight)) },
        end: { x: Math.max(0, Math.min(1, p2.x * factor / sourceWidth)), y: Math.max(0, Math.min(1, p2.y * factor / sourceHeight)) },
      };
      const duplicate = results.some(existing => {
        const sameDirection = Math.abs(existing.start.x - candidate.start.x) < 0.008 &&
          Math.abs(existing.start.y - candidate.start.y) < 0.008 &&
          Math.abs(existing.end.x - candidate.end.x) < 0.008 &&
          Math.abs(existing.end.y - candidate.end.y) < 0.008;
        const reverse = Math.abs(existing.start.x - candidate.end.x) < 0.008 &&
          Math.abs(existing.start.y - candidate.end.y) < 0.008 &&
          Math.abs(existing.end.x - candidate.start.x) < 0.008 &&
          Math.abs(existing.end.y - candidate.start.y) < 0.008;
        return sameDirection || reverse;
      });
      if (!duplicate) results.push(candidate);
    }
  }
  return results;
}
