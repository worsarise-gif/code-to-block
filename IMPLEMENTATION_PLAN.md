# Evidence-First Production Readiness Audit & Execution Blueprint

I audited the current public `main` branch of `worsarise-gif/code-to-block`, including the editor architecture, element registry, control catalog, schema v3, parser/importer, isolated canvas, drag/drop, history, persistence/autosave, REST controller, frontend renderer, package/test configuration, and the repository's existing acceptance audit.

One important correction from the earlier assessment: the current parser source is about **1,265 source lines**, not 4,000; GitHub's rendered page count was misleading. The much larger architectural concentration is now `src/index.js`, which is roughly **9,005 lines**.

The project has also progressed beyond parts of the August 25 acceptance audit. It now has a real element registry/resolver, parent-layout context supplied to element controls, schema v3, an isolated iframe canvas, autosave, revisions endpoints, breadcrumbs, Navigator components, and other foundations that should **not be rebuilt**.

The correct direction is therefore:

**stabilize → complete → consolidate → verify → then expand.**

---

# Executive finding: what the builder needs right now

The builder does **not** primarily need more features.

It needs six things first:

1. **A release-grade end-to-end verification system**
2. **Completion of the per-element controls architecture**
3. **One authoritative structural/tree mutation layer**
4. **Save/autosave/recovery behavior that never fails silently**
5. **Importer preservation and asset-resolution completion**
6. **Decomposition of the 9,000-line editor without rewriting working systems**

Those six areas affect almost everything else.

The repository describes v0.22.0 as supporting a very broad set of functionality, but its own acceptance audit previously concluded that the upgrade was not fully accepted and specifically identified incomplete controls, drag invariants, forms, accessibility, caching, and lint quality.

Several of those findings have since been partly corrected, so they should **not** simply be copied into a new roadmap.

---

# Immediate Action Plan

## P0 status

I did **not** find a currently confirmed P0 data-corruption exploit, arbitrary editor-script execution path, or known fatal save bug from static inspection of current `main`.

That is important.

Do not manufacture P0 work where evidence does not support it.

However, there is a **P0 verification gate**:

> Production release must remain blocked until save/load/refresh/publish, tree integrity, canvas containment, script containment, migration, and recovery are proven by automated browser tests.

The existing project has extensive unit/integration scripts, but `package.json` contains no complete browser-user-journey test command and no Playwright/Cypress dependency. The older acceptance audit likewise depended partly on manual live testing.

---

# Immediate 1 — Build the production user-journey regression suite

**Classification:** P1 / CRITICAL release requirement

## Problem

There are many tests for individual subsystems, but there is no authoritative automated test proving the actual builder journey:

Create → edit → move → style → responsive → undo → save → reload → preview → publish → reopen.

## Evidence

The package provides tests for parser, history, tree, drop intent, persistence, isolation, responsive behavior, components, controls and related modules, but no full editor browser E2E script appears in the package configuration.

The repository's August audit explicitly distinguished passing unit tests from real behavior and still required browser measurements and deep drag scenarios.

## User impact

A feature can individually "pass tests" while the integrated builder still fails.

This is the largest confidence gap in the product today.

## Root cause

Testing grew alongside individual features rather than around stable user journeys.

## Recommended solution

Introduce a small Playwright E2E layer around the existing WordPress test environment.

Do **not** rewrite current unit tests.

Use them underneath the E2E suite.

## New structure

```text
tests/
├── unit/
├── php/
├── fixtures/
└── e2e/
    ├── core-builder.spec.js
    ├── persistence.spec.js
    ├── drag-drop.spec.js
    ├── importer.spec.js
    ├── isolation.spec.js
    ├── responsive.spec.js
    └── recovery.spec.js
```

## Acceptance criteria

A test must prove:

1. Builder opens without console error.
2. Add container.
3. Add heading, text, image and button.
4. Edit content.
5. Apply styling.
6. Add tablet/mobile overrides.
7. Reorder elements.
8. Move nested element.
9. Duplicate.
10. Delete.
11. Undo deletion.
12. Redo.
13. Import mixed HTML/CSS/JS.
14. Save.
15. Refresh browser.
16. Compare document tree before/after.
17. Preview.
18. Publish.
19. Compare key frontend output.
20. Reopen editor.
21. Continue editing.
22. No tree IDs are duplicated.
23. No content exists outside the canvas.
24. No imported script executes inside the editor.

## Definition of done

This test becomes a mandatory release gate.

---

# Immediate 2 — Stop silent autosave failure

**Classification:** P1 / CRITICAL user-safety issue

## Problem

Autosave intentionally catches all failures and returns `null`.

The source even documents:

> "Fails silently if the network request fails."

## User impact

A user can believe protection exists while autosaving has actually stopped.

The UI only reports successful autosaves; repeated failure does not appear to create a durable warning state.

## Root cause

Autosave was designed as non-disruptive background protection, but "non-disruptive" became "invisible failure."

## Solution

