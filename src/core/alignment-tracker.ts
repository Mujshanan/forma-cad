import type { Vec2 } from "./geometry";

export type AlignmentAnchor = { point: Vec2; id: string };
export type AlignmentReference = {
  axis: "horizontal" | "vertical";
  coordinate: number;
  anchor: Vec2;
  entityId: string;
};

/**
 * Remembers the last acquired horizontal and vertical tracking references.
 * References remain active while the cursor stays within the release band,
 * even after the source entity leaves the spatial query around the cursor.
 */
export class AlignmentTracker {
  private horizontal: AlignmentReference | null = null;
  private vertical: AlignmentReference | null = null;

  update(
    cursor: Vec2,
    anchors: AlignmentAnchor[],
    captureTolerance: number,
    releaseTolerance = captureTolerance * 2,
  ): AlignmentReference[] {
    this.horizontal = this.updateAxis(
      this.horizontal, "horizontal", cursor.y, anchors,
      captureTolerance, releaseTolerance,
    );
    this.vertical = this.updateAxis(
      this.vertical, "vertical", cursor.x, anchors,
      captureTolerance, releaseTolerance,
    );
    return [this.horizontal, this.vertical].filter(
      (reference): reference is AlignmentReference => reference !== null,
    ).map(reference => ({
      ...reference,
      anchor: { ...reference.anchor },
    }));
  }

  clear(): void {
    this.horizontal = null;
    this.vertical = null;
  }

  private updateAxis(
    current: AlignmentReference | null,
    axis: "horizontal" | "vertical",
    cursorCoordinate: number,
    anchors: AlignmentAnchor[],
    captureTolerance: number,
    releaseTolerance: number,
  ): AlignmentReference | null {
    if (current && Math.abs(current.coordinate - cursorCoordinate) <= releaseTolerance) {
      return current;
    }

    const coordinateOf = (anchor: AlignmentAnchor) =>
      axis === "horizontal" ? anchor.point.y : anchor.point.x;
    const candidates = anchors
      .map(anchor => ({ anchor, coordinate: coordinateOf(anchor) }))
      .filter(item => Math.abs(item.coordinate - cursorCoordinate) <= captureTolerance)
      .sort((a, b) =>
        Math.abs(a.coordinate - cursorCoordinate) - Math.abs(b.coordinate - cursorCoordinate) ||
        a.coordinate - b.coordinate ||
        a.anchor.id.localeCompare(b.anchor.id)
      );
    const selected = candidates[0];
    return selected ? {
      axis,
      coordinate: selected.coordinate,
      anchor: { ...selected.anchor.point },
      entityId: selected.anchor.id,
    } : null;
  }
}
