# Forma CAD

Lightweight 2D structural drafting for grids, columns, beams and walls, with a Revit-inspired geometric inference and temporary-guide workflow.

> **Project stage:** Core geometry and inference foundation. The first usable desktop drafting MVP is planned below. The current repository is not yet a complete drawing application.

## Product goal

Build a focused 2D structural drafting tool that makes accurate plan drafting fast. While drawing, the cursor should understand nearby geometry, find useful snap points, track alignments, show temporary dimensions and accept exact keyboard input.

The goal is to reproduce the useful *interaction patterns* of Revit's temporary dimensions and alignment guides—not to clone Revit or implement BIM.

## MVP scope

### Included

- Infinite 2D canvas with pan, zoom and a millimetre-based world coordinate system (Y-up).
- Selection, object highlighting and editable properties.
- Structural grids and grid intersections.
- Rectangular and circular columns.
- Straight beams and walls.
- Basic line, polyline and rectangle drafting tools.
- Object snaps: endpoint, midpoint, center, intersection, perpendicular, nearest and grid.
- Temporary horizontal, vertical, extension, parallel, perpendicular and polar tracking guides.
- Temporary distance/angle feedback and typed length input.
- Shift direction lock, Tab snap-candidate cycling and Escape cancellation.
- Layers, undo/redo and native JSON project save/load.
- Layer-aware DXF export.

### Explicitly out of scope for the first MVP

3D modelling, BIM/families, structural analysis, reinforcement detailing, DWG editing, collaboration, advanced annotation, hatching and complex dimension styles. These can be evaluated after the 2D workflow is stable.

## Core interaction principles

1. **Geometry is authoritative.** The document model stores world-space geometry; the canvas only renders it.
2. **Screen-space tolerances.** Snap and guide thresholds are specified in pixels and converted using the current view scale.
3. **Context-aware inference.** A snap is selected using snap type, cursor distance and selection stability—not distance alone.
4. **Limited visual noise.** Show only the most useful one or two guides at a time.
5. **Predictable input.** Preview geometry updates continuously; click/Enter commits; Escape cancels.
6. **Zoom-independent feedback.** Cursor markers, guide strokes and temporary labels remain readable at every zoom level.

## Architecture

The geometry and inference core must remain independent of the browser DOM and rendering framework.

- `src/core/geometry.ts`: vector math, projection, distances, bounds and intersections (millimetres, Y-up).
- `src/core/model.ts`: typed document entities and structural layers.
- `src/core/spatial.ts`: uniform-grid spatial hash for nearby entity lookup.
- `src/core/references.ts`: reusable world-space reference points and segments for structural entities.
- `src/core/inference.ts`: snap candidates, deterministic ranking, snap hysteresis, tolerance handling and tracking-guide calculation.
- `src/core/view.ts`: pure world/screen transforms and cursor-anchored zoom.
- `src/tools/` (planned): isolated stateful drawing tools.
- `src/interaction/` (planned): pointer/keyboard input, tracking state and tool lifecycle.
- `src/rendering/` (planned): scene, guide, snap-marker and temporary-dimension rendering.
- `src/document/` (planned): document operations, layers, history and persistence.
- `src/ui/` (planned): future componentized UI; the current prototype shell is in `index.html`, `src/main.ts` and `src/style.css`.
- `tests/`: unit and integration tests.

### Planned inference pipeline

1. Convert the pointer from screen coordinates to world coordinates.
2. Query the spatial index for nearby entities.
3. Generate geometric snap candidates and eligible tracking references.
4. Apply screen-pixel tolerances and candidate ranking.
5. Evaluate drawing constraints (axis lock, parallel, perpendicular and polar tracking).
6. Resolve the final preview point and up to two dominant guides.
7. Generate temporary dimensions/labels.
8. Render the preview and feedback without modifying the document.
9. Commit geometry only on the user's confirmation.

A structural object should expose reusable reference geometry. For example, a column can expose its center, corners, edge midpoints, centerlines and edge directions; a beam can expose its endpoints, midpoint, centerline and direction. Snapping and alignment should consume these references through shared APIs.

## Development roadmap and test plan

Work in small, reviewable milestones. Each milestone must pass its tests before the next dependent milestone begins.

### Milestone 0 — Establish a reliable baseline

**Tasks**
- Install dependencies and verify the current Vitest suite, TypeScript check and production build.
- Fix flaky or overly strict tests; keep deterministic fixtures.
- Ensure CI runs tests, type checking and build on pull requests.
- Add coverage reporting when the test suite has enough meaningful coverage.

