import { describe,it,expect } from "vitest";
import { infer } from "../src/core/inference";
import { SpatialIndex } from "../src/core/spatial";
import type { Entity } from "../src/core/model";
const line:Entity={id:"L1",type:"line",layer:"S-BEAM",start:{x:0,y:0},end:{x:1000,y:0}};
describe("inference",()=>{
 const index=()=>{const x=new SpatialIndex(500);x.insert(line);return x;};
 it("prefers endpoint over nearest",()=>{const r=infer({x:2,y:1},{},index(),1);expect(r.snaps[0]?.type).toBe("endpoint");expect(r.point).toEqual({x:0,y:0});});
 it("finds midpoint",()=>{const r=infer({x:500,y:2},{},index(),1);expect(r.snaps[0]?.type).toBe("midpoint");});
 it("scales tolerance with zoom",()=>{expect(infer({x:0,y:8},{},index(),1).snaps[0]?.type).toBe("endpoint");expect(infer({x:0,y:8},{},index(),2).snaps.length).toBe(0);});
 it("finds nearest point on line",()=>{const r=infer({x:400,y:5},{},index(),1);expect(r.snaps[0]?.type).toBe("nearest");expect(r.point).toEqual({x:400,y:0});});
 it("emits tracking alignment guides",()=>{const r=infer({x:2,y:0.1},{lastPoint:{x:2,y:300}},index(),1);expect(r.guides.some(g=>g.type==="horizontal")).toBe(true);});
 it("snaps to finite segment intersection",()=>{const x=index();x.insert({id:"L2",type:"line",layer:"S-BEAM",start:{x:300,y:-500},end:{x:300,y:700}});const r=infer({x:301,y:1},{},x,1);expect(r.snaps[0]?.type).toBe("intersection");expect(r.point).toEqual({x:300,y:0});});
 it("snaps to arc endpoints and midpoint",()=>{const x=new SpatialIndex(500);x.insert({id:"A1",type:"arc",layer:"S-ANNO",center:{x:0,y:0},radius:100,startAngle:0,endAngle:Math.PI/2});expect(infer({x:100,y:1},{},x,1).snaps[0]?.type).toBe("endpoint");expect(infer({x:70.71,y:70.71},{},x,1).snaps[0]?.type).toBe("midpoint");});
 it("does not snap to the unused part of an arc circle",()=>{const x=new SpatialIndex(500);x.insert({id:"A1",type:"arc",layer:"S-ANNO",center:{x:0,y:0},radius:100,startAngle:0,endAngle:Math.PI/2});expect(infer({x:0,y:-100},{},x,1).snaps.length).toBe(0);});
 it("detects a structural grid crossing",()=>{const x=new SpatialIndex(500);x.insert({id:"G1",type:"grid",layer:"S-GRID",start:{x:0,y:0},end:{x:1000,y:0}});x.insert({id:"G2",type:"grid",layer:"S-GRID",start:{x:300,y:-500},end:{x:300,y:500}});const r=infer({x:301,y:1},{},x,1);expect(r.snaps.some(s=>s.type==="grid")).toBe(true);});
 it("locks Shift to the supplied drawing direction",()=>{const r=infer({x:100,y:100},{lastPoint:{x:0,y:0},direction:{x:1,y:0},shift:true},index(),1);expect(r.point.y).toBeCloseTo(0);expect(r.guides.some(g=>g.type==="polar")).toBe(true);});
 it("snaps to a column center through shared reference geometry",()=>{
  const x=new SpatialIndex(500);x.insert({id:"C1",type:"column",layer:"S-COLS",center:{x:100,y:100},width:400,height:400});
  const r=infer({x:101,y:100},{},x,1);
  expect(r.snaps.some(s=>s.type==="center" && s.point.x===100 && s.point.y===100)).toBe(true);
 });
 it("orders equidistant candidates deterministically",()=>{
  const x=new SpatialIndex(100);
  x.insert({id:"RIGHT",type:"line",layer:"S-BEAM",start:{x:2,y:0},end:{x:2,y:100}});
  x.insert({id:"LEFT",type:"line",layer:"S-BEAM",start:{x:-2,y:0},end:{x:-2,y:100}});
  expect(infer({x:0,y:0},{},x,1).point).toEqual({x:-2,y:0});
 });
 it("retains the previous equal-priority snap inside the hysteresis band",()=>{
  const x=new SpatialIndex(100);x.insert({id:"A",type:"line",layer:"S-BEAM",start:{x:0,y:0},end:{x:0,y:100}});
  x.insert({id:"B",type:"line",layer:"S-BEAM",start:{x:3,y:0},end:{x:3,y:100}});
  const previous={type:"endpoint" as const,point:{x:3,y:0},entityIds:["B"],distancePx:1.6};
  const r=infer({x:1.4,y:0},{previousSnap:previous},x,1);
  expect(r.point).toEqual({x:3,y:0});
 });
 it("allows explicit candidate cycling to override hysteresis",()=>{
  const x=new SpatialIndex(100);x.insert({id:"A",type:"line",layer:"S-BEAM",start:{x:0,y:0},end:{x:0,y:100}});
  x.insert({id:"B",type:"line",layer:"S-BEAM",start:{x:3,y:0},end:{x:3,y:100}});
  const previous={type:"endpoint" as const,point:{x:3,y:0},entityIds:["B"],distancePx:1.6};
  const r=infer({x:1.4,y:0},{previousSnap:previous,candidateIndex:1},x,1);
  expect(r.point).toEqual({x:3,y:0});
 });
 it("uses the spatial hash for a 10,000-entity drawing",()=>{const x=new SpatialIndex(1000);for(let i=0;i<10000;i++)x.insert({id:`e${i}`,type:"line",layer:"S-BEAM",start:{x:i*3000,y:0},end:{x:i*3000+1000,y:0}});const result=infer({x:1,y:1},{},x,1);expect(result.snaps[0]?.type).toBe("endpoint");const start=performance.now();for(let i=0;i<250;i++)infer({x:1,y:1},{},x,1);const average=(performance.now()-start)/250;expect(average).toBeLessThan(2);});
});