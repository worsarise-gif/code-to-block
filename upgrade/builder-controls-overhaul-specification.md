# Builder controls overhaul — architecture and implementation specification

**Project:** Code to Block WordPress page builder  
**Specification date:** 2026-09-01  
**Research cutoff:** 2026-09-01  
**Scope:** Architecture, UX, data model, migration, implementation sequencing, and verification. No implementation code is included.

## 1. Executive summary

The builder should keep the familiar **Content / Style / Advanced** top-level model, but the meaning of those tabs must become strict:

- **Content** edits the selected element's data, semantics, and functional behavior.
- **Style** edits the visual presentation of that element and its explicitly registered internal parts.
- **Advanced** contains placement, motion, visibility/conditions, attributes/accessibility, permissions, performance, and developer escape hatches. It must not repeat the Style tab.

The replacement architecture is a declarative **element definition registry** backed by configured capabilities, reusable control groups, registered style targets, sparse breakpoint/state contexts, and a versioned document migration layer. A Button and a Heading can reuse the same typography implementation without receiving the same interface. The Button definition grants typography to its `label` target and exposes link/icon behavior; the Heading definition grants typography to its `text` target and exposes semantic heading levels. Unsupported groups never enter the resolved panel model.

The current `type + tag` pair is too coarse to drive a professional inspector. A new stable element identifier such as `core/button`, `core/heading`, or `forms/select` must distinguish elements that currently collapse into `text`, `container`, or `form_field`. Existing `tag`, `attributes`, `children`, `styles`, `responsive_overrides`, and `states` remain readable through a v1/v2 adapter while schema v3 is introduced.

The plan deliberately preserves the repository's useful foundations: immutable history commits, design tokens, guided roles, sparse responsive overrides, safe CSS parsing, importer classification, server-side schema validation, WordPress revisions/autosaves, element permissions, and editor/frontend parity checks. It replaces the global `STYLE_CONTROL_FIELDS` UI, traversal-index selectors, repeated Style/Advanced panels, raw CSS property strings as primary controls, and the current use of `!important` on every mapped declaration.

The first release should make the current first-class elements excellent before adding the whole recommended library. Section, Container, Heading, Paragraph, Button, Image, Divider, Embed, Form, Form Field, and the existing WooCommerce types are migration-critical. Row, Column, Rich Text, Icon, Video, Menu, Accordion, Tabs, Gallery, Slider/Carousel, and the remaining requested elements then land on the same registry rather than creating parallel systems.

## 2. Research findings

### 2.1 Divi 5: patterns to adopt and patterns to constrain

