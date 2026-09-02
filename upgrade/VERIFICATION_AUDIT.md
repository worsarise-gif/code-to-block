# Last Upgrade Verification Audit

Date: 2026-08-26

## Scope

Every file in `upgrade/last upgrade` was read in full and checked against the current plugin source, automated tests, and the live WordPress editor at `http://localhost:8888`:

- `upgrade-implementation-plan-15.md`
- `upgrade-implementation-plan-16.md`
- `upgrade-implementation-plan-17.md`

## Verdict

The last upgrade is not fully implemented. All three plans remain Partial. This audit repaired confirmed runtime regressions, but it did not mark placeholder UI or untested source as complete.

## Plan 15: Shape-Aware Skeletons

Status: Partial.

Verified or repaired:

- The editor boot skeleton is visible at desktop and mobile browser widths.
- Text, rich-text, image, and link shapes have nonzero geometry.
- The CSS shimmer does not load GSAP.
- `prefers-reduced-motion: reduce` disables the shimmer.
- Commerce grid loading blocks now have valid tags and attributes.
- Structural skeletons read the canonical `styles.mapped` branch and ignore text-node children safely.

Still missing:

- Initial loading does not reuse the saved page/component shape.
- Pricing/testimonial skeletons are not generated from their real structures.
- Image dimensions and aspect ratios are not preserved generally.
- Public image/video loading wrappers and native load/error transitions are absent.
- Video is not a supported schema block/tag.
- Public asynchronous WooCommerce loading and skeleton swaps are absent.
- Smooth content transitions and measured CLS guarantees are absent.

## Plan 16: Unified Importer

Status: Partial.

Verified or repaired:

- Unified paste is the default and has visible HTML/CSS/JavaScript/PHP guidance.
- Pre-parse HTML, CSS, JavaScript, and PHP findings are expandable.
- Complete HTML documents now retain `<head>` styles and scripts during parsing.
- A live complete-document import applied `<head>` CSS to the canvas.
- A recognized JavaScript action mapped successfully after explicit confirmation.
- A safe PHP snippet passed server review and registered only after the exact confirmation phrase.

Still missing:

- The secondary "Paste separately" HTML/CSS/JavaScript/PHP mode does not exist.
- There is no same-fixture unified-versus-separated parity test or documented root-cause reproduction.
- The importer can still race the initial saved-document request.
- Detection preview remains separate from the parser's authoritative analysis.
- Full importer integration tests are absent.

## Plan 17: Editor Layout and Advanced Panels

Status: Partial.

Verified or repaired:

- The fatal `postId` initialization crash is fixed.
- Navigator safely skips text nodes and exposes stable `data-block-id` values.
- Preview CSS is inserted into the editor and the canvas renders the materialized document.
- All 58 mapped style controls are mounted again under five taxonomy groups.
- Responsive breakpoint controls, raw CSS, motion, and action panels are mounted again.
- Four-column desktop layout works at 1440px.
- The workspace stacks at 1200px and below without horizontal page overflow at 1034px and 390px.

Still missing:

- The Content tab lacks general text, link, image, ID, class, ARIA, and custom-attribute editing.
- New primitive elements cannot be dragged from the Elements rail.
- Dynamic Data has no connection workflow for ordinary blocks.
- Login/role conditions are cosmetic and have no frontend evaluation.
- Default/Hover/Focus/Active state buttons are cosmetic; Active is unsupported by schema/rendering.
- History is in-memory, incomplete, and not persisted.
- Element permissions and locking are cosmetic and not server-enforced.
- SEO is duplicated as editable fields and the Content Mode link is still invalid.
- Lazy loading is cosmetic; there is no image/iframe deferral or skeleton lifecycle.
- Responsive visibility can still lose to mapped `display: ... !important`.

## Repairs Made

- `src/index.js`: fixed editor initialization, Navigator recursion, importer callbacks, preview style injection, materialized canvas rendering, importer findings, and restored style/raw-CSS/motion/action controls.
- `src/parser.js`: extracts `<style>` and `<script>` from the complete document, including `<head>`.
- `src/commerce-preview.mjs`: emits valid product-grid skeleton containers.
- `src/editor.css`: desktop skeleton styles, reduced-motion behavior, responsive editor stacking, full-width canvas, and stable Navigator button styling.
- `tests/rest-security-test.php`: updated route assertions for the current nine-route controller.
- `tests/frontend-renderer-test.php`: added the missing `get_post_type()` fixture stub.
- `build/*`: rebuilt production assets.