Keep autosave non-blocking, but make failures observable.

Introduce states:

```text
idle
dirty
autosaving
autosaved
autosave-warning
saving
saved
save-error
offline
conflict
```

Do not throw a modal for transient failure.

Use a persistent status indicator after repeated failure.

## Required behavior

First failure:

> Autosave interrupted. Retrying…

Repeated failure:

> Changes are not currently backed up. Save manually.

Recovery:

> Autosave restored.

## Affected modules

- `src/editor-persistence.mjs`
- `src/index.js`
- `src/components/TopHeader.js`
- REST autosave handling

## Tests

- network rejection
- 401/403
- 409 post lock
- 500
- offline → online
- slow request
- overlapping autosave/manual save
- unload while unsaved

## Definition of done

No background protection mechanism is allowed to fail invisibly.

---

# Immediate 3 — Finish one authoritative tree constraint/mutation API

**Classification:** P1 / IMMEDIATE

## Problem

Structural behavior currently spans multiple systems:

- tree operations
- element registry constraints
- drag intent
- context menu
- duplication
- component insertion
- starter insertion
- importer

The old audit specifically found divergence between paste/duplicate/style-copy and drag behavior, plus invalid form/component drag structures.

The modern element registry now has useful structural metadata such as `canHaveChildren`, `allowedParents`, and `allowedChildren`, which means the foundation already exists.

## Do not rebuild this

Keep:

- `tree.mjs`
- element registry
- drop-intent engine

## Complete the abstraction

Create one public mutation layer:

```text
TreeOperations
├── canInsert()
├── insert()
├── canMove()
├── move()
├── remove()
├── duplicate()
├── paste()
├── wrap()
├── unwrap()
├── replace()
└── cloneSubtree()
```

Every structural change must pass through it.

## Invariant

No UI command may directly splice `children`.

## Required tree validation

After every development-mode mutation:

```text
unique IDs
registered elements
valid parent
valid child
no self-parenting
no ancestor → descendant move
valid depth
valid root
valid form relationships
valid component boundaries
```

Schema v3 already checks unique IDs, registered definitions, tags, style targets and contexts; build on it rather than creating another unrelated validator.

## Definition of done

Drag, paste, duplicate, navigator reorder, starter insertion and component insertion produce exactly the same structural result rules.

---

# Immediate 4 — Complete the new per-element control architecture instead of adding more controls

**Classification:** P1 / IMMEDIATE

This is now one of the strongest parts of the architecture, but it is only halfway finished.

## What already works

The project now has:

```text
src/elements/registry.mjs
src/elements/resolver.mjs
src/controls/catalog.mjs
```

Element definitions include:

- identity
- category
- renderer family
- tags
- parent/child constraints
- content fields
- style groups
- style targets
- states
- default attributes
- props
- styles.

The resolver turns those definitions into Content / Style / Advanced tabs.

The main editor actually uses `resolveInspector()`, and parent display is calculated and passed into it.

Therefore:

**Do not replace the registry.**

It is the right foundation.

## What is lacking

Most style controls are still synthesized as generic CSS property controls.

The catalog does:

```text
property
→ label
→ select if predefined
→ otherwise cssValue
```

and marks virtually every control responsive.

That is far better than the old universal panel, but it is not yet a mature control system.

For example:

```text
box-shadow
background
background-image
transform
filter
border
font-family
font-size
```

should not all behave like generic strings.

## Implement typed controls

```text
LengthControl
UnitControl
SpacingControl
ColorControl
TypographyControl
BorderControl
RadiusControl
ShadowControl
GradientControl
BackgroundControl
TransformControl
FilterControl
MediaControl
IconControl
LinkControl
SelectControl
ToggleControl
NumberControl
RangeControl
```

## Important

Do **not** encode these independently into each element definition.

Elements declare capability/group membership.

Control implementations remain centralized.

## Definition of done

A Button sees button-relevant controls.

An Image sees image-relevant controls.

A Spacer does not see typography.

A Heading does not see irrelevant media settings.

A child inside Flex sees Flex-item controls.

A child inside Grid sees Grid-item controls.

A child in normal flow does not see meaningless Grid/Flex-item controls.

---

# Immediate 5 — Decompose `index.js` without rewriting the editor

**Classification:** P1 architectural reliability

`src/index.js` is approximately **9,005 lines**.

This is now the biggest structural problem in the frontend.

It imports:

- layout components
- DnD
- persistence
- custom CSS
- design tokens
- history
- importer
- commerce
- responsive behavior
- components
- accessibility
- widgets
- semantic roles
- element registry
- inspector handling

among other systems.

Do not rewrite it wholesale.

Extract by responsibility while preserving behavior.

Target:

```text
src/editor/
├── EditorApp.js
├── editor-store.js
├── editor-actions.js
├── selection-service.js
├── save-service.js
├── preview-service.js
├── responsive-service.js
├── import-service.js
├── dnd-controller.js
└── context-menu-controller.js
```

