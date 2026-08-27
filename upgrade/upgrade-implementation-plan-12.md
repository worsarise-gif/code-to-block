# Upgrade Implementation Plan 12 — Forms (Native + External, Freely Chosen) and a Starter Widget Library

**Purpose**: Two related additions. First, form handling — a genuine
gap across all eleven prior files, and a must-have given our target
audience (the roofers, salons, and clinics from the industry-list
research all fundamentally need "a contact form that emails me").
Built with dual-path submission (a lightweight native engine, or
handoff to an external plugin) so users freely choose, without
building two separate form-building interfaces. Second, a starter
widget library — pre-built, reusable component types (pricing tables,
testimonials, icon boxes) — clarified as a content addition on top of
our EXISTING block system, not a second parallel architecture.

---

## Part 1 — A quick, important clarification before building anything

"Widgets" in Elementor's vocabulary means what we call "blocks." A
request to "apply widgets instead" could be misread as building a
second component system alongside our existing one — that would be a
real, serious mistake, recreating the parallel-system risk we've
deliberately avoided in every file since File 9. What's actually
missing is a **starter library of pre-built, named component types**
(pricing table, testimonial card, icon box, countdown timer) built
using blocks and our EXISTING reusable-components system from File 4
- not a new architecture. See Step 5 below.

---

## Part 2 — Form block and submission handling

### The core architectural decision: decouple the visual form from where submissions go

A form's fields, layout, and styling belong entirely to our existing
block/schema system — no different in kind from any other block. What
happens after submit (native handling vs. external plugin handoff) is
a separate, swappable choice attached to that same visual form. This
is what makes "freely choose" possible without maintaining two
form-building UIs — only one visual builder, with two possible
destinations for the data.

### Critical security principle, confirmed directly by research, non-negotiable

"Never trust a flag sent from the client... every signal that matters
must be generated or verified server-side. Client-sent flags are
decoration, not security." Every anti-spam and validation check in
this file's native path MUST be enforced server-side (PHP), even if a
lighter client-side version also exists for immediate user feedback.
This is the same principle already applied to the PHP-execution
opt-in flow and the WooCommerce cart/checkout work earlier in this
build - client-side is UX, never the actual security boundary.

### Step 1 — Build the form block itself (visual layer, shared by both paths)

```
Add a form block type to our system: a container that holds field
sub-blocks (text input, email input, textarea, dropdown, checkbox,
radio group, file upload), each using our existing control panel
system for styling (following the same pattern established in the
control-panel upgrade files - no new parallel styling system).

Each field should support: label, placeholder, required toggle, and
field-specific validation rules (email format for email fields, etc.)
- validated both client-side for immediate feedback AND server-side
as the actual enforcement, per the security principle above.

The form block has a top-level setting: "Submission Handling" with two
options - "Native" or "External Plugin" (Step 2 and Step 3 below).
This setting determines what happens on submit; it does not change
how the form looks or is built.

Test by building a simple contact form (name, email, message) using
this block, confirming all styling controls work identically to how
they work on any other block type.
```

## Checkpoint for Step 1
Confirm the form block feels like a natural extension of our existing
system - same style panel, same responsive controls, same drag/nesting
behavior as everything else - not a special-cased, separately-built
feature.

### Step 2 — Native submission handling (the lightweight engine)

```
Build the native form-submission path:

1. On submit, validate all fields server-side (never trust client-side
   validation alone, per the security principle above) - reject with
   clear error messages if validation fails
2. Store the submission in a dedicated database table (not shared with
   our page/block content storage) with submitter data, timestamp, and
   originating page
3. Send an email notification to an address configured in the form's
   settings (using WordPress's standard wp_mail(), not a custom mail
   implementation)
4. Provide a simple admin screen listing submissions for a given form,
   with the ability to mark as read/spam/delete

Layer in spam/security protection, ALL enforced server-side:
- A honeypot field: an invisible field real users never see or fill,
  but bots typically do - reject silently (show a fake success
  message, not an error, so the bot doesn't learn to avoid the trap)
  if it's populated
- A minimum-fill-time check: reject submissions completed faster than
  a human plausibly could (a bot submitting in under 1-2 seconds)
- Server-side rate limiting: reject/throttle repeated submissions from
  the same IP within a short window (start conservative, e.g. no more
  than 1 submission per IP per 30 seconds, adjustable)
- Log every rejected submission attempt (timestamp, IP, reason for
  rejection) - this is not optional, since without logs there's no way
  to tell if rules are catching real spam or blocking real users

Test by submitting a valid form (confirm email arrives, submission
appears in admin), then deliberately triggering each spam defense
(fill the honeypot field via browser dev tools, submit faster than the
minimum-fill-time threshold, submit rapidly multiple times from the
same session) and confirming each is correctly rejected and logged.
```

