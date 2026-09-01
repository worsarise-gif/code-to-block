# Upgrade Implementation Plan 4 — Guided Typography and Spacing Choices

**Purpose**: Build a semantic, context-aware choice layer that lets non-technical users select typography and spacing with confidence instead of guessing raw numbers. The implementation must present a small set of recommended visual roles, bundle the underlying responsive values, support bounded relative adjustments, and keep exact numeric editing available only as a deliberate advanced action. This file does not duplicate the builder's existing full control coverage, Simple/Advanced visibility system, token/preset infrastructure, or drag/scrub input mechanics; it extends those systems specifically to replace routine raw-value entry with confidence-building choices.

## Non-Negotiable Build Rules

1. **Extend the existing token and preset system; do not create a parallel styling engine or a second source of truth.** Every semantic role must resolve to existing token references and flow through the current style-resolution, serialization, undo/redo, responsive, state, and rendering pipelines.
2. **Simple mode must never present “Custom” or raw numeric input as a peer to semantic choices.** Raw font size, line height, letter spacing, margin, padding, and gap values remain editable only in Advanced mode.
3. **Show no more than three context-relevant choices at one time.** One choice must be marked Recommended and must include an explainable reason. Do not use “7 plus or minus 2” as justification for a larger menu.
4. **Keep HTML semantics and visual appearance independent.** Selecting a visual role must never silently change an H1-H6 tag, paragraph tag, button element, ARIA role, or document hierarchy.
5. **The first exact-value edit on a role-bound property must require an explicit decision:** update the role everywhere or create a local override. Never silently detach an element from its role.
6. **Preview with the user's actual content, font, container width, and breakpoint.** Generic “Aa” samples are not sufficient for the primary preview.
7. **Simple-mode dragging must remain guided.** Reuse the existing drag/scrub controller, but quantize role-bound changes to approved semantic variants instead of producing arbitrary numeric values.
8. **Do not silently restyle existing documents.** Legacy values and existing presets must remain visually unchanged unless they can be mapped without ambiguity or the user explicitly chooses to adopt a role.
9. **Recommendations may change when context changes, but an already selected role must not be replaced automatically.** Recommendations are advisory; styling changes require an explicit user action.
10. **All labels, explanations, warning messages, and accessible names must use the project's existing localization system.**

## Step 1 — Add the Semantic Role Data Model and Existing-System Adapters

Create a semantic-role module beside the existing token, preset, and control registries. Use the repository's current language, naming, state-management, command, and serialization conventions; the names below describe required responsibilities rather than mandatory file paths.

Implement these logical types:

```ts
type StyleRoleKind = 'typography' | 'spacing';
type RelativeStep = -1 | 0 | 1;

type TypographyAdjustment = {
  size: RelativeStep;
  density: RelativeStep;
};

type SpacingAdjustment = {
  distance: RelativeStep;
};

type PropertyOverride = {
  property: string;
  value: ExistingControlValue;
  breakpoint?: ExistingBreakpointId;
  state?: ExistingStateId;
};

type StyleRoleBinding = {
  roleId: string;
  kind: StyleRoleKind;
  typographyAdjustment?: TypographyAdjustment;
  spacingAdjustment?: SpacingAdjustment;
  overrides: PropertyOverride[];
  source: 'built-in' | 'user' | 'imported' | 'legacy';
};

type StyleRoleRecipe = {
  id: string;
  kind: StyleRoleKind;
  labelKey: string;
  descriptionKey: string;
  propertyTokenRefs: Record<string, ExistingTokenReference>;
  variants: {
    minus?: Record<string, ExistingTokenReference>;
    default: Record<string, ExistingTokenReference>;
    plus?: Record<string, ExistingTokenReference>;
  };
  supportedContexts: string[];
  builtIn: boolean;
  version: number;
};

type RoleRecommendation = {
  roleId: string;
  rank: 1 | 2 | 3;
  recommended: boolean;
  reasonCode: string;
  reasonTextKey: string;
  fitStatus?: 'safe' | 'warning' | 'unsafe';
};
```

Add adapters that let the role layer:

- Read and write the existing token registry.
- Resolve a role recipe through the existing responsive and state-aware style resolver.
- Store `StyleRoleBinding` on the same element/style model that currently stores preset and control values.
- Apply changes through the current command/transaction system so role selection, global role updates, local overrides, reset, copy/paste, and undo/redo are first-class editor operations.
- Reuse the existing centralized Simple/Advanced conditional-visibility system.
- Reuse the existing panel-field and canvas-drag synchronization path rather than adding a second input path.
- Expose a single computed-style function such as `resolveRoleBoundProperty(elementId, property, breakpoint, state)` that applies values in this order: local property override, selected role variant, role default recipe, existing inheritance, then builder default.

