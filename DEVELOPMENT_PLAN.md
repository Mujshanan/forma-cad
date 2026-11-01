# Forma CAD — Development Plan

## Product mission

Build a reference-first 2D structural drafting and review workstation. Structural engineers commonly receive architectural drawings as DWG/DXF, PDF or image files and need to produce a structural layout over them. Conventional CAD workflows make this unnecessarily laborious: engineers often have to clean up architectural layers, isolate useful geometry, calibrate references and manually measure every grid and alignment.

Forma's job is to remove that friction.

**Core promise:** attach an architectural reference, make it readable and non-intrusive, hover over its geometry, and create a dimensioned structural layout with as little manual setup as possible.

This is not a plan to reproduce all of AutoCAD. Feature priority is determined by how much it reduces time and errors in the reference-to-structural-drawing workflow.

## Product workflow

1. **Bring in the reference:** attach DWG/DXF, vector PDF, scanned PDF or raster image.
2. **Prepare it:** calibrate scale, position and rotation; fade and lock it; filter architectural layers; clip to the working area.
3. **Discover geometry:** hover to detect endpoints, edges, corners, centers, intersections, wall faces, centerlines and repeated alignments.
4. **Create the structural grid:** preview axes, accept recognized alignments, automatically calculate spacing and labels, and override values by typing.
5. **Draft structural objects:** place columns, beams and walls using the same reference-aware snapping and temporary dimensions.
6. **Review and deliver:** check dimensions and alignment, keep structural layers independent, and export a clean structural drawing.

## Design principles

- **Non-destructive references:** references are not silently converted into editable structural objects or modified when structural geometry changes.
- **One inference engine:** native geometry and imported references feed the same candidate and tracking pipeline.
- **Visible inference:** show what was detected, its source and snap type; allow candidate cycling, rejection and manual override.
- **Dimensions are part of interaction:** dimensions and guides update during preview, not only after drawing.
- **Structural workflow first:** grids, columns, beams, walls, axes and review checks take priority over generic CAD commands.
- **Exactness is explicit:** vector geometry may be exact within source accuracy; raster recognition is approximate and must communicate confidence.
- **Review safety:** source references remain recoverable; undo/redo covers document and layer changes; uncertain recognition never commits automatically.

## Current repository baseline

The current application has a TypeScript/Vite SVG canvas prototype, millimetre/Y-up geometry, a typed structural entity model, spatial index, reference-geometry abstractions for native entities, inference and tracking primitives, temporary dimension calculations, typed length/angle/polar input primitives, basic selection/drawing interactions, JSON project save/open, and Playwright coverage for basic drawing.

Important gap: these foundations are not yet a complete user workflow. The active pointer path in `src/main.ts` still uses a limited endpoint-only snap routine rather than the full inference pipeline. There is no completed DWG/DXF, PDF or raster reference attachment workflow, no reference layer filtering, and no hover-to-create structural grid workflow.

## Roadmap and milestones

### Milestone 0 — Stabilize document and interaction foundations

**Goal:** ensure every later reference and drafting feature can rely on predictable document state.

Tasks:
- Complete document-level undo/redo for entity, layer and project operations.
- Add functional layer management: active layer, visibility, lock, rename, reorder and move-to-layer.
- Make selected structural properties editable with validation.
- Harden project JSON schema validation, migrations and unique ID generation.
- Separate document operations/transactions from DOM event handlers.
- Define a shared drawing-command lifecycle: activate, preview, commit, cancel.

Tests and acceptance:
- Undo/redo restores entities, layers, selection-relevant state and project operations consistently.
- Hidden layers do not render, select or affect fit-to-drawing; locked layers cannot be modified.
- Invalid property input is rejected without corrupting geometry.
- Malformed or unsupported project files fail atomically with actionable errors.
- Every command can be cancelled without leaving partial entities.
- `npm test`, `npm run check`, `npm run build` and relevant E2E tests pass.

### Milestone 1 — Reference document model and raster attachment

