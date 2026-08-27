# Upgrade Implementation Plan 17 — Full Editor UI Redesign (Reference-Matched)

**Purpose**: Rebuild the editor's visual structure and layout to match
three provided reference images precisely — a left Elements panel, a
canvas with a breadcrumb trail, a right panel with Content/Style/
Advanced tabs, and a far-right column with Dynamic Data, Visibility,
States, Navigator, History, Permissions, SEO, and Performance panels.

**Read this before building anything**: most of what these references
show is not new functionality — it's a better VISUAL HOME for systems
already designed across Files 4, 7, 10, and Upgrade 2 Part 3. Treating
this as "build sixteen new features" would risk duplicating working
systems. Treating it as "give existing systems their correct panel
placement, plus build the handful of genuinely new pieces" is the
accurate, buildable scope. Each section below states explicitly which
kind it is.

---

## Reference analysis — what's existing vs. genuinely new

| Reference element | What it actually is |
|---|---|
| Breadcrumb trail above canvas ("Hero Section › Column › Heading") | **NEW** — replaces the always-on dashed-outline clutter from File 13 with a compact path indicator |
| Content / Style / Advanced tabs | **NEW arrangement** of existing control-panel work from Files 9-10, reorganized into three named tabs instead of a Simple/Advanced toggle |
| Right-side Navigator tree (Body → Header → Hero Section → ...) | **NEW** — not covered by any prior file |
| Dynamic Data panel ("Connect this element to dynamic content") | **Existing system, new surface** — this is File 4's content-slots system, given a dedicated panel |
| Visibility panel (device icons, Conditions) | **Existing system, new surface** — Upgrade 2 Part 3's responsive controls, plus a genuinely new "Conditions" concept (logged-in state, user roles) |
| States panel (Default/Hover/Focus/Active) | **Existing system, new surface** — the state cascade from Upgrade 2 Part 3, shown as explicit tabs |
| History panel (persistent, browsable log) | **NEW** — different from undo/redo (an action) — this is a browsable record |
| Permissions panel (Role, Can edit/delete/publish, Lock Element) | **NEW, extends File 4** — content-mode is page-level; this is per-element, per-role |
| SEO & Meta panel (Title, Description, inline) | **Existing system, new surface** — File 7 Step 4's tags, relocated from content-mode-only to also appear here |
| Performance panel (Lazy Load toggles) | **NEW** — not named in any prior file |

---

## Part 1 — Canvas breadcrumb + Navigator tree (the centerpiece, build first)

### Confirmed pattern, not guessed — verified against Webflow's own documentation

Both the breadcrumb and Navigator are two views of the SAME underlying
tree data, not separate systems: "with an element selected, you can
view the hierarchy of nested elements in the breadcrumb bar under the
canvas... in descending hierarchical order from left to right, with
the selected element on the right, and the top-level parent element on
the left." The Navigator itself should not be a permanently-open
column - it's toggleable, and importantly, "opens automatically when
you drag a new element from the Add panel over the Navigator icon or
onto the canvas, or drag an existing element on the canvas" - a smart
reveal-during-drag behavior, not a fixed layout element eating canvas
width at all times.

### Step 1 — Build the breadcrumb trail

```
Add a breadcrumb trail above the canvas, replacing the always-on
dashed-outline approach we corrected in File 13. When a block is
selected, show its full ancestor path (e.g. "Hero Section > Column >
Heading") using our existing block-tree parent references - this is
the SAME data our block schema already stores (children arrays imply
parent relationships), just rendered as a horizontal path instead of
nested outlines.

Each breadcrumb segment should be clickable, selecting that ancestor
block directly - clicking "Column" in the trail selects the column,
updating the canvas selection and the right panel accordingly.

Test on our existing deeply-nested performance test page (from the
performance upgrade file): select a block 6 levels deep, confirm the
breadcrumb shows the full accurate path, and confirm clicking each
segment correctly selects that ancestor.
```

## Checkpoint for Step 1
Confirm breadcrumb accuracy specifically on deep nesting - this is
where a bug would be most likely to surface (an incorrect ancestor
shown, or a broken click-to-select on a specific depth).

### Step 2 — Build the Navigator panel

