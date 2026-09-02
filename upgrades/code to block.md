# Code-to-Block Universal Importer Architecture
## Production Implementation Plan — Generalized HTML/CSS/JavaScript/PHP-Aware Parser

Repository: `worsarise-gif/code-to-block`

## 1. Primary Objective

The current importer must stop behaving as a parser for a particular HTML shape and become a **document ingestion system**.

The target architecture is:

```text
Input
  ↓
Source Detection
  ↓
Transport Normalization
  ↓
Language/Document Classification
  ↓
HTML5 Parsing
  ↓
Document Decomposition
  ├─ Metadata
  ├─ Renderable DOM
  ├─ Stylesheets
  ├─ Scripts
  ├─ External Dependencies
  └─ Server-side Code
  ↓
DOM Analysis
  ↓
Recursive Block Conversion
  ↓
Fallback Preservation
  ↓
Security Analysis
  ↓
Isolated Runtime Package
  ↓
Editor Canvas
  ↓
Serialization
  ↓
WordPress Save / Preview / Publish
  ↓
Frontend Runtime
```

The defining rule is:

> **The importer must never decide whether the input matches a supported template. It must determine what the input contains, convert the portions it understands, preserve the portions it cannot safely convert, and continue.**

The existing Alex Morgan portfolio must therefore become only **one regression fixture**. It must never be used to define the parser hierarchy, required selectors, expected class names, root nodes, or conversion rules.

A previous Code-to-Block parser plan already established several correct principles: normalization before parsing, real HTML/CSS parsers rather than structural regex, preservation of unsupported CSS, no import-time JavaScript execution, transactional imports, and localized fallback nodes. fileciteturn3file0L14-L25 Those principles should now be generalized beyond the supplied portfolio.

---

# 2. Immediate Root-Cause Direction

Before implementing additional element support, the coding agent must assume the current problem is **architectural until proven otherwise**.

The symptom:

```text
HTML format A → works
HTML format B → partially works
HTML format C → errors
HTML format D → renders outside canvas
```

normally means one or more of these responsibilities are improperly coupled:

```text
Input recognition
HTML parsing
DOM selection
CSS extraction
script extraction
block conversion
sanitization
canvas rendering
editor state mutation
serialization
```

If a single function receives a string, searches for expected elements/classes, converts them immediately, injects CSS, and updates the editor store, that function is doing too much.

The target design must have **no direct path** like:

```text
textarea source
   → DOMParser
   → document.body.children
   → convertElement()
   → setBlocks()
   → inject <style>
```

without intermediate normalization, classification, document decomposition, security analysis, diagnostics, and a transactional candidate state.

---

# 3. Phase 0 — Repository Architecture Inventory

Before modifying behavior, perform a repository-wide parser dependency audit.

This is not optional.

Search every JavaScript/TypeScript/PHP file for:

```text
DOMParser
parseFromString
innerHTML
outerHTML
insertAdjacentHTML
dangerouslySetInnerHTML
document.body
document.head
document.documentElement
document.querySelector
document.querySelectorAll
getElementById
createElement("style")
appendChild(style
<style
<script
wp_kses
wp_kses_post
sanitize_
unfiltered_html
post_content
post_meta
register_post_meta
register_meta
wp_update_post
wp_insert_post
REST
X-WP-Nonce
iframe
srcDoc
postMessage
ShadowRoot
attachShadow
cssText
style.innerHTML
querySelector("body")
querySelector("head")
firstChild
firstElementChild
children[0]
childNodes[0]
```

Also search for suspicious HTML-specific assumptions:

```text
.hero
.container
.section
.site-header
main
header
footer
body >
:first-child
nth-child
specific class names from testing fixtures
```

The agent must generate an internal table:

```text
Current file
Current function/class
Current responsibility
Architecture problem
Keep
Refactor
Remove
Move
Replacement module
```

Special attention must be given to code that:

- parses HTML with regex;
- extracts `<style>` or `<script>` using string slicing;
- assumes `<body>` exists;
- assumes only one root node;
- assumes a section/container hierarchy;
- maps class names to builder modules;
- directly inserts imported DOM into the editor document;
- injects imported styles into the WordPress admin document;
- uses the global `document` from importer/rendering code;
- executes scripts simply because they existed in imported HTML;
- runs sanitization before structural analysis and destroys information;
- strips unsupported elements instead of preserving them;
- conflates internal builder IDs with imported HTML IDs;
- parses and commits into editor state in the same call;
- relies on `firstElementChild`;
- uses fixed DOM depths;
- rewrites arbitrary HTML through string replacements.

### Phase 0 acceptance gate

No parser implementation work begins until there is a complete call graph for:

```text
Import dialog
→ importer entry point
→ parser
→ CSS processing
→ block creation
→ store mutation
→ canvas renderer
→ save serializer
→ PHP persistence
→ frontend renderer
```

This is what prevents another isolated patch.

---

# 4. Target Module Structure

Adapt directories to the repository's existing organization, but create these responsibility boundaries.

```text
importer/
  ImportCodeService
  ImportSession
  ImportDiagnosticsCollector

  detection/
    detectSourceKind
    detectTransportEncoding
    detectDocumentShape
    detectLanguageSegments

  normalization/
    normalizeImportedSource
    normalizeTransportEscapes
    normalizeDocumentEncoding

  html/
    HtmlDocumentParser
    HtmlDocumentAnalyzer
    HtmlDocumentDecomposer
    HtmlAttributeNormalizer

  css/
    CssImportParser
    CssAssetExtractor
    CssSelectorIndex
    CssCascadeAnalyzer
    CssControlAdapterRegistry
    CssVariableImporter
    CssResponsiveMapper

  scripts/
    ScriptAssetExtractor
    ScriptSecurityAnalyzer
    ImportedScriptRegistry
    ImportedScriptRuntime

  assets/
    ImportAssetRegistry
    AssetUrlResolver
    ExternalDependencyRegistry

  conversion/
    DomToBlockConverter
    BlockAdapterRegistry
    GenericElementAdapter
    FallbackBlockFactory

  security/
    ImportSecurityPolicy
    UrlSecurityPolicy
    HtmlSecurityAnalyzer
    ScriptExecutionPolicy
    PhpImportPolicy

  runtime/
    ImportedDocumentRuntime
    CanvasBridge
    PreviewRuntime

  serialization/
    ImportedDocumentSerializer
    ImportSourceSnapshot

  testing/
    fixtures/
```

Do **not** allow the React/Vue import modal to contain parser implementation.

The UI should call approximately:

```ts
const analysis = await importCodeService.analyze(source, context);

const result = await importCodeService.commit(
  analysis.sessionId,
  importOptions
);
```

The importer must remain independently testable without mounting the editor UI.

---

# 5. Canonical Import Session

Introduce one canonical object that survives the complete pipeline.