Do not persist recommendation text, scores, or transient preview state in the document. Persist only the role binding, relative modifiers, property-level overrides, and any user-edited role recipe/token data.

Verify this step by creating a unit-test fixture with one element bound to `type.body`, a `size: 1` adjustment, and a local mobile line-height override. The resolver must return the role's larger size token, the role's normal desktop line height, and the local mobile line height, while undoing the override command must restore the role-derived mobile value.

## Checkpoint for Step 1

Inspect the serialized fixture and the computed-style test output. The document must contain one role binding and one property-level override, not copied raw values for every role property, and the existing undo/redo stack must reverse and restore the override without losing the role binding.

## Step 2 — Seed an Idempotent “Balanced” Baseline Role Library

Add a built-in baseline library that exists automatically on every new site. Seed it through the existing token API and preset initialization path; do not hardcode resolved CSS directly in modules. The seed operation must be idempotent: reopening a site, importing a page, or rerunning initialization must not create duplicate tokens or roles.

Use existing global heading-font and body-font tokens when they are available. If the site has no equivalent tokens, create namespaced built-in tokens. If the existing token engine supports `clamp()`, use the values below. If it stores breakpoint values instead, convert each clamp to equivalent mobile, tablet, and desktop values without changing the role interface.

Create these built-in typography roles:

| Role ID | Visible name | Font source | Weight | Responsive size | Line height | Letter spacing |
|---|---|---|---:|---|---:|---:|
| `type.page-title` | Page title | Existing heading font token | 700 | `clamp(2.5rem, 1.75rem + 3.75vw, 5rem)` | `1.05` | `-0.03em` |
| `type.section-heading` | Section heading | Existing heading font token | 700 | `clamp(2rem, 1.6rem + 2vw, 3.25rem)` | `1.10` | `-0.02em` |
| `type.card-heading` | Card heading | Existing heading font token | 600 | `clamp(1.25rem, 1.15rem + 0.5vw, 1.75rem)` | `1.20` | `-0.01em` |
| `type.intro` | Intro text | Existing body font token | 400 | `clamp(1.125rem, 1.05rem + 0.375vw, 1.375rem)` | `1.55` | `0` |
| `type.body` | Body text | Existing body font token | 400 | `clamp(1rem, 0.96rem + 0.2vw, 1.125rem)` | `1.60` | `0` |
| `type.supporting` | Supporting text | Existing body font token | 400 | `clamp(0.875rem, 0.84rem + 0.15vw, 1rem)` | `1.50` | `0` |
| `type.action` | Button or action text | Existing body font token | 600 | `1rem` | `1.20` | `0.01em` |
| `type.label` | Label or metadata | Existing body font token | 600 | `0.875rem` | `1.30` | `0.04em` |

Create role-specific `minus`, `default`, and `plus` variants. The minus and plus variants must use neighboring approved size or spacing tokens, not arithmetic that creates an arbitrary one-off value. For typography density, create role-specific tighter/default/looser line-height tokens; do not globally subtract a fixed number from every role.

Create this built-in spacing scale through the current number-token system:

| Token ID | Default value |
|---|---:|
| `space.2xs` | `0.25rem` |
| `space.xs` | `0.5rem` |
| `space.sm` | `0.75rem` |
| `space.md` | `1rem` |
| `space.lg` | `1.5rem` |
| `space.xl` | `2rem` |
| `space.2xl` | `clamp(2.5rem, 2rem + 2vw, 4rem)` |
| `space.3xl` | `clamp(4rem, 3rem + 4vw, 7rem)` |

Create these spacing recipes, all backed by the scale above:

- `space.cluster`: icon/label or tightly related inline items; default `space.xs`.
- `space.related-group`: fields, list items, or related blocks; default `space.md`.
- `space.separate-group`: distinct content groups; default `space.lg`.
- `space.card-compact`: compact component padding; default `space.md`.
- `space.card-standard`: normal component padding; default `space.lg`.
- `space.card-feature`: prominent component padding; default `space.xl`.
- `space.section-standard`: normal section block padding; default `space.2xl`.
- `space.section-generous`: spacious section block padding; default `space.3xl`.
- `space.hero`: hero/feature block padding; default `space.3xl`, with a role-specific responsive recipe rather than a copied raw value.

If a site already has semantically equivalent tokens, create aliases or references instead of duplicate values. Never overwrite a user-modified token during initialization.

Verify this step by opening a fresh document twice. The role and token counts must be identical after both initializations. Bind two headings to `type.section-heading`, edit the role's size token once in the token manager, and confirm both headings update without local values being written to either element.

## Checkpoint for Step 2