Divi 5 remains the primary reference because its current interface opens the selected element in a persistent settings panel with Content, Design, and Advanced tabs; it also provides panel search, modified/variable filters, presets, and contextual responsive/hover controls. Its current documentation explicitly describes Content as text/images/links and the panel as element-specific. See [Divi 5 Visual Builder Interface](https://help.elegantthemes.com/en/articles/12991185-divi-5-visual-builder-interface) and [Part 2: Exploring Every Aspect of the Divi 5 Interface](https://help.elegantthemes.com/en/articles/15501608-part-2-exploring-every-aspect-of-the-divi-5-interface).

The strongest architectural evidence is in Divi's developer documentation. Built-in module attributes separate `innerContent`, `decoration`, `advanced`, and `meta`, then place breakpoint and state dimensions below an option attribute. Module metadata enables only the decoration groups a module needs, links them to named settings groups, and assigns priorities. See [Module Attributes](https://dev.elegantthemes.com/docs/tutorials/module/beginner/module-attributes/) and [Settings metadata](https://dev.elegantthemes.com/docs/explanations/module/module-metadata/attributes/settings/).

Divi 5's composable settings demonstrate a useful sub-element model: a title, button, or image part can opt into sizing, border, background, transform, or animation without flattening those controls into the module root. The clean-panel behavior is valuable, but this builder must constrain which groups can be enabled per target; it must not allow semantically nonsensical combinations such as typography on a spacer. See [Composable Settings in Divi 5](https://help.elegantthemes.com/en/articles/14332889-composable-settings-in-divi-5).

Divi's responsive editor validates three UX requirements: store only explicit overrides, show inherited values visually, and let users inspect multiple breakpoint/state values without repeatedly changing the canvas. Current Divi supports a state picker and up to seven customizable breakpoints. This specification starts with the repository's desktop/tablet/mobile contract and makes the registry extensible instead of immediately multiplying breakpoints. See [Responsive Editor in Divi 5](https://help.elegantthemes.com/en/articles/13002269-responsive-editor-in-divi-5-visual-builder) and [Making Your Divi 5 Website Fully Responsive](https://help.elegantthemes.com/en/articles/15703949-part-12-making-your-divi-5-website-fully-responsive).

Divi's element presets and option-group presets support the correct separation between a complete Button preset and a reusable Border or Typography preset. The builder should adopt that distinction while preserving design tokens as atomic values. See [Mastering Divi 5 Presets](https://help.elegantthemes.com/en/articles/15530394-part-4-mastering-divi-5-presets-for-faster-more-consistent-web-design).

Divi's consolidated custom-attribute group is also the correct direction: IDs, classes, ARIA, data attributes, and native attributes belong in one validated target-aware system, with legacy attribute fields migrated. See [Custom Attributes in Divi 5](https://help.elegantthemes.com/en/articles/12274853-custom-attributes-in-divi-5).

### 2.2 Comparison builders

| Builder | Confirmed useful pattern | Adaptation for Code to Block |
|---|---|---|
| Elementor | Its developer API distinguishes data, multi-value, unit, UI, and group controls; it supports responsive controls, conditions, selectors, global styles, and dynamic data. [Elementor Editor Controls](https://developers.elementor.com/docs/editor-controls/index.html) | Use a typed control catalog and composite groups, but resolve groups from the element definition instead of mounting one universal list. |
| Elementor | Responsive values inherit from larger to smaller breakpoints and inherited values are visually muted. [Responsive editing](https://elementor.com/help/responsive-editing/) | Keep the existing desktop → tablet → mobile cascade, add source indicators, and delete cleared overrides rather than serializing copies. |
| Bricks | The active styling target is explicit: element ID, global class, selector/pseudo state, and breakpoint. Content controls are element-specific while style controls affect the active target. [Adding & Editing Elements](https://academy.bricksbuilder.io/builder/interface/editing-elements/) | Put a target/state/breakpoint context bar at the top of Style; never hide the target being edited. |
| Bricks | Conditions are evaluated server-side and failing elements remain visible in the builder for editing. [Element Conditions](https://academy.bricksbuilder.io/builder/features/element-conditions/) | Treat conditions as frontend display logic, not security; show a builder badge and ghosted preview rather than removing the node. |
| Breakdance | A setting declares whether it is responsive; custom breakpoints can appear in the same picker; the previous breakpoint value can be shown as a placeholder. [Responsive Design](https://breakdance.com/documentation/builder/basics/responsive-design-preview/) | Responsive support belongs on each control definition and target capability, not on every value indiscriminately. |
| Breakdance | Global styles include colors, typography, buttons, forms, and WooCommerce parts. [Global Styles Overview](https://breakdance.com/documentation/design/global-settings/global-styles-overview/) | Add element-family global styles after tokens, with a clear scope and precedence model. |
| Gutenberg | `block supports` is opt-in and can be configured at sub-capability level; the editor only shows a UI that the block declares. [Block Supports](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-supports/) | Capabilities must be configured grants, not a bag of broad `supportsEverything` booleans. |
| Gutenberg | `theme.json` consolidates core/theme/user origins, supports per-block settings, and reduces redundant CSS. [Global Settings & Styles](https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/) | Preserve origin metadata, calculate precedence explicitly, and generate only declarations that differ from lower layers. |
| Webflow | The Style panel always exposes the active class/selector, state, inheritance chain, and affected element count. [Style panel overview](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview) | Show whether editing local element, preset, or global role; warn before a shared edit affects multiple nodes. |
| Webflow | Focus and focus-visible are distinct states. [States](https://help.webflow.com/hc/en-us/articles/33961301727251-States) | Make `focus-visible` the default keyboard state and retain `focus` only for cases that need it. |

### 2.3 Research conclusions

1. The tab model works when each tab has a strict contract; the labels do not fix a generic resolver.
2. Element-specific UI and reusable internals are compatible when capabilities configure shared groups.
3. Sub-element targets are necessary for forms, navigation, accordions, tabs, testimonials, galleries, and commerce modules.
4. Breakpoint and state are dimensions of a value, not duplicate tabs or duplicate element definitions.
5. Presets need at least two scopes: complete element presets and reusable control-group presets.
6. Search, Modified, Inherited, Variables, and Errors filters reduce hunting without silently hiding supported settings.
7. Progressive disclosure should expose recommended groups by default and an explicit **Add style group** menu containing only valid optional groups.
8. Conditions must be server-evaluated, accessibility must be validated by target/tag, and custom CSS must remain an escape hatch rather than the primary storage model.

## 3. Problems with the current control architecture

### 3.1 Repository facts

- `src/components/RightInspector.js` hardcodes the Content UI around the selected tag. Every non-void element receives the same Title textarea and a tag dropdown containing `h1`, `h2`, `h3`, `p`, `div`, and `span` regardless of semantic validity.
- Content contains `text-align` and responsive visibility even though both are presentation/advanced concerns.
- Link fields appear only when `tag === 'a'`; a button-like link is not resolved from `type === 'button'`. Media source fields are limited to `img` and `iframe`.
- `src/custom-css.mjs` defines one global `STYLE_CONTROL_FIELDS` array. It classifies almost every professional control as `advanced`, including typography and spacing, and does not encode element, target, state, unit, validation domain, output mapper, or accessibility implications.
- `src/index.js` renders `MappedStyleControls` in both Style and Advanced. Style uses `panelMode="simple"`; Advanced repeats the same component with `panelMode="advanced"`. Advanced is therefore a larger Style tab plus attributes, CSS, motion, actions, diagnostics, and accessibility.
- Search infrastructure exists as a parameter, but both inspector calls pass an empty query. There is no live control search in the current inspector.
- The five current taxonomy groups mix concerns: `Layout & Sizing` also contains padding, margin, position, z-index, and overflow; `Backgrounds & Images` mixes container backgrounds with image object-fit; Effects includes transforms; color is handled separately from the group resolver.
- The simple/advanced tier is global. It cannot make width primary for an Image, typography primary for a Heading, or flex layout primary for a Container.
- The Style tab begins with document-wide Guided Roles Manager and Design Token Panel before the selected element's controls. This obscures the answer to “what can I style on this element?”
- The current palette exposes only Section, Container, Heading, Text, Button, and Image. Divider and iframe primitive factories exist but are not exposed.
- Form, Form Field, WooCommerce Product/Grid/Cart/Checkout, and eight widget-library panels/functions exist in `src/index.js` or `src/widget-library.mjs`, but current component usage searches show that their panels are disconnected from the inspector/left rail. This is dead or dormant element-specific functionality, not an integrated element library.
- `src/block-type.mjs` collapses imported nodes to `container`, `text`, `image`, `button`, `form`, or `form_field`. Heading, paragraph, rich text, navigation, list, video, and semantic container distinctions are lost for control resolution.
- `includes/class-code-to-block-schema.php` accepts only ten broad block types. It supports root styles, tablet/mobile responsive overrides, and hover/focus/active states, but there is no target dimension and no responsive×state intersection.
- The editor does not expose state editing even though schema and renderer support three root states.
- `includes/class-code-to-block-renderer.php` scopes styles with traversal-index classes such as `.ctb-block-0`; reordering changes every later selector. It emits `!important` on every mapped declaration, making theme compatibility and predictable custom CSS precedence harder.
- Responsive state rules are not generated. Root state rules and root responsive rules are separate branches.
- Responsive visibility currently mutates `display` in style fallback storage. Verification already identified that it can lose to another mapped `display: ... !important` declaration.
- The document schema accepts versions 1 and 2 but stores many documents as version 1. There is no explicit migration registry that upgrades element definitions independently from document schema.
- `src/index.js` is over 9,000 lines and still owns store mutations, panel controls, import UI, commerce, forms, widgets, tokens, diagnostics, animations, and the editor shell. Adding dozens of element-specific branches there would make the coupling worse.

### 3.2 UX diagnosis

| Problem | User-visible consequence | Root architectural cause |
|---|---|---|
| Generic Title and HTML Tag fields | An image, form, container, or imported node can receive confusing controls | Inspector reasons from tag exceptions instead of an element definition |
| Style split between Style and Advanced | Users must search two tabs for visual properties and see duplicates | Global tier metadata substitutes for tab taxonomy |
| No sub-element targets | Form labels, inputs, errors, menu dropdowns, accordion headers, and gallery captions cannot be styled cleanly | Style storage has only the block root |
| Free-text CSS values | Invalid values, inconsistent units, and high cognitive load | CSS property strings are used as control definitions |
| Document-wide managers before local controls | Local editing feels indirect and cluttered | Global systems are embedded inside the selected-element tab |
| No state editor | Hover/focus/active imported values exist but cannot be inspected or changed | Storage/rendering and panel UI evolved separately |
| Sparse palette and dormant panels | Supported backend types feel absent or unfinished | Element registration, palette registration, inspector registration, and renderer registration are separate manual paths |
| Unstable selector classes | Reordering can invalidate cached mental/debug mappings and causes large CSS churn | CSS selector identity is based on traversal position |
| Universal `!important` | Themes, presets, raw CSS, and local values are difficult to reason about | Renderer uses force rather than an explicit cascade |

### 3.3 What must not be preserved

The new system must not keep a universal field list and merely add more `if (selectedBlock.type)` branches. It must not mount the same style editor twice. It must not store visibility as a raw display fallback. It must not make all imported HTML appear to be a Container. It must not move global token/preset management into every element panel. It must not allow arbitrary selectors for style targets. It must not serialize inherited values, empty responsive copies, or default control values.

## 4. Design principles

1. **The element definition is the source of truth.** Palette, inspector, validation, default creation, insertion rules, rendering, migration, and tests all reference one registered definition ID.
2. **Capabilities are configured grants.** A capability says which target, fields, states, responsiveness, defaults, and output mapper are allowed. A bare `supportsTypography: true` is insufficient.
3. **Targets precede controls.** The user chooses Root, Label, Icon, Caption, Field, Error, or another registered part before editing its valid groups.
4. **One value, many input methods.** Typed input, scrub, range, canvas handle, token picker, preset, and keyboard adjustments write through one command and history path.
5. **Sparse contexts.** Store base values and explicit breakpoint/state overrides only. Clearing an override deletes it.
6. **No irrelevant controls.** A missing capability is absent, not disabled. A temporarily inapplicable configured control, such as Grid columns while layout mode is Flex, may be hidden behind the same group with a clear dependency message.
7. **Predictable ordering with element-first emphasis.** Element-specific groups come first, followed by shared groups in a universal order.
8. **Progressive disclosure is explicit.** Optional valid groups are discoverable through Add style group; modified hidden groups remain visible with a modified badge.
9. **Advanced is not Style overflow.** Visual styling belongs in Style. Advanced contains placement/behavior/developer concerns with higher risk or lower frequency.
10. **Accessibility is structural.** Required accessible names, label associations, keyboard behavior, state attributes, and contrast/focus diagnostics are part of the definition and validation pipeline.
11. **WordPress is authoritative at save/render boundaries.** REST requests are capability-checked; the server validates schema; output is escaped for context; meta remains revisioned and autosaved.
12. **Backward compatibility is dual-read, canonical-write.** Old documents render without eager mutation. An explicit migration produces v3; new saves write only canonical v3 plus a migration report.
13. **Editor and frontend share compiled style semantics.** JavaScript preview and PHP output consume the same serializable compiler contract and parity fixtures.
14. **Performance is budgeted.** Selection does not scan the document, collapsed groups do not mount heavy controls, and CSS compilation is incremental by stable element ID.

## 5. Recommended tab architecture

### 5.1 Inspector header shared by all tabs

The fixed header contains: element icon and human name, stable element ID, parent breadcrumb, preset/source badge, duplicate/delete/lock actions, and an element-specific help link. The row below contains Content, Style, and Advanced. Search spans the active tab. Search results retain group and target breadcrumbs.

### 5.2 Content

Content contains only data, semantics, and behavior owned by the element:

1. Primary content: text, rich text, media, labels, items, slides, fields, products, coordinates, or shortcode.
2. Link/action behavior: URL, target, rel, download, action, submission, playback, lightbox, query, or interaction.
3. Structure: heading level, list type, semantic tag constrained by the definition, item repeater, field schema, slide schema, or navigation source.
4. Dynamic data and slots, shown only on compatible fields.
5. Element-specific accessibility required to make the content meaningful: image alt, media captions/transcripts, form labels, navigation accessible name.

Content must not contain text alignment, color, spacing, responsive visibility, CSS ID/classes, transforms, animation, or arbitrary CSS.

### 5.3 Style

Style begins with a context bar: **Target → Breakpoint → State → Source**. The default target and applicable states come from the definition. Under it, groups follow this universal order; absent capabilities remove the group:

1. Element-specific appearance or layout
2. Typography and text
3. Icon or media presentation
4. Color and background
5. Alignment
6. Sizing
7. Spacing
8. Border and radius
9. Shadow
10. Filters and opacity

Position, z-index, transforms, transitions, and animations do not belong here in this builder. They move to Advanced because they affect stacking, hit testing, motion, containing blocks, and accessibility beyond ordinary appearance.

Each definition marks groups `primary`, `recommended`, or `optional`. Primary groups open by default. Recommended groups are visible and collapsed. Optional groups appear in Add style group; once modified, they remain visible. This replaces the current global Simple/Advanced tier.

### 5.4 Advanced

Advanced follows a universal order and never repeats Style groups:

1. **Placement:** position mode, inset anchors, containing block warning, z-index, overflow, sticky offsets, isolation.
2. **Motion:** transform components, transform origin, transition properties/duration/easing/delay, entrance animation, scroll animation, reduced-motion behavior.
3. **Visibility & conditions:** responsive visibility, render conditions, editor preview behavior, schedule/user/data conditions. State that conditions are not authorization.
4. **Attributes & accessibility:** target-aware ID, class list, native attributes, `data-*`, allowed ARIA attributes, role only when valid, tabindex guardrails.
5. **Performance:** loading, decoding, fetch priority, preload hints, iframe/video lazy behavior, only on applicable elements.
6. **Permissions:** lock content/style/structure, role policy, reusable-component restrictions.
7. **Developer:** target-scoped custom CSS declarations, advanced selector editor limited to registered parts/states, diagnostics and generated selector preview.

Dynamic data remains in Content. Global tokens/presets live in dedicated manager surfaces and appear in field pickers; they do not precede local Style controls. Page diagnostics and SEO remain page-level panels, not element Advanced groups.

## 6. Complete control taxonomy

### 6.1 Primitive control types

| Family | Types | Contract |
|---|---|---|
| Text/data | text, textarea, richText, code, hidden | schema type, length, normalization, dynamic-data eligibility |
| Numeric/unit | number, range, unit, dimensions, fourSides, fourCorners | min/max/step, allowed units/functions, linked/unlinked behavior, scrub/wheel policy |
| Choice | select, searchableSelect, segmented, radio, switch, checkbox, visualChoice | finite options, labels, disabled reasons, default omission |
| Resource | media, image, icon, gallery, video, audio, URL | WordPress media IDs, source variants, mime validation, alt/caption metadata |
| Composite | typography, background, border, shadow, filter, transform, transition, gradient | structured values with deterministic CSS serializer |
| Collection | repeater, sortableList, keyValueList, conditionBuilder | item schema, stable item IDs, min/max, reorder history |
| Reference | token, role, groupPreset, elementPreset, dynamicSource | reference validation, affected count, detach/override behavior |
| UI-only | heading, help, notice, divider, preview, diagnostic | never serialized into the document |

### 6.2 Reusable style groups

| Group | Fields | Common targets | Responsive | States |
|---|---|---|---|---|
| Typography | family, size, weight, style, line height, letter spacing, transform, decoration, text shadow, optional stroke | text, label, button label, menu item, field, caption | Yes | Target-specific |
| Text | color, alignment, indent, columns, white-space/wrap, word break, hyphenation | text-bearing targets | Yes | Target-specific |
| Background | solid/gradient/image layers, repeat, size, position, attachment, blend | root and visual parts | Yes | Yes where meaningful |
| Border | style/color/width per side, radius per corner, outline | root, media, field, button, item | Yes | Yes |
| Shadow | multiple box shadows, inset, target color tokens | boxes and media | Yes | Yes |
| Spacing | padding and margin per side | box targets; margin normally root only | Yes | Rarely stateful; disabled by default in states |
| Sizing | width/min/max, height/min/max, aspect ratio, fit-content behavior | root/media/controls | Yes | Rarely stateful |
| Alignment | text alignment or self alignment according to target | text and layout children | Yes | No by default |
| Flex layout | direction, wrap, justify, align, content alignment, gaps | container targets | Yes | No |
| Grid layout | templates, auto flow, gaps, implicit tracks | container targets | Yes | No |
| Flex/grid child | grow/shrink/basis/order/align self or grid row/column/area | root when parent capability allows | Yes | No |
| Media presentation | object fit/position, aspect ratio, crop, caption placement | image/video/logo/gallery media | Yes | Optional |
| Icon presentation | size, color, stroke/fill, rotation, position, gap | icon targets | Yes | Yes |
| Filters | opacity, filter functions, backdrop filter where allowed, blend mode | visual targets | Yes | Yes |

### 6.3 Advanced groups

Placement, Motion, Visibility, Conditions, Attributes, Accessibility, Performance, Permissions, and Developer are reusable group implementations, but each element configures allowed fields and targets. For example, Performance exposes `loading` and `decoding` on Image, preload/muted/playsinline on Video, and no fields on Heading.

## 7. Shared versus element-specific controls

Shared code owns rendering, parsing, validation, reset, source indicators, responsive/state context, token/preset binding, and CSS serialization. Element definitions own whether a group appears, which target it styles, which fields are enabled, ordering, defaults, states, and conditions.

Element-specific controls are required when the value changes content structure or runtime behavior: Button icon placement, Image alt text, Heading level, Form submission, Accordion default-open item, Menu source, Video controls, Product query, or Gallery items. These controls may use shared primitive inputs but do not become universal capabilities.

The resolver output is a panel view model, not React elements:

```text
resolvePanel(definitionId, selectedNode, documentContext, editorContext)
  -> tabs[]
     -> groups[]
        -> targetId, controlIds[], visibility, source, badges, errors
```

React renders that view model. Definitions never import React components. PHP validation consumes the same exported registry manifest generated at build time.

## 8. Element capability architecture

### 8.1 Stable definition identity

Add `element` and `definition_version` to every v3 block. `type` remains a broad renderer family during migration; `tag` remains output semantics. Examples:

- `element: core/heading`, `type: text`, `tag: h2`
- `element: core/button`, `type: button`, `tag: a`
- `element: layout/container`, `type: container`, `tag: div`
- `element: forms/select`, `type: form_field`, renderer creates the associated label/select wrapper

### 8.2 Configured capability grants

Do not implement `supportsTypography: true`. Use a structured grant such as:

```text
styleGroups.typography = {
  target: "label",
  fields: [family, size, weight, style, lineHeight, letterSpacing, decoration],
  responsive: true,
  states: [hover, focusVisible, active, disabled],
  tier: "primary"
}
```

The registry schema contains:

- identity: id, label, category, icon, definition version, aliases
- model: renderer family, default tag, allowed semantic tags, child policy, parent policy
- props: content schema, attributes schema, dynamic-data slots, defaults
- tabs: ordered content groups and advanced grants
- style targets: target IDs, labels, selector templates, DOM ownership, state set
- style groups: configured shared grants by target
- insertion: palette visibility, keywords, defaults, transform/import matchers
- validation: cross-field and accessibility rules
- migration: legacy matchers and per-definition migrators
- renderer: PHP/preview renderer key and target marker contract

### 8.3 Visibility and dependency rules

The resolver evaluates declarative conditions such as `propEquals`, `parentCapability`, `targetExists`, `layoutMode`, `tagIn`, `hasChildren`, and `featureAvailable`. Conditions may reveal a configured control but never grant an unregistered capability. Values remain serialized when a conditional field is temporarily hidden unless the user explicitly removes them.

### 8.4 Registration failures

Development builds fail when a definition references an unknown control/group/target, has duplicate IDs, enables a state unsupported by the target, maps two controls to the same canonical property without an explicit merge strategy, or lacks a server manifest entry. Production falls back to a read-only Legacy Element inspector with diagnostics rather than exposing every control.

## 9. Full element → control matrix

**Status legend:** P = current palette primitive; D = current dormant factory/panel; I = currently available only through import/native tags; C = current composite/widget; R = recommended first-class addition. A status can contain multiple letters.

| Element | Status | Content focus | Style targets and groups | States | Explicit exclusions |
|---|---:|---|---|---|---|
| Section | P | semantic tag, optional anchor/label | Root: layout, background, sizing, spacing, border, shadow, filters | hover optional | typography, media playback, button icon |
| Row | R | column structure, semantic tag | Root: flex/grid, sizing, spacing, background, border; child placement | none by default | rich text, media source |
| Column | R/I | semantic tag, child policy | Root: flex/grid, sizing, spacing, background, border; flex/grid child | none by default | text content, playback |
| Container | P | semantic tag, children | Root: flex/grid, sizing, spacing, background, border, shadow | hover optional | typography unless a text target exists |
| Div / Wrapper | I/R | semantic wrapper, children | Root: display, sizing, spacing, background, border | hover optional | element-specific media/form controls |
| Heading | P | text, level H1-H6, dynamic source, link optional | Text: typography/text; Root: sizing, spacing, background, border | hover; visited if linked | flex/grid container, playback |
| Paragraph / Text | P | plain text, semantic p/span, dynamic source | Text: typography/text; Root: sizing, spacing, background | hover optional | media controls, container grid |
| Rich Text | R/I | sanitized rich HTML, links, lists, dynamic source | Body plus heading/link/list targets: typography/text; Root: spacing/background | link hover/focus/visited | arbitrary script/style, media playback |
| Link | I/R | label, URL, target, rel, download | Label: typography/text; Root: spacing/background/border; optional Icon | hover, focus-visible, active, visited | form submission, media playback |
| List | I/R | ordered/unordered, items, marker type/start | Root: spacing; Item/Marker: typography/text/icon | link states in items | playback, button behavior |
| List Item | I/R | item content/value | Item/Marker: typography/text; Root: spacing | inherited link states | layout container controls unless nested content enabled |
| Button | P | label, link/action, icon, disabled semantics | Root: background, border, shadow, sizing, spacing; Label: typography/text; Icon | hover, focus-visible, active, disabled | media playback, grid container |
| Image | P | media, alt, title, caption, link, responsive sources | Media: sizing/media/filter/border/shadow; Caption: typography/text | hover/focus if linked | root typography without caption, playback |
| Figure / Caption | I/R | media child, caption | Root; Media; Caption targets with media/typography groups | link/media hover | form behavior |
| Icon | C/R | icon source, accessible/decorative mode, link | Icon: size/color/stroke/filter; Root: spacing/background/border | hover, focus-visible, active | typography family/line height, playback |
| Divider | D | orientation, semantic hr/decorative mode | Line: color/style/thickness/width; Root: spacing/alignment | none | typography, background image, playback |
| Spacer | R | accessibility-hidden fixed spacer | Root: height/width only, responsive | none | all content, typography, border, shadow, states |
| Video | I/R | media/poster/captions, controls, autoplay/muted/loop/playsinline | Media: aspect/sizing/object fit/filter/border/shadow; Caption | hover optional | typography except caption, flex/grid container |
| Audio | I/R | source, tracks, controls, autoplay/loop/muted/preload | Player root: sizing/background/border; Caption | focus-visible | object fit, text typography without caption |
| Embed / Iframe | D/I | URL/embed provider/title/sandbox/allow/loading | Frame: aspect/sizing/border/shadow | focus-visible | typography, child layout |
| Map | R | provider, address/coordinates, zoom, marker, consent | Frame and marker targets: sizing/filter/border/shadow | marker hover/focus | typography except marker label |
| Logo | R | media, alt/site-name behavior, home link | Media and optional Text targets | hover/focus/visited | gallery/playback |
| HTML | I/R | trusted/sanitized HTML source and preview policy | Root only; registered descendant target editor disabled by default | none | generated content controls, unsafe scripts |
| Code | I/R | code text, language, copy button, line numbers | Code/Toolbar/Button targets: typography/background/border | copy button states | rich text formatting, media controls |
| Shortcode | I/R | shortcode tag/attributes/enclosed content, allowlist | Wrapper only unless renderer declares parts | none by default | arbitrary sub-target styling, unsafe unregistered shortcodes |
| Menu / Navigation | I/R | menu source/items, orientation, dropdown/mobile behavior | Root, Item, Link, Dropdown, Dropdown Item, Toggle, Icon | hover, focus-visible, active/current, expanded | media playback, unrelated field styles |
| Form | D | submission, fields, messages, recipients/integration | Form, Field Row, Label, Input, Help, Error, Success, Submit | focus-visible, invalid, disabled | media playback, visited |
| Form Field group | D | type, label/name/help, required, options/validation | Row, Label, Control, Help, Error | focus-visible, invalid, disabled, checked when applicable | container grid unless field layout grants it |
| Input | D/R | type/name/value/placeholder/autocomplete/validation | Control, Placeholder, Label, Help, Error | focus, focus-visible, disabled, invalid, read-only | visited, media filters |
| Textarea | D/R | name/value/placeholder/rows/resize/validation | Control, Placeholder, Label, Help, Error | focus, focus-visible, disabled, invalid | visited, object fit |
| Select | D/R | name/options/multiple/placeholder/validation | Control, Option indicator, Label, Help, Error | focus-visible, disabled, invalid, expanded | visited, rich text |
| Checkbox | D/R | label/value/checked/required | Control, Checkmark, Label, Help, Error | focus-visible, checked, disabled, invalid | typography on native box, visited |
| Radio | D/R | group/name/options/selected/required | Control, Dot, Label, Option Label, Error | focus-visible, checked, disabled, invalid | visited, media |
| File Upload | D/R | name/accept/multiple/size/help | Dropzone, Button, Filename, Help, Error | hover, focus-visible, dragging, disabled, invalid | media playback |
| Submit Button | R | label, submit action, loading/success labels, icon | Root, Label, Icon, Spinner | hover, focus-visible, active, disabled, loading | URL/visited unless explicitly link-mode |
| Accordion | C/R | items, single/multiple open, default open, heading levels | Root, Item, Header, Title, Icon, Content | hover, focus-visible, expanded, disabled | visited unless header contains link |
| Toggle | R/I | title/content, default open, heading level | Root, Header, Title, Icon, Content | hover, focus-visible, expanded, disabled | selected/checked unless switch semantics used |
| Tabs | R | tabs/panels, active tab, orientation, mobile behavior | Root, Tablist, Tab, Active Tab, Panel, Icon | hover, focus-visible, selected, disabled | visited, media playback at root |
| Testimonial | C | quote, author, role, avatar, rating | Root, Quote, Author, Role, Avatar, Rating | link states on author only | form/playback |
| Counter | C | value, prefix/suffix, duration, separator | Root, Number, Prefix, Suffix, Label | none; animation visibility trigger | link states, media |
| Progress Bar | R/I | value/max/label, semantic mode | Track, Fill, Label, Value | none; indeterminate variant | typography on track/fill, link states |
| Gallery | C/R | media items, captions, links/lightbox, order | Root, Grid, Item, Media, Caption, Overlay | item hover/focus, lightbox trigger active | text typography without caption |
| Slider | R | slides, autoplay, interval, loop, pause rules | Root, Track, Slide, Media, Caption, Arrows, Dots | control hover/focus/disabled, selected dot | form states |
| Carousel | R | items, visible count, scroll/snap, autoplay | Root, Track, Item, Arrows, Dots | control hover/focus/disabled, selected dot | unrelated media controls at root |
| Social Icons | R | networks/URLs/labels/order/new-tab | Root, Item, Icon, Label | hover, focus-visible, active, visited | body typography if icon-only |
| Breadcrumbs | R | source/template, separators, home/current rules | Root, Item, Link, Separator, Current | link hover/focus/visited/current | media playback, grid editing |
| Search | R | placeholder, button label/icon, results target | Form, Input, Button, Icon, Results/Empty | focus-visible, hover, active, disabled, expanded | visited, media playback |
| Quote | I/R | quote text, citation/source link | Quote, Citation, Mark | citation link states | layout container groups by default |
| Blockquote | I/R | rich quote, cite URL/attribution | Root, Quote, Citation | citation link states | media playback |
| Pricing Table | C | plan, price, period, feature items, CTA, badge | Root, Header, Price, Period, Features, Feature, CTA, Badge | CTA states, featured variant | form/media playback |
| Icon Box | C | icon, title, description, link | Root, Icon, Title, Description | root/link hover/focus | form/playback |
| Countdown Timer | C | end date/timezone, expiry behavior, labels | Root, Segment, Value, Label, Separator | expired variant | link/media states |
| Team Member | C | photo, name, role, bio, social links | Root, Photo, Name, Role, Bio, Social | social link states | form/playback |
| Woo Product | D | product source, template parts, variations/cart behavior | Root, Image, Title, Price, Stock, Description, Variations, Button | link/button/form states | generic rich text on product root |
| Woo Product Grid | D | query/category/order/limit/pagination/template | Grid, Item and Product part targets | item/link/button states | single-product source controls |
| Woo Cart | D | display options and empty-cart behavior | Cart, Item, Image, Name, Quantity, Price, Totals, Actions, Empty | link/button/input states | arbitrary child editing until renderer contract exists |
| Woo Checkout | D | checkout sections and integration options | Form, Section, Label, Field, Error, Summary, Payment, Submit | form/button states | visited/media filters |
| Loop / Repeater | R | query/source, item alias, empty/error/loading content | Root, List, Item, Empty, Error, Loading | item states only if semantic | direct typography on data source |

## 10. Detailed controls for every element

The lists below are the resolved user-facing hierarchy. Shared group names refer to the complete field sets in section 6, narrowed by the fields stated here.

### 10.1 Section

- **Content — Structure:** semantic tag (`section`, `header`, `footer`, `main`, `aside`, `article` where valid), accessible label when the region needs one, optional anchor name, child summary.
- **Style — Root:** Layout mode (block/flex/grid), direction/tracks, wrap, alignment, gaps; Background; Sizing (width, max width, min height); Spacing; Border; Shadow; Filters/opacity.
- **Advanced:** position/sticky/z-index/overflow/isolation; transform/transition/animation; visibility/conditions; ID/classes/attributes/ARIA; permissions; target-scoped CSS.
- **Never show:** typography, text content, image alt, playback, form field, or button icon controls.

### 10.2 Row

- **Content — Columns:** add/remove/reorder columns, structure template, stack/order policy by breakpoint, semantic tag.
- **Style — Root:** Flex or Grid is primary; direction/template, wrap/auto-flow, justify/align, gaps, sizing, background, spacing, border, shadow. **Column placement** is edited on each Column, not duplicated here.
- **Advanced:** placement, overflow, responsive visibility/conditions, motion, attributes, permissions, CSS.
- **Never show:** free text, media sources, typography, form submission, or per-column visual controls flattened into the Row.

### 10.3 Column

- **Content — Structure:** semantic tag and child summary; optional column label for editor navigation.
- **Style — Root:** optional internal flex/grid layout, sizing, background, spacing, border, shadow. **Parent layout item:** flex grow/shrink/basis/order/align-self or grid row/column/area, selected automatically from the parent.
- **Advanced:** position/sticky/z-index/overflow, responsive order/visibility, motion, attributes, permissions, CSS.
- **Never show:** column-count control that belongs to Row, text editor, media playback, button icon.

### 10.4 Container

- **Content — Structure:** constrained semantic tag (`div`, `article`, `aside`, `nav`, `header`, `footer`, `section`), editor label, children.
- **Style — Root:** Layout is primary (block/flex/grid); sizing including content/max width; spacing/gaps; background; border/radius; shadow; filters.
- **Advanced:** parent item placement, position/sticky/z-index/overflow/isolation, motion, visibility/conditions, attributes/accessibility, permissions, CSS.
- **Never show:** typography unless a separately registered text target exists, media source, form settings, link rel.

### 10.5 Div / Wrapper

- **Content — Structure:** semantic tag from the definition allowlist, optional editor label, children.
- **Style — Root:** display/layout, sizing, spacing, background, border, shadow, filters. Defaults are minimal; it is a neutral wrapper.
- **Advanced:** parent item placement, position/overflow, visibility/conditions, motion, attributes, permissions, CSS.
- **Never show:** element-specific text, image, playback, form, product, icon, or carousel controls.

### 10.6 Heading

- **Content — Text:** heading text or dynamic source, H1-H6 level, optional link with URL/target/rel, optional rich inline emphasis only if the rich-inline feature is enabled.
- **Style — Text:** family, size, weight, style, line height, letter spacing, transform, decoration, color, text alignment, wrap/hyphenation, text shadow/stroke. **Root:** width/max width, margin/padding, background, border.
- **Advanced:** parent item placement, position, motion, visibility/conditions, ID/classes/attributes; heading-order diagnostic; CSS.
- **Never show:** flex/grid container controls, object fit, media playback, form field, or heading level under Style.

### 10.7 Paragraph / Text

- **Content — Text:** plain text, dynamic source, semantic `p` or `span` when context permits, optional link conversion.
- **Style — Text:** complete typography, text color/alignment, columns, wrap/hyphenation, text shadow. **Root:** sizing, spacing, background, border.
- **Advanced:** parent layout item, position, motion, visibility/conditions, attributes, CSS.
- **Never show:** media source/playback, flex/grid container layout unless transformed to Rich Text/Container, form behavior.

### 10.8 Rich Text

- **Content — Body:** sanitized rich-text editor supporting paragraphs, H2-H6, lists, emphasis, strong, inline code, quotes, and links; dynamic source mode; clear-formatting and paste policy.
- **Style — Targets:** Body, Headings, Links, Lists, Markers, Blockquotes, and Inline Code. Each target receives its relevant typography/text; Root receives sizing/spacing/background/border.
- **Advanced:** position/motion/visibility/conditions, attributes, permissions, target-scoped CSS. Accessibility diagnostics flag skipped heading levels and empty links.
- **Never show:** raw scripts/styles, media playback, layout controls for arbitrary descendants, H1 creation inside a rich body unless explicitly allowed.

### 10.9 Link

- **Content — Link:** label, URL/dynamic URL, target, rel tokens (`nofollow`, `sponsored`, `ugc`, `noopener`, `noreferrer`), download filename, accessible label, optional icon and icon position.
- **Style — Label/Icon/Root:** typography and text; icon size/color/gap; background, sizing, padding/margin, border, shadow. States: hover, focus-visible, active, visited.
- **Advanced:** parent item, position/motion, visibility/conditions, attributes, permissions, CSS.
- **Never show:** form submit behavior, media autoplay, flex/grid container tracks, disabled state unless rendered as a non-link control.

### 10.10 List

- **Content — List:** ordered/unordered type, start/reversed for ordered lists, sortable item repeater, optional nested lists, item rich-inline mode.
- **Style — Root/Item/Marker:** root sizing/spacing; item typography/text and item gap; marker type/image/color/size/position; link target states when items contain links.
- **Advanced:** parent item placement, position/motion/visibility, attributes, CSS.
- **Never show:** media playback, form submission, button icon group, grid tracks unless a deliberate list-layout extension is enabled.

### 10.11 List Item

- **Content — Item:** text or rich-inline content, value override for ordered lists, optional nested list/link.
- **Style — Item/Marker:** typography/text, marker presentation, item spacing; root background/border only as optional groups.
- **Advanced:** parent placement, visibility/conditions, attributes, CSS.
- **Never show:** list start/reversed (belongs to parent), playback, form behavior, container layout by default.

### 10.12 Button

- **Content — Button:** label; mode (link, action, or submit only inside Form); URL/target/rel/download for link mode; registered action for action mode; icon source/position/gap/show-on-hover; accessible name; disabled/loading labels.
- **Style — Root:** text/background colors, background layers, sizing including min width/height, alignment, padding/margin, border/radius, shadow, filters. **Label:** typography/text. **Icon:** size/color/stroke/rotation/gap. **Spinner:** size/color. States: hover, focus-visible, active, disabled, loading.
- **Advanced:** parent placement, position, transform/transition/animation, visibility/conditions, attributes, permissions, CSS.
- **Never show:** video/audio controls, grid container tracks, visited for native button mode, or link fields in submit/action mode.

### 10.13 Image

- **Content — Image:** WordPress media ID plus URL fallback, alt text with decorative toggle, title, caption, responsive source policy, link/lightbox, dynamic source, intrinsic dimensions.
- **Style — Media:** width/min/max, height/aspect ratio, object fit/position, filters/opacity, border/radius, shadow. **Caption:** typography/text/background/spacing. **Root:** alignment and margin.
- **Advanced:** loading/decoding/fetch priority, parent placement, position/motion, visibility/conditions, attributes, CSS. Diagnostics require alt unless decorative.
- **Never show:** general typography without caption, flex/grid container controls, audio/video playback.

### 10.14 Figure / Caption

- **Content — Figure:** media child selection, caption rich-inline content, optional source/citation.
- **Style — Root/Media/Caption:** root layout/spacing; media sizing/fit/filter/border/shadow; caption typography/text/background/spacing.
- **Advanced:** placement/motion/visibility, attributes, permissions, CSS.
- **Never show:** form behavior, unrelated button controls, caption typography when no caption target exists.

### 10.15 Icon

- **Content — Icon:** icon library/SVG/media source, decorative versus meaningful mode, accessible label when meaningful, optional link.
- **Style — Icon:** size, fill, stroke, stroke width, color, rotation, filters. **Root:** alignment, sizing, spacing, background, border/radius, shadow. Link states apply when linked.
- **Advanced:** parent placement, position/motion, visibility/conditions, safe SVG/attributes policy, CSS.
- **Never show:** font family/line height as the primary icon mechanism, playback, rich text, form settings.

### 10.16 Divider

- **Content — Divider:** orientation, semantic `hr` versus decorative line, optional editor label.
- **Style — Line:** style, color, thickness, length. **Root:** alignment and spacing.
- **Advanced:** parent placement, visibility, attributes restricted by semantic mode, CSS.
- **Never show:** typography, backgrounds, shadow by default, hover/focus states, media, form, or link controls.

### 10.17 Spacer

- **Content:** no user content; a description explains that layout gap is preferred inside Flex/Grid containers.
- **Style — Root:** width for horizontal mode or height for vertical mode, responsive values, minimum editor hit area that is not emitted frontend.
- **Advanced:** responsive visibility and ID/class only if needed for migration; no motion or conditions by default.
- **Never show:** typography, color, background, border, shadow, filters, states, media, link, attributes that make it focusable.

### 10.18 Video

- **Content — Media:** WordPress media/external source, poster, captions/subtitles tracks, transcript link, controls, autoplay (requires muted), muted, loop, playsinline, preload, start/end, accessible title.
- **Style — Media:** width/max width, height/aspect ratio, object fit/position, border/radius, shadow, filters. **Caption:** typography/text. **Root:** alignment/spacing.
- **Advanced:** lazy load/preload, parent placement, position/motion, visibility/conditions, attributes, CSS; reduced-motion/autoplay warnings.
- **Never show:** body typography without caption, flex/grid container tracks, visited state.

### 10.19 Audio

- **Content — Media:** source, optional alternate sources, title, transcript/caption, controls, autoplay warning, loop, muted, preload.
- **Style — Player/Caption:** player width/background/border/radius; caption typography/text; root spacing/alignment. Native control internals are not falsely exposed when browsers cannot style them reliably.
- **Advanced:** preload, parent placement, visibility/conditions, attributes, CSS.
- **Never show:** object fit/position, image filters, container grid, visited state.

### 10.20 Embed / Iframe

- **Content — Embed:** provider preset or URL, accessible title, aspect preset, sandbox tokens, allow permissions, referrer policy, loading policy, consent placeholder.
- **Style — Frame:** width/max width/aspect ratio/height, border/radius, shadow, filters. **Placeholder:** background/text when consent-gated.
- **Advanced:** lazy loading, parent placement, position/motion, visibility/conditions, validated attributes, CSS.
- **Never show:** child layout, typography without placeholder, arbitrary unsafe `allow` or sandbox removal without warning.

### 10.21 Map

- **Content — Map:** provider, address or coordinates, zoom, marker list, interaction/scroll behavior, style/theme ID, consent/loading placeholder, accessible title and fallback link.
- **Style — Frame/Marker/Placeholder:** frame sizing/aspect/filter/border/shadow; marker size/color; placeholder typography/background.
- **Advanced:** lazy/consent performance, parent placement, visibility/conditions, attributes, CSS.
- **Never show:** rich typography on the map surface, media playback, form submission.

### 10.22 Logo

- **Content — Logo:** site logo/media or dynamic site identity, alt/site-name mode, link to home/custom URL, target/rel, optional text fallback.
- **Style — Media/Text/Root:** media sizing/object fit; fallback typography/text; root spacing/alignment; hover/focus states for linked logo.
- **Advanced:** loading/fetch priority, parent placement, visibility, attributes, CSS.
- **Never show:** gallery controls, playback, generic caption unless enabled, form settings.

### 10.23 HTML

- **Content — HTML:** sanitized HTML source, trust/capability status, editor preview mode, parse diagnostics. Imported scripts remain managed by the existing explicit script pipeline, not executed here.
- **Style — Root:** sizing, spacing, background, border. Registered descendants may be selected as actual child elements; the HTML element does not invent arbitrary style targets.
- **Advanced:** visibility/conditions, attributes, permission gate, target-scoped CSS, diagnostics.
- **Never show:** misleading element-specific controls, direct event-handler attributes, executable scripts, unrestricted selectors.

### 10.24 Code

- **Content — Code:** code text, language, block/inline mode, line numbers, wrap, copy button and label.
- **Style — Code/Toolbar/Copy Button:** monospace typography, text/background, spacing, border/radius, max height/overflow; toolbar and button appearance/states.
- **Advanced:** parent placement, visibility, attributes, copy interaction, CSS.
- **Never show:** rich text formatting that mutates code, dynamic HTML execution, media controls.

### 10.25 Shortcode

- **Content — Shortcode:** registered shortcode selection, structured attributes when discoverable, raw shortcode for allowlisted integrations, enclosed content, preview/fallback message.
- **Style — Wrapper:** sizing/spacing/background/border only. A shortcode integration may register named parts through an extension manifest; absent that contract, descendants are opaque.
- **Advanced:** lazy rendering if supported, visibility/conditions, attributes, permissions, CSS wrapper.
- **Never show:** guessed sub-element typography, arbitrary PHP, unregistered executable shortcode, builder-managed child layout.

### 10.26 Menu / Navigation

- **Content — Navigation:** WordPress menu/source or manual items, accessible name, orientation, submenu behavior, mobile breakpoint/mode, toggle label/icon, current-item rules.
- **Style — Targets:** Root layout/spacing/background; Menu Item and Link typography/text/spacing; Dropdown background/border/shadow; Dropdown Item; Mobile Panel; Toggle; Icon. States: hover, focus-visible, active/current, expanded, disabled.
- **Advanced:** sticky/position/z-index/overflow, transition/animation with reduced-motion handling, visibility/conditions, attributes/accessibility, CSS.
- **Never show:** media playback, form fields, flattening every dropdown target into Root.

### 10.27 Form

- **Content — Form:** submission handler (native or supported integration), field repeater, recipient/workflow, submit labels, success/error messages, spam/privacy settings, autocomplete policy.
- **Style — Targets:** Form layout/gaps/background; Field Row; Label typography; Control typography/background/border; Placeholder; Help; Required Mark; Error; Success; Submit Button and Spinner. State matrix follows control semantics.
- **Advanced:** conditions, visibility, attributes/accessibility, permissions, performance, CSS. Security settings remain server-enforced and cannot be replaced with hidden client fields.
- **Never show:** media playback, visited state, one root typography control pretending to style every part.

### 10.28 Form Field group

- **Content — Field:** field type, label, name/key, help text, required, default, placeholder, autocomplete, validation, options when applicable, conditional field logic.
- **Style — Row/Label/Control/Placeholder/Help/Error/Required Mark:** relevant typography, colors, sizing, spacing, background, border, shadow.
- **Advanced:** grid width/parent placement, visibility/conditions, attributes/accessibility, permissions, CSS.
- **Never show:** form recipient/submission settings, visited state, unsupported options for the selected field type.

### 10.29 Input

- **Content — Input:** constrained type (`text`, `email`, `tel`, `url`, `number`, `password`, `date`, `time`, `hidden` only in developer mode), label/name/value/placeholder, required, autocomplete/inputmode, min/max/step/pattern, help.
- **Style — Control/Placeholder/Label/Help/Error:** typography, text/background, sizing, padding, border/radius, shadow. States: focus, focus-visible, invalid, disabled, read-only.
- **Advanced:** parent placement, conditions, validated attributes, CSS; hidden type suppresses visual groups.
- **Never show:** visited, object fit, media, rich text, options repeater.

### 10.30 Textarea

- **Content — Textarea:** label/name/default/placeholder, rows, min/max length, required, autocomplete, spellcheck, resize policy, help.
- **Style — Control/Placeholder/Label/Help/Error:** typography/text, sizing/min height, background, padding, border/radius, shadow. States: focus-visible, invalid, disabled, read-only.
- **Advanced:** parent placement, conditions, attributes, CSS.
- **Never show:** select options, checked state, object fit, playback.

### 10.31 Select

- **Content — Select:** label/name, sortable value-label option repeater, placeholder, default selection, required, multiple, size, dynamic options, help.
- **Style — Control/Indicator/Label/Help/Error:** typography/text, background, sizing, padding, border/radius, shadow; indicator size/color. States: focus-visible, expanded, invalid, disabled.
- **Advanced:** parent placement, conditions, validated attributes, CSS. Native-option styling is limited to properties with reliable browser support.
- **Never show:** checked state on the root, rich text options, visited, object fit.

### 10.32 Checkbox

- **Content — Checkbox:** name/value, checked by default, required, label/help, single consent mode or option group, dynamic default.
- **Style — Control/Checkmark/Label/Help/Error:** control size/background/border, checkmark color/shape, label typography/text, spacing. States: focus-visible, checked, disabled, invalid.
- **Advanced:** parent placement, conditions, attributes, CSS. Consent mode requires clear label text and may require a policy link.
- **Never show:** visited, select placeholder, typography applied to the native box, media controls.

### 10.33 Radio

- **Content — Radio group:** group name, sortable value-label options, selected default, required, legend/help, layout orientation.
- **Style — Group/Option/Control/Dot/Label/Legend/Error:** layout/gap, control size/border/background, dot color, typography/text. States: focus-visible, checked, disabled, invalid.
- **Advanced:** parent placement, conditions, attributes, CSS.
- **Never show:** multiple selected defaults, visited, media controls, form submission settings.

### 10.34 File Upload

- **Content — Upload:** label/name, accepted MIME/extensions, multiple, required, maximum count/size subject to server limits, button/dropzone labels, help/privacy copy.
- **Style — Dropzone/Button/Filename/Help/Error:** layout, typography/text, background, border/radius, spacing, icon. States: hover, focus-visible, dragging, disabled, invalid.
- **Advanced:** parent placement, conditions, attributes, CSS. The UI displays effective server limits and never promises a larger limit.
- **Never show:** image editing/object fit for the uploaded file, visited, autoplay.

### 10.35 Submit Button

- **Content — Submit:** label, loading label, success label when inline, icon and position, submit/reset mode constrained by form context.
- **Style — Root/Label/Icon/Spinner:** complete button appearance, typography, icon, sizing, spacing, border, shadow. States: hover, focus-visible, active, disabled, loading.
- **Advanced:** parent placement, motion, conditions, attributes, CSS.
- **Never show:** URL/target/visited in submit mode, media playback, grid container controls.

### 10.36 Accordion

- **Content — Accordion:** sortable item repeater with title/content/icon; single or multiple open; default-open items; collapsible behavior; heading level; IDs generated from stable item IDs.
- **Style — Root/Item/Header/Title/Icon/Content:** layout/gaps, backgrounds, typography/text, borders/radius, spacing, shadow. States: header hover/focus-visible/expanded/disabled; active item styling derives from expanded.
- **Advanced:** transition/animation, visibility/conditions, attributes/accessibility, permissions, CSS. Keyboard arrows/Home/End and `aria-expanded`/`aria-controls` are mandatory.
- **Never show:** visited unless a title contains a real link, flattening active styles into duplicate groups, media playback at root.

### 10.37 Toggle

- **Content — Toggle:** title, rich content, default open, collapsible, heading level, icon expanded/collapsed.
- **Style — Root/Header/Title/Icon/Content:** typography, colors/backgrounds, spacing, border/shadow; states hover/focus-visible/expanded/disabled.
- **Advanced:** transition, visibility/conditions, attributes/accessibility, CSS.
- **Never show:** multiple-item controls, selected/checked unless the element is explicitly transformed to switch semantics, visited.

### 10.38 Tabs

- **Content — Tabs:** sortable tab repeater with stable ID/title/icon/panel content, default selected, orientation, activation mode (automatic/manual), mobile fallback.
- **Style — Root/Tablist/Tab/Active Tab/Panel/Icon:** layout/gap, typography/text, background, spacing, borders, shadow. States: hover, focus-visible, selected, disabled.
- **Advanced:** transition, responsive behavior, conditions, attributes/accessibility, permissions, CSS. Arrow-key behavior and roving tabindex are mandatory.
- **Never show:** visited, independent active-state copies unrelated to selected, playback at root.

### 10.39 Testimonial

- **Content — Testimonial:** quote, author, role/company, avatar, rating, source URL, schema eligibility.
- **Style — Root/Quote/Author/Role/Avatar/Rating:** relevant typography/text, media sizing/fit, icon/rating color, layout, background, spacing, border, shadow.
- **Advanced:** placement/motion/visibility, attributes, CSS; source link states apply only to the link.
- **Never show:** form submission, media playback, one typography control for all parts.

### 10.40 Counter

- **Content — Counter:** start/end value, prefix/suffix, decimal/thousands separators, decimals, duration, trigger/repeat policy, fallback static value, label.
- **Style — Root/Number/Prefix/Suffix/Label:** typography/text, layout/gaps, sizing, spacing, background/border.
- **Advanced:** entrance/scroll trigger, reduced-motion behavior, visibility/conditions, attributes (`aria-label` for ambiguous visual formats), CSS.
- **Never show:** hover/visited by default, media, form fields.

### 10.41 Progress Bar

- **Content — Progress:** value/max or indeterminate, label/value display, accessible label, unit/suffix, dynamic source.
- **Style — Track/Fill/Label/Value:** sizing, colors/backgrounds, radius, stripe/animation option, typography/text, spacing.
- **Advanced:** reduced-motion, visibility/conditions, validated `role=progressbar` attributes, CSS.
- **Never show:** typography on Track/Fill, link states, media playback.

### 10.42 Gallery

- **Content — Gallery:** sortable media repeater, caption/alt source, columns/layout, links/lightbox, image size, loading policy.
- **Style — Root/Grid/Item/Media/Caption/Overlay:** grid/masonry gaps, media sizing/fit/filter/border/shadow, caption typography/background, overlay/icon. States: item hover/focus, lightbox trigger active.
- **Advanced:** lazy loading, lightbox transition/reduced motion, visibility/conditions, attributes, CSS.
- **Never show:** body typography without captions, slider autoplay controls unless layout transforms to Slider.

### 10.43 Slider

- **Content — Slider:** sortable slides with media/content/link, start slide, slides per view, autoplay/interval/loop/pause, navigation, swipe/keyboard, responsive behavior.
- **Style — Root/Track/Slide/Media/Caption/Arrow/Dot/Active Dot:** layout, sizing, typography, media, backgrounds, borders, shadows, controls. States: control hover/focus-visible/disabled; selected dot.
- **Advanced:** transitions, reduced motion, visibility/conditions, attributes/accessibility, performance, CSS.
- **Never show:** form states, unrelated grid child controls on captions, autoplay without pause and accessibility warning.

### 10.44 Carousel

- **Content — Carousel:** sortable item references/children, visible count, scroll amount, loop, autoplay/pause, navigation, snap, equal-height policy.
- **Style — Root/Track/Item/Arrow/Dot/Active Dot:** layout/gaps, item sizing/background/border/shadow, control appearance/states.
- **Advanced:** transition/reduced motion, conditions, attributes/accessibility, performance, CSS.
- **Never show:** slide media controls at root, form states, duplicated item-internal typography when each item is editable.

### 10.45 Social Icons

- **Content — Networks:** sortable network entries, URL, accessible label, icon, target/rel, optional visible label.
- **Style — Root/Item/Icon/Label:** layout/gaps, item sizing/background/border/radius/shadow, icon presentation, label typography. States: hover/focus-visible/active/visited.
- **Advanced:** motion, visibility/conditions, attributes, CSS; external links default to safe rel tokens when opening a new tab.
- **Never show:** rich body typography for icon-only mode, media playback, form behavior.

### 10.46 Breadcrumbs

- **Content — Breadcrumbs:** WordPress hierarchy/source, home label/icon, separator, current item behavior, truncation, schema markup, custom prefix.
- **Style — Root/Item/Link/Separator/Current:** layout/wrap/gaps, typography/text, icon, spacing. States apply to links; Current is an aria-current variant.
- **Advanced:** visibility/conditions, attributes/accessibility, CSS.
- **Never show:** media playback, grid editor, form settings, clickable styling on current item when it is not a link.

### 10.47 Search

- **Content — Search:** method/source, placeholder, accessible label, button label/icon, results page or live-results mode, minimum characters, no-results/loading text.
- **Style — Form/Input/Button/Icon/Results/Result/Empty/Loading:** form layout, input and button full states, dropdown results background/border/shadow, typography/text.
- **Advanced:** result positioning/z-index, transitions, conditions, attributes/accessibility, performance/debounce, CSS.
- **Never show:** visited on input/button, media playback, arbitrary query code.

### 10.48 Quote

- **Content — Quote:** short quote text, citation, source URL, decorative quote mark toggle.
- **Style — Quote/Citation/Mark/Root:** typography/text, quote mark icon presentation, spacing, background, border.
- **Advanced:** placement/visibility, citation link attributes/states, CSS.
- **Never show:** flex/grid container controls by default, playback, form settings.

### 10.49 Blockquote

- **Content — Blockquote:** rich quote content, attribution, cite URL, semantic source.
- **Style — Root/Quote/Citation:** typography/text, spacing, background, border/accent line, optional quote mark.
- **Advanced:** placement/visibility/conditions, attributes, citation link settings, CSS.
- **Never show:** media playback, form behavior, button icon group.

### 10.50 Pricing Table

- **Content — Pricing:** plan name, description, currency/price/period, feature repeater with included/excluded/icon, CTA Button configuration, badge/featured flag.
- **Style — Root/Header/Price/Currency/Period/Features/Feature/Icon/CTA/Badge:** complete part-specific groups; CTA reuses Button target profile; featured is a registered variant, not an arbitrary state.
- **Advanced:** placement/motion/visibility/conditions, attributes, reusable-component slots/permissions, CSS.
- **Never show:** one generic root typography control, form submission, media playback.

### 10.51 Icon Box

- **Content — Icon Box:** icon, title, description, optional whole-box or title link with conflict prevention, semantic heading level.
- **Style — Root/Icon/Title/Description:** layout, icon presentation, typography/text, spacing, background, border, shadow; link/root hover and focus states.
- **Advanced:** motion/visibility/conditions, attributes/accessibility, slots/permissions, CSS.
- **Never show:** form behavior, playback, duplicate link targets that create nested anchors.

### 10.52 Countdown Timer

- **Content — Countdown:** end date/timezone, evergreen/fixed mode, segments shown, singular/plural labels, expiry action/content, accessibility update frequency.
- **Style — Root/Segment/Value/Label/Separator/Expired:** layout, typography/text, backgrounds, spacing, border/shadow.
- **Advanced:** entrance motion, reduced-motion/live-region policy, visibility/conditions, attributes, CSS.
- **Never show:** link states unless expiry content includes links, form/media controls.

### 10.53 Team Member

- **Content — Person:** photo, name, role, bio, profile URL, social link repeater, optional person schema.
- **Style — Root/Photo/Name/Role/Bio/Social/Icon:** media, typography/text, layout, spacing, background, border, shadow; link states only on links.
- **Advanced:** placement/motion/visibility/conditions, attributes, slots/permissions, CSS.
- **Never show:** form submission, playback, one style target for every part.

### 10.54 Woo Product

- **Content — Product:** product selection/dynamic context, displayed parts, variation selector, quantity/add-to-cart behavior, image gallery mode, stock/price/description options.
- **Style — Root/Image/Title/Price/Regular Price/Sale Price/Stock/Description/Rating/Variations/Quantity/Button/Messages:** relevant shared groups by part; button and fields reuse their family profiles.
- **Advanced:** conditions, performance, attributes, permissions, CSS. Product editing remains a separate WooCommerce data workflow, not mixed into visual controls.
- **Never show:** generic root rich-text editing of generated product data, unsafe query/PHP, unrelated form recipient settings.

### 10.55 Woo Product Grid

- **Content — Query:** category/tag/IDs, include/exclude, order/orderby, limit, pagination, product template, empty/loading states.
- **Style — Grid/Item plus Product parts:** grid columns/gaps, item background/border/shadow, target profiles inherited from Product template, pagination/empty/loading.
- **Advanced:** query cache/performance, visibility/conditions, attributes, permissions, CSS.
- **Never show:** single fixed product selection when query mode is active, duplicated product-part controls outside the template target.

### 10.56 Woo Cart

- **Content — Cart:** display sections, coupon/shipping/cross-sell/empty-cart behavior, labels and return link.
- **Style — Cart/Item/Image/Name/Quantity/Price/Remove/Totals/Coupon/Actions/Empty:** targeted layout, typography, field, link, and button groups.
- **Advanced:** conditions, performance, attributes/accessibility, permissions, CSS. Runtime markup version is declared by the Woo renderer contract.
- **Never show:** arbitrary child editing against undocumented Woo markup, product query controls, media playback.

### 10.57 Woo Checkout

- **Content — Checkout:** visible sections, login/coupon/order notes, labels, terms, submit label, supported payment/shipping presentation settings.
- **Style — Form/Section/Heading/Label/Field/Error/Summary/Payment/Submit:** part-specific form, typography, background, border, spacing, and button profiles.
- **Advanced:** conditions, performance, attributes/accessibility, permissions, CSS. Payment security and gateway fields remain owned by WooCommerce.
- **Never show:** gateway secrets, raw payment markup, product grid query, generic root typography.

### 10.58 Loop / Repeater

- **Content — Query:** source type, post/product/manual/data source, filters, order, pagination, item alias, limit, item template, empty/error/loading content.
- **Style — Root/List/Item/Empty/Error/Loading:** layout mode, columns/gaps, item sizing/background/border/shadow, message typography/text.
- **Advanced:** cache/performance, visibility/conditions, attributes, permissions, CSS. Child dynamic bindings receive current-item context.
- **Never show:** direct typography on the query source, unbounded queries, raw PHP, state controls unless the rendered item semantic supports them.

### Native HTML import compatibility

The 58 entries above are the recommended first-class library. The importer currently accepts a wider HTML allowlist. Accepted markup is still supported, but an allowed tag does not automatically deserve a palette item or the universal field list. During normalization, every allowed tag resolves to one of the first-class definitions below or to a deliberately limited compatibility definition. The original tag and safe attributes survive round trip.

| Imported tag family | Definition route | Inspector contract |
|---|---|---|
| `section`, `article`, `aside`, `header`, `footer`, `main`, `hgroup` | Section | Content exposes the constrained semantic tag and region label; Section targets only |
| `div` | Div / Wrapper or Container when the importer proves it owns layout children | Neutral wrapper controls; layout is not inferred merely from descendant markup |
| `nav` | Menu / Navigation when navigation semantics/items are recoverable; otherwise Section with `nav` tag | Navigation behavior appears only for the first route |
| `address` | Rich Text with preserved root semantic | Rich-text targets; no container or form behavior |
| `h1`–`h6` | Heading | Level derived from the tag; Heading contract |
| `p`, `span` | Paragraph / Text or Rich Text when inline descendants require it | Text/Body targets only |
| `a` | Link; Button only when an explicit importer heuristic or source metadata identifies a CTA | URL/rel/target plus Link targets; visual appearance alone never changes semantics |
| `b`, `bdi`, `bdo`, `cite`, `del`, `dfn`, `em`, `i`, `ins`, `kbd`, `mark`, `rp`, `rt`, `ruby`, `s`, `samp`, `small`, `strong`, `sub`, `sup`, `time`, `u`, `var`, `wbr`, `br` | Inline nodes retained inside Rich Text | Edited by the rich-text model; no independent full inspector |
| `q` | Quote | Quote/Citation targets as applicable |
| `blockquote` | Blockquote | Blockquote contract |
| `pre`, `code` | Code | Literal content/language and Code targets; nested inline `code` may remain in Rich Text |
| `ul`, `ol`, `menu`, `li` | List / List Item | List semantics, markers, items, and contained-link targets |
| `dl`, `dt`, `dd` | `native/definition-list` compatibility definition | Content supports ordered term/description pairs; Root/Term/Description targets; schedule a first-class Definition List only if usage warrants it |
| `figure`, `figcaption` | Figure / Caption | Figure, Media, and Caption targets |
| `img` | Image | Image contract |
| `picture`, `source` | Image responsive-source model when lossless; otherwise `native/picture` compatibility definition | Media sources and Media target; never expose video playback for image sources |
| `video`, `track` | Video | Video sources/tracks and Video contract |
| `audio` and audio `source` | Audio | Audio contract |
| `iframe` | Embed / Iframe, Map only when the provider is recognized and consent-safe | Sandbox/title/allow/loading plus Frame target |
| `form` | Form | Form contract; imported actions/methods are validated and may be locked pending trust review |
| `fieldset`, `legend`, `label` | Form Field group structural parts | Relevant Label/Group targets; not free-standing palette elements |
| `input` | Input, Checkbox, Radio, File Upload, or Submit Button according to the validated `type` | Type-specific definition and states; changing type runs an explicit value migration |
| `textarea` | Textarea | Textarea contract |
| `select`, `option`, `optgroup`, `datalist` | Select model and option records | Select contract; options do not receive independent universal inspectors |
| `output` | `native/form-output` compatibility definition | Content binding/name/for plus Text/Root targets and live-region semantics |
| `button` | Button or Submit Button according to validated form context/type | The selected definition's exact contract |
| `details`, `summary` | Toggle | Open/title/content mapped without losing native semantics |
| `progress` | Progress Bar | Value/max/label plus Track/Fill/Value targets |
| `meter` | `native/meter` compatibility definition | Value/min/max/low/high/optimum plus Track/Fill/Value targets; do not claim progress semantics |
| `data` | Rich Text inline data node | Text plus validated machine-readable `value`; no independent visual groups |
| `table`, `caption`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `colgroup`, `col` | `native/table` compatibility definition | Structured rows/cells, header scope/span/caption; Root/Caption/Header/Row/Cell targets; schedule a first-class Table family before palette exposure |
| `svg`, `g`, `defs`, `symbol`, `use`, `path`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `rect` | Icon when safely reducible to a single icon; otherwise `native/svg` compatibility definition | Sanitized SVG source, accessible/decorative mode, Root/Graphic targets only; descendant path editing remains out of scope |

Unknown future-but-safe definitions render through a read-only **Legacy Element** inspector that shows identity, preserved content, migration status, attributes, visibility, and diagnostics. It does not materialize the global style catalog. Unsupported or unsafe tags and attributes remain rejected by the existing import sanitizer, with path-specific feedback. This compatibility layer needs fixtures for every allowed tag family, nested combinations, malformed structures, safe-attribute preservation, save-load-save stability, editor/frontend parity, and migration rollback.

## 11. Style target architecture

### 11.1 Target definition

Every element registers one or more targets. A target is not an arbitrary selector string supplied by the user. It contains:

- stable target ID and translated label;
- selector template relative to the element root;
- editor-preview selector and frontend selector when they differ;
- whether the target is always present, conditional, repeated, or virtual;
- allowed style groups and states;
- DOM ownership and safe attribute target;
- optional variant discriminator such as `[aria-expanded="true"]` or `[aria-current="page"]`.

The renderer emits `data-ctb-part` markers for builder-owned internal parts. Examples: `data-ctb-part="label"`, `data-ctb-part="icon"`, and `data-ctb-part="error"`. Repeated parts use a part name plus stable item ID where per-item styling is permitted. The compiler uses definition-owned templates such as `& > [data-ctb-part="label"]`; it rejects `body`, page-global selectors, scriptable pseudo-elements, and selectors that escape the element root.

### 11.2 Target UX

The Style context bar defaults to the definition's primary target. Complex elements show a searchable target picker grouped as Structure, Content Parts, Controls, Messages, and Variants. The canvas may expose part hit zones; selecting a Button label moves Style to `Label`, while selecting its outer boundary moves to `Root`. The active target is always visible in the panel and overlay.

Modified target badges display a count. Removing a conditional part does not silently discard its styles; the UI offers **Keep styles for later** or **Remove part styles**. Copy/paste styles matches by target ID and compatible group, reports skipped targets, and never applies an Input profile to a Label merely because both accept typography.

### 11.3 Repeated targets

Accordion items, tabs, gallery items, slides, form options, and social links use shared part targets by default. A per-item override is an explicit opt-in stored against the stable item ID. This avoids generating unique CSS for every repeated child while still allowing an exceptional featured slide or pricing feature.

## 12. State architecture

### 12.1 Canonical states

| State ID | Selector/condition | Applicable elements/targets |
|---|---|---|
| `default` | base context | all style targets |
| `hover` | `:hover` | links, buttons, interactive headers/items, media overlays; optional decorative containers |
| `focusVisible` | `:focus-visible` | keyboard-focusable controls and links; preferred focus state |
| `focus` | `:focus` | fields or integrations that specifically need all-focus styling |
| `active` | `:active` | links, buttons, pressable controls |
| `visited` | `:visited` | real anchors only; restrict properties to browser-safe visited styling |
| `disabled` | `:disabled`, `[aria-disabled="true"]` | form controls, buttons, tabs, accordion headers |
| `checked` | `:checked`, `[aria-checked="true"]` | checkbox, radio, switch-like controls |
| `expanded` | `[aria-expanded="true"]`, open details | accordion, toggle, dropdown, search results trigger |
| `selected` | `[aria-selected="true"]` | tabs, carousel dots, selectable options |
| `invalid` | `:invalid`, `[aria-invalid="true"]` | form controls |
| `readOnly` | `:read-only`, `[aria-readonly="true"]` | inputs and textareas |
| `loading` | `[data-state="loading"]` | async buttons, search, gallery, commerce |
| `current` | `[aria-current]` | navigation and breadcrumbs |

`dragging`, `expired`, `featured`, `empty`, and `error` are registered variants, not universal pseudo-states.

### 12.2 Presentation

The state picker lists only states granted to the active target. Default is always first. A dot indicates an explicit value in the active breakpoint; an outlined dot indicates a value elsewhere; a chain icon indicates inheritance from a preset/global style. Switching state does not duplicate panels. The same group/control tree reads and writes the active context.

The canvas simulates nonpersistent states by adding editor-only preview attributes/classes inside the isolated iframe. It never writes `aria-expanded`, `checked`, or disabled content values merely to preview a style state. Exiting state preview restores runtime state.

### 12.3 State rules

- Default values cascade into states; a state stores differences only.
- `focusVisible` ships with an accessible builder default. A user may change it, but removing all visible focus indicators raises an error unless an equivalent focus style exists.
- `visited` exposes only color-related controls allowed by browser privacy restrictions.
- Layout, margin, grid tracks, and large geometry changes are off by default in states. A definition may explicitly enable them with a layout-shift warning.
- State × breakpoint values are valid and sparse. `mobile + hover` is supported by the model even when the UI de-emphasizes hover on touch-sized previews.

## 13. Responsive architecture

### 13.1 Initial breakpoint contract

Preserve the existing desktop-first cascade for compatibility:

| ID | Default range | Inherits from | UI label |
|---|---|---|---|
| `desktop` | base/no max query | element/global base | Desktop |
| `tablet` | max-width 980px proposed; migration retains current configured value until switched | desktop | Tablet |
| `mobile` | max-width 767px proposed; migration retains current configured value until switched | tablet then desktop | Mobile |

The repository currently previews Tablet at 768px and Mobile at 390px; preview width is not itself the CSS boundary. Phase 1 must inventory the actual emitted media queries and store breakpoint definitions in one document/site registry before changing any numeric boundary.

### 13.2 Sparse context keys

The canonical style storage uses context keys rather than copying full style objects:

```text
base
bp:tablet
bp:mobile
state:hover
bp:tablet|state:hover
```

Each context stores only explicit declarations/bindings. Effective value resolution walks global layers and then `base → matching breakpoint chain → state → breakpoint+state`. Clearing removes the declaration and prunes an empty context.

### 13.3 UI behavior

- Canvas breakpoint and control breakpoint stay synchronized by default; users may pin the canvas while inspecting values across breakpoints.
- Every responsive control has a device indicator only when its control definition allows responsiveness.
- The responsive popover shows all enabled breakpoint values, their source, and clear/reset actions in one place.
- Inherited values are muted but readable. The placeholder states the source, for example `48px — from Desktop`.
- Modified filters can scope to Current breakpoint or Any breakpoint.
- Clearing Tablet causes it to inherit Desktop; clearing Mobile causes it to inherit Tablet if present, otherwise Desktop.
- Visibility is stored in `advanced.visibility.breakpoints`, not as a `display` declaration. A final utility rule enforces hidden state and does not destroy the element's display mode.

### 13.4 Future custom breakpoints

The schema accepts registered breakpoint IDs and ordered range metadata, but the UI should not enable arbitrary breakpoints until the CSS compiler, importer, preview, tokens/presets, migrations, and testing matrix all consume the same registry. Changing a breakpoint is a site-wide operation with impact preview and CSS regeneration.

## 14. Global style and preset architecture

### 14.1 Layers and precedence

Lowest to highest:

1. Browser and theme baseline.
2. Builder safety/accessibility baseline.
3. Builder element defaults from the definition; these are usually emitted as shared CSS, not serialized per node.
4. Site global element-family styles, such as all Headings or all Form Controls.
5. Option-group preset stack in declared order.
6. Element preset.
7. Local element base values.
8. Matching local breakpoint values.
9. Matching state values.
10. Matching local breakpoint×state values.
11. Target-scoped custom CSS declarations.
12. Imported legacy `!important` declarations retained by the compatibility adapter.

Design tokens are referenced values, not a separate cascade layer. A token can be consumed in global styles, presets, or local values. Changing a token changes every live reference. Detaching resolves the current value locally.

### 14.2 Preset types

- **Design token:** atomic color, font family, size, spacing, radius, shadow, duration, easing, image, or text value.
- **Option-group preset:** one configured group, such as Button Border, Heading Typography, or Field Background. It declares compatible group/target profiles.
- **Element preset:** complete compatible styles/content defaults for one element definition or declared family. Content inclusion is opt-in and visibly labeled.
- **Global element style:** site-wide defaults for a definition/family, below presets and locals.
- **Reusable component:** structure plus content slots and styles; it remains distinct from a style preset.

### 14.3 Source indicators and shared edits

Every control can display Definition, Global, Group Preset, Element Preset, Local, Breakpoint, or State as its effective source. Editing a shared source opens a decision dialog with affected count: edit shared source, override locally, or cancel. This reuses the existing Guided Role decision concept instead of creating another silent global-edit path.

### 14.4 Current guided roles

Guided Roles should become a first-class preset/source adapter, not a large panel placed before element styles. Existing typography/spacing roles map to option-group presets or remain a compatibility source. The migration records exact role references and overrides; no role is silently converted to fixed values.

## 15. Control naming standards

### 15.1 General rules

- Use sentence case in UI labels and nouns for values: `Font size`, not `Text Size` or `Size of Font`.
- Use CSS terminology when it is already understandable; add plain-language help rather than inventing synonyms.
- Use `Start`/`End` only when the implementation honors writing direction; otherwise use `Left`/`Right` explicitly.
- Use `Default`, `Hover`, `Focus visible`, `Focus`, `Active`, `Visited`, `Disabled`, `Checked`, `Expanded`, and `Selected` exactly.
- Use `Desktop`, `Tablet`, and `Mobile`; reserve `Phone` for a future deliberate terminology migration.
- Avoid ambiguous `Title`: visible element content is `Text`, `Heading text`, `Button label`, or `Item title`; the HTML attribute is `Title attribute`.

### 15.2 Standard vocabulary

| Domain | Required labels |
|---|---|
| Typography | Font family, Font size, Font weight, Font style, Line height, Letter spacing, Text transform, Text decoration, Text shadow |
| Text | Text color, Text alignment, Text wrap, Word break, Hyphenation |
| Spacing | Margin, Padding, Gap, Row gap, Column gap; Top, Right, Bottom, Left |
| Sizing | Width, Min width, Max width, Height, Min height, Max height, Aspect ratio |
| Layout | Layout mode, Direction, Wrap, Justify content, Align items, Align content, Align self, Order, Grid columns, Grid rows |
| Background | Background color, Background image, Gradient, Position, Size, Repeat, Attachment, Blend mode |
| Border | Border style, Border color, Border width, Border radius, Outline |
| Effects | Opacity, Filter, Backdrop filter, Blend mode, Box shadow |
| Placement | Position, Horizontal anchor, Vertical anchor, Offset, Z-index, Overflow, Sticky offset |
| Motion | Transform, Transform origin, Transition property, Duration, Easing, Delay, Animation |
| Link | URL, Open in new tab, Relationship, Download filename |
| Attributes | HTML ID, CSS classes, Attribute name, Attribute value, ARIA label, Role, Tab index |

## 16. Control and document schema

### 16.1 Element definition schema

```text
ElementDefinition {
  id, label, category, icon, version, aliases,
  model: { rendererFamily, defaultTag, allowedTags, parents, children },
  props: { schema, defaults, dynamicSlots },
  contentGroups[],
  styleTargets[],
  styleGroupGrants[],
  advancedGroupGrants[],
  insertion: { palette, keywords, transforms, importMatchers },
  validationRules[],
  migration: { legacyMatchers, migratorIds },
  renderContract
}
```

### 16.2 Control definition schema

```text
ControlDefinition {
  id, type, label, description, group,
  valueSchema, defaultPolicy,
  responsive, states[], dynamic,
  units[], functions[], min, max, step,
  conditions[], validators[], normalizers[],
  output: { mapper, propertyPaths[], mergeStrategy },
  sourceSupport: { tokens, groupPresets, elementPresets },
  accessibility, telemetryKey
}
```

Defaults are definition/UI defaults and are not serialized unless the user changes them or the value is structurally required. Control IDs are stable API identifiers and are never translated.

### 16.3 Document schema v3

```text
DocumentV3 {
  schema_version: 3,
  registry_version,
  name,
  design_tokens,
  global_styles,
  group_presets,
  element_presets,
  breakpoints,
  root,
  migration_log,
  imported_assets,
  seo,
  history_metadata
}

BlockV3 {
  id,
  element,
  definition_version,
  type,
  tag,
  props,
  attributes,
  children,
  style: {
    targets: {
      targetId: {
        contexts: {
          contextKey: StyleSet
        },
        itemOverrides?: { stableItemId: { contexts } }
      }
    },
    preset_refs?: [],
    legacy?: {}
  },
  advanced: {
    placement?, motion?, visibility?, conditions?,
    accessibility?, performance?, permissions?, developer?
  },
  meta
}

StyleSet {
  declarations,
  token_bindings?,
  role_bindings?,
  custom_declarations?,
  origin_notes?
}
```

`props` stores semantic element data; `attributes` stores validated output attributes not otherwise modeled; `style` stores presentation; `advanced` stores non-style system settings. Unknown extension data must be namespaced and size-limited.

### 16.4 Serialization and validation

- JSON is canonical and key ordering is stabilized before hashing/snapshot tests.
- The client validates for fast feedback; PHP repeats authoritative validation.
- Attribute allowlists are definition/tag-aware. `on*`, unsafe URLs, parser-control tags, and unsafe CSS remain rejected.
- Cross-field validators enforce autoplay/muted, heading order guidance, unique IDs, label/control association, valid target/context keys, parent/child rules, and condition operands.
- Empty optional branches are pruned. A save followed by load and save must be byte-stable after canonical normalization.

## 17. CSS generation architecture

### 17.1 Stable selectors

Replace traversal-index selectors as the canonical v3 path. Emit a stable sanitized class derived from the immutable block ID, for example `.ctb-e-a1b2c3`, inside the page scope. Keep `data-ctb-block-id` for editor/debug lookup. A reorder then changes document order without renaming every selector.

Root selector concept:

```text
:where(#ctb-page-39) .ctb-e-a1b2c3
```

Target selector concept:

```text
:where(#ctb-page-39) .ctb-e-a1b2c3 > [data-ctb-part="label"]
```

The `:where()` page scope contributes zero specificity; the element class and target attribute create controlled specificity. If theme compatibility requires a stronger wrapper, change the compiler strategy once rather than adding `!important` per declaration.

### 17.2 Compilation pipeline

1. Resolve definition and validate target/context.
2. Resolve references and effective source layers.
3. Normalize structured values to canonical declarations.
4. Diff against lower layers; omit redundant declarations.
5. Group identical preset/global declarations into shared classes.
6. Emit base, breakpoint, state, and breakpoint×state rules in deterministic order.
7. Emit responsive visibility utilities after normal display rules.
8. Emit target-scoped custom declarations after generated local rules.
9. Retain imported legacy fallback rules in a documented compatibility section.
10. Hash content, write immutable stylesheet, and retire stale assets through the existing renderer lifecycle.

### 17.3 Specificity and conflicts

- New mapped declarations do not receive `!important`.
- Visibility utilities may use `!important` because hiding is an explicit final utility and is stored outside layout display.
- Legacy mapped/fallback `!important` remains honored until migrated or explicitly normalized.
- User custom CSS is automatically scoped to the element and registered targets. `&` represents the active target. Page/global custom CSS remains a separate page-level feature.
- Nested parts use direct-child or definition-owned selectors to prevent leaking into nested instances.
- CSS variables back tokens and repeated compound values. Removing/resetting a value removes the rule or declaration on the next compile.

### 17.4 Editor/frontend parity

Create a serializable compiler fixture format consumed by JavaScript and PHP tests. The preview compiler and PHP compiler must produce semantically equivalent selector/declaration snapshots for every target, breakpoint, state, token, preset, reset, and migration fixture. Differences in formatting are normalized before comparison; differences in cascade order fail tests.

## 18. WordPress integration

- Continue storing the canonical document in registered post meta, with `revisions_enabled`, REST schema, sanitization callback, and authorization callback. WordPress's current metadata API explicitly supports revisioned meta; see [register_meta()](https://developer.wordpress.org/reference/functions/register_meta/) and [post metadata revisions](https://developer.wordpress.org/news/2023/11/whats-new-for-developers-november-2023/).
- Keep custom REST routes for atomic document save, stale-version protection, autosave, revisions, parity diagnostics, content-mode patches, and migration preview/apply. Every mutating route checks post capability and nonce/REST authentication.
- Autosave v3 documents to the autosave revision meta without forcing migration of the published parent. Restore validates and reports the registry/schema version.
- Sanitize early, validate all enums/structures, and escape late by output context. WordPress's official guidance requires context-appropriate `esc_html`, `esc_attr`, `esc_url`, `wp_kses`, and validation rather than trusting stored data. See [Escaping Data](https://developer.wordpress.org/apis/security/escaping/).
- Keep PHP rendering authoritative on the frontend. React preview may materialize dynamic/commerce data but cannot become the only renderer.
- Resolve theme compatibility through controlled specificity, reset boundaries, and parity fixtures across block/classic themes. Do not erase theme typography globally unless the page template explicitly opts into builder isolation.
- Register new schema/definition manifests during plugin load. Cache parsed manifests by plugin version and invalidate on plugin update.
- Preserve the existing 2 MB, 1,000-block, 50-depth, action, token, role, selector, and string limits; revise limits only with measured fixtures.
- WordPress media values store attachment ID plus normalized fallback metadata so URLs can be regenerated after domain changes and responsive image functions can be used.
- Dynamic data, shortcodes, WooCommerce, and conditions execute only through allowlisted server adapters with current user/post context.

## 19. Backward compatibility

### 19.1 Read strategy

`DocumentAdapter` accepts schema 1, 2, and 3. Versions 1/2 remain rendered through a compatibility view model and legacy CSS compiler until the user previews/applies migration. Opening an old page does not mutate it. Saving an unrelated WordPress field does not migrate it.

### 19.2 Element inference

Infer definition ID in this order:

1. Existing explicit `element` ID.
2. Specialized `type` (`woocommerce_product`, `form_field`, and related types).
3. `type + tag + attributes` discriminator: button-like anchor → `core/button`; `h1-h6` → `core/heading`; `img` → `core/image`; `hr` → `core/divider`; `iframe` → `core/embed`; semantic/form/media tags → their definitions.
4. Known widget-library root class/source → composite definition.
5. Imported native tag matcher.
6. Safe `legacy/html-node` definition with read-only diagnostics if ambiguous.

Inference is deterministic and produces a migration report with confidence and reasons. Ambiguous nodes are never guessed into destructive structured props.

### 19.3 Style mapping

- `styles` → target `root`, context `base`.
- `responsive_overrides.tablet/mobile` → root contexts `bp:tablet` and `bp:mobile`.
- `states.hover/focus/active` → root contexts `state:hover`, `state:focus`, and `state:active`.
- Existing token/role bindings move with their declaration.
- Current raw fallback stays in `custom_declarations` or `style.legacy` when it cannot be safely decomposed.
- Imported pseudo/media rules already represented in metadata are mapped when target/state/breakpoint matching is safe; otherwise preserved as scoped imported CSS.
- Content `text-align` values remain style declarations but the control relocates to Style.
- Responsive visibility encoded as `display:none` is migrated to Advanced visibility only when provenance proves it came from the visibility UI. Arbitrary user display declarations remain layout styles.

### 19.4 Versioning

Document schema version and element definition version are independent. A Button definition can migrate from v1 to v2 without changing the whole document format. Migrators are pure, idempotent, ordered, fixture-backed functions. Old migrators are frozen rather than importing mutable current helpers, following the same reliability principle documented by WordPress for block deprecations in [Block Deprecation](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-deprecation/).

## 20. UX improvements

- Search labels, descriptions, aliases, CSS property names, and element-part names. Results show `Style › Button › Icon › Color` breadcrumbs.
- Filters: All, Modified, Current breakpoint, Any breakpoint, Current state, Variables, Inherited, Errors.
- Accordion groups remember open state per element definition and tab, not globally across unrelated elements.
- The first primary group opens; modified groups with errors open automatically; heavy optional groups lazy-mount.
- Every field has Reset local, Clear context override, Revert preset/global, Copy value, and View source actions as applicable.
- Modified indicators distinguish local, breakpoint, state, and custom CSS. A single generic blue dot is insufficient.
- Four-side and four-corner controls support linked/unlinked input; logical sides can be enabled by advanced preference.
- Numeric fields support typing, keyboard arrows, scrub drag, wheel only when focused, units, `calc/min/max/clamp`, tokens, and CSS variables according to the control contract.
- Canvas handles and panel controls call the same command. The panel immediately reflects canvas changes and vice versa.
- Destructive shared changes show affected count and scope. Resetting an element preset does not silently delete the preset globally.
- Empty/error/loading UI is designed for target pickers, media, dynamic sources, presets, and control search.
- Keyboard users can reach tabs, groups, context picker, controls, and popovers with visible focus and predictable Escape behavior.
- Control descriptions are concise and contextual. Technical CSS names appear in developer help, not as unexplained placeholders.
- The panel never shows a fake control that is cosmetic or unsupported by schema/rendering. Feature flags label experimental controls and block unsupported saves.

## 21. Performance architecture

### 21.1 Budgets

- Selecting a node in a 1,000-block document: p95 under 50 ms after the click event.
- Opening a normal inspector tab: p95 under 100 ms; heavy media/query controls may show a shape-matched skeleton.
- Editing a scalar style value: preview response under 50 ms and history commit under 100 ms on the repository's reference machine.
- No full-document deep clone on every keystroke. Commit on intentional transactions while preview uses an ephemeral draft.
- No full stylesheet rebuild during a drag/scrub frame; compile the selected element fragment, then finalize the immutable asset on save.

### 21.2 Safeguards

- Split `src/index.js` into store commands, registries, resolver, compiler, inspector shell, and element packages.
- Index blocks by ID and parents in store state. Do not recursively scan the tree for every selection/control render.
- Memoize the resolved panel by definition version, active target/context, relevant props, parent layout capability, and feature flags.
- Mount only the active tab; virtualize very long repeaters/target lists; lazy-load code editor, media library, gradient editor, icon library, condition builder, and animation timeline.
- Use selector subscriptions in Zustand so a change to one control does not rerender the editor shell and entire canvas.
- Batch scrub/canvas-handle preview updates with `requestAnimationFrame`; make one history entry on pointer release.
- Incrementally compile by stable block ID and cache definition/preset/global layers by content hash.
- Prune empty contexts and redundant declarations to control document and CSS size.
- Track panel resolution, selection, control interaction, compile, save payload, CSS bytes/rules, and React commit metrics in development diagnostics.

## 22. Migration strategy

1. **Inventory:** scan fixture and real local documents read-only; report schema versions, types/tags/classes, mapped properties, fallback CSS, responsive/state branches, roles/tokens, ambiguous nodes, and unsupported selectors.
2. **Build adapters first:** v1/v2 adapter and legacy compiler must pass current tests before v3 writing is enabled.
3. **Introduce schema v3 behind a feature flag:** new documents can opt in; existing pages remain legacy.
4. **Migration preview:** show element mapping, moved/renamed fields, preserved raw declarations, warnings, and before/after parity snapshot without saving.
5. **Backup:** rely on revisioned meta and also store migration metadata (source hash, source schema, target schema, plugin version, timestamp, warning count). Do not duplicate the whole document outside revisions unless measured need requires it.
6. **Apply atomically:** validate v3, compile CSS, run parity checks, then update post meta with stale-version protection. On failure, retain source document and CSS.
7. **Canonical write:** after successful migration, normal saves write v3. The source revision remains restorable.
8. **Rollback:** restoring an old revision reactivates the adapter; it does not require reverse migration.
9. **Batch/CLI later:** only after single-page migration is proven, add dry-run and apply commands with machine-readable results and resumable cursors.
10. **Deprecation window:** retain legacy reader/compiler for at least two major plugin releases and until telemetry/local audits show no remaining v1/v2 pages in supported environments.

## 23. Step-by-step implementation plan

### Phase A — Baseline and contracts

#### Task A1 — Freeze control and document fixtures

**Purpose:** Establish exactly what current pages contain and prevent the overhaul from silently dropping values.

**Files/architecture affected:** `tests/fixtures/`, new `tests/control-inventory-test.mjs`, new `tests/fixtures/migrations/`, `includes/class-code-to-block-schema.php`, `src/custom-css.mjs`, `upgrade/VERIFICATION_AUDIT.md`.

**Implementation:**

1. Add representative v1 and v2 JSON fixtures for every broad type, allowed native tag family, responsive branch, state branch, token/role binding, raw fallback, widget root, Form/Field, and Woo type.
2. Add a read-only inventory script that emits types, tags, properties, state/breakpoint contexts, attributes, sources/classes, and unsupported values.
3. Snapshot current sanitized documents, frontend HTML, generated CSS, editor style snapshots, and migration-relevant metadata.
4. Include known edge cases: duplicate-looking titles, button-like anchors, decorative images, nested forms rejected by validation, `display:none` from visibility, arbitrary user display, imported pseudo/media CSS, and locked components.

**Dependencies:** None.

**Migration considerations:** Fixtures are immutable evidence; do not normalize them before the migration tests consume them.

**Testing:** Run existing schema, renderer, import, responsive, tokens, guided roles, components, history, persistence, accessibility, and parity suites; record baseline outputs and performance.

**Acceptance criteria:** Every current storage branch has at least one fixture; inventory is deterministic; current tests pass or existing failures are recorded with exact commands; no production behavior changes.

#### Task A2 — Approve registry, context, and cascade ADRs

**Purpose:** Prevent implementation teams from creating parallel definitions or incompatible context keys.

**Files/architecture affected:** `design-decisions-log.md`, new `docs/control-registry-contract.md`, new `docs/style-context-contract.md`.

**Implementation:**

1. Record the stable `element`, independent `definition_version`, configured capability grants, registered targets, sparse context keys, and source precedence.
2. Record that Content/Style/Advanced supersedes the global Simple/Advanced field tier and that Advanced cannot mount Style groups.
3. Record stable selector classes, no universal `!important`, visibility outside `display`, and dual-read/canonical-write migration.
4. Define extension namespacing, registration conflicts, production fallback, and manifest versioning.

**Dependencies:** A1 inventory.

**Migration considerations:** ADR explicitly preserves legacy adapter/renderer behavior until page migration succeeds.

**Testing:** Architecture lint verifies example IDs/context keys against the draft JSON schema.

**Acceptance criteria:** The contracts answer identity, target selection, precedence, validation ownership, migration failure, and extension behavior without referring to unwritten conventions.

#### Task A3 — Extract editor domains from `src/index.js`

**Purpose:** Create reviewable boundaries before adding element packages.

**Files/architecture affected:** `src/index.js`; new `src/store/`, `src/inspector/`, `src/controls/`, `src/elements/`, `src/styles/`, `src/migrations/`; existing components.

**Implementation:**

1. Move pure store commands and selectors without changing their API.
2. Move current control components, tokens, raw CSS, animation/actions, forms, commerce, widgets, and diagnostics into domain modules.
3. Preserve `commitDocument`, permissions, stale save behavior, importer callbacks, and DnD contracts.
4. Add import-boundary rules so element definitions cannot import React or the store.

**Dependencies:** A2 boundaries.

**Migration considerations:** Pure refactor only; document output and build asset behavior must remain byte-equivalent where hashes allow.

**Testing:** All current JS/PHP suites, production build, editor mount, select/edit/save/reload smoke, and bundle comparison.

**Acceptance criteria:** `src/index.js` is an orchestration shell; each extracted domain has a documented public API; no user-visible or serialized change.

### Phase B — Registry and schema foundation

#### Task B1 — Create the typed control catalog

**Purpose:** Replace free-text CSS-field metadata with reusable, validated control contracts.

**Files/architecture affected:** new `src/controls/catalog.mjs`, `types.mjs`, `validators.mjs`, `normalizers.mjs`, `output-mappers.mjs`, `groups/`; new catalog tests.

**Implementation:**

1. Register primitive types, composite types, collection/reference types, and UI-only types from section 6.
2. Implement value schemas, units/functions, min/max/step, reset/default policy, responsive/state eligibility, and token/preset compatibility.
3. Build structured mappers for typography, background, border, shadow, spacing, sizing, layout, icon/media, filter, transform, and transition.
4. Retain a controlled `legacyCssValue` input only for adapter/custom-declaration use.

**Dependencies:** A3 extraction.

**Migration considerations:** Map every current `STYLE_CONTROL_FIELDS` entry to a new control/group or documented legacy path.

**Testing:** Unit tests for valid/invalid values, structured-to-CSS serialization, reset pruning, unit/function allowlists, and round-trip stability.

**Acceptance criteria:** No new first-class control requires editing a universal property array; every catalog item declares validation and output behavior.

#### Task B2 — Create the element definition registry

**Purpose:** Make one definition drive creation, inspector, validation, rendering, insertion, migration, and tests.

**Files/architecture affected:** new `src/elements/registry.mjs`, `definition-schema.mjs`, `resolver.mjs`, `families.mjs`, `legacy-matchers.mjs`, initial `definitions/`; `src/block-type.mjs`.

**Implementation:**

1. Implement registration, uniqueness, aliases, definition versions, parent/child policies, props, content groups, targets, group grants, advanced grants, palette metadata, validators, and renderer keys.
2. Implement the pure panel resolver and explicit dependency conditions.
3. Add initial definitions for current palette and specialized schema types without changing UI.
4. Change `blockTypeFor` to return legacy renderer family plus a definition inference result; preserve original tags.
5. Generate a machine-readable manifest for PHP.

**Dependencies:** B1 catalog.

**Migration considerations:** Legacy matchers return confidence/reason and never mutate source nodes.

**Testing:** Registry validation, resolver snapshots by element/target/context/parent layout, ambiguous match fixtures, extension conflict tests.

**Acceptance criteria:** Palette and inspector can be derived from definitions; invalid grants fail development builds; unknown production definitions use a safe diagnostic fallback.

#### Task B3 — Add server registry-manifest validation

**Purpose:** Prevent the client from saving definitions, targets, contexts, props, or controls the PHP renderer does not understand.

**Files/architecture affected:** generated `includes/generated/control-registry.php` or JSON asset; new `includes/class-code-to-block-registry.php`; plugin bootstrap; schema tests.

**Implementation:**

1. Generate a deterministic manifest during build from the JS registry.
2. Load/cache it by plugin/registry version in PHP.
3. Validate element IDs, definition versions, tags, props, target IDs, context keys, declarations, advanced grants, and extension namespaces.
4. Expose read-only registry metadata to the editor bootstrap and REST diagnostics.

**Dependencies:** B2 registry.

**Migration considerations:** Versions 1/2 bypass v3 element validation but still use existing safety validation.

**Testing:** JS/PHP manifest parity, tampered payloads, unknown target/context/prop, stale registry version, allowed extension namespace.

**Acceptance criteria:** A client-only definition cannot be persisted; manifest mismatch produces a path-specific actionable error.

#### Task B4 — Implement schema v3 and canonical normalization

**Purpose:** Store semantic props, target styles, sparse contexts, and advanced settings without breaking versions 1/2.

**Files/architecture affected:** `includes/class-code-to-block-schema.php`; new `src/schema-v3.mjs`; REST schemas; fixtures/tests.

**Implementation:**

1. Add `VERSION = 3` while accepting 1/2/3.
2. Implement v3 document/block/style/advanced sanitizers against the registry manifest.
3. Validate context grammar, token/preset references, unique IDs, part item IDs, parent/child policy, conditions, attributes, and CSS declarations.
4. Canonicalize key order and prune empty/default branches.
5. Keep current limits and add per-repeater/per-target limits.

**Dependencies:** B3 server registry.

**Migration considerations:** Existing save/load endpoints continue accepting legacy documents; no implicit upgrade.

**Testing:** Path-specific rejection tests, max limits, canonical byte stability, v1/v2 regression, v3 round trip, malicious attributes/CSS/conditions.

**Acceptance criteria:** v3 can represent all section 16 examples; save-load-save is stable; legacy fixtures remain accepted and unchanged.

#### Task B5 — Build v1/v2 adapter and pure migrators

**Purpose:** Provide safe dual-read and deterministic migration.

**Files/architecture affected:** new `src/migrations/adapter.mjs`, `v1-to-v3.mjs`, `v2-to-v3.mjs`, `element-migrators/`; PHP mirror/endpoint class; migration tests.

**Implementation:**

1. Implement element inference order from section 19.
2. Map root styles/responsive/states/tokens/roles and preserve unparsed fallback/imported CSS.
3. Move semantic data into props only when inference is lossless; retain original attributes and migration notes otherwise.
4. Produce structured report entries: source path, target path, action, confidence, warning, retained legacy data.
5. Make each migrator pure, idempotent, versioned, and frozen with its own helpers.

**Dependencies:** B2, B4.

**Migration considerations:** This task is the migration layer; source JSON remains immutable.

**Testing:** Every A1 fixture, double migration idempotence, ambiguous fallback, role/token retention, state/responsive mapping, CSS/HTML parity.

**Acceptance criteria:** No source field disappears without a report entry; migrated fixture passes v3 validation; legacy and migrated frontend parity matches within documented intentional changes.

### Phase C — Targeted style engine

#### Task C1 — Add style target markers to render contracts

**Purpose:** Give complex elements stable, scoped, editor/frontend-identical part selectors.

**Files/architecture affected:** `src/BlockContent` extraction, `includes/class-code-to-block-renderer.php`, form/commerce renderers, element render contracts, target tests.

**Implementation:**

1. Emit stable root class from block ID and `data-ctb-part` on builder-owned parts.
2. Add target markers to core primitives, Form/Field, and Woo renderers; document conditional/repeated parts.
3. Preserve current `.ctb-block-N` classes for legacy CSS during the compatibility window.
4. Ensure nested elements do not inherit parent part markers accidentally.

**Dependencies:** B2 registry, B4 schema.

**Migration considerations:** Legacy selector classes remain emitted only where needed; v3 uses stable selectors.

**Testing:** Editor/frontend DOM snapshots, duplicate/reorder stability, nested same-element instances, conditional parts, saved components.

**Acceptance criteria:** Every registered target resolves to exactly the intended DOM node(s) in editor and frontend; reorder does not change v3 selector identity.

#### Task C2 — Implement the context resolver

**Purpose:** Calculate effective values and sources across defaults, globals, presets, local, breakpoint, and state layers.

**Files/architecture affected:** new `src/styles/context.mjs`, `cascade.mjs`, `sources.mjs`; replacement path for `responsive-styles.mjs`; tests.

**Implementation:**

1. Parse/format context keys and breakpoint chains.
2. Resolve each value with source metadata and explicit/inherited status.
3. Apply group/element preset stacks and Guided Role adapter.
4. Implement set/clear/reset/detach commands that prune empty contexts and commit once.
5. Add visibility as a separate advanced resolver.

**Dependencies:** B4 schema, B5 adapter.

**Migration considerations:** Expose compatibility helpers matching current `effectiveMappedStyles` until all callers move.

**Testing:** precedence matrix, tablet/mobile clearing, state and breakpoint×state, token/preset override/detach, role compatibility, visibility/display conflict.

**Acceptance criteria:** Every effective value identifies one exact source; clearing restores the expected lower layer; no inherited value is serialized locally.

#### Task C3 — Build JavaScript and PHP CSS compilers

**Purpose:** Generate stable, efficient, predictable CSS from the same contract.

**Files/architecture affected:** new `src/styles/compiler.mjs`; refactor `includes/class-code-to-block-renderer.php`; stylesheet cache/hash logic; compiler fixtures.

**Implementation:**

1. Compile stable root/target selectors, base, breakpoints, states, intersections, visibility, presets/globals, and custom declarations.
2. Stop adding `!important` to v3 mapped declarations; retain legacy behavior in legacy rules.
3. Deduplicate shared preset/global rules and redundant local declarations.
4. Compile per-element fragments for preview and full immutable stylesheet on save.
5. Emit a normalized debug manifest mapping selector back to block/target/context/source.

**Dependencies:** C1 markers, C2 resolver.

**Migration considerations:** Dual compiler selection by schema/element migration status; mixed documents are supported during transition.

**Testing:** cross-language fixture parity, theme collision fixtures, nested targets, reorder CSS stability, reset cleanup, size/rule counts, malicious custom CSS.

**Acceptance criteria:** JS and PHP semantic snapshots match; v3 CSS has no automatic `!important` except visibility utility; unchanged elements keep identical CSS fragments.

#### Task C4 — Implement state and responsive editor commands

**Purpose:** Make schema-supported contexts editable without duplicated panels.

**Files/architecture affected:** new `src/store/style-commands.mjs`, `src/inspector/StyleContextBar.js`, `ResponsiveEditorPopover.js`, state preview utilities, tests.

**Implementation:**

1. Add target/breakpoint/state/source selection and synchronize canvas breakpoint.
2. Add all-values responsive popover, inherited placeholders, indicators, and clear actions.
3. Add state preview attributes/classes inside the iframe without mutating content semantics.
4. Implement applicable-state filtering and state-property restrictions.
5. Commit drag/scrub edits as one history transaction.

**Dependencies:** C2/C3.

**Migration considerations:** Current root tablet/mobile/hover/focus/active values appear in the new context UI through the adapter.

**Testing:** every state, every breakpoint, intersections, cancel/undo/redo, source indicators, state preview cleanup, touch-hover warning.

**Acceptance criteria:** Users can inspect/edit/clear any supported context; no context switch loses values; the panel tree is reused rather than duplicated.

### Phase D — Inspector and shared control UI

#### Task D1 — Replace the inspector shell

**Purpose:** Render strict tab contracts and resolved groups instead of tag-based hardcoding.

**Files/architecture affected:** `src/components/RightInspector.js`; new `src/inspector/InspectorShell.js`, `PanelSearch.js`, `GroupSection.js`, `ControlRenderer.js`, `SourceBadge.js`; CSS.

**Implementation:**

1. Render header, breadcrumb, preset/source, actions, tabs, search, filters, and active context.
2. Consume only resolver view models; remove universal Title/tag/alignment/visibility branches.
3. Mount active tab only, persist open groups per definition/tab, and lazy-mount heavy controls.
4. Implement empty, error, loading, unsupported legacy, locked, and mixed-selection states.
5. Move document-wide token/role managers to dedicated manager surfaces; keep field-level pickers.

**Dependencies:** B2 resolver, C4 context UI.

**Migration considerations:** Legacy nodes receive resolved compatibility groups and a migration badge; no raw universal panel fallback.

**Testing:** keyboard/a11y, search/filter, group persistence, lock behavior, 320px panel width, long labels/localization, resolver error fallback.

**Acceptance criteria:** Content contains no style/visibility controls; Advanced contains no Style group; changing element changes only definition-granted controls.

#### Task D2 — Build production shared group controls

**Purpose:** Replace raw string inputs with complete composite controls.

**Files/architecture affected:** `src/controls/components/`, `src/controls/groups/`, editor CSS, media/icon integration.

**Implementation:**

1. Implement typography, text, background layers/gradient, border/per-side/radius, shadow stack, spacing, sizing, flex/grid, child placement, media, icon, filters, and opacity.
2. Add units/functions/tokens, link/unlink, scrub/keyboard input, accessible popovers, reset/source menus, validation errors.
3. Ensure every input writes through style commands and does not own duplicate draft storage after commit.
4. Preserve unknown legacy values in a visible Advanced value mode rather than coercing them.

**Dependencies:** B1 catalog, D1 shell, C2 commands.

**Migration considerations:** Current valid CSS strings parse into structured controls when lossless; otherwise stay editable in legacy/custom declaration mode.

**Testing:** component a11y, keyboard/pointer, every unit/function, linked sides/corners, token/preset sources, invalid values, undo/redo, canvas-panel consistency.

**Acceptance criteria:** Core elements can be styled without typing CSS strings for ordinary properties; structured controls round-trip to deterministic CSS.

#### Task D3 — Implement Add style group and target management

**Purpose:** Provide explicit progressive disclosure without a global Simple/Advanced mode.

**Files/architecture affected:** `StyleTargetPicker.js`, `AddStyleGroupMenu.js`, resolver metadata, element style commands.

**Implementation:**

1. Show primary/recommended/optional groups from the active target grant.
2. Keep modified optional groups visible; show counts for modified targets/groups.
3. Add/remove optional groups without deleting values unless the user confirms value removal.
4. Support canvas part selection and target highlighting.
5. Filter add-menu options to registered valid grants only.

**Dependencies:** D1/D2, C1 targets.

**Migration considerations:** A migrated value makes its group visible even if the new definition classifies it optional.

**Testing:** conditional parts, remove/restore, search hidden optional group, canvas/panel target sync, nested targets.

**Acceptance criteria:** No irrelevant group can be enabled; every configured optional group is discoverable; modified values are never hidden or discarded silently.

### Phase E — Element definitions

#### Task E1 — Implement migration-critical core elements

**Purpose:** Make current palette elements complete before expanding the library.

**Files/architecture affected:** definitions/renderers for Section, Container, Heading, Paragraph, Button, Image, Divider, Embed; LeftRail derived palette; parser transforms.

**Implementation:**

1. Implement full props, content groups, targets, style grants, advanced grants, defaults, insertion/child rules, validators, and render contracts from sections 9-10.
2. Expose Divider and Embed factories through the registry palette.
3. Separate visible text labels from HTML title attributes; constrain semantic tag choices.
4. Add required link, image accessibility, button modes/icon targets, and media performance fields.

**Dependencies:** D1-D3, C1-C4.

**Migration considerations:** Cover every current primitive and tag/type discriminator before enabling v3 migration.

**Testing:** per-element Content/Style/Advanced snapshots, creation/save/reload/frontend, exclusions, states, responsive, copy/paste, duplicate, dynamic/slot compatibility.

**Acceptance criteria:** Selecting each core element yields the section 10 hierarchy and none of its excluded controls; current fixtures preserve visual parity.

#### Task E2 — Implement layout element family

**Purpose:** Add Row, Column, neutral Wrapper, and reliable parent/child layout capabilities.

**Files/architecture affected:** layout definitions/renderers, insertion/tree policy, flex/grid controls, drop resolver constraints.

**Implementation:**

1. Add Section/Row/Column/Container/Wrapper hierarchy and permitted transformations.
2. Resolve parent flex/grid child controls dynamically while storing them on the child root.
3. Add responsive structure/order without duplicating/reparenting content.
4. Update DnD validity and navigator labels from definitions.

**Dependencies:** E1, D2 layout groups, existing deterministic DnD resolver.

**Migration considerations:** Imported generic divs stay Wrapper/Container based on children/layout evidence; ambiguous nodes are not forced into Row/Column.

**Testing:** nested flex/grid, repeated layout-mode switching, absolute child, reorder/undo, invalid parent, responsive order, 50-depth limit.

**Acceptance criteria:** Layout controls appear only on containers; child placement reflects the actual parent; DnD guards remain intact.

#### Task E3 — Implement text and utility element family

**Purpose:** Complete Rich Text, Link, List/List Item, Figure/Caption, Icon, Spacer, HTML, Code, Shortcode, Quote, and Blockquote.

**Files/architecture affected:** text/media utility definitions, rich-text sanitizer/editor, shortcode adapter, icon/media picker, parser transforms.

**Implementation:**

1. Add semantic props/targets and strict content sanitization.
2. Implement Rich Text descendant profiles without arbitrary descendant selectors.
3. Add meaningful/decorative icon rules, Code copy behavior, Shortcode integration contracts, and Spacer warnings.
4. Define import matchers and transforms between compatible elements.

**Dependencies:** E1, D2 typography/media/icon.

**Migration considerations:** Preserve imported native tags and sanitized rich HTML; opaque shortcode output remains wrapper-only.

**Testing:** rich-text paste/XSS, list nesting, icon SVG safety, code literal preservation, shortcode allowlists, quote semantics, exclusions.

**Acceptance criteria:** Each requested utility element is first-class and cannot expose controls outside its definition.

#### Task E4 — Implement media and navigation family

**Purpose:** Add Video, Audio, Map, Logo, Menu/Navigation, Social Icons, Breadcrumbs, and Search.

**Files/architecture affected:** media/nav/search definitions and PHP/preview renderers, WordPress menu/media adapters, interaction runtime, accessibility tests.

**Implementation:**

1. Add media source/track/transcript/performance contracts and autoplay/reduced-motion validators.
2. Add navigation target markers, current/expanded states, responsive mobile panel, and keyboard behavior.
3. Add server-backed breadcrumbs/search sources and safe live-results behavior.
4. Add Map consent/fallback and Logo site-identity binding.

**Dependencies:** E3, C4 states, F1 advanced behavior.

**Migration considerations:** Native imported audio/video/iframe/nav tags retain attributes; do not claim provider-specific features without an adapter.

**Testing:** keyboard/screen reader semantics, network/lazy behavior, media policies, mobile nav, current item, search debounce/results, consent mode.

**Acceptance criteria:** All elements work without custom CSS/HTML for their core use case and pass definition-specific accessibility checks.

#### Task E5 — Integrate Forms as first-class elements

**Purpose:** Reconnect existing Form/Field functionality and expand it into target-aware controls.

**Files/architecture affected:** current `FormsPanel` logic, form store commands, PHP form renderer/handler, definitions for Form/Field/Input/Textarea/Select/Checkbox/Radio/File/Submit.

**Implementation:**

1. Move form content/settings into the selected element's Content tab and derive palette entries from definitions.
2. Split broad `form_field` UI into definition IDs while retaining renderer-family compatibility.
3. Emit stable parts for label/control/help/error/required; add validation/autocomplete/options schema.
4. Reuse Button profile for Submit and shared field profile for controls.
5. Keep native/external integration allowlists and spam/security enforcement server-side.

**Dependencies:** E1, D2, C1 targets.

**Migration considerations:** Infer existing `data-field-type`; preserve attributes and external shortcodes; report unsupported/custom field types.

**Testing:** every field type, options/defaults, labels/IDs, invalid/focus/checked/disabled, submission security, save/reload, external integration fallback.

**Acceptance criteria:** Existing Forms are editable from the main registry inspector; styling targets render in editor/frontend; no dormant parallel Forms panel remains.

#### Task E6 — Implement interactive composite elements

**Purpose:** Add Accordion, Toggle, Tabs, Testimonial, Counter, Progress, Gallery, Slider, Carousel, Pricing Table, Icon Box, Countdown, and Team Member.

**Files/architecture affected:** composite definitions/renderers/runtime, `widget-library.mjs`, reusable component/slot integration.

**Implementation:**

1. Convert current widget templates to registered composites or explicitly keep them as reusable component templates whose roots carry a composite profile.
2. Add stable repeater item IDs, shared targets, optional per-item overrides, keyboard/state runtime, and reduced-motion policies.
3. Reuse Button, Link, Image, Icon, and typography target profiles rather than cloning controls.
4. Define static fallback HTML for scripts disabled or failed.

**Dependencies:** E3/E4, C4 states, G1 runtime motion.

**Migration considerations:** Detect current widget source/classes; preserve slots and internal child IDs; FAQ template becomes Accordion only if behavior/structure is unambiguous.

**Testing:** repeater edits/reorder, states, keyboard, no-JS fallback, reduced motion, autoplay pause, item overrides, component slots, 1,000-block limit.

**Acceptance criteria:** Every composite has named part targets and complete content/style/advanced UI; current widgets are not left as disconnected panel code.

#### Task E7 — Integrate WooCommerce definitions

**Purpose:** Reconnect existing commerce types without coupling product data editing to visual controls.

**Files/architecture affected:** current `WooCommercePanel`, commerce store commands/preview, PHP renderer/parity, definitions for Product/Grid/Cart/Checkout.

**Implementation:**

1. Move product/grid/cart/checkout element configuration into Content and register palette availability conditionally on WooCommerce.
2. Keep product data editor in a separate contextual workflow linked from Product Content.
3. Add stable target contracts around controlled Woo output; version the contract by Woo/plugin version.
4. Reuse form/button/link/media profiles; add query/performance validation.

**Dependencies:** E5 form profiles, E6 composite targets.

**Migration considerations:** Preserve existing specialized types and `data-*` settings; render legacy markup until target contract parity is proven.

**Testing:** Woo unavailable, simple/variable products, grid query, cart/checkout states, dynamic data, server security, frontend/editor parity across supported Woo versions.

**Acceptance criteria:** Commerce elements appear only when supported; selecting one exposes its own hierarchy; no generic root CSS panel substitutes for its parts.

### Phase F — Advanced systems and global design

#### Task F1 — Implement Advanced group registry

**Purpose:** Replace the current dumping-ground Advanced tab with configured reusable systems.

**Files/architecture affected:** `src/advanced/` groups and validators; permissions/conditions/performance/runtime adapters; Advanced resolver.

**Implementation:**

1. Build Placement, Motion, Visibility, Conditions, Attributes/Accessibility, Performance, Permissions, and Developer groups.
2. Configure each element's allowed fields/targets; remove visual groups from Advanced.
3. Implement responsive visibility outside display, server-rendered conditions, target-aware attributes, focus/ARIA guardrails, and media performance attributes.
4. Integrate existing animations/actions/permissions/diagnostics without cosmetic unsaved controls.

**Dependencies:** B2 grants, C2/C3, D1.

**Migration considerations:** Map current attributes/actions/permissions and provenance-based visibility; retain unsupported settings with warnings.

**Testing:** position/sticky containing blocks, visibility conflict, condition truth tables/server output, attribute XSS/ARIA, reduced motion, permissions enforcement, custom CSS scoping.

**Acceptance criteria:** Every Advanced control persists and enforces behavior; Advanced contains no duplicate typography/background/border/sizing/spacing controls.

#### Task F2 — Implement global styles and presets

**Purpose:** Separate tokens, group presets, element presets, global element styles, and reusable components with explicit precedence.

**Files/architecture affected:** schema v3 registries, manager UI, source resolver, CSS compiler, guided roles adapter, component integration.

**Implementation:**

1. Add design-token categories, group-preset compatibility profiles, element presets, global family styles, and preset stacks.
2. Add manager surfaces, field pickers, affected counts, shared-edit/override/detach flows, default presets, and orphan diagnostics.
3. Adapt Guided Roles to source references and retain adjustment/override semantics.
4. Deduplicate CSS by shared classes/variables and enforce precedence from section 14.

**Dependencies:** C2/C3, D2, E1 definitions.

**Migration considerations:** Preserve token/role references exactly; do not flatten shared values during migration.

**Testing:** update propagation, local/state/breakpoint overrides, nested group presets, delete/reassign, component import/collision, CSS deduplication.

**Acceptance criteria:** A shared edit updates all consumers predictably; every field reports source; no two managers own the same stored value.

### Phase G — Migration, cleanup, and release

#### Task G1 — Build migration preview/apply/rollback UI and REST flow

**Purpose:** Let users adopt v3 safely with evidence before mutation.

**Files/architecture affected:** new migration REST routes/controller methods, migration dialog/report components, revisions integration, CLI later.

**Implementation:**

1. Add read-only preview returning source hash, v3 candidate, structured report, validation, CSS/HTML parity, and warnings.
2. Show counts and drill-down by element/property; block Apply on errors and require acknowledgement for ambiguous retained legacy nodes.
3. Apply atomically with stale-version check, revision, CSS compile, and rollback on failure.
4. Link to the source revision and support restoring it through existing revisions UI.

**Dependencies:** B5, C3, all migration-critical definitions.

**Migration considerations:** Central task; never migrate merely by opening the editor.

**Testing:** stale preview, failed compiler, permission denial, concurrent save, revision restore, double apply, mixed document, large document/timeout.

**Acceptance criteria:** Failed migration leaves post meta and active CSS untouched; successful migration is v3-valid and restorable.

#### Task G2 — Remove, relocate, and deprecate legacy controls

**Purpose:** Finish the architectural cleanup rather than layering v3 on top of the generic panels.

**Files/architecture affected:** `RightInspector.js`, `custom-css.mjs`, `index.js`, dormant panels, CSS, tests, generated bundle.

**Implementation:**

1. Remove universal Title/tag/alignment/visibility UI and the two `MappedStyleControls` mounts after registry coverage.
2. Delete global simple/advanced tiers and dead panel mode/search parameters.
3. Remove disconnected Forms/Woo/Widget panels after registry equivalents pass.
4. Keep legacy parsing/compiler helpers in clearly named compatibility modules with deprecation annotations and usage counters.
5. Remove obsolete CSS and unused imports; update decision/audit docs.

**Dependencies:** E1-E7, F1/F2, G1.

**Migration considerations:** Compatibility modules remain until the deprecation window ends; UI removal does not remove legacy reading.

**Testing:** dead-code/import checks, production build, every legacy fixture, no missing panel feature, bundle size comparison.

**Acceptance criteria:** There is one inspector resolver, one responsive/state engine, one source resolver, and one v3 compiler; dead dormant panels are gone.

#### Task G3 — Complete performance, security, accessibility, and parity gates

**Purpose:** Prove the overhaul is production-ready at full scope.

**Files/architecture affected:** test suites, performance harness, CI scripts, diagnostics, release checklist.

**Implementation:**

1. Run the complete matrix in section 25 across all definitions/targets/groups/contexts.
2. Add 1,000-block and deep-composite inspector/compile/save benchmarks with budgets from section 21.
3. Fuzz props, contexts, attributes, CSS, conditions, dynamic sources, and migration input on client and server.
4. Run automated a11y plus manual keyboard/screen-reader/high-contrast/reduced-motion checks.
5. Compare editor/frontend DOM/CSS/screenshots and classic/block themes at Desktop/Tablet/Mobile.

**Dependencies:** All implementation tasks.

**Migration considerations:** Include unmigrated, migrated, mixed, restored, and future-unknown-version failure cases.

**Testing:** This task is the consolidated gate; exact commands and measured results are recorded in a new verification audit.

**Acceptance criteria:** No blocker in sections 25-26 remains; performance budgets pass; security/a11y high-severity issues are zero; release notes state known low-risk limitations.

## 24. Per-element implementation checklists

Each row is complete only when the Content, Style/targets, Advanced, and verification boxes all pass. Exclusion assertions refer to the explicit exclusions in sections 9-10.

| Element | Content | Style and targets | Advanced | Verification |
|---|---|---|---|---|
| Section | [ ] semantic region, label, anchor, child policy | [ ] Root layout/background/sizing/spacing/border/shadow/filter | [ ] placement/motion/visibility/attributes/permissions/CSS | [ ] exclusions, breakpoints, reorder, save/frontend |
| Row | [ ] columns and structure templates | [ ] Root flex/grid and responsive gaps/structure | [ ] placement/order/visibility/attributes/CSS | [ ] repeated mode switching, DnD, undo, exclusions |
| Column | [ ] semantic wrapper and children | [ ] Root plus parent flex/grid item targets | [ ] placement/order/visibility/attributes/CSS | [ ] parent-dependent controls, nested layout, exclusions |
| Container | [ ] semantic tag and child policy | [ ] Root layout/sizing/spacing/background/border/shadow | [ ] parent item/placement/motion/conditions/attributes/CSS | [ ] flex/grid, nested targets, DnD, exclusions |
| Div / Wrapper | [ ] neutral semantic wrapper | [ ] Root display/sizing/spacing/background/border | [ ] placement/visibility/motion/attributes/CSS | [ ] imported div migration and exclusions |
| Heading | [ ] text/dynamic/link and H1-H6 | [ ] Text typography/text; Root box groups | [ ] placement/motion/visibility/attributes/heading diagnostic/CSS | [ ] all levels, link states, responsive, exclusions |
| Paragraph / Text | [ ] plain text/dynamic/semantic mode | [ ] Text typography/text; Root box groups | [ ] placement/motion/visibility/attributes/CSS | [ ] plain-text safety, inheritance, exclusions |
| Rich Text | [ ] sanitized editor and structure | [ ] Body/Headings/Links/Lists/Markers/Quotes/Code | [ ] visibility/attributes/permissions/target CSS | [ ] paste/XSS, states, heading/list semantics, exclusions |
| Link | [ ] label/URL/target/rel/download/icon | [ ] Root/Label/Icon and link states | [ ] placement/motion/visibility/attributes/CSS | [ ] safe new-tab rel, visited limits, exclusions |
| List | [ ] type/start/items/nesting | [ ] Root/Item/Marker/contained links | [ ] placement/visibility/attributes/CSS | [ ] reorder/nesting/ordered values/exclusions |
| List Item | [ ] item/value/nested content | [ ] Item/Marker and contained link states | [ ] parent placement/visibility/attributes/CSS | [ ] parent rules, copy/paste, exclusions |
| Button | [ ] label/mode/link/action/icon/loading | [ ] Root/Label/Icon/Spinner and all button states | [ ] placement/motion/visibility/attributes/permissions/CSS | [ ] mode conditions, keyboard/focus, responsive, exclusions |
| Image | [ ] media/alt/decorative/caption/link/sources | [ ] Media/Caption/Root | [ ] loading/decoding/fetch/placement/motion/attributes/CSS | [ ] alt diagnostics, intrinsic size, lazy load, exclusions |
| Figure / Caption | [ ] media/caption/source | [ ] Root/Media/Caption | [ ] placement/motion/visibility/attributes/CSS | [ ] figure semantics, conditional caption, exclusions |
| Icon | [ ] source/decorative/name/link | [ ] Icon/Root and link states | [ ] placement/motion/visibility/SVG policy/CSS | [ ] safe SVG, accessible name, exclusions |
| Divider | [ ] semantic/decorative orientation | [ ] Line/Root | [ ] parent placement/visibility/attributes/CSS | [ ] no-focus decorative output, responsive length, exclusions |
| Spacer | [ ] intentional no-content state | [ ] Root width/height only | [ ] visibility and limited migration attributes | [ ] frontend invisibility to AT, hit area editor-only, exclusions |
| Video | [ ] sources/poster/tracks/transcript/playback | [ ] Media/Caption/Root | [ ] preload/lazy/placement/motion/visibility/attributes/CSS | [ ] autoplay-muted rule, captions, reduced motion, exclusions |
| Audio | [ ] sources/title/transcript/playback | [ ] Player/Caption/Root | [ ] preload/placement/visibility/attributes/CSS | [ ] native limitations honest, transcript, exclusions |
| Embed / Iframe | [ ] provider/URL/title/sandbox/allow/consent | [ ] Frame/Placeholder | [ ] lazy/placement/motion/visibility/attributes/CSS | [ ] sandbox/security/title/consent/exclusions |
| Map | [ ] provider/location/markers/consent/fallback | [ ] Frame/Marker/Placeholder | [ ] lazy/placement/visibility/attributes/CSS | [ ] fallback link, consent, keyboard behavior, exclusions |
| Logo | [ ] site media/alt/link/text fallback | [ ] Media/Text/Root and link states | [ ] loading/placement/visibility/attributes/CSS | [ ] home link/name semantics, responsive, exclusions |
| HTML | [ ] sanitized source/trust/preview diagnostics | [ ] Root only | [ ] visibility/conditions/permissions/attributes/CSS | [ ] XSS/script isolation, imported parity, exclusions |
| Code | [ ] code/language/mode/lines/copy | [ ] Code/Toolbar/Copy Button | [ ] visibility/attributes/interaction/CSS | [ ] literal round trip, keyboard copy, exclusions |
| Shortcode | [ ] registered shortcode/attributes/content/fallback | [ ] Wrapper or registered integration targets | [ ] lazy/visibility/permissions/attributes/CSS | [ ] allowlist, opaque output, missing plugin, exclusions |
| Menu / Navigation | [ ] source/items/dropdown/mobile/a11y name | [ ] Root/Item/Link/Dropdown/Mobile/Toggle/Icon | [ ] sticky/motion/visibility/attributes/CSS | [ ] full keyboard/current/expanded/mobile/exclusions |
| Form | [ ] submission/fields/messages/spam/privacy | [ ] Form/Row/Label/Control/Help/Error/Success/Submit | [ ] conditions/attributes/permissions/performance/CSS | [ ] server submission/security/a11y/states/exclusions |
| Form Field group | [ ] type/label/name/help/options/validation | [ ] Row/Label/Control/Placeholder/Help/Error | [ ] parent placement/conditions/attributes/CSS | [ ] all field type conditions/migration/exclusions |
| Input | [ ] constrained type and validation attributes | [ ] Control/Placeholder/Label/Help/Error | [ ] placement/conditions/attributes/CSS | [ ] autocomplete/inputmode/invalid/focus/exclusions |
| Textarea | [ ] value/rows/length/resize/help | [ ] Control/Placeholder/Label/Help/Error | [ ] placement/conditions/attributes/CSS | [ ] resize/length/invalid/focus/exclusions |
| Select | [ ] options/default/multiple/required/dynamic | [ ] Control/Indicator/Label/Help/Error | [ ] placement/conditions/attributes/CSS | [ ] option IDs/native limitations/expanded/exclusions |
| Checkbox | [ ] value/default/required/consent/label | [ ] Control/Checkmark/Label/Help/Error | [ ] placement/conditions/attributes/CSS | [ ] checked/focus/invalid/consent/exclusions |
| Radio | [ ] group/options/default/legend | [ ] Group/Option/Control/Dot/Label/Error | [ ] placement/conditions/attributes/CSS | [ ] one selection/keyboard/invalid/exclusions |
| File Upload | [ ] accept/multiple/limits/labels/privacy | [ ] Dropzone/Button/Filename/Help/Error | [ ] placement/conditions/attributes/CSS | [ ] server limit/security/drag/focus/exclusions |
| Submit Button | [ ] submit/reset labels/icon/loading | [ ] Root/Label/Icon/Spinner | [ ] placement/motion/conditions/attributes/CSS | [ ] submit lifecycle/focus/disabled/exclusions |
| Accordion | [ ] items/open policy/heading levels | [ ] Root/Item/Header/Title/Icon/Content | [ ] transition/conditions/attributes/permissions/CSS | [ ] keyboard/ARIA/stable IDs/reorder/exclusions |
| Toggle | [ ] title/content/open/heading/icon | [ ] Root/Header/Title/Icon/Content | [ ] transition/conditions/attributes/CSS | [ ] keyboard/ARIA/open state/exclusions |
| Tabs | [ ] tabs/panels/default/orientation/activation | [ ] Root/Tablist/Tab/Active/Panel/Icon | [ ] transition/responsive/attributes/permissions/CSS | [ ] roving tabindex/keyboard/stable IDs/exclusions |
| Testimonial | [ ] quote/author/role/avatar/rating/source | [ ] Root/Quote/Author/Role/Avatar/Rating | [ ] placement/motion/visibility/attributes/CSS | [ ] semantics/source link/responsive/exclusions |
| Counter | [ ] values/format/duration/trigger/label | [ ] Root/Number/Prefix/Suffix/Label | [ ] animation/reduced motion/visibility/attributes/CSS | [ ] static fallback/format/dynamic/exclusions |
| Progress Bar | [ ] value/max/indeterminate/label | [ ] Track/Fill/Label/Value | [ ] reduced motion/visibility/ARIA/CSS | [ ] progress semantics/dynamic values/exclusions |
| Gallery | [ ] media/captions/order/link/lightbox | [ ] Root/Grid/Item/Media/Caption/Overlay | [ ] lazy/lightbox motion/visibility/attributes/CSS | [ ] alt/caption/load/keyboard/reorder/exclusions |
| Slider | [ ] slides/autoplay/loop/nav/swipe | [ ] Root/Track/Slide/Media/Caption/Arrows/Dots | [ ] transition/reduced motion/conditions/performance/CSS | [ ] pause/keyboard/ARIA/no-JS/exclusions |
| Carousel | [ ] items/count/scroll/loop/autoplay/nav | [ ] Root/Track/Item/Arrows/Dots | [ ] transition/reduced motion/conditions/performance/CSS | [ ] keyboard/snap/pause/no-JS/exclusions |
| Social Icons | [ ] networks/URLs/labels/order/target | [ ] Root/Item/Icon/Label | [ ] motion/conditions/attributes/CSS | [ ] accessible names/safe rel/link states/exclusions |
| Breadcrumbs | [ ] source/home/separator/current/schema | [ ] Root/Item/Link/Separator/Current | [ ] visibility/conditions/attributes/CSS | [ ] aria-current/schema/links/exclusions |
| Search | [ ] source/placeholder/button/results mode/text | [ ] Form/Input/Button/Icon/Results/Result/Empty/Loading | [ ] results placement/motion/performance/attributes/CSS | [ ] keyboard/live region/debounce/security/exclusions |
| Quote | [ ] quote/citation/source/mark | [ ] Root/Quote/Citation/Mark | [ ] placement/visibility/attributes/CSS | [ ] citation/link semantics/exclusions |
| Blockquote | [ ] rich quote/attribution/cite | [ ] Root/Quote/Citation | [ ] placement/visibility/attributes/CSS | [ ] sanitized content/cite semantics/exclusions |
| Pricing Table | [ ] plan/price/features/CTA/badge | [ ] all named pricing targets and CTA profile | [ ] motion/conditions/slots/permissions/CSS | [ ] repeater/featured/CTA states/exclusions |
| Icon Box | [ ] icon/title/description/link/heading | [ ] Root/Icon/Title/Description | [ ] motion/conditions/slots/attributes/CSS | [ ] nested-link prevention/focus/exclusions |
| Countdown Timer | [ ] end/timezone/mode/segments/expiry | [ ] Root/Segment/Value/Label/Separator/Expired | [ ] motion/live-region/conditions/attributes/CSS | [ ] timezone/expiry/reduced motion/a11y/exclusions |
| Team Member | [ ] photo/name/role/bio/social/schema | [ ] Root/Photo/Name/Role/Bio/Social/Icon | [ ] motion/conditions/slots/attributes/CSS | [ ] links/alt/schema/responsive/exclusions |
| Woo Product | [ ] source/parts/variations/quantity/cart | [ ] all registered product part targets | [ ] conditions/performance/attributes/permissions/CSS | [ ] simple/variable/dynamic/Woo versions/exclusions |
| Woo Product Grid | [ ] query/pagination/template/states | [ ] Grid/Item and product part targets | [ ] cache/conditions/attributes/permissions/CSS | [ ] query limits/empty/loading/parity/exclusions |
| Woo Cart | [ ] sections/coupon/shipping/empty behavior | [ ] all cart part targets | [ ] conditions/performance/attributes/permissions/CSS | [ ] Woo runtime/input/button/empty/exclusions |
| Woo Checkout | [ ] sections/notes/terms/submit/integrations | [ ] form/summary/payment/submit targets | [ ] conditions/performance/attributes/permissions/CSS | [ ] gateway safety/field states/Woo versions/exclusions |
| Loop / Repeater | [ ] source/query/item/empty/error/loading | [ ] Root/List/Item/Empty/Error/Loading | [ ] cache/conditions/attributes/permissions/CSS | [ ] bounds/context/pagination/no-data/exclusions |

## 25. Testing matrix

### 25.1 Registry, schema, and resolver

| Area | Required cases | Pass condition |
|---|---|---|
| Definition registration | unique/duplicate ID, alias collision, version, missing renderer, invalid parent/child | invalid definitions fail build with exact path |
| Capability grants | known/unknown group, target, state, control override, conflicting outputs | resolver cannot grant unregistered functionality |
| Panel resolution | every element × tab × target × parent layout × feature availability | snapshot matches sections 9-10 and exclusions |
| Schema v3 | valid documents, each invalid path/type/limit/reference/context/attribute/CSS | client and PHP agree; server error is path-specific |
| Canonicalization | empty/default pruning, key order, save-load-save | second canonical save is byte-identical |
| Extension namespace | valid third-party definition, conflicts, unavailable extension | safe registration or diagnostic fallback |

### 25.2 Controls and commands

Test every primitive and composite control with mouse, keyboard, touch where relevant, typing, scrub, range, canvas handle, unit changes, functions, token/preset binding, clear/reset, invalid input, Escape/cancel, undo/redo, copy/paste, duplicate, lock, and selection change mid-edit. Confirm all input methods update the same stored value and create one intentional history entry.

For every style group, test structured serialization, valid CSS support, source indicators, responsive/state eligibility, temporarily hidden dependent values, optional group add/remove, imported unknown values, and error messages. Test Flex↔Grid and Simple legacy values repeatedly to catch stale internal state.

### 25.3 Element matrix

Run every row in section 24. For each element:

1. Create from palette and by programmatic/import transform.
2. Verify Content groups and required defaults.
3. Inspect every style target and applicable group.
4. Assert every excluded control is absent.
5. Set, clear, reset, copy, paste, undo, redo, duplicate, save, reload, preview, publish.
6. Test all allowed states and breakpoints, including one breakpoint×state combination.
7. Test valid/invalid parent insertion and nested same-type instances.
8. Compare editor DOM/CSS and frontend DOM/CSS.
9. Run definition-specific accessibility and security assertions.
10. Migrate its legacy fixture and compare output.

### 25.4 Responsive and state

- Base only, Tablet only, Mobile only, Tablet+Mobile, clear Tablet with Mobile retained, clear Mobile, source indicator at every step.
- Default, every applicable state, state clear, breakpoint×state, state preview exit/cancel, runtime state unaffected by preview.
- Custom breakpoint manifest accepted but disabled UI; invalid/unknown breakpoint rejected.
- Visibility hide/show at each breakpoint with block/flex/grid/inline display values; visibility must always win without erasing display.
- Global/preset/token/local layering at each breakpoint/state.
- Hover de-emphasis on touch preview; focus-visible preserved; visited property restrictions.

### 25.5 Global styles, presets, and tokens

- Create/update/rename/duplicate/reorder/delete token, group preset, element preset, and global style.
- Shared edit versus local override/detach; affected counts; orphan reference handling.
- Stacked and nested presets, cycle rejection, incompatible target/group rejection.
- Default preset and local reset; breakpoint/state local override; copy/paste between compatible/incompatible definitions.
- Guided Role migration and shared edit parity.
- CSS variable/shared class deduplication and output-size comparison.

### 25.6 WordPress lifecycle

- New draft, save, autosave, recover autosave, preview, publish, update published, pending/private, reload.
- Revision creation/list/restore for v1/v2/v3 and post meta; restore older schema through adapter.
- Stale server version, two-tab concurrent edits, permission/capability denial, nonce/auth failure.
- REST malformed/oversized payload, timeout, failed CSS write, retry, rollback.
- Block theme, classic theme, builder template, singular preview, logged-in/out, multisite where supported.
- Sanitization/escaping for text, rich HTML, URLs, attributes, SVG, CSS, conditions, shortcodes, dynamic data, form input, and Woo data.

### 25.7 Migration

- Preview only never writes; apply writes atomically; cancel/no-op; double preview/apply.
- All A1 fixtures; ambiguous mapping; missing plugin/definition; unknown future schema/definition version.
- Old mapped/responsive/state/token/role/fallback/imported CSS; provenance and arbitrary display distinction.
- Source hash/stale conflict; compile/parity/validation failure; restore source revision.
- Mixed migrated/unmigrated component content and copied components.
- Batch/CLI dry-run when introduced, interruption/resume, machine-readable error codes.

### 25.8 CSS and parity

- Stable selectors before/after reorder/duplicate; unique stable IDs; nested target isolation.
- Base/breakpoint/state/intersection order; custom declaration order; legacy `!important`; theme specificity.
- Reset removes obsolete declarations/rules/assets; no empty media blocks.
- PHP/JS normalized compiler fixture equality.
- Visual screenshot regression for representative elements at Desktop/Tablet/Mobile, default/hover/focus-visible/active/disabled/expanded/selected.
- Imported stylesheet coexistence, custom CSS scope, invalid selector escape rejection.

### 25.9 Accessibility and interaction

- Full panel keyboard path, visible focus, logical tab order, screen-reader names/status/errors, 200%/400% zoom, high contrast, reduced motion.
- Heading order, image alt/decorative mode, link/button accessible names, form label/error association, media captions/transcript, landmarks, progress semantics.
- Accordion/Tabs/Menu/Slider/Carousel/Search keyboard and ARIA patterns; state preview does not corrupt ARIA.
- Contrast/focus diagnostics; deliberate override requires acknowledgement but remains possible where policy permits.

### 25.10 Performance and load

- 1,000 simple nodes; 150 deeply styled nodes; 50-depth tree; large Rich Text; 100-field Form; 100-slide/gallery item repeater; Woo grid; nested presets.
- Cold/warm load, selection, tab/target switch, search, filter, scrub, DnD, undo/redo, CSS compile, save/reload, memory after 30 minutes.
- Compare before/after bundle, CSS bytes/rules, save payload, React commits, long tasks, and heap growth.
- Fail the gate when budgets in section 21 regress without an approved measured exception.

## 26. Acceptance criteria

The overhaul is complete only when all conditions below are true:

1. Every element in section 9 has a registered definition or an explicitly scheduled later-release status; every migration-critical current element is registered in the first release.
2. Section 24 checklists pass for every shipped element with automated resolver/exclusion coverage.
3. Button, Heading, Image, Container, Form, Accordion, and Navigation each show a visibly different, complete, element-specific inspector.
4. `RightInspector` contains no tag-based universal field branches and consumes resolver output.
5. `STYLE_CONTROL_FIELDS` is not used to render v3 panels; the legacy catalog lives only in compatibility code.
6. Style and Advanced share no visual control groups. Content has no alignment or responsive visibility controls.
7. Every complex element exposes registered part targets; editor/frontend target selectors match.
8. All applicable states and breakpoint×state values are editable, sparse, resettable, and source-labeled.
9. Responsive visibility cannot be overridden by the element's display value and clearing visibility does not change layout mode.
10. v3 mapped declarations do not automatically use `!important`; specificity/theme compatibility tests pass.
11. Reordering an element does not rename its v3 selector or recompile unrelated element fragments.
12. Tokens, global styles, group presets, element presets, local values, breakpoint overrides, and state overrides follow section 14 precedence in JS and PHP.
13. Client validation and authoritative PHP validation reject the same invalid registry/schema cases.
14. Old pages render without opening migration; migration preview is read-only; apply is atomic, parity-checked, revisioned, and restorable.
15. Save, autosave, revision, preview, publish, reload, duplicate, copy/paste styles, undo/redo, Content Mode, permissions, importer, components, dynamic data, forms, and WooCommerce remain functional.
16. No high-severity security or accessibility issue remains; interaction components meet their keyboard/ARIA contracts.
17. Performance budgets in section 21 pass on the recorded reference environment; bundle/CSS regressions are explained and approved.
18. The production build and all relevant JS/PHP/browser suites pass; known lint-tooling issues are separated from new violations.
19. Dormant Forms/Woo/Widget panel code is integrated or removed; no fake/cosmetic control remains.
20. Documentation includes extension author guidance, registry schema, control catalog, target contract, context/cascade model, migration guide, and release notes.

## 27. Legacy cleanup plan

| Current implementation | Action | Replacement |
|---|---|---|
| `RightInspector` universal Title textarea | Remove | Definition-specific Text, Heading text, Button label, Caption, Item title, or no text control |
| Universal tag dropdown | Replace | Definition-constrained semantic tag/level in Content |
| Content Alignment | Relocate | Style → Text/Alignment on compatible targets |
| Content Visibility | Relocate and remodel | Advanced → Visibility, stored outside display styles |
| `STYLE_CONTROL_FIELDS` | Deprecate for legacy parsing, then remove | Typed catalog + configured shared groups |
| global `tier: simple/advanced` | Remove | primary/recommended/optional grants per target |
| Style `MappedStyleControls` | Replace | resolver-driven shared group controls |
| Advanced `MappedStyleControls` | Remove | no duplicate; Advanced group registry |
| empty `searchQuery` plumbing | Replace | real tab/target-aware search index |
| five mixed taxonomy groups | Replace | taxonomy/order in sections 5-6 |
| separate responsive color control | Merge | every eligible control uses the same context engine |
| design token/role managers at top of Style | Relocate | dedicated managers; field-level source pickers |
| raw CSS fallback as routine input | Restrict/migrate | structured controls plus target-scoped Developer custom declarations |
| root-only `states` | Migrate | target context keys with state applicability |
| root-only responsive overrides | Migrate | target sparse breakpoint contexts |
| no responsive×state | Add | sparse intersection context keys |
| traversal `.ctb-block-N` selectors | Retain only for legacy, then stop emitting | stable block-ID class and registered part selectors |
| mapped `!important` everywhere | Retain in legacy compiler only | ordered v3 cascade; visibility utility exception |
| `blockTypeFor` coarse classification | Retain renderer family, add definition inference | stable `element` ID and definition version |
| hardcoded primitive factories | Replace | definition defaults/factory |
| hardcoded LeftRail groups | Replace | registry-derived palette/category/search |
| dormant `FormsPanel` | Integrate then delete | Form-family Content/Style/Advanced definitions |
| dormant `WooCommercePanel` | Integrate then delete | Commerce definitions plus separate product-data workflow |
| dormant `WidgetLibraryPanel` | Convert/integrate then delete | composites/reusable templates registered through one library |
| animation/actions inside generic Advanced body | Integrate | configured Motion/Interaction groups with persistence/runtime contracts |
| page diagnostics/parity/a11y inside element Advanced | Relocate | page-level diagnostics drawer; element-linked issue badges |
| Navigator dock only under Advanced | Relocate | persistent/collapsible structure panel independent of element tab |

Deprecated compatibility helpers must be isolated under `src/legacy/` and `includes/legacy/`, covered by fixtures, instrumented with read-only usage counts, and removed only after the stated support window.

## 28. Risks and edge cases

| Risk/edge case | Mitigation |
|---|---|
| Registry grows to hundreds of elements | lazy element packages, generated PHP manifest, families/profiles, resolver validation, searchable palette |
| Boolean capabilities become another generic system | require target/fields/states/responsive/output configuration; reject bare grants |
| Target selectors break when markup changes | version render contracts and definition migrators; DOM snapshot tests; stable `data-ctb-part` |
| Responsive × state creates a value explosion | sparse contexts, intersection UI on demand, prune empties, indicators/source popover |
| Optional groups hide important migrated values | any modified group is forced visible with a legacy/source badge |
| Removing `!important` changes old pages | only v3 uses new cascade; migration parity preview; retain legacy compiler/rules |
| Theme CSS overrides builder unexpectedly | controlled specificity, page-template boundary, theme fixtures, debug cascade manifest; avoid blanket force |
| Custom CSS escapes scope | parser-enforced `&`/registered target selectors, reject page/global escape, server validation |
| Imported arbitrary HTML has no definition | tag matchers where safe; Legacy HTML Node fallback with attributes/CSS and migration diagnostics |
| Third-party extension missing | preserve namespaced props/style; render safe fallback or stored HTML; surface missing-extension notice |
| Composite repeated items create huge CSS | shared targets by default; per-item overrides opt-in and counted |
| Deleting a part loses its styles | keep/remove choice; orphaned-part diagnostic; stable item IDs |
| Copy/paste across different elements | compatibility by target profile/group, preview skipped mappings, never position-by-index |
| Multiple preset sources conflict | explicit ordered stack, source inspector, cycle detection, affected counts |
| Conditions mistaken for security | UI warning and docs; server authorization remains separate; sensitive data never rendered merely hidden |
| Focus style removal harms keyboard access | default focus-visible baseline, diagnostics/error, validated alternative |
| Visited state leaks privacy-sensitive properties | visited control allowlist and compiler enforcement |
| Autoplay/motion harms users | muted requirement, pause controls, reduced-motion alternatives, warnings/errors |
| Form/Woo runtime markup changes | versioned adapter contracts and supported-version tests; avoid arbitrary internal selectors |
| Migration is too slow for large documents | pure linear traversal, progress report, time/memory budget, later resumable CLI batches |
| Autosave/revision crosses registry versions | registry version stored; adapter/migrator bundled; unknown future version becomes read-only |
| Dirty worktree/generated cache pollution | implementation commits exclude `node_modules/.cache`; preserve unrelated changes and use scoped diffs |

## 29. Stress-test findings and revisions

### 29.1 Critique: the requested library is larger than the current renderer contract

The repository has six visible palette primitives, two hidden factories, broad import support, specialized Form/Woo types, and eight dormant widget templates. Shipping all 58 first-class definitions in one change would create a long-lived partial system and high regression risk. **Revision:** build the complete registry/schema/compiler for the full taxonomy, but release element families in dependency order. Do not expose an element until its Content, targets, states, validation, PHP renderer, migration, and tests all pass.

### 29.2 Critique: Divi-style composability can recreate “everything everywhere”

Allowing every target to enable every group would reproduce the user's primary complaint under a cleaner UI. **Revision:** optional composable groups must still be explicitly granted by the element definition and target profile. Spacer can never add Typography; Image caption can.

### 29.3 Critique: three tabs can still become long panels

Even relevant controls can overwhelm a complex Form or Navigation element. **Revision:** target-first styling, primary/recommended/optional groups, search/filters, modified counts, and lazy mounting are mandatory. A global Simple/Advanced switch is removed because the Advanced tab and element-specific progressive disclosure already provide a clearer model.

### 29.4 Critique: moving all visual effects to Style is not always safe

Transforms and animations are visual, but they also change hit testing, containing blocks, layout perception, and reduced-motion behavior. **Revision:** ordinary filters/opacity remain Style; transforms/transitions/animations move to Advanced Motion. Position/sticky/z-index/overflow move to Advanced Placement. Container flex/grid remains Style because it is the container's primary visual layout.

### 29.5 Critique: a normalized v3 style schema can lose arbitrary imported CSS

The importer supports CSS beyond the planned control catalog. **Revision:** migration is lossless-first. Safe unsupported declarations remain scoped custom/legacy declarations with provenance and an “unmapped” badge. Structured conversion occurs only when round-trip equivalence is proven.

### 29.6 Critique: stable ID classes may expose unwieldy/user-controlled IDs

Block IDs can be long and imported. **Revision:** derive a collision-checked sanitized/hash class from the immutable block ID; retain the exact ID only in data/debug mappings. Duplication generates a new stable block ID and class.

### 29.7 Critique: global sources can become impossible to debug

Tokens, roles, global styles, group presets, element presets, locals, breakpoints, and states create many layers. **Revision:** source metadata and Style Inspector-like diagnostics are not optional polish. Every effective value must explain its source, and shared edits must state affected count.

### 29.8 Critique: desktop-first inheritance may not be the ideal greenfield model

A mobile-first compiler is attractive, but switching now would risk every existing page and imported media query. **Revision:** preserve desktop-first inheritance through the migration era. The breakpoint registry keeps future direction/versioning possible, but mixing directions in one document is prohibited.

### 29.9 Critique: JavaScript and PHP compilers can drift

Two implementations are necessary for preview/frontend but create parity risk. **Revision:** define serializable compiler fixtures and normalized semantic snapshots before shipping v3. Neither compiler may add a feature without the same fixture and counterpart implementation.

### 29.10 Critique: the Advanced tab could become a new dumping ground

Placement, motion, visibility, conditions, attributes, performance, permissions, and developer controls are still numerous. **Revision:** each is a registered system group with element-specific grants and page-level tools remain outside the element inspector. Diagnostics/SEO/Navigator are not Advanced groups.

### 29.11 Critique: conditions and permissions are easy to misrepresent

The prior verification found cosmetic inactive surfaces. **Revision:** no Advanced group is exposed until persistence and frontend/server enforcement exist. Conditions are labeled display logic; permissions are server-enforced editing rules; neither substitutes for application authorization.

### 29.12 Critique: control completeness can damage performance

Mounting full media, gradient, repeater, query, and code editors for each selection would exceed the current already-large bundle. **Revision:** resolver output is data, active-tab/group lazy mounting is required, heavy controls are code-split, store selectors are narrow, and performance budgets are release gates.

## 30. Revised final architecture

The final architecture after stress testing is:

```text
Element registry
  ├─ identity + definition version
  ├─ semantic props + parent/child policy
  ├─ Content groups
  ├─ registered style targets
  │    └─ configured shared group grants
  ├─ configured Advanced system grants
  ├─ insertion/import/migration matchers
  └─ preview/PHP render contract

Inspector resolver
  ├─ selected element + parent/document context
  ├─ target + breakpoint + state + source context
  ├─ strict Content / Style / Advanced tabs
  ├─ search + modified/inherited/variable/error filters
  └─ primary/recommended/optional progressive disclosure

Document v3
  ├─ semantic props and validated attributes
  ├─ target → sparse context → style set
  ├─ advanced placement/motion/visibility/conditions/accessibility/performance
  ├─ tokens + global styles + group presets + element presets
  └─ registry/migration metadata

Shared runtime
  ├─ one command/history path
  ├─ one source/cascade resolver
  ├─ one responsive/state context model
  ├─ stable target marker contract
  ├─ equivalent JS/PHP CSS compilers
  └─ v1/v2 adapter + explicit atomic migration
```

This structure scales to hundreds of elements because adding an element primarily means registering semantics, targets, configured grants, render contract, migrator, and fixtures. It does not require adding a new inspector branch, CSS pipeline, responsive engine, state tabs, or custom attribute system.

## 31. Recommended implementation order

| Order | Work | Depends on | Exit gate |
|---:|---|---|---|
| 1 | A1 fixtures/baseline | none | complete current inventory and passing baseline |
| 2 | A2 contracts | A1 | approved identity/context/cascade/migration ADR |
| 3 | A3 extraction | A2 | no behavior change and full regression pass |
| 4 | B1 control catalog | A3 | validators/mappers cover current properties and target groups |
| 5 | B2 registry/resolver | B1 | derived palette/panel snapshots and valid fallback |
| 6 | B3 PHP manifest | B2 | client/server registry parity |
| 7 | B4 schema v3 | B3 | v3 round trip plus v1/v2 regression |
| 8 | B5 adapter/migrators | B4 | lossless reports and parity fixtures |
| 9 | C1 target markers | B2/B4 | editor/frontend target DOM parity |
| 10 | C2 context/source resolver | B4/B5 | complete precedence/reset matrix |
| 11 | C3 JS/PHP compilers | C1/C2 | normalized cross-language parity, stable selectors |
| 12 | C4 responsive/state commands | C2/C3 | sparse context UI/undo/preview pass |
| 13 | D1 inspector shell | B2/C4 | strict tab contract and accessibility pass |
| 14 | D2 shared groups | B1/D1 | structured control round trips |
| 15 | D3 targets/progressive disclosure | C1/D2 | no irrelevant/enabled group failures |
| 16 | E1 core elements | D1-D3 | Button/Heading/Image/Container plus current primitive parity |
| 17 | F1 Advanced systems core | E1/C3 | real placement/visibility/attributes/motion persistence |
| 18 | E2 layout family | E1/F1 | flex/grid/DnD/responsive structure pass |
| 19 | E3 text/utilities | E1 | semantic/sanitization/exclusion pass |
| 20 | E5 Forms | E1/F1 | server submission and target/state pass |
| 21 | E4 media/navigation | E3/F1 | media/nav/search accessibility/runtime pass |
| 22 | E6 composites | E3/E4/F1 | repeater/state/no-JS/reduced-motion pass |
| 23 | E7 WooCommerce | E5/E6 | supported Woo versions and parity pass |
| 24 | F2 globals/presets | stable core target profiles | precedence/source/deduplication pass |
| 25 | G1 migration UI/REST | migration-critical definitions and compilers | atomic apply/rollback/revision pass |
| 26 | G2 cleanup | registry replacements complete | one system per concern; no dormant/fake panels |
| 27 | G3 full gates | all shipped elements | sections 25-26 fully pass |

Do not begin later element families before the registry, schema, target, context, and compiler foundations pass. Do not expose migration Apply before every current palette/specialized element has a lossless definition or a documented Legacy Element fallback. Do not remove the legacy compiler until the support window and usage audit permit it.

## Primary research sources

- [Divi 5 Visual Builder Interface](https://help.elegantthemes.com/en/articles/12991185-divi-5-visual-builder-interface)
- [Divi 5 Interface, Part 2](https://help.elegantthemes.com/en/articles/15501608-part-2-exploring-every-aspect-of-the-divi-5-interface)
- [Divi 5 Composable Settings](https://help.elegantthemes.com/en/articles/14332889-composable-settings-in-divi-5)
- [Divi 5 Responsive Editor](https://help.elegantthemes.com/en/articles/13002269-responsive-editor-in-divi-5-visual-builder)
- [Divi 5 Presets](https://help.elegantthemes.com/en/articles/15530394-part-4-mastering-divi-5-presets-for-faster-more-consistent-web-design)
- [Divi 5 Custom Attributes](https://help.elegantthemes.com/en/articles/12274853-custom-attributes-in-divi-5)
- [Divi 5 Developer: Module Attributes](https://dev.elegantthemes.com/docs/tutorials/module/beginner/module-attributes/)
- [Divi 5 Developer: Settings Metadata](https://dev.elegantthemes.com/docs/explanations/module/module-metadata/attributes/settings/)
- [Elementor Editor Controls](https://developers.elementor.com/docs/editor-controls/index.html)
- [Elementor Responsive Editing](https://elementor.com/help/responsive-editing/)
- [Bricks Adding & Editing Elements](https://academy.bricksbuilder.io/builder/interface/editing-elements/)
- [Bricks Element Conditions](https://academy.bricksbuilder.io/builder/features/element-conditions/)
- [Breakdance Responsive Design](https://breakdance.com/documentation/builder/basics/responsive-design-preview/)
- [Breakdance Global Styles](https://breakdance.com/documentation/design/global-settings/global-styles-overview/)
- [WordPress Block Supports](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-supports/)
- [WordPress Global Settings & Styles](https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/)
- [Webflow Style Panel](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview)
- [Webflow States](https://help.webflow.com/hc/en-us/articles/33961301727251-States)
- [WordPress Escaping Data](https://developer.wordpress.org/apis/security/escaping/)
- [WordPress Block Deprecation](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-deprecation/)
