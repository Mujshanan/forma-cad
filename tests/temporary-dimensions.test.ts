import { describe, expect, it } from "vitest";
import { applyDraftInput, calculateTemporaryDimensions, parseDraftInput, TemporaryDimensionSession } from "../src/interaction/temporary-dimensions";

describe("temporary dimension calculations", () => {
  it("reports signed offsets, length and angle", () => {
    expect(calculateTemporaryDimensions({ x: 0, y: 0 }, { x: 300, y: 400 })).toEqual({
      dx: 300, dy: 400, length: 500, angleDeg: 53.13010235415598,
    });
  });

  it("handles a zero-length preview without non-finite values", () => {
    expect(calculateTemporaryDimensions({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual({
      dx: 0, dy: 0, length: 0, angleDeg: 0,
    });
  });

  it("parses exact length input", () => {
    expect(parseDraftInput(" 450 ")).toEqual({ kind: "length", value: 450 });
  });

  it("parses signed angle input with degree suffix", () => {
    expect(parseDraftInput("-30°")).toEqual({ kind: "angle", value: -30 });
    expect(parseDraftInput("90deg")).toEqual({ kind: "angle", value: 90 });
  });

  it("parses polar length and angle input", () => {
    expect(parseDraftInput("@500<30")).toEqual({ kind: "polar", length: 500, angleDeg: 30 });
  });

  it("rejects empty, malformed, zero and negative lengths", () => {
    for (const value of ["", "abc", "0", "-10", "@0<30", "10<20", "Infinity"]) {
      expect(parseDraftInput(value)).toBeNull();
    }
  });

  it("applies a typed length while preserving the live direction", () => {
    const point = applyDraftInput({ x: 0, y: 0 }, { x: 3, y: 4 }, { kind: "length", value: 100 });
    expect(point.x).toBeCloseTo(60);
    expect(point.y).toBeCloseTo(80);
  });

  it("applies a typed angle while preserving the live length", () => {
    const point = applyDraftInput({ x: 10, y: 20 }, { x: 13, y: 24 }, { kind: "angle", value: 0 });
    expect(point.x).toBeCloseTo(15);
    expect(point.y).toBeCloseTo(20);
  });

  it("applies exact polar input relative to the start point", () => {
    const point = applyDraftInput({ x: 100, y: 200 }, { x: 0, y: 0 }, { kind: "polar", length: 500, angleDeg: 90 });
    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(700);
  });
});

describe("temporary dimension keyboard session", () => {
  it("updates the resolved endpoint immediately as a length is typed", () => {
    const session = new TemporaryDimensionSession();
    for (const key of "250") session.append(key);
    const point = session.resolve({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(point?.x).toBeCloseTo(150);
    expect(point?.y).toBeCloseTo(200);
    expect(session.isValid).toBe(true);
  });

  it("updates the resolved endpoint when a degree-suffixed angle is completed", () => {
    const session = new TemporaryDimensionSession();
    for (const key of "90deg") session.append(key);
    const point = session.resolve({ x: 10, y: 20 }, { x: 13, y: 24 });
    expect(point?.x).toBeCloseTo(10);
    expect(point?.y).toBeCloseTo(25);
  });

  it("supports polar input and rejects an incomplete value until completed", () => {
    const session = new TemporaryDimensionSession();
    for (const key of "@500<") session.append(key);
    expect(session.resolve({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeNull();
    session.append("3");
    session.append("0");
    const point = session.resolve({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(point?.x).toBeCloseTo(433.0127);
    expect(point?.y).toBeCloseTo(250);
  });

  it("backspace repairs an invalid draft and clear cancels the input", () => {
    const session = new TemporaryDimensionSession();
    for (const key of "12x") session.append(key);
    expect(session.isValid).toBe(false);
    session.backspace();
    expect(session.resolve({ x: 0, y: 0 }, { x: 5, y: 0 })).toEqual({ x: 12, y: 0 });
    session.clear();
    expect(session.isEmpty).toBe(true);
    expect(session.resolve({ x: 0, y: 0 }, { x: 5, y: 0 })).toEqual({ x: 5, y: 0 });
  });

  it("ignores non-dimension keys so tool shortcuts remain available", () => {
    const session = new TemporaryDimensionSession();
    expect(session.append("v")).toBe(false);
    expect(session.append("l")).toBe(false);
    expect(session.isEmpty).toBe(true);
  });
});
