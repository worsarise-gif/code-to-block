# Upgrade Implementation Plan 9 — Complete Control Panel (Full Coverage, No Lag)

**Purpose**: Audit revealed a real gap — across all prior phases and
upgrade files, only a partial set of style controls was ever specified
(color, spacing, typography, borders, responsive tabs, global tokens).
This file completes the control system against the full inventory a
professional builder needs, using Elementor's own developer
documentation as the authoritative baseline for what "complete" means,
and fixes the specific, real failure patterns found in developer
reports - not a generic "add more controls" pass.

**The central design tension this file must resolve**: more controls
naturally risk more complexity, more conditional logic, and more
re-render triggers - directly touching the performance work already
built in Upgrade 2 (editor performance, virtualization, memoization).
This file is written so control completeness and performance are
solved together, not traded off against each other.

---

## What "complete" actually means — the authoritative control taxonomy

Sourced directly from Elementor's own developer documentation, which
defines the real shape of a professional control system:

- **Data Controls** — return a single value (text, number, color, etc.)
- **Multi Value Controls** — return multiple related values
- **Unit Controls** — unit-based values (px, %, em, rem, vw/vh)
- **UI Controls** — panel-only elements (dividers, alerts, notices) that
  don't affect output, used for organizing the panel itself
- **Group Controls** — several related controls bundled together, the
  correct model for complex properties. Confirmed groups worth
  matching: Typography, Text Stroke, Text Shadow, Box Shadow, Border,
  Background, Image Size, CSS Filter

Against our existing schema (block-schema.md), the current
`styles.mapped` object needs to support all of the above categories,
not just flat single-value properties.

---

## The three real failure patterns found, and the fix for each

| # | Failure, from real developer reports | Root cause | Fix |
|---|---|---|---|
| 1 | A "columns" control silently disappears when parent layout is Flexbox vs Grid, breaking previously-working setups with no warning | Conditional-visibility logic between controls implemented without a clear, tested contract | A formal, tested conditional-control system with explicit rules, not ad-hoc show/hide logic |
| 2 | Core capabilities missing in a rebuilt system - no grid options at all, can't style text in a "text" widget, must type colors manually instead of picking global tokens | Incomplete initial scope when building a new control system - shipped with gaps rather than full coverage | Complete the full taxonomy above before considering any control category "done" |
| 3 | Responsive controls that don't compose with other developer features, forcing workarounds like duplicating elements per breakpoint | No clear override/inheritance contract for how per-breakpoint values interact with other systems (classes, tokens) | Build every new control on top of the SAME cascade model already proven in Upgrade 2, Part 3 - don't invent a second inheritance system |

---

## Step 1 — Layout controls: Flexbox and Grid, built as one coherent system (fixes failure #2 and #1 together)

```
Add full layout control support to our style panel: both Flexbox and
CSS Grid properties, selectable per container block.

Flexbox properties needed: direction, wrap, justify-content,
align-items, align-content, gap (row/column), and per-child properties
(flex-grow, flex-shrink, flex-basis, align-self, order).

Grid properties needed: grid-template-columns, grid-template-rows,
gap, and per-child properties (grid-column, grid-row placement).

Critical fix for the exact bug pattern found in research (a "columns"
control silently disappearing when parent layout type changes): build
a single, explicit rule for how layout-mode selection affects which
controls appear. When a container's layout mode is set to Flexbox,
Grid-specific controls should be clearly hidden with a stated reason
("Grid controls apply when layout mode is Grid"), not silently absent -
and this visibility logic must be centralized in one place, tested
directly, not duplicated ad-hoc across different widget types (which is
what caused the original bug to appear "suddenly" across many widgets
at once).

Test this specifically against the failure pattern found: create a
container, switch its layout mode between Flexbox and Grid repeatedly,
and confirm the correct controls appear/disappear consistently and
predictably every time, with no lingering state from the previous mode.
```

## Checkpoint for Step 1
Switch layout modes back and forth rapidly and check for any stale or
incorrect control state - this is precisely the kind of bug that
"suddenly" appeared across Elementor's widgets after working fine for
years, so testing repeated mode-switching specifically matters more
than testing it once.

---

## Step 2 — Visual effect group controls: Box Shadow, Border, Background, Filters

```
Add the remaining group controls from Elementor's own control taxonomy
that our system doesn't yet have:

- Box Shadow group: offset X/Y, blur, spread, color, inset toggle,
  support for multiple stacked shadows
- Border group: width (per-side), style, color, radius (per-corner)
- Background group: solid color, gradient (linear/radial, multiple
  color stops), image (with position/size/repeat controls), and
  support for multiple stacked background layers
- CSS Filter group: blur, brightness, contrast, saturate, grayscale,
  hue-rotate

Each of these should follow our existing pattern: values map into
styles.mapped in our schema, integrate with the responsive cascade
system from Upgrade 2 Part 3, and support global token references
where relevant (e.g. a shadow color or border color can reference a
global color token, consistent with our existing token system).

Test each group control on a real block: apply a multi-stop gradient
background, a stacked box-shadow, and a border-radius per corner, and
confirm all render correctly on both canvas and frontend, matching our
existing parity-check expectations.
```

