=== Code to Block ===
Contributors: code-to-block
Tags: page builder, blocks, css, landing page, gutenberg
Requires at least: 6.5
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.22.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Turns pasted HTML and CSS into draggable, editable block trees with responsive controls, design tokens, reusable components, forms, SEO, and accessibility helpers.

== Description ==

The Code to Block page editor resolves pasted HTML and CSS into the version 1 block schema, renders each element on a visual canvas, supports block reordering and re-nesting via drag-and-drop (dnd-kit), provides 40+ style controls with Simple/Advanced modes, and persists the full tree through authenticated REST endpoints.

Saved trees render on the custom post type's public URL. Their scoped CSS is generated once during save as a content-hash versioned file (`ctb-page-{id}-{hash}.css`) and served from the WordPress uploads directory with long immutable caching.

The editor includes semantic block classification, bounded undo/redo history, validated raw CSS fallback editing, and mapped color, spacing, typography, border, layout (Flexbox/Grid), sizing, positioning, and visual effect controls (background, box-shadow, filter, transform) with centralized conditional visibility (Flex controls only when Display is flex, etc.) and per-block responsive tablet/mobile overrides plus hover/focus states.

Selected subtrees can be stored in a shared reusable-component library and inserted as linked, failure-isolated instances on any builder page. Imported blocks also include an Explain CSS view showing which resolved source declarations reached named controls and which were preserved as raw CSS. A starter-template library (hero, pricing, testimonial, footer) and an 8-item widget library (pricing table, testimonial, icon box, countdown, stats, team, FAQ accordion, image gallery) can replace the canvas or be inserted after the selected block.

Forms are visual `form` containers holding `form_field` sub-blocks (text, email, textarea, select, checkbox, radio, file). Field styling uses the same panel. Submission handling is swappable per form: Native (DB + email via `wp_mail`, server-side honeypot, 2s min fill, 1 per IP per 30s rate limit, logs, admin screen `Code to Block → Submissions`) or External Plugin (whitelisted shortcodes `contact-form-7|wpforms|formidable|gravityform|ninja_form` via `do_shortcode`, honest depth).

SEO is auto-generated at render time: WebPage from document name, Product from `woocommerce_product`/`woocommerce_product_grid`/`is_dynamic wc_product_*` via `wc_get_product()` same call as HTML, LocalBusiness from content slots labeled `address`/`phone`/`hours`, plus document-level `seo` (title, description, canonical, og_title, og_description, og_image) editable in the SEO panel and Content Mode with character counters.

Accessibility is architecture-first, checker as safety net (never "compliant"): skip link by default, keyboard operability for actions (`Enter`/`Space` as click, `Escape` to close, `Arrow` to cycle), protected focus indicator, icon handling, and a live checker for alt, contrast <4.5:1, vague link text, skipped headings, and focus removal — all with plain-language why and link to block.

WooCommerce integration is native: single product and product grid blocks via `wc_get_product`/`wc_get_products`, cart/checkout via WooCommerce Blocks (Interactivity API) not shortcodes, diagnostics listing active plugins with heuristic flags, and parity extensions for commerce, mobile-content, focus, and structural integrity.

Right-click context menus are zone-based (widget/container/slot/empty) distinct per zone and wired to existing store methods (Duplicate/Delete/Add Inner Container/Convert Layout/Copy Styles/Paste Styles/Save as Component) with keyboard `Shift+F10` equal access.

== Installation ==

1. Upload to `/wp-content/plugins/` or install via Plugins → Add New → Upload Plugin.
2. Activate `Code to Block` through the `Plugins` menu.
3. Create a new `Code to Block Page` (Pages → Code to Block Pages → Add New).
4. Paste HTML and CSS into the importer, click `Parse onto canvas`, then drag, style, and set responsive overrides.
5. `Save tree` — the public URL is `/?ctb_page={slug}` via the `built-page` rewrite, rendered through a minimal full-canvas template that still calls `wp_head`, `wp_body_open`, `wp_footer`.

From the plugin directory, run `npm install` and `npm run build`. Generated editor assets are committed in `build/` so production sites do not need Node.js.

== Frequently Asked Questions ==

= Does this execute my JavaScript? =

Only narrow click patterns after explicit confirmation: `document.getElementById('id')` or `document.querySelector('#id')` with `.addEventListener('click', …)` and one of `classList.toggle/add/remove`, `toggleAttribute('hidden')`, `hidden = true/false`. Nothing executable is added until you click **Confirm and map action**. Everything else is preserved as `manual-review / unverified-script` metadata, shown as `Unverified script / never executed`, never rendered or executed server or client. The saved `animation_type` (`css_native` vs `js_library`) controls whether GSAP loads.