The component files already created—`TopHeader`, `LeftRail`, `RightInspector`, `CenterCanvas`, `NavigatorTree`, `RevisionHistory`—show that decomposition has already started.

Continue that process.

Do not introduce a second state library.

The project already uses Zustand.

---

# Immediate 6 — Complete importer preservation semantics

**Classification:** P1 / IMMEDIATE

## Existing capability

The current parser already:

- normalizes imported code
- classifies source
- extracts PHP
- distinguishes full document vs fragment
- uses `DOMParser`
- extracts scripts
- extracts `<style>`
- records metadata
- handles standalone CSS/JS
- scans URLs
- detects unsafe URL schemes
- removes inline event handlers.

This should **not** be rebuilt.

## Current gap

External stylesheets are explicitly recorded but not fetched:

> `EXTERNAL_STYLESHEET_NOT_FETCHED`

CSS `@import` references are also classified as blocked during analysis.

That means "supports complete HTML" is structurally true, but visual fidelity may still be poor for sites whose styling comes primarily from linked stylesheets.

## Required compatibility model

Every imported node or asset should end in one explicit state:

```text
Native
Hybrid
Preserved
Restricted
```

Never:

```text
Unknown → silently disappear
```

### Native

Fully mapped to builder schema.

### Hybrid

Important fields mapped; unsupported CSS/attributes retained.

### Preserved

Represent entire subtree safely.

### Restricted

Unsafe executable content retained as source metadata where reasonable but disabled.

## Definition of done

Importing unsupported-but-safe HTML cannot silently reduce source content without a diagnostic.

---

# Immediate 7 — Asset-resolution strategy

**Classification:** P1/P2

Do **not** automatically fetch arbitrary remote resources in the browser.

That creates:

- CORS problems
- privacy issues
- SSRF concerns if proxied by WordPress
- tracking
- import unpredictability.

Instead create a controlled asset resolver.

## Modes

```text
Preserve references (default)
Resolve relative references
Fetch same-site assets
Optional trusted external import
```

The frontend renderer already contains resource-base handling and relative URL normalization.

Build on that.

Do not create an entirely separate URL resolver.

---

# Immediate 8 — Complete save conflict and recovery UX

**Classification:** P1

Backend support is stronger than the UI currently suggests.

REST already provides:

- block-tree load/save
- autosave
- revisions
- revision restoration
- post-lock checks
- server version information
- `has_newer_autosave`.

Therefore, **revisions are not missing**.

They exist.

What needs completion is recovery UX.

When `has_newer_autosave = true`, the editor should clearly provide:

```text
A newer autosave was found.

[Restore autosave]
[Keep saved version]
[Compare]
```

Do not simply load one silently.

## Also implement

- conflict message for another editing session
- manual retry
- failed-save retention
- offline state
- local emergency draft if worthwhile

The last item can wait until browser-reload recovery evidence says WordPress autosaves are insufficient.

---

# Immediate 9 — Make lint and release validation clean

**Classification:** P1 production blocker

The August audit recorded:

> Lint: FAIL, 765 errors.

This should be rerun on current `main`; do **not** assume 765 remain.

But the production gate is simple:

```text
npm run lint
npm run build
all JS tests
all PHP tests
all E2E tests
```

must all pass.

Lint cleanup should not become a giant refactoring project.

Fix it incrementally and mechanically where possible.

---

# Immediate 10 — Resolve remaining form correctness issues

**Classification:** P1

The existing audit identified:

- visual fields not matching real controls
- file upload exposed but unsupported
- non-atomic rate limiting
- incomplete external-plugin verification.

Do not add more form widgets until those are confirmed fixed.

Especially:

> Do not expose a File field in the editor if the backend cannot safely receive files.

Either implement the full upload path or temporarily remove/disable that field type.

---

# Current Capability Matrix

