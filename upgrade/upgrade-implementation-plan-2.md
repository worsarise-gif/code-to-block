# Upgrade Implementation Plan 2 — Editor Performance, Dedicated Environment, Responsive Controls

**Purpose**: This file covers three related but distinct asks: (1) an editor
that stays fast regardless of page complexity, (2) a dedicated, full-screen
editing environment separate from the WordPress admin UI (like Elementor's
"Edit With Elementor"), and (3) responsive device controls that behave
predictably. Each section is grounded in specific, cited failures found by
researching real Elementor/Divi bug reports and user complaints — not
general performance advice.

**Relationship to the first upgrade file**: `upgrade-implementation-plan.md`
covered data-integrity and architecture failures (editor/frontend mismatch,
global style corruption, dynamic content fragility). This file is about the
editing *experience* itself — speed, environment, and device controls.
Both are Phase 7 companions; do them as separate, checkpointed passes.

---

## Part 1 — Editor performance under real content load

### The actual failure pattern found (this is more specific than "make it fast")

<cite index="49-1">A Divi user described the backend as slow and laggy on complex pages, with the editor sometimes taking 30-40 seconds to open, occasionally showing "out of memory" messages or requiring reloads...an Elementor user mentioned the editor being very slow, taking up to 10 seconds to load or simple clicks taking 3 seconds on pages with deeply nested structures.</cite>

**The most telling detail**: Elementor's own official documentation
recommends *hiding* complexity from the editor rather than fixing how it
handles complexity — <cite index="54-1">save a section as a template, then replace it in the page with a shortcode widget, so "the editor only has to load a simple shortcode instead of a complex structure of nested containers,"</cite> explicitly to avoid "performance issues and frustration."

**What this tells you**: the lag isn't random — it correlates specifically
with **nesting depth and total block count**. This is a real, addressable
engineering target, not a vague "make it snappy" ask.

### The upgrade

```
I want to stress-test our editor's performance before Phase 7 features
are considered complete. Build a synthetic test page with deeply nested
blocks - at least 8 levels of nesting, 150+ total blocks on one page -
using our existing schema. Load it in the editor and measure:

1. Initial load time
2. Time to respond when selecting a deeply nested block
3. Time to respond when dragging a block near the bottom of a long page
4. Memory usage over a 10-minute editing session with repeated
   selections and small edits

Report the actual numbers, not just "it feels fine." If any of these
show clear degradation as depth/count increases, propose specific
fixes - virtualization (only rendering visible blocks in the DOM,
not the entire tree at once), memoization of unchanged blocks so
React doesn't re-render blocks that haven't changed, or lazy-loading
deeply nested children until expanded. Implement whichever fixes the
measured bottleneck, and re-run the same test to show the improvement
with real before/after numbers.
```

**Why this approach specifically**: the fix has to be *targeted* at
whatever the actual bottleneck is (rendering, state updates, or memory),
not a generic "optimize everything" pass. Asking for before/after
numbers on the same synthetic page keeps this honest and measurable,
the same way Phase 0's checkpoint asked for a verifiable color, not a
description.

### Checkpoint
Real numbers, not impressions. If the 150-block test page performs
close to the way a 10-block page did in Phase 3, this is done. If there's
a clear cliff at some depth/count threshold, that threshold is now known
and documented — even if not fully solved, it's honestly disclosed
rather than silently accepted the way it currently is in Elementor's
own help docs.

---

## Part 2 — A dedicated, full-screen editing environment

### What you're actually asking for, made concrete

Elementor's "Edit With Elementor" doesn't load its editor inside the
normal WordPress admin dashboard chrome (sidebar menus, admin bar, etc.)
— it replaces the whole browser view with its own dedicated interface.
This matters for two real reasons: it removes visual clutter competing
with the canvas, and it means WordPress admin's own scripts/styles
(which can vary wildly depending on what other plugins are active)
aren't fighting for the same page load, which is itself a stability
improvement.

### The upgrade

```
Right now our editor loads as a screen inside the normal WordPress
admin dashboard. I want a dedicated, full-screen editing environment
instead - similar to how "Edit With Elementor" replaces the whole
browser view with its own interface.

Specifically:
1. Add an "Edit with [our builder]" link/button wherever a builder-
   created post can be edited (post list, or a metabox on the normal
   edit screen)
2. That link should open a dedicated route/page that does NOT load
   the standard WordPress admin chrome (admin sidebar, admin bar,
   other plugins' enqueued scripts/styles) - only our editor's own
   assets
3. This reduces the chance of conflicts with whatever else is active
   on a real WordPress install, and removes visual clutter around
   the canvas

Show me the resulting editor URL and confirm it loads without the
normal wp-admin sidebar/menu present.
```

