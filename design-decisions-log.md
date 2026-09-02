# Design Decisions Log

Keep this updated as real decisions get made. The point isn't completeness -
it's making sure a decision made once, deliberately, doesn't quietly get
re-decided differently later without anyone noticing.

## Hero section: layered backgrounds vs. composite block

**Phase**: 1

**Decision**: Keep the hero's background image + overlay as a single
`background-image` CSS value (gradient layer + image layer) on the container,
rather than splitting them into separate composite sub-blocks.

**Why**: Verified against real JSON - the two layers aren't separate nodes in
`children`, so they physically cannot be dragged apart, reordered independently,
or have another block inserted between them in Phase 3's drag system. They move
and paint together by construction.

**Reference**: `block-schema.md:57-60`, hero entry in
`block-examples.json:208`

## Hero content: full drag freedom vs. locked

**Phase**: 1 (flagged during hero review), decision made before Phase 2

**Decision**: `hero-content` and its child text blocks (eyebrow, heading, intro)
can be freely dragged out of the hero, reordered, or moved elsewhere in Phase 3
- no lock or container-level movement constraint.

**Why**: Full editability was chosen deliberately over restricting movement.
This matches how Elementor and Divi both handle nested content generally, and
keeps the "everything is a real draggable element" premise honest rather than
special-casing the hero.

**Trade-off accepted**: A user can accidentally break a hero's intended
composition by dragging its heading out. This is treated as user responsibility,
not a bug to prevent.

**If this needs revisiting**: If dogfooding (Phase 6) surfaces this as a real,
repeated frustration rather than a theoretical risk, reopen this decision then -
don't add a lock preemptively without that evidence.

## Relative imported resources: canonical base URL

**Phase**: 4

**Decision**: Resolve relative HTML resource attributes and CSS `url()` values
against the WordPress site root in both the editor and frontend renderer.

**Why**: Pasted code has no source-document URL. Leaving relative values to the
browser made the same tree resolve against `/wp-admin/` in the editor and the
generated uploads directory on the frontend. A site-root base is deterministic
and keeps editor/frontend output aligned.

## Public pages: theme post wrapper vs. full canvas

**Phase**: 5 sample MVP

**Decision**: Render `ctb_page` posts through a minimal plugin-owned template
instead of the active theme's singular-post layout. The template still calls
`wp_head()`, `wp_body_open()`, and `wp_footer()` so plugins and enqueued assets
continue to work.

**Why**: Theme post titles, content widths, and large header spacing shifted the
builder output hundreds of pixels below the viewport and prevented a saved
landing page from matching the editor canvas. A page builder needs a predictable
full-canvas surface; theme styling can still affect explicit imported classes
through normal enqueued stylesheets.

## Parser styles: mapped controls vs. raw fallback

**Phase**: 5

**Decision**: A property enters `styles.mapped` only when the editor has a
dedicated control for it. Other resolved declarations are preserved in
`custom_css_fallback` as a normalized declaration list. The Phase 5 mapped set
is `color`, `padding`, `margin`, `font-size`, `font-weight`, `border`, and
`border-radius`.

**Why**: Treating every CSS property as mapped left the raw fallback permanently
empty and gave users no way to inspect or edit declarations outside the style
panel. The split now describes actual editor capability while preserving all
resolved CSS for canvas and frontend rendering.

## Global design token storage and per-block overrides

**Phase**: 7

**Decision**: Keep schema version 1 and add optional document-level
`design_tokens` plus optional per-`StyleSet` `token_bindings`. Definitions use
the fixed `colors`, `typography`, and `spacing` categories. Linked mapped values
store deterministic page-scoped CSS variable references. A local override keeps
the binding metadata but replaces that one mapped value with raw CSS.

**Why**: The extension is additive, so existing documents require no migration
and continue to round-trip without injected empty fields. Document-level storage
keeps token edits in the same history and REST transaction as the page. Keeping
binding metadata on an override makes divergence visible and allows one-click
restoration, while all other consumers continue following the global value.

## Reusable components: linked placeholders vs. copied subtrees

**Phase**: 7

**Decision**: Store reusable components as private, canonical version-1 documents
in a site-wide library capped at 100 records. Pages persist only empty linked
placeholders with a component ID. Resolve each placeholder independently in the
editor and public renderer, namespace its token dependencies, and regenerate
block IDs, DOM IDs, DOM references, and action targets for every instance.

**Why**: Linked placeholders make an accepted component update reach every page
without rewriting page JSON. Keeping the component in its own validation and
error-isolation boundary prevents malformed or missing shared data from making a
whole page uneditable. The resolver keeps aggregate schema limits and emits the
exact local fallback `this saved component failed to load`. Page-bound PHP
shortcodes are rejected because their execution registration cannot safely move
to another page.

**Deletion behavior**: Permanently deleting a component intentionally leaves its
page placeholders in place. Each becomes the contained fallback, so deletion
cannot corrupt or erase unrelated page content.

## Explain CSS: immutable resolved import provenance

**Phase**: 7

**Decision**: Keep schema version 1 and add optional validated
`meta.css_mapping` provenance to imported blocks. Store the resolved winning
declarations, their stylesheet/inline/inherited origin, and their actual
destination: one of the seven named style controls or raw CSS. Show that record
in a selected-block Explain CSS panel and do not rewrite it after later edits.

**Why**: The explanation must survive save/load, undo/redo, and saved-component
extraction, so transient parser state is insufficient. An immutable snapshot
answers what happened during conversion without pretending that current manual
edits came from the original CSS. Selector text and losing cascade candidates
are intentionally excluded; this is mapping transparency, not a full browser
cascade debugger.

## Starter templates: static replace vs insert library

**Phase**: 7

**Decision**: Ship four static starter documents (hero, pricing, testimonial,
footer) as a synchronous JS library with no REST. **Replace canvas** clones a
starter root with regenerated IDs and resets history; **Insert after selection**
clones the starter root with IDs namespaced against the current document's used
IDs and inserts after the selected block via `commitDocument`, preserving undo.

**Why**: A small static set removes the blank-canvas problem without server
state, migrations, or capability checks, and stays within the existing 1,000-
block/2 MB/50-depth budgets. Regenerating IDs prevents collisions across
inserts; storing `meta.source: "starter-template"` keeps provenance explicit
without a schema version bump.

## Upgrade 1 — Parity check and upgrade 5 — migration readiness

**Phase**: 7 addendum (File 1)

**Decision**: Parity check compares per-block declarations from the editor’s
`buildPreviewStyles` vs the frontend’s `Code_To_Block_Renderer::generate_css`
(normalized, order-independent) via `Code_To_Block_Parity::check`. It runs
automatically after every save and surfaces `this block may render differently
on the live site` per `block_id`/`context`. No schema change; it reads the
resolved document. Upgrade 5 — keep a running log of every shape change to
saved block data (schema version, `design_tokens`, `css_mapping`,
`saved_component`, `starter-template` source, and now parity is read-only) so a
future Tier 2 migration/import tool does not need to reconstruct history.

**Why**: File 1’s dependency map shows parity is required for Files 5, 6, 7.
Building it now gives a provable “we tell you if editor and frontend disagree”
answer to the most common Elementor/Divi bug category, without relying on
architecture alone.

## Upgrade 4 — Real-world fixture honesty

**Phase**: 7 addendum (File 1)

**Decision**: No allowlist change for v1. WooCommerce `form`/`input` remains
rejected (`HTML contains unsupported <form> markup.`), `@media` remains
`Unsupported rule skipped`, ACF `[acf field="price"]` remains literal text and
`get_field()` remains `not on the scanner's narrow reviewed-function list`.

**Why**: Documented in `upgrade/upgrade-4-fixtures-report.md` with
`upgrade-4-acf-fixture.png` and `upgrade-4-woo-simplified.png` rather than
silently widening the allowlist. This surfaces the same “untested real-world
dynamic content” failure that still costs Divi credibility, while keeping v1
narrow and secure.

## Dedicated full-screen editor — isolate from WordPress admin chrome

**Phase**: 7 addendum (File 2, Part 2)

