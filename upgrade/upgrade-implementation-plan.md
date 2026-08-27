# Upgrade Implementation Plan — Standing Out From Elementor & Divi

**Purpose**: This file exists because researching *why* Elementor and Divi
users file bug reports (not just general sentiment) revealed specific,
recurring failure patterns. Each upgrade below is traced to a real,
cited incident — not a hypothetical — and mapped to where it slots into
your existing phase plan.

**How to use this with OpenCode**: Same rule as the phase files — one
upgrade block at a time, checkpoint before moving to the next. Most of
these belong in Phase 7 (Tier 1 features), since that's where your plan
currently is. A few are flagged as Phase 5/6 revisits where an earlier
decision needs a small addendum, not a redo.

---

## The five failure patterns found, with sources

1. **Editor/frontend divergence** — what the builder shows and what the
   live site renders disagree. Confirmed on both products, repeatedly,
   across years of bug reports.
2. **Global styles override too broadly** — no per-element escape hatch
   from a global token, forcing all-or-nothing design decisions.
3. **Global/reusable elements can silently corrupt the whole page** — a
   single broken saved component can make an editor unusable, with no
   isolation between the component and the pages using it.
4. **Dynamic/third-party content integration is fragile and reactive** —
   bugs in loop/dynamic-content handling are still being patched release
   by release, long after the feature shipped, indicating it wasn't
   designed with real integration testing upfront.
5. **Migration between major versions is manual and error-prone** — no
   structured, automatable path; third parties had to build their own
   fix for this gap.

---

## Upgrade 1 — Editor/frontend parity check (addendum to Phase 4, verify in Phase 7)

**The failure this fixes**: Elementor's global-styles cache bug and
Divi's ACF color-picker bug both boil down to the same root cause — the
editor computes/displays one thing, the frontend renders another, and
nothing in the system catches the mismatch automatically.

**Your existing advantage**: Phase 4's static-CSS-at-save-time decision
already reduces this risk structurally, since you're not computing
styles dynamically per-request the way these bugs describe.

**The upgrade**: Don't just rely on the architecture being safer by
default — add an explicit, automated parity check as a safety net.

```
Add an automated check that runs after every save: render the page
using the same logic the editor canvas uses, and separately render it
using the actual frontend PHP render function from Phase 4. Compare the
two outputs (computed styles per block). If they disagree on any block,
surface a clear warning in the editor - "this block may render
differently on the live site" - rather than staying silent.

This should run automatically, not require the user to manually check.
Show me a deliberately-broken test case (mismatch the two render paths
on purpose) to confirm the warning actually fires.
```

**Why this matters more for you than it might seem**: this single
feature is a direct, provable answer to the most common bug category
found in the research, for both competitors. It's also a strong,
honest marketing point later — "we tell you if editor and frontend
disagree, they don't" — which neither competitor can currently claim
given their own bug trackers.

---

## Upgrade 2 — Per-element override on global design tokens (revise Phase 7's global-tokens task)

**The failure this fixes**: <cite index="21-1">"there are limitations with the elementor global style. The color palette primary color impact all headers (H1, H2, H3), but I want different colors depending on H1, H2, H3."</cite> This is a structural gap, not a bug — global tokens with no override path force users into workarounds or abandoning the token system for that element.

**The upgrade**: Build the override path in from the start, not as a
later patch.

```
Revise the global design tokens feature we planned for Phase 7. Every
block that references a global token (color, typography, spacing) must
also support an explicit "override this token for just this block"
option in the style panel - without breaking the link to the global
token for every other block still using it.

When an override is set, show a small visual indicator on that block
(something like a subtle icon or label) so it's clear at a glance that
this particular instance has diverged from the global value. Show me
a test case: one global color token used by 3 blocks, one block
overridden, confirm changing the global token updates the other 2 but
not the overridden one.
```

**Judgment call worth noting**: this adds real complexity (tracking
per-block override state, not just a flat reference). It's worth it
specifically because this exact limitation is one of the most-repeated,
oldest open complaints in Elementor's own issue tracker — it's a known,
persistent pain point, not a minor nice-to-have.

---

## Upgrade 3 — Isolate reusable/saved components from catastrophic failure (revise Phase 7's reusable-components task)

**The failure this fixes**: <cite index="24-1">"Create global widget (button) on homepage. After some time, the homepage became uneditable. Error in console: Error: id invalid type: string. The editor stays in the loading screen forever, regardless of deactivating plugins, clearing cache, different browsers... this issue was raised two years ago."</cite> A single broken global/reusable element rendered the entire editor unusable, with no isolation and no recovery path, for years.

**The upgrade**: Build failure isolation into reusable components from
day one — this is a safety feature, not a nice-to-have.