### Checkpoint
Visit the new dedicated editor URL yourself. It should look and feel
like its own application, not a screen tucked inside the WordPress
dashboard. If other admin elements (sidebar, admin bar, unrelated
plugin scripts) are still visibly loading, that's not done yet — ask
for those to be stripped from that specific route.

### A stability note worth acting on now, not later
Because this dedicated environment only loads its own assets, it
directly reduces exposure to the kind of environment-specific bugs
that plague both competitors — most of their GitHub issues include a
server environment dump (PHP version, active theme, other plugins)
precisely because so many bugs are caused by *interactions* with
whatever else is installed. A dedicated, isolated editor route
structurally avoids a whole class of these by not sharing a page load
with unrelated plugin code.

---

## Part 3 — Responsive device controls that behave predictably

### Important finding before building this: the cascading behavior you want to prevent is partly Elementor's actual intended design, not just a bug

<cite index="66-1">Responsive editing is top-down. This means that when you make a change to a wider device, it will affect narrower devices...if you had changed the heading for tablets, that same change would have automatically been applied to mobiles. Because you only changed the heading for mobile devices, it will not affect how the heading appears on PCs and tablets.</cite>

This is a genuinely reasonable pattern (matches how CSS media queries
naturally cascade — mobile styles override tablet styles override
desktop styles, not the reverse) and it's worth adopting the *concept*
deliberately, not avoiding it entirely. What you actually want to
prevent is where this goes wrong:

- <cite index="62-1">"Look for pages randomly loading with Elementor desktop layout instead of tablet layout. If I set page layout for tablet, this is the layout I expect to see on an actual tablet. I do not expect to see what I set for desktop instead."</cite> — a saved override being silently ignored/reverted.
- <cite index="67-1">"All the sections/widgets that were hidden on mobile are not hidden anymore... Everything that is already display:none should remain display:none"</cite> — a device-specific setting that stopped being respected after an unrelated update.
- <cite index="68-1">"Changes to mobile style layout affects desktop and vice versa"</cite> — Divi's version of true unwanted bleed, where the cascade direction itself breaks (mobile edits leaking upward, which shouldn't happen even under a top-down model).

### The upgrade

```
I want to build responsive device controls for our style panel:
desktop, tablet, and mobile tabs, following our existing
responsive_overrides schema (tablet/mobile keys already defined).

Implement this cascade model deliberately:
- A style set at desktop is the base value
- Tablet inherits desktop's value UNLESS a tablet-specific override
  exists in responsive_overrides.tablet
- Mobile inherits tablet's resolved value (desktop, or tablet's
  override if set) UNLESS a mobile-specific override exists in
  responsive_overrides.mobile
- This is a one-direction cascade: narrower devices can override what
  they inherit, but a narrower-device override must NEVER write back
  to or affect a wider device's value

Add a clear visual indicator in the style panel when a control's value
is inherited (from a wider device) versus explicitly overridden for
the current device view, so it's obvious at a glance which is which.

Then write an automated test that specifically guards against the
Elementor and Divi bugs we found in research:
1. Set a tablet-specific override, save, reload the editor, switch to
   tablet view - the override must still be there, not reverted to
   desktop's value
2. Set a mobile-specific "hide this block" setting, save, reload - it
   must still be hidden on mobile after reload, not silently reset
3. Edit a mobile-specific value - confirm the desktop and tablet
   values are completely unchanged afterward

Show me all three tests passing with real before/after state, not
just a description of the logic.
```

### Checkpoint
This is the one part of this file where the *automated test* is the
real deliverable, not just a working feature — because the actual
competitor bugs were regressions (things that used to work and then
silently broke after an update). A one-time manual check that it works
today doesn't protect against that. Confirm the three tests above are
real, running tests saved in the project (not just something verified
once by hand and then forgotten), so future changes to the codebase
can't silently reintroduce this exact failure class without a test
catching it.

---

## Suggested order for this file

1. **Part 3's automated tests** first, even before the full feature is
   polished — write the tests against the intended cascade behavior,
   then build to make them pass. This guards against the worst version
   of this bug class (silent regression) from the very start rather
   than bolting tests on after the feature seems to work.
2. **Part 2 (dedicated environment)** next — this is comparatively
   self-contained and gives you a real, visible milestone (a proper
   "our own editor" moment) plus the structural stability benefit of
   isolating from other admin-loaded code.
3. **Part 1 (performance stress test)** last in this file, once Part 2's
   dedicated environment exists — because a clean, isolated editor
   route is also a cleaner environment to accurately measure
   performance in, without other plugins' scripts muddying the
   numbers.

## What's NOT in scope here

Building custom breakpoints beyond desktop/tablet/mobile (Elementor
Pro's "additional custom breakpoints" feature) is a real Tier 2
candidate, not needed for a solid v1. Same for A/B testing (a Divi
feature) — genuinely useful eventually, unrelated to the core
performance/environment/responsive-reliability problem this file
addresses.