= Does this run my PHP? =

Only after explicit `REGISTER ctb_php_…` phrase, and only on its owning singular `ctb_page` as bare `[ctb_php_…]` in text nodes. Requires `edit_post` + `manage_options` + `unfiltered_html` (multisite: super admin), and `DISALLOW_FILE_EDIT`/`DISALLOW_FILE_MODS` must not be set. The body is compiled via a permission-restricted temporary file outside `ABSPATH` and immediately unlinked, never `eval`, with runtime rescanning and hash check. To disable, do not define `CODE_TO_BLOCK_ALLOW_PHP` or keep file editing disallowed.

= Where is the data stored? =

Page trees in post meta `_ctb_block_tree` as version 1 JSON (1,000 blocks, 50 levels, 2 MB). Reusable components in post type `ctb_component` meta `_ctb_component_tree` (100 max). Design tokens in the same document JSON. Form submissions in `wp_code_to_block_submissions` and rejections in `wp_code_to_block_submission_logs` (created on activation via `dbDelta`). Generated CSS in `wp-content/uploads/code-to-block/ctb-page-{id}-{hash}.css` with `.htaccess` long cache. No external calls without consent.

= Does this store form submissions? =

Yes, native forms store submissions locally in `wp_code_to_block_submissions` (`post_id`, `form_id`, `data` JSON, `ip`, `user_agent`, `created_at`, `status` `new|read|spam`) and rejections in `wp_code_to_block_submission_logs` with reason `honeypot|too_fast|rate_limit`. Email is sent via `wp_mail` to the form's Email To or `admin_email`. View in `Code to Block → Submissions`. External handling does not store locally; it delegates to the external plugin's shortcode.

= Where is the data for WooCommerce products? =

Product data is live via `wc_get_product()` and `wc_get_products()` at render time — not duplicated. `is_dynamic` bindings (`wc_product_title` etc.) pull at render, so price/stock changes reflect immediately. Grid loops latest products; product blocks can be bound to a specific `data-product-id`.

= How does SEO work? =

JSON-LD (`WebPage`, `Product`, `LocalBusiness`) is auto-generated at render time from live block data (same `wc_get_product` as HTML, so no stale cache). Title/description/canonical/Open Graph are document-level `seo` fields editable in the SEO panel and Content Mode (character counters, help text). The same generation runs for every page view, with `+ drift guard` and `mobile` parity warnings if schema-relevant content is hidden on mobile.

= What does the accessibility checker do? =

It `helps identify common issues` — never claims compliance. It runs live on document change for: images without alt, contrast <4.5:1, vague link text (`click here` etc.), skipped heading levels + missing H1, and focus outline removal. Each links to the block and explains why in plain language. Architecture first: skip link by default, keyboard operability for actions, protected focus indicator. Test with real assistive technology for real compliance; see `WP_ORG_SUBMISSION_PREP.md` for the accessiBe FTC note.

= What happens if the style and frontend disagree? =

After every save, `Code_To_Block_Parity::check` compares editor `buildPreviewStyles` vs frontend `Code_To_Block_Renderer::generate_css` (and commerce/mobile/focus/structural/forms). If they disagree, the editor shows `this block may render differently on the live site` per block/context, including `commerce`/`mobile`/`focus`/`structural`/`form`.

= Where do I enter my license for Pro/Agency? =

This free tier on WordPress.org is the complete v1 (0.22.0). If you launch paid tiers alongside, Pro/Agency ship as a separate add-on plugin hosted outside WordPress.org (`code-to-block-pro.zip`) that filters `code_to_block_is_pro` and verifies a key against `https://licenses.yourdomain.com/verify` cached 12h. See `PAYMENT_SETUP.md` for Stripe/Paddle test-mode checkout, webhook, and `verify` endpoints. All `sk_live_` handling stays server-side; verification is opt-in (paste key → Activate), fail-open with cached status.

== Screenshots ==

1. Editor canvas with dashed block outlines, Simple/Advanced toggle, search, and style panel (color, layout, background, box-shadow) plus token bindings and raw CSS.
2. Content Mode simplified view — slots as form fields plus SEO section (title/description/canonical/Open Graph with counters).
3. WooCommerce product block (title/price/image via `is_dynamic`) and product grid (6) with diagnostics panel listing flagged plugins.
4. Form block (Name/Email/Message) with field settings (required, placeholder, options) and submission handling Native vs External shortcode, plus 8-widget library (pricing/testimonial/icon-box/countdown/stats/team/FAQ/gallery).
5. Explain CSS panel showing mapped vs raw CSS with origin, plus parity warnings (`commerce`/`mobile`/`focus`/`structural`/`form`) and Accessibility checker (`alt`/`contrast`/`link`/`heading`).
6. Public `ctb_page` full-canvas rendering at desktop 1440, tablet 768, mobile 390 — no WordPress post chrome, jump in with skip link visible on Tab, `ctb-page-{id}-{hash}.css` cached immutable.

