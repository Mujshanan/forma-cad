import { createDocument, type Entity, type DocumentModel, type ReferenceImage } from "./core/model";
import { referenceImageCorners, referenceImageHeight, referenceImageLocalOffset, referenceImageSvgTransform } from "./core/reference-image";
import type { Vec2 } from "./core/geometry";
import { screenToWorld, zoomAt, type ViewTransform } from "./core/view";
import "./style.css";

type Tool = "select" | "line" | "circle" | "column";
const svg = document.querySelector<SVGSVGElement>("#drawing-canvas")!;
const referenceLayer = document.querySelector<SVGGElement>("#reference-layer")!;
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
const referenceContent = document.querySelector<HTMLElement>("#reference-content")!;
const referenceFileInput = document.querySelector<HTMLInputElement>("#reference-file-input")!;
const model: DocumentModel = createDocument();
let view: ViewTransform = { origin: { x: 0, y: 0 }, scale: 0.08 };
let tool: Tool = "select";
let firstPoint: Vec2 | null = null;
let pointerWorld: Vec2 = { x: 0, y: 0 };
let selectedId: string | null = null;
let selectedReferenceId: string | null = null;
let dragReference: { id: string; offset: Vec2 } | null = null;
let snapEnabled = true;
let gridVisible = false;
let spaceDown = false;
let panning = false;
let panStart: Vec2 | null = null;
let viewStart: Vec2 | null = null;
let nextId = 1;
let dragEndpoint: { id: string; endpoint: "start" | "end" } | null = null;
type HistoryState = { entities: Entity[]; references: ReferenceImage[]; selectedId: string | null; selectedReferenceId: string | null; nextId: number };
const undoStack: HistoryState[] = [];
const redoStack: HistoryState[] = [];
const cloneEntities = () => JSON.parse(JSON.stringify(model.entities)) as Entity[];
function historyState(): HistoryState { return { entities: cloneEntities(), references: JSON.parse(JSON.stringify(model.references)) as ReferenceImage[], selectedId, selectedReferenceId, nextId }; }
function pushUndo() { undoStack.push(historyState()); if (undoStack.length > 100) undoStack.shift(); redoStack.length = 0; }
function restoreHistory(state: HistoryState) {
  model.entities.splice(0, model.entities.length, ...JSON.parse(JSON.stringify(state.entities)) as Entity[]);
  selectedId = state.selectedId; nextId = state.nextId; firstPoint = null; dragEndpoint = null; render(); updateHistoryButtons();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(historyState()); restoreHistory(undoStack.pop()!);
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(historyState()); restoreHistory(redoStack.pop()!);
}
function updateHistoryButtons() {
  const undoButton = document.querySelector<HTMLButtonElement>("#undo-action");
  const redoButton = document.querySelector<HTMLButtonElement>("#redo-action");
  if (undoButton) undoButton.disabled = undoStack.length === 0;
  if (redoButton) redoButton.disabled = redoStack.length === 0;
}

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
    return `<g><line ${attrs}${dash}${width} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="dimension-label persistent-dimension" x="${labelX}" y="${labelY}">${label}</text></g>`;
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
  referenceLayer.setAttribute("transform", `translate(${view.origin.x} ${view.origin.y}) scale(${view.scale} ${view.scale})`);
  referenceLayer.innerHTML = model.references.filter(reference => reference.visible).map(reference => {
    const offset = referenceImageLocalOffset(reference);
    return `<g data-reference-id="${reference.id}" transform="${referenceImageSvgTransform(reference)}" opacity="${reference.opacity}"><image href="${reference.dataUrl}" x="${offset.x}" y="${offset.y}" width="${reference.widthMm}" height="${referenceImageHeight(reference)}" preserveAspectRatio="none" pointer-events="${reference.locked ? "none" : "all"}"/></g>`;
  }).join("");
  worldLayer.setAttribute("transform", `translate(${view.origin.x} ${view.origin.y}) scale(${view.scale} ${view.scale})`);
  overlayLayer.setAttribute("transform", `translate(${view.origin.x} ${view.origin.y}) scale(${view.scale} ${view.scale})`);
  worldLayer.innerHTML = model.entities.map(entitySvg).join("");
  overlayLayer.innerHTML = "";
  if (firstPoint && tool !== "select") {
    const end = snapPoint(pointerWorld);
    if (tool === "line") {
      const dx=end.x-firstPoint.x, dy=end.y-firstPoint.y, length=Math.hypot(dx,dy), angle=(Math.atan2(dy,dx)*180/Math.PI+360)%360;
      overlayLayer.innerHTML = `<line class="preview-geometry" x1="${firstPoint.x}" y1="${-firstPoint.y}" x2="${end.x}" y2="${-end.y}"/><text class="dimension-label listening-dimension" x="${(firstPoint.x+end.x)/2}" y="${-(firstPoint.y+end.y)/2-150/view.scale}">L ${fmt(length)} mm · ${fmt(angle)}°</text>`;
      hint.textContent = "Click to finish line · Esc to cancel";
    } else if (tool === "column") {
      const x=Math.min(firstPoint.x,end.x), y=Math.max(firstPoint.y,end.y), w=Math.abs(end.x-firstPoint.x), h=Math.abs(end.y-firstPoint.y);
      overlayLayer.innerHTML = `<rect class="preview-geometry" x="${x}" y="${-y}" width="${w}" height="${h}" fill="#579cff" fill-opacity=".12"/>`;
      hint.textContent = "Click opposite corner to finish column · Esc to cancel";
    } else {
      overlayLayer.innerHTML = `<circle class="preview-geometry" cx="${firstPoint.x}" cy="${-firstPoint.y}" r="${distance(firstPoint,end)}"/>`;
      hint.textContent = "Click to set circle radius · Esc to cancel";
    }
    hint.classList.remove("hidden");
  } else {
    hint.textContent = model.entities.length ? "" : "Choose Line, then click twice to draw";
    hint.classList.toggle("hidden", model.entities.length > 0);
  }
  // Screen-sized endpoint handles stay easy to grab at any zoom level.
  const selected = model.entities.find(entity => entity.id === selectedId);
  if (selected && "start" in selected && "end" in selected) {
    overlayLayer.insertAdjacentHTML("beforeend",
      `<circle class="endpoint-handle selected-handle" data-endpoint-handle="${selected.id}" data-endpoint="start" cx="${selected.start.x}" cy="${-selected.start.y}" r="${7 / view.scale}"/><circle class="endpoint-handle selected-handle" data-endpoint-handle="${selected.id}" data-endpoint="end" cx="${selected.end.x}" cy="${-selected.end.y}" r="${7 / view.scale}"/>`);
  }
  // Make a successful endpoint snap explicit rather than silently moving the cursor.
  const snappedPointer = snapPoint(pointerWorld);
  if (distance(snappedPointer, pointerWorld) > 0.001) {
    overlayLayer.insertAdjacentHTML("beforeend",
      `<circle class="snap-point is-snapped" data-testid="snap-indicator" cx="${snappedPointer.x}" cy="${-snappedPointer.y}" r="${6 / view.scale}"/>`);
  }
  const bg = document.querySelector<SVGRectElement>(".canvas-background");
  if (bg) bg.style.opacity = gridVisible ? "1" : "0";
  coordinateReadout.textContent = `X ${fmt(pointerWorld.x)} · Y ${fmt(pointerWorld.y)} mm`;
  zoomReadout.textContent = Math.round(view.scale*100)+"%";
  snapReadout.textContent = snapEnabled ? "SNAP: ENDPOINTS" : "SNAP: OFF";
  entityCount.textContent = model.entities.length + (model.entities.length === 1 ? " object" : " objects");
  renderProperties();
  renderReferencePanel();
}
function renderReferencePanel() {
  if (!model.references.length) {
    referenceContent.innerHTML = '<div class="reference-empty">No reference images attached.</div>';
    return;
  }
  referenceContent.innerHTML = model.references.map(reference => {
    const selected = reference.id === selectedReferenceId;
    return `<div class="reference-row ${selected ? "active" : ""}" data-reference-select="${reference.id}">
      <span class="reference-status">${reference.visible ? "◉" : "○"}</span>
      <span class="reference-name" title="${escapeHtml(reference.name)}">${escapeHtml(reference.name)}</span>
      <button type="button" class="reference-small-action" data-reference-toggle="${reference.id}" aria-label="${reference.visible ? "Hide" : "Show"} ${escapeHtml(reference.name)}">${reference.visible ? "Hide" : "Show"}</button>
    </div>`;
  }).join("") + (() => {
    const reference = model.references.find(item => item.id === selectedReferenceId);
    if (!reference) return '<p class="reference-hint">Select a reference to adjust its placement and display.</p>';
    return `<div class="reference-editor">
      <div class="reference-editor-title">PLACEMENT · ${escapeHtml(reference.name)}</div>
      <label>Anchor<select id="reference-anchor"><option value="origin" ${reference.anchor === "origin" ? "selected" : ""}>Origin to origin</option><option value="center" ${reference.anchor === "center" ? "selected" : ""}>Center to center</option></select></label>
      <div class="reference-field-grid">
        <label>X (mm)<input id="reference-x" type="number" step="any" value="${reference.position.x}"></label>
        <label>Y (mm)<input id="reference-y" type="number" step="any" value="${reference.position.y}"></label>
        <label>Width (mm)<input id="reference-width" type="number" min="0.001" step="any" value="${reference.widthMm}"></label>
        <label>Rotation (°)<input id="reference-rotation" type="number" step="any" value="${reference.rotation}"></label>
      </div>
      <label class="reference-opacity-label">Opacity <output id="reference-opacity-value">${Math.round(reference.opacity * 100)}%</output><input id="reference-opacity" type="range" min="0" max="100" value="${Math.round(reference.opacity * 100)}"></label>
      <div class="reference-toggle-row">
        <label><input id="reference-visible" type="checkbox" ${reference.visible ? "checked" : ""}> Visible</label>
        <label><input id="reference-locked" type="checkbox" ${reference.locked ? "checked" : ""}> Locked</label>
      </div>
      <button type="button" id="remove-reference" class="reference-remove">Remove reference</button>
      <p class="reference-hint">Drag the image on the canvas to move it. Width preserves its aspect ratio.</p>
    </div>`;
  })();
}
function rebuildLayers() {
  layerList.innerHTML = model.layers.map(layer=>`<div class="layer-row"><span class="layer-swatch" style="background:${layer.color}"></span><span>${escapeHtml(layer.name)}</span></div>`).join("");
}
function setTool(next: Tool) {
  tool = next; firstPoint = null;
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(button=>button.classList.toggle("active",button.dataset.tool===next));
  toolName.textContent = ({ select: "Select", line: "Line", circle: "Circle", column: "Column" } as const)[next];
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
    } else if (entity.type === "circle") {
      d=Math.max(0, distance(point,entity.center)-entity.radius);
    }
    if (d < bestDistance) { bestDistance=d; best=entity; }
  }
  selectedId = best?.id ?? null;
  render();
}
function fitDrawing() {
  const rect=svg.getBoundingClientRect();
  if (!model.entities.length && !model.references.some(reference => reference.visible)) { view={origin:{x:rect.width/2,y:rect.height/2},scale:0.08}; render(); return; }
  const points: Vec2[]=[];
  for (const reference of model.references) if (reference.visible) points.push(...referenceImageCorners(reference));
  for (const entity of model.entities) {
    if ("start" in entity && "end" in entity) points.push(entity.start,entity.end);
    else if (entity.type==="column") points.push({x:entity.center.x-entity.width/2,y:entity.center.y-entity.height/2},{x:entity.center.x+entity.width/2,y:entity.center.y+entity.height/2});
    else if (entity.type==="circle") points.push({x:entity.center.x-entity.radius,y:entity.center.y-entity.radius},{x:entity.center.x+entity.radius,y:entity.center.y+entity.radius});
  }
  if (!points.length) { view={origin:{x:rect.width/2,y:rect.height/2},scale:0.08}; render(); return; }
  const minX=Math.min(...points.map(p=>p.x)), maxX=Math.max(...points.map(p=>p.x)), minY=Math.min(...points.map(p=>p.y)), maxY=Math.max(...points.map(p=>p.y));
  const width=Math.max(maxX-minX,1000), height=Math.max(maxY-minY,1000);
  view.scale=Math.min(2,Math.max(0.005,Math.min((rect.width-100)/width,(rect.height-100)/height)));
  view.origin={x:rect.width/2-(minX+maxX)/2*view.scale,y:rect.height/2+(minY+maxY)/2*view.scale};
  render();
}
function commitShape(end: Vec2) {
  if (!firstPoint || distance(firstPoint,end) < 0.01) return;
  pushUndo();
  if (tool === "line") model.entities.push({id:"L"+nextId++,type:"line",layer:"S-ANNO",start:{...firstPoint},end:{...end}});
  else if (tool === "column") model.entities.push({id:"COL"+nextId++,type:"column",layer:"S-COLS",center:{x:(firstPoint.x+end.x)/2,y:(firstPoint.y+end.y)/2},width:Math.abs(end.x-firstPoint.x),height:Math.abs(end.y-firstPoint.y)});
  else if (tool === "circle") model.entities.push({id:"C"+nextId++,type:"circle",layer:"S-ANNO",center:{...firstPoint},radius:distance(firstPoint,end)});
  firstPoint=null; selectedId=model.entities[model.entities.length-1].id; render(); updateHistoryButtons();
}
function deleteSelection() {
  if (!selectedId) return;
  const index = model.entities.findIndex(entity => entity.id === selectedId);
  if (index < 0) { selectedId = null; render(); return; }
  pushUndo(); model.entities.splice(index, 1); selectedId = null; render(); updateHistoryButtons();
}
function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest("input,textarea,select,[contenteditable=true]")));
}