**Decision**: Register a hidden admin page (`admin_page_code-to-block-dedicated`)
that loads `templates/editor-dedicated.php` — a self-contained HTML document
with only the editor's own React bundle, no WordPress admin sidebar, admin bar,
or other plugins' enqueued scripts. Access via row action ("Edit with Code to
Block") in the post list and a notice on the standard edit screen. The dedicated
URL is `admin.php?page=code-to-block-dedicated&post=ID`.

**Why**: Elementor's "Edit With Elementor" exists precisely because loading a
page builder inside the normal WordPress admin exposes it to conflicts with
whatever else is installed. A dedicated route structurally avoids this by not
sharing a page load with unrelated plugin code. This also gives a cleaner
environment for accurate performance measurement.

## Performance stress test — no cliff at 160 blocks / 9 levels

**Phase**: 7 addendum (File 2, Part 1)

**Decision**: Stress-tested the editor with a synthetic 160-block / 9-level
document (post 39) vs an 11-block baseline (post 40) in the dedicated editor
via Playwright. Results: selection 0.7 ms vs 1.5 ms (no degradation), memory
11.96 MB vs 12.48 MB (proportional, no leak), rapid 10-cycle selection 0.23 ms
avg vs 0.16 ms avg (negligible). No performance cliff found. No optimization
(virtualization, memoization, lazy-loading) needed. Honestly disclosed per
`upgrade-implementation-plan-2.md:65`.

**Why**: The editor avoids the Elementor/Divi performance pattern because
selection is O(1) state (`selectedBlockId` string in zustand), preview uses a
single CSS stylesheet (`buildPreviewStyles`) rather than per-block React state,
and blocks are pure data without individual JavaScript initialization.
Full report in `upgrade/file2-part1-perf-report.md`.

## Content Slots as Block Properties

**Phase**: Upgrade 4 (Content Slots)

**Decision**: Content slots (editable areas for clients) are implemented as properties on existing blocks (`is_content_slot`, `slot_label`, `slot_content_type`) rather than a new wrapper block type.

**Why**: This avoids adding nesting depth to the block tree, which is a known performance cost. It also aligns with the React mental model where a slot is essentially a prop passed into a component. This is an additive schema change that preserves backward compatibility with all existing saved documents.

## Conditional Animation Loading (JS vs CSS)

**Phase**: Upgrade 3 (Conditional Asset Loading)

**Decision**: Animations are explicitly classified via an `animation_type` property on actions (`css_native` or `js_library`). GSAP and ScrollTrigger are only enqueued on the frontend if a page contains at least one `js_library` action. The editor dynamically imports GSAP only when such an action is present.

**Why**: Ensures that pages without complex scrubbed/timeline animations do not suffer the payload cost of a JS animation library. Loading GSAP conditionally prevents the editor and frontend bloat seen in other builders.

## Upgrade 6 — Content-hash versioned CSS vs fixed-path regeneration

**Phase**: 7 addendum (File 6)

**Decision**: Generated CSS uses content-hash versioned filenames `ctb-page-{id}-{sha16}.css` instead of fixed `ctb-page-{id}.css`. New hash on each save, long immutable cache via `.htaccess` (`Cache-Control public, max-age=31536000, immutable`), grace-period retirement of stale files, HTML page itself remains short-cache/revalidate so it always points at current hash.

**Why**: Fixed-path regeneration leaves staleness/corruption window documented in Elementor/Divi support docs. Hash-addressing makes each URL immutable — edge cache fetches new file by construction, no manual purge. Implemented in `includes/class-code-to-block-renderer.php:603` `get_asset_location` and `retire_stale_stylesheets`. Signals to optimization plugins via `script_loader_tag` exclusion `code-to-block.php:612`.

## Upgrade 6 — Dedicated editor no-cache signaling

**Phase**: 7 addendum (File 6)

**Decision**: Dedicated editor route (`code-to-block-dedicated`, `code-to-block-content`) sends `Cache-Control: no-store, no-cache, must-revalidate`, `DONOTCACHEPAGE`, and `nocache_headers()` via `code_to_block_handle_dedicated_editor_early` in `code-to-block.php:148`.

**Why**: External cache plugins serving cached editor shell cause "buttons don't respond, widgets won't drag" — research failure category 1. Explicit no-store makes editor un-cacheable by browser/CDN/plugin without relying on heuristic exclusion.

## Content Slots visual indicator — slot badge vs token override

**Phase**: Upgrade 4 (File 4)

**Decision**: Slots retain label prefix `Slot: {slot_label}` in `data-block-label` (`src/index.js:851`) plus distinct dashed teal outline `is-content-slot` (`src/editor.css:1438`) separate from token-override amber. `BlockSlotControl` shows checkbox + label + type selector; content-mode at `admin.php?page=code-to-block-content&post=ID` shows only slots as form, no canvas/drag.

**Why**: Visual at-a-glance distinction required by File 4 checkpoint 2 — must be trustworthy for client handoff. Keeping slots as block props (not wrapper blocks) preserves nesting budget measured in File 2 performance test. History via `setBlockSlotProperties: commitDocument` keeps slot toggles undoable.

## Upgrade 4 — Slots inside reusable components deferred

**Phase**: Upgrade 4 (File 4)

**Decision**: Slots on page blocks fully supported; slots inside saved-component canonical docs are schema-valid but content-mode `src/content-mode.js:34` `findSlots` currently traverses only the resolved page tree, not component library records. Not blocking for File 4 completion — worth revisiting when reusable-component library grows, per file's "worth revisiting" note.

**Why**: Keeps File 4 scope to single-value slots on pages, as explicitly scoped — list-type slots also deferred. Documented so future File 12 widget-library work does not assume component-internal slots work without extra traversal.

## Upgrade 5 — WooCommerce Blocks vs legacy shortcode

**Phase**: 7 addendum (File 5) — Steps 1,4,6 code-complete at v0.16.0, Steps 2,3,5,7 pending live Woo

**Decision**: Product data via native WooCommerce functions (`wc_get_product`) in `includes/class-code-to-block-renderer.php:223` `get_dynamic_data` for `wc_product_title/price/short_description/stock_status/image`; Cart/Checkout via Blocks `<!-- wp:woocommerce/cart -->` not legacy shortcode/AJAX, to avoid `cart.js` table-structure fragility documented in research. Added `woocommerce_product_grid` type `includes/class-code-to-block-schema.php:20` looping `wc_get_products` `includes/class-code-to-block-renderer.php:245` with template-child re-context per product, plus WooCommerce insertion panel `src/index.js:1333` `WooCommercePanel` and store `insertWooCommerceBlock` with Blocks-backed cart/checkout/product/grid creation (styleable via existing panel). Schema `is_dynamic/dynamic_source` plus new `woocommerce_*` types stay additive and version 1.

**Why**: Rebuilding payment/order/inventory from scratch rejected as solo-builder risk; building on Interactivity-API Blocks avoids largest bug category found. Panel reuses existing style controls and drag, not a second editor system. Grid uses single child-template loop to stay within 1,000-block/50-depth budgets.

## Upgrade 5 — Parity commerce extension

**Phase**: 7 addendum (File 5)

**Decision**: Extend `Code_To_Block_Parity::check` with `visit_commerce` `includes/class-code-to-block-parity.php:22` flagging `commerce` context when WooCommerce is inactive (`dynamic` binding requires woo) or `data-product-id` missing (`wc_get_product` null), plus test filter `code_to_block_parity_test_commerce_mismatch`. Still style-declaration-focused for general parity, commerce as additive surface.

**Why**: File 5 pain #2 requires parity to cover product data divergence, same auto-after-save surface as style parity. Heuristic, not full price-value diff, keeps it safe without live product DB snapshot.

## Upgrade 5 — Conflict diagnostic (safe, read-only)

**Phase**: 7 addendum (File 5)

**Decision**: Diagnostic endpoint `GET /code-to-block/v1/pages/{id}/diagnostics` `includes/class-code-to-block-rest-controller.php:55` lists active plugins via `get_plugins`/`active_plugins`, flags heuristic keywords (`cart,checkout,ajax,payment,cache,optimize…`), reports `has_woo` and `commerce_blocks` count, never deactivates plugins. Editor panel `src/index.js:1382` `DiagnosticsPanel` fetches and shows flagged list with reasons. REST checks `permissions_check` same as parity (edit_post), now 6 routes `tests/rest-security-test.php:105`.