== Changelog ==

= 0.22.0 =
* Forms: `form` + `form_field` blocks (`form`/`input`/`select`/`textarea`/`option` in allowlist), visual builder same panel, native DB+email+honeypot/time/rate/log+admin `Submissions` + external shortcode whitelist + `visit_forms` parity, widget library 8 pre-built with slots on reusable-components.
* Build 405 KiB.

= 0.21.0 =
* Zone-based context menu (widget/container/slot/empty) distinct, wired to existing store, `Shift+F10` keyboard path, drag on `dnd-kit` not jQuery UI + `visit_structural` parity.
* Build 383 KiB.

= 0.20.0 =
* Simple/Advanced panel modes: `tier` per control, centralized `isMappedControlVisible` reuse, Simple default + `localStorage` persist + search override, values persist, `RawCssControl` gated.
* Build 375 KiB.

= 0.19.0 =
* Complete control panel: 40+ mapped controls (Flexbox/Grid, sizing, positioning, visual), conditional visibility central with reason, `CSS.supports` validation, parity auto-covers.
* Build 371 KiB. Updated `tests/custom-css-test.mjs` for `display` mapped.

= 0.18.0 =
* Accessibility: skip link structural, keyboard actions `Enter`/`Space`/`Escape`/`Arrow` + focus management + `tabindex`/`role`/`aria-expanded`, protected `focus-visible` + parity `visit_focus_indicators`, checker `alt`/`contrast`/`link`/`heading` plain-language.
* Build 368 KiB.

= 0.17.0 =
* SEO: auto JSON-LD `WebPage`/`Product`/`LocalBusiness`, document `seo` + `SeoPanel` + content-mode SEO + `visit_mobile_content` parity + drift guard.
* Build 361 KiB.

= 0.16.0 =
* WooCommerce: `woocommerce_product_grid` loop, `is_dynamic` bindings, `WooCommercePanel` + `insertWooCommerceBlock`, parity `visit_commerce`, diagnostics `GET diagnostics` (6 routes).
* Build 358 KiB.

= 0.15.0 =
* Content slots as block props `is_content_slot`/`slot_label`/`slot_content_type`, `content-mode.js` + `editor-content.php` + `BlockSlotControl` teal badge, `code_to_block_duplicate` + `conditional GSAP` `animation_type` + hash versioned CSS `ctb-page-{id}-{hash}.css` + `DONOTCACHEPAGE` + exclusion signals.
* Build 348 KiB.

= 0.11.0 =
* Starter templates (4) static replace/insert, `build` 338 KiB, `USER_GUIDE` honest, `WP_ORG_SUBMISSION_PREP` guideline audit.

== Upgrade Notice ==

= 0.22.0 =
On activation, creates `wp_code_to_block_submissions` and `wp_code_to_block_submission_logs` via `dbDelta`. No migration needed from 0.11.0; all block schema changes are additive (1,000/50/2 MB guards unchanged).

== Third-Party Libraries ==

* `postcss` 8.5.26 — MIT — https://github.com/postcss/postcss — CSS parsing for raw fallback validation.
* `zustand` 5.0.15 — MIT — https://github.com/pmndrs/zustand — editor state.
* `@dnd-kit/core` 6.3.1 — MIT — https://github.com/clauderic/dnd-kit — drag-and-drop.
* `specificity` 1.0.0 — MIT — https://github.com/keeganstreet/specificity — CSS specificity calculation.
* `gsap` 3.15.0 — Standard License (free tier) — https://gsap.com/ — conditionally loaded only when a block has `js_library` animation.
* `@wordpress/api-fetch` 7.53.0, `@wordpress/element` 8.5.0 — GPL-2.0-or-later — https://github.com/WordPress/gutenberg — REST and React element.

All are GPL-compatible. Source in `src/`; `build/` is reproducible via `npm install && npm run build`. No `node_modules` in zip. Images in `mvp-landing-*.png` etc. are optional samples, not required.

Privacy: Code to Block does not contact external servers or collect personal data except as you configure: form submissions store `ip`, `user_agent`, `data` locally and email via `wp_mail` to your chosen address; no tracking without consent. License verification for Pro (if used) is opt-in (paste key → Activate) and contacts `licenses.yourdomain.com/verify`, cached 12h. See `WP_ORG_SUBMISSION_PREP.md` for the `CODE_TO_BLOCK_ALLOW_PHP` review note and file-`0600` temp-file handling.