In a fresh site's design data, confirm there is exactly one built-in entry for each listed role and token. Change one backing token and inspect two bound elements; both must render the new value while their serialized element data still contains only the role binding.

## Step 3 — Implement the Deterministic Context Resolver

Build a deterministic resolver that returns one Recommended role and no more than two alternatives for the currently selected element and control. Do not use a generative model for this first implementation. The same input document state must produce the same recommendation order and reason code.

The resolver input must include, when available:

- Element/module type.
- HTML/text element type.
- Parent container type.
- Whether the element is inside a repeated item, grid, card, list, navigation, hero, section, or form.
- Whether it is the first prominent heading in the page or container.
- Container width and current breakpoint.
- Text length, measured line count, and whether the content is short metadata, a normal paragraph, or long-form copy.
- Nearby selected roles and heading hierarchy.
- The exact spacing property being edited: gap, margin, padding, axis, side, or linked sides.

Implement at least these typography rules, in descending priority:

1. Button or button-like action text: recommend `type.action`; allow `type.label` as an alternative only when the component is visually a compact control.
2. Text explicitly identified as metadata, eyebrow text, form label, badge, or short navigation label: recommend `type.label`; allow `type.supporting` and `type.action` when context permits.
3. Heading inside a repeated card, tile, product, feature item, testimonial, or list item: recommend `type.card-heading`; allow `type.section-heading` only for wide feature cards and `type.supporting` only for compact metadata-like titles.
4. First prominent heading inside a hero or page-intro container: recommend `type.page-title`; allow `type.section-heading` and `type.card-heading` only when container width or text length makes them plausible.
5. Heading beginning a normal section: recommend `type.section-heading`; allow `type.page-title` for a page-intro context and `type.card-heading` for a narrow container.
6. Short paragraph directly beneath a page title or section heading and under the configured intro-length threshold: recommend `type.intro`; allow `type.body` and `type.supporting`.
7. Normal paragraph or rich-text body content: recommend `type.body`; allow `type.intro` for short lead text and `type.supporting` for secondary information.
8. Caption, helper text, byline, timestamp, disclaimer, or secondary note: recommend `type.supporting`; allow `type.label` and `type.body` when context permits.

Implement at least these spacing-context rules:

1. Gap between inline icon and label: recommend `space.cluster`.
2. Gap between fields, list rows, or closely related stacked items: recommend `space.related-group`.
3. Gap or margin between distinct content groups inside a component: recommend `space.separate-group`.
4. Padding inside compact controls or dense cards: recommend `space.card-compact`.
5. Padding inside a normal card or content panel: recommend `space.card-standard`.
6. Padding inside a featured card, callout, or promotional panel: recommend `space.card-feature`.
7. Vertical padding on a normal section: recommend `space.section-standard`.
8. Vertical padding on a spacious editorial section: recommend `space.section-generous`.
9. Padding on a hero or page-intro container: recommend `space.hero`.

Each recommendation must return a localized reason code, for example:

- `first_heading_in_hero`
- `heading_inside_repeated_card`
- `short_lead_below_title`
- `normal_reading_paragraph`
- `inline_icon_label_gap`
- `padding_inside_standard_card`

A reason shown to the user must be specific, such as “Recommended because this is the first heading in a full-width hero,” not “Recommended by the system.”

Do not automatically change a role when the resolver output changes. If a card is moved into a hero, update the recommendation badge and explanation, but preserve its current selected role until the user chooses another role.

Verify this step with table-driven tests covering at least 20 contexts. Include these required fixtures: a hero H1, an H3 in one of four repeated cards, a paragraph beneath a hero title, body copy in an article, icon-and-label gap, card padding, and section vertical padding. Every fixture must return a stable ordered list with one Recommended result and no more than three total results.

## Checkpoint for Step 3

Run the context-resolver test table twice and compare serialized outputs. The order, reason codes, and Recommended item must match exactly. Inspect the repeated-card fixture and confirm `type.card-heading` is first, while the normal-section fixture returns `type.section-heading` first.

## Step 4 — Build the Typography Visual-Role Picker in Simple Mode

Replace routine numeric typography editing in Simple mode with a `TypographyRolePicker` that reads candidates from the context resolver. This component must use the existing panel component library, focus system, localization, command dispatch, and conditional visibility infrastructure.

For a selected text element, render:

- The current HTML level or element type in its existing independent control.
- A “Visual role” control containing one Recommended card and up to two alternatives.
- Each card's semantic name, one-sentence use description, and preview using the selected element's actual text and active font.
- A concise recommendation reason directly under the Recommended card.
- A badge showing that the role is responsive and globally linked; do not show editable raw values in Simple mode.
- The current role even when it is no longer one of the three resolver candidates. In that case, show it in a compact “Current role” row above the recommended choices so the user can keep or replace it without silent changes.