**Goal:** establish a first-class reference workflow without waiting for DWG parsing.

Tasks:
- Add a `ReferenceDocument` model separate from structural entities.
- Store source metadata, reference type, transform (position, scale, rotation), opacity, visibility, lock, clipping and snap-enabled state.
- Attach PNG/JPG and raster PDF pages as references.
- Implement pan/zoom-aware reference rendering below structural geometry.
- Add reference selection/management without allowing accidental edits to locked references.
- Add scale calibration by selecting two image points and entering a known distance.
- Support move, rotate, scale, opacity, visibility and lock controls.
- Persist reference metadata and source links/embedded assets in the native project format.
- Handle missing source files and provide relink workflow.

Tests and acceptance:
- Image aspect ratio and transform are preserved.
- Calibration maps the selected pixel distance to the entered world distance.
- References remain fixed in world space while the viewport pans and zooms.
- Lock prevents accidental move/transform; visibility and opacity update independently.
- Save/reopen preserves reference transforms and settings.
- Missing assets produce a recoverable warning, not a crash.
- E2E: attach image, calibrate, fade, lock, draw a structural line over it, save and reopen.

### Milestone 2 — Reference layers and architectural cleanup

**Goal:** eliminate manual architectural layer cleanup.

Tasks:
- Add DWG/DXF reference attachment (initially read-only).
- Parse source layer names, colors, visibility and entity counts.
- Preserve source layer identities; do not delete or mutate source layers.
- Implement per-reference layer visibility and optional color/opacity overrides.
- Provide layer search, bulk hide/show, isolate and restore.
- Provide configurable cleanup presets:
  - Architectural background (walls/openings on; furniture and dense annotations off).
  - Walls and openings.
  - Grids and axes.
  - Clean geometry (text/dimensions/furniture off).
  - Custom saved preset.
- Add best-effort layer-name classification, with user confirmation and easy override.
- Keep reference layer filters independent from Forma's structural output layers.

Tests and acceptance:
- Imported source layer table is preserved and mapped deterministically.
- Hiding a reference layer affects display and reference snap candidates, but not source file contents.
- Presets are reversible and can be customized.
- Unknown layer names remain visible/configurable; classification never silently deletes data.
- Large layer lists remain responsive.
- E2E: attach sample architectural DXF, apply a cleanup preset, restore original visibility, save/reopen.

### Milestone 3 — Shared reference geometry and snapping engine

**Goal:** make imported vector references useful as geometric drafting guides.

Tasks:
- Define a common `ReferenceGeometryProvider` API for native entities, DXF/DWG adapters and vector PDF.
- Return typed candidates with world position, snap type, source reference/layer/entity, exactness and confidence.
- Connect `src/core/inference.ts` to the live pointer movement and all drawing commands.
- Add endpoint, corner, midpoint, center, intersection, perpendicular, nearest and tangent candidates where geometry supports them.
- Add edge/segment projection, parallel edge and wall centerline candidates.
- Add deterministic ranking, pixel-based tolerance, hysteresis and Tab candidate cycling.
- Respect reference visibility, layer filters, lock/snap toggles and clipping.
- Add snap markers that identify both the snap type and reference source.
- Add spatial indexing/caching for large references; do not scan all imported geometry on every pointer move.
- Keep vector PDF geometry queryable without converting the PDF into editable structural entities.

Tests and acceptance:
- Each snap type has positive, outside-tolerance and competing-candidate tests.
- Hidden, filtered, clipped or snap-disabled references do not contribute candidates.
- Locked references can still provide snaps when reference snapping is enabled.
- Candidate ranking is deterministic and stable near thresholds.
- Reference transforms are applied correctly to all candidate geometry.
- E2E: draw a beam/line and column using snaps to a vector reference.
- Performance smoke tests cover large imported drawings and pointer movement.

### Milestone 4 — Drafting intelligence and temporary dimensions

**Goal:** make the drawing interaction fast, precise and consistent.

