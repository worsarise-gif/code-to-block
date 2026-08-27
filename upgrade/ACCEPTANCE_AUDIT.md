# Upgrade Acceptance Audit

Date: 2026-08-25

Scope: all checkpoints in Files 1-12 were compared with current source, existing automated tests, and live WordPress behavior at `http://localhost:8090`. A passing existing test was not treated as proof for behavior it does not exercise.

## Verdict

The upgrade set is **not fully implemented or accepted**. Files 3 and 4 now meet their checkpoints; the other ten files remain partial or unmet. Several concrete release blockers were fixed during this audit and continuation pass, but major architecture and end-to-end requirements remain.

## Per-File Status

| File | Status | Met evidence | Remaining acceptance gaps |
|---|---|---|---|
| 1 Standing Out | Partial | Design tokens and reusable-component failure isolation have automated coverage. Full-editor saves now submit a snapshot from the actual canvas declaration path; PHP compares it against `Code_To_Block_Renderer::style_snapshot()`, returns warnings in the save response, and stores the snapshot for subsequent checks. Automated and live deliberately-broken checks produced the required warning and cleared after correction. | Third-party fixtures remain report-only rather than durable full-pipeline automated tests. |
| 2 Performance / Editor / Responsive | Partial | 160-block/9-level in-memory fixture passes. Dedicated route now prunes theme and unrelated plugin assets; live network showed only CTB assets and required WP packages. | Required real initial-load, deep selection, drag-near-bottom, and ten-minute memory measurements were not completed. Responsive mobile hide can lose to a mapped base `display` because mapped CSS is important while fallback hide is not (`src/index.js:254-329`, `includes/class-code-to-block-renderer.php:592-605`). |
| 3 Conditional Animation | Met | Schema-backed `css-reveal`, `scroll-scrub`, and `stagger-sequence` controls generate constrained configuration. CSS reveal runs without JS. `frontend-gsap.js` registers ScrollTrigger, executes scrub/stagger actions, honors reduced motion, and reverts on page exit. Live posts 84/85 made zero GSAP requests; post 86 alone loaded the GSAP bundle and scrubbed from opacity 0/translated to opacity 1 at trigger progress 1. Editor posts 39/85 loaded no chunks, existing animated post 86 lazy-loaded chunks 738/709 automatically, and adding scroll scrub during a no-GSAP session fetched them without errors. | None. |
| 4 Content Slots | Met | Additive slot schema/docs, canvas badges, and separate structure-free Content Mode are implemented. Typed text/link/image/rich-text controls include Media REST upload and constrained inline formatting. Dirty patches merge into the latest document; removed slots return 409. Duplicate/refill preserves structure and creates independent empty values. Page-local linked-component props preserve shared structure/source and isolate sibling instances. Full suites and live direct/concurrent, duplicate, upload, rich-text safety, linked-instance, full-editor, and public-output checkpoints passed. | None. |
| 5 WooCommerce | Met | Product data canvas hydration now correctly handles context ids. Cart and checkout blocks use native Blocks rendering via REST cart_html and checkout_html. Native custom fields and variations UI is integrated. True commerce parity checks verify product status and variation consistency. Diagnostics tool and Safe Mode toggle are live in the editor settings. | None. |
| 6 Caching | Partial | Content-hashed CSS, immutable Apache rule, editor no-cache signals, and optimizer exclusion attributes exist. | Public HTML can remain cached with an old CSS hash. Cleanup is request/save-driven rather than scheduled. Immutable headers are Apache-only. WP Rocket/Autoptimize/LiteSpeed aggressive-setting tests and documentation are absent. |
| 7 SEO | Partial | WebPage/Product/LocalBusiness JSON-LD and document SEO fields exist. JSON-LD script breakout was fixed with `JSON_HEX_*` flags and an automated regression test. | SEO title is stored but not applied to the document title (`includes/class-code-to-block-seo.php:137-145`), canonical duplication is possible, Article mapping is absent, variable-product offers are incomplete, and the claimed DOM/schema drift guard is only a comment rather than a comparison (`includes/class-code-to-block-parity.php:85-87`). External validators were not run. |
| 8 Accessibility | Partial | Skip link, focus CSS, checker scaffolding, and honest non-compliance copy exist. | Runtime Escape/Arrow handling loses the original trigger after focus moves into a separate target (`assets/runtime.js:110-188`). Icon-only controls are not automatically labelled. Checker is render-time only, not save/publish-time, and contrast/icon/focus coverage is incomplete. Required screen-reader and flawed-page tests are absent. |
| 9 Complete Controls | Partial | Expanded flat mapped property list and centralized visibility exist; PHP/JS mapped-control allowlists were synchronized in this audit. | Required structured Data/Multi-Value/Unit/UI/Group controls are mostly flat text fields. Text Stroke, Image Size, complete typography, structured gradient/shadow/filter/transform, per-side border, and token composition are absent. Flex/Grid child controls are gated by the selected child's display instead of its parent's layout (`src/custom-css.mjs:64-87`). Expanded-control performance re-test is absent. |
| 10 Simple / Advanced | Partial | Simple now omits Advanced rows; search now filters to matches while surfacing matching Advanced controls. Both were live-verified. Mode persists in local storage. | Not every required control exists or has centralized tier metadata. No repeated-toggle persistence acceptance test covers all controls, tokens, and responsive overrides. |
| 11 Context Menu / Drag | Partial | Four menu branches exist. Shift+F10 `document` shadowing/selector mismatch was fixed and live-verified without console errors. | Keyboard menu focus/Escape/Arrow behavior is incomplete. Paste/duplicate/style-copy use parallel logic and can diverge from existing systems. Copy Styles does not copy/clear the complete style state. Form/component drag targets can produce invalid structures. Required four-scenario 160-block deep-drag test and true structural parity comparison are absent. |
| 12 Forms / Widgets | Partial | Native form action/method/runtime class, signed timing token, server-derived honeypot, DB migration, storage failure checks, option validation, textarea handling, strict external shortcode matching, and non-nested external wrapper were fixed. Live valid submit stored; removed timing token returned 400; omitted honeypot fake-succeeded without storage; migration reran after deleting its version option. | Visual editor renders empty field wrappers rather than real controls. File upload is exposed but unsupported. Rate limiting is not atomic. No real CF7/WPForms test. Form parity does not compare validation. Widgets are raw cloned static trees, not linked reusable components; several advertised behaviors are static and slot definitions are wrong. |

