import type { Vec2, Segment } from "./geometry";
import { add, sub, scale, dot, length, distance, midpoint, projectPointOnLine, projectPointOnSegment, segmentIntersection, angleOf, fromAngle } from "./geometry";
import type { Entity } from "./model";
import { SpatialIndex } from "./spatial";
import { getReferenceGeometry } from "./references";
export type SnapType = "endpoint" | "midpoint" | "center" | "intersection" | "perpendicular" | "nearest" | "grid";
export type GuideType = "horizontal" | "vertical" | "extension" | "parallel" | "perpendicular" | "polar";
export type Snap = { type: SnapType; point: Vec2; entityIds: string[]; distancePx: number };
export type Guide = { type: GuideType; start: Vec2; end: Vec2; entityId?: string; angle?: number };
export type InferenceContext = { activeTool?: string; lastPoint?: Vec2; direction?: Vec2; shift?: boolean; polarIncrementDeg?: number; candidateIndex?: number; previousSnap?: Snap; hysteresisPx?: number };
export type InferenceResult = { point: Vec2; snaps: Snap[]; guides: Guide[]; label?: string };
const PRIORITY: Record<SnapType, number> = { endpoint: 7, midpoint: 6, center: 5, intersection: 4, perpendicular: 3, nearest: 2, grid: 1 };
const segmentOf = (e: Entity): Segment[] => getReferenceGeometry(e).segments.map(reference => reference.segment);
const centerOf = (e: Entity): Vec2[] => getReferenceGeometry(e).points
  .filter(reference => reference.role === "center")
  .map(reference => reference.point);
