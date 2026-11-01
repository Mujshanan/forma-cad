# Forma CAD

**Reference-first structural drafting for engineers.**

Forma CAD is a focused 2D structural drawing and review workstation. Its purpose is to help structural engineers produce accurate structural layouts quickly by drawing directly over architectural references—DWG/DXF, vector PDF, scanned PDF and raster images—with intelligent snapping, inferred alignments, automatic dimensions and guided structural grid creation.

Forma is **not intended to be a general-purpose AutoCAD clone**. The central workflow is:

1. Attach an architectural drawing as a reference.
2. Fade, lock, calibrate, clip and filter its layers without destructively editing the source.
3. Hover over reference geometry to discover axes, edges, corners, centers and alignments.
4. Draw structural grids, columns, beams and walls using inferred geometry.
5. See temporary dimensions and alignment guides while drawing; type exact values when needed.
6. Review and export a clean structural drawing independently of the architectural reference.

The defining feature is **reference-to-structural drafting**: use the imported drawing as an intelligent guide, not as a pile of architectural entities that the engineer must clean up first.

> **Project stage:** Early 2D drafting prototype. The geometry, spatial-index and inference foundations exist, and a basic SVG drawing interface is available. Reference import, reference-aware inference and the guided structural-grid workflow are not yet implemented end-to-end.

## Product principles

- **Reference-first, non-destructive:** imported architecture remains a separate reference; accepted structural geometry belongs to the Forma document.
- **Fast by inference:** the cursor should discover useful geometry and alignments instead of requiring manual coordinate entry for every point.
- **Dimensions while drawing:** temporary dimensions, spacing and angles appear during preview; typed values can override inferred values.
- **Structural, not generic:** prioritize grids, columns, beams, walls and structural review over broad CAD command coverage.
- **Trustworthy and controllable:** inference is visible, deterministic and overridable; never silently commit uncertain recognition.
- **Clean deliverables:** structural layers and exported drawings remain independent of reference visibility and source-file organization.

## Main workflows

### 1. Attach and prepare a reference

- Attach DWG/DXF, vector PDF, scanned PDF, PNG or JPG as a separate reference.
- Preserve the source and its transform (position, scale, rotation and clipping).
- Calibrate raster or non-scaled PDF references using a known distance.
- Control visibility, opacity/fade, lock, clipping and snapping independently.
- For CAD references, inspect source layers and offer visibility presets such as Architectural Background, Walls/Openings, Grids, and Clean Background.
- Keep original reference layers intact; use filters and overrides rather than deleting architectural content.

### 2. Draw using reference geometry

- Snap to reference endpoints, corners, midpoints, intersections, centers, perpendiculars and nearest points.
- Infer wall centerlines, parallel edges, repeated axes and likely column centers where confidence is sufficient.
- Display the snap type and source so the engineer can understand what Forma detected.
- Provide deterministic candidate cycling and manual override.
- For raster references, support image-assisted recognition as a separate, confidence-aware capability; do not pretend pixels are exact CAD geometry.

### 3. Create structural grids quickly

- Hover over a reference axis, wall centerline or recognized column alignment.
- Preview a structural grid line before placement.
- Automatically measure spacing from the previously accepted grid.
- Suggest sequential axis labels and show cumulative coordinates.
- Click/Enter to accept; type an exact spacing or position to override.
- Continue through the plan without restarting the command.
- Keep grid dimensions associative to the created grid geometry.

### 4. Draft and review structural elements

- Place rectangular/circular columns, beams, walls and structural grids.
- Use the same inference, tracking and temporary-dimension system in every tool.
- Edit structural properties and dimensions without redrawing.
- Review spacing, alignment and dimension consistency.
- Export structural geometry and annotations without baking the architectural reference into the deliverable unless explicitly requested.

## Current capabilities

Implemented foundations in the repository include:

- TypeScript/Vite application and SVG canvas prototype.
- Millimetre-based, Y-up world geometry and pan/zoom transforms.
- Typed structural entity model and default structural layers.
- Uniform-grid spatial index.
- Reference geometry abstractions for supported structural entities.
- Initial snap candidate and alignment inference functions.
- Temporary dimension calculations and typed length/angle/polar input primitives.
- Basic selection and drawing interactions for line, circle and column.
- JSON project save/open and browser end-to-end tests for basic drawing workflows.

These foundations are not equivalent to a finished workflow. In particular, the current pointer interaction is not yet connected to the full inference pipeline, and imported DWG/PDF/image references are not yet supported.

## Product scope

### Core product (highest priority)

- Reference attachment and calibration.
- Reference visibility, opacity, locking, clipping and independent transforms.
- CAD reference layer filtering and architectural cleanup presets.
- Vector PDF geometry extraction and reference snapping.
- Raster reference display and calibration.
- One shared reference-aware snapping and inference engine.
- Live temporary dimensions and alignment guides integrated into all drawing tools.
- Guided grid creation with automatic spacing, labels and typed overrides.
- Structural column, beam and wall drafting.
- Reliable document history, properties and project persistence.
- Structural DXF export.

### Later capabilities

- More advanced image recognition and semantic architectural element detection.
- Dimension and alignment consistency checks.
- Review markups, issue annotations and drawing comparison.
- Drawing sheets, layouts and print/export workflows.
- Additional CAD exchange formats and larger-document optimizations.

### Explicitly not a near-term goal

3D modelling, BIM authoring/families, structural analysis, reinforcement detailing, collaboration infrastructure, a full AutoCAD command clone or a general-purpose CAD feature catalogue.

## Architecture overview

Keep the document model, geometry, inference and reference processing independent of the UI.

- `src/core/geometry.ts`: vector math, projections, distances, bounds and intersections.
- `src/core/model.ts`: structural document entities and layers.
- `src/core/spatial.ts`: spatial lookup for nearby geometry.
- `src/core/references.ts`: reusable world-space reference geometry.
- `src/core/inference.ts`: snap candidates, ranking, hysteresis and guide calculations.
- `src/interaction/temporary-dimensions.ts`: live dimensions and typed measurement parsing.
- `src/core/view.ts`: world/screen transforms.
- Planned `src/references/`: reference document model, import adapters, calibration, transforms, layer filters and extraction.
- Planned `src/tools/`: stateful structural drawing commands sharing a common lifecycle.
- Planned `src/interaction/`: pointer/keyboard routing, inference resolution and command state.
- Planned `src/rendering/`: reference rendering, structural scene and transient overlays.
- Planned `src/document/`: transactions, layers, history, validation and persistence.

Reference geometry should be queried through a common provider interface. A provider can expose exact vector geometry (native entities, DXF/DWG adapter, vector PDF) or approximate candidates (raster recognition). Each candidate should carry its source, type and confidence. Only accepted structural objects are committed to the editable structural document.

## Development plan

The detailed, phased roadmap, acceptance criteria and testing strategy are maintained in **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)**.

## Development commands

```sh
npm install
npm test
npm run check
npm run build
npm run dev
npm run test:e2e
```

## Definition of done

A feature is complete only when its behavior and edge cases are documented, relevant unit/integration/end-to-end tests pass, type checking and production build pass, and the pull request reports actual test results. Reference workflows must also be tested against representative architectural drawings—not only synthetic geometry.

## Contributing

- Keep geometry and inference pure and independently testable.
- Store document geometry in millimetres and Y-up world coordinates; never store screen coordinates in entities.
- Keep references separate from editable structural entities.
- Keep previews, snap markers, guides and temporary dimensions transient until the user commits.
- Make recognition and inference visible, deterministic and overridable.
- Work in focused branches and small pull requests; do not claim behavior is complete until the end-to-end workflow is verified.
