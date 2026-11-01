# Revit-style command input system proposal

## Goal

Provide a keyboard-first command workflow familiar to Autodesk Revit users. Forma CAD should support multi-character command aliases, discoverable command names, and configurable shortcuts rather than depending only on one-letter key handlers.

This document is a design proposal. It does not implement command execution or change existing shortcuts.

## User experience

- A command input bar is available at the bottom of the drawing workspace and can be focused with a documented shortcut (proposed: `Esc` returns focus to the canvas; a dedicated command-focus shortcut remains to be selected).
- Users can type a command name or alias, such as `LINE`, `LI`, `MOVE`, `MV`, `COPY`, `CO`, `ROTATE`, `RO`, `ALIGN`, `AL`, `TRIM`, or `TR`.
- Suggestions appear while typing and show the command name, alias, and short description.
- Enter starts the highlighted command; Escape cancels the current command or closes suggestions.
- Command prompts and options appear in the command bar, with numeric values accepted where appropriate.
- Existing drawing-time temporary dimensions remain separate from command-name entry, so typed dimensions such as `450`, `30deg`, and `@450<30` continue to work while drawing.

## Initial command registry

| Command | Proposed aliases | Initial behaviour |
|---|---|---|
| Select / Modify | `ESC` | Return to selection mode |
| Line | `LI` | Start line drafting |
| Move | `MV` | Select objects, then specify displacement |
| Copy | `CO` | Select objects, then specify copy displacement |
| Rotate | `RO` | Select objects, specify pivot and angle |
| Align | `AL` | Align selected geometry to reference geometry |
| Trim / Extend | `TR` | Trim or extend to a selected boundary |
| Offset | `OF` | Offset supported geometry by a distance |
| Mirror | `MI` | Mirror selected geometry about an axis |
| Delete | `DE` | Delete selected objects |

Aliases are provisional. Before implementation, verify the defaults against common Revit conventions and avoid collisions with text entry, OS/browser shortcuts, and existing Forma CAD commands.

## Architecture

1. **CommandDefinition** — stable command ID, display name, aliases, description, availability and execution handler.
2. **CommandRegistry** — case-insensitive lookup by name or alias; detect and reject duplicate aliases.
3. **CommandInputController** — input text, suggestion navigation, Enter/Escape handling, prompt state and command cancellation.
4. **CommandContext** — access to the document, selection, active tool, inference and undo/redo services without coupling command definitions to DOM elements.
5. **CommandHistory** — recent commands and repeat-last-command behaviour, with clear rules for commands that require fresh selections.
6. **Shortcut settings** — user-editable aliases, persistence and reset-to-defaults.

## Compatibility and keyboard rules

- Multi-character aliases must be parsed as a sequence, not dispatched as unrelated single-key shortcuts.
- Do not steal keystrokes while an HTML input, textarea, editable property field, or command input has focus.
- While a drawing segment is active, numeric and angle input belongs to temporary dimensions; command execution must not unexpectedly interrupt that segment.
- Shift remains a momentary direction-lock modifier during drafting.
- Tab retains its current contextual behaviour: draft-field switching during a segment, snap-candidate cycling otherwise.
- Escape cancellation should be consistent and should not silently delete committed geometry.
- Provide mouse-accessible command suggestions; keyboard entry is an accelerator, not the only way to invoke commands.

## Delivery plan

1. Add registry types and collision/lookup tests.
2. Add command input bar and suggestion navigation without changing existing tools.
3. Register existing tools (Select, Line, Grid, Column, Beam, Wall) through the registry.
4. Add selection-based editing commands (Move, Copy, Rotate, Delete).
5. Add geometry modification commands (Align, Trim/Extend, Offset, Mirror).
6. Add configurable aliases, command history and persistence.

## Acceptance criteria

- Users can invoke registered commands by full name or alias.
- Alias lookup is case-insensitive and deterministic.
- Duplicate aliases are rejected with a useful error.
- Suggestions are keyboard- and mouse-accessible.
- Escape cancels the active prompt safely.
- Temporary dimensions, Shift direction locking, Tab drafting fields, snap cycling and existing shortcuts remain regression-tested.
- Command execution is testable without a browser DOM; UI behaviour has Playwright coverage.

## Out of scope for the proposal

- Implementing every Revit command.
- Exact parity with Revit's full shortcut catalogue.
- Replacing temporary dimension entry with command input.
- Changing the geometry/inference engine as part of the command-bar foundation.
