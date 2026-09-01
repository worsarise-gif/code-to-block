# Upgrade Implementation Plan 6 — Full-Document HTML/CSS/JS Import Parser

**Purpose**: Upgrade the builder's existing **Import Code** feature so it can accept complete standalone HTML documents like the supplied portfolio example, including `<!DOCTYPE html>`, `<html>`, `<head>`, `<meta>`, `<title>`, one or more `<style>` blocks, full `<body>` markup, inline styles, responsive CSS, CSS custom properties, keyframes, and page-level `<script>` blocks. This implementation must also accept code copied from ChatGPT or rich-text surfaces where HTML has been escaped as `\<tag>`, CSS tokens appear as `\--variable`, JavaScript contains escaped punctuation such as `window\.scrollY`, and indentation contains entities such as `&#x20;`. The goal is to convert importable structure and styles into editable builder nodes while preserving advanced CSS/JavaScript safely; this extends the current Import Code feature and current builder node/control systems rather than creating a second renderer or a parallel page format.

## Non-negotiable implementation rules

1. **Normalize before parsing.** Never feed the raw pasted string directly into the HTML parser. The importer must first detect and reverse transport/markdown escaping without changing legitimate backslashes that belong to CSS or JavaScript.
2. **Use real parsers, not regex, for HTML/CSS structure.** HTML must be parsed with an HTML5-compliant parser and CSS with a CSS AST parser. Regex may only be used for narrow normalization/detection tasks.
3. **Do not flatten the import to one Custom HTML block.** Normal HTML elements must become normal editable builder nodes whenever the current builder has a compatible node/control representation.
4. **Do not attempt to convert arbitrary JavaScript into builder controls.** Preserve page scripts as page-level code assets. Imported scripts are disabled in normal edit mode and may execute only in an isolated preview/published runtime according to the builder's existing custom-code security policy.
5. **Preserve unsupported-but-valid CSS.** If a declaration cannot be represented by a native control, keep it in the imported stylesheet or per-node raw-style layer instead of deleting it.
6. **Preserve selector semantics.** Class selectors, IDs, descendant selectors, pseudo-classes, pseudo-elements, attribute selectors, CSS variables, media queries, and keyframes must not be destroyed by the conversion to native controls.
7. **Round-trip fidelity matters more than aggressive conversion.** Convert properties to native controls only when the conversion is lossless enough that editing the value does not change selector scope or responsive behavior unexpectedly.
8. **No import-time script execution.** Parsing an import must never execute `<script>`, event-handler attributes, `javascript:` URLs, or imported network code.
9. **The import operation is transactional.** A failed parse or validation must leave the existing page unchanged.
10. **Import warnings are non-destructive.** Unsupported features must be reported with source locations when possible, but valid content must still import.

## Step 1 — Add a staged import pipeline instead of a single parse call

Refactor the current Import Code handler into explicit stages with one typed result passed between stages:

```text
raw input
  -> transport normalization
  -> document extraction
  -> HTML AST
  -> CSS AST(s)
  -> script asset extraction
  -> asset/reference analysis
  -> builder-node conversion
  -> style/control mapping
  -> validation
  -> transactional commit
```

Create an import-session object similar to:

```ts
interface CodeImportSession {
  id: string;
  rawSource: string;
  normalizedSource: string;
  document: ParsedHtmlDocument | null;
  stylesheets: ImportedStylesheet[];
  scripts: ImportedScriptAsset[];
  nodes: BuilderNode[];
  pageMeta: ImportedPageMeta;
  warnings: ImportDiagnostic[];
  errors: ImportDiagnostic[];
  sourceMap: ImportSourceMap;
}
```

Do not make the UI responsible for parsing. The Import dialog should call one import service that owns the complete pipeline.

### Checkpoint for Step 1

Import a minimal `<div>Hello</div>` string. Confirm the same import service produces a session with a normalized source, one builder node, zero scripts, zero stylesheets, and no mutation of the current page until the final commit stage runs.

## Step 2 — Build a transport-normalization layer for escaped ChatGPT/rich-text HTML

Add `normalizeImportedCode(rawSource)` before HTML parsing. It must support both ordinary raw HTML and the escaped format shown in the supplied example.