```ts
interface CodeImportSession {
  id: string;
  schemaVersion: number;

  source: {
    raw: string;
    normalized: string;
    hash: string;
    encoding: "raw" | "escaped" | "mixed";
  };

  detection: ImportDetectionResult;

  document: ImportedDocumentModel | null;

  dom: ImportedDomModel | null;

  assets: ImportAssetRegistry;

  stylesheets: ImportedStylesheet[];

  scripts: ImportedScriptAsset[];

  serverCode: ImportedServerCodeAsset[];

  blocks: BuilderNode[];

  fallbackNodes: ImportedFallbackNode[];

  diagnostics: ImportDiagnostic[];

  compatibility: ImportCompatibilitySummary;

  security: ImportSecuritySummary;

  sourceMap: ImportSourceMap;

  state: "analyzed" | "validated" | "committed" | "failed";
}
```

The previous plan already correctly called for preserving raw and normalized source separately. fileciteturn3file0L69-L111

Extend that idea much further.

The original source must be recoverable even after conversion.

---

# 6. Input Detection Layer

Create:

```ts
detectImportedSource(source: string): ImportDetectionResult
```

It must classify capabilities rather than choose one exclusive parser mode.

For example:

```ts
interface ImportDetectionResult {
  containsHtml: boolean;
  containsCss: boolean;
  containsJavaScript: boolean;
  containsPhp: boolean;

  documentShape:
    | "full-document"
    | "body-document"
    | "headless-document"
    | "fragment"
    | "single-node"
    | "mixed-source"
    | "unknown";

  hasDoctype: boolean;
  hasHtmlElement: boolean;
  hasHeadElement: boolean;
  hasBodyElement: boolean;

  styleBlocks: number;
  scriptBlocks: number;
  externalStylesheets: number;
  externalScripts: number;

  transportEncoding:
    | "raw"
    | "escaped-rich-text"
    | "markdown-code"
    | "mixed";

  malformedLikely: boolean;
}
```

Do not build this detector from a brittle rule such as:

```ts
source.includes("<html")
```

Classification should use multiple signals and remain advisory.

The actual HTML5 parser is authoritative.

Examples:

```html
<div>Hello</div>
```

must classify as fragment.

```html
<style>...</style>
<section>...</section>
```

must classify as headless/mixed document.

```html
<!doctype html>
<html>...</html>
```

must classify as full document.

```html
<h1>Hello</h1>
<script>...</script>
```

must still work even without `<body>`.

Plain CSS pasted separately must be recognized as CSS rather than rejected as invalid HTML.

---

# 7. Transport Normalization

The user's supplied source demonstrates why this stage is essential.

It contains transport artifacts such as:

```text
\<html>
&#x20;
\--primary-color
window\.
hello\@example.com
```

The previous plan explicitly warned against globally deleting backslashes because doing so corrupts JavaScript regexes, CSS strings, Unicode escapes, and paths. fileciteturn4file12L1087-L1116

Create:

```ts
normalizeImportedSource()
normalizeEscapedMarkup()
normalizeCodeFence()
normalizeTextEncoding()
```

Do not do:

```ts
source.replaceAll("\\", "")
```

Normalization must be context-sensitive.

Preserve:

```js
/\d+\.\d+/
"C:\\Users\\example"
"\n"
"\u00A0"
```

while fixing transport escapes such as:

```text
\<div>
window\.scrollY
\--primary
```

Add round-trip normalization tests before touching DOM conversion.

---

# 8. HTML5 Parsing — Browser-Like, Not Template-Like

Use an HTML5-compliant parsing strategy with error recovery.

The parser must support both:

```ts
parseDocument()
```

and:

```ts
parseFragment()
```

behind one importer interface.

Never parse general HTML structure with regex.

The parser must allow browsers' normal recovery behavior for:

- missing closing tags;
- omitted `<html>`;
- omitted `<head>`;
- omitted `<body>`;
- improper table nesting;
- paragraph auto-closing;
- implicit `<tbody>`;
- malformed but browser-renderable markup;
- multiple roots.

The earlier plan correctly called for automatically distinguishing full documents, headless documents, and fragments. fileciteturn3file0L113-L144

Generalize it further.

### Important

Browser normalization can modify a malformed DOM.

Therefore preserve both:

```text
original source
normalized source
parsed/corrected DOM
```

and report:

```text
HTML_PARSE_RECOVERED
```

rather than silently pretending the normalized browser DOM was identical to the original source.

---

# 9. Document Decomposition

After parsing, do **not** immediately recursively convert `document.body`.

First decompose the document.

Create:

```ts
decomposeImportedDocument(document)
```

producing:

```ts
interface ImportedDocumentModel {
  doctype?: ImportedDoctype;

  htmlAttributes: AttributeMap;
  head: ImportedHeadModel;
  bodyAttributes: AttributeMap;

  renderRoots: ImportedDomNode[];

  documentMetadata: ImportedMetadata;

  baseUrl?: string;
}
```

### `<head>`

Extract:

```text
title
meta
link
style
script
base
noscript
```

according to type.

### `<body>`

Its children become candidate visual roots.

### `<html>`

Its attributes become document-runtime properties, not canvas elements.

### `<title>`

Never render as a block.

### `<meta>`

Never render as visible content.

### `<style>`

Never create a visual block.

### `<script>`

Never create a normal visual block.

### `<link>`

Classify by relation:

```text
stylesheet
preconnect
preload
canonical
icon
alternate
other
```

Only applicable assets should participate in the preview package.

---

# 10. Page-Root Model

Do not make `<body>` or `<html>` ordinary builder children.

Instead introduce page-level imported document properties:

```ts
interface ImportedPageRoot {
  htmlAttributes: AttributeMap;
  bodyAttributes: AttributeMap;

  doctype?: string;
  lang?: string;
  dir?: string;

  documentClassList: string[];
  bodyClassList: string[];

  metadata: ImportedMetadata;
}
```

This solves the original problem where imported headers or fixed-position elements can escape above the builder.

The editor is not the imported document's `body`.

The imported page gets **its own body context**.

---

# 11. Canvas Isolation — Make iframe the Primary Boundary

For arbitrary imported HTML/CSS/JS, an iframe should be the primary isolation architecture.

Do not attempt to solve this only by adding:

```css
.builder-canvas {
  overflow: hidden;
}
```

That does not isolate:

```css
body {}
html {}
* {}
button {}
input {}
:root {}
.site-header { position: fixed; }
```

and does nothing against JavaScript.

### Target structure

```text
WordPress admin window
└── Builder application
    ├── Toolbar
    ├── Layers
    ├── Inspector
    └── Canvas host
        └── iframe
            └── Imported document runtime
                ├── imported <html> attributes
                ├── imported body
                ├── imported stylesheet
                └── rendered builder nodes
```

This directly solves imported rules such as:

```css
html { ... }
body { ... }
* { ... }
button { ... }
input { ... }
.site-header {
    position: fixed;
    top: 0;
}
```

because they operate inside the iframe rather than against the WordPress admin document.

### Why iframe over pure Shadow DOM

Shadow DOM is useful for component-level encapsulation, but imported pages may depend on:

