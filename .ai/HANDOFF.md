# Handoff

### HANDOFF

**Goal**
Implement the universal HTML/CSS/JavaScript/PHP importer described in
`upgrades/code to block.md` without regressing the in-progress builder-controls
overhaul or weakening the editor/WordPress security boundaries.

**Completed**
The first importer architecture pass is implemented. The current import path is
documented in `docs/CURRENT_IMPORT_ARCHITECTURE.md`. Detection, transport-aware
normalization, HTML5 document decomposition, diagnostics, transactional session
analysis/commit, and block adapter selection now have explicit modules under
`src/importer/`. The parser preserves full-document metadata, source snapshots,
head assets, custom elements, style ordering/media, script policy, restricted
PHP assets, compatibility/security summaries, URL references, and localized
fallbacks. Per-node conversion failures preserve source and do not abort
siblings. The editor consumes `ImportCodeService`, performs no source-detection
regex duplication, and commits once through the existing history boundary.
Imported html/body identity is applied only inside the sandboxed iframe and
isolated WordPress frontend document. The PHP schema and renderer round-trip the
new canonical import package while keeping scripts disabled in the editor and
PHP registration separate.

The pre-existing builder-controls A1/A2 work and A3 increment 1 also remain
present: pure tree queries and store composition helpers are extracted and
covered by focused tests. A3 overall is still active.

**Current State**
The production build succeeds. The importer-specific source files pass scoped
WordPress lint. Focused importer, schema, frontend-renderer, isolation,
persistence, responsive, architecture, history, tree, store, script, shortcode,
and schema-v3 tests pass. There are only the two existing webpack bundle-size
warnings. A browser smoke test was not run because no local WordPress endpoint
was started during this task.

**Files Changed**

-   `docs/CURRENT_IMPORT_ARCHITECTURE.md`: current call graph, responsibilities,
    invariants, and next extraction boundary.
-   `plugin/code-to-block/src/importer/`: detection, normalization, HTML document
    parsing, diagnostics, adapter registry, and transactional service modules.
-   `plugin/code-to-block/src/parser.js`: service-compatible orchestration,
    decomposed document parsing, generic/custom conversion, localized fallbacks,
    and canonical import assets.
-   `plugin/code-to-block/src/index.js`: service-led analyze/review/commit flow.
-   `plugin/code-to-block/src/canvas-isolation.mjs` and
    `src/components/CenterCanvas.js`: bridge validation and safe imported page-root
    application in the isolated editor document.
-   `plugin/code-to-block/src/html-policy.mjs`: expanded inert generic/custom HTML
    support and URL/attribute filtering.
-   `plugin/code-to-block/includes/class-code-to-block-schema.php`: canonical
    imported source, server code, fallbacks, compatibility, security, page-root,
    stylesheet, script-policy, and fidelity metadata validation.
-   `plugin/code-to-block/includes/class-code-to-block-renderer.php` and
    `templates/singular-ctb-page.php`: sanitized html/body attributes in the
    isolated frontend page.
-   `plugin/code-to-block/tests/`: new detection/normalization and service tests,
    plus expanded parser, isolation, HTML-policy, schema, and renderer coverage.
-   `plugin/code-to-block/package.json`: focused importer test scripts.
-   `plugin/code-to-block/build/index.js` and `build/index.asset.php`: regenerated
    production bundle.

**Pending**

-   Run authenticated browser smoke coverage against a local WordPress instance:
    import a full document, inspect review diagnostics, apply once, undo once,
    save/reload, Preview, and Publish.
-   Next importer architecture slice: move the existing PostCSS scoping and asset
    collectors from `src/parser.js` into `src/importer/css/` and
    `src/importer/assets/` with byte/snapshot parity tests.
-   Continue builder-controls A3 separately with the tree mutation/DnD adapter
    extraction described in `docs/editor-domain-boundaries.md`.

**Problems / Risks**

-   MemPalace and Obsidian access were not available in this Codex session; this
    repository handoff is the available continuity record.
-   Preserve unrelated dirty/untracked work, including the upgrade-plan deletions,
    design logs, A1/A2/A3 files, Playwright log, and Babel cache entries.
-   Imported scripts remain disabled in editor mode. PHP remains inert/restricted
    until an explicit capability-gated registration workflow.
-   `src/parser.js` still owns PostCSS and asset collection; do not rewrite these
    while extracting them because their current behavior is covered and passing.
-   Repository-wide lint was already red before this work. Use scoped lint for
    importer files and do not fold unrelated `src/index.js` cleanup into this task.

**Next Step**
Start the local WordPress test environment, import
`plugin/code-to-block/tests/fixtures/comprehensive_import.html` through the UI,
then verify apply/undo/save/reload/Preview/Publish before extending the importer.

**Important Decisions**

-   Detection is advisory; DOMParser/PostCSS remain authoritative.
-   Analysis never mutates editor state. Commit requires a current analyzed
    session and calls the supplied store/history boundary exactly once.
-   One unsupported node becomes one localized fallback; siblings continue.
-   Inert standard/custom elements preserve their real tag and safe attributes.
    Active embedded-object content is not promoted to a generic executable node.
-   Source, compatibility, security, and restricted server code are persisted as
    canonical review data, while editor execution remains prohibited.
-   Existing schema versions and the builder-controls contracts remain compatible.

**Verification**

-   PASS: importer detection 24, service 11, HTML policy 22, canvas isolation 25,
    parser/comprehensive fixture, parser classification 20, CSS mapping 17, React
    attributes, responsive styles 25, import boundaries 4, persistence 9, PHP
    extraction 18, scripts 12, schema-v3 20, architecture contracts 584, history
    19, tree 25, store commands 28, shortcodes 29.
-   PASS: PHP schema 110 and frontend renderer 96 assertions.
-   PASS: PHP syntax for schema, renderer, and singular template.
-   PASS: scoped `wp-scripts lint-js` for all new/touched importer modules and
    focused tests.
-   PASS: `git diff --check` (line-ending notices only) and production build.
-   BUILD NOTE: existing index/entrypoint asset-size warnings remain.
-   NOT RUN: authenticated WordPress browser smoke.

### END HANDOFF