The normalizer must recognize and safely reverse these transport artifacts:

```text
\<!DOCTYPE html>        -> <!DOCTYPE html>
\<html>                 -> <html>
\</html>                -> </html>
&#x20;                    -> a space when it is transport indentation/text encoding
&amp;                    -> & only through normal HTML entity decoding at the proper parse layer
\--primary-color        -> --primary-color
window\.scrollY         -> window.scrollY
window\.addEventListener -> window.addEventListener
hello\@example.com      -> hello@example.com when the backslash is a transport escape
\* / \*::before        -> * / *::before when escaped only for transport
```

Implement normalization conservatively:

- First normalize line endings to `\n`.
- Detect whether the source is transport-escaped by scoring HTML markers such as `\\<html`, `\\<body`, `\\<style`, and `\\</` rather than assuming every backslash is removable.
- If escaped markup is detected, unescape backslashes only when they precede characters known to have been added by the transport format (`<`, `>`, `@`, `.`, `*`, `-` in CSS custom-property prefixes, and similar confirmed cases).
- Do **not** globally run `source.replaceAll('\\', '')`; that would corrupt JavaScript regex literals, escape sequences, CSS strings, Unicode escapes, and Windows paths.
- Leave HTML entities to the HTML parser except for indentation-only artifacts that otherwise prevent document detection.
- Normalize a leading code fence such as ```html / ``` only when the entire paste is clearly fenced source code.
- Strip zero-width characters and BOM only at the document boundary.

Store both `rawSource` and `normalizedSource` in the import session for diagnostics.

### Checkpoint for Step 2

