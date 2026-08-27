# Upgrade Implementation Plan 11 — Right-Click Context Menu + Drag/Nesting Reliability

**Purpose**: Two related developer-experience upgrades. First, a
zone-based right-click context menu, modeled on Elementor's real,
documented mechanics (different menus depending on what's clicked).
Second, a stress-test and reliability pass on our drag/nesting system,
directly targeting a repeated failure pattern found across seven
separate real Elementor GitHub issues — including one that traces back
to a 12-year-old unfixed jQuery UI bug Elementor's drag system still
depends on.

**Why these two are in one file**: both concern the same surface — how
a developer directly manipulates blocks on the canvas. A right-click
menu is a faster way to trigger actions; reliable drag is the
foundation those actions (and ordinary dragging) depend on. Fixing the
menu without confirming the underlying drag system is solid would be
building a nicer entrance to a room with a weak floor.

---

## Part 1 — Zone-based right-click context menu

### The real mechanics, confirmed directly from Elementor's own documentation

Context menus are not one universal menu — they change based on
exactly where the right-click happens: widget corner, container tab,
column, empty canvas area each surface a different, relevant set of
actions. This zone-based model is what makes the menu fast rather than
cluttered — a developer never sees irrelevant actions for what they
clicked.

### Step 1 — Define zones and their action sets

```
Define the right-click zones for our editor, modeled on Elementor's
real approach:

1. WIDGET zone (right-click on a leaf block - text, image, button):
   actions should include Edit, Duplicate, Copy, Paste, Delete, Copy
   Styles, Paste Styles, Save as Reusable Component (using our
   existing reusable-components system).

2. CONTAINER zone (right-click on a container/structural block):
   actions should include Edit, Duplicate, Copy, Paste, Delete, Add
   Inner Container, Convert Layout Mode (Flexbox/Grid, using our
   control panel from the earlier control-panel upgrade file), Save
   as Reusable Component.

3. EMPTY CANVAS zone (right-click on empty space, not on any block):
   actions should include Paste (if something is in our internal
   clipboard), Add Block, Page Settings.

4. SLOT zone (right-click on a block marked as a content slot, from
   our content-slots system): actions should include everything from
   the WIDGET zone, plus a clearly distinct "Edit Slot Label" action,
   since slots have this extra property regular blocks don't.

Each zone's menu should be visually and functionally distinct - a
developer right-clicking a widget should never see container-only
actions like "Convert Layout Mode," and vice versa. Show me each of
the four zone menus rendered on a real test page containing at least
one of each zone type.
```

## Checkpoint for Step 1
Right-click each zone type yourself on a real test page and confirm
each shows only its relevant action set - no bleed-through of actions
that don't apply to what was actually clicked.

### Step 2 — Wire actions to existing systems, don't reimplement them

```
Every action in these menus should call our EXISTING functionality,
not new parallel implementations:
- Duplicate should use the same duplication logic already built for
  pages/components, applied at the block level
- Save as Reusable Component should call our existing reusable-
  components system directly
- Copy Styles / Paste Styles should read/write the same styles.mapped
  object our control panel already operates on

Confirm this by testing "Copy Styles" on one block, "Paste Styles" on
a different block, and checking that the pasted block's style panel
now shows values identical to the source - proving the menu action
and the control panel are operating on the same underlying data, not
two disconnected systems.
```

## Checkpoint for Step 2
This is the most important checkpoint in Part 1 - confirm no action in
this menu duplicates logic that already exists elsewhere in the
codebase. A right-click menu with its own separate "duplicate" logic
that subtly behaves differently from the existing duplicate button
would be a maintenance liability and a source of exactly the kind of
inconsistent-behavior bugs found in research.

### Step 3 — Keyboard/accessibility path to the same actions (connects to the accessibility upgrade file)

```
Since right-click is inherently mouse-only, ensure every action
available in these context menus is ALSO reachable via keyboard - for
example, a dedicated keyboard shortcut (Shift+F10 or a similar
standard pattern) that opens the same context-appropriate menu for
the currently keyboard-focused block, consistent with the keyboard-
accessibility work already required in the accessibility upgrade file.

Test by navigating to a block using only Tab/Arrow keys, opening its
context menu via keyboard shortcut, and confirming the same zone-
appropriate actions are available and selectable without a mouse.
```

## Checkpoint for Step 3
This connects directly to the accessibility file's keyboard-navigation
requirements - confirm a keyboard-only user has genuinely equal access
to every context-menu action, not a degraded mouse-only feature.

---

## Part 2 — Drag and nesting reliability (the deeper, more important fix)

### What research actually revealed — a repeated pattern across seven real, confirmed reports

Reading across multiple Elementor GitHub issues together (not
isolated incidents): drop-zones highlighting the wrong nested target,
grid-layout dragging described as "very difficult" and tagged as a
confirmed bug against their own newer Container element, complete
drag failure that survived a full plugin reinstall, a separate broken
drag surface in the navigator/structure panel, and third-party widgets
breaking drag site-wide. Most tellingly: one of the underlying
mechanisms this traces back to is a **12-year-old, still-open bug in
jQuery UI itself** (`jquery/jquery/issues/3032`), about nested droppable
zones not highlighting correctly when a sibling drag interaction
changes state - suggesting Elementor's drag system, built years ago
on that library, inherited a foundational bug it has never since
escaped.

**The genuinely good news**: our drag system was built on `dnd-kit`
(Phase 3), a modern, purpose-built library, not jQuery UI - so we did
not inherit this specific foundational bug by construction. But "we
didn't inherit their bug" is not the same as "we've proven deep
nesting never breaks" - that needs actual verification, not assumption,
which is what this part of the file does.

### Step 4 — Deep-nesting drag stress test

```
Using the same deeply-nested test page built for our performance
stress test (150+ blocks, 8+ levels of nesting, from the performance
upgrade file), specifically test drag-and-drop reliability, not just
speed this time:

1. Drag a deeply nested block (6+ levels deep) to a sibling position
   at the same depth - confirm the correct drop-zone highlights, and
   the block lands exactly where indicated, matching the exact failure
   pattern found in research where Elementor highlighted the wrong
   nested target
2. Drag a block from deep nesting up to a much shallower position (and
   the reverse - shallow to deep) - confirm correct behavior in both
   directions
3. Drag two different blocks in quick succession without fully
   releasing focus between them - confirm no leftover state from the
   first drag affects the second, directly testing against the jQuery
   UI bug pattern found in research where a second, unrelated drag
   corrupted the first draggable's state
4. Test the same three scenarios using our structure/outline panel
   (if one exists, matching Elementor's Navigator) in addition to
   direct canvas dragging, since research shows this can be an
   independently broken surface even when canvas dragging works fine

Report honestly if any of these four scenarios shows incorrect
highlighting, incorrect placement, or leftover state - this is a
verification pass, not an assumption that dnd-kit is automatically
immune to all forms of this problem.
```

## Checkpoint for Step 4
This is the most important checkpoint in this entire file. If any
scenario fails, do not consider Part 2 done regardless of how well
Part 1's context menu works - reliable nesting and dragging is the
foundation the context menu's Duplicate/Copy/Paste actions and all
ordinary editing depend on.

### Step 5 — Extend the parity-check system to catch drag-induced structural corruption

```
Extend our existing editor/frontend parity-check system (from the
first upgrade file, already extended for commerce blocks and schema
drift) to also verify that nested link structures survive drag
operations correctly - directly targeting the exact failure pattern
found in research where a container with a link, containing nested
child containers, rendered correctly in the editor but shipped as
broken, split HTML on the actual live page (the link tag incorrectly
wrapping and splitting nested div structure).

Test this specifically: create a container with a link action
containing multiple nested child containers, drag one of the nested
children to a new position, then run the parity check and confirm it
either catches any resulting HTML corruption, or confirms none
occurred - don't assume this case doesn't apply just because we don't
use Elementor's exact widget architecture.
```

## Checkpoint for Step 5
Confirm the parity-check system genuinely inspects the case described,
not just a generic style comparison - this is a structural/nesting
integrity check, a new dimension for that system alongside the style,
commerce, and schema checks it already performs.

---

## What determines this file is complete

Part 1's four zones all functioning with correctly-scoped actions
wired to existing systems, plus keyboard parity. Part 2's four stress-
test scenarios all passing cleanly on the deep-nesting test page, plus
the parity-check extension confirmed working. Do not consider this
file done based on Part 1 alone - Part 2 is the more consequential half,
even though Part 1 was the more visible original request.

## Note for decisions-log.md

Record that Part 2's stress test was run and passed (or record
specifically what was found and fixed if issues surfaced) - this is
worth having a permanent record of, since "we tested deep nesting
against real failure patterns found in a direct competitor" is a
concrete, verifiable claim worth being able to point back to later,
rather than a vague assurance.