| System | Current state | User impact | Priority | Action |
|---|---|---|---|---|
| Builder initialization | Exists | Core | Required | Verify E2E |
| Zustand state | Exists | Core | Required | Keep |
| Element tree | Exists | Core | Critical | Centralize mutations |
| Element IDs | Exists + schema uniqueness validation | Core | Critical | Add mutation-time invariant checks |
| Parent/child rules | Exists in registry | High | Immediate | Enforce everywhere |
| Selection | Exists | High | Required | Regression test |
| Rendering | Exists | Critical | Critical | Parity + E2E |
| Isolated canvas | Exists and architecturally strong | Critical | Critical | Preserve |
| Saving | Exists | Critical | Critical | E2E + conflict testing |
| Loading | Exists | Critical | Critical | Round-trip test |
| Dirty tracking | Exists via content hash | High | Required | Keep |
| Autosave | Exists | High | Immediate | Stop silent failure |
| Revisions | Exists backend/UI component | High | Required | Complete recovery UX |
| Undo/redo | Exists, 50-state bound | High | Required | Add grouped transactions |
| Preview | Exists | High | Required | E2E |
| Publish | Exists and save-first | Critical | Critical | E2E |
| Element registry | Exists, strong foundation | High | Immediate | Complete |
| Per-element Content controls | Exists | High | Immediate | Finish definitions |
| Per-element style groups | Exists | High | Immediate | Replace generic string UX |
| Advanced controls | Exists structurally | Medium/High | Required | Finish field renderers |
| Responsive | Exists: desktop/tablet/mobile inheritance | High | Required | Harden |
| Custom breakpoints | Missing in schema | Medium | Recommended | Later |
| DnD | Exists with dnd-kit | High | Immediate | Centralize constraints |
| Drop indicators | Exists | High | Required | E2E/visual verification |
| Navigator | Exists | Medium | Required | Finish after tree operations |
| Breadcrumbs | Exists | Medium | Works | Keep |
| Parser detection | Exists | High | Required | Keep |
| Full-document parsing | Exists | High | Required | Extend tests |
| External CSS resolution | Incomplete | High for imports | Immediate | Asset resolver |
| Script extraction | Exists | Critical | Required | Harden runtime lifecycle |
| Editor JS isolation | Exists, strong | Critical | Keep | Regression test |
| PHP detection | Exists | High security | Required | Preserve boundary |
| Forms | Exists but historically partial | High | Immediate | Complete |
| Widgets | Exists | Medium | Required | Verify linked architecture |
| SEO | Exists, historically partial | Medium | Required | Finish later |
| Accessibility checker | Exists | High | Required | Improve |
| Design tokens | Exists | Medium/High | Required | Complete after controls |
| WooCommerce | Exists | Medium | Scope-dependent | Verify |
| Persistent revision UI | Exists | Medium/High | Required | Complete |
| Comprehensive E2E | Missing | Critical | Immediate | Build first |
| Runtime performance benchmarks | Incomplete | Medium | Required | Measure before optimization |

The schema currently has exactly three built-in breakpoint definitions—desktop, tablet and mobile—with tablet inheriting desktop and mobile inheriting tablet.

---

# Canvas audit

This is one area where the architecture should **not** be replaced.

The current canvas uses a sandboxed iframe with:

```text
sandbox="allow-same-origin"
```

but importantly **without** `allow-scripts`.

Its CSP includes:

```text
script-src 'none'
connect-src 'none'
object-src 'none'
form-action 'none'
```

and imported JavaScript is not inserted into the editor document.

`CenterCanvas` mounts the editable React tree through a portal into `#ctb-canvas-root` inside that iframe.

That solves the old "header renders above the builder" class of problem much more cleanly than selector hacks.

## Recommendation

**Keep iframe isolation.**

Do not add Shadow DOM.

Do not render imported HTML into WordPress admin.

Do not replace this with complicated CSS-prefix-only isolation.

## Remaining tests

Verify imported CSS containing:

```css
html {}
body {}
* {}
:root {}
position: fixed
position: sticky
100vw
100vh
z-index: 2147483647
```

cannot visually or behaviorally escape the iframe.

---

# JavaScript security audit

Editor handling is appropriately conservative.

Imported scripts are stored as assets with:

```text
enabled_in_editor: false
enabled_in_preview: true
enabled_on_publish: true
```

The server also disables imported script execution for users without `unfiltered_html`.

Frontend rendering explicitly notes that imported scripts are not used by the visual editor.

This foundation is appropriate.

## Missing professional layer

Execution needs better lifecycle classification.

Add metadata such as:

```text
execution:
  mode: raw | mapped | blocked
  placement: head | body | body-end
  requires: [...]
  initialize: once | per-instance
```

Do not attempt to execute arbitrary imported JS inside the editor.

---

# History audit

History exists and is bounded:

```text
HISTORY_LIMIT = 50
PERSISTENT_HISTORY_LIMIT = 100
```

So "implement undo/redo" should **not** appear in a roadmap.

It already exists.

What is missing is **transaction semantics**.

Today each new document commit becomes a history entry. For rapid input such as:

```text
font-size slider 20 → 21 → 22 → 23 → 24
```

you should not create five meaningful undo operations.

Implement:

```text
beginTransaction()
updateTransaction()
commitTransaction()
```

Use it for:

- continuous sliders
- drag
- resize
- multi-field grouped updates
- style preset application.

---

# Parser/importer architecture

The current pipeline is already fairly close to the desired model:

```text
normalize
→ detect
→ PHP extraction
→ DOM parse
→ metadata extraction
→ script extraction
→ style extraction
→ CSS parsing
→ reference analysis
→ block conversion
→ diagnostics
```

Do not introduce a heavyweight AST framework merely to make the architecture look sophisticated.

Instead extract modules only where tests show clear boundaries:

```text
importer/
├── detect.js
├── normalize.js
├── php-extract.js
├── html-parse.js
├── asset-extract.js
├── css-analyze.js
├── reference-resolver.js
├── block-map.js
├── preservation.js
└── diagnostics.js
```

