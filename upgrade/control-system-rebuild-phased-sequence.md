# Control System Rebuild — Phase-by-Phase Paste Sequence

**How to use this file**: paste ONE phase block at a time into your
coding agent. Do not paste the next phase until the current one's
verification checklist genuinely passes. This splits the original
massive prompt at its own natural phase boundaries (it already had 14
well-designed phases — the problem was pasting all 14 as one
instruction with no stopping point, not the phases themselves).

**Before Phase 1 — paste this short preface first, in its own message:**

```
Before we start the control-system rebuild, I need you to establish
ground truth. Do NOT assume a mature legacy control system exists to
audit and migrate from unless you actually find one.

First, tell me honestly: does this repository currently have a working
right-side control panel at all, and if so, does it show one universal
set of controls for every element type, or does it already have any
per-element variation? Report what you actually find in the codebase
before we proceed to any audit or migration planning - the rebuild
plan depends on this being accurate, not assumed.
```

Read the agent's honest answer. If there's little or nothing to
migrate yet, skip the migration-specific parts of Phases 1, 10, and 13
below when you get to them — note this explicitly when you paste those
phases, so the agent doesn't invent migration work for a system that
doesn't exist.

---

## Existing decisions to cite before Phase 2 (paste alongside it)

```
Before defining the target architecture, align with decisions already
made for this project - do not redesign these from scratch:

- Input mechanics are already decided: draggable/scrubbable numeric
  controls and dropdowns for finite-option fields, with a single
  source of truth so canvas-drag, panel-scrub, and manual typing can
  never disagree with each other.
- A centralized conditional-visibility system already exists (or is
  planned) specifically to avoid controls inconsistently disappearing
  due to ad-hoc, duplicated show/hide logic - any conditional control
  behavior in this rebuild must run through that one system, not a
  second one.
- Content slots already exist as a mechanism for marking which values
  are client-editable content vs. structural design - factor this into
  how the Content tab's dynamic-content controls are designed.
- Named style presets (bundled typography/spacing choices) already
  exist to prevent decision paralysis on raw values - the new
  architecture's "Style" tab should surface presets as the primary
  interaction, with raw value controls available but deliberately one
  layer deeper, not immediately alongside the preset picker.

Design the target architecture to integrate with these, not replace
them.
```

---

## Phase 1 — Repository Audit

```
Perform a full audit of the existing control-related code: current
sidebar architecture, control registry, element registry, selected
element state, style/content/responsive state, breakpoints, hover/
focus state handling, style serialization, CSS generation, preview
rendering, inspector rendering, undo/redo integration, save system,
WordPress persistence, element duplication/deletion/copy-paste, any
existing generic or per-element controls, conditional controls,
design-token support, custom CSS handling, and builder preview sync.

Document what can safely be reused, what must be removed, and what
needs refactoring rather than deletion. Do not delete anything yet -
this phase is audit only. Report your findings before proceeding.
```

**Verify before continuing**: does the audit report feel accurate
against what you know of the actual codebase? If it's inventing
systems that don't exist, correct it before moving to Phase 2.

---

## Phase 2 — Target Architecture

```
Define the target schema-driven control architecture: schema format
(each element declares content/style/advanced controls), control
registry, element registry, responsive model, state model, and
inheritance model (global theme -> element default -> element instance
-> responsive override -> state override). The sidebar renderer should
read an element's definition and render only its declared controls -
no giant switch statement on element type.

Do not tightly couple control UI components to individual element
rendering code. Show me the schema format you're proposing before
implementing anything.
```

**Verify before continuing**: does the schema shape make sense, and
does it genuinely support "add a new element by defining its schema,
not by writing new inspector code"? This is the architectural bet the
whole rebuild rests on - worth being sure before Phase 3.

---

## Phase 3 — Primitive Controls

```
Implement the foundational reusable control primitives: text input,
textarea, rich text, number input, unit input, select, multi-select,
toggle, button group, color picker, gradient picker, media/image/video
picker, URL/link control, alignment control, dimension/spacing/border/
box-shadow/typography/background controls, and similar primitives as
needed. Each must be genuinely reusable, not rebuilt per element.

Confirm: app compiles, no console errors, primitives render correctly
in isolation before proceeding.
```

**Verify before continuing**: pick 3 primitives and confirm they
actually work standalone, not just that the code compiles.

---

## Phase 4 — Shared Control Groups

```
Implement the shared control groups that combine primitives: Typography
group, Background group, Border group, Spacing group, Size group,
Position group, Transform group, Effects group. These should be built
once and reused across every element type that needs them.

Confirm: app compiles, groups render correctly, no console errors.
```

**Verify before continuing**: confirm no group duplicates logic that
belongs in a primitive from Phase 3 - groups should compose primitives,
not reimplement them.

---

## Phase 5 — New Inspector Renderer

```
Build the schema-driven inspector: reads an element's schema (from
Phase 2) and renders its Content/Style/Advanced tabs using the
primitives and groups from Phases 3-4. Include the sidebar header
(element icon, name, tabs) and breadcrumb for nested elements.

Confirm: builder opens, canvas renders, element selection works,
inspector opens, no console errors, no PHP warnings.
```

**Verify before continuing**: this is the first point the new system
is actually visible - open it yourself and confirm it looks and
behaves as expected before any real elements are migrated to it.

---

## Phase 6 — Core Elements Only (do not attempt full element coverage yet)

