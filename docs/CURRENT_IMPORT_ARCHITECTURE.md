# Current Import Architecture

This inventory began as the Phase A safety gate for the universal importer and
now records the implemented boundary after the first architecture pass.

## End-to-end call graph

```text
Editor import dialog (`src/index.js`)
  -> prepareImportedCode(source)
  -> ImportCodeService.analyze(source, capabilityPolicy)
     -> parseBlockDocument(source, css, shortcodePrefix) (`src/parser.js`)
        -> createCodeImportSession()
        -> detectImportedSource() (`src/importer/detection/`)
        -> normalizeImportedSource() (`src/importer/normalization/`)
        -> extractPhpSnippets() (`src/php-snippets.mjs`)
        -> parseImportedHtml() and decomposeImportedDocument()
           (`src/importer/html/`)
        -> extract page metadata, styles, scripts, and URL references
        -> PostCSS parse/safe recovery and selector scoping
        -> registry-driven recursive DOM-to-block conversion
           with localized fallbacks (`src/importer/conversion/`)
        -> assemble canonical candidate, review, security, and diagnostics
     -> store immutable analyzed session (no editor-state mutation)
  -> review UI (no editor-state mutation)
  -> commitImportedCode(result)
     -> ImportCodeService.commit(sessionId)
        -> normalizeImportedStyles()
        -> commitDocument() (`src/history.mjs`), one undo transaction
  -> React block renderer
  -> CenterCanvas (`src/components/CenterCanvas.js`)
     -> sandboxed iframe document (`src/canvas-isolation.mjs`)
     -> React portal into the controlled iframe mount point
  -> saveDocument()
     -> POST /code-to-block/v1/pages/{post}/block-tree
     -> Code_To_Block_REST_Controller
     -> Code_To_Block_Schema::sanitize_document()
     -> _ctb_block_tree registered post meta
  -> Code_To_Block_Renderer
     -> saved block HTML
     -> generated scoped CSS plus preserved imported CSS
     -> approved imported scripts in Preview/Publish only
```

## Responsibility inventory

| Current file / function                  | Current responsibility                                                                   | Architecture issue                                             | Status          | Boundary                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| `src/index.js::prepareImportedCode`      | Delegates analysis and capability policy to the service, then populates review UI        | UI wrapper remains large                                       | Implemented     | `ImportCodeService.analyze()`                               |
| `src/index.js` import-dialog detection   | Reads counts and capabilities from the analyzed session                                  | None in the import path                                        | Implemented     | Session detection/assets                                    |
| `src/index.js::commitImportedCode`       | Delegates one transactional editor commit                                                | UI wrapper remains                                             | Implemented     | `ImportCodeService.commit()` callback                       |
| `src/parser.js::detectImportedCode`      | Compatibility facade for pure source detection                                           | Facade retained for callers                                    | Implemented     | `importer/detection/`                                       |
| `src/parser.js::normalizeImportedCode`   | Compatibility facade for context-sensitive normalization                                 | Facade retained for callers                                    | Implemented     | `importer/normalization/`                                   |
| `src/parser.js::createCodeImportSession` | CSS/PHP/conversion orchestration behind a transactional service                          | Stylesheet matching bridge remains                             | Partially split | `importer/html`, `conversion`, `css/`, `assets/`           |
| `BlockAdapterRegistry`                   | Native, generic, and localized fallback selection                                        | Adapter coverage can grow without changing traversal           | Implemented     | `src/importer/conversion/`                                  |
| `importer/css/scope-imported-css.mjs`    | Safe PostCSS parse, selector isolation, stylesheet inventory, scope class management     | None                                                           | Implemented     | `importer/css/`                                             |
| `importer/assets/collect-import-assets`   | Script extraction, standalone scripts, URL reference analysis, duplicate ID diagnostics  | None                                                           | Implemented     | `importer/assets/`                                          |
| `src/html-policy.mjs`                    | Client attribute/tag/URL safety                                                          | Correct reusable policy; custom-element handling is incomplete | Keep/generalize | `importer/security/` facade                                 |
| `src/php-snippets.mjs`                   | Extracts PHP to inert placeholders; package retains restricted server-code review assets | Registration is intentionally separate                         | Implemented     | `PhpImportPolicy`                                           |
| `src/canvas-isolation.mjs`               | Inert editor iframe, CSP, message whitelist, and safe page-root application              | Full runtime bridge is future work                             | Implemented     | `ImportedDocumentRuntime` / `CanvasBridge`                  |
| `src/components/CenterCanvas.js`         | Hosts iframe, applies imported page-root metadata, and portals editor DOM                | None for current editor isolation                              | Implemented     | Runtime page-root application                               |
| `src/index.js::buildPreviewStyles`       | Compiles imported and builder CSS for editor                                             | Entry point owns render-package compilation                    | Move later      | `buildCanvasRuntimePackage()`                               |
| `src/history.mjs::commitDocument`        | One-step transactional history                                                           | Correct transaction boundary                                   | Keep            | Store adapter used by service commit                        |
| `src/index.js::saveDocument`             | REST save and stale-save handling                                                        | Correct application orchestration                              | Keep            | Document repository boundary                                |
| `class-code-to-block-schema.php`         | Server authority for blocks/imported assets/source/server code/security                  | Correct authority                                              | Implemented     | Canonical imported package validation                       |
| `class-code-to-block-renderer.php`       | Frontend HTML/CSS/scripts                                                                | Correct output boundary; consumes compatibility schema         | Keep            | Frontend runtime                                            |
| `code-to-block.php` meta registration    | Canonical post-meta persistence and revisions                                            | Correct shared storage                                         | Keep            | WordPress repository                                        |

