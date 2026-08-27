# Upgrade Implementation Plan 3 — Conditional Asset Loading (build this before adding GSAP)

**Purpose**: This file exists to answer a specific tension: you want
serious motion capability (GSAP-level scroll sequences, real
choreography) without inheriting the bloat problem that makes Elementor
and Divi's editors lag on complex pages. The resolution isn't a smaller
feature set — it's that **no page should ever load code it doesn't use.**
This file is the system that makes that true. Build this BEFORE adding
GSAP as a native dependency, not after — retrofitting conditional
loading onto a codebase that already assumes "the animation library is
just always there" is much more expensive than designing it in from
the start.

**Explicitly out of scope, by your own decision**: Three.js, WebGL/3D
rendering, physics engines. Not because they're bad ideas forever — just
that they contradict the speed-first priority you set, and there's no
clever architecture that makes 3D rendering lightweight. This file does
not include them, and future files shouldn't either unless that
priority changes.

---

## The principle, stated plainly

**A page's actual load cost should equal exactly what that page uses —
nothing more.** A plain text page loads nothing extra. A page with one
fade-in loads a tiny CSS transition (no JS at all). A page with a real
scroll-driven sequence loads GSAP's core plus only the specific plugin
(ScrollTrigger) it needs — and only on that page, not site-wide.

This is the direct, structural answer to the bloat complaints found in
research — <cite index="47-1">"Divi locks your content into shortcodes... Elementor's Editor V4 (Atomic) beta introduces a strictly CSS-first foundation... this drastically reduces DOM size,"</cite> and the broader pattern where <cite index="47-1">"Page builders historically dragged down WordPress performance. They generated messy code."</cite> Neither competitor solved this by removing capability — they're both still adding features. They just never built a real conditional-loading discipline underneath those features. That's the gap you're closing here.

---

## Step 1 — Classify what actually needs JS versus what's pure CSS

Not everything that looks like "animation" needs a JS library at all.
This classification determines what triggers a JS load versus what
stays free.

```
Before adding any animation library, I want to formalize a
classification in our schema: which animation types are achievable
with CSS alone (transitions, transforms, keyframe animations - fades,
slides, hover effects, simple entrance animations using
Intersection Observer for "animate when scrolled into view"), and
which genuinely require a JS animation library (scroll-linked
scrubbing where the animation progress is tied precisely to scroll
position, complex multi-step timelines, staggered sequences across
many elements with precise timing control).

Add a field to a block's "actions" entry (from our existing schema)
that marks which category an animation falls into: "css_native" or
"js_library". This classification should drive everything downstream -
show me the updated schema section for this.
```

**Why this matters**: a huge percentage of what people call "animation"
(fade-ins, hover states, simple reveals) is genuinely just CSS and
costs nothing extra. Only the harder cases — real scroll-scrubbing,
precise multi-element choreography — need GSAP at all. Getting this
classification right up front means most pages never trigger a JS load
in the first place, which is the actual win here, not a clever loading
trick applied to everything.

## Step 2 — Add GSAP as a per-page conditional dependency, not a global one

```
Now add GSAP (core + ScrollTrigger plugin only, not the full GSAP
plugin suite) as a dependency, but implement it as conditionally
loaded per page, not enqueued globally across the whole site.

Specifically:
1. When a page is saved, scan its block tree for any action marked
   "js_library" in the classification from Step 1
2. If none exist, GSAP should not be enqueued on that page's frontend
   at all - confirm this by checking the actual page source/network
   requests
3. If at least one exists, enqueue GSAP core and ScrollTrigger only on
   that specific page - not site-wide, not on every page regardless of
   use
4. Build the visual style-panel controls for the animation types we
   classified as "js_library" in Step 1 (scroll-scrubbed animation,
   staggered sequence) - generating the GSAP configuration from those
   controls rather than requiring hand-written GSAP code

Show me three test pages: one with no animation (confirm GSAP does not
load at all - check network tab), one with only CSS-native animation
(confirm GSAP still does not load), and one with a real scroll-scrubbed
animation (confirm GSAP loads only on this page, and the animation
works).
```

**This three-page test is the actual checkpoint that matters.** If the
no-animation page and the CSS-only page both show zero GSAP requests in
the network tab, the conditional system genuinely works. If GSAP shows
up on all three regardless of use, this isn't done yet, no matter how
good the animation itself looks on the third page.

## Step 3 — Same conditional principle applied to the editor itself, not just the frontend

```
The same conditional-loading discipline should apply inside the editor,
not just the published frontend. When editing a page with no
js_library-classified actions, the editor should not load GSAP either -
it should only load it when the page being edited actually contains a
block using it, or when a user adds a new js_library-type animation to
a block during editing (lazy-load GSAP into the editor session at that
moment, not before).

Confirm this by loading our earlier deeply-nested performance test page
(from the prior upgrade file) with no animation added, and checking
that GSAP is not present in the editor's loaded scripts.
```

**Why this half matters as much as the frontend half**: this is
precisely the trap Elementor's editor fell into, per the research —
lag scaling with page complexity regardless of what's actually being
used at that moment. If your editor loads every possible capability
upfront "just in case," you've reproduced their exact problem, just
with a longer list of libraries doing it.

---

## What this buys you, stated honestly

This is not the exciting part of the build. It's infrastructure, not a
feature a user directly sees or asks for by name. But it's the specific
thing that makes "heavy duty capability, lightweight actual footprint"
true rather than aspirational marketing copy — and it's cheap to build
now, before GSAP-dependent features exist, versus retrofitting it after
several animation features already assume the library is just always
loaded.

## Explicit guardrail for future upgrades

Any future native capability added to this builder — not just
animation, but anything (a chart library, a form-validation library,
whatever comes later) — should go through this same classification-and-
conditional-load pattern before being added natively. This upgrade
file is establishing the *pattern*, not just solving it once for GSAP
specifically. Note this in `decisions-log.md` as a standing architecture
principle, not a one-time decision.