Tasks:
- Route every structural tool through the same inference/constraint resolver.
- Connect temporary dimensions to the live preview state.
- Show X/Y offsets, length, angle, spacing and relevant alignment dimensions.
- Add typed length, angle and polar input to all applicable tools.
- Add horizontal/vertical tracking, extension, parallel/perpendicular guides and polar increments.
- Support Shift direction lock and Tab/Shift+Tab field/candidate behavior with predictable keyboard precedence.
- Make dimension placement readable and avoid visual clutter.
- Preserve dimension association with created structural geometry where appropriate.

Tests and acceptance:
- Preview dimensions update on pointer movement and disappear or become persistent only according to commit behavior.
- Typed values override inferred preview coordinates exactly within numeric tolerance.
- All drawing tools behave consistently.
- Tracking and snap candidates do not flicker or switch unpredictably.
- Keyboard shortcuts do not fire while an editable field owns focus.
- E2E covers a beam starting at a reference column, aligning to a second reference, typing a length and committing.

### Milestone 5 — Guided structural grid creation (signature feature)

**Goal:** let an engineer create a structural grid by hovering over architectural axes/geometry, accepting inferred locations and automatically dimensioning spacing.

Tasks:
- Implement a dedicated Structural Grid command with horizontal, vertical and continued-chain modes.
- Detect likely reference axes from vector lines, wall centerlines, repeated columns and user-selected reference points.
- Show a live grid preview and clearly identify the source alignment.
- On acceptance, create a native structural grid entity and assign the next axis label.
- Calculate spacing from the previous accepted grid and show the dimension live.
- Show cumulative coordinates and support typed spacing/absolute coordinate overrides.
- Support sequence continuation, reverse direction, label prefix/suffix and renumbering.
- Offer manual pick-two-points mode when inference is uncertain.
- Keep grid spacing dimensions associative to the resulting grid entities.
- Provide settings for snap tolerance, axis recognition and label sequence.
- Never auto-accept an inferred axis; the user confirms each grid.

Tests and acceptance:
- Given known reference axes, preview positions match expected world coordinates.
- Spacing and cumulative dimensions are correct for non-uniform grids.
- Labels increment, reverse and renumber predictably.
- Typed overrides place grids at exact requested coordinates.
- Ambiguous candidates can be cycled or rejected.
- E2E: attach a reference, hover/select a sequence of axes, accept grids A–D, verify spacing labels and dimensions, save/reopen.

### Milestone 6 — Structural tools and review checks

**Goal:** complete the everyday structural plan workflow.

Tasks:
- Implement rectangular/circular columns, beams, walls and structural grid tools using shared inference.
- Add structural properties (section/dimensions/thickness/rotation/elevation where relevant).
- Support moving selected objects between structural layers.
- Add automatic dimensions for column-to-column, grid-to-grid and wall/beam relationships.
- Add review checks for inconsistent grid spacing, misaligned columns, disconnected beam ends and dimension conflicts.
- Add review annotations and clear severity/status presentation.
- Ensure reference visibility does not affect structural output unless explicitly requested.

Tests and acceptance:
- Structural entity geometry and properties survive edit, undo/redo and save/reopen.
- Review checks have deterministic test fixtures and avoid false claims where geometry is ambiguous.
- DXF output contains only intended structural entities/layers by default.
- E2E: create a small structural plan over a reference, run review checks and correct a flagged alignment.

### Milestone 7 — PDF vector references and robust CAD exchange

**Goal:** support precise PDF geometry and practical exchange with consultant drawings.

Tasks:
- Extract vector paths from PDF pages where available.
- Preserve PDF page identity and transforms; support multi-page selection.
- Expose vector PDF endpoints, midpoints, intersections and curve candidates to reference snapping.
- Keep scanned PDFs on the raster path with calibration.
- Improve DXF import/export coverage for lines, polylines, arcs, circles, text and layer metadata.
- Evaluate DWG read/write strategy and licensing/dependency constraints before committing to a codec.
- Provide import diagnostics for unsupported or approximated entities.
- Make export reference inclusion an explicit option.

