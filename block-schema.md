# Adopted block schema

Phase 1 decision for the HTML/CSS-to-block converter.

## Contract

```text
BlockDocument = {
  schema_version: 1 | 2,
  name: string,
  feature_flags?: { guided_roles?: boolean },
  design_tokens?: {
    colors?: { [tokenId: string]: DesignToken },
    typography?: { [tokenId: string]: DesignToken },
    spacing?: { [tokenId: string]: DesignToken }
  },
  style_roles?: { [roleId: string]: StyleRoleRecipe },
  seo?: {
    title?: string,
    description?: string,
    canonical?: string,
    og_title?: string,
    og_description?: string,
    og_image?: string
  },
  imported_assets?: ImportedAssets,
  root: Block
}

ImportedAssets = {
  origin: {
    type: "code-import",
    import_session_id: string,
    source_hash: string
  },
  page_meta: {
    document_type?: "full-document" | "fragment",
    source_type?: "full-document" | "mixed" | "html-fragment" |
      "stylesheet" | "javascript" | "php" | "plain-text",
    detected_languages: Array<"html" | "css" | "javascript" | "php">,
    doctype?: string,
    title?: string,
    base_href?: string,
    html_attributes: object,
    body_attributes: object,
    metas: object[],
    links: object[]
  },
  stylesheets: Array<{
    id: string,
    source_text: string,
    scoped_source: string,
    selectors: string[],
    media_conditions: string[],
    keyframes: string[],
    custom_properties: string[]
  }>,
  token_bindings: { [cssVariable: string]: string },
  scripts: Array<{
    id: string,
    placement: "head" | "body" | "body-end",
    type: string,
    source: string,
    src?: string,
    attributes: object,
    enabled_in_editor: false,
    enabled_in_preview: boolean,
    enabled_on_publish: boolean,
    origin: "imported"
  }>,
  references: object[],
  diagnostics: object[]
}

DesignToken = {
  label: string,
  value: string,
  built_in?: boolean
}

StyleRoleRecipe = {
  id: string,
  kind: "typography" | "spacing",
  labelKey: string,
  descriptionKey: string,
  propertyTokenRefs: { [cssProperty: string]: string },
  variants: { [variant: string]: { [cssProperty: string]: string } },
  densityVariants?: { [variant: string]: { [cssProperty: string]: string } },
  supportedContexts: string[],
  builtIn: boolean,
  version: number
}

Block = {
  id: string,
  type: "container" | "text" | "image" | "button" | "woocommerce_cart" | "woocommerce_checkout" | "woocommerce_product" | "woocommerce_product_grid" | "form" | "form_field",
  tag: string,
  attributes: { [name: string]: string | boolean },
  children: Array<Block | TextNode>,
  styles: StyleSet,
  responsive_overrides?: {
    tablet?: StyleSet,
    mobile?: StyleSet
  },
  states?: {
    hover?: StyleSet,
    focus?: StyleSet
  },
  actions?: Array<{
    trigger: string,
    behavior: string,
    animation_type?: "css_native" | "js_library",
    params: object
  }>,
  is_content_slot?: boolean,
  slot_label?: string,
  slot_content_type?: "text" | "rich_text" | "image" | "link",
  is_dynamic?: boolean,
  dynamic_source?: "wc_product_title" | "wc_product_price" | "wc_product_short_description" | "wc_product_stock_status" | "wc_product_image",
  meta: {
    source: string,
    saved_component_id?: positive integer,
    css_mapping?: CssMapping
  }
}

Content slots are additive metadata on existing blocks, not a wrapper or
separate block type. They are single-value props: saving a `text` or
`rich_text` slot replaces that block's children with one text node. Rich text
stores constrained inline HTML (`a`, emphasis, underline, strike, `code`, and
line breaks); scripts, event attributes, style attributes, and unsupported
markup are removed. Page-local `slot_values` maps materialized linked-component
block IDs to per-instance values, preserving the shared component document.

CssMapping = {
  version: 1,
  declarations: Array<{
    property: string,
    value: string,
    important: boolean,
    origin: "stylesheet" | "inline" | "inherited",
    destination: "style-control" | "raw-css",
    control?: "color" | "padding" | "margin" | "font-size" |
      "font-weight" | "border" | "border-radius"
  }>
}

TextNode = {
  kind: "text",
  value: string
}

StyleSet = {
  mapped: { [cssProperty: string]: string },
  token_bindings?: { [cssProperty: string]: string },
  role_bindings?: {
    [scope: string]: {
      roleId: string,
      kind: "typography" | "spacing",
      typographyAdjustment?: { size: -1 | 0 | 1, density: -1 | 0 | 1 },
      spacingAdjustment?: { distance: -1 | 0 | 1 },
      overrides: Array<{
        property: string,
        value: string,
        breakpoint?: "desktop" | "tablet" | "mobile",
        state?: "hover" | "focus" | "active"
      }>,
      source: "built-in" | "user" | "legacy" | "imported"
    }
  },
  import_review_flags?: Array<{
    id: string,
    property: string,
    roleId: string,
    message: string
  }>,
  custom_css_fallback: string
}
```

