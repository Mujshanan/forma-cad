import { createDocument, type Entity, type DocumentModel } from "./core/model";
import type { Vec2 } from "./core/geometry";
import { screenToWorld, zoomAt, type ViewTransform } from "./core/view";
import "./style.css";

type Tool = "select" | "line";
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
let view: ViewTransform = { origin: { x: 0, y: 0 }, scale: 0.08 };
let tool: Tool = "select";
let firstPoint: Vec2 | null = null;
let pointerWorld: Vec2 = { x: 0, y: 0 };
let selectedId: string | null = null;
let snapEnabled = true;
let gridVisible = false;
let spaceDown = false;
let panning = false;
let panStart: Vec2 | null = null;
let viewStart: Vec2 | null = null;
let nextId = 1;

const colors: Record<string, string> = Object.fromEntries(model.layers.map(layer => [layer.name, layer.color]));
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const screenPoint = (event: PointerEvent): Vec2 => {
  const rect = svg.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
const toWorld = (event: PointerEvent) => screenToWorld(screenPoint(event), view);
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
function lineEntities() {
  return model.entities.filter((entity): entity is Extract<Entity, { start: Vec2; end: Vec2 }> => "start" in entity && "end" in entity);
}
function snapPoint(point: Vec2): Vec2 {
  if (!snapEnabled) return { ...point };
  // Only snap to actual, committed endpoints. No inference projections or alignment overrides.
  let best: Vec2 | null = null;
  let bestDistance = 10 / view.scale;
  for (const entity of lineEntities()) {
    for (const candidate of [entity.start, entity.end]) {
      const d = distance(point, candidate);
      if (d <= bestDistance) { bestDistance = d; best = candidate; }
    }
  }
  return best ? { ...best } : { ...point };
}
function entitySvg(entity: Entity): string {
  const color = colors[entity.layer] ?? "#aab4c2";
  const selected = entity.id === selectedId ? " selected" : "";
  const attrs = `class="entity${selected}" stroke="${color}" data-id="${entity.id}"`;
  if ("start" in entity && "end" in entity) {
    const x1 = entity.start.x, y1 = -entity.start.y, x2 = entity.end.x, y2 = -entity.end.y;
    const dx = entity.end.x - entity.start.x, dy = entity.end.y - entity.start.y;
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    // A persistent, derived dimension: positive length and normalized 0–360° angle.
    const offset = 180 / view.scale;
    const nx = length > 0 ? -dy / length : 0, ny = length > 0 ? dx / length : 1;
    const labelX = midX + nx * offset, labelY = midY - ny * offset;
    const label = `L ${fmt(length)} mm  ·  ${fmt(angle)}°`;
    const dash = entity.type === "grid" ? ' stroke-dasharray="8 5"' : "";
    const width = entity.type === "beam" ? ' stroke-width="5"' : "";
    return `<g><line ${attrs}${dash}${width} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="dimension-label persistent-dimension" transform="translate(0 ${2*labelY}) scale(1 -1)" x="${labelX}" y="${labelY}">${label}</text></g>`;
  }
  if (entity.type === "column") return `<rect ${attrs} x="${entity.center.x-entity.width/2}" y="${-entity.center.y-entity.height/2}" width="${entity.width}" height="${entity.height}" fill="${color}" fill-opacity=".12"/>`;
  if (entity.type === "circle") return `<circle ${attrs} cx="${entity.center.x}" cy="${-entity.center.y}" r="${entity.radius}"/>`;
  if (entity.type === "polyline") return `<polyline ${attrs} points="${entity.points.map(p=>p.x+","+(-p.y)).join(" ")}"/>`;
  if (entity.type === "text") return `<text class="entity-label" x="${entity.position.x}" y="${-entity.position.y}">${escapeHtml(entity.value)}</text>`;
  return "";
}
function renderProperties() {
  const entity = model.entities.find(item => item.id === selectedId);
  if (!entity) {
    properties.innerHTML = '<div class="empty-selection"><div class="empty-icon">◇</div><b>Nothing selected</b><p>Choose Select and click a line.</p></div>';
    return;
  }
  const values = "start" in entity && "end" in entity
    ? [["Type", entity.type], ["Start X", fmt(entity.start.x)+" mm"], ["Start Y", fmt(entity.start.y)+" mm"], ["End X", fmt(entity.end.x)+" mm"], ["End Y", fmt(entity.end.y)+" mm"], ["Length", fmt(distance(entity.start,entity.end))+" mm"], ["Angle", fmt((Math.atan2(entity.end.y-entity.start.y,entity.end.x-entity.start.x)*180/Math.PI+360)%360)+"°"]]
    : entity.type === "column" ? [["Type","Column"],["Width",String(entity.width)+" mm"],["Height",String(entity.height)+" mm"]] : [["Type",entity.type],["Layer",entity.layer]];
  properties.innerHTML = `<div class="property-label">OBJECT</div><div class="property-value">${escapeHtml(entity.id)} · ${escapeHtml(entity.layer)}</div>` + values.map(([label,value])=>`<div class="property-label">${label.toUpperCase()}</div><div class="property-value">${escapeHtml(value)}</div>`).join("");
}
function render() {
  worldLayer.setAttribute("transform", `translate(${view.origin.x} ${view.origin.y}) scale(${view.scale} ${-view.scale})`);
  overlayLayer.setAttribute("transform", `translate(${view.origin.x} ${view.origin.y}) scale(${view.scale} ${-view.scale})`);
  worldLayer.innerHTML = model.entities.map(entitySvg).join("");
  overlayLayer.innerHTML = "";
  if (firstPoint && tool === "line") {
    const end = snapPoint(pointerWorld);
    const dx = end.x-firstPoint.x, dy = end.y-firstPoint.y;
    const length = Math.hypot(dx,dy), angle = (Math.atan2(dy,dx)*180/Math.PI+360)%360;
    overlayLayer.innerHTML = `<line class="preview-geometry" x1="${firstPoint.x}" y1="${-firstPoint.y}" x2="${end.x}" y2="${-end.y}"/><text class="dimension-label listening-dimension" transform="translate(0 ${2*(-(firstPoint.y+end.y)/2-150/view.scale)}) scale(1 -1)" x="${(firstPoint.x+end.x)/2}" y="${-(firstPoint.y+end.y)/2-150/view.scale}">L ${fmt(length)} mm · ${fmt(angle)}°</text>`;
    hint.textContent = "Click to finish line · Esc to cancel";
    hint.classList.remove("hidden");
  } else {
    hint.textContent = model.entities.length ? "" : "Choose Line, then click twice to draw";
    hint.classList.toggle("hidden", model.entities.length > 0);
  }
  const bg = document.querySelector<SVGRectElement>(".canvas-background");
  if (bg) bg.style.opacity = gridVisible ? "1" : "0";
  coordinateReadout.textContent = `X ${fmt(pointerWorld.x)} · Y ${fmt(pointerWorld.y)} mm`;
  zoomReadout.textContent = Math.round(view.scale*100)+"%";
  snapReadout.textContent = snapEnabled ? "SNAP: ENDPOINTS" : "SNAP: OFF";
  entityCount.textContent = model.entities.length + (model.entities.length === 1 ? " object" : " objects");
  renderProperties();
}
function rebuildLayers() {
  layerList.innerHTML = model.layers.map(layer=>`<div class="layer-row"><span class="layer-swatch" style="background:${layer.color}"></span><span>${escapeHtml(layer.name)}</span></div>`).join("");
}
function setTool(next: Tool) {
  tool = next; firstPoint = null;
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(button=>button.classList.toggle("active",button.dataset.tool===next));
  toolName.textContent = next === "select" ? "Select" : "Line";
  svg.style.cursor = next === "select" ? "default" : "crosshair";
  render();
}
function nearestSelection(point: Vec2) {
  let best: Entity | null = null, bestDistance = 12 / view.scale;
  for (const entity of [...model.entities].reverse()) {
    let d = Infinity;
    if ("start" in entity && "end" in entity) {
      const a=entity.start,b=entity.end,dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      d=distance(point,{x:a.x+t*dx,y:a.y+t*dy});
    } else if (entity.type === "column") {
      d=Math.hypot(Math.max(0,Math.abs(point.x-entity.center.x)-entity.width/2),Math.max(0,Math.abs(point.y-entity.center.y)-entity.height/2));
    }
    if (d < bestDistance) { bestDistance=d; best=entity; }
  }
  selectedId = best?.id ?? null;
  render();
}
function fitDrawing() {
  const rect=svg.getBoundingClientRect();
  if (!model.entities.length) { view={origin:{x:rect.width/2,y:rect.height/2},scale:0.08}; render(); return; }
  const points: Vec2[]=[];
  for (const entity of model.entities) {
    if ("start" in entity && "end" in entity) points.push(entity.start,entity.end);
    else if (entity.type==="column") points.push({x:entity.center.x-entity.width/2,y:entity.center.y-entity.height/2},{x:entity.center.x+entity.width/2,y:entity.center.y+entity.height/2});
  }
  if (!points.length) return;
  const minX=Math.min(...points.map(p=>p.x)), maxX=Math.max(...points.map(p=>p.x)), minY=Math.min(...points.map(p=>p.y)), maxY=Math.max(...points.map(p=>p.y));
  const width=Math.max(maxX-minX,1000), height=Math.max(maxY-minY,1000);
  view.scale=Math.min(2,Math.max(0.005,Math.min((rect.width-100)/width,(rect.height-100)/height)));
  view.origin={x:rect.width/2-(minX+maxX)/2*view.scale,y:rect.height/2+(minY+maxY)/2*view.scale};
  render();
}
function commitLine(end: Vec2) {
  if (!firstPoint || distance(firstPoint,end) < 0.01) return;
  const start={...firstPoint};
  model.entities.push({id:"L"+nextId++,type:"line",layer:"S-ANNO",start,end:{...end}});
  firstPoint=null; selectedId=model.entities[model.entities.length-1].id; render();
}
function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest("input,textarea,select,[contenteditable=true]")));
}