## Checkpoint for Step 2
Run these new controls through the existing parity-check system
(Upgrade 1) to confirm editor and frontend agree - don't treat this as
a separate testing pass, fold it into the system that already exists
specifically to catch this class of mismatch.

---

## Step 3 — Positioning and layering controls (z-index, position, transform)

```
Add controls for element positioning: position type (static, relative,
absolute, fixed, sticky), offset values (top/right/bottom/left),
z-index, and transform (translate, rotate, scale, skew).

These are the controls most likely to interact confusingly with our
layout system (Step 1) and with nesting/drag behavior established
back in Phase 3 - test specifically that setting a block to absolute
positioning doesn't break its draggability or its relationship to
sibling blocks in unexpected ways, following the same care we already
applied to the hero section's layered-background decision.
```

## Checkpoint for Step 3
Test absolute positioning combined with dragging - move an absolutely
positioned block, confirm it behaves predictably rather than jumping
unexpectedly or losing its positioning context relative to its parent.

---

## Step 4 — Fix the responsive/token composition gap (directly addresses failure #3)

```
Audit every new control added in Steps 1-3: confirm each one correctly
composes with BOTH our existing responsive cascade system (Upgrade 2,
Part 3 - base value with tablet/mobile overrides) AND our global token
system (Upgrade 1's per-element override work), using the exact same
underlying mechanism already built and tested for color and typography
- not a second, parallel implementation.

This directly targets the exact frustration found in research: a
developer having to "hardcode values per breakpoint on every element"
or "write custom CSS media queries for every class override" because
responsive controls and other developer-facing features didn't compose
correctly. Every control in our system should support responsive
overrides and token references identically, with no exceptions
requiring workarounds.

Test by taking one new control from Step 2 (e.g. box-shadow color),
setting it to reference a global color token, then adding a
mobile-specific override that uses a different token entirely -
confirm both the token reference and the responsive override work
together correctly, the same test pattern already used for color.
```

## Checkpoint for Step 4
This is the most important checkpoint in this file for long-term
maintainability - confirm there is exactly ONE responsive system and
ONE token system in the codebase, with every control (old and new)
plugging into the same two systems, not parallel implementations that
could drift out of sync with each other over time.

---

## Step 5 — Performance verification against the full expanded control set

```
Re-run the deeply-nested performance stress test from the earlier
performance upgrade file (150+ blocks, 8+ levels of nesting), but this
time apply a realistic mix of the new controls from Steps 1-3 across
many blocks - some with box-shadows, some with gradients, some with
custom layout modes, some with transforms.

Measure the same metrics as before: initial load time, block selection
response time, drag response time, memory usage over a sustained
session. Compare directly against the earlier baseline numbers from
the performance upgrade file's checkpoint.

If performance has measurably degraded compared to the earlier
baseline, identify specifically which new control category is
responsible (likely candidates: multiple stacked box-shadows or
background layers recalculating on every render, or the conditional
layout-control visibility logic from Step 1 re-evaluating too
frequently) and fix that specific bottleneck rather than a general
optimization pass.
```

## Checkpoint for Step 5
This is the direct answer to "make sure it can't cause lag" - real
before/after numbers against the exact same test used earlier, not a
new, easier test that would make comparison meaningless. If numbers
are worse, this file is not done until the specific cause is found and
fixed.

---

## What determines "complete" for this file

Cross-check against Elementor's own control taxonomy one more time
before considering this file finished: Data, Multi Value, Unit, UI, and
Group controls should all have working equivalents in our system, and
every Group category they document (Typography, Text Stroke, Text
Shadow, Box Shadow, Border, Background, Image Size, CSS Filter) should
be genuinely present - not just the ones covered explicitly in Steps
1-3. If a category from their documented list is still missing after
this file, name it explicitly as a known gap rather than letting it go
unnoticed.

## What's explicitly out of scope

A visual custom-widget-development IDE (the "Element Studio" feature
mentioned in research as a competitor differentiator) and searchable
control-panel search-by-keyword are real, valuable ideas but belong to
a future UX-polish pass, not this file, which is specifically about
control *coverage* and *correctness*, not panel navigation UX.

## Note for decisions-log.md

Record that every new control added in this file and going forward
must plug into the existing responsive-cascade and global-token systems
rather than creating parallel logic - this is the direct, permanent fix
for the composition-gap failure pattern found in research, and it's
worth protecting as a standing rule for any control added after this
file too, not just the ones built here.
