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