Do not include a `Custom`, `Exact`, `Manual`, or raw-value card. Do not place an Advanced-mode link inside the role-card row. The existing panel-level Simple/Advanced switch is the only normal route to exact controls.

Selecting a card must:

1. Create or update the element's `StyleRoleBinding`.
2. Reset role-relative modifiers to default unless the user is switching between compatible variants and the existing modifier remains valid.
3. Preserve unrelated state, responsive values, and interactions.
4. Apply through one undoable editor command.
5. Announce the new role through the existing accessibility live-region mechanism.

Support keyboard navigation with Tab, arrow keys, Space, and Enter. Hover and keyboard focus may preview a role, but must not mutate the document or add undo history. Escape must cancel the preview.

Use the existing Simple/Advanced visibility system to hide the editable font size, line height, and letter spacing fields for role-bound elements in Simple mode. Font family and weight may remain visible only if the current product specification already treats them as primary brand choices; when they remain visible, changing them must follow the same global-role-versus-local-override decision implemented in Step 8.

Verify this step by adding a heading inside a normal section. In Simple mode, the panel must show Section heading as Recommended plus no more than two alternatives, use the real heading text in each preview, show no editable font-size/line-height/letter-spacing fields, and create exactly one undo item when Card heading is selected.

## Checkpoint for Step 4

Use keyboard-only input to focus the typography cards, preview an alternative, cancel with Escape, and then select it with Enter. Confirm the canceled preview leaves no document or history change, while the committed selection changes the role, adds one undo entry, and leaves the HTML tag unchanged.

## Step 5 — Build Contextual Spacing Pickers in Simple Mode

Extend the existing spacing control rather than creating a separate spacing panel. Add a `SpacingRolePicker` that changes its labels and candidate recipes according to the property and relationship being edited.

Handle these control shapes explicitly:

- **Gap controls:** show Same cluster, Related items, and Separate groups when those options are relevant.
- **Linked card/component padding:** show Compact card, Standard card, and Feature card.
- **Linked section block padding:** show Standard section, Generous section, and Hero spacing.
- **Horizontal/vertical paired padding:** show separate semantic selectors for Horizontal and Vertical, each capped at three choices.
- **Linked margins between siblings:** show relationship-based choices derived from the resolver.
- **Fully unlinked top/right/bottom/left exact values:** keep these in Advanced mode only. Simple mode may offer “Use linked semantic spacing” to rejoin a role, but must not expose four arbitrary fields.

When the selected spacing property is role-bound, show an on-canvas overlay that highlights exactly which gap, margin, padding edge, or axis will change. Reuse the current canvas measurement and selection overlay system. The overlay must disappear on blur, Escape, or panel close.

Selecting a spacing role must store the role binding at the narrowest supported scope. For example, changing a card's padding must not overwrite an unrelated gap role on the same element, and changing vertical section spacing must not overwrite a separately selected horizontal padding role.

Do not label the primary options XS, S, M, L, XL, or show raw pixel/rem values in Simple mode. Those token names remain available in the advanced design-system manager.

Verify this step with a card that has linked padding. Simple mode must recommend Standard card, highlight all four padding edges on canvas, and present no per-side numeric fields. Changing to Compact card must update the card through one undoable command without changing its internal gap role.

## Checkpoint for Step 5

Inspect the serialized card after selecting Compact card. The padding binding and internal gap binding must be separate entries, the raw padding values must not be copied into the card, and undo must revert only the padding role selection.

## Step 6 — Add Bounded Relative Adjustments and Guided Dragging

Add a second-stage adjustment control after the user selects a semantic role. The user must be able to make a limited perceptual correction without inventing a number.

For typography roles, expose:

- `Smaller`, `Default`, `Larger` mapped to `size: -1 | 0 | 1`.
- `Tighter`, `Default`, `Looser` mapped to `density: -1 | 0 | 1`.

For spacing roles, expose:

- `Closer`, `Default`, `Farther` mapped to `distance: -1 | 0 | 1`.

Each position must resolve to a named, approved neighboring token defined by the role recipe. Do not calculate a freeform value from the current number. If a role does not support a minus or plus variant, disable that choice and provide a localized explanation.

Extend the existing drag/scrub input controller as follows:

- In Simple mode, dragging a role-bound typography or spacing control moves through the same three semantic detents. The tooltip must show the semantic state, such as `Closer`, `Default`, or `Farther`, not `17px`.
- During the drag, render a transient preview using the current preview transaction.
- On pointer release, commit one semantic modifier command.
- Do not write an arbitrary raw number, even when the pointer moves many pixels.
- In Advanced mode, preserve the current precise drag/scrub behavior, but route the first committed exact change through the global-role/local-override decision in Step 8.
- Keep the existing panel/canvas synchronization fix intact by using the same shared value source and commit path for both interfaces.

