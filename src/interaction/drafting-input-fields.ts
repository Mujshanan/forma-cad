import type { Vec2 } from "../core/geometry";
import { applyDraftInput, type DraftInput } from "./temporary-dimensions";

export type DraftingField = "length" | "angle";

/** Two-field keyboard input for one segment; empty fields retain the live pointer value. */
export class DraftingInputFields {
  lengthText = "";
  angleText = "";
  activeField: DraftingField = "length";

  get isEmpty(): boolean { return this.lengthText.length === 0 && this.angleText.length === 0; }

  get isValid(): boolean {
    if (this.isEmpty) return true;
    const length = this.lengthText === "" ? undefined : Number(this.lengthText);
    const angle = this.angleText === "" ? undefined : Number(this.angleText);
    return (length === undefined || (Number.isFinite(length) && length > 0))
      && (angle === undefined || Number.isFinite(angle));
  }

  tab(_reverse = false): DraftingField {
    this.activeField = this.activeField === "length" ? "angle" : "length";
    return this.activeField;
  }

  append(character: string): boolean {
    if (!/^[0-9.+-]$/.test(character)) return false;
    const current = this.activeField === "length" ? this.lengthText : this.angleText;
    const next = current + character;
    if (!/^[+-]?(?:\d*\.?\d*)$/.test(next)) return false;
    if (this.activeField === "length" && next.startsWith("-")) return false;
    if (this.activeField === "length") this.lengthText = next;
    else this.angleText = next;
    return true;
  }

  backspace(): void {
    if (this.activeField === "length") this.lengthText = this.lengthText.slice(0, -1);
    else this.angleText = this.angleText.slice(0, -1);
  }

  clear(): void {
    this.lengthText = "";
    this.angleText = "";
    this.activeField = "length";
  }

  toDraftInput(): DraftInput | null {
    if (!this.isValid || this.isEmpty) return null;
    const length = this.lengthText === "" ? undefined : Number(this.lengthText);
    const angleDeg = this.angleText === "" ? undefined : Number(this.angleText);
    if (length !== undefined && angleDeg !== undefined) return { kind: "polar", length, angleDeg };
    if (length !== undefined) return { kind: "length", value: length };
    if (angleDeg !== undefined) return { kind: "angle", value: angleDeg };
    return null;
  }

  resolve(start: Vec2, current: Vec2): Vec2 | null {
    if (this.isEmpty) return current;
    const input = this.toDraftInput();
    return input ? applyDraftInput(start, current, input) : null;
  }

  commit(start: Vec2, current: Vec2): Vec2 | null {
    const point = this.resolve(start, current);
    if (point !== null) this.clear();
    return point;
  }
}