Paste the exact escaped opening portion from the provided sample. The normalized preview must start with exactly:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
```

Also run a regression input containing JavaScript regex `/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/`; confirm normalization does not remove the regex backslashes.

## Step 3 — Parse complete HTML5 documents and fragments with the same entry point

Use an HTML5-compliant parser that supports error recovery and preserves source locations where available. The importer must automatically distinguish:

- Full document: doctype/html/head/body present.
- Headless document: body-like nodes plus `<style>` or `<script>`.
- Fragment: ordinary copied markup such as `<section>...</section>`.

For a full document, extract:

```ts
interface ImportedPageMeta {
  doctype?: string;
  htmlAttributes: Record<string, string>;
  title?: string;
  metas: ImportedMetaTag[];
  links: ImportedLinkTag[];
  bodyAttributes: Record<string, string>;
}
```

The `<html>` and `<body>` elements are page roots, not ordinary nested builder elements. Convert their meaningful attributes into page-level settings. Children of `<body>` become the root builder-node list.

Preserve semantic tags rather than converting everything to `<div>`. At minimum support native node representation for:

`header`, `nav`, `main`, `section`, `article`, `footer`, `div`, `span`, `p`, `h1`-`h6`, `a`, `button`, `ul`, `ol`, `li`, `form`, `label`, `input`, `textarea`, `select`, `option`, `img`, `picture`, `video`, `audio`, `iframe`, `svg` when current builder capabilities allow it.

For valid tags without a dedicated node type, use the builder's generic HTML element node with the original tag name. Do not discard them.

### Checkpoint for Step 3

Import the supplied page and verify the root layer tree contains, in order, `Header`, `Main`, and `Footer`, with the Hero/About/Skills/Projects/Contact sections nested under Main. Confirm `<title>Alex Morgan | Front-End Developer</title>` is stored as page metadata rather than appearing on canvas.

## Step 4 — Convert DOM structure into editable builder nodes without losing attributes

Create a deterministic DOM-to-builder conversion mapper. Every imported element must receive a builder node ID that is separate from the HTML `id` attribute.

Persist, when present:

- Original tag name.
- `id`.
- All classes in original order.
- `data-*` attributes.
- `aria-*` attributes.
- `role`.
- `title`.
- `href`, `target`, `rel`.
- Form attributes such as `name`, `type`, `required`, `autocomplete`, `rows`, `placeholder`, `novalidate`.
- Inline `style` source and parsed declarations.
- Text nodes, including mixed inline text around child spans.

Do not turn meaningful whitespace/indentation into text nodes in the layer tree. Preserve intentional text spacing inside inline content.

Map common semantic content into existing controls. Examples:

- `<h1>` -> Heading node; tag control = H1.
- `<p>` -> Text/paragraph node.
- `<a class="button ...">` -> Link/Button-compatible node when conversion is lossless; otherwise generic anchor node with native styling controls.
- `<form>` -> Form/container node if the builder already supports arbitrary form markup; otherwise generic form element preserving child controls.
- `<input>` and `<textarea>` -> native form-field nodes where available.

This extends the existing node/control registry; do not create import-only duplicates of Heading, Text, Button, Container, or Form controls.

### Checkpoint for Step 4

Select the imported hero H1. Its builder controls must show tag `H1`, its text must include the nested `Front-End Developer` span, and the span must remain independently selectable or editable through the builder's existing rich-text/child-node mechanism. Select the Contact email input and verify `type=email`, `name=email`, `autocomplete=email`, placeholder, and `required` survived import.

## Step 5 — Parse every `<style>` block into a CSS AST

Extract all inline `<style>` elements in document order. Parse them with a standards-aware CSS parser that retains at-rules, declarations, selector text, custom properties, comments/source locations where supported, and invalid-rule diagnostics.

Support at minimum:

- Normal qualified rules.
- `:root` custom properties.
- Attribute-theme selectors such as `html[data-theme="dark"]`.
- `@media`.
- `@supports`.
- `@font-face`.
- `@keyframes`.
- Nested selector lists.
- Pseudo-classes such as `:hover`, `:focus-visible`, `:first-child`, `:last-child`, `:nth-child()`.
- Pseudo-elements `::before`, `::after`.
- CSS functions including `min()`, `max()`, `clamp()`, `calc()`, `var()`, gradients, and filters.
- CSS custom properties containing arbitrary token values.

Store an ordered stylesheet representation so the cascade can be reproduced. Never split media rules away from their source order.

### Checkpoint for Step 5

From the supplied CSS, confirm the parser records `:root`, `html[data-theme="dark"]`, all three responsive breakpoints (`1050px`, `820px`, `600px`), the reduced-motion media query, and all four keyframe names (`fade-up`, `fade-in`, `float`, `scroll-down`). There must be no parser error caused by `clamp()`, gradients, `backdrop-filter`, or CSS variables.

## Step 6 — Import CSS variables into the existing token/variable system where safe

This **extends the existing token system, not a new one**.

Map `:root` custom properties to existing builder design variables when their values can be represented safely. Preserve the original CSS variable name as the external/source name.

Examples from the supplied page:

```text
--primary-color: #6c5ce7        -> Color token
--background-color: #f8f9fc     -> Color token
--container-width: 1180px       -> Size/number token
--header-height: 80px           -> Size/number token
--border-radius-medium: 18px    -> Size/number token
--transition: 0.3s ease         -> Raw/custom token if no native transition-token type exists
```

Do not silently rename variables in CSS. Maintain a mapping:

```ts
sourceCssVariableName -> builderTokenId
```

When a mapped token is edited in the builder, regenerate the corresponding CSS custom-property value or resolve it through the builder's variable runtime without breaking existing `var(--name)` references.

Theme-scoped redefinitions such as `html[data-theme="dark"] { --background-color: ... }` must be stored as a theme/state override of the same token if the builder has theme-aware tokens. If it does not, preserve that rule in the stylesheet AST and show the token as having an external CSS override rather than flattening the dark value into the light value.

### Checkpoint for Step 6

After importing the sample, the design-variable browser must expose `--primary-color` with `#6c5ce7` as the default value. Changing that token to another color must update all imported elements using `var(--primary-color)` without manually editing each element. Switching the sample's `data-theme="dark"` in preview must still use the dark override defined in the imported stylesheet.

## Step 7 — Build a selector-to-node matching index without rewriting selector scope

For each stylesheet rule, calculate which imported nodes currently match the selector using the same DOM structure used by the preview renderer. Store matches for inspector display and native-control mapping, but retain the original selector and rule as source of truth.

Example rule:

```css
.hero-content .section-label {
    justify-content: center;
}
```

must not become an inline style on one current node if that would destroy its class-based reuse semantics.