```text
html
body
:root
document.documentElement
document.body
window
scrollY
matchMedia
IntersectionObserver
location hash
fixed positioning
viewport units
```

A separate document context models those semantics more accurately.

Use Shadow DOM only for isolated internal builder widgets or specialized embedded components where appropriate.

---

# 12. Canvas Communication Boundary

The parent builder and iframe must communicate through an explicit bridge.

Create:

```ts
CanvasBridge
```

Message types may include:

```text
CANVAS_READY
DOCUMENT_LOAD
DOCUMENT_PATCH
NODE_SELECTED
NODE_HOVERED
NODE_RECT_REQUEST
NODE_RECT_RESPONSE
SCROLL_TO_NODE
VIEWPORT_CHANGED
SCRIPT_RUNTIME_STATUS
RUNTIME_ERROR
ANCHOR_NAVIGATION
FORM_INTERACTION
```

Use strict message validation.

Never expose arbitrary imported page JavaScript to:

```js
window.parent.document
```

If sandbox configuration allows scripts, carefully control `allow-same-origin`.

A strong preview architecture should make the imported runtime communicate only through the builder-owned bridge.

---

# 13. Two Canvas Execution Modes

Create separate behavior for:

```text
Edit Canvas
Preview Canvas
```

### Edit mode

Imported JavaScript:

```text
disabled
```

Inline event handlers:

```text
disabled/quarantined
```

Navigation:

```text
intercepted where needed
```

Forms:

```text
not submitted to arbitrary destinations
```

Editor selection overlays and drag-and-drop remain authoritative.

### Preview mode

Approved JavaScript:

```text
enabled inside isolated runtime
```

The earlier plan already established that imported JS must remain disabled in edit mode but may execute inside isolated Preview. fileciteturn5file8L733-L762

Do not change this rule.

---

# 14. General Recursive DOM-to-Block Converter

Replace template-oriented parsing with:

```ts
convertNode(node, context): ConversionResult
```

Pseudo-flow:

```ts
switch (node.nodeType) {
  case TEXT_NODE:
      return convertTextNode(node);

  case COMMENT_NODE:
      return preserveOrIgnoreComment(node);

  case ELEMENT_NODE:
      return convertElementNode(node);

  default:
      return fallback(node);
}
```

For elements:

```text
element
→ inspect tag
→ capture attributes
→ determine semantic adapter
→ classify editability
→ map native builder properties
→ recursively convert children
→ attach preserved source metadata
→ return BuilderNode
```

No adapter may assume a particular parent class unless that requirement comes from HTML itself.

---

# 15. Block Adapter Registry

Use adapters instead of a giant conditional function.

```ts
interface DomBlockAdapter {
  supports(element, context): boolean;
  convert(element, context): BuilderNode;
  fidelity: "native" | "hybrid";
}
```

Register adapters for:

```text
heading
paragraph
text
container
link
button
image
picture
video
audio
list
list item
table
form
field
label
select
textarea
figure
blockquote
pre/code
iframe
svg
semantic container
```

Adapters are selected by **element semantics/capabilities**, not arbitrary class names.

Bad:

```ts
if (el.classList.contains("hero")) createHeroBlock();
```

Good:

```ts
if (tag === "section") {
    return semanticContainerAdapter.convert(...);
}
```

The original classes remain as imported HTML classes.

---

# 16. Generic Element Block

This is one of the most important pieces of the generalized architecture.

Introduce or expand a:

```text
Generic HTML Element
```

builder block.

It must support:

```ts
{
  tagName,
  attributes,
  classList,
  htmlId,
  children,
  inlineStyle,
  importedSource,
}
```

This means:

```html
<dialog>
<details>
<summary>
<address>
<time>
<mark>
<output>
<meter>
<progress>
<template>
<slot>
<custom-widget>
```

do not automatically cause parsing failure.

If the builder has no specialized module:

```text
valid HTML element
→ generic element
→ recursively convert children
```

This single principle dramatically increases parser coverage.

---

# 17. Graceful Fallback Hierarchy

Follow:

> Convert what can be converted. Preserve what cannot. Never silently delete valid user content.

Fallback priority:

```text
1. Native builder block
2. Generic semantic element block
3. Hybrid imported component
4. Preserved raw DOM subtree
5. Security-restricted placeholder
```

Do not jump directly from:

```text
unknown element
```

to:

```text
discard element
```

or:

```text
fail document
```

The previous plan correctly recommended using a scoped fallback only for the unsupported subtree rather than freezing the whole page. fileciteturn6file10L825-L835

Keep that rule.

---

# 18. Node Error Boundaries

Wrap recursive conversion per subtree.

Conceptually:

```ts
try {
    return convertNode(node);
} catch (error) {
    diagnostics.add(...);

    return fallbackFactory.fromNode(node, error);
}
```

One malformed/custom element must never abort siblings.

Example:

```html
<section>
  <h2>Works</h2>

  <custom-broken-component>
    ...
  </custom-broken-component>

  <p>This must still import.</p>
</section>
```

Expected result:

```text
Section
├─ Heading
├─ Imported HTML (advanced)
└─ Paragraph
```

not:

```text
IMPORT FAILED
```

---

# 19. Preserve Imported DOM Identity Separately From Builder Identity

Every node needs:

```ts
builderNodeId
```

and separately:

```ts
htmlId
classes
```

Never overwrite:

```html
id="theme-toggle"
```

with:

```text
builder-node-c4139
```

because imported JavaScript/CSS may depend on the original ID.

The previous plan explicitly required separate builder IDs and DOM-facing IDs. fileciteturn3file0L381-L391

Duplicate imported IDs should produce:

```text
DUPLICATE_HTML_ID
```

but should not be silently rewritten unless the user chooses a repair operation.

---

# 20. Attribute Preservation

Do not whitelist only attributes the builder happens to expose today.

Maintain an attribute model.

Preserve safe forms of:

```text
id
class
style
title
lang
dir
role
aria-*
data-*
href
target
rel
download
src
srcset
sizes
loading
decoding
width
height
alt
name
type
value
placeholder
required
disabled
readonly
autocomplete
method
action
enctype
for
rows
cols
controls
autoplay
muted
loop
poster
playsinline
sandbox
allow
referrerpolicy
```

and appropriate custom-element attributes.

Native controls can expose common attributes.

An Advanced Attributes panel should retain the remainder.

---

# 21. CSS Must Become Its Own Subsystem

Do not treat CSS as an afterthought to DOM conversion.

Create an ordered page stylesheet model.

```ts
interface ImportedStylesheet {
  id: string;
  origin:
    | "style-element"
    | "external-link"
    | "inline-derived"
    | "builder-override";

  media?: string;
  sourceText: string;

  ast: CssAst;

  order: number;

  disabled?: boolean;

  sourceLocation?: SourceRange;
}
```

The previous plan correctly required keeping stylesheet ordering and media rules intact. fileciteturn6file6L471-L494

This must now become the canonical CSS import architecture.