Verify this step by binding a card to Standard card spacing, entering Simple mode, and dragging its padding handle by an arbitrary amount such as 17 screen pixels. The UI must land on one of the three semantic states, store only `distance: -1`, `0`, or `1`, show the same state in the panel, and never serialize a 17-pixel local value.

## Checkpoint for Step 6

After the guided drag, inspect the element data and the synchronized panel control. Both must report the same semantic modifier, and no new number token or raw element-level spacing value may exist. Undo must restore the previous semantic detent in one action.

## Step 7 — Implement Actual-Content Preview Transactions and Breakpoint Fit Evaluation

Build a reusable preview transaction that can apply a candidate role or relative variant to the selected element without mutating saved document state or adding undo history. Reuse the existing style renderer whenever possible; do not create a separate preview-only CSS implementation that could disagree with final rendering.

The preview must use:

- The selected element's real text/content.
- The active font family and available font weight.
- The element's actual parent container and width.
- Existing responsive values and inherited styles.
- Desktop, tablet, and mobile builder breakpoints.
- Current interaction state when the control supports states.

Provide these preview behaviors:

1. Hover or keyboard focus on a role card temporarily previews it on canvas.
2. A compact desktop/tablet/mobile toggle on the card or preview area lets the user inspect each breakpoint without changing the editor's saved breakpoint state.
3. Escape, blur, panel close, selection change, or pointer cancellation restores the committed style immediately.
4. Clicking or pressing Enter commits the exact previewed role through one command.
5. Rapidly moving across cards cancels stale preview work; only the latest candidate may remain applied.

Add a fit evaluator that measures the rendered candidate at all supported breakpoints and returns structured results for:

- Horizontal overflow.
- Clipping caused by fixed height or overflow rules.
- Heading line count.
- Severe single-word overflow.
- A candidate becoming visually larger than an immediately higher-level heading.

Use these initial warning thresholds, stored as configurable constants rather than scattered literals:

- Page title: warn above 2 lines on desktop/tablet or 3 lines on mobile.
- Section heading: warn above 3 lines on any breakpoint.
- Card heading: warn above 3 lines in a repeated card.
- Any text: unsafe on clipping or horizontal overflow.

The fit evaluator may demote an otherwise valid recommendation or mark it with a warning, but it must not silently rewrite the element. The recommendation reason may include a fit explanation such as “Fits in two lines on mobile.”

Verify this step with a long section heading in a narrow column. Hovering Page title must preview the actual long text, show a warning at the affected breakpoint, and restore the current style on Escape. Committing Section heading must create one undo entry and render exactly the same result that was previewed.

## Checkpoint for Step 7

Record the computed bounding box and line count during preview and after commit. They must match. Confirm the preview generated no document mutation or undo item, while the committed selection generated exactly one command.

## Step 8 — Gate Exact Editing Behind Advanced Mode and an Explicit Global-or-Local Decision

Keep all precise font-size, line-height, letter-spacing, margin, padding, and gap controls in the existing Advanced mode. The role name and binding status must remain visible at the top of the Advanced section so the user understands where the current values originate.

Intercept the first committed exact edit to any role-derived property, whether it comes from:

- A settings-panel numeric field.
- A scrubber.
- A canvas drag handle.
- A keyboard increment.
- A responsive breakpoint field.
- A state-specific field.

Do not interrupt an in-progress scrub or drag. Allow a transient preview during movement, then present the decision only when the user commits by pointer release, Enter, or blur.

Present exactly these primary actions:

1. **Update “[Role name]” everywhere** — update the role recipe or its dedicated backing token so all elements bound to that role receive the change.
2. **Create a local override for this element** — store a property-level override only for the selected element, breakpoint, and state.

Include Cancel, which restores the pre-edit value. Do not include a “Custom” card in Simple mode and do not silently choose an action.

When “Update role everywhere” is selected:

- If the backing token is dedicated to that role property, update it.
- If the token is shared with another role, create a role-specific token copied from the current token, repoint only this role property to it, then apply the new value. This guarantees that “everywhere” means every use of the selected role, not every unrelated role sharing a low-level token.
- Apply the change through one global command and show the number of affected elements before confirmation when that count is available cheaply.

When “Create a local override” is selected:

- Store only the edited property, breakpoint, and state in `StyleRoleBinding.overrides`.
- Keep all unedited properties bound to the role.
- Show a `Local override` status chip beside the role.
- Provide `Rejoin [Role name]` for the current property and `Remove all local overrides` for the element.
- Do not convert the entire recipe into copied raw values.

