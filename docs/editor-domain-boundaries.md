# Editor Domain Boundaries

Status: Task A3 extraction contract (incremental)

The editor entrypoint is an orchestration boundary. Domain modules expose pure
operations or focused UI components; they do not reach back into `src/index.js`.
Extraction is behavior-neutral: public function signatures, object identity,
mutation behavior, serialized documents, save semantics, and build entrypoints
remain unchanged.

## Tree Domain

Module: `src/tree.mjs`

Public query API:

- `findBlock(root, id)` returns the original matching block object or `null`.
- `findBlockLocation(root, id)` returns the block, parent ID, non-text sibling
  index, depth, and ordered ancestor IDs, or `null`.
- `countBlocks(root)` counts block nodes, including the root, while excluding
  inline text children.

Public command API:

- `canMoveBlock(root, id, direction)` reports whether a non-text sibling exists
  in the requested direction.
- `moveBlockSibling(root, id, direction)` mutates sibling order and reports
  whether a move occurred.

These functions have no React, Zustand, browser, REST, or serialization
dependency. Query functions do not mutate their input. Existing callers import
them directly; no compatibility wrapper remains in `src/index.js`.

## Store Block Commands

Module: `src/store/block-commands.mjs`

Public API:

- `updateBlockStyleSet(state, id, breakpoint, update)` clones an editable style
  set and commits only a semantic change through the existing history API.
- `updateEditableBlock(state, id, mutate, allowLocked)` clones and commits an
  editable block while preserving the existing lock override contract.
- `createPrimitiveBlock(primitive)` delegates creation to the element registry.
- `setStyleSetBindings(styleSet, bindings)` mutates only the token-binding branch
  and prunes it when empty.
- `setHiddenInFallback(fallback, hidden, visibleDisplay)` preserves the legacy
  fallback-display serialization used by responsive visibility.

This module composes existing pure tree, responsive-style, registry, and history
APIs. It does not own Zustand or React and cannot bypass `commitDocument`.

## Element Import Boundary

Files under `src/elements/` are data/model definitions and resolvers. They must
not import React, `@wordpress/element`, Zustand, a store module, or the editor
entrypoint. `tests/import-boundaries-test.mjs` enforces this rule recursively for
JavaScript element modules.

## Pending Extractions

The Zustand store, DnD adapters, preview CSS, inspector controls, diagnostics,
forms, commerce, widgets, motion/actions, and editor persistence orchestration
remain in `src/index.js`. They must move in focused slices with tests that pin
their existing API and behavior. Dormant panels must not be activated or removed
as a side effect of extraction.
