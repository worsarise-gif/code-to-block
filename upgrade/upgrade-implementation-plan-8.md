# Upgrade Implementation Plan 8 — Accessibility (Architecture First, Checker as Safety Net)

**Purpose**: This file fixes the specific, repeated accessibility failures
found across Elementor and Divi's own documentation, GitHub trackers,
and third-party audits — not as a bolt-on widget, but as a property of
how our block system generates markup in the first place. A checker
tool is also built, but deliberately sequenced second, as a genuine
safety net for what can't be automated — not as the primary fix.

---

## Read this before building anything: why sequencing matters here, specifically

In January 2025, accessiBe — a company selling an "AI-powered"
accessibility overlay — settled with the FTC for $1 million over false
claims that their tool could make websites "WCAG compliant"
automatically. Separately, research shows exactly why bolt-on overlay
fixes fail structurally, not occasionally: "Elementor, Divi, and
WPBakery generate deeply nested HTML that breaks semantic structure. A
plugin can layer ARIA attributes on top of that markup to patch some
issues. But when the page builder updates... those fixes often break."
One documented case: an Elementor site's accessibility overlay broke
overnight after an unrelated auto-update, leaving the site inaccessible
to screen reader users for three hours before anyone noticed.

**The lesson, applied directly to this file**: do not build a checker
tool as the primary fix, and never describe it as making a site
"compliant." Fix markup generation architecturally first, so the
checker's job is catching genuine edge cases and content-level
judgment calls — not patching a broken foundation. Every mention of
this feature, in code comments, UI copy, or documentation, should say
"helps identify common accessibility issues" — never "ensures
compliance" or "makes your site accessible."

---

## What research shows actually breaks, concentrated where

A precise, useful finding from research: "For Elementor developers,
this shows up most often in the parts that seem 'advanced': popups,
mega menus, sliders, off-canvas panels, tabs, and sticky UI. Basic
links and form fields usually behave well if the markup is sound."
This tells us where to concentrate the architectural work — not
"accessibility" as one undifferentiated problem, but specifically the
interactive/dynamic components our JS action-binding system already
produces.