Class rules shared by multiple elements remain class rules. ID rules remain ID rules. Parent/descendant selectors remain scoped selectors. Pseudo-element rules remain stylesheet rules because they do not correspond to ordinary DOM nodes.

Provide each selected builder node a `Styles from imported CSS` inspector view showing matched selectors ordered by cascade/specificity/source order.

### Checkpoint for Step 7

Select a `.button-primary` element. The inspector must show declarations coming from `.button`, `.button-primary`, and applicable state rules such as `.button-primary:hover`, without copying all declarations into the element's inline/local style object.

## Step 8 — Map lossless CSS declarations to existing native controls

Create a property adapter registry that maps parsed CSS declarations to current builder controls only when the source rule and breakpoint/state can be represented correctly.

At minimum provide adapters for:

- Typography: family, size, weight, style, line-height, letter-spacing, transform, alignment, color.
- Dimensions: width, height, min/max width/height.
- Spacing: margin, padding, gap, row-gap, column-gap.
- Layout: display, position, inset/top/right/bottom/left, flex properties, grid templates/gaps where supported.
- Backgrounds: solid color, gradients, images.
- Borders: width/style/color/radius.
- Effects: opacity, box-shadow, filter, backdrop-filter where supported.
- Transforms and transitions.
- Overflow.
- Object fit/position.
- Z-index.

A native control should display the **computed/imported source value**, including CSS functions such as `clamp(2.2rem, 5vw, 4rem)` and `calc(var(--header-height) + 20px)`, if the existing Advanced control accepts expressions. Simple-mode role controls may recommend a semantic value, but must not automatically replace imported exact values during import.

If the control cannot represent a value losslessly, show it as `Imported CSS`/raw declaration rather than coercing it.

### Checkpoint for Step 8

Select the imported H1. Advanced typography must show the source font-size expression `clamp(3.2rem, 8vw, 6.8rem)` and letter-spacing `-0.065em`. Select `.section`; spacing must reflect `padding: 120px 0` at the base breakpoint while retaining mobile overrides from the imported media rules.

## Step 9 — Convert media queries into the existing responsive system without losing custom breakpoints

This **extends the existing responsive control system, not a second breakpoint system**.

Map a media query to native responsive values when its breakpoint matches or can be represented by the builder's breakpoint model. For custom breakpoints that do not match built-in breakpoint IDs, create/import a project breakpoint if the builder supports custom breakpoints. Otherwise retain the media query in the imported stylesheet and surface it as a protected custom breakpoint rule.

For the supplied page, recognize:

```text
@media (max-width: 1050px)
@media (max-width: 820px)
@media (max-width: 600px)
@media (prefers-reduced-motion: reduce)
```

Do not reinterpret `prefers-reduced-motion` as a viewport breakpoint; store it as an environment/media-condition rule.

Responsive edits made through native controls should update the matching imported rule when ownership is unambiguous. If ownership is ambiguous because multiple selectors/rules affect the same property, create a builder-managed override rule after the imported stylesheet instead of destructively rewriting unrelated source rules.

### Checkpoint for Step 9

Preview at 1200px, 800px, and 560px. The project grid, navigation, form rows, hero layout, and other sample components must follow the supplied CSS. Confirm the 820px mobile navigation rules activate below 820px and the 600px single-column form/grid rules activate below 600px.

## Step 10 — Preserve pseudo-classes and pseudo-elements as editable state/style rules

Map supported interactive states into the existing state-control system:

- `:hover` -> Hover state.
- `:focus` / `:focus-visible` -> Focus state.
- `:active` -> Active state.
- `:disabled` -> Disabled state when supported.

Do not create DOM nodes for `::before` or `::after`. Expose pseudo-element styling under an `Imported pseudo-elements` subsection or the builder's existing pseudo-element controls if present.

Structural selectors such as `:first-child`, `:last-child`, and `:nth-child()` remain stylesheet selectors unless the builder already supports them as conditional selector controls.

### Checkpoint for Step 10

Select the primary button and switch to Hover state. The inspector must reveal its imported hover background/shadow behavior. Confirm `.section-label::before` remains visible on canvas and is represented as a pseudo-element rule, not as an inserted child div.