Allow expert users to configure Advanced mode as their default panel mode through the existing preference system, but do not bypass the global-or-local decision for role-bound properties.

Verify this step with two elements bound to Section heading. Edit the desktop font size of one element in Advanced mode. Choosing Update Section heading everywhere must update both elements and leave both without local overrides. Undo, repeat the edit, and choose Create a local override; only the selected element must change, its role binding must remain, and Rejoin Section heading must remove the override and restore the shared value.

## Checkpoint for Step 8

Inspect both elements after each branch of the decision. The global branch must change the shared role recipe and affect both elements; the local branch must create one property-level override on only one element. Cancel must leave no value, token, binding, or history change.

## Step 9 — Keep HTML Semantics Separate From Visual Roles

Retain the existing HTML tag or semantic element control as an independent setting. Refactor any code path that currently couples a heading's tag to its visual style so the two values can change independently.

Required behavior:

- Changing `H2` to `H3` must not change the selected visual role.
- Changing Section heading to Page title must not change `H2` to `H1`.
- Copy/paste, duplication, templates, and import/export must preserve both values independently.
- The accessibility tree and rendered markup must use the HTML/semantic control, not the visual role name.

Add non-blocking diagnostics for unusual combinations, for example:

- Page title visual role on a deeply nested heading.
- Card heading visual role on the only top-level page heading.
- Multiple H1 elements when the existing diagnostics system already treats that as a warning.

Warnings must describe the mismatch without claiming that a visual role determines SEO. Provide direct actions such as “Change visual role” or “Review HTML level,” but do not auto-correct either value.

Verify this step with an H4 inside a card. Select Page title as its visual role. The text must adopt the Page title recipe while the DOM remains an H4, the serialized HTML level remains unchanged, and a non-blocking unusual-pairing warning appears.

## Checkpoint for Step 9

Inspect the rendered DOM, serialized element data, and warning panel for the H4 fixture. The tag and visual role must be stored separately, and dismissing the warning must not change either value.

## Step 10 — Add Non-Blocking Style Guardrails and One-Click Recovery

Build a rule-based diagnostics layer that consumes the resolved styles, fit-evaluator output, role bindings, repeated-component context, and local overrides. Integrate it with the existing warning/notice UI rather than creating modal interruptions for routine issues.

Implement these initial diagnostics:

1. **Overflow or clipping:** any candidate or committed style clips text or overflows its container at a supported breakpoint.
2. **Excessive heading wrapping:** line count exceeds the Step 7 thresholds.
3. **Hierarchy inversion:** body, supporting, or card text is visually larger than the nearby section/page heading after all overrides are applied.
4. **Repeated-component inconsistency:** equivalent repeated cards contain multiple nearly identical local spacing or typography overrides instead of one shared role.
5. **Role mismatch:** an element's selected role is strongly inconsistent with its structural context.
6. **Detached styling:** one or more local overrides make a role-bound element materially different from the role while the user may still assume it is globally linked.
7. **Unavailable font weight:** a role requests a weight the active font does not provide and the browser would synthesize.

Each diagnostic must include:

- Severity: info, warning, or unsafe.
- The affected breakpoint/property when applicable.
- A plain-language explanation.
- One recommended action.
- A one-click fix when the fix is deterministic.
- A Dismiss action for non-unsafe warnings.

Examples of deterministic fixes:

- Use the next smaller approved role variant.
- Rejoin the selected role.
- Normalize repeated cards to the most common role.
- Switch from Page title to Section heading.

Never auto-apply a fix merely because a warning exists. Fixes must be undoable commands.

Verify this step with four repeated cards where one card has a 25px local padding override and the others use Standard card. The diagnostics layer must identify the inconsistent card, recommend Rejoin Standard card, and remove only that override when the user applies the fix.

## Checkpoint for Step 10

Apply the repeated-card fix and inspect all four cards. They must share the same role-derived padding, the corrected card must retain unrelated styles, and one undo action must restore the local override and warning.

## Step 11 — Extend the Existing Design-System Manager With Role Management and Override Audit

Add a “Guided roles” area to the existing token/preset/design-system manager. This must be an extension of the current manager and data store, not a new administration screen with duplicated state.

For each typography and spacing role, show:

- Semantic name and description.
- Backing token references.
- Responsive preview.
- Number of bound elements.
- Number of elements with local overrides.
- Whether the role is built-in or user-modified.

Provide these actions:

- Edit the role recipe globally using existing advanced controls.
- Restore a built-in role to its Balanced defaults after explicit confirmation.
- View all elements using the role.
- View all local overrides associated with the role.
- Rejoin selected overrides to the role.
- Export and import role definitions through the existing design-system export/import mechanism.

