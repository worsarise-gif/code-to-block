# Upgrade Implementation Plan 16 — Fix Separated-Input Parsing, Then Unified Paste Mode

**Purpose**: A confirmed bug exists: pasting HTML, CSS, JS, and PHP into
separate boxes causes parsing failures that don't occur when the same
content is pasted together as one blob. This file fixes the root cause
first, then builds a unified "paste everything at once" experience as
the primary entry point — specifically serving non-technical users who
get one mixed code blob back from an external AI tool and shouldn't
need to manually identify and separate HTML from CSS from JS themselves.

**Important correction to keep in mind while building this**: the core
detector/parser pipeline already exists (from the base build) and
already handles mixed content pasted together. This file does NOT
replace that pipeline — it fixes a specific weakness in how it handles
DISCONNECTED input, and adds a better front door to the existing
system. Do not rebuild the detector from scratch.

---

## Part 1 — Diagnose and fix the separated-input parsing bug (do this first, always)

### Why this almost certainly happens — verify this theory, don't just assume it

When HTML, CSS, JS, and PHP are pasted together in one blob, the parser
can use POSITION as context — a `<script>` tag located right after a
specific element gives real information about what it's meant to act
on, and CSS rules appearing near the HTML they style can be associated
with more confidence. When the same content arrives split across four
disconnected boxes, that positional relationship is lost - the CSS
resolver has to match selectors to elements using only class/ID names,
with no surrounding context, and any part relying on positional
proximity (e.g. "the script right after this button") has nothing to
anchor to. This is a plausible root cause, but must be CONFIRMED
against actual failing examples, not assumed to be correct.

### Step 1 — Reproduce and isolate the actual failure

```
Take a real, working combined-paste example from our existing test
fixtures (e.g. the pricing card or hero section from Phase 0) that
parses correctly when pasted as one blob. Manually split it into
separate HTML, CSS, and JS pieces (matching how our current interface
presents them as separate boxes) and paste them into their respective
fields.

Report exactly what breaks, with specifics: does the CSS resolver fail
to match certain selectors it matched correctly in the combined
version? Does JS action-binding fail to associate a script with the
correct element? Is it a specific category of failure, or several
different ones? Show me the actual error output or incorrect result,
not just "it fails."
```

## Checkpoint for Step 1
This must produce a concrete, specific, reproducible failure - not a
vague confirmation. If the split version actually works fine in this
controlled test, the bug may be in a different scenario than assumed,
and needs to be reproduced with the ACTUAL content that failed for you
previously, not a stand-in example.

### Step 2 — Fix the root cause

```
Based on the specific failure(s) found in Step 1, fix the underlying
issue. Likely fix, pending confirmation of the actual cause: when HTML,
CSS, and JS arrive as separate inputs, the parser should still attempt
full selector-based matching (CSS resolver matching by class/ID/tag,
exactly as it already does for the combined case) rather than relying
on any positional assumptions that only hold when content arrives
together. If position-dependent logic is found to be the actual cause,
remove that dependency so separated input is resolved the same way
combined input is - by selector matching alone, consistently, in both
cases.

Re-run the exact failing scenario from Step 1 and confirm it now
produces the same correct result as the combined-paste version of the
same content.
```

## Checkpoint for Step 2
Compare the separated-input result directly against the combined-input
result for the SAME content - they should now match. This is the real
proof the root cause was fixed, not just that the specific error
message went away.

---

## Part 2 — Unified "Paste Everything" mode (the primary, non-technical-friendly entry point)

**Only build this after Part 1 is confirmed fixed.** Building a nicer
front door onto a parser that still mishandles some inputs would hide
the bug rather than fix it - Part 2 assumes Part 1's fix means
separated and combined input are now equally reliable, so the UI choice
becomes about experience, not about avoiding a known failure mode.

### Step 3 — Add a single unified paste field as the default view

```
Add a new, single large paste field as the DEFAULT/primary import
experience - labeled simply "Paste your code" with a note like "HTML,
CSS, JavaScript, and PHP - paste it all together, we'll sort it out."

When content is pasted here, run it through our existing detector
pipeline (the same one used for combined content today) and show the
user a clear, visual confirmation of what was found - e.g. "Found:
HTML structure, 1 stylesheet, 2 script blocks" - before proceeding to
parse it into blocks. This makes the automatic separation visible and
trustworthy, rather than an invisible black box.

The existing separate HTML/CSS/JS/PHP boxes (from File 14) should
become a secondary "Paste separately" option - accessible via a toggle
or link, for users who already have cleanly split code and prefer
direct control over each part - not removed, just no longer the
default, primary path.

Test this specifically with a realistic scenario: take a single,
complete mixed-code response as it would actually come back from an
external AI tool (HTML structure with inline styles in a <style> tag,
a <script> tag with a simple interaction, no manual pre-splitting by
the user at all), paste the whole thing into this one field, and
confirm it correctly detects and separates all parts, then parses
into draggable blocks matching what combined-paste already does
correctly today.
```

## Checkpoint for Step 3
This is the test that matters most for the actual persona this file is
for: hand this scenario to someone unfamiliar with the builder (or
simulate that experience yourself) - paste one blob, nothing else.
Does it work correctly on the first try, with no instruction needed
about which box is for what? That's the real bar, since the whole
point is removing the need for a non-technical user to identify and
separate code themselves.

### Step 4 — Make the detection confirmation genuinely useful, not just decorative

```
When the unified paste field shows "Found: HTML structure, 1
stylesheet, 2 script blocks," make each of those findings clickable/
expandable so a curious or cautious user can see exactly what was
detected in each category before committing to parse it - particularly
important for any detected PHP, which must still go through our
existing explicit opt-in security confirmation flow (from the base
build and File 14) before anything is registered, regardless of
whether it arrived via the unified paste or the separate PHP field.

Confirm that PHP detected through this NEW unified path triggers the
exact same security scan and confirmation flow as PHP detected through
the separate field - no shortcut or bypass introduced by this new entry
point.
```

## Checkpoint for Step 4
This is a critical security checkpoint, not just a UX nicety - confirm
explicitly that the unified paste path cannot be used to sneak PHP
past the confirmation flow that the separate-field path enforces. Test
by pasting a blob containing PHP through the new unified field and
confirming the full existing confirmation flow triggers, identically
to pasting the same PHP through the dedicated PHP field.

---

## What determines this file is complete

Part 1: the separated-input bug is confirmed fixed by direct comparison
against combined-input results for the same content, not just "the
error went away." Part 2: a genuinely one-paste, no-manual-splitting
experience works correctly for realistic AI-generated mixed code,
with PHP security confirmation fully intact through the new path.

## Note for decisions-log.md

Record two things: first, the specific root cause found and fixed in
Part 1 (once confirmed) - this is worth a permanent record since it
was a real, confirmed bug affecting reliability, not a hypothetical.
Second, the decision to make unified paste the DEFAULT and separated
boxes the secondary/advanced option, reversing which was primary
before this file - worth protecting so a future UI change doesn't
casually flip this back without reconsidering why it was changed.