**Why**: Addresses research pain #4 "deactivate all plugins one by one" ritual with safe observer tool, not site-wide isolation. Heuristic flagging is transparent ("may hook cart/session") rather than claiming certainty, matching file's "genuinely safe — never actually deactivate" requirement.

## Upgrade 7 — SEO generation from live block data (not hand-typed)

**Phase**: 7 addendum (File 7)

**Decision**: Auto-generate Schema.org JSON-LD at render time from live block tree via `includes/class-code-to-block-seo.php:14` — Product from `woocommerce_product/grid` + `is_dynamic wc_product_*` via `wc_get_product()` same call as renderer, LocalBusiness from content slots labeled `address/phone/hours`, WebPage from document name + permalink. `includes/class-code-to-block-schema.php:86` stores optional document-level `seo` (title/description/canonical/og_*) additive, sanitized 0-1000 chars, `javascript:` rejected. Frontend `code_to_block_output_seo_head` `code-to-block.php:560` `wp_head` outputs meta/canonical/OG + `<script type="application/ld+json">` with `@graph`; generation uses same `wc_get_product` as HTML, so drift window is structurally impossible (no separate cache).

**Why**: Direct answer to "non-experts picking wrong tags" — remove picking, generate from what's true in tree. Heuristic LocalBusiness via slot labels matches business-owner audience (300 industries) without requiring manual schema entry. Additive `seo` keeps v1 compatibility; store in same REST transaction as page so history/save parity holds.

## Upgrade 7 — SEO title/meta via content-mode + inline guidance

**Phase**: 7 addendum (File 7)

**Decision**: Title/description/canonical/OG editable both in dedicated editor `src/index.js:1333` `SeoPanel` `setSeoField` via `commitDocument` and in content-mode `src/content-mode.js:46` `handleSeoChange` alongside other slots, with inline guidance + character counters (title 60, description 160) and help text per field. Content-mode shows SEO section above slots so business owner sees SEO in same simple view as other content, not a separate unfamiliar panel.

**Why**: Spec requires SEO fields "routed through content mode, not a separate SEO settings panel" — same view builds trust. Counters are honest guidance, not auto-generation; title/description quality benefits from human judgment unlike factual Product data.

## Upgrade 7 — Drift guard + mobile-content parity

**Phase**: 7 addendum (File 7)

**Decision**: Drift guard is architectural: JSON-LD and HTML pull from same `wc_get_product` at same `render_document`/`generate_json_ld` instant, no separate stale cache; hash-CSS invalidation from File 6 covers style, visit_commerce parity covers product existence. Mobile-content parity via `Code_To_Block_Parity::visit_mobile_content` `includes/class-code-to-block-parity.php:22` flagging `This content is hidden on mobile and won't be seen by Google's primary index` when a schema-relevant block (Product, LocalBusiness slot, heading) has `display:none` in `responsive_overrides.mobile` (or inherits base hide), with test filter `code_to_block_parity_test_mobile_mismatch`.

**Why**: Spec's "generation + drift guard must ship as one unit" — guard is not a separate warning but proof that generation cannot drift because source is same live object. Mobile warning targets Google's mobile-first indexing risk, not cosmetic hide, and is distinct from generic hidden-on-mobile.

## Upgrade 8 — Architecture first, checker as safety net (accessiBe FTC caution)

**Phase**: 7 addendum (File 8)

**Decision**: File 8 sequencing is architecture-first, checker-second — never claim "compliant/compliance." Directly references January 2025 FTC $1M accessiBe settlement for false "WCAG compliant" claims. All copy uses "helps identify common issues" and disclaimer "Automated checks catch many common issues but cannot replace testing with real assistive technology and real users." Checker language audited to avoid overclaim.

**Why**: Bolt-on overlays fail structurally ("when the page builder updates... those fixes often break"). Fixing markup generation by default (skip link, keyboard, icon, focus) is cheaper and honest; checker catches edge cases requiring human judgment, not a broken foundation.

## Upgrade 8 — Skip-to-content by default (structural)

**Phase**: 7 addendum (File 8)

**Decision**: Skip link `<a class="ctb-skip-link" href="#ctb-main-content">Skip to content</a>` is structural in `templates/singular-ctb-page.php:21` with `position:absolute:-9999px` hidden until `:focus`, targeting `#ctb-main-content` `tabindex="-1"` wrapping `the_content()`. Present on every `ctb_page` without manual block insertion, unlike Divi where confirmed absent.

**Why**: WCAG 2.4.1 failure if missing; must be default, not opt-in, so keyboard users bypass nav without builder/business owner remembering to add it.

## Upgrade 8 — Keyboard operable actions (mandatory, not toggle)

**Phase**: 7 addendum (File 8)

**Decision**: Action-binding triggers are keyboard-operable by default via `assets/runtime.js:64` — `click` plus `keydown` Enter/Space as click, Escape to close `toggle-visibility/show/hide` and return focus to trigger, ArrowDown/ArrowUp to cycle focus within open target, focus management moving into first focusable of opened target (`querySelector a,button,[tabindex]`) and returning to trigger on close. Renderer `includes/class-code-to-block-renderer.php:208` ensures any `[data-ctb-actions]` trigger gets `tabindex="0"` + `role="button"` if not natively focusable, plus `aria-expanded="false"` + `aria-haspopup="true"` for toggle-visibility. Not optional — user cannot ship keyboard-trapped dropdown the way competitors allow.

**Why**: Research: "25% of all digital accessibility issues are tied to poor keyboard support" and dropdown/mega menus are the most repeated failure on both Divi and Elementor (open GitHub issue). Mandatory keyboard makes mega-menu navigable via Tab/Arrow/Enter/Escape without mouse.

## Upgrade 8 — Icon handling (aria-hidden vs aria-label)

**Phase**: 7 addendum (File 8)

**Decision**: Decorative icons (image with `alt=""` + `aria-hidden="true"`) are silent to screen readers; functional icon-only buttons (button with no text, only image/icon) must have `aria-label` describing function, not appearance — enforced via checker `src/accessibility.mjs:22` `checkAltText` flagging missing alt unless explicit `aria-hidden`, rather than auto-guessing. No CSS pseudo-element-only icons — meaningful icons are real DOM nodes.

**Why**: Divi failure: "what you end up hearing is the symbol's name... four and five" from CSS pseudo-icons with no accessible name. Real DOM + explicit aria prevents nonsense announcement and survives builder updates (pseudo fixes break on update).

## Upgrade 8 — Protected focus indicator + checker

**Phase**: 7 addendum (File 8)

**Decision**: Default visible focus via `includes/class-code-to-block-renderer.php:59` `generate_css` global rule `#ctb-page-{id} [data-ctb-actions]:focus-visible, a:focus-visible, button:focus-visible{outline:2px solid #6558d3;outline-offset:2px;}` — user can restyle but not trivially remove. If `custom_css_fallback` contains `outline:none|0` without replacement (`solid|offset|box-shadow`), checker `src/accessibility.mjs:78` `checkFocusIndicators` + parity `includes/class-code-to-block-parity.php:178` `visit_focus_indicators` surface warning `Focus outline removed without a replacement` with plain-language why, not silent removal.

**Why**: Divi's own CSS removes focus indicators — easy to strip, hard to notice. Warning is hard to miss but not impossible to override with deliberate alternative, preventing accidental keyboard blindness.

## Upgrade 8 — Checker: 4 real issues, linked, plain-language

**Phase**: 7 addendum (File 8)

**Decision**: Editor checker `src/accessibility.mjs:14` `runAccessibilityChecks` scans live tree for 4 humane-judgment issues: 1) images without alt, 2) contrast <4.5:1 via relative luminance (hex/rgb, `#fff`/`rgb()`, named), 3) vague link text (`click here|read more|learn more|more|here|link`), 4) skipped heading levels + missing H1. Plus focus removal above. Each issue links to `block_id` via `selectBlock` and explains `why` in plain language, not WCAG numbers. Panel `src/index.js:1436` `AccessibilityPanel` shows `helps identify common issues` + disclaimer, never "compliant." Runs live on document change (not just at save) so fixes are immediate.