## Decisions

- `children` is ordered and includes lightweight text nodes. This preserves mixed
  content such as `<p><span>$29</span>/month</p>` without pretending that raw
  text is a draggable HTML element.
- `attributes` is required. Styles alone cannot preserve image sources, alt
  text, link destinations, semantic classes, or other source markup.
- `composite` is not a primitive block type. Reusable compositions should be
  templates or patterns made from ordinary editable blocks. The hero is a
  `container`; its gradient overlay and image are two layers of one
  `background-image`, not three sibling elements.
- `type` describes editor behavior while `tag` preserves HTML semantics. For
  example, a CTA can be a `button` block rendered as an `<a>`.
- `mapped` stores declarations understood by the editor/renderer.
  `custom_css_fallback` stores declarations that must be preserved but do not
  have a mapped representation. It is a declaration list for that block, not a
  selector or a complete stylesheet.
- `meta.css_mapping` is an optional immutable import snapshot used by the
  selected-block Explain CSS view. It records each resolved winning declaration,
  its stylesheet/inline/inherited origin, and whether it reached a named control
  or the raw-CSS fallback. Later style edits do not rewrite this provenance.
  Losing cascade candidates and selector text are not stored, so the panel does
  not claim to be a complete cascade debugger.
- Responsive overrides, states, and actions are optional. A missing key means
  no override or behavior; an empty `StyleSet` is therefore unnecessary.
- Design tokens are optional document-scoped values in the fixed `colors`,
  `typography`, and `spacing` categories. Token IDs are stable lowercase slugs.
  A linked mapped value uses a generated `var(--ctb-token-...)` reference and
  `token_bindings` records its `category.id` source.
- A per-block token override keeps its `token_bindings` entry but stores a raw
  mapped value instead of the generated `var(...)` value. This makes divergence
  explicit and reversible without changing other consumers.
- Version 2 adds document-scoped semantic style roles without replacing tokens.
  A role recipe points to existing typography or spacing tokens, while a block
  stores only its role ID, bounded `-1/0/1` adjustment, and explicit local
  property overrides. Visual roles never change the block's HTML `tag`.
- Guided roles are release-gated by `feature_flags.guided_roles`. New documents
  seed the idempotent Balanced role/token library. Version-1 documents keep their
  raw styles unchanged during migration; approximate snapping is limited to the
  explicit import-normalization flow.
- A reusable component instance is a normal empty `container`/`div` block whose
  `meta.source` is `saved-component` and whose `saved_component_id` references a
  private component record. Component content is resolved only for rendering;
  it is never duplicated into the page document. Materialized children therefore
  must not be persisted under a component placeholder.
- Linked component placeholders cannot carry `css_mapping`; provenance remains
  on the canonical blocks inside the saved component.
- Saved component records use the same document envelope and canonical
  validator. They cannot contain nested saved-component links or page-bound PHP
  shortcode placeholders. Required design tokens travel with the component and
  are namespaced when linked instances are resolved; version-2 role recipes and
  bindings travel with them and are remapped on conflicts.
- Starter templates are static version-1 documents with `meta.source:
  "starter-template"` and no required server state. Replace resets history;
  insert clones the starter root with regenerated IDs and respects the same
  block/depth/size budgets.