The specific, repeated failures found, both competitors:
1. No skip-to-content link (Divi, confirmed - WCAG 2.4.1 failure)
2. Dropdown/mega menus only operable by mouse - genuine keyboard traps
   (confirmed on BOTH Divi and Elementor, including an open GitHub
   issue against Elementor's own codebase)
3. Icons via CSS pseudo-elements read as nonsense to screen readers -
   "what you end up hearing is the symbol's name... four and five"
   instead of meaningful content
4. Missing/stripped focus indicators (Divi's own CSS removes them)
5. Missing alt text, poor color contrast, vague link text, skipped
   heading levels - content-level issues requiring human judgment
6. Quantified scale: "25% of all digital accessibility issues are tied
   to poor keyboard support" specifically

---

## Step 1 — Architectural fix: correct keyboard behavior built into the action-binding system

```
Revise our JS action-binding system (from the animation/interactivity
upgrade file) so that any block using a dropdown, mega menu, popup,
tabs, off-canvas panel, or slider pattern automatically receives
correct keyboard behavior by default - not as something a user has to
separately configure or remember to add.

Specifically:
1. Any dropdown/mega-menu action must be operable via keyboard (Tab to
   focus the trigger, Enter/Space to open, Arrow keys to move within
   the open menu, Escape to close) - not mouse-only
2. Focus must move logically: opening a menu/popup should move focus
   into it, closing should return focus to the trigger element - never
   leaving a keyboard user "stuck" with no clear path forward
3. This is a mandatory property of these action types, not an optional
   toggle - a user should not be able to accidentally ship a
   keyboard-inaccessible dropdown the way both researched competitors
   currently allow

Test this specifically against the exact failure pattern found in
Elementor's own GitHub issue: build a mega menu using our block system,
navigate it using only Tab/Arrow/Enter/Escape (no mouse), and confirm
you can reach every menu item and every dropdown without ever getting
stuck - this is the precise bug pattern to guard against, not a
generic "test keyboard nav" pass.
```

## Checkpoint for Step 1
This is the highest-priority fix in this file, since keyboard-trapped
menus are the single most repeated failure across all sources
researched, confirmed on both direct competitors. Actually navigate a
real built menu with only a keyboard yourself - unplug your mouse if
you have to - don't just review the code and assume it's correct.

---

## Step 2 — Architectural fix: skip-to-content link present by default

```
Add a skip-to-content link to every page generated by our builder by
default - visible on keyboard focus, allowing a keyboard user to
bypass repeated navigation and jump straight to main content, without
requiring the page builder or business owner to remember to add this
themselves.

This should be a structural property of our page template/render
system (from Phase 4), not a block someone has to manually insert.
Test by loading a built page, pressing Tab once from page load, and
confirming the skip-link becomes visible and functional.
```

## Checkpoint for Step 2
Confirm this works on every page type without requiring any manual
setup - the whole point is that it's present by default, unlike Divi
where it's confirmed entirely absent.

---

## Step 3 — Architectural fix: icon handling that doesn't confuse screen readers

```
Revise how icon blocks are generated so they never rely on CSS
pseudo-elements alone for meaningful icons (the exact Divi failure
pattern - "what you end up hearing is the symbol's name... four and
five" instead of anything meaningful).

Specifically: when an icon is purely decorative, it should be properly
hidden from screen readers (aria-hidden). When an icon conveys meaning
(e.g. a standalone icon button with no visible text label), it must
have an appropriate accessible label (aria-label or equivalent) that
describes its function, not its visual appearance - generated as part
of the block's default behavior, not requiring the user to know ARIA
attributes exist.

Test with a screen reader (VoiceOver, NVDA, or a browser extension
screen-reader simulator) on both a decorative icon and a functional
icon-only button, confirming the decorative one is silent and the
functional one announces something meaningful.
```

## Checkpoint for Step 3
Actually listen to the output with a real screen reader tool, not just
inspect the generated HTML - the goal is what a real user actually
hears, matching how the research itself framed this failure.

---

## Step 4 — Architectural fix: protected focus indicators

```
Ensure our default block styles always include a visible focus
indicator for any interactive element (links, buttons, form fields),
and make this a protected default in our style system - a user can
intentionally restyle a focus indicator's appearance, but the style
panel should not make it trivially easy to accidentally remove it
entirely the way Divi's own CSS does.

If a user's custom CSS (from our raw-CSS-fallback system) would result
in no visible focus indicator at all, surface a warning at save time -
similar in spirit to our existing parity-check warnings - rather than
silently allowing it.

Test by attempting to fully remove focus styling via a block's custom
CSS fallback, and confirming a warning appears rather than silent
removal.
```

## Checkpoint for Step 4
Confirm the warning is genuinely hard to miss but not impossible to
override for a user who has a real, deliberate reason (e.g. providing
an alternative custom focus style) - the goal is preventing accidental
removal, not blocking intentional customization entirely.

---

## Step 5 — The checker tool (genuine safety net, built second and scoped honestly)

```
Build an accessibility checker that runs automatically at save/publish
time, scanning the page for the issues that genuinely require
detection rather than being solved architecturally in Steps 1-4:

1. Images without alt text (flag, don't auto-generate - alt text
   requires human judgment about what the image actually conveys)
2. Color contrast below WCAG AA's 4.5:1 ratio for text (flag the
   specific color pair and where it appears)
3. Vague link text ("click here", "read more", "learn more" with no
   surrounding context) - flag these specifically, since research
   named this as a common, real problem
4. Skipped heading levels (H1 directly to H3, no H2) - detectable
   structurally from our existing block tree

Each flagged issue should link directly to the specific block on the
canvas so it's easy to locate and fix, and should explain WHY it
matters in plain language, not just cite a WCAG success criterion
number.

Critically: nowhere in this tool's UI, documentation, or marketing
copy should the word "compliant" or "compliance" appear as something
this tool grants or guarantees. Use language like "helps you catch
common accessibility issues" - never "ensures your site is accessible"
or "makes your site WCAG compliant." Add a visible note in the tool
itself: automated checks catch many common issues but cannot replace
testing with real assistive technology and real users.

Test this on a deliberately flawed test page (missing alt text, low
contrast text, a "click here" link, a skipped heading level) and
confirm all four are correctly flagged with clear, actionable
explanations.
```

## Checkpoint for Step 5
Confirm the tool catches all four deliberately-introduced issues, and
separately, review every piece of UI copy this tool produces against
the honesty standard above - this is the step most likely to
accidentally drift into overclaiming if not checked carefully, given
how directly it echoes the exact language that got accessiBe fined.

---

## What this file does not attempt

Full WCAG 2.1 AA certification or legal compliance guarantees of any
kind - these require actual human testing with assistive technology
and real users with disabilities, which no automated tool, including
this one, can substitute for. This file substantially reduces the
specific, repeated failure patterns found in direct competitors and
gives users genuine tools to catch more - it does not and should not
claim to deliver certified compliance.

## Note for decisions-log.md

Record the sequencing decision made here - architecture first, checker
as safety net, never as the primary claim - and why, referencing the
accessiBe FTC settlement as the concrete cautionary precedent. This is
worth protecting against future feature requests that might push
toward "just add a compliance badge" as a shortcut.