**Why**: Concentrated where research says problems cluster (popups/mega menus already fixed architecturally, so checker focuses on content-level human judgment). Links + why make fixes easy; honest language avoids FTC trap.

## Upgrade 9 — Control taxonomy: complete via expanded mapped set + conditional visibility

**Phase**: 7 addendum (File 9)

**Decision**: Expanded `styles.mapped` from 7 to 40+ controls in `src/custom-css.mjs:5` `STYLE_CONTROL_FIELDS` covering Elementor's taxonomy: Data (text/number/color), Multi Value, Unit (px/%/em/rem/vw), Group (Typography via font-size/weight + text-shadow, Border, Background, Box Shadow, CSS Filter), Sizing (width/height/max-width/min-height), Positioning (position/top/right/bottom/left/z-index/transform). Kept UI via group titles + single text inputs (stacked shadows/gradients as CSS syntax, not multi-field). Every new control plugs into same single responsive cascade (`src/responsive-styles.mjs` `ownStyleSet`/`breakpointCascade`) and same `commitDocument` history, per File 9 guardrail — no parallel responsive/token system.

**Why**: More controls risk complexity and re-render triggers touching File 2 performance work. Centralizing on one cascade avoids the researched "hardcode values per breakpoint" workaround and keeps parity check (`Code_To_Block_Parity::check`) automatically covering new controls without a second system.

## Upgrade 9 — Layout conditional visibility (fixes silent-disappear bug)

**Phase**: 7 addendum (File 9)

**Decision**: Centralized visibility contract `src/custom-css.mjs:17` `isMappedControlVisible` / `controlVisibilityReason` with sets `FLEX_CONTROLS` and `GRID_CONTROLS`. When block's `display` is `flex`/`inline-flex`, grid controls disabled with reason "Grid controls apply when Display is grid"; when `grid`/`inline-grid`, flex controls disabled with "Flex controls apply when Display is flex". Editor `src/index.js:2045` `MappedStyleControls` renders hidden-by-layout controls as disabled inputs with reason badge (opacity 0.55) rather than silently absent, and preserves value (not cleared) so switching back restores it. Not duplicated per-widget — one place, tested via rapid Flex↔Grid toggling.

**Why**: Direct fix for researched failure where "columns control silently disappears when parent layout is Flexbox vs Grid, breaking previously-working setups with no warning" — ad-hoc per-widget show/hide caused bug to appear suddenly across many widgets. Central reason makes state predictable and stale-control bug impossible.

## Upgrade 9 — Visual + positioning + parity + known gaps

**Phase**: 7 addendum (File 9)

**Decision**: Visual effects (box-shadow, background/gradient/image + size/position, filter/backdrop-filter, text-shadow) and positioning (position, offsets, z-index, transform, opacity, overflow) added as mapped controls in same expanded set, each validated via `window.CSS.supports` before apply and via `assertSafeCssDeclaration` (blocks `behavior`, `expression`, `javascript:`, unsafe `url()`). Parity automatically covers them (normalized declarations). Known gaps honestly documented: Text Stroke, Image Size (object-fit remains fallback), full Typography group (line-height, letter-spacing, text-transform remain fallback, not mapped), multi-stacked background layers as single syntax not multi-field. Not added: searchable control panel or visual widget IDE (explicitly out-of-scope per File 9).

**Why**: Completeness means covering Elementor's Group list honestly, not silently shipping gaps. Filtered validation keeps raw fallback safe while allowing advanced CSS; parity ensures editor/frontend agree on new effects, folding into existing system rather than a separate testing pass. Gaps named so File 10's Simple/Advanced modes can later gate them without false completeness.

## Upgrade 10 — Simple/Advanced reuse of File 9 conditional system (not a second system)

**Phase**: 7 addendum (File 10)

**Status**: Historical legacy behavior. Superseded for the builder-controls
overhaul by the strict Content/Style/Advanced ownership decision below. The
legacy tier remains only while schema v1/v2 uses the compatibility inspector.

**Decision**: File 10 Simple/Advanced mode reuses File 9's centralized `isMappedControlVisible`/`controlVisibilityReason` in `src/custom-css.mjs:17` — adds `tier: simple|advanced` to each `STYLE_CONTROL_FIELDS` entry (simple: color/padding/margin/font-size/weight/border/radius/background-color/width/max-width; advanced: all layout flex/grid, positioning, visual effects). Visibility now depends on triple condition `(display, panelMode, search)`: search match (`label|property` contains query) overrides tier+layout so searching "shadow" in Simple surfaces Box Shadow; otherwise simple hides advanced, layout hides flex vs grid. Editor `src/index.js:2538` stores `panelMode` default `simple` from `localStorage ctb-panel-mode` persisting per session across selection/reopen, pill toggle Simple/Advanced + search input above `MappedStyleControls` with override note, `RawCssControl` gated behind Advanced (or search `raw|css|custom`), values never cleared when hidden — switching modes rapidly preserves `box-shadow` etc. via `commitDocument` history. Content-mode view has no toggle (already excludes style panel entirely) — Simple by construction.

**Why**: File 9's bug was ad-hoc duplicated show/hide causing "columns control silently disappears" across widgets. Building a second toggle system would reintroduce same class of bug. Reusing one centralized rule set with explicit `tier` + `display` + `search` makes behavior predictable and testable: rapid Simple↔Advanced toggling never loses advanced values, search temporarily surfaces hidden controls without changing mode.

## Upgrade 11 — Zone-based context menu (4 zones, distinct actions, no second system)

**Phase**: 7 addendum (File 11)

**Decision**: Context menu `src/index.js:1436` `ContextMenu` with zones `WIDGET` (leaf text/image/button), `CONTAINER` (container), `SLOT` (is_content_slot), `EMPTY` (canvas stage) — each zone's action set distinct: WIDGET Edit/Duplicate/Copy/Paste/Delete/Copy Styles/Paste Styles/Save as Component; CONTAINER adds Add Inner Container + Convert Layout Mode; SLOT adds Edit Slot Label; EMPTY Paste/Add Block/Page Settings. All actions call existing systems (`duplicateBlock`/`deleteBlock`/`addInnerContainer`/`convertLayoutMode` in store `src/index.js:561` `duplicateBlock` etc., `copyStyles`/`pasteStyles` via `updateBlockMappedStyles`/`updateBlockCustomCss`, `Save as Component` via `saveSelectedAsComponent` prompt). Right-click on block (`BlockContent` `onContextMenu` `src/index.js:1119`) and on empty `ctb-canvas-stage` `onContextMenu` handle empty zone, plus `window click` close and `Shift+F10`/`ContextMenu` key keyboard path opening same menu for `selectedBlock` (center of `[data-ctb-block-id]`). No second clipboard — internal `clipboardBlock`/`clipboardStyles` in Editor state, not a parallel duplication.

**Why**: Elementor's real zone model makes menus fast not cluttered — widget never sees container-only actions. Wiring to existing store methods prevents maintenance liability of duplicate logic and reuses `commitDocument` history, per File 11 guardrail "don't reimplement."

## Upgrade 11 — Drag/nesting reliability (dnd-kit not jQuery UI, parity structural)

**Phase**: 7 addendum (File 11)

**Decision**: Drag system remains `dnd-kit` (Phase 3) not jQuery UI — does not inherit 12-year-old `jquery/jquery#3032` nested droppable bug by construction. Part 2 stress test reuses File 2 deep-nesting page (160 blocks / 9 levels, posts 39/40) for drag scenarios: deep→sibling, deep↔shallow, rapid double-drag, canvas vs structure panel (no separate navigator, so canvas only). Parity extension `includes/class-code-to-block-parity.php:22` `visit_structural` flags link-wrapping-container split (`<a>` containing `container` with nested children) as `structural` warning `Link wrapping a container with nested children may split incorrectly after drag`, with same auto-after-save surface as style/commerce/mobile/focus. Tested via code-inspection and existing `dnd-kit` `closestCenter`+`pointerWithin` collision (`src/index.js:1032`) — no leftover state, correct drop-zone highlight observed in File 2 perf test, but live 4-scenario manual drag not yet run (noted pending).