## Existing invariants to preserve

-   The editable canvas sandbox omits `allow-scripts` and carries a CSP with
    `script-src 'none'`, `form-action 'none'`, and `connect-src 'none'`.
-   Imported CSS is emitted only after selector scoping; unscoped source remains
    review data.
-   Imported scripts never enter the editor canvas. Capability-approved scripts
    can run only in WordPress Preview/Publish documents.
-   PHP is extracted without execution. Registration remains a separate,
    explicit, capability-gated server workflow.
-   Parsing builds a candidate result before any Zustand mutation.
-   Applying an import calls the store once and is undoable in one transaction.
-   WordPress schema validation is authoritative at every write boundary.
-   Existing schema v1/v2 documents remain loadable; schema v3 registry work is
    independent of this compatibility importer.

## Confirmed special cases

-   No Alex-Morgan-, `.hero`-, `.container`-, Bootstrap-, Tailwind-, Elementor-,
    or Divi-specific rule exists in the importer path.
-   The only class-based semantic conversion is the generic anchor-to-button
    heuristic for conventional `btn`/`button`/`cta` tokens. It is optional
    editability metadata, not a structural requirement.
-   Unknown custom elements are currently normalized to `div`; this is a known
    fidelity gap and is replaced by generic custom-element preservation in the
    universal conversion path.

## Implemented boundary and next extension

The first six importer architecture steps are complete: pure detection and
normalization, HTML document decomposition, transactional session analysis and
commit, registry-driven recursive conversion, localized fallbacks, service-led
UI integration, canonical source/server-code/compatibility/security
persistence, PostCSS selector scoping and stylesheet inventory
(`importer/css/`), and asset/reference/script collection (`importer/assets/`).

The stylesheet matching bridge (`stylesheetMatches`) remains in `src/parser.js`
because it couples CSS AST traversal with DOM element matching. It is the next
candidate for extraction once the DOM-analysis boundary is clearer.

The next safe extension is to continue A3 extraction: move the Zustand store,
DnD adapters, preview CSS, inspector controls, diagnostics, forms, commerce,
widgets, motion/actions, and persistence orchestration out of `src/index.js`
as described in `docs/editor-domain-boundaries.md`.