## Checkpoint for Step 2
This is the most important checkpoint in this file. Confirm every
rejection reason is enforced server-side by attempting to bypass each
check using only browser dev tools (which any real attacker would also
have access to) - if any check can be defeated by simply not running
our client-side JavaScript, it is not actually a security check, per
the research finding that client-side signals are "decoration, not
security."

### Step 3 — External plugin handoff path

```
Build the external-handoff submission path: when a form's "Submission
Handling" is set to "External Plugin," our form block should render
using the field structure and styling we control, but route the
actual submit action to a detected, installed external form plugin's
processing (e.g. Contact Form 7, WPForms) rather than our own Step 2
engine.

Research and implement the specific integration points needed - most
WordPress form plugins expose their own shortcode or block for the
actual submission handling. Our approach: allow a user to either (a)
embed an external plugin's existing form directly if they've already
built one there, styled to match as closely as our control panel
allows, or (b) map our own field block structure to trigger that
plugin's submission processing directly, if that plugin exposes a way
to do so.

Be honest in the implementation about which of these two integration
depths is actually achievable per popular plugin, and document the
limitation clearly rather than promising deeper integration than what
each specific plugin's architecture allows.
```

## Checkpoint for Step 3
Test with at least one real, popular external form plugin installed
(Contact Form 7 is a reasonable first target given its wide install
base) - confirm a real form built there can be used from within our
editor, and be honest in documentation about exactly what level of
integration was actually achieved.

### Step 4 — Extend the parity-check system to forms

```
Extend our existing parity-check system to cover forms specifically:
confirm that validation rules shown in the editor (e.g. "this field is
required") match what's actually enforced server-side on submit - this
is the same category of editor/frontend divergence bug our parity
system already catches elsewhere, applied to form validation logic
specifically.

Test by deliberately creating a mismatch (a field marked required in
the editor, but server-side validation not actually enforcing it) and
confirming the parity check catches this discrepancy.
```

## Checkpoint for Step 4
Confirm this integrates with the existing parity system rather than
being a separate, one-off check - consistency with how every other
extension of that system has worked in prior files.

---

## Part 3 — Starter widget library (built on File 4's existing reusable-components system)

### Step 5 — Pre-built component types

```
Using our EXISTING reusable-components system (from the content-slots
upgrade file) and our EXISTING block/control panel system, build a
starter library of common, pre-designed component types: pricing
table, testimonial card, icon box, countdown timer, stats/counter
block, team member card, FAQ accordion, image gallery grid.

Each of these is not a new architecture - it's a specific, thoughtfully
designed arrangement of our existing block types (containers, text,
image, button), pre-styled, saved as a reusable component with
sensible content slots already marked (per our File 4 system) so a
user can drag one in and immediately fill in their own content through
either the full editor or content mode.

Confirm each library item: renders correctly, has properly labeled
content slots for its variable content, and can be dragged in and
customized using our normal control panel - no special-cased behavior
different from any other reusable component.
```

## Checkpoint for Step 5
Drag in three different library items and customize each through both
the full editor and content mode - confirm they behave exactly like
any user-saved reusable component, proving this is genuinely built on
existing systems rather than a new, parallel one.

---

## What determines this file is complete

Part 2: a working form block, native submission handling with all
spam defenses verified server-side-enforced, at least one real external
plugin integration tested honestly, and parity-check extension in
place. Part 3: a starter library of at least the eight component types
listed, each proven to behave identically to any other reusable
component.

## Note for decisions-log.md

Record the decoupled architecture decision for forms (visual layer
separate from submission-handling destination) and why - this is what
enabled "freely choose native or external" without building two
form-builder UIs, and it's worth protecting as the model for any future
feature that might have a similar "let the user choose the backend"
requirement.