---

# 22. Do Not Flatten the Cascade

A critical anti-pattern would be:

```css
.button {
  color: white;
}
```

becoming:

```html
<a style="color:white">
```

on every currently matching element.

That destroys:

```text
selector ownership
class reuse
specificity
inheritance
media-query ownership
pseudo-state behavior
future elements using that class
```

Instead maintain a selector index.

```ts
CssSelectorIndex
```

Selected nodes should be able to answer:

```text
Which stylesheet rules affect me?
Which declaration wins?
Where did the value originate?
Can this value be safely edited natively?
```

The previous plan already required retaining class, ID, descendant, and pseudo-element selector semantics rather than copying everything inline. fileciteturn5file11L935-L955

That principle is mandatory.

---

# 23. Hybrid CSS Editing Model

Use:

```text
Native Controls
+
Preserved CSS
```

not:

```text
Convert 100% of CSS to controls
```

A declaration becomes a builder-native control only when:

```text
property supported
AND
value representation lossless
AND
selector ownership understood
AND
state understood
AND
breakpoint understood
AND
editing it will not unexpectedly affect unrelated elements
```

Otherwise:

```text
keep declaration in CSS AST
```

For example:

```css
font-size: 42px;
```

may map easily.

But:

```css
font-size: clamp(2rem, 5vw + 1rem, 6rem);
```

should stay as its exact expression unless the builder's advanced sizing control is expression-capable.

Previous Code-to-Block planning already required exact imported values such as `clamp()` and `calc()` to remain intact rather than being coerced. fileciteturn5file10L868-L893

---

# 24. CSS Coverage Requirements

The AST/preservation layer must support, without destructive loss:

```text
CSS variables
!important
inheritance
specificity
selector lists
descendant selectors
child selectors
sibling selectors
attribute selectors
:hover
:focus
:focus-visible
:active
:disabled
:first-child
:last-child
:nth-child()
:not()
:is()
:where()
:has() where parser/runtime supports it
::before
::after
@media
@supports
@container
@layer
@font-face
@keyframes
@import policy handling
calc()
clamp()
min()
max()
var()
gradients
filters
backdrop-filter
transforms
transitions
animations
flexbox
grid
logical properties
custom properties
modern color functions
```

The builder does not need a visual control for every feature.

It needs the ability to **preserve** every safe browser-supported declaration.

---

# 25. CSS Variables

Map obvious `:root` variables into the builder token system when safe.

The previous plan already established:

```text
source CSS variable name
→ builder token ID
```

without renaming the original CSS variable. fileciteturn3file0L205-L234

Preserve:

```css
var(--primary-color)
```

rather than replacing every usage with a literal color.

Theme overrides:

```css
html[data-theme="dark"] {
  --primary-color: ...;
}
```

must remain scoped overrides unless the builder already has an equivalent theme token mechanism.

---

# 26. Media Queries and Responsive Behavior

Do not assume imported breakpoints match builder defaults.

Maintain:

```ts
ImportedMediaCondition
```

Classify:

```text
viewport breakpoint
environment query
accessibility preference
orientation
resolution
other
```

Examples:

```css
@media (max-width: 820px)
```

can map to a responsive breakpoint where appropriate.

But:

```css
@media (prefers-reduced-motion: reduce)
```

is **not** a mobile breakpoint.

The previous plan explicitly made this distinction. fileciteturn3file0L284-L305

If the builder cannot represent a media condition natively:

```text
preserve it as CSS
```

instead of dropping it.

---

# 27. Pseudo-Elements

Do not convert:

```css
.section-label::before
```

into a fake child `<div>`.

That changes DOM semantics.

Keep pseudo-elements in stylesheet rules.

Where builder controls support pseudo-elements, surface them through those controls.

Otherwise expose them as:

```text
Imported CSS → ::before
Imported CSS → ::after
```

The previous plan explicitly required preserving pseudo-elements as stylesheet/state rules. fileciteturn5file8L696-L727

---

# 28. External Stylesheets

For:

```html
<link rel="stylesheet" href="...">
```

create an external dependency record.

Do not blindly fetch remote resources during parsing.

```ts
interface ExternalStyleAsset {
  url: string;
  originalUrl: string;
  resolvedUrl?: string;
  media?: string;
  integrity?: string;
  crossorigin?: string;
  status:
    | "referenced"
    | "allowed"
    | "blocked"
    | "unresolved";
}
```

In preview, loading policy should be configurable.

Published output should use a controlled enqueue/dependency mechanism rather than injecting arbitrary `<link>` tags into wp-admin.

Relative URLs must be resolved against a known source/base URL when available.

If the user pasted source with no origin URL, report:

```text
RELATIVE_ASSET_BASE_UNKNOWN
```

rather than incorrectly rewriting it.

---

# 29. JavaScript Asset Extraction

Never leave `<script>` nodes buried inside normal renderable block markup.

Extract them.

```ts
interface ImportedScriptAsset {
  id: string;

  sourceType:
    | "inline-script"
    | "external-script"
    | "event-handler";

  source?: string;
  src?: string;

  placement:
    | "head"
    | "body"
    | "body-end";

  type?: string;

  async?: boolean;
  defer?: boolean;

  module?: boolean;

  attributes: AttributeMap;

  executionPolicy:
    | "disabled"
    | "preview-only"
    | "preview-and-frontend";

  securityStatus:
    | "safe-policy"
    | "requires-trust"
    | "blocked";
}
```

---

# 30. JavaScript Lifecycle Manager

The largest problem with arbitrary imported JavaScript is not parsing; it is lifecycle.

Create:

```ts
ImportedScriptRuntime
```

with lifecycle operations:

```ts
initialize(documentVersion)
dispose(documentVersion)
reload(documentVersion)
```

Never execute a page script after every minor block render.

Preferred behavior:

### Edit mode

```text
scripts disabled
```

### Preview mode

Build or refresh complete preview runtime when required.

### Published frontend

Execute through the page's registered approved script assets.

This avoids repeatedly registering:

```js
window.addEventListener(...)
document.addEventListener(...)
IntersectionObserver(...)
```

after every React rerender.

---

# 31. Script Isolation

Imported JS may legitimately use:

```js
document.body
document.documentElement
document.querySelector()
window.scrollY
window.matchMedia()
localStorage
IntersectionObserver
```

Those APIs should refer to the **imported iframe document**, not the WordPress builder shell.

This is another reason iframe isolation is the correct boundary.

For the supplied portfolio:

```js
document.body
document.documentElement
window.addEventListener(...)
```

must operate inside the page runtime.

The script must never see the WordPress admin's actual `document.body`.

---

# 32. Inline Event Handlers

Treat:

```html
<button onclick="...">
```

as executable code.

Do not simply copy it into the edit canvas.

Extract it into a restricted event-handler representation or disable it until Preview.

Diagnostics:

```text
INLINE_EVENT_HANDLER_DETECTED
INLINE_EVENT_HANDLER_DISABLED_IN_EDITOR
```

