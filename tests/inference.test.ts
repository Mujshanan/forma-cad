import { describe,it,expect } from "vitest";
import { infer } from "../src/core/inference";
import { SpatialIndex } from "../src/core/spatial";
import type { Entity } from "../src/core/model";
const line:Entity={id:"L1",type:"line",layer:"S-BEAM",start:{x:0,y:0},end:{x:1000,y:0}};
describe("inference",()=>{
 const index=()=>{const x=new SpatialIndex(500);x.insert(line);return x;};
 it("prefers endpoint over nearest",()=>{const r=infer({x:2,y:1},{},index(),1);expect(r.snaps[0]?.type).toBe("endpoint");expect(r.point).toEqual({x:0,y:0});});
 it("finds midpoint",()=>{const r=infer({x:500,y:2},{},index(),1);expect(r.snaps[0]?.type).toBe("midpoint");});
 it("scales tolerance with zoom",()=>{expect(infer({x:0,y:8},{},index(),1).snaps.length).toBe(1);expect(infer({x:0,y:8},{},index(),2).snaps.length).toBe(0);});
 it("finds nearest point on line",()=>{const r=infer({x:400,y:5},{},index(),1);expect(r.snaps[0]?.type).toBe("nearest");expect(r.point).toEqual({x:400,y:0});});
 it("emits horizontal tracking alignment",()=>{const r=infer({x:400,y:0.1},{lastPoint:{x:400,y:300} },index(),1);expect(r.guides.some(g=>g.type==="horizontal")).toBe(true);});
});