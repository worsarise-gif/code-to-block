# Upgrade Implementation Plan 4 — Content Slots (Props for Blocks)

**Purpose**: This file implements the "content slots" idea we designed
together — a way to mark specific pieces of a block's content (text,
image, link) as client-specific data, separate from the structural
design around it. This is the foundation for three things you asked
for at once: safe client handoff (business owners can edit content
without breaking layout), fast duplication (build once, adapt per
client quickly), and genuinely reusable templates (structure stays
fixed, only labeled slots differ per client).

**The mental model, worth keeping in mind while building this**: this is
functionally the same idea as props in React — a component's structure
is fixed, but the specific values passed into it differ each time it's
used. A slot is a prop. A saved reusable component that accepts filled-
in slot values is a React component that accepts props. Naming it this
way in code comments and schema documentation is worth doing
deliberately — it makes the system instantly familiar to any developer
who already knows React.

**Design decision already made, don't re-litigate**: Option B — slots
are a flag/metadata added directly onto existing block types (text,
image, button), not a new wrapper block type. This avoids adding
nesting depth, which we already know is a real, measured performance
cost from the earlier performance upgrade work. No new block type,
just new fields on blocks that already exist in the tree.

**Explicitly scoped for this file**: single-value slots only (one text
value, one image, one link per slot). Repeatable/list-type slots
(a variable-count service list, a testimonial grid where the number of
items differs per client) are a genuinely harder sub-case and are
deliberately deferred — do not attempt them as part of this file.

---

## Step 1 — Add slot fields to the schema

```
I want to extend our block schema to support content slots - marking
specific blocks as client-editable content, separate from structural
design.

Add these fields to any text, image, or button/link block type:
- is_content_slot: boolean (default false)
- slot_label: string (human-readable label shown to whoever fills in
  content later, e.g. "Hero Headline", "Phone Number", "CTA Button Text")
- slot_content_type: "text" | "rich_text" | "image" | "link" (should
  match the block's own type - a text block gets "text" or "rich_text",
  an image block gets "image", a button gets "link")

This does not change how any existing block renders or behaves by
default (is_content_slot defaults to false). Update block-schema.md
with this addition, and add a corresponding decisions-log.md entry
documenting this as an extension of the schema, not a breaking change -
confirm existing saved pages (from Phases 0-6 testing) still load and
render correctly after this change.
```

## Checkpoint for Step 1
Confirm two things: existing test fixtures from earlier phases still
work unchanged (this is an additive schema change, not a breaking one),
and the new fields are present and correctly typed when you manually
inspect a block's JSON. If anything from earlier phases breaks, stop
and fix before continuing - this schema needs to stay backward
compatible.

---

## Step 2 — Mark slots visually in the editor

```
In the editor, add a way to mark a selected text, image, or button
block as a content slot: a toggle in the block's settings panel that
sets is_content_slot to true, with a field to set slot_label.

When a block is marked as a slot, show a small, clear visual indicator
on the canvas (a subtle badge or outline) so it's obvious at a glance
which blocks are slots versus structural content, while editing
normally in the full editor.

Test this on the pricing card example from Phase 0: mark the price
text and the button text as slots with appropriate labels, confirm the
visual indicator appears correctly on both.
```

## Checkpoint for Step 2
Actually look at the canvas yourself after marking two blocks as slots
- can you tell, at a glance, which blocks are slots without opening
their settings panel? If the indicator is too subtle to notice or too
intrusive and cluttering the canvas, that's worth iterating on before
moving forward - this is a real usability detail, not a minor styling
choice, since it's what makes the eventual client-mode view trustworthy.

---

## Step 3 — Build a simplified "content-only" editing view

This is the actual payoff for client handoff — a view that shows ONLY
slots, hides all structural editing entirely, so a business owner
literally cannot break the layout.

```
Build a second, simplified view of the editor - call it "content mode"
- that can be reached from a distinct URL/route (not the full builder
environment from the earlier dedicated-editor upgrade).

In content mode:
1. Scan the page's block tree for any block with is_content_slot: true
2. Show ONLY those blocks, presented as a simple form: each slot's
   slot_label as a form field label, an appropriate input (text field,
   rich text box, image upload, URL field) matching slot_content_type
3. No canvas, no drag-and-drop, no structural controls, no style panel
   - none of the full editor's capabilities should be reachable from
   this view at all
4. Saving in content mode should only update the slot values in the
   block tree - structural blocks and their styling must be completely
   untouched

Test this on the pricing card with the two slots we marked in Step 2:
open content mode, confirm you see a simple form with "Price" and
"Button Text" fields (or whatever labels were set), edit both values,
save, then open the full editor and confirm the canvas reflects the
new content with the layout completely unchanged.
```

## Checkpoint for Step 3
This is the real test of the whole feature: edit content in content
mode, then check the full editor - did ANYTHING structural change? If
a business owner using this view could accidentally alter layout,
styling, or block structure in any way, that's not done yet. This view
needs to be genuinely incapable of breaking the page, not just
unlikely to.

---

## Step 4 — Duplication using slots

```
Now build a "duplicate this page" action. When triggered:
1. Copy the entire block tree structure as-is (same layout, same
   styling, same everything structural)
2. Present the new duplicate's slots as an empty or placeholder-filled
   form (same shape as content mode from Step 3), prompting for new
   values for each labeled slot before finalizing the duplicate
3. Save the duplicate as a new, separate page - the original page must
   remain completely unchanged

Test this using the pricing card page: duplicate it, fill in different
values for the two slots (a different price, different button text),
confirm two separate pages now exist, each with correct independent
slot content, and confirm the original page's content is unchanged.
```

## Checkpoint for Step 4
Confirm genuinely independent pages exist after duplication - editing
the new duplicate's slot content afterward should have zero effect on
the original page, and vice versa. This is the concrete "build once,
adapt for the next similar client fast" workflow you asked for -
actually go through the motion of duplicating and re-filling slots
yourself, the same way Phase 6 had you build a real page by hand.

---

## What this unlocks, now that it's built

- **Templates (deferred to a future file)**: once slots exist, a
  template is simply a structure with slots pre-labeled but empty -
  building an actual starter template library becomes straightforward
  on top of this foundation, rather than something to design from
  scratch
- **Reusable components + slots together**: a saved reusable component
  (from the first upgrade file) that also has labeled slots becomes a
  genuine "props-accepting component" in the full React-analogy sense -
  worth revisiting the reusable-components feature once this file is
  done, to confirm slots work correctly inside saved components too,
  not just on a page directly

## What's explicitly NOT in this file

- Repeatable/list-type slots (variable-count items like a service list
  or testimonial grid) - a real, harder follow-up, not attempted here
- A full template library matched to the ~300 business types discussed
  - that's downstream of this file being done, not part of it
- Role-based permission enforcement on who can access content mode
  versus the full editor (e.g. restricting business owners to content
  mode only, at the WordPress user-role level) - worth a small, focused
  follow-up once this file's core mechanism is proven, not bundled in
  now