---

# 33. DOM-Dependent Scripts

Do not attempt to automatically convert arbitrary JavaScript into builder actions.

For example:

```js
document.querySelectorAll(".filter-button")
```

does not need to become a builder "Filter Interaction" control.

Preserve it as page JS.

This preserves arbitrary application behavior without requiring Code-to-Block to become a JavaScript compiler.

The previous parser architecture correctly required this. fileciteturn3file0L344-L379

---

# 34. PHP and Server-Side Code

PHP is fundamentally different.

Never execute imported:

```php
<?php ... ?>
```

simply because the user pasted it.

Create:

```ts
ImportedServerCodeAsset
```

with:

```text
language: php
status:
  detected
  preserved
  restricted
```

Default behavior:

```text
Detect
Preserve source
Warn
Do not execute
```

Possible future trusted workflow:

```text
explicit dynamic/server-side block
+
server capability
+
administrator/developer permission
+
server-side registration
+
allowlisted API
```

but never:

```php
eval($imported_php);
```

and never write arbitrary PHP into plugin/theme files.

---

# 35. Import Compatibility Levels

Compute compatibility per document and per subtree.

### Level 1 — Native

The structure and styling can be modeled safely with builder primitives.

### Level 2 — Hybrid

The structure is editable as blocks, while CSS or behavior remains imported/preserved.

### Level 3 — Preserved Component

The subtree cannot be represented faithfully as native blocks and stays inside an isolated imported component.

### Level 4 — Restricted

Security-sensitive/server-dependent behavior exists and is disabled until explicitly allowed.

Do not assign only one level to the entire document.

Example:

```text
Landing page
├─ Hero                Level 1
├─ Cards               Level 1
├─ Fancy CSS component Level 2
├─ Web component       Level 3
└─ Imported PHP        Level 4
```

This produces a far better UX than:

```text
Unsupported document
```

---

# 36. Import Diagnostics

Create stable machine-readable diagnostic codes.

```ts
interface ImportDiagnostic {
  severity:
    | "info"
    | "warning"
    | "error"
    | "security";

  code: string;
  message: string;

  source:
    | "source"
    | "html"
    | "css"
    | "javascript"
    | "php"
    | "asset";

  range?: SourceRange;

  nodeId?: string;
  assetId?: string;

  recoverable: boolean;
}
```

Examples:

```text
HTML_PARSE_RECOVERED
MULTIPLE_ROOT_NODES
DUPLICATE_HTML_ID
UNSUPPORTED_ELEMENT_PRESERVED
CSS_PROPERTY_PRESERVED_RAW
CSS_SELECTOR_PRESERVED
CUSTOM_MEDIA_QUERY_PRESERVED
EXTERNAL_STYLESHEET_DETECTED
EXTERNAL_SCRIPT_DETECTED
SCRIPT_DISABLED_IN_EDITOR
INLINE_EVENT_HANDLER_RESTRICTED
UNSAFE_URL_BLOCKED
PHP_CODE_RESTRICTED
RELATIVE_ASSET_BASE_UNKNOWN
DEPENDENCY_UNRESOLVED
```

The previous parser plan already proposed structured diagnostics rather than a generic "unsupported" message. fileciteturn6file10L793-L823

Expand that model.

---

# 37. User-Facing Import Review

Before committing a major import, show:

```text
Document
Full HTML document

Structure
186 elements
173 native/hybrid blocks
2 preserved components

Styles
3 style blocks
1 external stylesheet
27 CSS variables
5 media conditions
4 keyframe animations

Scripts
2 inline scripts
1 external dependency
Disabled while editing

Security
1 restricted inline event handler
PHP: none

Compatibility
Native: 82%
Hybrid: 16%
Preserved: 2%
Restricted: 0%
```

Normal users should not see AST internals.

Developers can expand diagnostics.

---

# 38. Transactional Import

Never mutate the current builder document while parsing.

Sequence:

```text
parse source
build candidate package
validate package
calculate diagnostics
show review
commit package
```

On commit:

```text
one undo transaction
```

If anything fails before commit:

```text
existing page unchanged
```

This was already a correct principle in the previous plan. fileciteturn5file4L401-L421

---

# 39. Canonical Imported Package

Persist an import package such as:

```ts
interface ImportedDocumentPackage {
  schemaVersion: number;

  source: {
    original: string;
    normalized: string;
    hash: string;
  };

  documentMetadata: ImportedDocumentMetadata;

  blocks: BuilderNode[];

  stylesheets: ImportedStylesheet[];

  scripts: ImportedScriptAsset[];

  externalAssets: ImportedExternalAsset[];

  serverCode: ImportedServerCodeAsset[];

  fallbacks: ImportedFallbackMetadata[];

  diagnostics: ImportDiagnostic[];

  origin: {
    type: "code-import";
    importSessionId: string;
    importedAt: string;
  };
}
```

The existing plan already recommended retaining imported nodes, styles, scripts, diagnostics, source hash, and origin metadata rather than exposing parser-library ASTs throughout the application. fileciteturn4file0L13-L60

Keep the parser implementation behind interfaces.

---

# 40. Preserve Source Ownership

Every imported CSS rule/block/script should know where it came from.

```ts
origin: {
  importSessionId;
  sourceAssetId;
  sourceRange;
}
```

When the user later edits an imported value:

```text
if safe to modify original rule
→ update original rule

otherwise
→ add builder-owned override
```

Never silently convert a shared imported class rule into one local element value.

---

# 41. Editor Rendering Architecture

The editor should render a **document model**, not source HTML directly.

Pipeline:

```text
Builder Document State
→ Render Model
→ Canvas Runtime Package
→ iframe renderer
```

This decouples:

```text
parsing
editing
rendering
```

The renderer should not know how HTML was originally imported.

Likewise the importer should not know React selection/drag behavior.

---

# 42. Selection and Drag-and-Drop in an iframe

Use bridge messages and geometry queries.

Imported content nodes rendered in iframe should include a builder-owned non-user-visible marker such as:

```html
data-ctb-node="internal-node-id"
```

This is separate from imported:

```html
id
class
data-* user attributes
```

Selection flow:

```text
iframe pointer event
→ closest data-ctb-node
→ postMessage node ID
→ parent editor updates selection
→ overlay/highlight rendered
```

Do not attach builder selection logic using imported class names.

---

# 43. Fixed and Absolute Elements

This deserves explicit testing.

Imported:

```css
position: fixed;
top: 0;
```

must be fixed relative to the iframe viewport.

It must not become fixed relative to wp-admin.

This directly fixes the observed imported-header-above-builder problem at its architectural root.

---

# 44. Sanitization Architecture

Sanitization must occur at several boundaries instead of one destructive pass.

### Stage A — import-time security analysis

Does not destroy original source.

Classifies danger.

### Stage B — edit-runtime safety

Disables executable behavior that could affect the builder.

### Stage C — canonical save validation

Validates persisted builder document.

### Stage D — frontend output security