Tests and acceptance:
- Vector PDF candidates match transformed source geometry within defined tolerances.
- Multi-page reference transforms are independent.
- Scanned PDF calibration works without vector extraction.
- DXF round-trip preserves supported geometry and layer assignments.
- Unsupported entities produce diagnostics rather than silent loss.
- Exported structural drawing opens in at least one independent CAD viewer/parser.

### Milestone 8 — Performance, release and production readiness

**Goal:** deliver a reliable Windows application suitable for real project work.

Tasks:
- Profile large references and structural documents.
- Cache reference extraction and invalidate correctly when transforms/layers change.
- Move expensive parsing and image processing off the UI thread.
- Add autosave/recovery and clear file error handling.
- Improve accessibility, shortcuts and status feedback.
- Package Windows desktop build only after web workflow is stable.
- Prepare representative test projects and release documentation.

Tests and acceptance:
- E2E covers attach → prepare → infer → grid → structural elements → review → export.
- Save/reopen regression passes with missing and available references.
- Large-document performance is measured and regressions are monitored.
- Windows installer is built and launch-tested on Windows before release claims.
- CI is green and release artifacts are verified.

## Priority order

1. Document integrity, undo/redo, functional layers and editable properties.
2. Reference model and raster attachment/calibration.
3. Reference layer filtering and cleanup presets.
4. Shared reference geometry and live inference integration.
5. Temporary dimensions and tracking across tools.
6. Guided structural grid creation.
7. Structural tools and review checks.
8. Vector PDF and stronger DWG/DXF exchange.
9. Performance, autosave and desktop packaging.

This order deliberately starts with raster attachment because it validates the reference model and UX without blocking on complex CAD parsing. DXF and vector PDF then add exact geometry snapping. DWG support should be selected based on a maintainable, legally compatible codec strategy.

## Testing strategy

- **Unit tests:** geometry, transforms, calibration, candidates, ranking, constraints, dimensions, grid sequencing, layer filters, document transactions and serialization.
- **Integration tests:** reference provider + inference, tools + temporary dimensions, layer filters + snapping, grid tool + reference geometry, save/load + asset relinking.
- **End-to-end tests:** realistic workflows using representative architectural DWG/DXF/PDF/image fixtures.
- **Performance tests:** extraction, spatial queries, pointer-move inference and rendering on large references.
- **Manual acceptance:** engineers test real consultant drawings, including messy layer names, inconsistent units, rotated plans, scanned pages and incomplete geometry.

### Required commands

```sh
npm install
npm test
npm run check
npm run build
npm run dev
npm run test:e2e
```

### Definition of done

A feature is done only when:
- Its behavior, limitations and override controls are documented.
- Unit tests cover normal, boundary, ambiguous and failure cases.
- Integration/E2E tests cover interactions with dependent systems.
- TypeScript checks, production build and relevant CI jobs pass.
- No source reference is modified destructively.
- Recognition uncertainty is communicated and can be overridden.
- README/developer docs reflect actual implementation status.
- The PR reports commands run and actual results; unrun tests are not described as passing.

## Initial backlog mapping

Existing issues #17–#25 remain relevant:
- #17 functional layers → extend to reference layer management.
- #18 document undo/redo → prerequisite for safe reference and layer operations.
- #19 drawing tools → structural tools only, sharing inference.
- #20 object snapping → extend to reference geometry.
- #21 editable properties → include references and structural entities.
- #22 project validation → include reference metadata/assets and unique IDs.
- #23 temporary dimensions → connect to every drawing command.
- #24 tracking guides → connect to reference inference.
- #25 DXF export → preserve structural layers and keep references optional.

New reference-first work should be tracked in dedicated issues for reference model/attachment, raster calibration, CAD layer filtering, reference geometry providers, vector PDF snapping and guided structural grid creation. Avoid duplicating the existing foundational issues; link dependencies and update their scope where necessary.
