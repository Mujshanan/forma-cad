import { describe, expect, it } from "vitest";
import { DraftingInputFields } from "../src/interaction/drafting-input-fields";

describe("two-field drafting input", () => {
  it("starts in length and switches to angle with Tab", () => {
    const fields = new DraftingInputFields();
    expect(fields.activeField).toBe("length");
    expect(fields.tab()).toBe("angle");
    expect(fields.tab(true)).toBe("length");
  });

  it("combines length and angle into an exact polar endpoint", () => {
    const fields = new DraftingInputFields();
    for (const key of "450") fields.append(key);
    fields.tab();
    for (const key of "30") fields.append(key);
    const point = fields.resolve({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(point?.x).toBeCloseTo(450 * Math.cos(Math.PI / 6));
    expect(point?.y).toBeCloseTo(225);
  });

  it("preserves the existing 30deg shorthand and does not leak suffix keys to shortcuts", () => {
    const fields = new DraftingInputFields();
    for (const key of "30deg") fields.append(key);
    expect(fields.lengthText).toBe("");
    expect(fields.angleText).toBe("30");
    expect(fields.activeField).toBe("angle");
    expect(fields.resolve({ x: 0, y: 0 }, { x: 10, y: 0 })?.x).toBeCloseTo(10 * Math.cos(Math.PI / 6));
    expect(fields.resolve({ x: 0, y: 0 }, { x: 10, y: 0 })?.y).toBeCloseTo(5);
  });

  it("uses the live pointer value for an empty field", () => {
    const fields = new DraftingInputFields();
    fields.tab();
    for (const key of "90") fields.append(key);
    const point = fields.resolve({ x: 10, y: 20 }, { x: 13, y: 24 });
    expect(point?.x).toBeCloseTo(10);
    expect(point?.y).toBeCloseTo(25);
  });

  it("rejects zero length, incomplete and non-finite values", () => {
    const fields = new DraftingInputFields();
    fields.append("0");
    expect(fields.isValid).toBe(false);
    fields.clear();
    fields.tab();
    for (const key of "9".repeat(400)) fields.append(key);
    expect(fields.isValid).toBe(false);
    fields.clear();
    fields.append(".");
    expect(fields.isValid).toBe(false);
  });

  it("edits only the active field and resets both values after commit", () => {
    const fields = new DraftingInputFields();
    for (const key of "120") fields.append(key);
    fields.tab();
    for (const key of "45") fields.append(key);
    fields.backspace();
    expect(fields.angleText).toBe("4");
    expect(fields.commit({ x: 0, y: 0 }, { x: 0, y: 10 })).not.toBeNull();
    expect(fields.isEmpty).toBe(true);
    expect(fields.activeField).toBe("length");
  });
});