Applies WordPress capability/product policy.

WordPress KSES filters allowed elements/attributes and protocols, and WordPress applies KSES to users who lack `unfiltered_html`. citeturn473695search8turn473695search4

Therefore do not assume:

```text
"it came from our builder"
=
trusted
```

Server-side validation remains authoritative.

---

# 45. WordPress Capability Policy

Create one server-side policy service.

Use capabilities rather than roles.

WordPress explicitly recommends capability checks and supports object-specific checks such as `current_user_can( 'edit_post', $post_id )`. citeturn473695search7

Check:

```php
current_user_can( 'edit_post', $post_id );
current_user_can( 'edit_post_meta', $post_id, $meta_key );
current_user_can( 'unfiltered_html' );
```

Do not code:

```php
if ($user->role === 'administrator')
```

`unfiltered_html` also has special multisite and `DISALLOW_UNFILTERED_HTML` behavior in WordPress core. citeturn473695search14

---

# 46. WordPress Canonical Storage

Do not create one storage mechanism for manual builder content and another for imported pages.

Imported pages must become part of the same canonical builder document.

The previous WordPress workflow plan correctly required imported DOM, CSS, responsive rules, IDs/classes, and allowed scripts to persist through the same save/revision pipeline. fileciteturn4file9L866-L891

Canonical page content should include the page-scoped data necessary to reproduce:

```text
blocks
imported CSS
page assets
approved page scripts
import metadata
fallback nodes
```

Derived caches should remain separate.

---

# 47. WordPress Meta Registration and Revisions

If canonical builder data lives in post meta, register it explicitly.

WordPress `register_meta()` supports:

```text
sanitize_callback
auth_callback
show_in_rest
revisions_enabled
```

and revision support for post meta has existed since WordPress 6.4. citeturn473695search0turn473695search1

Do not revision derived data like:

```text
compiled CSS hash
render cache
selector index
lint cache
```

Revision canonical document data instead.

---

# 48. Save / Reload / Publish Parity

Every parser feature must pass:

```text
Import
→ Edit
→ Save Draft
→ Reload
→ Edit
→ Preview
→ Publish
→ Reload frontend
```

A feature is not done merely because it renders during the import session.

Test persistence of:

```text
HTML IDs
classes
attributes
fallback nodes
custom properties
stylesheet order
media queries
pseudo-elements
keyframes
script assets
document metadata
external references
```

---

# 49. URLs and Asset Security

Introduce:

```ts
UrlSecurityPolicy
```

Classify protocols.

Safe examples may include:

```text
https:
http:
mailto:
tel:
#
relative paths
```

according to context.

Reject/quarantine executable schemes such as:

```text
javascript:
```

WordPress KSES itself excludes dangerous protocols such as JavaScript from its normal allowed protocol model. citeturn473695search8

Inspect URLs in:

```text
href
src
srcset
poster
action
formaction
CSS url()
@font-face
@import
script src
link href
iframe src
```

---

# 50. iframes

Imported iframe blocks require their own security rules.

Persist safe attributes such as:

```text
src
sandbox
allow
loading
referrerpolicy
width
height
```

but restrict arbitrary privilege escalation.

The editor iframe containing the page and an imported `<iframe>` inside the page are separate concepts.

Nested user iframes must not inherit permissions simply because the main canvas iframe requires them.

---

# 51. Forms

Do not delete forms.

Convert:

```text
form
input
textarea
select
option
label
button
fieldset
legend
```

recursively.

During edit mode:

```text
prevent uncontrolled submissions
```

In Preview:

apply policy.

On frontend:

render the original form semantics where safe.

Do not assume every form is a WordPress form.

An imported static form may need Level 2/3 compatibility if its server action cannot function in WordPress.

---

# 52. SVG

SVG must not be treated as normal HTML blindly.

Implement SVG-aware preservation.

Support:

```text
svg
g
path
circle
rect
ellipse
line
polyline
polygon
defs
linearGradient
radialGradient
clipPath
mask
use
symbol
text
```

with security filtering.

Prefer preserving complex SVG subtrees rather than converting every path into builder blocks.

---

# 53. Tables

Recursively support:

```text
table
caption
thead
tbody
tfoot
tr
th
td
colgroup
col
```

Do not flatten them to divs.

HTML parsers may insert `<tbody>` automatically; source/normalized-DOM metadata should account for this.

---

# 54. Custom Elements / Framework Markup

Markup such as:

```html
<my-card>
<swiper-container>
<model-viewer>
```

should not fail the document.

Default:

```text
Generic/custom-element block
```

If its functionality requires an unavailable runtime dependency:

```text
DEPENDENCY_UNRESOLVED
```

and downgrade compatibility.

Do not build special handling for every framework.

---

# 55. Framework-Generated HTML

Bootstrap, Tailwind, Elementor, Divi, hand-authored HTML, AI-generated markup, and legacy HTML should all pass through the **same general DOM pipeline**.

Do not add:

```ts
parseBootstrap()
parseDivi()
parseElementor()
```

to the core architecture.

Optional adapters may later recognize framework semantics for enhanced conversion, but the generic parser must work without them.

---

# 56. Special-Case Removal Pass

After generalized conversion works, delete or isolate previous hacks.

Every occurrence found in Phase 0 gets one disposition:

```text
REMOVE
GENERALIZE
MOVE BEHIND ADAPTER
KEEP AS HTML-STANDARD BEHAVIOR
KEEP AS BACKWARD-COMPATIBILITY PATH
```

Examples that should normally be removed:

```ts
if (className === "site-header")
if (source.includes("<main>"))
body.children[0]
document.querySelector(".container")
```

unless that code exists solely in a fixture/test.

---

# 57. Performance Architecture

Large imported landing pages may contain thousands of DOM nodes.

Do not fully reparse the entire source on every property change.

Initial import:

```text
source
→ full parse
→ canonical document
```

Editing:

```text
builder state mutations
→ component-level render patches
```

not:

```text
serialize all blocks
→ parse entire document again
→ rerender everything
```

---

# 58. Caches

Introduce derived caches keyed by:

```text
document version
node version
stylesheet version
```

Useful caches:

```text
CSS AST
selector index
node-to-selector matches
resolved custom properties
dependency analysis
compatibility analysis
render package
```

Derived caches must never become canonical content.

They must be safely rebuildable.

---

# 59. Worker-Based Parsing

For very large imports, HTML/CSS source preprocessing and static analysis may be moved into a Web Worker where practical.

Good worker candidates:

```text
source detection
transport normalization
CSS parsing
selector indexing
dependency analysis
static security scanning
diagnostic generation
```

DOM operations requiring browser DOM APIs may remain in the main/import-runtime process unless the chosen parser is DOM-independent.

Do not introduce workers until parser correctness is established.

---

# 60. Incremental Rendering

Canvas changes should operate on the affected subtree.

Examples:

```text
text edit
→ patch text node

spacing change
→ update node style/control

class change
→ update selector matching for affected indexes

delete block
→ remove one subtree

duplicate block
→ create one new subtree
```