**Why**: Seven real Elementor GitHub reports trace to nested droppable highlighting wrong target, grid drag "very difficult," and jQuery UI foundation bug. dnd-kit avoids foundation bug, but "didn't inherit" ≠ "proven" — stress test + parity structural check makes reliability verifiable, not assumed. Structural parity catches the exact researched failure where link-wrapped containers shipped as broken split HTML.

## Upgrade 12 — Forms: decoupled visual from submission destination (one builder, two backends)

**Phase**: 7 addendum (File 12)

**Decision**: Form visual (container `form` + `form_field` sub-blocks) is fully styled via existing mapped controls + responsive cascade, not a parallel system. Submission destination is a `data-submission` attribute on the `form` block: `native` (lightweight engine) vs `external` (handoff to installed plugin's shortcode). Same visual blocks produce either path — only one form-building UI, swappable destination, per `upgrade-implementation-plan-12.md` decoupling decision.

**Why**: Building two separate form builders would duplicate styling/layout work and diverge. One visual layer keeps the system honest and maintainable, while "freely choose native or external" is preserved via destination switch, documented as the model for any future "choose the backend" feature.

## Upgrade 12 — Native spam defenses are server-side enforced (decoration is not security)

**Phase**: 7 addendum (File 12)

**Decision**: Native path `POST /code-to-block/v1/forms/{post_id}/submit` `includes/class-code-to-block-forms.php:14` enforces server-side: required + email/url/number validation, honeypot `_ctb_hp_*` (silent fake success if filled so bot doesn't learn), minimum fill 2s (`_ctb_timestamp`), rate limit 1 per IP per 30s + 5 rejections per IP per 30s, and logs every rejection to `wp_code_to_block_submission_logs` + submissions to `wp_code_to_block_submissions` (created via `dbDelta` on activation `code-to-block.php:655`). `wp_mail` via `admin_email` or `data-email-to`. Client-side `assets/runtime.js` submit handler provides immediate required/email feedback and `fetch` but is decoration — bypassing it via devtools still hits server checks. Admin submenu `code-to-block-submissions` lists 100 recent submissions + 50 rejections with mark read/spam/delete. File upload currently placeholder (no `move_uploaded_file`).

**Why**: Research principle "Never trust a flag sent from the client... every signal that matters must be generated or verified server-side. Client-sent flags are decoration, not security" — same as PHP opt-in and WooCommerce session handling earlier. Honeypot silent success prevents bot learning, rate limit conservative, logs make tuning visible. Parity `visit_forms` flags empty forms or required field missing name as `form` context warning.

## Upgrade 12 — External handoff + parity + widget library (no second architecture)
**Why**: Ensures that pages without complex scrubbed/timeline animations do not suffer the payload cost of a JS animation library. Loading GSAP conditionally prevents the editor and frontend bloat seen in other builders.

## Upgrade 6 — Content-hash versioned CSS vs fixed-path regeneration

**Phase**: 7 addendum (File 6)

**Decision**: Generated CSS uses content-hash versioned filenames `ctb-page-{id}-{sha16}.css` instead of fixed `ctb-page-{id}.css`. New hash on each save, long immutable cache via `.htaccess` (`Cache-Control public, max-age=31536000, immutable`), grace-period retirement of stale files, HTML page itself remains short-cache/revalidate so it always points at current hash.

**Why**: Fixed-path regeneration leaves staleness/corruption window documented in Elementor/Divi support docs. Hash-addressing makes each URL immutable — edge cache fetches new file by construction, no manual purge. Implemented in `includes/class-code-to-block-renderer.php:603` `get_asset_location` and `retire_stale_stylesheets`. Signals to optimization plugins via `script_loader_tag` exclusion `code-to-block.php:612`.

## Upgrade 6 — Dedicated editor no-cache signaling

**Phase**: 7 addendum (File 6)

**Decision**: Dedicated editor route (`code-to-block-dedicated`, `code-to-block-content`) sends `Cache-Control: no-store, no-cache, must-revalidate`, `DONOTCACHEPAGE`, and `nocache_headers()` via `code_to_block_handle_dedicated_editor_early` in `code-to-block.php:148`.

**Why**: External cache plugins serving cached editor shell cause "buttons don't respond, widgets won't drag" — research failure category 1. Explicit no-store makes editor un-cacheable by browser/CDN/plugin without relying on heuristic exclusion.

## Content Slots visual indicator — slot badge vs token override

**Phase**: Upgrade 4 (File 4)

**Decision**: Slots retain label prefix `Slot: {slot_label}` in `data-block-label` (`src/index.js:851`) plus distinct dashed teal outline `is-content-slot` (`src/editor.css:1438`) separate from token-override amber. `BlockSlotControl` shows checkbox + label + type selector; content-mode at `admin.php?page=code-to-block-content&post=ID` shows only slots as form, no canvas/drag.

**Why**: Visual at-a-glance distinction required by File 4 checkpoint 2 — must be trustworthy for client handoff. Keeping slots as block props (not wrapper blocks) preserves nesting budget measured in File 2 performance test. History via `setBlockSlotProperties: commitDocument` keeps slot toggles undoable.

## Upgrade 4 — Slots inside reusable components deferred

**Phase**: Upgrade 4 (File 4)

**Decision**: Slots on page blocks fully supported; slots inside saved-component canonical docs are schema-valid but content-mode `src/content-mode.js:34` `findSlots` currently traverses only the resolved page tree, not component library records. Not blocking for File 4 completion — worth revisiting when reusable-component library grows, per file's "worth revisiting" note.

**Why**: Keeps File 4 scope to single-value slots on pages, as explicitly scoped — list-type slots also deferred. Documented so future File 12 widget-library work does not assume component-internal slots work without extra traversal.

## Upgrade 5 — WooCommerce Blocks vs legacy shortcode

**Phase**: 7 addendum (File 5) — Steps 1,4,6 code-complete at v0.16.0, Steps 2,3,5,7 pending live Woo

**Decision**: Product data via native WooCommerce functions (`wc_get_product`) in `includes/class-code-to-block-renderer.php:223` `get_dynamic_data` for `wc_product_title/price/short_description/stock_status/image`; Cart/Checkout via Blocks `<!-- wp:woocommerce/cart -->` not legacy shortcode/AJAX, to avoid `cart.js` table-structure fragility documented in research. Added `woocommerce_product_grid` type `includes/class-code-to-block-schema.php:20` looping `wc_get_products` `includes/class-code-to-block-renderer.php:245` with template-child re-context per product, plus WooCommerce insertion panel `src/index.js:1333` `WooCommercePanel` and store `insertWooCommerceBlock` with Blocks-backed cart/checkout/product/grid creation (styleable via existing panel). Schema `is_dynamic/dynamic_source` plus new `woocommerce_*` types stay additive and version 1.

**Why**: Rebuilding payment/order/inventory from scratch rejected as solo-builder risk; building on Interactivity-API Blocks avoids largest bug category found. Panel reuses existing style controls and drag, not a second editor system. Grid uses single child-template loop to stay within 1,000-block/50-depth budgets.

## Upgrade 5 — Parity commerce extension

**Phase**: 7 addendum (File 5)

**Decision**: Extend `Code_To_Block_Parity::check` with `visit_commerce` `includes/class-code-to-block-parity.php:22` flagging `commerce` context when WooCommerce is inactive (`dynamic` binding requires woo) or `data-product-id` missing (`wc_get_product` null), plus test filter `code_to_block_parity_test_commerce_mismatch`. Still style-declaration-focused for general parity, commerce as additive surface.

**Why**: File 5 pain #2 requires parity to cover product data divergence, same auto-after-save surface as style parity. Heuristic, not full price-value diff, keeps it safe without live product DB snapshot.

## Upgrade 5 — Conflict diagnostic (safe, read-only)

**Phase**: 7 addendum (File 5)

**Decision**: Diagnostic endpoint `GET /code-to-block/v1/pages/{id}/diagnostics` `includes/class-code-to-block-rest-controller.php:55` lists active plugins via `get_plugins`/`active_plugins`, flags heuristic keywords (`cart,checkout,ajax,payment,cache,optimize…`), reports `has_woo` and `commerce_blocks` count, never deactivates plugins. Editor panel `src/index.js:1382` `DiagnosticsPanel` fetches and shows flagged list with reasons. REST checks `permissions_check` same as parity (edit_post), now 6 routes `tests/rest-security-test.php:105`.

**Why**: Addresses research pain #4 "deactivate all plugins one by one" ritual with safe observer tool, not site-wide isolation. Heuristic flagging is transparent ("may hook cart/session") rather than claiming certainty, matching file's "genuinely safe — never actually deactivate" requirement.

## Upgrade 7 — SEO generation from live block data (not hand-typed)

**Phase**: 7 addendum (File 7)

**Decision**: Auto-generate Schema.org JSON-LD at render time from live block tree via `includes/class-code-to-block-seo.php:14` — Product from `woocommerce_product/grid` + `is_dynamic wc_product_*` via `wc_get_product()` same call as renderer, LocalBusiness from content slots labeled `address/phone/hours`, WebPage from document name + permalink. `includes/class-code-to-block-schema.php:86` stores optional document-level `seo` (title/description/canonical/og_*) additive, sanitized 0-1000 chars, `javascript:` rejected. Frontend `code_to_block_output_seo_head` `code-to-block.php:560` `wp_head` outputs meta/canonical/OG + `<script type="application/ld+json">` with `@graph`; generation uses same `wc_get_product` as HTML, so drift window is structurally impossible (no separate cache).

**Why**: Direct answer to "non-experts picking wrong tags" — remove picking, generate from what's true in tree. Heuristic LocalBusiness via slot labels matches business-owner audience (300 industries) without requiring manual schema entry. Additive `seo` keeps v1 compatibility; store in same REST transaction as page so history/save parity holds.

## Upgrade 7 — SEO title/meta via content-mode + inline guidance

**Phase**: 7 addendum (File 7)

**Decision**: Title/description/canonical/OG editable both in dedicated editor `src/index.js:1333` `SeoPanel` `setSeoField` via `commitDocument` and in content-mode `src/content-mode.js:46` `handleSeoChange` alongside other slots, with inline guidance + character counters (title 60, description 160) and help text per field. Content-mode shows SEO section above slots so business owner sees SEO in same simple view as other content, not a separate unfamiliar panel.

**Why**: Spec requires SEO fields "routed through content mode, not a separate SEO settings panel" — same view builds trust. Counters are honest guidance, not auto-generation; title/description quality benefits from human judgment unlike factual Product data.

## Upgrade 7 — Drift guard + mobile-content parity

**Phase**: 7 addendum (File 7)

**Decision**: Drift guard is architectural: JSON-LD and HTML pull from same `wc_get_product` at same `render_document`/`generate_json_ld` instant, no separate stale cache; hash-CSS invalidation from File 6 covers style, visit_commerce parity covers product existence. Mobile-content parity via `Code_To_Block_Parity::visit_mobile_content` `includes/class-code-to-block-parity.php:22` flagging `This content is hidden on mobile and won't be seen by Google's primary index` when a schema-relevant block (Product, LocalBusiness slot, heading) has `display:none` in `responsive_overrides.mobile` (or inherits base hide), with test filter `code_to_block_parity_test_mobile_mismatch`.

**Why**: Spec's "generation + drift guard must ship as one unit" — guard is not a separate warning but proof that generation cannot drift because source is same live object. Mobile warning targets Google's mobile-first indexing risk, not cosmetic hide, and is distinct from generic hidden-on-mobile.

## Upgrade 8 — Architecture first, checker as safety net (accessiBe FTC caution)

**Phase**: 7 addendum (File 8)

**Decision**: File 8 sequencing is architecture-first, checker-second — never claim "compliant/compliance." Directly references January 2025 FTC $1M accessiBe settlement for false "WCAG compliant" claims. All copy uses "helps identify common issues" and disclaimer "Automated checks catch many common issues but cannot replace testing with real assistive technology and real users." Checker language audited to avoid overclaim.

**Why**: Bolt-on overlays fail structurally ("when the page builder updates... those fixes often break"). Fixing markup generation by default (skip link, keyboard, icon, focus) is cheaper and honest; checker catches edge cases requiring human judgment, not a broken foundation.

## Upgrade 8 — Skip-to-content by default (structural)

**Phase**: 7 addendum (File 8)

**Decision**: Skip link `<a class="ctb-skip-link" href="#ctb-main-content">Skip to content</a>` is structural in `templates/singular-ctb-page.php:21` with `position:absolute:-9999px` hidden until `:focus`, targeting `#ctb-main-content` `tabindex="-1"` wrapping `the_content()`. Present on every `ctb_page` without manual block insertion, unlike Divi where confirmed absent.

**Why**: WCAG 2.4.1 failure if missing; must be default, not opt-in, so keyboard users bypass nav without builder/business owner remembering to add it.

## Upgrade 8 — Keyboard operable actions (mandatory, not toggle)

**Phase**: 7 addendum (File 8)

**Decision**: Action-binding triggers are keyboard-operable by default via `assets/runtime.js:64` — `click` plus `keydown` Enter/Space as click, Escape to close `toggle-visibility/show/hide` and return focus to trigger, ArrowDown/ArrowUp to cycle focus within open target, focus management moving into first focusable of opened target (`querySelector a,button,[tabindex]`) and returning to trigger on close. Renderer `includes/class-code-to-block-renderer.php:208` ensures any `[data-ctb-actions]` trigger gets `tabindex="0"` + `role="button"` if not natively focusable, plus `aria-expanded="false"` + `aria-haspopup="true"` for toggle-visibility. Not optional — user cannot ship keyboard-trapped dropdown the way competitors allow.

**Why**: Research: "25% of all digital accessibility issues are tied to poor keyboard support" and dropdown/mega menus are the most repeated failure on both Divi and Elementor (open GitHub issue). Mandatory keyboard makes mega-menu navigable via Tab/Arrow/Enter/Escape without mouse.

## Upgrade 8 — Icon handling (aria-hidden vs aria-label)

**Phase**: 7 addendum (File 8)

**Decision**: Decorative icons (image with `alt=""` + `aria-hidden="true"`) are silent to screen readers; functional icon-only buttons (button with no text, only image/icon) must have `aria-label` describing function, not appearance — enforced via checker `src/accessibility.mjs:22` `checkAltText` flagging missing alt unless explicit `aria-hidden`, rather than auto-guessing. No CSS pseudo-element-only icons — meaningful icons are real DOM nodes.

**Why**: Divi failure: "what you end up hearing is the symbol's name... four and five" from CSS pseudo-icons with no accessible name. Real DOM + explicit aria prevents nonsense announcement and survives builder updates (pseudo fixes break on update).

## Upgrade 8 — Protected focus indicator + checker

**Phase**: 7 addendum (File 8)

**Decision**: Default visible focus via `includes/class-code-to-block-renderer.php:59` `generate_css` global rule `#ctb-page-{id} [data-ctb-actions]:focus-visible, a:focus-visible, button:focus-visible{outline:2px solid #6558d3;outline-offset:2px;}` — user can restyle but not trivially remove. If `custom_css_fallback` contains `outline:none|0` without replacement (`solid|offset|box-shadow`), checker `src/accessibility.mjs:78` `checkFocusIndicators` + parity `includes/class-code-to-block-parity.php:178` `visit_focus_indicators` surface warning `Focus outline removed without a replacement` with plain-language why, not silent removal.

**Why**: Divi's own CSS removes focus indicators — easy to strip, hard to notice. Warning is hard to miss but not impossible to override with deliberate alternative, preventing accidental keyboard blindness.

## Upgrade 8 — Checker: 4 real issues, linked, plain-language

**Phase**: 7 addendum (File 8)

**Decision**: Editor checker `src/accessibility.mjs:14` `runAccessibilityChecks` scans live tree for 4 humane-judgment issues: 1) images without alt, 2) contrast <4.5:1 via relative luminance (hex/rgb, `#fff`/`rgb()`, named), 3) vague link text (`click here|read more|learn more|more|here|link`), 4) skipped heading levels + missing H1. Plus focus removal above. Each issue links to `block_id` via `selectBlock` and explains `why` in plain language, not WCAG numbers. Panel `src/index.js:1436` `AccessibilityPanel` shows `helps identify common issues` + disclaimer, never "compliant." Runs live on document change (not just at save) so fixes are immediate.