## Step 11 — Preserve keyframes, animations, transitions, and reduced-motion behavior

Keep imported `@keyframes` definitions as page stylesheet assets. Native animation controls may reference an imported keyframe by name, but the importer must not approximate a multi-step keyframe into a different built-in animation.

For declarations such as:

```css
animation: fade-up 0.8s ease both;
animation: float 4s ease-in-out infinite;
transition: transform var(--transition), ...;
```

show the values in existing animation/transition controls where compatible; otherwise retain them as raw CSS declarations.

The `prefers-reduced-motion` stylesheet block must remain active in preview/published output.

### Checkpoint for Step 11

Preview the imported page with normal motion: hero fade/float behaviors must run. Emulate `prefers-reduced-motion: reduce`: animations/transitions must collapse according to the supplied CSS rule.

## Step 12 — Extract scripts as page-level code assets and never execute them in edit mode

Extract each `<script>` block before builder rendering and store it in the existing page custom-code/script system. If there is no page-level script asset type, add one to the current custom-code system rather than storing JavaScript on arbitrary nodes.

Use a model similar to:

```ts
interface ImportedScriptAsset {
  id: string;
  placement: 'head' | 'body-end' | 'body';
  type: string;
  source: string;
  src?: string;
  attributes: Record<string, string>;
  enabledInEditor: false;
  enabledInPreview: boolean;
  enabledOnPublish: boolean;
  origin: 'imported';
}
```

Rules:

- Inline imported JavaScript never runs during parsing.
- Imported JavaScript never runs inside the builder's main application window.
- Normal edit canvas renders with imported scripts disabled by default.
- Explicit Preview uses an isolated same-origin/sandbox policy appropriate to the builder architecture, with scripts enabled only inside the preview document.
- Published output includes approved/preserved page scripts according to the builder's existing custom-code permission model.
- External `src` scripts are not fetched during import; record the URL and warn if the domain is external.
- Inline event attributes such as `onclick` must be extracted or blocked according to current security policy; do not execute them in editor mode.

Do **not** try to infer native builder interactions from arbitrary JavaScript in this upgrade. The supplied script can remain a page-level script and operate against its preserved IDs/classes in preview/publish.

### Checkpoint for Step 12

Import the supplied page. In normal edit mode, clicking the theme toggle or project filter must not execute imported JavaScript. In Preview, the theme toggle, mobile menu, active navigation logic, project filtering, skill animation, placeholder-link prevention, and contact validation must execute inside the preview document. No imported script may obtain a reference to or modify the builder application's own DOM.

## Step 13 — Preserve DOM IDs/classes required by imported JavaScript

Because the supplied script queries IDs/classes such as `site-header`, `theme-toggle`, `menu-toggle`, `navigation-menu`, `.nav-link`, `.filter-button`, and `.project-card`, do not regenerate or remove those DOM-facing identifiers during import.

Builder internal IDs must use a separate namespace/property. Rendering must emit imported DOM IDs/classes unchanged unless the user edits them.

When duplicate HTML IDs are detected, import all content but produce a warning listing every duplicate and affected node. Do not silently rewrite IDs because that may break CSS/JS behavior.

### Checkpoint for Step 13

Preview the sample and verify `document.getElementById("theme-toggle")` and all other supplied selectors resolve exactly as they did in the standalone document. Confirm builder node IDs are different internal values and do not appear as replacements for imported DOM IDs.

## Step 14 — Handle inline custom properties and arbitrary style attributes

Parse inline `style` attributes with the CSS declaration parser. Preserve custom properties such as:

```html
<div class="skill-progress-bar" style="--progress: 95%;"></div>
```

Expose `--progress` in the node's Custom Properties/Variables section and keep it available to stylesheet rules using `var(--progress)`.

Other inline declarations should map to native controls where lossless. Maintain inline specificity on export/render.

### Checkpoint for Step 14

Import the six skill cards. Each progress bar must preserve its distinct `--progress` value (`95%`, `92%`, `85%`, `90%`, `82%`, `80%`), and Preview must render different progress lengths after the imported script adds the `visible` class.

## Step 15 — Add safe URL and asset-reference analysis

Scan imported HTML/CSS for references rather than immediately downloading them:

- `<img src>` / `srcset`.
- CSS `url(...)`.
- `<link rel="stylesheet">`.
- Script `src`.
- Fonts.
- Anchor URLs.
- `mailto:` / `tel:`.
- Fragment links such as `#about`.

Preserve benign URLs. Block or quarantine dangerous executable URL schemes such as `javascript:` according to the builder security policy. Do not rewrite fragment links; imported navigation depends on them.

External assets should be marked as external unless the current importer already has an explicit asset-ingestion feature. Do not make this upgrade unexpectedly download third-party resources.

### Checkpoint for Step 15

Verify `href="#about"`, `mailto:hello@example.com`, and `tel:+639123456789` remain intact. Import a regression sample containing `href="javascript:alert(1)"`; it must be disabled/quarantined and reported as a security diagnostic without executing.

## Step 16 — Add an Import Review screen before committing

After parsing and before page mutation, show a review summary inside the existing Import Code dialog:

```text
Document detected: Full HTML document
Builder nodes: 150
Stylesheets: 1 inline
CSS variables: 18 detected / 17 mapped
Media conditions: 4
Keyframes: 4
Scripts: 1 inline (Preview/Publish only)
External assets: 0
Warnings: 2
Errors: 0
```

Provide tabs or expandable panels for:

- Structure.
- Styles.
- Scripts.
- Metadata.
- Warnings/errors.

Show a normalized-source preview so the user can verify escaped input was decoded correctly.

The primary action is `Import into Builder`. Disable it only for fatal errors that prevent constructing a safe document. Non-fatal unsupported CSS/HTML must not block import.

### Checkpoint for Step 16

Paste the supplied escaped document. Before committing, the review screen must identify it as a full document, detect one inline stylesheet and one inline script, display the title metadata, and show no fatal error merely because the input originally used `\<` and `&#x20;` transport escaping.

## Step 17 — Make import transactional and undoable

Build the complete candidate page/state in memory first. Run schema validation before writing it into the editor store.

On successful commit:

- Create one undo-history boundary named `Import HTML document`.
- Apply page metadata.
- Insert/replace nodes according to the current import mode.
- Register imported stylesheet assets.
- Register design-variable mappings.
- Register script assets.
- Trigger one final render/recompute.

If any fatal error occurs before commit, discard the candidate state and leave the page exactly unchanged.

A single Undo action immediately after import must restore the exact pre-import page.

### Checkpoint for Step 17

Create a page containing one heading, import the supplied document, then press Undo once. The original one-heading page must return, including its settings, with no leftover imported stylesheet, token, script, or page metadata assets.

## Step 18 — Add import ownership metadata so later editing remains predictable

Tag imported style assets/rules with stable IDs and origin metadata:

```ts
origin: {
  type: 'code-import';
  importSessionId: '...';
  sourceRange?: { start: number; end: number };
}
```

When native controls edit a property sourced from imported CSS:

1. If exactly one imported declaration owns the value and rewriting it is structurally safe, update that declaration through the CSS AST.
2. If changing it would alter unrelated nodes or selector scope, create a builder-managed override rule with the correct node/class/state/breakpoint target.
3. Never silently convert a shared class rule into one element's inline style.

Expose the source in Advanced mode, e.g. `Imported from .skill-card @ base` or `Imported from @media (max-width: 600px) .contact-form`.

### Checkpoint for Step 18

Change `.skill-card` border radius through the inspector. All skill cards should update when the shared class rule is intentionally edited. Then choose a single skill card and create a local override; only that card should change, while the original `.skill-card` rule remains intact.

## Step 19 — Keep Simple/Advanced controls compatible with imported exact values

The existing Guided Roles / Simple-Advanced control architecture remains in effect.

For imported content:

- Simple mode may infer and display a suggested visual role such as Page Title, Section Heading, Body Text, or Card Heading.
- Do not automatically replace imported CSS with the suggested role.
- Mark exact source-driven styling as `Imported exact style` when it does not match a role recipe.
- `Use recommended role` must be an explicit user action.
- Advanced mode exposes the original exact value/expression and selector origin.

This prevents the import feature from destroying faithful HTML/CSS reproduction while still making imported pages compatible with the beginner-friendly control system.