## Verification

Automated checks:

- Build passes with two bundle-size warnings; `index.js` is 437 KiB.
- JavaScript suites pass: accessibility, CSS fallback, design tokens, history, HTML policy, parser classification, PHP extraction, responsive styles/regression, reusable components, starters, script actions, tree order, commerce preview, and performance stress.
- PHP suites pass: starter templates, shortcodes, SEO, schema (88), REST security (38), PHP scanner (67), parity (5), frontend renderer (63), components (23), and commerce (8).
- Lint remains failing. The targeted lint command reports 91 existing errors, including accessibility, unused code, nested ternaries, and formatting issues.

Playwright checks:

- Editor mounts with no React/page exception after the repair.
- Delayed REST loading displays six desktop skeleton shapes with `ctb-shimmer` and correct nonzero geometry.
- Reduced-motion loading reports `animation-name: none` for every skeleton and makes zero GSAP/chunk requests.
- Complete-document `<head>` CSS produces red text and 12px padding on the imported canvas block.
- JavaScript confirmation changes detection from `is-recognized` to `is-mapped` without errors.
- PHP confirmation changes status to registered after the exact server-issued phrase.
- Navigator opens on the pricing fixture and renders eight block nodes, zero text nodes, without exceptions.
- Style tab renders 58 controls; Advanced renders raw CSS and three motion controls.
- Editor has no horizontal page overflow at 1440x900, 1034x729, or 390x844.
- Public pricing page renders at 390px with no console errors or horizontal overflow.

## Release Blockers

Do not call Plans 15-17 complete until the missing requirements above are implemented and browser-tested. The inactive Conditions, States, Permissions, SEO link, Performance, and nonpersistent History surfaces are especially misleading because they look interactive without saving or enforcing behavior.

## Task A1 Baseline: Control and Document Fixtures

Date: 2026-09-01

Task A1 adds behavior-neutral migration evidence under `plugin/code-to-block/tests/fixtures/migrations/`. Both immutable v1 and v2 documents independently cover all ten broad block types. The checked-in coverage manifest maps all 103 currently allowed native tags to one of 11 explicit families, requires an immutable fixture representative for every family, and inventories all eight widget roots directly against the live widget source. The fixtures also cover every current optional legacy document/block/style storage branch, tablet/mobile, hover/focus/active, token and role bindings, nonempty fallback CSS, imported assets and pseudo/media metadata, Form/Field, all four Woo types, linked locked components, and the named edge cases.

The deterministic JS inventory imports the live control catalog, HTML policy, element registry, and widget library. Its checked snapshot records 10 broad types, 103 tags, 92 mapped properties, and eight widget roots. It records rather than removes the current unsupported evidence: mapped `float:left`, arbitrary `display:contents`, `.import-card::before`, and imported media conditions. `node tests/control-inventory-test.mjs --print` prints the complete sorted inventory.

The PHP migration fixture test loads the actual current server registry, schema, and renderer. It sanitizes decoded copies, normalizes dynamic form timestamps, and compares SHA-256 manifests for source documents, sanitized documents, frontend HTML, frontend CSS, editor style snapshots, and migration metadata. Source fixture hashes are checked again after sanitize/render.

Known baseline gap: current v1/v2 server validation accepts nested forms and the current renderer consequently emits nested form markup, while the actual v3 JS registry rejects form-inside-form through `canInsertElement`. A1 asserts and snapshots this discrepancy; it does not change or falsely normalize legacy behavior.

Focused verification:

- `npm.cmd run test:control-inventory` -> PASS: 88 control inventory assertions.
- `npm.cmd run test:migration-fixtures` -> PASS: 14 migration fixture assertions; legacy nested-form acceptance recorded as a baseline gap.
- `php -l tests/migration-fixtures-test.php` -> No syntax errors detected.

Comprehensive verification from `plugin/code-to-block`:

- PowerShell explicit-file Node sweep: `$files = @('tests/accessibility-test.mjs','tests/canvas-isolation-test.mjs','tests/commerce-preview-test.mjs','tests/control-inventory-test.mjs','tests/control-registry-test.mjs','tests/custom-css-test.mjs','tests/custom-test.cjs','tests/design-tokens-test.mjs','tests/drop-intent-test.mjs','tests/editor-persistence-test.mjs','tests/guided-roles-test.mjs','tests/history-test.mjs','tests/html-policy-test.mjs','tests/import-parser-test.cjs','tests/parser-classification-test.mjs','tests/performance-stress-test.mjs','tests/php-snippets-test.mjs','tests/react-attributes-test.mjs','tests/responsive-regression-test.mjs','tests/responsive-styles-test.mjs','tests/reusable-components-test.mjs','tests/schema-v3-test.mjs','tests/script-actions-test.mjs','tests/starter-templates-test.mjs','tests/tree-order-test.mjs'); $failed = @(); foreach ($file in $files) { & node $file; if ($LASTEXITCODE -ne 0) { $failed += $file } }; "NODE_TEST_FILES=$($files.Count) FAILED=$($failed.Count)"; if ($failed.Count -gt 0) { $failed; exit 1 }` -> `NODE_TEST_FILES=25 FAILED=0`.
- PowerShell explicit-file PHP sweep: `$files = @('tests/commerce-test.php','tests/components-test.php','tests/element-permissions-test.php','tests/frontend-renderer-test.php','tests/migration-fixtures-test.php','tests/parity-test.php','tests/php-scanner-test.php','tests/rest-security-test.php','tests/schema-test.php','tests/schema-v3-test.php','tests/seo-test.php','tests/shortcodes-test.php','tests/starter-templates-test.php'); $failed = @(); foreach ($file in $files) { & php $file; if ($LASTEXITCODE -ne 0) { $failed += $file } }; "PHP_TEST_FILES=$($files.Count) FAILED=$($failed.Count)"; if ($failed.Count -gt 0) { $failed; exit 1 }` -> `PHP_TEST_FILES=13 FAILED=0`.
- Synthetic performance suite in the Node sweep: 160 blocks at nine levels; 50-clone average 0.47 ms; 200-count average 0.003 ms; 200-deep-find average 0.001 ms. Browser performance measurements remain outside this fixture task.
- `git diff --check -- plugin/code-to-block/package.json upgrade/VERIFICATION_AUDIT.md` -> pass; line-ending conversion warnings only.
- `git diff --no-index --check --stat -- NUL <new-file>` across all seven new A1 files -> `UNTRACKED_DIFF_CHECK_FILES=7 WHITESPACE_ERRORS=0`.

No build command was run and no production runtime file was changed for A1.

## Task A2 Baseline: Registry and Style-Context Contracts

Date: 2026-09-01

Task A2 accepts `docs/control-registry-contract.md` and
`docs/style-context-contract.md` as the normative architecture boundary for the
builder-controls overhaul. The contracts define independent element/definition/
schema/registry identity, configured target grants, strict Content/Style/
Advanced ownership, extension namespace and conflict behavior, manifest and PHP
authority, strict sparse context grammar, 12-level source precedence, stable
selectors, visibility outside layout display, controlled `!important`,
dual-read/canonical-write migration, and atomic failure/rollback behavior.

The contracts explicitly do not claim implementation completeness. Fifteen
mandatory gap IDs (`A2-GAP-001` through `A2-GAP-015`) freeze the audited
differences between the approved design and current code: mixed v3/legacy
factory output, definition-global grants, missing primary target, context parser
disagreement, breakpoint disagreement, editable fallback, absent extension
registration, incomplete manifest/PHP grant validation, missing internal part
markers, incomplete source compilation, legacy visibility display storage,
JS/PHP migration divergence, state-selector divergence, and nested legacy forms.

`design-decisions-log.md` records four A2 decisions and marks both duplicated
File 10 Simple/Advanced entries as historical compatibility behavior. Advanced
cannot mount Style groups; per-element primary/recommended/optional grants
replace the universal tier after legacy compatibility is retired.

`tests/architecture-contract-test.mjs` parses the machine-readable contract
examples and validates their ID grammar, targets, grants, fields, states,
authority, conflict and migration policies, strict valid/invalid contexts,
source precedence, and mobile-hover sequence. It also checks the live catalog
and all 59 definitions, generated-manifest parity, JS/PHP schema and registry
versions, stable selector fixture, decision-log links, and every mandatory gap
ID. The test reads generated assets but never regenerates them.