**Why**: Concentrated where research says problems cluster (popups/mega menus already fixed architecturally, so checker focuses on content-level human judgment). Links + why make fixes easy; honest language avoids FTC trap.

## Upgrade 9 — Control taxonomy: complete via expanded mapped set + conditional visibility

**Phase**: 7 addendum (File 9)

**Decision**: Expanded `styles.mapped` from 7 to 40+ controls in `src/custom-css.mjs:5` `STYLE_CONTROL_FIELDS` covering Elementor's taxonomy: Data (text/number/color), Multi Value, Unit (px/%/em/rem/vw), Group (Typography via font-size/weight + text-shadow, Border, Background, Box Shadow, CSS Filter), Sizing (width/height/max-width/min-height), Positioning (position/top/right/bottom/left/z-index/transform). Kept UI via group titles + single text inputs (stacked shadows/gradients as CSS syntax, not multi-field). Every new control plugs into same single responsive cascade (`src/responsive-styles.mjs` `ownStyleSet`/`breakpointCascade`) and same `commitDocument` history, per File 9 guardrail — no parallel responsive/token system.

**Why**: More controls risk complexity and re-render triggers touching File 2 performance work. Centralizing on one cascade avoids the researched "hardcode values per breakpoint" workaround and keeps parity check (`Code_To_Block_Parity::check`) automatically covering new controls without a second system.

