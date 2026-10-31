# Forma CAD

Lightweight 2D structural drafting for grids, columns, beams and walls.

## Architecture

- `src/core/geometry.ts`: pure vector, projection and intersection math (millimetres, Y-up).
- `src/core/model.ts`: typed document entities and structural layers.
- `src/core/spatial.ts`: uniform-grid spatial hash for local candidate lookup.
- `src/core/inference.ts`: pixel-tolerance snapping and temporary tracking guides.
- Rendering and tools consume the core API; they must not become the source of document geometry.

## Development

```sh
npm install
npm test
npm run check
```

## Extending inference

1. Add a snap or guide type to the unions in `inference.ts`.
2. Add candidate generation in `infer`, keeping tolerances in screen pixels and converting them to world units with `viewScale`.
3. Add its priority (for snaps), guide construction and label.
4. Add an isolated fixture in `tests/inference.test.ts`.

The v0.1 geometry core is browser-safe and has no DOM dependency. Rendering, tools, DXF export and the desktop shell follow after this core milestone.
