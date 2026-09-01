# Upgrade Implementation Plan 18 — Reduce Manual Input: Draggable Controls, Dropdowns, and Drag-and-Drop Usability

**Purpose**: Three related but distinct usability fixes, all aimed at
the same target audience named directly: developers who are "not too
techy" and primarily work by drag and drop. First, replace manual
number-typing for spacing/sizing with draggable, scrubbable controls -
matching a real, proven pattern from Divi, but fixing a specific,
documented bug in their implementation. Second, replace free-text
inputs with dropdowns wherever the actual option set is finite. Third,
a separate, honest diagnosis of general drag-and-drop friction, since
that's a different problem from numeric input tedium and shouldn't be
solved by the same fix.

---

## Part 1 — Draggable/scrubbable numeric controls (matches and improves on Divi's real pattern)

### What Divi actually does, confirmed directly from their own documentation

"Instead of having to open a settings panel and type in sizing values
manually, you can instead drag to adjust the elements right on the
page and see the results instantly... simply hover over any inside
edge and then drag the anchor to increase or decrease the padding of
that side." This is a real, established, years-old pattern - not
speculative. Divi's own spacing documentation confirms both modes
coexist: "Input a numeral value or drag the range slider" - so the
numeric field is never removed, dragging is an alternative path to the
same value, not a replacement for precision input.

### The specific bug to fix, found directly in Divi's own user feedback

"Once you go into the module setting you cannot set the margin,
padding… with the draggable option but changing the settings by
numbers as before" - meaning Divi's drag-on-canvas control and its
settings-panel numeric control can DISAGREE or behave inconsistently
depending on which one you used last. This is exactly the kind of
"two ways to do the same thing that don't stay in sync" problem this
whole build has deliberately avoided in every other system (schema,
state, tokens). Do not repeat it here.

### Step 1 — Add scrubbable/draggable adjustment to numeric controls

```
For every numeric control in our control panel (spacing, sizing,
border-radius, and other pixel/unit-based values from Files 9-10),
add a draggable "scrub" interaction: clicking and dragging
horizontally on the number itself increases/decreases the value,
with sensible sensitivity (e.g. 1px per few pixels of mouse movement,
adjustable/finer with a modifier key held, similar to the
professional-tool pattern of fine vs. coarse control).

Critically, this must write to the EXACT SAME underlying value as the
numeric input field - there must be only ONE stored value per
property, with drag-scrub and manual typing as two input METHODS for
that one value, never two separate storage paths. This directly avoids
the specific disagreement bug found in Divi's own user reports.

Test by: setting a padding value via drag-scrub, then opening the
same control's manual number entry and confirming it shows the exact
value just set via dragging (not a stale or different number) - then
reverse the test, typing a value manually and confirming a subsequent
drag starts adjustment from that typed value, not from a leftover
drag-state value.
```

## Checkpoint for Step 1
This bidirectional consistency test is the most important check in
this file - if drag-set and typed values can ever disagree or one can
overwrite the other unexpectedly, this is not done, regardless of how
smooth the dragging feels in isolation.

### Step 2 — Add canvas-level drag-to-adjust for spacing (matching Divi's on-page anchor pattern)

```
In addition to the scrub interaction on the number itself (Step 1),
add Divi's canvas-level pattern: hovering a selected block's edge on
the CANVAS itself reveals a draggable anchor, and dragging it directly
adjusts that side's padding/margin - visually, in place, without
needing to open the control panel at all first.

This is a SECOND way to reach the SAME underlying value as Step 1 and
the manual input field - three total input methods (canvas drag,
panel scrub, manual type) all writing to one value. Test the same
three-way consistency check as Step 1: adjust via canvas anchor drag,
confirm the panel's numeric field and scrub control both reflect the
new value immediately.
```

## Checkpoint for Step 2
Three-way consistency (canvas drag, panel scrub, manual type) must
hold - test all three pairwise combinations, not just one.

### Step 3 — Scroll-wheel adjustment (secondary enhancement, not the primary fix)

```
As an additional, secondary enhancement (not a replacement for Steps
1-2): allow scrolling the mouse wheel while hovering a focused numeric
field to increment/decrement its value. Note this is a genuinely
useful but less established pattern - even Figma, a highly polished
design tool, has this as a long-standing user feature REQUEST rather
than a shipped default, so treat this as a nice addition, not the
headline fix for this file.

Ensure this writes to the same single underlying value as Steps 1-2,
same consistency requirement.
```