```
Migrate ONLY these elements to the new schema-driven system first:
Section, Container, Heading, Text, Button, Image. Validate the
architecture works end-to-end on these before touching anything else -
do not proceed to other elements in this phase, regardless of how
straightforward they might seem.

Confirm: each of these 6 elements shows only its relevant controls
(e.g. Button shows link/icon controls, Heading does not), values
update the canvas live, save and reload work correctly for each.
```

**Verify before continuing — this is the most important checkpoint in
the whole sequence**: does selecting a Button genuinely show different,
button-specific controls than selecting a Heading? Save a page using
these 6 elements, reload it, confirm nothing was lost. If this doesn't
work cleanly on just 6 elements, do not proceed to Phase 7 or 8 - fix
the architecture here, where the blast radius is small.

---

## Phase 7 — Responsive and State Integration

```
Fully integrate responsive values (desktop/tablet/mobile, cascading
so an unset tablet value inherits desktop, not duplicated) and state
values (default/hover/focus/active, only showing states relevant to
each element type) into the 6 elements from Phase 6.

Confirm: setting a tablet override doesn't affect desktop, setting a
hover color doesn't affect the default state, and both persist
correctly through save/reload.
```

**Verify before continuing**: test the specific cascade scenario -
set desktop to one value, leave tablet unset, confirm tablet correctly
shows the inherited desktop value, not a separate unset field.

---

## Phase 8 — Remaining Elements

```
Now migrate the remaining current builder elements to the new schema
system, following the same pattern validated in Phases 6-7. Work
through them in logical groups (structural elements, then text
elements, then media elements, then interactive elements) rather than
all at once - confirm each group before moving to the next.

For each group, confirm: only relevant controls appear per element
type, values update live, save/reload works.
```

**Verify before continuing**: do this group by group, not as one
giant batch - ask for confirmation after each logical group completes,
the same discipline as every other phase.

---

## Phase 9 — Advanced Controls

```
Add the Advanced tab's controls across all migrated elements: CSS
classes, CSS ID, custom attributes (data-*, aria-*), custom CSS
(scoped so it cannot affect the WordPress admin or builder's own UI),
visibility conditions, position/z-index/overflow, transforms,
transitions, and accessibility settings (ARIA attributes here;
essential accessibility like image alt text belongs in Content, not
here).

Confirm: custom CSS entered for a page element genuinely cannot leak
into or affect the builder's own toolbar, sidebar, or modals.
```

**Verify before continuing**: this CSS isolation check is a real
security/stability requirement, not a nice-to-have - test it directly
by entering deliberately aggressive custom CSS and confirming the
builder's own UI is unaffected.

---

## Phase 10 — Data Migration (skip if Phase 1 found nothing to migrate)

```
If Phase 1's audit found existing saved pages using an old control
schema, build a migration layer mapping old values to the new schema
(e.g. old textColor -> style.typography.color). Test against real
existing saved pages: confirm text, images, links, layouts, styles,
responsive values, and custom CSS all survive migration with minimal
visual regression.

If Phase 1 found no meaningful legacy data, skip this phase entirely
and say so rather than inventing migration work.
```

**Verify before continuing**: if this phase ran, compare a real
migrated page's before/after screenshot directly.

---

## Phase 11 — Performance

```
Optimize inspector rendering and live preview updates: memoize control
schemas, batch updates, avoid full stylesheet regeneration on every
keystroke, debounce expensive controls, avoid unnecessary rerenders.

Test on a page with many elements (reuse any existing deep-nesting
performance test page if one exists in this project) - confirm typing
in a text field feels immediate and dragging a slider feels smooth.
```

**Verify before continuing**: this needs a real before/after
comparison if a performance baseline already exists elsewhere in this
project - ask whether one does before treating this as a fresh
measurement.

---

## Phase 12 — Tests

```
Implement the test matrix: schema tests (correct controls load per
element), conditional tests (controls appear/disappear correctly),
serialization tests, responsive cascade tests, state independence
tests, migration tests (if Phase 10 ran), and basic UI interaction
tests. Cover at minimum: section, container, heading, text, button,
image, and any other elements migrated in Phase 8.
```

**Verify before continuing**: spot-check that the tests actually
fail when you deliberately break something, not just that they pass
on working code.

---

## Phase 13 — Cleanup

```
Search the repository for and remove: old universal inspector
controls, obsolete schemas, duplicated control logic, hardcoded
per-element conditionals scattered through old code, unused styles,
stale imports, and deprecated control components - only what Phase 1
identified as safe to remove. Confirm the app still compiles and the
builder still opens after cleanup.
```

**Verify before continuing**: confirm nothing still-in-use was
accidentally removed - re-test the Phase 6 elements specifically.

---

## Phase 14 — UX Polish

```
Improve tooltips, label quality (human-readable labels like "Button
Text Color" not "color"), responsive/state indicators, reset buttons,
empty states, keyboard navigation and focus indicators throughout the
inspector, and overall visual hierarchy - matching the organizational
quality of mature builders without copying proprietary visual assets.
```

**Verify before continuing**: this is the last phase - do a full,
honest walkthrough as a first-time user would, the same way earlier
phases in this project were dogfooded.

---

## After all phases — final sweep

```
Perform a final repository-wide search for: old universal inspector
controls, obsolete schemas, duplicated control logic, hardcoded
element-specific conditions, unused styles, stale imports, and
deprecated control components that may have survived Phase 13's
cleanup. Clean up what's safe to remove. Confirm there is one clear,
authoritative control system remaining - not two coexisting systems.
```