Focused verification:

- `npm.cmd run test:architecture-contract` -> PASS: 584 architecture contract assertions.
- `npm.cmd run test:control-registry` -> PASS: 22 assertions.
- `npm.cmd run test:schema-v3` -> PASS: 20 assertions.
- `php tests/schema-v3-test.php` -> PASS: 12 assertions.
- `php tests/frontend-renderer-test.php` -> PASS: 91 assertions.

Comprehensive verification from `plugin/code-to-block`:

- Explicit-file Node sweep -> `NODE_TEST_FILES=26 FAILED=0`.
- Explicit-file PHP sweep -> `PHP_TEST_FILES=13 FAILED=0`.
- Synthetic performance in the Node sweep: 160 blocks at nine levels; clone
  0.49 ms, count 0.003 ms, and deep find 0.001 ms average.
- Browser verification and production build were not run because A2 changes
  contracts, decision records, and read-only architecture tests only.
- No production runtime file changed for A2.

## Task A3 Increment 1: Pure Tree and Store Boundaries

Date: 2026-09-01

Task A3 remains active. This first behavior-neutral increment extracts the
lowest-risk pure boundaries from `src/index.js` before any React panel or runtime
integration is moved.

Extracted tree API in `src/tree.mjs`:

- `findBlock`
- `findBlockLocation`
- `countBlocks`
- existing `canMoveBlock` and `moveBlockSibling`

Extracted store command composition in `src/store/block-commands.mjs`:

- `updateBlockStyleSet`
- `updateEditableBlock`
- `createPrimitiveBlock`
- `setStyleSetBindings`
- `setHiddenInFallback`

The functions were moved without changing signatures or bodies beyond exports
and imports. Store mutations still use `commitDocument`; locked-block handling,
object cloning, token/role/import-review branches, history selection, responsive
style ownership, registry creation, and legacy `display: ... !important`
fallback serialization remain unchanged.

`docs/editor-domain-boundaries.md` documents these public APIs and the remaining
extraction backlog. `tests/import-boundaries-test.mjs` recursively prevents
files under `src/elements/` from importing React, `@wordpress/element`, Zustand,
store paths, or the editor entrypoint. This implements the A3 element-definition
boundary without introducing a new lint dependency.

Focused verification:

- `npm.cmd run test:tree` -> PASS: 25 tree query/order assertions.
- `npm.cmd run test:store-commands` -> PASS: 28 store command assertions.
- `npm.cmd run test:import-boundaries` -> PASS: 4 boundary assertions.
- `npm.cmd run test:drop-intent` -> PASS: 26 assertions.
- `npm.cmd run test:history` -> PASS: 19 assertions.
- `npm.cmd run test:responsive` -> PASS: 25 assertions.
- `npm.cmd run test:control-registry` -> PASS: 22 assertions.
- Scoped `wp-scripts lint-js` for `src/tree.mjs` and
  `src/store/block-commands.mjs` -> PASS.

Comprehensive verification:

- Production `npm.cmd run build` -> PASS with only the two existing webpack
  size warnings for the 612 KiB index entry.
- Pre/post A3 bundle comparison: `index.js` remains exactly 626,426 bytes;
  its content/version hashes changed because modules were reordered. All CSS,
  dynamic vendor chunks, content-mode assets, and frontend-GSAP assets are
  byte-identical to the pre-A3 baseline.
- Explicit-file Node sweep -> `NODE_TEST_FILES=28 FAILED=0`.
- Explicit-file PHP sweep -> `PHP_TEST_FILES=13 FAILED=0`.
- Synthetic performance: 160 blocks at nine levels; clone 0.48 ms, count
  0.003 ms, and deep find 0.001 ms average.
- Scoped tracked/untracked whitespace checks -> PASS.
- Repository-wide `npm.cmd run lint` is not a clean baseline: 250 errors and
  two warnings remain across existing source. No finding was introduced in the
  two extracted source modules.
- Editor mount/select/edit/save/reload smoke remains blocked because both local
  endpoints (`localhost:8888` and `localhost:8090`) refused connections.

Task A3 acceptance is not claimed. The Zustand store, DnD adapters, preview CSS,
inspector controls, diagnostics, forms, commerce, widgets, motion/actions, and
persistence orchestration still need focused extraction before `src/index.js`
is an orchestration shell.