Keep `DOMParser` for HTML.

Keep PostCSS for CSS.

The dependencies already include PostCSS, safe parser, selector parser and specificity.

No reason exists to add another CSS AST dependency.

---

# PHASE 0 — Freeze current state and establish the truth

## Objective

Create a reproducible baseline.

## Tasks

**0.1** Run build.

**0.2** Run lint.

**0.3** Run every existing JS test.

**0.4** Run every PHP test.

**0.5** Record current failures.

**0.6** Exercise the full user journey manually once.

**0.7** Record browser console errors.

**0.8** Capture canonical fixtures for save/load roundtrip.

**0.9** Document currently supported element registry IDs.

**0.10** Record current schema/version/migration paths.

## Definition of done

No roadmap item is based solely on old documentation.

## Must not implement yet

No advanced widgets, dynamic content or theme builder.

---

# PHASE 1 — Release-safety blockers

## Objective

Make existing workflows safe before adding capability.

## Tasks

**1.1** Add full E2E test environment.

**1.2** Add core workflow test.

**1.3** Add save/refresh equivalence test.

**1.4** Add script-isolation test.

**1.5** Add CSS-isolation test.

**1.6** Add duplicate-ID/invariant test.

**1.7** Add corrupted-server-response test.

**1.8** Expose autosave failure.

**1.9** Verify conflict handling.

**1.10** Make lint pass.

## Acceptance

Zero unhandled browser exceptions across the canonical journey.

Document after reload must canonicalize identically to saved document.

---

# PHASE 2 — Core tree and editor operations

## Objective

Ensure all editing operations use the same invariant system.

## Tasks

**2.1** Inventory every direct mutation of `children`.

**2.2** Define authoritative tree operation interface.

**2.3** Connect registry parent/child constraints.

**2.4** Route DnD through it.

**2.5** Route duplicate through it.

**2.6** Route paste through it.

**2.7** Route component insertion through it.

**2.8** Route starter/widget insertion through it.

**2.9** Route navigator reorder through it.

**2.10** Validate resulting tree once per completed operation.

## Acceptance

Moving a parent into its own descendant is impossible from every interface.

Invalid form children cannot be produced by drag, paste, duplicate, starter insertion or component insertion.

---

# PHASE 3 — Editor architecture consolidation

## Objective

Reduce `index.js` from an integration monolith into an application shell.

## Tasks

**3.1** Do not change data schema.

**3.2** Extract save/publish controller.

**3.3** Extract DnD controller.

**3.4** Extract selection helpers.

**3.5** Extract import controller.

**3.6** Extract context-menu actions.

**3.7** Extract style mutation actions.

**3.8** Extract responsive actions.

**3.9** Remove dead implementations after parity tests.

**3.10** Keep Zustand as the single client state mechanism.

## Acceptance

`index.js` should become primarily composition/bootstrap code.

No observable behavior changes during this phase.

---

# PHASE 4 — Complete per-element controls

## Objective

Turn the new registry into the authoritative builder-control system.

## Tasks

**4.1** Inventory every registered element.

**4.2** Create expected Content/Style/Advanced specification per element.

**4.3** Fill missing content fields.

**4.4** Introduce typed control renderers.

**4.5** Map style groups to typed control structures.

**4.6** Complete style-target editing.

**4.7** Complete interactive states.

**4.8** Complete parent-context gating.

**4.9** Add control-level reset.

**4.10** Add responsive inheritance indication.

**4.11** Add token source indication.

**4.12** Preserve unknown valid CSS in fallback rather than removing it.

## Key rule

No element-specific UI branches scattered through `RightInspector`.

Element behavior comes from definitions/capabilities.

---

# PHASE 5 — Drag-and-drop reliability

## Objective

Make movement predictable.

## Required behavior

When dragging between siblings:

- insertion line appears at actual index
- overlay follows pointer consistently
- target parent highlights
- invalid targets visibly reject
- release performs one tree mutation
- exactly one undo transaction is produced
- selection stays on moved block
- no console error occurs.

The existing isolated canvas already defines distinct states for `drop-before`, `drop-inside`, `drop-after`, and `drop-invalid`, so the visual foundation exists.

## Tasks

**5.1** Verify pointer offset.

**5.2** Verify cross-iframe coordinate math.

**5.3** Verify before/inside/after intent.

**5.4** Verify empty container insertion.

**5.5** Add auto-scroll.

**5.6** Verify deep nesting.

**5.7** Handle cancelled drags.

**5.8** Add keyboard move parity.

**5.9** Run 160-block scenarios.

**5.10** Add 500-block benchmark.

---

# PHASE 6 — Responsive completion

## Objective

Keep the current inheritance model and make it understandable.

## Current foundation

```text
desktop
  ↓
tablet
  ↓
mobile
```

## Tasks

**6.1** Verify inheritance for every typed control.

**6.2** Show inherited vs explicitly overridden values.

**6.3** Add reset-to-parent.