svg.addEventListener("pointerdown", event => {
  const referenceElement = (event.target as Element | null)?.closest<SVGGElement>("[data-reference-id]");
  if (event.button === 0 && referenceElement && tool === "select") {
    const id = referenceElement.dataset.referenceId;
    const reference = model.references.find(item => item.id === id);
    if (reference) {
      selectedReferenceId = reference.id; selectedId = null;
      if (!reference.locked) {
        pushUndo(); dragReference = { id: reference.id, offset: { x: reference.position.x - toWorld(event).x, y: reference.position.y - toWorld(event).y } };
        svg.setPointerCapture(event.pointerId);
      }
      render(); event.preventDefault(); return;
    }
  }
  const handle = (event.target as Element | null)?.closest<SVGCircleElement>(".endpoint-handle");
  if (event.button === 0 && handle) {
    const id = handle.dataset.endpointHandle;
    const endpoint = handle.dataset.endpoint;
    if (id && (endpoint === "start" || endpoint === "end")) {
      pushUndo(); dragEndpoint = { id, endpoint }; svg.setPointerCapture(event.pointerId); event.preventDefault(); return;
    }
  }
  if (event.button===1 || spaceDown) { panning=true; panStart=screenPoint(event); viewStart={...view.origin}; svg.setPointerCapture(event.pointerId); event.preventDefault(); return; }
  if (event.button!==0) return;
  const raw=toWorld(event); pointerWorld=raw;
  if (tool==="select") { nearestSelection(raw); return; }
  if (!firstPoint) { firstPoint={...raw}; render(); return; }
  commitShape(snapPoint(raw));
});
svg.addEventListener("pointermove", event => {
  if (dragReference) {
    const reference = model.references.find(item => item.id === dragReference!.id);
    if (reference) { const point = toWorld(event); reference.position = { x: point.x + dragReference.offset.x, y: point.y + dragReference.offset.y }; }
    pointerWorld = toWorld(event); render(); return;
  }
  if (dragEndpoint) {
    const entity = model.entities.find(item => item.id === dragEndpoint!.id);
    if (entity && "start" in entity && "end" in entity) entity[dragEndpoint.endpoint] = toWorld(event);
    pointerWorld = toWorld(event); render(); return;
  }
  if (panning && panStart && viewStart) {
    const p=screenPoint(event); view.origin={x:viewStart.x+p.x-panStart.x,y:viewStart.y+p.y-panStart.y}; render(); return;
  }
  pointerWorld=toWorld(event); render();
});
svg.addEventListener("pointerup",()=>{panning=false;panStart=null;viewStart=null;dragEndpoint=null;dragReference=null;updateHistoryButtons();});
svg.addEventListener("wheel",event=>{
  event.preventDefault(); view=zoomAt(view,screenPoint(event as unknown as PointerEvent),event.deltaY<0?1.12:1/1.12); render();
},{passive:false});
window.addEventListener("keydown",event=>{
  if(isEditableTarget(event.target)) return;
  if(event.code==="Space"){spaceDown=true;svg.style.cursor="grab";}
  if(event.key==="Escape" && firstPoint){firstPoint=null;render();return;}
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
  if(event.key==="Home"){event.preventDefault();fitDrawing();}
  if(event.key==="Delete"||event.key==="Backspace"){
    deleteSelection();
  }
  if(event.key.toLowerCase()==="v") setTool("select");
  if(event.key.toLowerCase()==="l") setTool("line");
  if(event.key.toLowerCase()==="c") setTool("circle");
  if(event.key.toLowerCase()==="r") setTool("column");
  if(event.key==="F3"){
    snapEnabled=!snapEnabled;document.querySelector("#toggle-snap")?.classList.toggle("off",!snapEnabled);render();
  }
});
window.addEventListener("keyup",event=>{if(event.code==="Space"){spaceDown=false;svg.style.cursor=tool==="select"?"default":"crosshair";}});
window.addEventListener("blur",()=>{spaceDown=false;panning=false;svg.style.cursor=tool==="select"?"default":"crosshair";});
document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(button=>button.addEventListener("click",()=>setTool(button.dataset.tool as Tool)));
document.querySelector("#delete-selection")?.addEventListener("click", deleteSelection);
document.querySelector("#undo-action")?.addEventListener("click", undo);
document.querySelector("#redo-action")?.addEventListener("click", redo);
document.querySelector("#toggle-snap")?.addEventListener("click",event=>{
  snapEnabled=!snapEnabled;(event.currentTarget as HTMLElement).classList.toggle("off",!snapEnabled);render();
});
document.querySelector("#toggle-grid")?.addEventListener("click",event=>{
  gridVisible=!gridVisible;(event.currentTarget as HTMLElement).classList.toggle("off",!gridVisible);render();
});
document.querySelector("#new-project")?.addEventListener("click",()=>{
  if((model.entities.length||model.references.length)&&!confirm("Start a new project? Unsaved changes will be lost."))return;
  pushUndo(); model.entities.length=0;model.references.length=0;nextId=1;selectedId=null;selectedReferenceId=null;firstPoint=null;render();updateHistoryButtons();
});
document.querySelector("#zoom-fit")?.addEventListener("click",fitDrawing);
document.querySelector("#save-project")?.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({version:2,...model},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="forma-cad-project.json";a.click();URL.revokeObjectURL(url);
});
const fileInput=document.querySelector<HTMLInputElement>("#file-input")!;
document.querySelector("#open-project")?.addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  try {
    const parsed=JSON.parse(await file.text()) as {units?:string;entities?:Entity[];layers?:DocumentModel["layers"];references?:ReferenceImage[]};
    if(parsed.units!=="mm"||!Array.isArray(parsed.entities)||!Array.isArray(parsed.layers))throw new Error("Unsupported project file");
    const references=parsed.references??[];
    if(!Array.isArray(references)||references.some(reference=>!reference||typeof reference.id!=="string"||typeof reference.dataUrl!=="string"||!(reference.dataUrl.startsWith("data:image/png;base64,")||reference.dataUrl.startsWith("data:image/jpeg;base64,"))||!Number.isFinite(reference.widthMm)||reference.widthMm<=0||!Number.isFinite(reference.pixelWidth)||reference.pixelWidth<=0||!Number.isFinite(reference.pixelHeight)||reference.pixelHeight<=0))throw new Error("Invalid reference image data");
    pushUndo(); model.entities.splice(0,model.entities.length,...parsed.entities);model.layers.splice(0,model.layers.length,...parsed.layers);model.references.splice(0,model.references.length,...references);
    nextId=model.entities.length+1;selectedId=null;selectedReferenceId=model.references[0]?.id??null;rebuildLayers();render();updateHistoryButtons();fitDrawing();updateHistoryButtons();
  } catch(error) { alert("Could not open project: "+(error instanceof Error?error.message:"Invalid JSON")); }
  fileInput.value="";
});
document.querySelector("#zoom-fit")?.addEventListener("dblclick",fitDrawing);
document.querySelector("#attach-reference")?.addEventListener("click",()=>referenceFileInput.click());
referenceFileInput.addEventListener("change",async()=>{
  const file=referenceFileInput.files?.[0]; if(!file)return;
  if (!file.type.startsWith("image/") || !["image/png","image/jpeg"].includes(file.type)) { alert("Choose a PNG or JPG image."); referenceFileInput.value=""; return; }
  if (file.size > 20 * 1024 * 1024) { alert("Reference images must be 20 MB or smaller."); referenceFileInput.value=""; return; }
  try {
    const dataUrl = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Could not read image"));reader.onerror=()=>reject(new Error("Could not read image"));reader.readAsDataURL(file);});
    const dimensions = await new Promise<{width:number;height:number}>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error("Image could not be decoded"));image.src=dataUrl;});
    const anchor = (document.querySelector<HTMLSelectElement>("#reference-placement")?.value ?? "origin") as ReferenceImage["anchor"];
    pushUndo();
    let referenceNumber=model.references.length+1;while(model.references.some(item=>item.id==="REF"+referenceNumber))referenceNumber++;
    const reference: ReferenceImage = {id:"REF"+referenceNumber,name:file.name,dataUrl,pixelWidth:dimensions.width,pixelHeight:dimensions.height,widthMm:10000,position:{x:0,y:0},rotation:0,opacity:0.5,visible:true,locked:false,anchor};
    model.references.push(reference);selectedReferenceId=reference.id;selectedId=null;render();fitDrawing();updateHistoryButtons();
  } catch(error) { alert("Could not attach reference: "+(error instanceof Error?error.message:"Invalid image")); }
  referenceFileInput.value="";
});
referenceContent.addEventListener("click",event=>{
  const target=event.target as HTMLElement;
  const toggle=target.closest<HTMLElement>("[data-reference-toggle]");
  if(toggle){const reference=model.references.find(item=>item.id===toggle.dataset.referenceToggle);if(reference){pushUndo();reference.visible=!reference.visible;render();updateHistoryButtons();}return;}
  if(target.id==="remove-reference"){const index=model.references.findIndex(item=>item.id===selectedReferenceId);if(index>=0){pushUndo();model.references.splice(index,1);selectedReferenceId=null;render();updateHistoryButtons();}return;}
  const row=target.closest<HTMLElement>("[data-reference-select]");
  if(row){selectedReferenceId=row.dataset.referenceSelect??null;selectedId=null;render();}
});
referenceContent.addEventListener("change",event=>{
  const target=event.target as HTMLInputElement|HTMLSelectElement;
  const reference=model.references.find(item=>item.id===selectedReferenceId);if(!reference)return;
  if(target.id==="reference-anchor"||target.id==="reference-x"||target.id==="reference-y"||target.id==="reference-width"||target.id==="reference-rotation"||target.id==="reference-visible"||target.id==="reference-locked")pushUndo();
  if(target.id==="reference-anchor")reference.anchor=target.value as ReferenceImage["anchor"];
  if(target.id==="reference-x"&&Number.isFinite(Number(target.value)))reference.position.x=Number(target.value);
  if(target.id==="reference-y"&&Number.isFinite(Number(target.value)))reference.position.y=Number(target.value);
  if(target.id==="reference-width"&&Number(target.value)>0)reference.widthMm=Number(target.value);
  if(target.id==="reference-rotation"&&Number.isFinite(Number(target.value)))reference.rotation=Number(target.value);
  if(target.id==="reference-opacity")reference.opacity=Math.max(0,Math.min(1,Number(target.value)/100));
  if(target.id==="reference-visible")reference.visible=(target as HTMLInputElement).checked;
  if(target.id==="reference-locked")reference.locked=(target as HTMLInputElement).checked;
  render();updateHistoryButtons();
});
referenceContent.addEventListener("pointerdown",event=>{if((event.target as HTMLElement).id==="reference-opacity")pushUndo();});
referenceContent.addEventListener("input",event=>{
  const target=event.target as HTMLInputElement;
  if(target.id==="reference-opacity"){
    const reference=model.references.find(item=>item.id===selectedReferenceId);
    if(reference){reference.opacity=Math.max(0,Math.min(1,Number(target.value)/100));referenceLayer.querySelector<SVGGElement>(`[data-reference-id="${reference.id}"]`)?.setAttribute("opacity",String(reference.opacity));}
    const output=referenceContent.querySelector<HTMLOutputElement>("#reference-opacity-value");if(output)output.value=target.value+"%";
  }
});
const resizeObserver=new ResizeObserver(()=>render());resizeObserver.observe(svg);
rebuildLayers();render();