### Checkpoint for Step 19

Select the imported H2. Simple mode may recommend `Section Heading`, but the canvas must continue using its original `clamp(2.2rem, 5vw, 4rem)` until the user explicitly applies the recommended role.

## Step 20 — Add diagnostics for features the builder cannot natively edit

Use structured diagnostics:

```ts
type ImportDiagnostic = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  source?: 'html' | 'css' | 'script';
  line?: number;
  column?: number;
  nodeId?: string;
  ruleId?: string;
};
```

Examples:

- `CSS_PROPERTY_PRESERVED_RAW`
- `SELECTOR_NOT_NATIVE_EDITABLE`
- `CUSTOM_MEDIA_CONDITION_PRESERVED`
- `SCRIPT_DISABLED_IN_EDITOR`
- `EXTERNAL_SCRIPT_NOT_FETCHED`
- `DUPLICATE_HTML_ID`
- `UNSAFE_URL_BLOCKED`
- `HTML_PARSE_RECOVERED`

Warnings should explain what was preserved, not merely say `unsupported`.

### Checkpoint for Step 20

Import a CSS rule using an intentionally unsupported property. The page must still import, the declaration must still render through the raw stylesheet layer, and the review must show a warning stating that the declaration was preserved but is not available as a native control.

## Step 21 — Provide a fidelity fallback for nodes the builder cannot model

When an individual subtree uses markup the current builder genuinely cannot represent safely, create a **scoped fallback node only for that subtree**, not for the whole page. The fallback node stores the original HTML subtree and participates in normal layout as a child of the nearest editable parent.

Mark it clearly as `Imported HTML (advanced)` and allow opening the source. Its CSS still participates in the page stylesheet.

Never use this fallback merely because a node contains classes or complex CSS; normal semantic HTML should still become normal nodes.

### Checkpoint for Step 21

Import a regression document containing one unsupported custom element inside an otherwise ordinary section. The section and surrounding headings/paragraphs must remain native editable nodes, with only the unsupported subtree represented by a fallback node.

## Step 22 — Support re-import and replacement without multiplying assets

Add an import fingerprint derived from normalized source plus asset IDs. If the user imports the same document again into `Replace current page` mode, do not create duplicate imported token definitions, stylesheets, or script assets.

For `Insert into current page` mode, scope page-level concerns carefully:

- Body/root metadata should not overwrite existing page metadata without explicit confirmation.
- Global stylesheet rules that target `body`, `html`, or generic tags may affect the existing page; show a scope-impact warning before insertion.
- Page scripts are not auto-enabled for inserted fragments unless the user explicitly chooses to include them.

### Checkpoint for Step 22

Import the sample as a replacement twice. Token/style/script asset counts must remain stable on the second import. Then attempt to insert it into an existing page; the review screen must warn that global `html`, `body`, heading, and class rules can affect existing content.

## Step 23 — Add parser/security regression fixtures based on this exact document format

Add the supplied portfolio document as a sanitized automated test fixture in two forms:

1. Normal standalone HTML.
2. Escaped transport form using `\<...>`, `&#x20;`, `\--variable`, `window\.` and similar artifacts from the provided paste.

The normalized AST and builder conversion results for both fixtures must be equivalent for meaningful content.

Add additional fixtures for:

- HTML fragment only.
- Multiple `<style>` blocks.
- Multiple scripts.
- CSS with invalid declaration followed by valid declarations.
- Nested media/supports rules if parser supports them.
- CSS variables and theme overrides.
- SVG.
- Forms.
- Duplicate IDs.
- Dangerous URL schemes.
- Inline event handlers.
- Script containing regex/backslash escapes.
- Text containing a legitimate literal backslash.
- `@font-face` and external URLs.

### Checkpoint for Step 23

Run the importer test suite. The raw and escaped versions of the portfolio fixture must produce the same root node sequence, same CSS rule count, same token-source names, same media/keyframe inventory, and semantically equivalent page script source after normalization.

## Step 24 — Add end-to-end acceptance tests for the supplied portfolio

Create an automated or scripted end-to-end scenario that imports the supplied portfolio and validates all of the following:

1. Full document is accepted without requiring the user to manually remove doctype/head/style/script.
2. Escaped markup is normalized automatically.
3. Header, Main sections, and Footer appear in the Layers panel.
4. Text, headings, links, buttons, cards, forms, and fields remain individually editable.
5. Root CSS variables are available through the existing token system where supported.
6. Dark-theme variable overrides remain functional.
7. Base, 1050px, 820px, and 600px viewport behavior matches the source.
8. Pseudo-elements render.
9. Hover/focus styles render.
10. Keyframe animations render in Preview.
11. Reduced-motion behavior is preserved.
12. Inline `--progress` custom properties survive.
13. The imported script is disabled in edit mode.
14. The imported script works inside Preview.
15. Contact form validation behaves as the source defines in Preview.
16. Project filtering behaves as the source defines in Preview.
17. Theme toggling and localStorage behavior work only inside the preview/published page context.
18. No imported script mutates the builder shell.
19. One Undo restores the pre-import page.
20. Saving and reopening the project preserves the converted nodes, imported stylesheet, variables, metadata, and script asset.

### Checkpoint for Step 24

The feature is not accepted until the exact supplied escaped portfolio source can be pasted directly into Import Code, committed without source preprocessing by the user, edited as builder elements, and previewed with visual/responsive/interactive behavior materially matching the standalone source.

## Recommended internal module boundaries

Use names appropriate to the existing codebase, but keep responsibilities separated along these lines:

```text
ImportCodeService
  ImportSourceNormalizer
  HtmlDocumentParser
  HtmlToBuilderMapper
  CssImportParser
  CssSelectorIndex
  CssToControlAdapterRegistry
  ImportedTokenMapper
  ImportedResponsiveMapper
  ImportedScriptManager
  ImportSecurityScanner
  ImportDiagnosticsCollector
  ImportTransaction
```

Do not expose parser-library-specific AST objects directly throughout the UI/store. Convert them behind stable importer interfaces so the parsing library can be upgraded without rewriting the builder.

## Suggested import result model

The coding agent may adapt names to existing schemas, but the final state must represent these concepts:

```ts
interface ImportedPagePackage {
  schemaVersion: number;
  meta: ImportedPageMeta;
  nodes: BuilderNode[];
  styles: {
    astAssetId: string;
    sourceText: string;
    rules: ImportedRuleRef[];
  }[];
  tokens: ImportedTokenBinding[];
  scripts: ImportedScriptAsset[];
  diagnostics: ImportDiagnostic[];
  origin: {
    type: 'code-import';
    importSessionId: string;
    sourceHash: string;
  };
}
```

Persist source text or a lossless/reconstructable AST representation for imported CSS so unsupported declarations and rule ordering survive save/reload/export.

## What determines this file is complete

This upgrade is complete when a user can paste the exact full escaped HTML document supplied with this plan into the existing Import Code feature without manually stripping escapes, `<head>`, `<style>`, or `<script>`; the importer produces a normal editable builder tree; supported CSS is surfaced through existing native controls without destroying selector/cascade semantics; unsupported valid CSS remains active through the imported stylesheet layer; CSS custom properties integrate with the existing token system where safe; responsive rules, pseudo-states, pseudo-elements, keyframes, and reduced-motion rules are preserved; JavaScript is retained as a page script but never executed in edit mode or in the builder shell; Preview reproduces the page's intended interactions; import is reviewable, transactional, undoable, saveable, and covered by raw-versus-escaped regression fixtures. The implementation must favor faithful round-trip behavior over aggressive conversion and must never solve complexity by collapsing the entire document into one Custom HTML node.

## What this file does NOT include

This file does not build a general JavaScript-to-visual-interaction compiler, does not automatically convert arbitrary third-party scripts into native builder actions, does not download or permanently ingest remote assets unless that capability already exists elsewhere, does not redesign the builder's existing control UI, does not replace the current token/preset/responsive systems, does not automatically refactor imported class naming, and does not guarantee that every future browser CSS feature has a native control. Those features may be handled by later upgrades. This file is specifically responsible for accepting, normalizing, parsing, preserving, safely executing where appropriate, and making editable the full-document HTML/CSS/JS format represented by the supplied portfolio example.