**6.4** Verify hide/display precedence.

**6.5** Verify states × responsive combinations.

**6.6** Consolidate duplicate responsive logic.

## Do not implement yet

User-defined breakpoints.

Add them only after the three-breakpoint model is completely reliable.

---

# PHASE 7 — History, autosave and recovery

## Tasks

**7.1** Add interaction transactions.

**7.2** Keep 50-state bounded editor history.

**7.3** Verify persistent history.

**7.4** Surface autosave error.

**7.5** Surface newer autosave.

**7.6** Add recovery chooser.

**7.7** Verify WordPress revision restore.

**7.8** Protect against save/autosave races.

**7.9** Test post locking.

**7.10** Test page reload during dirty state.

---

# PHASE 8 — Importer reliability

## Objective

Improve breadth without special-casing examples.

## Compatibility fixture matrix

Include:

- HTML fragment
- full document
- malformed HTML
- semantic HTML
- nav/header/footer
- tables
- forms
- SVG
- media
- custom elements
- Bootstrap-like structure
- utility-class-heavy structure
- flex
- grid
- CSS variables
- media queries
- keyframes
- pseudo-elements
- inline JS
- external JS
- external CSS
- PHP fragments
- 1 MB HTML document.

## Tasks

**8.1** Extract parser stages into testable modules only where useful.

**8.2** Define compatibility result per block.

**8.3** Implement preserved subtree representation.

**8.4** Preserve unknown attributes safely.

**8.5** Preserve unsupported CSS.

**8.6** Improve relative resource handling.

**8.7** Add external asset policy.

**8.8** Add detailed import diagnostics.

**8.9** Add idempotent import tests.

**8.10** Ensure import never mutates current document until accepted.

The parser already says its import-session builder does not mutate editor state, which is a good transactional pattern to preserve.

---

# PHASE 9 — Canvas/runtime hardening

Do **not** redesign the canvas.

## Tasks

**9.1** Test `html`, `body`, `*`, `:root`.

**9.2** Test enormous z-index.

**9.3** Test fixed positioning.

**9.4** Test dialogs/popovers.

**9.5** Test iframes.

**9.6** Test external fonts.

**9.7** Test data/blob media.

**9.8** Test scripts cannot run.

**9.9** Test forms cannot submit from editor.

**9.10** Test network requests cannot originate from imported editor scripts.

Existing CSP already blocks scripts, connections and form actions, so this phase is mostly verification and edge-case hardening.

---

# PHASE 10 — Global design system

Only begin after typed controls are stable.

## Complete

- colors
- typography
- spacing
- radius
- shadows
- reusable groups
- token references
- unlink/override
- token deletion handling.

Do not build presets on unstable property serialization.

---

# PHASE 11 — WordPress integration completion

## Verify

- CPT editing
- capabilities
- REST permissions
- post lock
- media
- autosave
- revisions
- preview
- status changes
- themes
- Gutenberg coexistence
- multisite
- PHP capability boundary
- WP cron
- cache plugins
- WooCommerce availability.

The existing REST controller correctly checks that the post is a Code-to-Block page and that the user can edit that specific post.

Keep that model.

---

# PHASE 12 — Professional UX

A Navigator already exists, as do breadcrumbs. Do not list them as missing.

Complete rather than duplicate them.

## Add/finish

- element rename
- navigator search
- lock
- hidden status
- reliable context menu
- keyboard navigation
- useful empty states
- field validation errors
- control search
- clear save state
- clear inherited responsive values.

---

# PHASE 13 — Reusable systems

Reusable components already exist, so do not rebuild them.

Focus on:

- consistency with schema v3
- dependency-safe insertion
- component upgrades
- instance overrides
- deletion behavior
- broken-source fallback
- widgets implemented on top of reusable definitions where appropriate.

---

# PHASE 14 — Advanced features

Only now consider:

- additional dynamic data
- conditional display improvements
- interaction builder
- theme templates
- site headers/footers
- richer animations
- third-party extensions
- custom breakpoints.

Theme Builder belongs here, not in the immediate queue.

---

# PHASE 15 — Performance hardening

Measure first.

## Benchmarks

```text
50 elements
100
500
1000
```

Measure:

- editor startup
- selection
- inspector resolution
- typing
- slider update
- responsive switching
- DnD
- undo
- import
- save
- memory after 10–20 minutes.

Only introduce:

- memoization
- indexes
- incremental parsing
- workers
- virtualization

when one of those measurements proves a problem.

No worker architecture should be added merely because parsing sounds complex.

---

# PHASE 16 — Final accessibility/security/compatibility audit

Accessibility and security must be addressed continuously.

This phase is verification.

## Accessibility

- all editor functions keyboard accessible
- focus restored correctly
- Escape semantics
- icon buttons labelled
- canvas controls reachable
- output heading rules
- form labels
- alt text
- contrast
- no focus suppression.

## Security