```
Add a collapsible Navigator panel (toggleable via a toolbar icon,
matching the reference images) showing the full page's block tree
hierarchically - Body/Root at top, nested children indented below,
exactly mirroring our existing block-tree schema structure.

Implement the same interaction pattern as the confirmed reference
behavior: the Navigator should auto-open when a user starts dragging a
new block from the Elements panel onto the canvas, or when dragging an
existing block - closing again (or staying open, per user preference)
once the drag completes. This gives visibility into deep-nesting drop
targets DURING a drag, directly useful for the drag-reliability work
already verified in File 11.

Selecting a block in the Navigator should select it on the canvas and
update the breadcrumb and right panel identically to selecting it
directly on canvas - both are the same underlying selection state, not
two separate mechanisms.

Test by dragging a new block during an active drag operation and
confirming the Navigator auto-opens showing the live drop-target
context, then confirming Navigator selection and canvas selection
stay perfectly in sync.
```

## Checkpoint for Step 2
This connects directly to File 11's drag-reliability work - test the
Navigator specifically during the same deep-nesting drag scenarios
verified there, confirming the Navigator's live view of hierarchy stays
accurate throughout a drag, not just before and after.

---

## Part 2 — Right panel: Content / Style / Advanced tabs

### Step 3 — Reorganize existing controls into three named tabs

```
Reorganize our existing control panel (from Files 9-10) into three
named tabs matching the reference: "Content" (text values, links,
Dynamic Data connections - reads/writes our content-slots system from
File 4), "Style" (all visual controls from Files 9-10's full control
taxonomy), and "Advanced" (responsive breakpoints, custom CSS
fallback, ARIA/accessibility settings, custom attributes/ID/classes).

This does not require new controls - it requires re-sorting existing
controls into these three groupings, and replacing File 10's binary
Simple/Advanced toggle with this three-tab structure instead. Update
File 10's original toggle-based approach: the "Content" tab naturally
serves the simple/beginner case (matching what File 10 classified as
Simple-tier), and "Style" + "Advanced" together serve what File 10
classified as Advanced-tier - achieving the same progressive-disclosure
goal through tabs instead of a toggle.

Show me the full control list re-sorted into these three tabs, cross-
checked against File 9's original taxonomy to confirm nothing was lost
in the reorganization.
```

## Checkpoint for Step 3
Cross-reference against File 9's full control inventory - every
control that existed before this reorganization should still be
findable, just under a different, clearer tab. Nothing should have
been dropped in the process of re-sorting.

**Note on File 10's status**: this step effectively supersedes File
10's binary toggle approach with a three-tab structure. If File 10 was
already built before this file, this step is a REVISION of that work,
not an addition alongside it - don't maintain both a toggle and tabs
simultaneously, that would be a confusing, redundant interface.

---

## Part 3 — Far-right column panels

### Step 4 — Dynamic Data panel (existing system, new surface)

```
Add a "Dynamic Data" panel to the far-right column, shown when a
content-slot-marked block (from File 4) is selected. Display: "Connect
this element to dynamic content" with a clear action to link it to a
content source - this surfaces our EXISTING content-slots system
(is_content_slot, slot_label, slot_content_type fields from File 4)
with a proper dedicated panel, rather than only being reachable through
content mode.

Test by selecting a block already marked as a content slot (from
earlier File 4 testing) and confirming this panel correctly shows its
existing slot configuration, not a blank/disconnected state.
```

## Checkpoint for Step 4
Confirm this panel reads the SAME underlying slot data content mode
already uses - two views of one system, not a second parallel slot
mechanism.

### Step 5 — Visibility panel: existing responsive controls + new Conditions

```
Add a "Visibility" panel showing our existing per-device visibility
toggles (desktop/tablet/mobile icons, from Upgrade 2 Part 3) alongside
a NEW "Conditions" feature: rules for showing/hiding a block based on
context beyond just device - specifically, logged-in state and user
role (e.g. "only show this block to logged-in users" or "only show to
Administrator role").

This Conditions feature is genuinely new - build it as a simple rule
list evaluated at render time, checking WordPress's current user state
via standard WordPress functions (is_user_logged_in(), current user's
roles) - not a new authentication system, just a visibility filter
reading WordPress's existing user-state functions.

Test by creating a block with a "logged-in users only" condition,
confirming it's hidden for a logged-out visitor and visible for a
logged-in one on the actual frontend.
```

## Checkpoint for Step 5
Confirm this reads WordPress's existing user-state functions rather
than reimplementing login-status checking - reuse existing WordPress
capability, don't rebuild it.

### Step 6 — States panel (existing system, new surface)

```
Add a "States" panel with Default/Hover/Focus/Active tabs, surfacing
our EXISTING state-based style system (from our schema's "states"
field, referenced since Phase 1) as explicit, named tabs rather than
an implied toggle buried in the style controls.

Test by setting a hover-state color on a button block through this new
panel, confirming it produces identical behavior to however hover
states were previously set through the existing control system.
```