## Upgrade 9 — Layout conditional visibility (fixes silent-disappear bug)

**Phase**: 7 addendum (File 9)

**Decision**: Centralized visibility contract `src/custom-css.mjs:17` `isMappedControlVisible` / `controlVisibilityReason` with sets `FLEX_CONTROLS` and `GRID_CONTROLS`. When block's `display` is `flex`/`inline-flex`, grid controls disabled with reason "Grid controls apply when Display is grid"; when `grid`/`inline-grid`, flex controls disabled with "Flex controls apply when Display is flex". Editor `src/index.js:2045` `MappedStyleControls` renders hidden-by-layout controls as disabled inputs with reason badge (opacity 0.55) rather than silently absent, and preserves value (not cleared) so switching back restores it. Not duplicated per-widget — one place, tested via rapid Flex↔Grid toggling.

**Why**: Direct fix for researched failure where "columns control silently disappears when parent layout is Flexbox vs Grid, breaking previously-working setups with no warning" — ad-hoc per-widget show/hide caused bug to appear suddenly across many widgets. Central reason makes state predictable and stale-control bug impossible.

## Upgrade 9 — Visual + positioning + parity + known gaps

**Phase**: 7 addendum (File 9)

**Decision**: Visual effects (box-shadow, background/gradient/image + size/position, filter/backdrop-filter, text-shadow) and positioning (position, offsets, z-index, transform, opacity, overflow) added as mapped controls in same expanded set, each validated via `window.CSS.supports` before apply and via `assertSafeCssDeclaration` (blocks `behavior`, `expression`, `javascript:`, unsafe `url()`). Parity automatically covers them (normalized declarations). Known gaps honestly documented: Text Stroke, Image Size (object-fit remains fallback), full Typography group (line-height, letter-spacing, text-transform remain fallback, not mapped), multi-stacked background layers as single syntax not multi-field. Not added: searchable control panel or visual widget IDE (explicitly out-of-scope per File 9).

**Why**: Completeness means covering Elementor's Group list honestly, not silently shipping gaps. Filtered validation keeps raw fallback safe while allowing advanced CSS; parity ensures editor/frontend agree on new effects, folding into existing system rather than a separate testing pass. Gaps named so File 10's Simple/Advanced modes can later gate them without false completeness.

## Upgrade 10 — Simple/Advanced reuse of File 9 conditional system (not a second system)

**Phase**: 7 addendum (File 10)

**Status**: Historical legacy behavior. Superseded for the builder-controls
overhaul by the strict Content/Style/Advanced ownership decision below. The
legacy tier remains only while schema v1/v2 uses the compatibility inspector.

**Decision**: File 10 Simple/Advanced mode reuses File 9's centralized `isMappedControlVisible`/`controlVisibilityReason` in `src/custom-css.mjs:17` — adds `tier: simple|advanced` to each `STYLE_CONTROL_FIELDS` entry (simple: color/padding/margin/font-size/weight/border/radius/background-color/width/max-width; advanced: all layout flex/grid, positioning, visual effects). Visibility now depends on triple condition `(display, panelMode, search)`: search match (`label|property` contains query) overrides tier+layout so searching "shadow" in Simple surfaces Box Shadow; otherwise simple hides advanced, layout hides flex vs grid. Editor `src/index.js:2538` stores `panelMode` default `simple` from `localStorage ctb-panel-mode` persisting per session across selection/reopen, pill toggle Simple/Advanced + search input above `MappedStyleControls` with override note, `RawCssControl` gated behind Advanced (or search `raw|css|custom`), values never cleared when hidden — switching modes rapidly preserves `box-shadow` etc. via `commitDocument` history. Content-mode view has no toggle (already excludes style panel entirely) — Simple by construction.

**Why**: File 9's bug was ad-hoc duplicated show/hide causing "columns control silently disappears" across widgets. Building a second toggle system would reintroduce same class of bug. Reusing one centralized rule set with explicit `tier` + `display` + `search` makes behavior predictable and testable: rapid Simple↔Advanced toggling never loses advanced values, search temporarily surfaces hidden controls without changing mode.

## Builder controls A2 — registry identity, authority, and extension conflicts

**Phase**: Builder controls overhaul, Task A2

**Decision**: Adopt `docs/control-registry-contract.md` as normative. Stable
`element` identity and independent `definition_version` sit beside compatibility
`type` and semantic `tag`. JavaScript definitions generate the build manifest;
PHP is authoritative for persistence and rendering. Capabilities are explicit
target grants. Duplicate IDs, aliases, reserved namespaces, or unresolved
references reject an extension fragment; there is no last-write-wins path.
Unknown v3 definitions are preserved and read-only rather than re-inferred.

**Why**: Palette, inspector, schema, renderer, insertion, and migration cannot
remain independent registration paths without drifting. Explicit authority and
conflict behavior also prevents a client-only or missing extension from
weakening server validation or destroying namespaced data.

## Builder controls A2 — strict tabs and configured progressive disclosure

**Phase**: Builder controls overhaul, Task A2

**Decision**: Content owns data/semantics/behavior, Style owns visual target
grants, and Advanced owns placement, motion, visibility/conditions,
attributes/accessibility, performance, permissions, and developer controls.
Advanced never mounts Style groups. This supersedes the global Simple/Advanced
tier. Primary/recommended/optional grants provide element-specific disclosure.

**Why**: A universal tier and repeated style catalog make irrelevant controls
inevitable. Strict ownership lets shared implementations remain reusable without
granting typography, layout, media, or state controls to nonsensical targets.

## Builder controls A2 — sparse style contexts and deterministic cascade

**Phase**: Builder controls overhaul, Task A2

**Decision**: Adopt `docs/style-context-contract.md` as normative. Persist only
canonical `base`, `bp:<id>`, `state:<id>`, and
`bp:<id>|state:<id>` contexts. Resolve the recorded 12-level source precedence,
use stable block-ID selectors and registered part markers, do not add universal
`!important`, and store visibility outside layout `display`.

**Why**: Sparse contexts prevent copied inherited values, while one exact
grammar and precedence makes editor/frontend output testable across targets,
breakpoints, states, presets, custom declarations, and retained legacy priority.

## Builder controls A2 — dual-read migration and fail-safe apply

**Phase**: Builder controls overhaul, Task A2

**Decision**: Legacy documents remain dual-read through their adapter/compiler;
successful migrations write canonical v3. Preview never mutates the source.
Apply must validate, compile, parity-check, create a revision, and perform a
stale-safe meta update atomically. Failure retains source JSON and existing CSS;
rollback restores the source revision and reactivates the adapter.