**Unit tests**
- Existing geometry tests: line intersection, finite-segment projection/clamping, distance and midpoint.
- Existing inference tests: snap priority, zoom-scaled tolerance, nearest point, guide generation, intersections, arc sweep, grid crossings and Shift locking.
- Add boundary tests for zero-length segments, parallel lines, coincident points, empty indexes and invalid/zero view scale.

**Exit criteria**
- `npm test`, `npm run check` and `npm run build` pass locally and in CI.
- No claim of CI success until the GitHub Actions run is green.

### Milestone 1 — Complete and harden the geometry/inference core

**Tasks**
- Make candidate ranking deterministic and stable near equal-priority candidates.
- Add hysteresis so the active snap does not flicker around a threshold.
- Formalize reference geometry for structural entities.
- Separate snap generation, guide tracking, constraint resolution and temporary-dimension calculation into testable functions.
- Keep spatial queries local; avoid scanning the entire document per pointer move.

**Unit tests**
- Every snap type: positive case, outside-tolerance case and competing-candidate case.
- Candidate priority and distance tie-breaking.
- Snap stability/hysteresis while the pointer moves around a threshold.
- Horizontal/vertical alignment; extension from endpoints; parallel and perpendicular tracking.
- Polar increments and Shift locking, including angle wraparound.
- Arc sweep boundaries and full-circle behavior.
- Spatial-index insert, update, remove, rebuild, boundary cells and duplicate IDs.
- Property-based or seeded randomized geometry tests for projection/intersection invariants.
- Performance smoke test on 10,000 entities; report timings, but avoid fragile machine-specific microsecond assertions in CI.

**Exit criteria**
- Inference results are deterministic for fixed inputs.
- All snap/guide cases have isolated unit tests.
- Performance is responsive on a large synthetic drawing.

### Milestone 2 — Canvas and rendering foundation

**Tasks**
- Implement world-to-screen and screen-to-world transforms.
- Add pan, zoom-to-cursor, fit-to-content and selection rendering.
- Render document geometry separately from transient overlays.
- Add guide, snap-marker, cursor-preview and temporary-label renderers.
- Keep overlays screen-sized regardless of zoom.

**Unit/integration tests**
- Coordinate transform round trips at several zoom levels and canvas offsets.
- Zoom-to-cursor preserves the world point under the pointer.
- Pan updates the view without changing document geometry.
- Guide and marker placement uses inferred world coordinates.
- Overlay sizes remain constant in screen pixels.
- Rendering a preview does not mutate the document.

**Exit criteria**
- A blank project opens into a navigable canvas.
- A test scene renders correctly at multiple zoom levels.
- Guide and snap overlays can be tested independently from the scene renderer.

### Milestone 3 — Basic drafting tools

**Tasks**
- Implement select, line, polyline and rectangle tools.
- Add grid and column tools.
- Use a shared tool lifecycle: idle, previewing, committed and cancelled.
- Connect every tool to the same inference API.
- Add selection and property editing.

**Unit/integration tests**
- Tool state transitions and cancellation.
- Pointer down/move/up and Enter commit behavior.
- Exact typed dimensions override pointer preview as expected.
- Snapping works consistently in each drawing tool.
- Grid spacing/count and column dimensions are correct in world units.
- Selection hit-testing at different zoom levels.
- Undo/redo restores exact document state.

**Exit criteria**
- A user can draw and edit a small structural grid and column layout.
- Escape cancels unfinished geometry without leaving partial entities.

### Milestone 4 — Revit-inspired precision workflow

**Tasks**
- Add temporary dimensions for length, X/Y offsets and angle.
- Add typed distance/angle input while drawing.
- Implement Tab cycling through snap candidates and tracking references.
- Implement Shift direction lock and predictable keyboard precedence.
- Add reference tracking that can temporarily retain alignment references after the cursor moves away.
- Limit the visible guide set to the two most useful guides.

**Unit/integration tests**
- Temporary dimensions update with the preview and disappear on commit/cancel.
- Typed length creates geometry of the exact requested length within numeric tolerance.
- Typed angle and length work together.
- Tab cycles candidates deterministically and wraps correctly.
- Shift locks the intended direction and releases cleanly.
- Tracking references activate/deactivate at defined thresholds.
- Guide selection is deterministic when multiple references compete.
- Keyboard shortcuts do not fire while a text/property input owns focus.

**Exit criteria**
- Demonstration workflow: start a beam at a column, align to another reference, see guides and temporary dimensions, type an exact length and commit.

### Milestone 5 — Structural objects, document workflow and DXF

**Tasks**
- Add beam and wall tools with editable structural properties.
- Finalize layers and visibility/locking.
- Add native JSON save/load with schema versioning.
- Add DXF export with one DXF layer per document layer.
- Add document-level undo/redo and basic project recovery safeguards.

