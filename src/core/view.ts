import type { Vec2 } from "./geometry";

export type ViewTransform = {
  origin: Vec2;
  scale: number;
};

export function worldToScreen(point: Vec2, view: ViewTransform): Vec2 {
  return {
    x: view.origin.x + point.x * view.scale,
    y: view.origin.y - point.y * view.scale
  };
}

export function screenToWorld(point: Vec2, view: ViewTransform): Vec2 {
  return {
    x: (point.x - view.origin.x) / view.scale,
    y: (view.origin.y - point.y) / view.scale
  };
}

/** Zoom around a screen-space anchor without moving the world point under it. */
export function zoomAt(view: ViewTransform, anchor: Vec2, factor: number, min = 0.0005, max = 4): ViewTransform {
  const worldAnchor = screenToWorld(anchor, view);
  const nextScale = Math.max(min, Math.min(max, view.scale * factor));
  return {
    scale: nextScale,
    origin: {
      x: anchor.x - worldAnchor.x * nextScale,
      y: anchor.y + worldAnchor.y * nextScale
    }
  };
}