Full iframe document reloads should be reserved for things such as:

```text
page script reload
major stylesheet dependency change
document root metadata change
preview startup
```

---

# 61. Security Test Suite

Required attacks include:

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<a href="javascript:alert(1)">
<iframe src="javascript:...">
<form action="...">
<svg onload="...">
<style>@import url(...)</style>
```

plus:

```text
malicious CSS URLs
malformed tags
DOM clobbering IDs/names
prototype-looking data keys
extreme nesting
oversized source
recursive custom elements
hostile external dependencies
PHP payloads
```

Test that none can take control of:

```text
wp-admin
builder shell
parent DOM
WordPress REST credentials
nonce-bearing application state
```

---

# 62. Parser Test Matrix

Do not organize the suite around only the Alex Morgan page.

Required fixture families:

```text
minimal-div.html
single-heading.html
multiple-roots.html
body-only.html
full-document.html
headless-style-script.html
malformed-browser-valid.html

semantic-document.html
deep-nesting.html
legacy-html.html
custom-elements.html

tables.html
forms.html
media.html
svg-heavy.html
iframes.html

flex-layout.html
grid-layout.html
css-variables.html
pseudo-elements.html
pseudo-classes.html
animations.html
modern-css.html
media-queries.html
container-queries.html

inline-script.html
external-script.html
dom-dependent-script.html
module-script.html
multiple-scripts.html

bootstrap-layout.html
tailwind-output.html
wordpress-content.html
elementor-like.html
divi-like.html
ai-generated-site.html

php-containing.html

huge-landing-page.html
```

The portfolio from this request becomes:

```text
portfolio-full-document.html
portfolio-full-document-escaped.html
```

Both must normalize to semantically equivalent import packages.

The earlier plan already required raw and escaped versions of the portfolio to produce equivalent DOM/block/style/script results. fileciteturn3file0L587-L615

---

# 63. Test Dimensions

Every fixture should test whichever dimensions apply:

```text
detection
normalization
HTML parse
error recovery
metadata extraction
DOM conversion
attribute preservation
fallback behavior
CSS preservation
CSS native mappings
responsive behavior
script extraction
script isolation
asset detection
security classification
serialization
save/reload
preview
frontend
visual fidelity
performance
```

---

# 64. Visual Fidelity Testing

Use screenshot comparison at representative widths.

Minimum:

```text
1440px
1024px
768px
390px
```

For source pages, compare:

```text
standalone source rendering
vs
Code-to-Block Preview rendering
```

Set tolerances for font/environment differences, but layout, spacing, visibility, responsive breakpoints, pseudo-elements, gradients, animations, and positioning must remain materially equivalent.

---

# 65. Editor Isolation Tests

Explicitly import CSS containing:

```css
html,
body,
*,
button,
input,
a,
header {
  /* intentionally aggressive */
}
```

Then assert:

```text
builder toolbar unchanged
inspector unchanged
WordPress admin unchanged
drag/drop works
editor typography unchanged
publish button unchanged
```

Also import:

```css
header {
  position: fixed;
  top: 0;
}
```

and assert it is fixed only inside the canvas.

This test directly guards the bug you observed.

---

# 66. JavaScript Isolation Tests

Import scripts that attempt:

```js
document.body.innerHTML = "";
window.parent.document.body.innerHTML = "";
document.querySelector("button").remove();
window.addEventListener("scroll", ...);
```

Expected:

```text
edit mode → none execute

