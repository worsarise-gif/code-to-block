# Upgrade Implementation Plan 10 — Simple/Advanced Panel Modes

**Purpose**: File 9 made our control panel complete (full coverage
matching Elementor's own documented taxonomy). This file makes it
usable — addressing a real, specific, well-evidenced complaint about
competitor panels: not "too many features exist," but "everything is
shown flatly, all the time, with no path from simple to advanced."

**Correcting the original framing**: research shows Elementor and Divi
are NOT simple and user-friendly — multiple independent sources
describe Divi specifically as overwhelming ("40+ tabs of settings...
I've seen clients struggle to make basic edits") with a quantified
real-world outcome (roughly 80% of Elementor clients can self-edit
confidently vs. roughly 40% of Divi clients, per one experienced
developer's account across many client handoffs). Elementor fares
relatively better mainly due to structural predictability (a fixed
sidebar location), not because it has fewer or simpler options. The
actual, fixable failure pattern: flat exposure of every control at
once, regardless of the user's skill level or what they're actually
trying to do in the moment.

**This is an explicit-toggle system, by design decision**: a visible
Simple/Advanced switch per panel, not silent reorganization. This was
chosen deliberately over invisible auto-hiding, so a person always
knows more exists and how to reach it — silently hiding controls would
recreate a different version of the "can't find what I need" complaint,
just for advanced users instead of beginners.

---

## Critical architectural requirement before Step 1

**Do not build a second conditional-visibility system for this.** File
9, Step 1 already built and tested a formal, centralized conditional-
control system specifically to fix the bug pattern where controls
"suddenly" disappeared inconsistently across widgets due to ad-hoc,
duplicated show/hide logic. Simple/Advanced mode is the same kind of
problem (which controls show, based on a state) and must reuse that
exact same centralized mechanism - just with "current mode" as the
condition, alongside the existing "current layout type" condition
already handled there. Building a second, separate toggle system
risks reintroducing the exact bug File 9 was written to prevent.

---

## Step 1 — Classify every control as Simple or Advanced

```
Before building any UI toggle, go through every control currently in
our system (from Phase 5's initial set and every control added in
File 9) and assign each one a tier: "simple" or "advanced".

Suggested starting classification, but use judgment based on what a
typical business-owner or beginner user (from our earlier industry-list
discussion) would reasonably expect to touch versus what a developer
would reach for:

SIMPLE tier (visible by default): color, typography (font size/weight/
family), spacing (padding/margin), basic border (width/color/radius,
not per-corner), background color, text alignment, basic
responsive visibility (show/hide per device).

ADVANCED tier (behind the toggle): CSS filters, transform, z-index/
positioning, per-corner border radius, multi-stop gradients, stacked
box-shadows, Flexbox/Grid layout properties, custom CSS fallback
field, and anything token/override-related beyond simply picking an
existing global token.

Add a "tier" field to each control's definition in our system (this is
metadata about the CONTROL, not the schema.mapped values themselves -
does not require a block-schema.md change, only a control-definition
change). Show me the full classified list before building the toggle
UI, so tiering can be reviewed and adjusted before it's wired up.
```

## Checkpoint for Step 1
Review the classification yourself, specifically imagining the roofer,
salon owner, or other business-owner personas from our earlier
industry-list discussion - would a Simple-tier control set alone let
them confidently make basic edits without ever needing Advanced mode?
If a control feels wrongly tiered, correct it now, before it's wired
into UI - this list is much cheaper to fix at this step than after.

---

## Step 2 — Build the toggle using File 9's existing conditional system

```
Add a Simple/Advanced toggle to our style panel UI - a clearly visible
switch, not a hidden setting, present consistently in the same location
across every block type's panel (borrowing the one confirmed real
advantage found in research: Elementor's predictable, fixed structure).

Wire this toggle into the SAME centralized conditional-visibility
system built in File 9 Step 1 for layout-mode-dependent controls - add
"current panel mode" as a second condition type alongside the existing
"current layout mode" condition, in the same centralized rule set, not
a separate parallel implementation.

When in Simple mode, only Simple-tier controls (from Step 1's
classification) are shown. When switched to Advanced, all controls
(Simple + Advanced tier) are shown. Switching modes should never lose
or reset any value already set on an Advanced-tier control - if a
value was set while in Advanced mode, then the user switches to Simple
mode, that value must persist unchanged even though the control is
temporarily hidden.

Test this specifically against the exact failure class File 9 Step 1
was built to prevent: set a value on an Advanced-tier control (e.g. a
box-shadow), switch to Simple mode, switch back to Advanced, confirm
the box-shadow value is completely unchanged - no reset, no loss of
state, consistent every time you switch back and forth rapidly.
```

## Checkpoint for Step 2
Rapidly toggle Simple/Advanced mode many times on a block with several
Advanced-tier values set, exactly the same stress-testing approach used
in File 9 for the Flexbox/Grid toggle. Confirm no value is ever lost,
reset, or displayed incorrectly after repeated switching - this is the
direct test of whether the shared conditional system was reused
correctly rather than reimplemented in a way that reintroduces the bug
class File 9 fixed.

---

## Step 3 — Default mode logic, and making it a genuinely helpful default, not just a UI feature

```
Set Simple mode as the default state for our content-mode view (from
the content-slots upgrade file) entirely - a business owner in content
mode should never see the Advanced toggle at all, since content mode
already deliberately excludes structural/style editing.

For the FULL editor environment (from the performance/dedicated-editor
upgrade file), default to Simple mode on first open for a new user, but
remember the user's last-chosen mode per session afterward - a
developer who explicitly switches to Advanced mode should not have to
re-switch every single time they select a new block or reopen the
editor.

Test this: open the editor for the first time (or simulate a fresh
session), confirm it opens in Simple mode by default; switch to
Advanced, select a different block, confirm Advanced mode persists
across block selection; close and reopen the editor, confirm the
last-chosen mode is remembered.
```

## Checkpoint for Step 3
Confirm the mode genuinely persists correctly across block selection
and across reopening the editor - a toggle that resets itself
constantly would recreate exactly the "I have to re-find the same
setting every time" frustration this whole file exists to prevent.

---

## Step 4 — Search-within-panel (the second half of the original UX complaint)

```
Add a search field at the top of the style panel that filters visible
controls by name as the user types - regardless of current Simple/
Advanced mode, a search match should surface that control even if it
would normally be hidden in Simple mode (searching is an explicit
request to find something specific, which should override the tier
filter for that search session).

This directly addresses the repeated research complaint about hunting
through "tabs and sub-tabs" or "different parts of the Dashboard" to
find a specific setting. Test by searching for an Advanced-tier control
(e.g. "shadow") while in Simple mode, and confirming it's found and
made accessible despite not normally being visible in that mode.
```

## Checkpoint for Step 4
Confirm search correctly surfaces Advanced-tier controls even while in
Simple mode, and that clearing the search field returns the panel to
correctly respecting the current mode's normal filtering - the search
override should be temporary and session-based, not a permanent mode
change.

---

## What this file does NOT change

No new style properties, no new schema fields beyond the control-tier
metadata from Step 1. This file is purely about presentation and
discoverability of controls that already exist (from Phase 5 and File
9) - it does not duplicate or replace any of that prior work.

## Note for decisions-log.md

Record the decision to reuse File 9's centralized conditional-
visibility system for Simple/Advanced mode rather than building a
second parallel system, and why - this is a direct, deliberate
prevention of the exact "ad-hoc, duplicated show/hide logic" failure
pattern that caused Elementor's own documented bug where a control
"suddenly" disappeared inconsistently across many widgets after
working correctly for years.