Built-in role IDs must remain stable even when labels or values are edited. Do not allow deletion of a built-in role while elements are bound to it. If the current design-system manager supports duplication, allow an advanced user to duplicate a role into a user-defined role; otherwise leave custom-role creation for a future file rather than implementing an isolated partial workflow.

When editing a role globally, display a preview and affected-element count before commit. The edit must update all non-overridden properties while preserving property-level local overrides.

Verify this step by binding three paragraphs to Body text, adding a local line-height override to one, and changing the Body text size in the manager. All three paragraphs must receive the new size, while only the overridden paragraph keeps its custom line height. The manager must report three uses and one overridden element.

## Checkpoint for Step 11

Compare the usage and override counts with the document fixture, then inspect all three paragraphs after the global edit. The counts must be exact, the global property must update everywhere, and the local property override must remain scoped to one element.

## Step 12 — Normalize Parsed AI/Mockup Imports Into Semantic Roles

Extend the existing import pipeline after it has parsed elements and style declarations. This step does not build image recognition, OCR, screenshot interpretation, or a new AI generator; it normalizes already parsed typography and spacing values into the semantic role system.

Add a `normalizeImportedStyles(importedDocument, targetDesignSystem)` stage with these rules:

### Typography mapping

1. Build candidate roles from the imported element's semantic type and structural context.
2. Compare the imported font size, weight, line height, and letter spacing to each candidate's resolved values at the same reference width.
3. Score candidates using weighted normalized distance, with font size and structural context weighted more heavily than letter spacing.
4. Map to the nearest role when the score is within a configurable acceptance threshold.
5. Preserve a deliberate difference as a property-level local override when it exceeds the threshold, and add an import-review flag rather than creating a new token automatically.
6. Group repeated elements before mapping so nearly identical card headings share one role instead of producing separate local values.

### Spacing mapping

1. Identify whether the value represents inline gap, grouped content, component padding, section spacing, or another known context.
2. Snap to the nearest approved spacing recipe when the difference is within `max(4px, 15%)` at the reference width.
3. For repeated components, calculate the median imported value and normalize the group to one role when all members fall within 20% of the median.
4. Preserve values outside the threshold as local overrides and add a review flag.

### Review output

After import, show a compact review summary such as:

- `12 elements mapped to existing roles`
- `4 repeated card paddings normalized to Standard card`
- `2 deliberate differences kept as local overrides`

For each retained override, offer:

- `Use site role — Recommended`
- `Keep imported difference`

Do not create a new role or token for every imported number.

Verify this step with an import fixture containing one 63px hero heading, four card headings between 23px and 25px, four card paddings between 23px and 26px, and one intentionally oversized promotional heading. The importer must map the hero to Page title, normalize all card headings to Card heading, normalize all card paddings to Standard card, and retain only the promotional difference as a flagged local override.

## Checkpoint for Step 12

Inspect the normalized fixture's serialized output. The repeated elements must reference shared role IDs, no duplicate per-element tokens may be created, and exactly one flagged local override must remain for the promotional heading.

## Step 13 — Add Persistence, Backward Compatibility, and Conservative Migration

Increment the document/design-system schema version and add migration support for role bindings without changing the visual output of existing documents.

Migration rules:

1. Existing elements with current token or preset links keep those links.
2. Existing raw values remain legacy local styling by default.
3. Automatically map a legacy style to a built-in role only when all relevant properties match a role exactly after normalizing units and responsive values, or when the existing preset already contains explicit semantic-role metadata.
4. Do not use a “close enough” migration for existing saved pages; approximate snapping is allowed only in the explicit import-normalization flow from Step 12.
5. Mark untouched legacy raw styles as `source: 'legacy'` only when needed for the UI; do not rewrite every old element merely to add metadata.
6. New elements created after the feature is enabled receive the resolver's recommended default role through the existing element-default mechanism.
7. Copy, paste, duplicate, reusable blocks, templates, global elements, page export/import, and site export/import must preserve role IDs, modifiers, overrides, and user-modified recipes.
8. If a pasted element references a missing user-defined role, preserve its computed appearance as local values and show a missing-role warning; do not substitute an unrelated built-in role silently.
9. Every role operation must participate in autosave, undo/redo, revision history, and collaborative conflict handling if those systems exist.

Add migration fixtures for documents created before the role feature, documents using existing presets, documents with responsive raw values, and documents using global tokens.

Verify this step by opening a pre-upgrade fixture with custom responsive typography and spacing. Its rendered screenshots and computed styles must remain unchanged. Add a new heading to the same document and confirm the new element receives a recommended role without modifying any legacy element.

## Checkpoint for Step 13

