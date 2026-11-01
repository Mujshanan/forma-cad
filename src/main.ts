import { infer, type InferenceResult, type Snap } from "./core/inference";
import { createDocument, type Entity, type DocumentModel } from "./core/model";
import type { Vec2 } from "./core/geometry";
import { SpatialIndex } from "./core/spatial";
import { screenToWorld, zoomAt, type ViewTransform } from "./core/view";
import { calculateTemporaryDimensions } from "./interaction/temporary-dimensions";
import { DraftingInputFields } from "./interaction/drafting-input-fields";
import { DirectionLock } from "./interaction/direction-lock";
import { AlignmentTracker } from "./core/alignment-tracker";
import { constrainOrthogonal } from "./interaction/orthogonal";
import "./style.css";

type Tool = "select" | "line" | "grid" | "column" | "beam" | "wall";
const svg = document.querySelector<SVGSVGElement>("#drawing-canvas")!;
const worldLayer = document.querySelector<SVGGElement>("#world-layer")!;
const overlayLayer = document.querySelector<SVGGElement>("#overlay-layer")!;
const toolName = document.querySelector<HTMLElement>("#active-tool-name")!;
const hint = document.querySelector<HTMLElement>("#canvas-hint")!;
const coordinateReadout = document.querySelector<HTMLElement>("#coordinate-readout")!;
const zoomReadout = document.querySelector<HTMLElement>("#zoom-readout")!;
const entityCount = document.querySelector<HTMLElement>("#entity-count")!;
const properties = document.querySelector<HTMLElement>("#properties-content")!;
const layerList = document.querySelector<HTMLElement>("#layer-list")!;
const snapReadout = document.querySelector<HTMLElement>("#snap-readout")!;
const model: DocumentModel = createDocument();
const index = new SpatialIndex(2000);
let view: ViewTransform = { origin: { x: 0, y: 0 }, scale: 0.08 };
let tool: Tool = "select";
let firstPoint: Vec2 | null = null;
let pointerWorld: Vec2 = { x: 0, y: 0 };
let preview: InferenceResult | null = null;
const draftFields = new DraftingInputFields();
const directionLock = new DirectionLock();
const emptyIndex = new SpatialIndex(2000);
const alignmentTracker = new AlignmentTracker();
let selectedId: string | null = null;
let snapEnabled = true;
let orthogonalEnabled = true;
let candidateIndex = 0;
let previousSnap: Snap | undefined;
let spaceDown = false;
let panning = false;
let panStart: Vec2 | null = null;
let viewStart: Vec2 | null = null;
let shiftDown = false;
let nextId = 1;