function addSnap(map: Map<string,Snap>, type: SnapType, point: Vec2, id: string, cursor: Vec2, scalePx: number) {
  const d=distance(point,cursor)*scalePx, key=`${type}:${point.x.toFixed(5)}:${point.y.toFixed(5)}`;
  const old=map.get(key); if(!old || d<old.distancePx) map.set(key,{type,point,entityIds:[...new Set([...(old?.entityIds??[]),id])],distancePx:d});
}
/** Infer stable CAD snaps and temporary tracking guides. viewScale is pixels per world unit. */
export function infer(cursorWorld: Vec2, context: InferenceContext, docIndex: SpatialIndex, viewScale: number): InferenceResult {
  const pxScale=Math.max(viewScale,1e-9), tolerance=10/pxScale, candidates=docIndex.query(cursorWorld, tolerance*2);
  const snaps=new Map<string,Snap>(); const segments: {id:string;s:Segment;grid:boolean}[]=[];
  for(const e of candidates) {
    const ss=segmentOf(e); ss.forEach(s=>segments.push({id:e.id,s,grid:e.type==="grid"}));
    for(const s of ss) {
      addSnap(snaps,"endpoint",s.start,e.id,cursorWorld,pxScale); addSnap(snaps,"endpoint",s.end,e.id,cursorWorld,pxScale);
      addSnap(snaps,"midpoint",midpoint(s.start,s.end),e.id,cursorWorld,pxScale);
    }
    for(const c of centerOf(e)) addSnap(snaps,"center",c,e.id,cursorWorld,pxScale);
    if(e.type==="grid") { const p=projectPointOnSegment(cursorWorld,ss[0]); if(distance(p,cursorWorld)<=tolerance) addSnap(snaps,"grid",p,e.id,cursorWorld,pxScale); }
    if(e.type==="circle") { const v=sub(cursorWorld,e.center), n=length(v); if(n>1e-9) addSnap(snaps,"nearest",add(e.center,scale(v,e.radius/n)),e.id,cursorWorld,pxScale); }
    if(e.type==="arc") {
      const tau=2*Math.PI, sweep=((e.endAngle-e.startAngle)%tau+tau)%tau;
      const arcStart=add(e.center,scale(fromAngle(e.startAngle),e.radius));
      const arcEnd=add(e.center,scale(fromAngle(e.endAngle),e.radius));
      const arcMid=add(e.center,scale(fromAngle(e.startAngle+sweep/2),e.radius));
      addSnap(snaps,"endpoint",arcStart,e.id,cursorWorld,pxScale);
      addSnap(snaps,"endpoint",arcEnd,e.id,cursorWorld,pxScale);
      addSnap(snaps,"midpoint",arcMid,e.id,cursorWorld,pxScale);
      const v=sub(cursorWorld,e.center), n=length(v), angle=Math.atan2(v.y,v.x);
      const offset=((angle-e.startAngle)%tau+tau)%tau;
      if(n>1e-9 && offset<=sweep+1e-9) addSnap(snaps,"nearest",add(e.center,scale(v,e.radius/n)),e.id,cursorWorld,pxScale);
    }
    for(const s of ss) { const p=projectPointOnSegment(cursorWorld,s); if(distance(p,cursorWorld)<=tolerance) addSnap(snaps,"nearest",p,e.id,cursorWorld,pxScale); }
  }
  for(let i=0;i<segments.length;i++) for(let j=i+1;j<segments.length;j++) {
    if(segments[i].id===segments[j].id) continue;
    const p=segmentIntersection(segments[i].s,segments[j].s);
    if(p && distance(p,cursorWorld)<=tolerance) {
      addSnap(snaps,"intersection",p,segments[i].id,cursorWorld,pxScale);
      if(segments[i].grid && segments[j].grid) addSnap(snaps,"grid",p,segments[i].id,cursorWorld,pxScale);
    }
  }
  if(context.lastPoint) for(const item of segments) {
    const p=projectPointOnLine(context.lastPoint,item.s);
    if(distance(p,cursorWorld)<=tolerance) addSnap(snaps,"perpendicular",p,item.id,cursorWorld,pxScale);
  }
  const sorted=[...snaps.values()].filter(s=>s.distancePx<=10).sort((a,b)=>PRIORITY[b.type]-PRIORITY[a.type] || a.distancePx-b.distancePx);
  const candidateIndex = Math.max(0, Math.min(context.candidateIndex ?? 0, Math.max(0, sorted.length - 1)));
  let selected = sorted[candidateIndex];
  // Retain the prior snap briefly when two candidates of equal priority compete.
  // Explicit Tab cycling always wins over hysteresis.
  if ((context.candidateIndex ?? 0) === 0 && context.previousSnap && selected) {
    const margin = Math.max(0, context.hysteresisPx ?? 2);
    const previous = sorted.find(s =>
      s.type === context.previousSnap!.type &&
      distance(s.point, context.previousSnap!.point) <= 1e-5 &&
      s.entityIds.some(id => context.previousSnap!.entityIds.includes(id))
    );
    if (previous && previous.type !== selected.type &&
        PRIORITY[previous.type] === PRIORITY[selected.type] &&
        previous.distancePx <= 10 + margin &&
        previous.distancePx <= selected.distancePx + margin) selected = previous;
  }
  let point=selected?.point ?? {...cursorWorld};
  const guides:Guide[]=[];
  const anchors: {point:Vec2;id:string}[]=[];
  for(const item of segments) for(const p of [item.s.start,item.s.end,midpoint(item.s.start,item.s.end)]) if(distance(p,cursorWorld)<=tolerance*2) anchors.push({point:p,id:item.id});
  for(const e of candidates) for(const p of centerOf(e)) if(distance(p,cursorWorld)<=tolerance*2) anchors.push({point:p,id:e.id});
  if(context.lastPoint) {
    const origin=context.lastPoint, delta=sub(cursorWorld,origin), a=angleOf(delta), inc=(context.polarIncrementDeg??15)*Math.PI/180;
    const polar=context.shift && context.direction ? angleOf(context.direction) : Math.round(a/inc)*inc, projected=add(origin,scale(fromAngle(polar),dot(delta,fromAngle(polar))));
    if(context.shift || distance(projected,cursorWorld)<=tolerance) { point=projected; guides.push({type:"polar",start:origin,end:projected,angle:polar}); }
    for(const anchor of anchors) {
      if(Math.abs(anchor.point.x-cursorWorld.x)<=tolerance) guides.push({type:"vertical",start:anchor.point,end:{x:anchor.point.x,y:cursorWorld.y},entityId:anchor.id});
      if(Math.abs(anchor.point.y-cursorWorld.y)<=tolerance) guides.push({type:"horizontal",start:anchor.point,end:{x:cursorWorld.x,y:anchor.point.y},entityId:anchor.id});
    }
    for(const item of segments) {
      const d=sub(item.s.end,item.s.start), base=angleOf(d), parallel=add(origin,scale(fromAngle(base),dot(delta,fromAngle(base))));
      const perpAngle=base+Math.PI/2, perp=add(origin,scale(fromAngle(perpAngle),dot(delta,fromAngle(perpAngle))));
      if(distance(parallel,cursorWorld)<=tolerance) guides.push({type:"parallel",start:origin,end:parallel,entityId:item.id});
      if(distance(perp,cursorWorld)<=tolerance) guides.push({type:"perpendicular",start:origin,end:perp,entityId:item.id});
      const ext=projectPointOnLine(cursorWorld,item.s);
      if(distance(ext,cursorWorld)<=tolerance && (dot(sub(ext,item.s.end),d)>0 || dot(sub(ext,item.s.start),scale(d,-1))>0))
        guides.push({type:"extension",start:item.s.end,end:cursorWorld,entityId:item.id});
    }
  }
  // A horizontal and vertical alignment form an exact dual-guide intersection.
  const h=guides.find(g=>g.type==="horizontal"), v=guides.find(g=>g.type==="vertical");
  if(h && v) { point={x:v.start.x,y:h.start.y}; }
  const unique:Guide[]=[]; for(const g of guides) if(!unique.some(x=>x.type===g.type && x.entityId===g.entityId)) unique.push(g);
  const chosen=h&&v?[h,v]:unique.slice(0,2);
  const label = selected ? selected.type[0].toUpperCase()+selected.type.slice(1) : chosen[0] ? chosen[0].type[0].toUpperCase()+chosen[0].type.slice(1) : undefined;
  return {point,snaps:sorted,guides:chosen,label};
}