```
Revise the reusable saved components feature from Phase 7. When a saved
component is inserted into a page, wrap its rendering in error
isolation: if that specific component fails to render or has malformed
data, the rest of the page (and the editor itself) must continue
working normally. Show a clear, contained error state only on that
component's position - "this saved component failed to load" - not a
frozen or broken whole-page editor.

Also add: if a saved component is edited and the edit produces invalid
data, the edit should be rejected with a clear message before saving -
never silently save something that could break every page using that
component.

Demonstrate this by deliberately corrupting a saved component's data
and confirming the rest of the editor stays fully functional.
```

**This is the highest-priority upgrade in this file.** A years-old,
unresolved "the whole editor becomes permanently unusable" bug in the
market leader is about as clear a signal as you'll get for where to
invest defensive engineering effort.

---

## Upgrade 4 — Design dynamic content integration with real third-party fixtures, not just your own test data (addendum to Phase 7's JS-binding and PHP tasks)

**The failure this fixes**: <cite index="37-1">"Looped Dynamic Content with before and after field values is not rendered in VB"</cite> and <cite index="34-1">"Divi 5 – Loop Builder Dynamic Fields Not Parsed Correctly"</cite> — both are still being patched release-by-release months after the Loop Builder feature shipped, suggesting real third-party data wasn't part of the original design/test process.

**The upgrade**: This doesn't require building a Loop Builder yourself
(that's Tier 2 scope, not now) — but it does mean broadening your test
fixtures now, before Phase 7's features are considered done, rather than
only testing against clean AI-generated snippets.

```
Before marking Phase 7's JS-binding and PHP-registration features
complete, add a few messier test fixtures to our test set:
- HTML/CSS pasted from a real WooCommerce product page (view-source a
  real product page structure, simplified)
- A snippet that references a WordPress dynamic value pattern (like an
  ACF shortcode placeholder, e.g. [acf field="price"])

Run these through the full pipeline (parse, JS-binding, PHP detection)
and tell me honestly where it breaks or behaves confusingly, the same
way we did in Phase 0. This is specifically to catch integration
problems now, on a small scale, rather than discovering them later the
way Divi's Loop Builder bugs are still surfacing release after release.
```

**Why this belongs now, not deferred**: this doesn't need new features
built. It's a testing-scope upgrade — cheap to do now, and it directly
targets the exact failure mode (untested real-world dynamic content)
that's still costing Divi credibility months after shipping.

---

## Upgrade 5 — Structured, scriptable migration path (new addition, Tier 2 candidate — but design the data shape for it now)

**The failure this fixes**: <cite index="40-1">"Theme Builder templates may not recompile automatically after upgrade"</cite> and <cite index="41-1">"Browser-based Divi 4 to Divi 5 migrations cannot be included in automated development workflows"</cite> — a third party had to build a whole separate paid plugin, with <cite index="41-1">a WP-CLI interface with machine-readable output, reliable exit codes, and automation-friendly responses for scripts, CI/CD pipelines, and AI coding agents,</cite> just to patch a gap the platform itself left open.

**The upgrade**: You don't need to build a migration tool right now —
this is legitimately Tier 2 scope, same tier as "import from
Elementor/Divi" which is already on your roadmap. But there's a small,
cheap thing worth doing *now*, in Phase 7, so you don't inherit Divi's
mistake:

```
As we finish Phase 7's features, keep a running note (add to
decisions-log.md) of anything that changes the shape of saved block
data - the schema itself, or how saved components/tokens are
structured. The goal is that whenever we eventually build a real
migration/import tool (Tier 2), we're not reconstructing this history
from scratch the way Divi's ecosystem had to.

No new code needed for this right now - just confirm you're logging
schema-affecting changes as we go, the same way we already logged the
hero-section decision.
```

**Judgment**: deliberately minimal effort now, real payoff later. This
is the cheap insurance version of Upgrade 5, not the full feature.

---

## Priority order for Phase 7

Given everything above, here's the suggested order to fold these into
your current Phase 7 work:

1. **Upgrade 3 (component isolation)** — do this first. Highest-severity
   failure pattern found, and it's foundational to the reusable-
   components task you were already about to build.
2. **Upgrade 1 (parity check)** — do this alongside or right after.
   Directly validates that Phase 4's architecture choice is actually
   paying off, and catches the single most common bug category found
   in the whole research pass.
3. **Upgrade 2 (per-element token override)** — fold into the global-
   tokens task as originally planned, just with this addition built in
   from the start rather than retrofitted.
4. **Upgrade 4 (broader test fixtures)** — cheap, do this as you
   finish the JS-binding and PHP tasks, before marking them complete.
5. **Upgrade 5 (migration-readiness logging)** — ongoing habit, no
   dedicated time block needed, just keep doing it.

## What's explicitly NOT included here

A full Loop Builder equivalent, a full migration tool, and deep
third-party plugin compatibility layers (ACF, WooCommerce, WPML) are
real, valid future work — but they're Tier 2/post-launch scope, same as
before. The upgrades above are specifically the ones that are cheap to
fold into Phase 7 now and expensive to retrofit later, which is the
same standard the original phase plan was built on.
