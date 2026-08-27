# Code to Block — User Guide (v0.22.0)

This is plain-language documentation for what Code to Block does well, what it does by preserving your original code, and what it intentionally does not do yet.

## 1. What happens when you paste HTML and CSS

You paste one root HTML element and its CSS. The importer:

* Parses your HTML with an inert DOM parser. It removes `<script>` elements before any block is created.
* Parses your CSS with PostCSS, calculates specificity, and resolves which declaration wins for each element. It then splits the result per block into two places.

### Well-supported in the style panel (v0.22.0 — 40+ controls, Simple/Advanced)

These properties have a dedicated control. When your CSS wins for a block, the value appears in the control and you can edit it without touching raw CSS. The panel has two modes that reuse the same underlying system:

* **Simple** (default, 10 controls for business owners): `color`, `padding`, `margin`, `font-size`, `font-weight`, `border`, `border-radius`, `background-color`, `width`, `max-width`. Simple is the default on first open and is remembered per browser (`localStorage`); content-mode is Simple by construction (no toggle).
* **Advanced** (all controls): Simple plus layout (`display`, `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `gap`, `grid-template-columns/rows`, `flex-grow/shrink/basis`, `align-self`, `order`, `grid-column/row`), sizing (`height`, `min-height`), positioning (`position`, `top/right/bottom/left`, `z-index`), visual (`background`, `background-image/size/position`, `box-shadow`, `opacity`, `filter`, `backdrop-filter`, `transform`, `text-shadow`, `overflow`). Switching modes never loses values — an Advanced value like `box-shadow` stays while hidden in Simple and returns unchanged.

A **search field** at the top of the panel filters controls by name — searching `shadow` while in Simple surfaces Box Shadow even though it's normally hidden. The search override is temporary; clearing the search returns to the current mode's filter.

You can link `color`, `font-size`, `font-weight`, `padding`, `margin`, and `border-radius` to global design tokens (colors, typography, spacing). Changing the token updates every block that references it; per-block Override keeps the binding but replaces that one value with raw CSS and shows `token override` with Restore.

**Layout conditional visibility:** `display` governs which controls appear. Flex controls show only when Display is `flex`/`inline-flex`; Grid controls only when `grid`/`inline-grid`. When hidden, the panel shows a disabled input with reason “Flex controls apply when Display is flex” rather than silently absent — and the value is preserved so switching back restores it. This is one centralized rule, not per-widget logic, so it never silently breaks.

### Everything else goes to Raw Custom CSS

If a winning declaration is not one of the mapped controls above, it is preserved as a normalized declaration list for that block (`custom_css_fallback`). Common examples that stay in raw CSS now are the remaining honest gaps: `text-stroke`, `object-fit` (Image Size), `line-height`, `letter-spacing`, `text-transform` are still fallback — they are filtered as safe or rejected as unsafe (`behavior`, `expression()`, `@import`, `</style>`, unbalanced brackets, unsafe `url()`). `display` and layout properties that are now mapped no longer stay in fallback — they appear in controls. Raw CSS is an Advanced control — in Simple mode it is hidden behind “Raw Custom CSS is an Advanced control — switch to Advanced or search ‘raw’ to edit.”

Each block can have base styles plus optional `tablet` and `mobile` overrides. Tablet inherits from desktop. Mobile inherits from tablet then desktop. Empty breakpoint branches are not saved. `Raw CSS` also supports per-breakpoint overrides.

**How to tell what happened:** Select any imported block and open **Explain CSS**. It shows every resolved winning declaration for that block, grouped as “Mapped to controls” vs “Preserved as raw CSS”, with the value, `!important`, and origin (`stylesheet`, `inline`, `inherited`). This record is captured at import and does not change when you later edit the controls. Existing or manually created blocks show “No CSS mapping was recorded”.

### Limits that are enforced

* HTML and CSS each 2 MB or smaller.
* At most 1000 blocks per page and 50 levels deep.
* At most 2000 selectors in the CSS you paste.
* Raw CSS must be declarations only (no selectors, no at-rules, no comments). Values are checked for unsafe patterns.
* CSS `url()` values with `http:`, `https:`, `/`, `//`, or `#` are allowed. `javascript:` and escaped values are rejected.
* Canvas drag uses `dnd-kit` (`closestCenter`+`pointerWithin`) not jQuery UI — no inherited 12-year-old nested droppable bug. Parity checks structural integrity after drag.

### What is intentionally not a full cascade debugger

* At-rules (`@media`, `@keyframes`, etc.) are skipped with “Unsupported rule skipped”.
* Pseudo-elements (`::before`) and dynamic pseudos (`:hover`, `:focus`, `:active`) are skipped with a warning.
* Expensive `:has()` selectors are skipped.
* Invalid selectors are skipped.
* `var()` usage is preserved but you get the warning “Custom-property substitution was not computed”.
* Selector text and losing candidates are not stored. Use Explain CSS for mapped-vs-fallback transparency, not browser DevTools-level debugging.

## 2. JavaScript: what is supported vs what is kept as-is

### Supported and mappable (narrow and explicit)

Code to Block only offers to map a script when it matches **exactly one** click source and **exactly one** supported operation:

* **Click source** must be `document.getElementById('id')` or `document.querySelector('#id')` with `.addEventListener('click', …)`.
* **Operation** must be one of:
  * `element.classList.toggle('valid-class')` → `toggle-class`
  * `element.classList.add('valid-class')` → `add-class`
  * `element.classList.remove('valid-class')` → `remove-class`
  * `element.toggleAttribute('hidden')` → `toggle-visibility`
  * `element.hidden = true` → `hide`
  * `element.hidden = false` → `show`

When both IDs resolve to exactly one converted block, the editor shows the full script source, a plain description like “On click, toggle class ‘is-open’ on #panel.”, the source block and target block, and a **Confirm and map action** button. Nothing executable is added until you click that button. The result is saved as structured data:

```json
{ "trigger": "click", "behavior": "toggle-visibility", "params": { "target_block_id": "panel-1" }, "animation_type": "css_native" }
```

`animation_type` is `css_native` (default, CSS transition) or `js_library` (GSAP ScrollTrigger). GSAP and ScrollTrigger are only enqueued on the frontend if a page contains at least one `js_library` action; the editor dynamically imports GSAP only when such an action is present. Pages without `js_library` never load GSAP.

The public page then runs only that structured behavior via `assets/runtime.js`, which is also keyboard-operable by default: `Enter`/`Space` act as click, `Escape` closes an open `toggle-visibility` and returns focus to the trigger, `ArrowDown`/`ArrowUp` cycle focus within an open menu, focus moves into the opened target's first focusable and returns on close. Blocks with actions get `tabindex="0"`+`role="button"` if not natively focusable plus `aria-expanded`/`aria-haspopup` for toggles.

### Attached as-is (never executed)

Anything that does not match the pattern above is attached to the imported root as unverified metadata:

```
trigger: "manual-review"
behavior: "unverified-script"
params: { code: "<your original script here>", description: "Unverified script preserved for manual review. It is never executed by Code to Block." }
```

The editor shows it under **Unverified script / never executed** with the full code. It is preserved through save/load for your review, but it produces no `data-ctb-actions`, no inline script, and no network request on the public page. The public runtime never `eval`s it. The editor and server reject any attempt to promote unverified metadata to an executable trigger.

## 3. PHP: detection and opt-in registration (from your perspective)

This is an explicit, administrator-only code-execution feature. It never runs automatically.

**Step by step:**

1. You paste HTML that contains one or more `<?php ... ?>` blocks. Before the HTML is converted to blocks, the importer extracts each complete PHP block and replaces it in the content with inert text like `[ctb_php_32_a1b2c3d4e5f6...]`. The canvas shows that placeholder, not executed output.
2. Inside the editor, under **Detected PHP**, you see each block with its full source and a plain-language description (what it appears to output, what attributes it reads, what functions it calls). PHP inside an HTML tag or attribute is rejected outright.
3. The server then does a static review with PHP’s tokenizer and a syntax check. It blocks dynamic calls, shell/process execution, includes, filesystem and network access, persistent WordPress mutations, superglobals, database globals, loops, declarations, and related side effects. Examples that are blocked: `eval`, `exec`, `system`, `shell_exec`, `base64_decode` combined with eval-like patterns, `curl_exec`, `file_get_contents`, `file_put_contents`, `add_action`, `update_option`, `wp_insert_post`, etc. Unknown calls and obfuscation helpers get a strong warning but no registration control.
4. If the code passes, the editor shows a **Confirm and register shortcode** control that is disabled until you type an exact phrase. The phrase includes the page-scoped tag and 12 characters of the server’s review hash, for example `REGISTER ctb_php_32_a126e306689b3d3f a635c8151868`.
5. Registration and review share a page-scoped REST route that requires: you can edit the owning page, you have `manage_options` and `unfiltered_html` (and on multisite, you are a super admin), and site constants `DISALLOW_FILE_EDIT` / `DISALLOW_FILE_MODS` are not set. The storage layer repeats those checks independently of REST.
6. On confirmation the server repeats tokenization, scanning, and hash verification, stores the source in a non-autoloaded private option with owner, hash, confirming user, and timestamp, and returns HTTP 201. A changed hash, wrong phrase, or changed source returns HTTP 409/422 and leaves prior state unchanged.
7. Only the current publicly viewable Code to Block page’s tags are temporarily added to WordPress. The renderer expands exact bare tags from text nodes on that singular page. The same tag on any other page, in attributes, or on drafts renders as literal text.
8. At first invocation, the reviewed body is compiled via a permission-restricted temporary file outside `ABSPATH`, the document root, and uploads. The file is cleared and deleted immediately after compilation. No `eval` and no persistent generated PHP file is used. Runtime rescanning and the stored hash fail closed on tampering, and output buffering contains direct output and exceptions.
9. Saving a tree retires page-owned registrations no longer referenced; permanent deletion of the page removes all of its registrations. Registry mutations use an option lock to avoid lost concurrent writes.

**Permissions in short:** Save the WordPress post first, then review, then explicitly type the phrase. Anonymous, non-admin, or multisite non-super-admin attempts get HTTP 401/403. The feature is unavailable when file editing is disallowed.

## 4. Forms — one visual builder, two destinations (freely choose)

A form is a `form` container block that holds `form_field` sub-blocks (text, email, tel, url, number, textarea, select, checkbox, radio, file). Field styling uses the same style panel as every other block — no second styling system. Each field has label, name (field key), placeholder, required toggle, and for select/checkbox/radio a comma-separated options list. File fields are placeholder (no `move_uploaded_file` yet).

* **Building:** `Forms — native or external` panel → `Insert Contact Form after selection` creates a form with Name/Email/Message fields. When a `form` is selected, the panel shows Submission Handling (`native` vs `external`), Email To (for native, blank = `admin_email`), External Shortcode (for external), and Add Field buttons (7 types). When a `form_field` is selected, edit its type/label/name/placeholder/required/options. Drag, responsive overrides, and content slots work the same as other blocks.

* **Submission Handling = Native (lightweight engine):** On submit, `assets/runtime.js` intercepts `form.ctb-form` submit, does quick required/email client check for immediate feedback, then `fetch` `POST /code-to-block/v1/forms/{post_id}/submit` with `FormData` (`_ctb_form_id`, `_ctb_timestamp`, `_ctb_honeypot_name` + honeypot field `_ctb_hp_*` hidden via `position:absolute;left:-9999px`). **Server-side is the source of truth** — client is decoration: honeypot (silent fake success so bot doesn't learn), minimum fill 2s (`_ctb_timestamp` vs `time()`), rate limit 1 per IP per 30s + 5 rejections per IP per 30s, all logged to `wp_code_to_block_submission_logs`; validation (required, email format, url, number) is server-enforced (bypass via devtools still fails), storage to `wp_code_to_block_submissions` (`post_id`, `form_id`, `data` JSON, `ip`, `user_agent`, `created_at`, `status` `new|read|spam`), `wp_mail` to Email To with `New form submission from {page}` and data + IP + ID, admin submenu `Code to Block → Submissions` lists 100 recent submissions + 50 rejections with Read/Spam/Delete. Try to bypass honeypot/time/rate via devtools — server still rejects and logs.

* **Submission Handling = External Plugin:** Set to `external` and enter a shortcode from an installed form plugin. The frontend renderer outputs `do_shortcode` only for whitelisted shortcodes (`contact-form-7|wpforms|formidable|gravityform|ninja_form`); other shortcodes show as safe note `External form: [shortcode]`. This is honest about per-plugin depth — some plugins expose deep field mapping, some only shortcode embed. No second form-building UI — same visual blocks, swappable destination.

* **Parity for forms:** After every save, `Code_To_Block_Parity::check` also verifies forms: empty form (no `form_field`) → `Form has no fields`, required field missing name → `Required field is missing a name` (both `form` context). This is the same auto-after-save surface as style/commerce/mobile/focus/structural, not a separate check.

## 5. Starter Widget Library — 8 pre-built, no second architecture

`Widget Library — 8 pre-built` panel → `Insert after selection` for: Pricing Table, Testimonial Card, Icon Box, Countdown Timer, Stats/Counter, Team Member Card, FAQ Accordion, Image Gallery Grid. Each is a static arrangement of existing blocks (`container`/`text`/`image`/`button`) with `is_content_slot` slots already labeled (e.g. Plan Name, Price, Feature 1, Avatar Image, Quote), built on the existing reusable-components system (`insertWidget` clones with fresh IDs + 1,000/50/2 MB guards via `commitDocument`). They render, re-style, and content-slot-edit exactly like any user-saved component — no special-cased behavior, no second component system (per guardrail since File 9). Try three widgets via content-mode and full editor.

## 6. SEO — generate from live blocks, not hand-typed

* **Auto JSON-LD** at render time from live tree `includes/class-code-to-block-seo.php:14`: `Product` from `woocommerce_product`/`woocommerce_product_grid`/`is_dynamic wc_product_*` via `wc_get_product()` same call as HTML, `LocalBusiness` from content slots labeled `address`/`phone`/`hours`, `WebPage` from document name + permalink, output as `<script type="application/ld+json">` `@graph` via `code_to_block_output_seo_head` `wp_head` 5. Because JSON-LD and HTML pull from the same live `wc_get_product` at the same instant, there is no separate stale cache — drift is structurally impossible (hash-CSS invalidation from File 6 + parity commerce cover the drift category). Validate via validator.schema.org / Rich Results Test.

* **Meta via content-mode:** Document-level `seo` (title, description, canonical, og_title, og_description, og_image) is sanitized 0–1000 chars (`javascript:` rejected for URLs) and stored additive in the same document JSON. Edit it in dedicated editor `SEO` panel (title 60, description 160 counters + help) **and** in content-mode `Edit Content` SEO section above slots — same simple view as other content, not a separate unfamiliar SEO panel. Both use `setSeoField` via `commitDocument`.

* **Drift guard + mobile parity:** Parity `visit_mobile_content` flags `This content is hidden on mobile and won't be seen by Google's primary index` when a schema-relevant block (Product, LocalBusiness slot, heading) has `display:none` in `responsive_overrides.mobile` (or inherits base hide). This is distinct from cosmetic hide and targets mobile-first indexing.

## 7. Accessibility — architecture first, checker as safety net

Architecture first, checker second — never "compliant/compliance." Directly references January 2025 FTC $1M accessiBe settlement; all copy uses “helps identify common issues” + disclaimer “Automated checks catch many common issues but cannot replace testing with real assistive technology and real users.”

* **By default:** Skip link `<a class="ctb-skip-link" href="#ctb-main-content">Skip to content</a>` is structural in `templates/singular-ctb-page.php:21` (hidden until `:focus`, targets `#ctb-main-content` `tabindex="-1"`). Keyboard operability for actions is mandatory: `Enter`/`Space` as click, `Escape` closes `toggle-visibility` and returns focus, `ArrowDown`/`ArrowUp` cycles focus within open target, focus moves into opened target's first focusable and returns on close (`assets/runtime.js:64`). Blocks with actions get `tabindex="0"`+`role="button"` if not natively focusable plus `aria-expanded`/`aria-haspopup` (`includes/class-code-to-block-renderer.php:208`). Focus indicator is protected: global `focus-visible` outline `#6558d3` (`includes/class-code-to-block-renderer.php:59`) — removing `outline:none` without replacement triggers parity `visit_focus_indicators` + checker warning.
* **Icons:** Decorative (`alt=""`+`aria-hidden="true"`) silent; functional icon-only buttons must have `aria-label` describing function, not appearance — enforced via checker `checkAltText` (flag missing alt unless explicit `aria-hidden`), not auto-guessed. No CSS pseudo-element-only icons.
* **Checker:** `Accessibility — helps identify common issues` panel `src/index.js:1436` `AccessibilityPanel` runs `src/accessibility.mjs:14` `runAccessibilityChecks` live on document change for 5 humane-judgment issues: images without alt, contrast <4.5:1 via luminance (hex/rgb/named, solid only), vague link text (`click here|read more|learn more|more|here|link`), skipped heading levels + missing H1, plus focus removal. Each links to `block_id` via `selectBlock` and explains `why` in plain language.

## 8. Right-click context menu + drag reliability + panel modes

* **Context menu — 4 zones, distinct:** Right-click `WIDGET` (leaf text/image/button) → Edit/Duplicate/Copy/Paste/Delete/Copy Styles/Paste Styles/Save as Reusable Component; `CONTAINER` → Edit/Duplicate/Copy/Paste/Delete/Add Inner Container/Convert Layout Mode (flex↔grid↔block)/Copy Styles/Paste Styles/Save as Component; `SLOT` → same as widget + Edit Slot Label; `EMPTY` canvas → Paste/Add Block/Page Settings. All call existing store (`duplicateBlock`/`deleteBlock`/`addInnerContainer`/`convertLayoutMode` `src/index.js:561` with ID remap + `commitDocument`, copy/paste block via internal `clipboardBlock`, copy/paste styles via `updateBlockMappedStyles`/`updateBlockCustomCss`, Save as Component via `saveSelectedAsComponent` prompt). `BlockContent` `onContextMenu` `src/index.js:1119` + canvas stage empty handler, `window click` closes, `Shift+F10`/`ContextMenu` key opens same menu for `selectedBlock` centered on `[data-ctb-block-id]` — equal keyboard access per File 8.
* **Drag on `dnd-kit` (`closestCenter`+`pointerWithin`)** not jQuery UI — does not inherit 12-year-old `jquery#3032` nested droppable bug. Parity `visit_structural` flags `<a>` wrapping `container` with nested children as `structural` warning. Canvas is the surface (no separate Navigator, so stress limited to canvas).
* **Panel modes — reuse, not second system:** `Simple` (default, 10 essential controls) vs `Advanced` (all 40+). `Simple` is default on first open and remembered per browser (`localStorage ctb-panel-mode`) across selection/reopen; content-mode is Simple by construction. Search filters by name and temporarily surfaces hidden Advanced controls (e.g. search `shadow` in Simple → Box Shadow). Switching modes never loses values — hidden Advanced values like `box-shadow` persist and return unchanged. `Raw Custom CSS` is Advanced (or search `raw|css|custom` to surface). This reuses File 9's centralized `isMappedControlVisible` (`src/custom-css.mjs:17` triple condition `display`+`panelMode`+`search` with `tier`), not a second visibility system.

## 9. What this does not do yet (honest boundaries)

* **Not a full CSS editor.** `text-stroke`, `object-fit` (Image Size), `line-height`, `letter-spacing`, `text-transform` remain fallback not mapped; `background` multi-layer as single syntax not multi-field; `calc()` not specially edited; no global stylesheet editing. Searchable control panel + widget IDE explicitly out-of-scope per File 9.
* **Not a visual cascade inspector.** No selector list, no losing rules, no computed-style view. Use Explain CSS for mapped-vs-fallback transparency and browser DevTools for full cascade work.
* **Not a generic JS runtime.** Only narrow click patterns become executable actions. All other scripts are preserved verbatim for manual testing, never guessed. File upload handling in native forms is placeholder (no `move_uploaded_file`).
* **Not a PHP sandbox.** Static review reduces obvious risk; it is not a sandbox, not taint tracking, and not a guarantee. Only administrator-confirmed shortcodes run, only on their owning singular page.
* **Not an Elementor/Divi importer.** Import from Elementor/Divi, full Theme Builder equivalent, version history/rollback, and white-label mode are intentionally deferred as Tier 2. They remain out of scope for this launch.
* **Starter templates are starters, not a theme.** Four templates (hero, pricing, testimonial, footer) + 8 widgets insert as editable blocks with slots. They are not linked; editing the template source does not update already-inserted copies. They fit the same 1000/50/2MB budgets and use regenerated IDs to avoid collisions.
* **Responsive is sparse and explicit.** You set values per breakpoint. Unset fields inherit. There is no automatic responsive generation.
* **WooCommerce custom fields via builder:** Variation editing via builder is `is_dynamic` bindings only; full custom-fields UI (attributes/per-variation stock) still via WooCommerce admin, not builder. `form` external depth limited to shortcode whitelist honesty.
* **No list/repeatable slots.** Single-value slots only (one text/image/link per slot) per `is_content_slot`. Variable-count service lists / testimonial grids where number of items differs per client remain deferred.
* **Slots inside saved-component canonical docs** traversed only via page tree `src/content-mode.js:34` — documented defer per File 4.

---

If you hit one of these boundaries, the raw fallback, the unverified script box, or the PHP inert placeholder is the intended path — not a bug. Save your work, keep the source visible, and test the result on a real public URL at desktop, tablet (768px), and mobile (390px) with a real browser and, for accessibility, a real assistive technology.