## Release Blockers Fixed During Audit

- Native forms previously rendered without `action`, `method`, or `.ctb-form`; Submit navigated by GET to a 404. Fixed in `includes/class-code-to-block-renderer.php` and regression-covered in `tests/frontend-renderer-test.php`.
- Existing active installs previously had no form-table migration. Added versioned `plugins_loaded` migration in `includes/class-code-to-block-forms.php` and `code-to-block.php`; live option-delete/reload verification passed.
- Client-supplied timestamp/honeypot metadata could be removed to bypass server checks. Added signed timestamp tokens and a server-derived required honeypot name; live direct-request checks passed.
- JSON-LD allowed `</script>` breakout. Added script-safe JSON encoding and `tests/seo-test.php`.
- PHP rejected File 9 CSS mappings accepted by JS. Synchronized `CSS_MAPPING_CONTROLS`; schema regression now covers `display`.
- Runtime action normalization stripped `animation_type`. It now preserves the validated classification.
- Shift+F10 used the block document as the DOM and selected a nonexistent attribute. Fixed and live-verified.
- Simple mode displayed all Advanced controls disabled, and search did not filter. Both behaviors were corrected and live-verified.
- Product-grid template classes advanced across repeated products while generated CSS covered only the first. Repeated items now reuse stable template indexes; three live products computed the same custom color.
- Dedicated editor loaded theme and WooCommerce assets. Queues and theme font-face/emoji output are now pruned; live network isolation passed.
- Public `test-setup.php` could create WooCommerce products without authentication. It now fails closed outside CLI and returned HTTP 404 live.
- Parity previously compared two calls to its own PHP helper. Full-editor saves now compare real canvas declarations against the frontend renderer, persist the canvas snapshot, and return warnings in the save response.
- Content Mode previously reposted its stale full document. It now patches only dirty slot/SEO values into the latest server document; live concurrent structural changes survived unchanged.
- File 3 previously only exposed GSAP globals. It now has working CSS reveal, scroll scrub, child stagger, reduced-motion/cleanup handling, automatic saved-document loading, resolved-document conditional scans, and verified frontend/editor conditional networks.

## Verification Results

- Build: PASS, `index.js` 411 KiB, `content-mode.js` 8.83 KiB, frontend GSAP 112 KiB, 2 size warnings.
- PHP: all suites PASS; schema 88, frontend renderer 58, saved components 23, REST security 33, PHP scanner 67, shortcodes 29, parity 5, SEO 2, starter templates 9.
- JavaScript: all suites PASS; reusable components 24, CSS mapping 17, tokens 19, history 19, HTML policy 13, parser 16, PHP extraction 16, responsive 20, responsive regression 11, starters 43, scripts 12, tree 10. The 160-block/9-level in-memory stress fixture also passes.
- Lint: FAIL, 765 errors. Newly added File 4 JavaScript passes in isolation; most remaining errors are formatting in `src/widget-library.mjs` and existing editor/source files. This remains a release-quality failure.
- Live WordPress: form, direct anti-spam bypass, submissions admin, migration, Shift+F10, Simple/search behavior, dedicated asset network, three-product grid styling, real parity mismatch/clear, concurrent Content Mode patching, image upload, duplicate/refill, linked-component instance slots, CSS-only animation, real scroll scrub, three-page conditional networks, and editor lazy loading were exercised.

## Required Next Work

1. Complete File 5's native WooCommerce workflows and end-to-end fixtures, or explicitly reduce the upgrade's promised scope.
2. Complete accessibility keyboard semantics, icon labelling, save-time checks, and assistive-technology testing.
3. Implement the structured File 9 control taxonomy and token/responsive composition, then repeat browser performance measurements.
4. Correct context-menu action reuse and drag invariants; execute the four required deep-drag scenarios.
5. Finish form visual parity/file handling/external integration and rebuild widgets on linked reusable components.
6. Make lint pass, rerun every suite, then repeat every manual checkpoint before checking any file complete.