## Checkpoint for Step 3
Same value-consistency check as before. This step can be deprioritized
if time-constrained, since Steps 1-2 are the proven, higher-value
pattern.

---

## Part 2 — Dropdowns replacing free-text where the option set is finite

### Step 4 — Audit and convert finite-option fields to dropdowns

```
Audit our full control inventory (from File 9's taxonomy) for any
field currently requiring free-text typing where the actual valid
options are a known, finite set - for example: font-family (should be
a dropdown of available/loaded fonts, not free text), border-style
(solid/dashed/dotted/none - a fixed set), position type
(static/relative/absolute/fixed/sticky, from File 9's positioning
controls), text-align, and any other property with enum-like valid
values rather than open-ended input.

For each one converted, confirm the dropdown's option list exactly
matches what our CSS resolver/renderer actually supports - a dropdown
offering an option our system can't correctly render would be worse
than free text, since it implies false confidence in an unsupported
value.

Show me the full list of fields converted, and for each, confirm
against our existing control taxonomy that no valid, supported value
was left out of the dropdown's options.
```

## Checkpoint for Step 4
Cross-check every dropdown's option list against what File 9 already
established our system actually supports - an incomplete dropdown
would silently prevent a user from setting a value our system can
otherwise handle correctly.

---

## Part 3 — Drag-and-drop usability diagnosis (a separate problem from numeric input)

**Important distinction**: dragging BLOCKS around the canvas (moving
a button, nesting a container) is a different interaction from
dragging NUMBERS to adjust values (Part 1). Reported difficulty with
"the drag and drop feature" needs to be diagnosed specifically, not
assumed to be fixed by Part 1's work.

### Step 5 — Diagnose the specific friction point

```
File 11 already verified our drag system against deep-nesting
reliability (does it land in the right place, does it avoid the
jQuery-UI-style bugs found in Elementor's tracker). This step is
different: it's about FEEL and DISCOVERABILITY for a non-technical
user, not correctness.

Specifically test and report on: is it visually clear BEFORE dragging
starts which elements are draggable (a distinct cursor, a drag handle
icon, hover affordance)? Is the valid-drop-zone highlighting (verified
correct in File 11) also visually OBVIOUS enough for a non-technical
user, or only technically correct but subtle? Is there a minimum drag
distance/hold time that might feel unresponsive if not tuned well for
someone unfamiliar with drag interactions generally?

Report specifically which of these (or something else) is the actual
source of difficulty, based on direct testing - don't assume the
answer, find it.
```

## Checkpoint for Step 5
This step should produce a SPECIFIC diagnosis (e.g. "drop zones are
technically correct per File 11 but the highlight color has too little
contrast to notice quickly" or "there's no visual cue that a block is
draggable until you're already mid-drag") - not a vague "it's a bit
hard," since the fix depends entirely on which specific thing is
actually causing friction.

### Step 6 — Fix the diagnosed friction point(s)

```
Based on Step 5's specific findings, implement the fix - likely
candidates: add a visible drag-handle icon on hover (so it's clear
what's draggable before starting), increase contrast/visual weight of
valid drop-zone highlighting from File 11's already-correct logic, or
add a brief onboarding tooltip on first use demonstrating the
interaction.

Test with the same scenario diagnosed as difficult in Step 5, and
confirm the specific friction point is resolved - re-test the exact
scenario, not a different, easier one.
```

## Checkpoint for Step 6
Re-run whatever specific scenario Step 5 identified as difficult, and
confirm it's genuinely improved - this file should end with a
concrete before/after on the actual diagnosed problem, not just "we
made some general drag improvements."

---

## What determines this file is complete

Part 1: three-way value consistency (canvas drag, panel scrub/scroll,
manual type) verified across multiple control types. Part 2: full
audit completed with every dropdown's options cross-checked against
actual system support. Part 3: a specific friction point diagnosed and
demonstrably fixed, not a vague general pass.

## Note for decisions-log.md

Record the single-source-of-truth requirement for numeric values
(canvas drag, panel control, and manual type all writing to one value,
never separate storage) as a standing rule - this is the direct,
permanent fix for the exact disagreement bug found in Divi's own real
user feedback, and it's worth protecting the same way other "don't
build parallel systems" rules have been protected in earlier files.