const colors: Record<string, string> = Object.fromEntries(model.layers.map(layer => [layer.name, layer.color]));
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
const fmt = (n: number) => Math.round(n * 10) / 10;
const screenPoint = (event: PointerEvent): Vec2 => {
  const rect = svg.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
const toWorld = (event: PointerEvent) => screenToWorld(screenPoint(event), view);
function rebuildIndex() { index.rebuild(model.entities); }
function entityColor(entity: Entity) { return colors[entity.layer] ?? "#aab4c2"; }
function entitySvg(entity: Entity) {
  const color = entityColor(entity);
  const selected = entity.id === selectedId ? " selected" : "";
  const attrs = `class="entity${selected}" stroke="${color}" data-id="${entity.id}"`;
  switch (entity.type) {
    case "line": return `<line ${attrs} x1="${entity.start.x}" y1="${-entity.start.y}" x2="${entity.end.x}" y2="${-entity.end.y}"/>`;
    case "grid": return `<g><line ${attrs} stroke-dasharray="8 5" opacity=".75" x1="${entity.start.x}" y1="${-entity.start.y}" x2="${entity.end.x}" y2="${-entity.end.y}"/><text class="entity-label" x="${entity.end.x}" y="${-entity.end.y-90}">${escapeHtml(entity.label ?? "Grid")}</text></g>`;
    case "beam": return `<line ${attrs} stroke-width="5" x1="${entity.start.x}" y1="${-entity.start.y}" x2="${entity.end.x}" y2="${-entity.end.y}"/>`;
    case "wall": return `<line ${attrs} stroke-width="${Math.max(2,entity.thickness*view.scale)}" x1="${entity.start.x}" y1="${-entity.start.y}" x2="${entity.end.x}" y2="${-entity.end.y}"/>`;
    case "column": return `<rect ${attrs} x="${entity.center.x-entity.width/2}" y="${-entity.center.y-entity.height/2}" width="${entity.width}" height="${entity.height}" fill="${color}" fill-opacity=".12"/>`;
    case "circle": return `<circle ${attrs} cx="${entity.center.x}" cy="${-entity.center.y}" r="${entity.radius}"/>`;
    case "arc": return "";
    case "polyline": return `<polyline ${attrs} points="${entity.points.map(p=>p.x+","+(-p.y)).join(" ")}" />`;
    case "text": return `<text class="entity-label" x="${entity.position.x}" y="${-entity.position.y}">${escapeHtml(entity.value)}</text>`;
  }
}
function render() {
  const transform = `translate(${view.origin.x} ${view.origin.y}) scale(${view.scale} ${-view.scale})`;
  worldLayer.setAttribute("transform", transform);
  overlayLayer.setAttribute("transform", transform);
  worldLayer.innerHTML = model.entities.map(entitySvg).join("");
  if (selectedId) {
    const entity = model.entities.find(item => item.id === selectedId);
    if (entity?.type === "column") {
      const x = entity.center.x, y = entity.center.y, w = entity.width/2, h = entity.height/2;
      overlayLayer.innerHTML = [[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]].map(([px,py])=>`<circle class="selected-handle" cx="${px}" cy="${-py}" r="${5/view.scale}"/>`).join("");
    } else overlayLayer.innerHTML = "";
  } else overlayLayer.innerHTML = "";
  if (preview) {
    for (const guide of preview.guides) overlayLayer.innerHTML += `<line class="snap-guide" x1="${guide.start.x}" y1="${-guide.start.y}" x2="${guide.end.x}" y2="${-guide.end.y}"/>`;
    const basePoint = preview.point;
    const resolvedDraft = firstPoint ? draftFields.resolve(firstPoint, basePoint) : basePoint;
    const p = resolvedDraft ?? basePoint;
    overlayLayer.innerHTML += `<circle class="snap-point" cx="${p.x}" cy="${-p.y}" r="${6/view.scale}"/>`;
    if (firstPoint) {
      const dimensions = calculateTemporaryDimensions(firstPoint, p);
      const mid = {x:(p.x+firstPoint.x)/2,y:(p.y+firstPoint.y)/2};
      const label = draftFields.isEmpty ? `${fmt(dimensions.length)} mm · ${fmt(dimensions.angleDeg)}°` : draftFields.text;
      overlayLayer.innerHTML += `<text class="dimension-label listening-dimension" x="${mid.x}" y="${-mid.y-28/view.scale}">${escapeHtml(label)}</text>`;
      const tag = tool === "column" ? "Column preview" : tool === "grid" ? "Grid preview" : tool === "beam" ? "Beam preview" : tool === "wall" ? "Wall preview" : "Line preview";
      if (tool === "column") overlayLayer.innerHTML += `<rect class="preview-geometry" x="${p.x-200}" y="${-p.y-200}" width="400" height="400"/>`;
      else overlayLayer.innerHTML += `<line class="preview-geometry" x1="${firstPoint.x}" y1="${-firstPoint.y}" x2="${p.x}" y2="${-p.y}"/>`;
      hint.textContent = !draftFields.isValid ? "Invalid dimension · use 450, 30° or @450<30" : !draftFields.isEmpty ? tag + " · Enter to commit · Esc to cancel" : tag + " · type distance/angle or click endpoint";
    } else hint.textContent = "Click to place first point";
  } else {
    hint.textContent = model.entities.length ? "" : "Choose a tool and click to start drawing";
  }
  hint.classList.toggle("hidden", Boolean(model.entities.length && !firstPoint));
  entityCount.textContent = model.entities.length + (model.entities.length === 1 ? " object" : " objects");
  zoomReadout.textContent = Math.round(view.scale*100) + "%";
  renderProperties();
}
function renderProperties() {
  const entity = model.entities.find(item => item.id === selectedId);
  if (!entity) {
    properties.innerHTML = '<div class="empty-selection"><div class="empty-icon">◇</div><b>Nothing selected</b><p>Select an object to inspect its properties.</p></div>';
    return;
  }
  const values = entity.type === "column"
    ? [["Type","Column"],["Width",String(entity.width)+" mm"],["Height",String(entity.height)+" mm"],["Center X",fmt(entity.center.x)+" mm"],["Center Y",fmt(entity.center.y)+" mm"]]
    : "start" in entity
      ? [["Type",entity.type],["Start X",fmt(entity.start.x)+" mm"],["Start Y",fmt(entity.start.y)+" mm"],["End X",fmt(entity.end.x)+" mm"],["End Y",fmt(entity.end.y)+" mm"]]
      : [["Type",entity.type],["Layer",entity.layer]];
  properties.innerHTML = `<div class="property-label">OBJECT</div><div class="property-value">${escapeHtml(entity.id)} · ${escapeHtml(entity.layer)}</div>` + values.map(([label,value])=>`<div class="property-label">${label.toUpperCase()}</div><div class="property-value">${escapeHtml(value)}</div>`).join("");
}
function renderLayers() {
  layerList.innerHTML = model.layers.map(layer=>`<div class="layer-row"><span class="layer-swatch" style="background:${layer.color}"></span><span>${escapeHtml(layer.name)}</span><em>●</em></div>`).join("");
}
function setTool(next: Tool) {
  tool = next; firstPoint = null; preview = null; draftFields.clear(); directionLock.clear(); alignmentTracker.clear(); candidateIndex = 0; previousSnap = undefined; selectedId = null;
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(button=>button.classList.toggle("active",button.dataset.tool===next));
  toolName.textContent = next.charAt(0).toUpperCase()+next.slice(1);
  svg.style.cursor = next === "select" ? "default" : "crosshair";
  render();
}
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable=\"true\"]"));
}
function inferAt(point: Vec2) {
  if (shiftDown && firstPoint && !directionLock.direction) directionLock.lock(firstPoint, point);
  let result: InferenceResult;
  if (!snapEnabled) {
    previousSnap = undefined;
    result = (!shiftDown || !firstPoint || !directionLock.direction)
      ? { point, snaps: [], guides: [] }
      : infer(point, { lastPoint:firstPoint, shift:true, direction:directionLock.direction, alignmentTracker }, emptyIndex, view.scale);
  } else {
    result = infer(point,{ lastPoint:firstPoint ?? undefined, shift:shiftDown, direction:directionLock.direction ?? undefined, candidateIndex, previousSnap, alignmentTracker },index,view.scale);
    previousSnap = result.snaps.find(s => s.point.x === result.point.x && s.point.y === result.point.y);
  }
  if (firstPoint && orthogonalEnabled && !shiftDown && draftFields.isEmpty) {
    const constrained = constrainOrthogonal(firstPoint, result.point);
    const type = constrained.x === firstPoint.x ? "vertical" : "horizontal";
    result = { ...result, point: constrained, guides: [...result.guides, { type, start: firstPoint, end: constrained }] };
  }
  return result;
}
function addEntity(entity: Entity) {
  model.entities.push(entity); rebuildIndex(); selectedId = entity.id; firstPoint = null; preview = null; draftFields.clear(); directionLock.clear(); alignmentTracker.clear(); previousSnap = undefined; candidateIndex = 0; render();
}
function commitAt(point: Vec2) {
  if (tool === "column") {
    addEntity({id:"C"+nextId++,type:"column",layer:"S-COLS",center:point,width:400,height:400});
    return;
  }
  if (!firstPoint) { firstPoint = point; draftFields.clear(); directionLock.clear(); alignmentTracker.clear(); if (shiftDown) directionLock.lock(firstPoint, pointerWorld); return; }
  if (Math.hypot(point.x-firstPoint.x,point.y-firstPoint.y) < 0.01) return;
  const id = "E"+nextId++;
  if (tool === "grid") addEntity({id,type:"grid",layer:"S-GRID",start:firstPoint,end:point,label:"Grid "+id.slice(1)});
  else if (tool === "beam") addEntity({id,type:"beam",layer:"S-BEAM",start:firstPoint,end:point,section:"300x600"});
  else if (tool === "wall") addEntity({id,type:"wall",layer:"S-WALL",start:firstPoint,end:point,thickness:200});
  else addEntity({id,type:"line",layer:"S-ANNO",start:firstPoint,end:point});
}
function nearestSelection(point: Vec2) {
  const candidates = index.query(point,Math.max(150/view.scale,100));
  let best: Entity | null = null, bestD = Infinity;
  for (const entity of candidates) {
    let d = Infinity;
    if (entity.type === "column") d = Math.hypot(Math.max(0,Math.abs(point.x-entity.center.x)-entity.width/2),Math.max(0,Math.abs(point.y-entity.center.y)-entity.height/2));
    else if ("start" in entity) {
      const a=entity.start,b=entity.end,dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      d=Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
    }
    if(d<bestD){bestD=d;best=entity;}
  }
  selectedId = bestD <= 180/view.scale ? best?.id ?? null : null;
  render();
}
function updatePointer(event: PointerEvent) {
  pointerWorld = toWorld(event);
  coordinateReadout.textContent = `X ${fmt(pointerWorld.x)} · Y ${fmt(pointerWorld.y)} mm`;
  if (firstPoint && tool !== "select") preview = inferAt(pointerWorld);
  else if (tool !== "select" && snapEnabled) preview = inferAt(pointerWorld);
  snapReadout.textContent = snapEnabled ? "SNAP: ON" : "SNAP: OFF";
  render();
}
svg.addEventListener("pointerdown",event=>{
  if(event.button===1 || spaceDown) { panning=true; panStart=screenPoint(event); viewStart={...view.origin}; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
  if(event.button!==0) return;
  const point=toWorld(event);
  pointerWorld = point;
  if(tool==="select") { nearestSelection(point); return; }
  const inferred=inferAt(point);
  const endpoint = firstPoint ? draftFields.commit(firstPoint, inferred.point) : inferred.point;
  if (endpoint === null) { render(); return; }
  commitAt(endpoint);
  if(firstPoint) preview=inferAt(pointerWorld);
  svg.setPointerCapture(event.pointerId);
  render();
});
svg.addEventListener("pointermove",event=>{
  if(panning && panStart && viewStart) {
    const p=screenPoint(event); view.origin={x:viewStart.x+p.x-panStart.x,y:viewStart.y+p.y-panStart.y}; render(); return;
  }
  updatePointer(event);
});
svg.addEventListener("pointerup",()=>{panning=false;panStart=null;viewStart=null;});
svg.addEventListener("wheel",event=>{
  event.preventDefault();
  const anchor=screenPoint(event as unknown as PointerEvent);
  view=zoomAt(view,anchor,event.deltaY<0?1.12:1/1.12);
  render();
},{passive:false});
window.addEventListener("keydown",event=>{
  if(isEditableTarget(event.target)) return;
  if(event.code==="Space"){spaceDown=true;svg.style.cursor="grab";}
  if(event.key==="Shift" && !shiftDown) {
    shiftDown=true;
    if(firstPoint) {
      directionLock.lock(firstPoint,pointerWorld);
      preview=inferAt(pointerWorld);
      render();
    }
  }
  if(event.key==="Tab" && firstPoint){event.preventDefault();draftFields.tab(event.shiftKey);render();return;}
  if(event.key==="Tab" && preview?.snaps.length){event.preventDefault();candidateIndex=(candidateIndex+1)%preview.snaps.length;preview=inferAt(pointerWorld);render();return;}
  if(event.key==="Escape"){if(firstPoint||!draftFields.isEmpty){firstPoint=null;preview=null;draftFields.clear();directionLock.clear();alignmentTracker.clear();previousSnap=undefined;render();}return;}
  if(event.key==="Enter" && firstPoint && preview){
    event.preventDefault();
    const endpoint=draftFields.commit(firstPoint,preview.point);
    if(endpoint===null){render();return;}
    commitAt(endpoint);return;
  }
  if(firstPoint && tool!=="select"){
    if(event.key==="Backspace"){event.preventDefault();draftFields.backspace();render();return;}
    if(draftFields.append(event.key)){event.preventDefault();render();return;}
  }
  if(event.key==="Delete"||event.key==="Backspace"){if(selectedId){model.entities.splice(model.entities.findIndex(e=>e.id===selectedId),1);selectedId=null;rebuildIndex();render();}}
  if(event.key==="F8"){
    orthogonalEnabled=!orthogonalEnabled;
    document.querySelector<HTMLElement>("#toggle-ortho")?.classList.toggle("off",!orthogonalEnabled);
    const readout=document.querySelector<HTMLElement>("#ortho-readout");
    if(readout) readout.textContent=orthogonalEnabled?"ORTHO: ON":"ORTHO: OFF";
    preview = tool !== "select" && (firstPoint !== null || snapEnabled) ? inferAt(pointerWorld) : null;
    render();
  }
  if(event.key==="F3"){
    snapEnabled=!snapEnabled;
    document.querySelector("#toggle-snap")?.classList.toggle("off",!snapEnabled);
    snapReadout.textContent = snapEnabled ? "SNAP: ON" : "SNAP: OFF";
    preview = tool !== "select" && (firstPoint !== null || snapEnabled) ? inferAt(pointerWorld) : null;
    render();
  }
  const keys:Record<string,Tool>={v:"select",l:"line",g:"grid",c:"column",b:"beam",w:"wall"};
  const next=keys[event.key.toLowerCase()];if(next)setTool(next);
});
window.addEventListener("keyup",event=>{if(event.code==="Space"){spaceDown=false;svg.style.cursor=tool==="select"?"default":"crosshair";}if(event.key==="Shift"){shiftDown=false;directionLock.clear();if(firstPoint)preview=inferAt(pointerWorld);render();}});
window.addEventListener("blur",()=>{
  spaceDown=false;
  if(shiftDown){
    shiftDown=false;
    directionLock.clear();
    if(firstPoint) preview=inferAt(pointerWorld);
  }
  svg.style.cursor=tool==="select"?"default":"crosshair";
  render();
});
document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(button=>button.addEventListener("click",()=>setTool(button.dataset.tool as Tool)));
document.querySelector("#delete-selection")?.addEventListener("click",()=>{if(selectedId){model.entities.splice(model.entities.findIndex(e=>e.id===selectedId),1);selectedId=null;rebuildIndex();render();}});
document.querySelector("#toggle-ortho")?.addEventListener("click",event=>{
  orthogonalEnabled=!orthogonalEnabled;
  (event.currentTarget as HTMLElement).classList.toggle("off",!orthogonalEnabled);
  const readout=document.querySelector<HTMLElement>("#ortho-readout");
  if(readout) readout.textContent=orthogonalEnabled?"ORTHO: ON":"ORTHO: OFF";
  preview = tool !== "select" && (firstPoint !== null || snapEnabled) ? inferAt(pointerWorld) : null;
  render();
});
document.querySelector("#toggle-snap")?.addEventListener("click",event=>{
  snapEnabled=!snapEnabled;
  (event.currentTarget as HTMLElement).classList.toggle("off",!snapEnabled);
  snapReadout.textContent = snapEnabled ? "SNAP: ON" : "SNAP: OFF";
  preview = tool !== "select" && (firstPoint !== null || snapEnabled) ? inferAt(pointerWorld) : null;
  render();
});
document.querySelector("#new-project")?.addEventListener("click",()=>{if(model.entities.length&&!confirm("Start a new project? Unsaved changes will be lost."))return;model.entities.length=0;nextId=1;selectedId=null;firstPoint=null;preview=null;draftFields.clear();alignmentTracker.clear();directionLock.clear();rebuildIndex();render();});
document.querySelector("#zoom-fit")?.addEventListener("click",()=>{
  if(!model.entities.length){const rect=svg.getBoundingClientRect();view={origin:{x:rect.width/2,y:rect.height/2},scale:.08};}
  else {const xs:number[]=[],ys:number[]=[];for(const e of model.entities){if("start" in e){xs.push(e.start.x,e.end.x);ys.push(e.start.y,e.end.y);}else if(e.type==="column"){xs.push(e.center.x-e.width/2,e.center.x+e.width/2);ys.push(e.center.y-e.height/2,e.center.y+e.height/2);}}if(xs.length){const rect=svg.getBoundingClientRect(),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);view.scale=Math.min(3,Math.max(.0005,Math.min((rect.width-120)/(w+1000),(rect.height-120)/(h+1000))));view.origin={x:rect.width/2-(Math.min(...xs)+Math.max(...xs))/2*view.scale,y:rect.height/2+(Math.min(...ys)+Math.max(...ys))/2*view.scale};}}
  render();
});
document.querySelector("#save-project")?.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({version:1,...model},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="forma-cad-project.json";a.click();URL.revokeObjectURL(url);
});
const fileInput=document.querySelector<HTMLInputElement>("#file-input")!;
document.querySelector("#open-project")?.addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  try{const parsed=JSON.parse(await file.text()) as {units?:string;entities?:Entity[];layers?:DocumentModel["layers"]};if(parsed.units!=="mm"||!Array.isArray(parsed.entities)||!Array.isArray(parsed.layers))throw new Error("Unsupported project file");model.entities.splice(0,model.entities.length,...parsed.entities);model.layers.splice(0,model.layers.length,...parsed.layers);nextId=model.entities.length+1;selectedId=null;rebuildIndex();renderLayers();render();}
  catch(error){alert("Could not open project: "+(error instanceof Error?error.message:"Invalid JSON"));}
  fileInput.value="";
});
const resizeObserver=new ResizeObserver(()=>render());resizeObserver.observe(svg);
renderLayers();
render();