- script sandbox
- imported HTML
- SVG
- unsafe URLs
- PHP boundary
- file upload
- REST authorization
- shortcode access
- external resource policy
- stored XSS
- reflected XSS
- CSRF/nonces through WordPress REST authentication
- capability escalation.

---

# PHASE 17 — Production release gate

A release is not approved until:

```text
Build                 PASS
Lint                  PASS
JS suites             PASS
PHP suites            PASS
E2E                    PASS
Save/load roundtrip    PASS
Migration              PASS
Canvas escape          PASS
Script containment     PASS
Security review        PASS
WP compatibility       PASS
Browser matrix         PASS
Performance budget     PASS
Recovery               PASS
```

Also clean the distributable.

The repository currently contains development files and root-level test/helper PHP scripts alongside runtime plugin files.

Ensure the production ZIP contains only required runtime/build assets and intended documentation.

---

# Master execution order

| Order | Priority | Work | Dependency | User impact | Blocking? |
|---:|---|---|---|---|---|
| 1 | CRITICAL | Establish green/current baseline | None | Very high | Yes |
| 2 | CRITICAL | Full E2E core journey | Baseline | Very high | Yes |
| 3 | CRITICAL | Autosave/save failure UX | Persistence | Very high | Yes |
| 4 | IMMEDIATE | Central tree operations/invariants | Registry/schema | Very high | Yes |
| 5 | IMMEDIATE | DnD correctness | Tree operations | Very high | Yes |
| 6 | IMMEDIATE | Complete per-element controls | Registry | Very high | Yes |
| 7 | IMMEDIATE | Typed style controls | Control schema | High | Yes |
| 8 | REQUIRED | Extract editor responsibilities from `index.js` | Tests | High | No |
| 9 | IMMEDIATE | Import fallback preservation | Parser | High | Yes for importer claims |
| 10 | REQUIRED | Asset-resolution policy | Importer | High | No |
| 11 | REQUIRED | Recovery/revisions UX | Persistence | High | Yes |
| 12 | REQUIRED | Responsive hardening | Controls | High | Yes |
| 13 | REQUIRED | Form completion | Tree/security | High | Scope-dependent |
| 14 | REQUIRED | Accessibility completion | Stable UI | High | Release |
| 15 | REQUIRED | Caching correctness | Save/render | Medium/High | Release |
| 16 | REQUIRED | WordPress compatibility | Stable core | High | Release |
| 17 | REQUIRED | Performance benchmarks | Stable core | Medium | Release |
| 18 | RECOMMENDED | Design-system completion | Typed controls | Medium | No |
| 19 | RECOMMENDED | Navigator/UX refinement | Tree stable | Medium | No |
| 20 | ADVANCED | Theme Builder etc. | Everything above | Future | No |

---

# Top 10 Immediate Actions

1. **Create one automated complete-builder E2E journey.**
2. **Rerun and eliminate all current build/lint/test failures.**
3. **Make autosave/save failures visible and recoverable.**
4. **Centralize every structural mutation behind registry-enforced tree operations.**
5. **Run deep DnD structural tests and fix invalid moves.**
6. **Finish the existing per-element registry instead of adding another control system.**
7. **Replace generic `cssValue` UX with typed structured controls.**
8. **Introduce Native/Hybrid/Preserved/Restricted importer outcomes.**
9. **Finish external/relative asset handling without insecure automatic fetching.**
10. **Start safely decomposing the 9,000-line `index.js` behind regression tests.**

---

# Critical blockers

There are no static-source findings that justify claiming "the builder currently corrupts every page" or similar.

The actual release blockers are:

- no authoritative automated full workflow proof
- unresolved current lint status
- incomplete structured controls
- unresolved cross-operation tree invariants
- importer external-resource limitations
- recovery/autosave UX weaknesses
- remaining forms/accessibility/cache acceptance gaps that must be reverified against current code.

---

# Missing core features

Very few truly foundational systems are wholly missing now.

The meaningful missing pieces are mostly **completion layers**:

- complete typed style-control system
- universal importer preservation contract
- controlled asset resolver
- unified tree mutation contract
- reliable autosave failure UX
- authoritative E2E test harness
- transactional interaction history.

That is good news.

The project is further along than a generic "missing features" audit might suggest.

---

# Existing features that need completion, not rebuilding

Keep and complete:

- Element Registry
- Inspector Resolver
- schema v3
- Zustand state
- dnd-kit
- tree utilities
- iframe canvas
- CSP isolation
- DOMParser importer
- PostCSS pipeline
- responsive model
- design tokens
- autosave
- WordPress revisions
- Navigator
- breadcrumbs
- reusable components
- Content Mode
- accessibility checker
- SEO
- WooCommerce
- parity system.

---

# Existing features that genuinely need refactoring

## 1. `src/index.js`

**Severity: High**

Too many responsibilities in one ~9k-line integration file.

## 2. Structural editing paths

**Severity: High**

Need one authoritative mutation contract.

## 3. Generic property-control factory

**Severity: High**

