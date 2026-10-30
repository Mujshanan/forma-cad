import type { Entity } from "./model";
import type { Vec2 } from "./geometry";
import { boundsOfSegment } from "./geometry";
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
/** Uniform-grid spatial hash. Indexes entity extents; query results are deduplicated. */
export class SpatialIndex {
  private cells = new Map<string, Set<Entity>>();
  private entityCells = new Map<string, string[]>();
  constructor(readonly cellSize = 2000) { if (!(cellSize > 0)) throw new Error("cellSize must be positive"); }
  private key(x: number, y: number) { return `${x},${y}`; }
  private keys(b: Bounds): string[] {
    const out: string[] = [];
    for (let x = Math.floor(b.minX / this.cellSize); x <= Math.floor(b.maxX / this.cellSize); x++)
      for (let y = Math.floor(b.minY / this.cellSize); y <= Math.floor(b.maxY / this.cellSize); y++) out.push(this.key(x, y));
    return out;
  }
  insert(entity: Entity): void {
    this.remove(entity.id);
    const b = entityBounds(entity); const keys = this.keys(b); this.entityCells.set(entity.id, keys);
    for (const key of keys) { let cell = this.cells.get(key); if (!cell) this.cells.set(key, cell = new Set()); cell.add(entity); }
  }
  remove(id: string): void {
    for (const key of this.entityCells.get(id) ?? []) { const cell = this.cells.get(key); if (cell) { for (const e of cell) if (e.id === id) cell.delete(e); if (!cell.size) this.cells.delete(key); } }
    this.entityCells.delete(id);
  }
  rebuild(entities: Entity[]): void { this.clear(); for (const e of entities) this.insert(e); }
  clear(): void { this.cells.clear(); this.entityCells.clear(); }
  query(point: Vec2, radius: number): Entity[] {
    const found = new Map<string, Entity>(); const b = { minX: point.x-radius, minY: point.y-radius, maxX: point.x+radius, maxY: point.y+radius };
    for (const key of this.keys(b)) for (const e of this.cells.get(key) ?? []) found.set(e.id, e);
    return [...found.values()].filter(e => intersects(entityBounds(e), b));
  }
}
function intersects(a: Bounds, b: Bounds) { return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY; }
export function entityBounds(e: Entity): Bounds {
  switch (e.type) {
    case "line": case "grid": case "beam": case "wall": return boundsOfSegment(e);
    case "polyline": return { minX: Math.min(...e.points.map(p=>p.x)), minY: Math.min(...e.points.map(p=>p.y)), maxX: Math.max(...e.points.map(p=>p.x)), maxY: Math.max(...e.points.map(p=>p.y)) };
    case "circle": case "arc": return { minX:e.center.x-e.radius,minY:e.center.y-e.radius,maxX:e.center.x+e.radius,maxY:e.center.y+e.radius };
    case "column": return { minX:e.center.x-e.width/2,minY:e.center.y-e.height/2,maxX:e.center.x+e.width/2,maxY:e.center.y+e.height/2 };
    case "text": return { minX:e.position.x,minY:e.position.y,maxX:e.position.x,maxY:e.position.y };
  }
}