## Checkpoint for Step 6
Confirm no new state-storage mechanism was created - this panel writes
to the same `states` schema field that's existed since Phase 1.

### Step 7 — History panel (genuinely new)

```
Add a persistent "History" panel showing a running, browsable log of
changes made to the current page - distinct from undo/redo (which is
an ACTION), this is a readable record: "Section added," "Text edited,"
"Image changed," etc., with timestamps.

This should be a lightweight log, not a full version-control system -
each entry can be a short description plus a timestamp, stored
alongside the page's other metadata. Clicking an entry could
optionally jump the undo stack to that point (using our existing
undo/redo mechanism from Phase 5) rather than this panel needing its
own separate restore mechanism.

Test by making several different kinds of edits (add a block, change
text, change an image) and confirming each produces an accurate,
readable log entry in order.
```

## Checkpoint for Step 7
Confirm clicking a history entry (if that interaction is built) uses
the EXISTING undo/redo stack rather than a new, separate restore
mechanism - avoid building two ways to "go back in time."

### Step 8 — Permissions panel (extends File 4, genuinely new granularity)

```
Add a "Permissions" panel per element: Role (which WordPress role owns
edit rights to this specific block), and toggles for Can edit / Can
delete / Can publish, plus a "Lock Element" action preventing any
further changes to this specific block regardless of role.

This extends File 4's content-mode concept, which operates at the page
level (business owner sees only slots, not structure) - this is finer-
grained, PER-ELEMENT permission and locking, useful for an agency
wanting to lock a header/footer while leaving body content editable by
a client.

Test by locking a specific block, then confirming it cannot be edited,
moved, or deleted by a role without explicit permission, while
unlocked blocks on the same page remain fully editable.
```

## Checkpoint for Step 8
Confirm locking is genuinely enforced (not just visually indicated) -
attempt to edit a locked block directly through the canvas and confirm
it's actually prevented, not just discouraged.

### Step 9 — SEO & Meta panel (existing system, relocated/duplicated surface)

```
Add an "SEO & Meta" section to the far-right column showing Title and
Description fields for the currently selected page - this is the SAME
data File 7 Step 4 already routes through content mode. Decide
explicitly: should this panel be a SEPARATE editable surface for the
same underlying data (risk: two places to edit the same field could
drift if not carefully synced), or should it simply LINK to/open
content mode's existing field for editing (safer, single source of
truth)?

Recommended: make this panel read-only display with an "Edit in
Content Mode" link, rather than a second independently-editable copy -
avoids any risk of the two surfaces disagreeing with each other.

Test by editing the title through content mode, confirming this
panel's display updates to match, proving it's reading the same data
rather than a separate copy.
```

## Checkpoint for Step 9
Confirm there is exactly ONE stored value for page title/description,
regardless of how many panels can display it - this is the same
"don't build parallel systems" discipline applied to data display, not
just data storage.

### Step 10 — Performance panel (genuinely new)

```
Add a "Performance" panel per element with a Lazy Load toggle
(deferring image/iframe loading until it's near the viewport) and an
"Image Lazy Load" setting specifically for image blocks.

This connects to and should reuse relevant logic from File 3's
conditional-loading classification system and File 15's skeleton-
loader work - a lazy-loaded image should show its File 15 skeleton
placeholder until it comes into view and loads, rather than showing
nothing or a blank space.

Test by adding several images below the fold on a long test page,
enabling lazy load, and confirming (via network tab) that below-fold
images don't load until scrolled near, with the File 15 skeleton
showing correctly in the interim.
```

## Checkpoint for Step 10
Confirm this integrates with File 15's skeleton system rather than
introducing a different loading-placeholder behavior just for this
feature.

---

## What determines this file is complete

All ten steps' checkpoints passing, with explicit confirmation that
every "existing system, new surface" item is reading/writing the SAME
underlying data as before (Files 4, 7, and the state/responsive systems
from Upgrade 2), and every genuinely new item (Navigator, History,
Permissions, Conditions, Performance panel) integrates cleanly with
adjacent existing systems as specified rather than duplicating them.

## Note for decisions-log.md

Record two things: first, that this file's three-tab (Content/Style/
Advanced) structure supersedes File 10's binary toggle - if File 10
was built first, this is a deliberate revision, not two systems
coexisting. Second, record the Permissions panel as extending (not
replacing) File 4's page-level content-mode concept - these are two
different granularities (page-level vs. per-element) serving different
real use cases, both worth keeping.