Good intermediate architecture; insufficient final UX.

## 4. Parser internal responsibilities

**Severity: Medium**

Extract only clear stages; no rewrite.

## 5. Autosave error handling

**Severity: High**

Current explicit silent failure is inappropriate for production user safety.

---

# Technical-debt register

| Debt | Severity |
|---|---|
| ~9k-line `index.js` | High |
| Generic CSS-string controls | High |
| Multiple structural mutation paths | High |
| No integrated E2E release gate | High |
| Autosave failure swallowed | High |
| External stylesheet not resolved | Medium/High |
| Historic lint failure | High until reverified |
| Manual acceptance dependencies | Medium |
| Fixed breakpoint schema | Medium |
| Import execution lifecycle not fully modeled | Medium |
| Runtime helper/test files mixed near plugin root | Medium |
| Cache plugin compatibility historically incomplete | Medium |
| Accessibility manual testing historically incomplete | Medium |

---

# Risk register

## Data-loss risk — High

Not because save is known broken, but because recovery protection can fail silently.

## Structural corruption risk — High

Multiple insertion/mutation mechanisms create opportunities for inconsistent trees.

## Import fidelity risk — High

External CSS can be preserved as a reference without its rules becoming part of importer analysis.

## Security risk — Medium/High

Arbitrary imported scripts intentionally execute only outside the editor and are permission-gated; this must remain heavily tested.

## Migration risk — Medium

Schema v3 and definition versions make migrations a real product responsibility.

## Performance risk — Medium

The 9k-line editor and large block trees warrant measurement, but there is not yet evidence justifying virtualization/workers.

## Refactoring risk — High

Large `index.js` extraction could regress working behavior if performed before E2E coverage.

---

# Dependency graph

```text
Current-state baseline
        │
        ▼
Full E2E safety harness
        │
        ├───────────────┐
        ▼               ▼
Tree invariants     Persistence safety
        │               │
        ▼               ▼
DnD reliability     Recovery/revisions
        │
        ▼
Stable element tree
        │
        ▼
Element Registry
        │
        ▼
Typed Control Schema
        │
        ├───────────────┐
        ▼               ▼
Per-element UI      Responsive UI
        │               │
        └───────┬───────┘
                ▼
          Design tokens
                │
                ▼
          Presets/components

Parser normalization
        │
        ▼
Asset extraction
        │
        ▼
DOM/CSS analysis
        │
        ▼
Block mapping
        │
        ▼
Compatibility level
        │
        ▼
Preservation fallback
        │
        ▼
Isolated canvas
        │
        ▼
Preview/publish runtime

Stable serialization
        │
        ▼
Autosave/revisions
        │
        ▼
Reusable components/templates
```

---

# Production-readiness checklist

The builder should **not** be called production-ready until all of these are true:

- No current P0 security finding.
- Build passes.
- Lint passes.
- Existing unit/integration suites pass.
- Complete E2E journey passes.
- Save → refresh produces identical canonical document.
- Failed saves are clearly communicated.
- Autosave failure is visible.
- Recovery from newer autosave works.
- WordPress revision restore works.
- Duplicate IDs cannot occur.
- Illegal parent/child relationships cannot occur.
- DnD cannot move a parent into itself/descendant.
- One drag creates one history transaction.
- Canvas content cannot escape iframe.
- Imported CSS cannot affect WordPress admin.
- Imported JS cannot execute inside editor.
- Imported PHP cannot execute arbitrarily in browser/editor.
- Unsupported safe content is preserved rather than silently lost.
- External resource behavior is explicit.
- Per-element Content/Style/Advanced controls are relevant to their element.
- Structured controls exist for complex CSS instead of raw-string-only UX.
- Responsive inheritance is predictable.
- Frontend/editor parity passes.
- Forms work visually and operationally.
- Accessibility keyboard workflows pass.
- Core output receives accessibility checks.
- Caching cannot permanently serve stale CSS/HTML combinations.
- WordPress capability checks pass.
- Migration tests pass from every supported schema/version.
- 500-element editing remains usable.
- Long-session memory growth is bounded.
- Production ZIP contains no unnecessary dev/test tooling.

---

# Final implementation decision

The builder should **not** now enter a feature-expansion phase.

It already has most of the major architectural building blocks.

The next milestone should be:

> **Code to Block Reliability Milestone — Core Builder Acceptance**

That milestone is complete only when:

**Create → Add → Select → Edit → Style → Responsive → Drag → Duplicate → Delete → Undo → Import → Save → Refresh → Preview → Publish → Reopen**

works as one continuously tested workflow with no lost data, no invalid tree, no canvas escape, no editor script execution, and no unexplained frontend difference.

After that, finish structured per-element controls and generalized import preservation.

Only then should Theme Builder, more widgets, more integrations, custom breakpoints, or other advanced capabilities receive significant development time.

That is the shortest path from the current project to a genuinely **reliable and production-ready builder**, without throwing away the substantial architecture that is already working.
