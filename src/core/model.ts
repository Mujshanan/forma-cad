import type { Segment, Vec2 } from "./geometry";
export type EntityStyle = { color?: string; lineweight?: number; linetype?: string };
export type BaseEntity = { id: string; layer: string; style?: EntityStyle };
export type LineEntity = BaseEntity & { type: "line" | "grid"; start: Vec2; end: Vec2; label?: string };
export type PolylineEntity = BaseEntity & { type: "polyline"; points: Vec2[]; closed?: boolean };
export type CircleEntity = BaseEntity & { type: "circle"; center: Vec2; radius: number };
export type ArcEntity = BaseEntity & { type: "arc"; center: Vec2; radius: number; startAngle: number; endAngle: number };
export type ColumnEntity = BaseEntity & { type: "column"; center: Vec2; width: number; height: number };
export type BeamEntity = BaseEntity & { type: "beam"; start: Vec2; end: Vec2; section?: string };
export type WallEntity = BaseEntity & { type: "wall"; start: Vec2; end: Vec2; thickness: number };
export type TextEntity = BaseEntity & { type: "text"; position: Vec2; value: string; height: number };
export type Entity = LineEntity | PolylineEntity | CircleEntity | ArcEntity | ColumnEntity | BeamEntity | WallEntity | TextEntity;
export type Layer = { name: string; color: string; lineweight: number; linetype: string };
export type ReferenceImage = {
  id: string;
  name: string;
  dataUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  widthMm: number;
  position: Vec2;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  anchor: "origin" | "center";
  calibration?: { actualDistanceMm: number; pointA: Vec2; pointB: Vec2 };
  detectedSegments?: Segment[];
};
export type DocumentModel = { units: "mm"; entities: Entity[]; layers: Layer[]; references: ReferenceImage[] };
export const DEFAULT_LAYERS: Layer[] = [
  { name: "S-GRID", color: "#888888", lineweight: 0.18, linetype: "DASHED" },
  { name: "S-COLS", color: "#d94841", lineweight: 0.35, linetype: "CONTINUOUS" },
  { name: "S-BEAM", color: "#3267a8", lineweight: 0.30, linetype: "CONTINUOUS" },
  { name: "S-WALL", color: "#777777", lineweight: 0.30, linetype: "CONTINUOUS" },
  { name: "S-ANNO", color: "#222222", lineweight: 0.18, linetype: "CONTINUOUS" }
];
export const createDocument = (): DocumentModel => ({ units: "mm", entities: [], layers: DEFAULT_LAYERS.map(layer => ({ ...layer })), references: [] });