Run the before/after visual and computed-style comparison on every migration fixture. Existing elements must have zero unintended differences, while newly created elements must serialize a role binding and remain fully undoable.

## Step 14 — Add the Release Gate, End-to-End Tests, and Privacy-Safe Instrumentation

Place the feature behind the project's existing feature-flag or staged-rollout mechanism. If the project has no feature-flag system, add one configuration switch scoped only to this upgrade rather than introducing a general platform.

Add end-to-end tests for these required scenarios:

1. A fresh hero heading shows Page title as Recommended and no raw typography fields in Simple mode.
2. A normal section heading shows Section heading as Recommended.
3. A repeated-card heading shows Card heading as Recommended.
4. A normal paragraph shows Body text as Recommended.
5. A standard card shows contextual padding choices and no four-side numeric fields in Simple mode.
6. Guided dragging stores a semantic detent and remains synchronized with the panel.
7. Hover/focus preview uses real content, cancels cleanly, and creates no history entry.
8. Advanced exact editing presents the global-or-local decision.
9. Global role editing updates all bound elements while preserving property overrides.
10. Rejoin removes a local override and restores the role value.
11. Visual-role changes do not change HTML tags.
12. Long text produces the correct breakpoint warning.
13. Import normalization produces shared roles and only justified overrides.
14. Legacy documents render without unintended changes.
15. Copy/paste, undo/redo, responsive editing, and state editing preserve binding behavior.
16. All role cards, relative controls, dialogs, warnings, and manager actions are operable by keyboard and expose correct accessible names and states.

If the product already has analytics, add privacy-safe events without sending user content, raw text, font names, numeric style values, or document identifiers. Use events such as:

- `guided_role_recommendation_shown`
- `guided_role_selected`
- `guided_relative_adjustment_used`
- `guided_advanced_exact_edit_started`
- `guided_global_role_updated`
- `guided_local_override_created`
- `guided_override_rejoined`
- `guided_import_normalized`

Include only role ID, context category, breakpoint category, and action result. Do not add analytics as a new dependency when the product has no telemetry system; in that case, rely on local test instrumentation and leave production analytics disabled.

Set the release gate so the feature cannot be enabled by default until all required unit, integration, migration, accessibility, and end-to-end tests pass. After the gate passes, enable it for new documents first; existing documents may expose the controls without auto-migrating their current styles.

Verify this step by running the full automated suite with the feature flag both off and on. With the flag off, existing behavior and snapshots must remain unchanged. With the flag on, all 16 required scenarios must pass, and any configured analytics test sink must receive only the allowed metadata.

## Checkpoint for Step 14

Review the continuous-integration report, migration visual diffs, accessibility results, and telemetry payload fixtures. There must be no failing required scenario, no user content or raw style values in event payloads, and no behavioral change when the feature flag is off.

## What determines this file is complete

This implementation is complete when a fresh site automatically has a token-backed semantic typography and spacing system; Simple mode presents one explained recommendation and no more than two relevant alternatives; actual-content previews and guided relative adjustments let users refine results without entering numbers; Simple-mode dragging stores only approved semantic variants; exact editing is available only in Advanced mode and always requires an explicit global-role or local-override decision; HTML semantics remain independent; diagnostics and one-click recovery work; the existing design-system manager can edit and audit roles; parsed imports normalize repeated values into shared roles; legacy documents remain visually unchanged; and all required unit, integration, migration, accessibility, and end-to-end tests pass through the existing editor, renderer, serialization, synchronization, and undo/redo systems.

## What this file does NOT include

- It does not add missing control types or expand the existing control taxonomy.
- It does not replace or redesign the existing Simple/Advanced panel system.
- It does not replace the existing drag/scrub mechanics or the existing panel/canvas desynchronization fix; it adds semantic detents and commit rules on top of them.
- It does not create a new token, preset, responsive, state, style-resolution, command, or persistence engine.
- It does not build screenshot recognition, OCR, image-to-layout parsing, or an external-AI design generator; it only normalizes styles after an existing importer has produced structured elements and values.
- It does not provide a marketplace of preset packs, a theme browser, or a large collection of aesthetic style systems beyond the built-in Balanced baseline.
- It does not implement a complete SEO analyzer or accessibility auditor; it only preserves semantic independence and adds targeted warnings required by this role system.
- It does not automatically restyle existing pages or approximately snap legacy values to new roles.
- It does not require custom-role creation if the current design-system manager cannot already support duplication cleanly; that can be a separate upgrade after the built-in role workflow is stable.
- It does not conduct the external usability study itself. It provides the build, release controls, and instrumentation needed to test whether non-technical users complete typography and spacing decisions with fewer raw edits, fewer one-off values, and greater confidence.