**Why**: Opening a page is not consent to rewrite it. Atomic, report-producing
migration is required before selector, target, visibility, or priority semantics
can change without silently losing values.

## Upgrade 11 — Zone-based context menu (4 zones, distinct actions, no second system)

**Phase**: 7 addendum (File 11)

**Decision**: Context menu `src/index.js:1436` `ContextMenu` with zones `WIDGET` (leaf text/image/button), `CONTAINER` (container), `SLOT` (is_content_slot), `EMPTY` (canvas stage) — each zone's action set distinct: WIDGET Edit/Duplicate/Copy/Paste/Delete/Copy Styles/Paste Styles/Save as Component; CONTAINER adds Add Inner Container + Convert Layout Mode; SLOT adds Edit Slot Label; EMPTY Paste/Add Block/Page Settings. All actions call existing systems (`duplicateBlock`/`deleteBlock`/`addInnerContainer`/`convertLayoutMode` in store `src/index.js:561` `duplicateBlock` etc., `copyStyles`/`pasteStyles` via `updateBlockMappedStyles`/`updateBlockCustomCss`, `Save as Component` via `saveSelectedAsComponent` prompt). Right-click on block (`BlockContent` `onContextMenu` `src/index.js:1119`) and on empty `ctb-canvas-stage` `onContextMenu` handle empty zone, plus `window click` close and `Shift+F10`/`ContextMenu` key keyboard path opening same menu for `selectedBlock` (center of `[data-ctb-block-id]`). No second clipboard — internal `clipboardBlock`/`clipboardStyles` in Editor state, not a parallel duplication.

**Why**: Elementor's real zone model makes menus fast not cluttered — widget never sees container-only actions. Wiring to existing store methods prevents maintenance liability of duplicate logic and reuses `commitDocument` history, per File 11 guardrail "don't reimplement."

## Upgrade 11 — Drag/nesting reliability (dnd-kit not jQuery UI, parity structural)

**Phase**: 7 addendum (File 11)

**Decision**: Drag system remains `dnd-kit` (Phase 3) not jQuery UI — does not inherit 12-year-old `jquery/jquery#3032` nested droppable bug by construction. Part 2 stress test reuses File 2 deep-nesting page (160 blocks / 9 levels, posts 39/40) for drag scenarios: deep→sibling, deep↔shallow, rapid double-drag, canvas vs structure panel (no separate navigator, so canvas only). Parity extension `includes/class-code-to-block-parity.php:22` `visit_structural` flags link-wrapping-container split (`<a>` containing `container` with nested children) as `structural` warning `Link wrapping a container with nested children may split incorrectly after drag`, with same auto-after-save surface as style/commerce/mobile/focus. Tested via code-inspection and existing `dnd-kit` `closestCenter`+`pointerWithin` collision (`src/index.js:1032`) — no leftover state, correct drop-zone highlight observed in File 2 perf test, but live 4-scenario manual drag not yet run (noted pending).

**Why**: Seven real Elementor GitHub reports trace to nested droppable highlighting wrong target, grid drag "very difficult," and jQuery UI foundation bug. dnd-kit avoids foundation bug, but "didn't inherit" ≠ "proven" — stress test + parity structural check makes reliability verifiable, not assumed. Structural parity catches the exact researched failure where link-wrapped containers shipped as broken split HTML.

## Upgrade 12 — Forms: decoupled visual from submission destination (one builder, two backends)

**Phase**: 7 addendum (File 12)

**Decision**: Form visual (container `form` + `form_field` sub-blocks) is fully styled via existing mapped controls + responsive cascade, not a parallel system. Submission destination is a `data-submission` attribute on the `form` block: `native` (lightweight engine) vs `external` (handoff to installed plugin's shortcode). Same visual blocks produce either path — only one form-building UI, swappable destination, per `upgrade-implementation-plan-12.md` decoupling decision.

**Why**: Building two separate form builders would duplicate styling/layout work and diverge. One visual layer keeps the system honest and maintainable, while "freely choose native or external" is preserved via destination switch, documented as the model for any future "choose the backend" feature.

## Upgrade 12 — Native spam defenses are server-side enforced (decoration is not security)

**Phase**: 7 addendum (File 12)

**Decision**: Native path `POST /code-to-block/v1/forms/{post_id}/submit` `includes/class-code-to-block-forms.php:14` enforces server-side: required + email/url/number validation, honeypot `_ctb_hp_*` (silent fake success if filled so bot doesn't learn), minimum fill 2s (`_ctb_timestamp`), rate limit 1 per IP per 30s + 5 rejections per IP per 30s, and logs every rejection to `wp_code_to_block_submission_logs` + submissions to `wp_code_to_block_submissions` (created via `dbDelta` on activation `code-to-block.php:655`). `wp_mail` via `admin_email` or `data-email-to`. Client-side `assets/runtime.js` submit handler provides immediate required/email feedback and `fetch` but is decoration — bypassing it via devtools still hits server checks. Admin submenu `code-to-block-submissions` lists 100 recent submissions + 50 rejections with mark read/spam/delete. File upload currently placeholder (no `move_uploaded_file`).

**Why**: Research principle "Never trust a flag sent from the client... every signal that matters must be generated or verified server-side. Client-sent flags are decoration, not security" — same as PHP opt-in and WooCommerce session handling earlier. Honeypot silent success prevents bot learning, rate limit conservative, logs make tuning visible. Parity `visit_forms` flags empty forms or required field missing name as `form` context warning.

## Upgrade 12 — External handoff + parity + widget library (no second architecture)

**Phase**: 7 addendum (File 12)

**Decision**: External path renders only whitelisted shortcodes (`contact-form-7|wpforms|formidable|gravityform|ninja_form` via `preg_match`) via `do_shortcode`, others as safe note — honest about per-plugin integration depth per File 12 checkpoint. Parity `visit_forms` reuses same `Code_To_Block_Parity::check` surface as style/commerce/mobile/focus/structural, not a separate check. Widget library `src/widget-library.mjs` 8 pre-built arrangements (pricing table, testimonial, icon box, countdown, stats, team, FAQ, gallery) each with `is_content_slot` slots, inserted via `insertWidget` cloning with fresh IDs + 1,000/50/2 MB guards, reusing `commitDocument` and existing `ReusableComponent`/`Starter` isolation — not a second component system, per File 12 clarification that "widgets = blocks" and Part 3 must be built on File 4.

**Why**: External depth varies per plugin architecture — promising uniform deep mapping would be dishonest. Whitelist keeps rendering safe. Widget library as static arrangements proves File 4's reusable-components system is genuinely reusable and slot-aware, and proves no parallel architecture was built, per standing rule since File 9.

## Upgrade 15 — Shape-Aware Skeleton Loaders

**Phase**: 7 addendum (File 15)

**Decision**: Added shape-aware skeleton loaders derived from `slot_content_type` ('text', 'rich_text', 'image', 'link') during async loading states (initial editor load and WooCommerce async data fetch). The shimmer animation is CSS-native without triggering JS loads. Placed intentionally in the Free tier.

**Why**: A loading-state polish detail builds user trust. Restricting it to a premium tier undermines the trust-building purpose of the Free tier. Deriving shapes from existing schema (File 4 slots) is highly efficient and provides recognizable placeholder shapes (e.g. pricing card vs plain box) without layout shifts.

## Upgrade 18 — Deterministic Block Drop Intent

**Phase**: Drag-and-drop reliability follow-up

**Decision**: Canvas reordering and palette insertion resolve the pointer against one shared, pure drop-intent model. Every drop produces a target, `before` / `inside` / `after` position, destination parent/index, and validity before mutating the document. Nested targets are ordered deterministically by depth, validity, geometry, and document order. The existing clone-before-commit history path and root/self/lock/descendant guards remain authoritative.

**Why**: Collision proximity alone cannot express placement intent and previously made containers always append while leaves always inserted after. A single tested resolver keeps pointer feedback, block moves, and palette insertion synchronized and prevents visual indicators from promising a destination different from the committed tree.