preview → imported-document operations may execute
parent-builder operations must not succeed
```

Use runtime errors/blocked actions as diagnostics where possible.

---

# 67. Save/Reload Regression

For every compatibility level:

```text
import
save draft
reload
preview
publish
reload frontend
```

must preserve behavior.

The WordPress workflow plan already identifies imported HTML/CSS/JS → Draft → Preview → Publish as a critical end-to-end path. fileciteturn6file14L1054-L1077

---

# 68. Implementation Sequence

## Phase A — Inventory and safety net

Do not change parser behavior yet.

Complete:

```text
repository call graph
existing parser fixture snapshots
existing import regression tests
special-case inventory
global-document access inventory
existing save format documentation
```

Deliverable:

```text
CURRENT_IMPORT_ARCHITECTURE.md
```

---

## Phase B — Introduce importer boundaries

Create:

```text
ImportCodeService
CodeImportSession
ImportDiagnosticsCollector
```

Keep current parser behind a temporary:

```text
LegacyImportAdapter
```

Feature flag:

```text
universal_import_pipeline
```

No user-visible behavior change yet.

---

## Phase C — Detection and normalization

Implement:

```text
detectSourceKind
detectTransportEncoding
normalizeImportedSource
```

Add pure unit tests.

Do not touch block conversion.

---

## Phase D — HTML5 parser and document decomposition

Implement:

```text
HtmlDocumentParser
HtmlDocumentDecomposer
ImportedDocumentModel
```

Support:

```text
documents
fragments
multiple roots
document metadata
browser error recovery
```

At this point the system must parse arbitrary structures without converting them yet.

---

## Phase E — General DOM conversion

Implement:

```text
BlockAdapterRegistry
DomToBlockConverter
GenericElementAdapter
FallbackBlockFactory
```

Move existing tag mappings into adapters.

Delete template-specific conversion assumptions after parity tests pass.

---

## Phase F — Isolated iframe canvas

Create:

```text
ImportedDocumentRuntime
CanvasBridge
```

Move imported document rendering into iframe context.

Do this **before enabling imported JavaScript**.

Acceptance gate:

```text
global body/html CSS cannot alter builder
fixed header cannot escape canvas
```

---

## Phase G — CSS AST and preservation

Introduce:

```text
CssImportParser
CssSelectorIndex
CssCascadeAnalyzer
CssControlAdapterRegistry
```

First goal:

```text
100% safe preservation
```

Second goal:

```text
progressive native editability
```

Do not reverse those priorities.

---

## Phase H — Assets and dependencies

Implement:

```text
ImportAssetRegistry
AssetUrlResolver
ExternalDependencyRegistry
```

Support:

```text
link stylesheets
images
srcset
fonts
CSS url()
external JS
iframe sources
```

---

## Phase I — JavaScript runtime

Implement:

```text
ScriptAssetExtractor
ScriptSecurityAnalyzer
ImportedScriptRegistry
ImportedScriptRuntime
```

Scripts remain disabled in normal editing.

Only enable them after iframe isolation security tests pass.

---

## Phase J — PHP/server-side classification

Add:

```text
PhpImportPolicy
ImportedServerCodeAsset
```

Default:

```text
preserve + restrict
```

No arbitrary execution.

---

## Phase K — Import review and compatibility reporting

Add:

```text
compatibility levels
diagnostics UI
security warnings
dependency warnings
normalized-source inspection
```

Import remains transactional.

---

## Phase L — WordPress canonical persistence

Integrate imported assets into the existing builder document repository.

Ensure:

```text
revisions
autosave
drafts
preview
publish
REST validation
capabilities
KSES policy
```

all use the same canonical document.

---

## Phase M — Performance

Only after correctness:

```text
cache CSS AST
cache selector index
incremental render patches
lazy Layers rendering
worker analysis
dependency cache
```

---

## Phase N — Remove legacy architecture

Delete the old parser path only when:

```text
all historical fixtures pass
new generalized matrix passes
save/reload tests pass
visual tests pass
security tests pass
```

Do not maintain two permanent parser architectures.

---

# 69. Functions That Should Exist After Refactor

Core orchestration:

```ts
analyzeImportSource()
commitImportSession()
cancelImportSession()
```

Detection:

```ts
detectImportedSource()
detectDocumentShape()
detectTransportEncoding()
```

Normalization:

```ts
normalizeImportedSource()
normalizeTransportEscapes()
```

HTML:

```ts
parseImportedHtml()
parseImportedFragment()
decomposeImportedDocument()
analyzeImportedDom()
```

Conversion:

```ts
convertDomTree()
convertDomNode()
resolveBlockAdapter()
createGenericElementBlock()
createFallbackBlock()
```

CSS:

```ts
extractStylesheets()
parseImportedStylesheet()
indexImportedSelectors()
resolveStylesForNode()
mapCssDeclarationToControl()
createCssOverride()
```

Scripts:

```ts
extractImportedScripts()
analyzeImportedScript()
registerImportedScript()
initializePreviewScripts()
disposePreviewScripts()
```

Security:

```ts
analyzeImportedUrl()
analyzeImportedHtml()
evaluateScriptExecutionPolicy()
evaluatePhpImportPolicy()
```

Rendering:

```ts
buildCanvasRuntimePackage()
mountCanvasRuntime()
patchCanvasRuntime()
reloadPreviewRuntime()
```

Serialization:

```ts
serializeImportedDocument()
serializeImportedStylesheets()
serializeImportedAssets()
validateCanonicalBuilderDocument()
```

---

# 70. Functions/Patterns That Should Disappear

Wherever equivalent behavior currently exists, remove patterns such as:

```ts
parseKnownTemplate()
parsePortfolioHtml()
extractHero()
findMainContainer()
source.match(/<style[^>]*>(.*?)<\/style>/s)
source.match(/<body[^>]*>(.*?)<\/body>/s)
document.querySelector(".container")
document.body.append(...)
document.head.append(...)
element.children[0]
element.firstElementChild
```

unless used exclusively in tests.

Likewise remove direct imports into state like:

```ts
const blocks = parse(source);
setBlocks(blocks);
```

Replace with:

```text
analyze
validate
review
commit
```

---

# 71. Backward Compatibility

Existing builder documents must remain unchanged.

Rules:

```text
do not auto-migrate saved pages just because universal importer ships
do not rewrite existing IDs
do not rewrite existing classes
do not change existing serialization until intentional save
retain legacy renderer where needed for existing node schema
use schema versioning for new imported asset structures
```

If a migration is necessary:

```text
load old schema
→ normalize in memory
→ save new schema only after explicit user save
```

---

# 72. Release Gate

Do not make the universal importer default until:

```text
all existing importer tests pass
all new document-shape fixtures pass
canvas isolation passes
security suite passes
WordPress save/reload passes
frontend parity passes
visual regression passes
large-page performance passes
```

Rollout:

```text
development flag
→ internal testing
→ opt-in beta
→ default
→ remove legacy path
```

---

# 73. Non-Negotiable Acceptance Criteria

The project is complete only when all of the following are true:

1. `<div>Hello</div>` imports.

2. A body-only page imports.

3. Multiple root nodes import.

4. A complete `<!DOCTYPE html><html><head>...` page imports.

5. `<title>`, `<meta>`, `<link>`, `<style>`, and `<script>` do not become accidental visual blocks.

6. The exact supplied portfolio imports.

7. The escaped form of that portfolio imports.

8. Completely unrelated HTML structures also import.

9. Unknown but valid elements do not abort parsing.

10. Unsupported subtrees become localized fallbacks.

11. Valid content is never silently deleted because no native block exists.

12. Imported `html`, `body`, `*`, `button`, and global selectors cannot style the builder UI.

13. Imported fixed headers remain inside the canvas.

14. Imported JS never executes inside normal editor mode.

15. Imported JS can run in isolated Preview when security policy permits it.

16. DOM-dependent imported JS sees the imported document, not wp-admin.

17. CSS Grid and Flexbox preserve layout.

18. CSS variables survive.

19. Media queries survive.

20. Pseudo-elements survive.

21. Keyframes survive.

22. Unsupported valid CSS survives.

23. Forms survive structurally.

24. Tables survive structurally.

25. SVG survives safely.

26. Custom elements survive through generic/fallback conversion.

27. External assets are detected and reported.

28. Dangerous URLs are blocked.

29. PHP is never executed arbitrarily.

30. A failing subtree does not crash the editor.

31. Import is undoable in one transaction.

32. Saving and reloading preserves imported behavior.

33. Preview and frontend materially match.

34. Existing pre-upgrade pages do not regress.

35. The parser contains no Alex-Morgan-specific, `.hero`-specific, `.container`-specific, Divi-specific, Elementor-specific, Bootstrap-specific, or Tailwind-specific requirement in its core path.

---

# 74. Definition of Done

The architecture is done when Code-to-Block can answer:

```text
What kind of source did the user provide?

What is document-level metadata?

What is visible DOM content?

What styles does the document require?

What scripts does it require?

Which external dependencies exist?

Which DOM nodes map safely to native builder modules?

Which nodes need a generic representation?

Which nodes need preservation?

Which features are security restricted?

How can the result render faithfully without affecting the editor?

How can it survive save/reload/publish?
```

instead of asking:

```text
Does this HTML match the structure our parser expects?
```

That change—from **template recognition** to **general document interpretation**—is the actual fix.

---

# 75. Instruction to the Coding Agent

Do not begin by modifying whatever branch recognizes the Alex Morgan portfolio.

Begin by locating the current import entry point and tracing every call from raw source to saved WordPress output.

Then implement the architecture in this order:

```text
boundaries
→ detection
→ normalization
→ HTML5 parsing
→ document decomposition
→ generic recursive conversion
→ fallback preservation
→ iframe isolation
→ CSS preservation
→ asset registry
→ JavaScript runtime
→ PHP restriction
→ diagnostics
→ WordPress canonical persistence
→ performance
→ legacy parser removal
```

At every phase, run unrelated HTML fixtures.

If a change improves the supplied portfolio while another valid fixture starts failing, the phase is **not complete**.

The permanent engineering rule for this repository should be:

> **No parser rule may depend on a particular demo page unless it lives exclusively inside a test fixture or optional compatibility adapter.**

The Code-to-Block importer should behave as a browser-aware ingestion and translation layer: parse broadly, understand conservatively, convert safely, preserve faithfully, isolate aggressively, and fail locally rather than globally.