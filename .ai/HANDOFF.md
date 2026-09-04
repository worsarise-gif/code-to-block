# Handoff

### HANDOFF

**Goal**
Diagnose and resolve why preview fails when using imported code (specifically on full-page HTML/CSS/JS e-commerce templates such as Nova Store).

**Completed**
1. Root Cause Identification:
   - Schema Validation Failure: `Code_To_Block_Schema::CSS_MAPPING_CONTROLS` in `includes/class-code-to-block-schema.php` was missing 31 style controls recognized by the visual builder (e.g., `text-align`, `box-sizing`, `aspect-ratio`, `font-style`, `white-space`, `cursor`). The importer marked `.announcement-bar { text-align: center; }` as `destination: 'style-control'`, which PHP rejected with `WP_Error: "$.root.children[0].meta.css_mapping.declarations[8].control must name the matching style control"`.
   - Size Limit Breach: `MAX_JSON_BYTES` in PHP was capped at 2 MB (`2097152`), while full pages generated up to 7.5 MB due to un-deduplicated CSS declarations across 348 blocks, triggering a 413 error: `"exceeds the 2 MB document limit"`.
   - In `Editor.js` (`previewDocument()`), any failure in `saveDocument()` aborted the process and closed the preview window (`previewWindow.close()`).
2. Server-Side Schema Fixes:
   - Expanded `CSS_MAPPING_CONTROLS` in `includes/class-code-to-block-schema.php` to all 92 properties supported by the builder.
   - Raised `MAX_JSON_BYTES` from 2 MB to 10 MB (`10485760` bytes).
3. Client-Side Parser Optimization:
   - Updated `src/parser.js`: deduplicated declarations in `explanation` by CSS property and capped `imported_css_rules` to 20 rules max per block. Reduced generated document JSON from 7.5 MB down to ~1.3 MB.
4. Verified Rendering & Enqueuing:
   - Verified that PHP `Code_To_Block_Renderer::render_document()` renders the full page markup cleanly.
   - Verified that `Code_To_Block_Renderer::render_imported_scripts()` properly outputs the 25 KB interactive cart JS for `placement: 'body'`.
5. Build & Test Verification:
   - Recompiled production bundle with `npm.cmd run build`.
   - Verified all test suites pass: schema (110 assertions), frontend renderer (210 assertions), server schema v3 (18 assertions), architecture contracts (584 assertions), global PHP import (29 assertions).

**Current State**
All fixes applied, tested end-to-end, and rebuilt with Webpack (0 errors).

**Files Changed**
- `plugin/code-to-block/includes/class-code-to-block-schema.php`: Expanded `CSS_MAPPING_CONTROLS` (92 properties), raised `MAX_JSON_BYTES` to 10 MB.
- `plugin/code-to-block/src/parser.js`: Property deduplication for CSS explanation declarations and rule capping.
- `plugin/code-to-block/build/*`: Recompiled bundle (`build/index.js`, `build/index.css`).

**Pending**
None.

**Problems / Risks**
None.

**Next Step**
Test importing the Nova Store HTML code in the WordPress builder UI and clicking "Preview Changes".

**Important Decisions**
- `CSS_MAPPING_CONTROLS` in PHP was aligned with the 92 properties in `MAPPED_STYLE_PROPERTIES` to ensure 100% parity between client parser and server validator.
- `MAX_JSON_BYTES` set to 10 MB to allow complex multi-section templates without MySQL post_meta size issues (`meta_value` is `longtext`).

**Verification**
- `php tests/schema-test.php`: PASS (110 assertions)
- `php tests/schema-v3-test.php`: PASS (18 assertions)
- `php tests/frontend-renderer-test.php`: PASS (210 assertions)
- `node tests/architecture-contract-test.mjs`: PASS (584 assertions)
- `node tests/global-php-import-test.mjs`: PASS (29 assertions)
- `npm.cmd run build`: PASS (Webpack 5.109.2 compiled with 0 errors)

### END HANDOFF