**Unit/integration tests**
- Beam/wall geometry, orientation and property validation.
- Layer create/rename/visibility/lock behavior.
- JSON round-trip preserves entities, layers, IDs and units.
- Unknown schema versions fail with a useful error or supported migration.
- DXF export contains expected entities and layer assignments.
- Export/import smoke test using a DXF parser where practical.
- Undo/redo across create, edit, delete and layer operations.

**Exit criteria**
- A small structural plan can be saved, reopened and exported to DXF without losing supported geometry or layer assignments.

### Milestone 6 — MVP hardening and desktop packaging

**Tasks**
- Accessibility and keyboard usability pass.
- Error handling for malformed projects and failed exports.
- Large-document performance profiling.
- Package a Windows desktop build (Tauri only after the web application is stable).
- Prepare a sample structural project and release notes.

**Tests**
- End-to-end smoke workflow from new project through DXF export.
- Large synthetic document interaction/performance checks.
- Save/reopen regression test.
- Desktop launch and file-dialog smoke tests on Windows.
- Release build and artifact verification.

**Exit criteria**
- CI is green; core tests, application tests and end-to-end smoke tests pass.
- A Windows build is actually produced and launch-tested before it is announced.

## Testing strategy

Use Vitest for fast deterministic unit tests. Keep core tests free of DOM/browser dependencies. Add browser-level tests only when the canvas and UI exist.

| Test level | What it protects | When |
|---|---|---|
| Unit | Geometry, snapping, constraints, tools, dimensions, document operations | Every milestone |
| Integration | Tool + inference, canvas transforms + overlays, save/load, DXF export | From Milestone 2 |
| End-to-end | User workflows across the application | From Milestone 3 |
| Performance | Spatial lookup and pointer-move inference on large drawings | Every inference/rendering change |
| Manual acceptance | Visual guide clarity, keyboard feel and real drafting usability | Each demo/release |

### Required local commands

```sh
npm install
npm test
npm run check
npm run build
npm run dev
```

- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run tests in watch mode.
- `npm run check`: TypeScript validation.
- `npm run build`: TypeScript project build and Vite production build.

### Continuous integration

The GitHub Actions workflow should run on pushes and pull requests:

1. Install the locked dependency tree with `npm ci` once a package lock is committed.
2. Run `npm test`.
3. Run `npm run check`.
4. Run `npm run build`.

A pull request is not complete merely because it compiles: relevant tests must pass, and new behavior must include tests.

## Definition of done

A feature is done only when:
- Its behavior and edge cases are documented.
- Unit tests cover normal, boundary and failure cases.
- Integration tests are added when multiple modules interact.
- TypeScript and production build checks pass.
- No unrelated regression is introduced.
- The README or relevant developer documentation is updated.
- The pull request describes what was tested and reports actual results.

## Current implementation status

- [x] TypeScript/Vite project foundation.
- [x] Geometry primitives and unit tests.
- [x] Typed structural document model.
- [x] Uniform-grid spatial index.
- [x] Initial snap candidate and guide inference.
- [x] Vitest and TypeScript CI workflow configured.
- [x] Run and verify the committed Vitest suite in GitHub Actions.
- [x] Add guide-tracking tests for perpendicular snaps, extension, parallel/perpendicular guides and polar wraparound.
- [x] Add seeded projection invariants and spatial-index lifecycle/boundary tests.
- [x] Cover zero-length segments and full-circle arc sweeps.
- [x] Verify positive and out-of-tolerance behavior for every supported snap type.
- [x] Add shared reference geometry for columns, beams, walls, grids and polylines.
- [x] Add deterministic snap tie-breaking and equal-priority snap hysteresis.
- [x] Complete tracking-reference and spatial-index boundary/update tests.
- [x] Initial SVG canvas shell, world/screen transforms, pan/zoom and view-transform unit tests.
- [x] Initial select, line, grid, column, beam and wall drawing interactions.
- [x] Initial snap markers, alignment-guide overlay and live length/angle preview labels.
- [x] Basic JSON project save/open.
- [ ] Improve guide tracking, snap stability and temporary dimension input.
- [ ] Add robust editing, undo/redo, layer controls and DXF export.
- [ ] Add browser end-to-end tests and Windows desktop packaging.

## Contributing

- Keep geometry and inference pure and independently testable.
- Use millimetres in the document model and Y-up world coordinates.
- Never store screen coordinates in document entities.
- Keep rendering as a projection of document state; previews and guides are transient.
- Add or update tests with every behavior change.
- Work in focused branches and small pull requests; do not begin a dependent milestone until its exit criteria are met.