svg.addEventListener("pointerdown", event => {
  if (event.button===1 || spaceDown) { panning=true; panStart=screenPoint(event); viewStart={...view.origin}; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
  if (event.button!==0) return;
  const raw=toWorld(event); pointerWorld=raw;
  if (tool==="select") { nearestSelection(raw); return; }
  const point=snapPoint(raw);
  if (!firstPoint) { firstPoint={...point}; render(); return; }
  commitLine(point);
});
svg.addEventListener("pointermove", event => {
  if (panning && panStart && viewStart) {
    const p=screenPoint(event); view.origin={x:viewStart.x+p.x-panStart.x,y:viewStart.y+p.y-panStart.y}; render(); return;
  }
  pointerWorld=toWorld(event); render();
});
svg.addEventListener("pointerup",()=>{panning=false;panStart=null;viewStart=null;});
svg.addEventListener("wheel",event=>{
  event.preventDefault(); view=zoomAt(view,screenPoint(event as unknown as PointerEvent),event.deltaY<0?1.12:1/1.12); render();
},{passive:false});
window.addEventListener("keydown",event=>{
  if(isEditableTarget(event.target)) return;
  if(event.code==="Space"){spaceDown=true;svg.style.cursor="grab";}
  if(event.key==="Escape" && firstPoint){firstPoint=null;render();return;}
  if(event.key==="Home"){event.preventDefault();fitDrawing();}
  if(event.key==="Delete"||event.key==="Backspace"){
    if(selectedId){model.entities.splice(model.entities.findIndex(e=>e.id===selectedId),1);selectedId=null;render();}
  }
  if(event.key.toLowerCase()==="v") setTool("select");
  if(event.key.toLowerCase()==="l") setTool("line");
  if(event.key==="F3"){
    snapEnabled=!snapEnabled;document.querySelector("#toggle-snap")?.classList.toggle("off",!snapEnabled);render();
  }
});
window.addEventListener("keyup",event=>{if(event.code==="Space"){spaceDown=false;svg.style.cursor=tool==="select"?"default":"crosshair";}});
window.addEventListener("blur",()=>{spaceDown=false;panning=false;svg.style.cursor=tool==="select"?"default":"crosshair";});
document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(button=>button.addEventListener("click",()=>setTool(button.dataset.tool as Tool)));
document.querySelector("#delete-selection")?.addEventListener("click",()=>{if(selectedId){model.entities.splice(model.entities.findIndex(e=>e.id===selectedId),1);selectedId=null;render();}});
document.querySelector("#toggle-snap")?.addEventListener("click",event=>{
  snapEnabled=!snapEnabled;(event.currentTarget as HTMLElement).classList.toggle("off",!snapEnabled);render();
});
document.querySelector("#toggle-grid")?.addEventListener("click",event=>{
  gridVisible=!gridVisible;(event.currentTarget as HTMLElement).classList.toggle("off",!gridVisible);render();
});
document.querySelector("#new-project")?.addEventListener("click",()=>{
  if(model.entities.length&&!confirm("Start a new project? Unsaved changes will be lost."))return;
  model.entities.length=0;nextId=1;selectedId=null;firstPoint=null;render();
});
document.querySelector("#zoom-fit")?.addEventListener("click",fitDrawing);
document.querySelector("#save-project")?.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({version:1,...model},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="forma-cad-project.json";a.click();URL.revokeObjectURL(url);
});
const fileInput=document.querySelector<HTMLInputElement>("#file-input")!;
document.querySelector("#open-project")?.addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  try {
    const parsed=JSON.parse(await file.text()) as {units?:string;entities?:Entity[];layers?:DocumentModel["layers"]};
    if(parsed.units!=="mm"||!Array.isArray(parsed.entities)||!Array.isArray(parsed.layers))throw new Error("Unsupported project file");
    model.entities.splice(0,model.entities.length,...parsed.entities);model.layers.splice(0,model.layers.length,...parsed.layers);
    nextId=model.entities.length+1;selectedId=null;rebuildLayers();render();fitDrawing();
  } catch(error) { alert("Could not open project: "+(error instanceof Error?error.message:"Invalid JSON")); }
  fileInput.value="";
});
document.querySelector("#zoom-fit")?.addEventListener("dblclick",fitDrawing);
const resizeObserver=new ResizeObserver(()=>render());resizeObserver.observe(svg);
rebuildLayers();render();