- Resolution regenerates schema IDs, DOM IDs, DOM ID references, and structured
  action targets per instance. Aggregate resolved output retains the document's
  1,000-block, 50-level, and 2 MB limits; an instance that would exceed a limit
  fails locally instead of expanding the whole page.
- Source HTML event-handler attributes are not actions and are rejected during
  sanitization. Builder actions are explicit structured data. Imported raw
  scripts live separately in `imported_assets.scripts`: the server forces
  `enabled_in_editor` off, the editor iframe blocks script execution, and users
  without WordPress's `unfiltered_html` capability have both Preview/Publish
  flags forced off at every write boundary. Only the owning singular document
  may emit a script enabled for that mode. Safe script attributes are allowlisted;
  event attributes are never emitted.
- Imported stylesheets retain their original source for review and a separately
  sanitized, `.ctb-import-scope`-rewritten source for rendering. The scoped
  stylesheet is authoritative for its original cascade; per-block inline and
  builder styles remain overrides. `@import` is inventoried and quarantined.
- The visual editor uses a script-disabled iframe rather than Shadow DOM.
  Shadow DOM isolates selector matching but not viewport/fixed-position layout;
  the iframe makes document roots, viewport units, and fixed/absolute layout
  relative to the canvas while containing global CSS.
- Runtime IDs should be generated stable unique IDs. The readable IDs in the
  examples are fixture IDs only.
- `schema_version` is stored once on the document envelope so future migrations
  can be explicit.
- WooCommerce types (`woocommerce_product`, `woocommerce_product_grid`, `woocommerce_cart`, `woocommerce_checkout`) are additive envelope-preserving extensions. `woocommerce_product` is a container whose children use `is_dynamic` bindings to pull live product data via `wc_get_product`; `woocommerce_product_grid` loops `wc_get_products` over its single child-template and re-contexts each item's dynamic bindings. `is_dynamic/dynamic_source` is optional and additive — existing docs remain valid. Cart/Checkout render WooCommerce Blocks (`wp:woocommerce/cart`) not shortcodes, to avoid legacy `cart.js` table-structure fragility.
- Parity commerce extension (`Code_To_Block_Parity::visit_commerce`) flags `commerce` context warnings when WooCommerce is inactive or a `data-product-id` is missing, without touching style parity. Diagnostics `GET /code-to-block/v1/pages/{id}/diagnostics` lists active plugins with heuristic conflict flags (cart/checkout/ajax/payment/cache keywords) and `has_woo/commerce_blocks` counts; it never deactivates plugins.
- Form blocks (`form` container tag `form`, `form_field` tag `div` wrapper) are additive. `form` holds `data-submission` (`native` vs `external`), `data-email-to`, `data-external-shortcode` (only known shortcodes rendered via `do_shortcode`, others as note), and renders native hidden `_ctb_hp_*` honeypot + `_ctb_timestamp` + `_ctb_form_id` + submit. `form_field` holds `data-field-type`/`label`/`name`/`placeholder`/`required`/`options` and renders label+input/select/textarea/checkbox/radio/file via same style panel. Native submissions go to `POST /code-to-block/v1/forms/{post_id}/submit` with server-side honeypot/time/rate/log + validation + `wp_mail`, stored in `wp_code_to_block_submissions` + `wp_code_to_block_submission_logs`. File upload currently placeholder (no move_uploaded_file). External handoff renders whitelisted shortcodes only.
- Widget library (`src/widget-library.mjs` 8 widgets — pricing table, testimonial, icon box, countdown, stats, team, FAQ, gallery) are static block arrangements with `is_content_slot` slots, built on existing reusable-components + style panel. Insertion clones with fresh IDs via `insertWidget` reusing `commitDocument` and 1,000-block/50-depth/2 MB guards, not a second architecture. Parity `visit_forms` flags empty forms or required field missing name.

## Fit assessment

The schema fits all five fixtures without an opaque special case. Pricing is
the only mixed-content case and is handled by ordered text nodes. The hero's
layered background remains one editable container property. Navigation and
images require the added `attributes` field. The static fixtures do not contain
responsive rules, dynamic states, or actions, so those branches remain valid
but are not exercised by these examples.

The five hand-converted documents are in `block-examples.json`.
