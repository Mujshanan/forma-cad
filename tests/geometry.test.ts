import { describe,it,expect } from "vitest";
import { lineIntersection, projectPointOnSegment, distance, midpoint } from "../src/core/geometry";
describe("geometry",()=>{
 it("intersects infinite lines",()=>expect(lineIntersection({start:{x:0,y:0},end:{x:10,y:10}},{start:{x:0,y:10},end:{x:10,y:0}})).toEqual({x:5,y:5}));
 it("projects onto a finite segment",()=>expect(projectPointOnSegment({x:8,y:4},{start:{x:0,y:0},end:{x:10,y:0}})).toEqual({x:8,y:0}));
 it("clamps segment projection",()=>expect(projectPointOnSegment({x:12,y:4},{start:{x:0,y:0},end:{x:10,y:0}})).toEqual({x:10,y:0}));
 it("computes distance and midpoint",()=>{expect(distance({x:0,y:0},{x:3,y:4})).toBe(5);expect(midpoint({x:0,y:0},{x:4,y:2})).toEqual({x:2,y:1});});
});