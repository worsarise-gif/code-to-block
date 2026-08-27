# README — Master Instructions for the Upgrades Folder

**Read this file first, completely, before opening any other file in
this folder.** This is not a suggestion — several upgrade files
depend on earlier ones existing first, and building out of order will
waste real time or produce broken comparisons (see the Dependency Map
below). This version covers all twelve upgrade files.

---

## What this folder is

Twelve upgrade files, each addressing a specific, researched gap
between this builder and its two main competitors (Elementor, Divi).
Every file was written after searching for real, cited developer/user
complaints, GitHub issues, or documented bugs — not from assumption.
Each file is self-contained with its own prompts and checkpoints, but
they are NOT independent of each other. Several have hard prerequisites
— some stated explicitly by file number in the file's own text, others
described in prose (e.g. "our existing parity-check system") without
naming the file number. This README traces both kinds, so re-check the
map below even for files whose text doesn't explicitly say "File N."

This folder assumes the base build (`DEVELOPMENT_PLAN.md`'s Phases
0–6) is already complete before any file here is started. If Phase 7
has not been reached yet, finish `DEVELOPMENT_PLAN.md` first — this
folder is Phase-7-and-beyond work, not a replacement for it.

---

## The one rule that overrides everything else in this folder

**Work through exactly one file at a time, in the order given below,
and do not start a new file until the previous one's every checkpoint
has actually been verified — not assumed, not skimmed, verified.**

This mirrors how the base build phases were run. Every file in this
folder was written with that same discipline in mind: each has
explicit checkpoints asking for real evidence (actual JSON output, a
real screen-reader test, real before/after performance numbers, an
actual attempted security bypass) rather than a description of what
should happen. Do not let this discipline lapse just because these are
"upgrades" rather than "phases" — the risk of skipping ahead is
identical.

---

## Dependency Map — why the order below is not arbitrary

This is the real dependency graph, traced from what each file actually
references — including prose references that don't use the words
"File N" but clearly depend on another file's system.

```
File 1 (Standing Out) ──────┬──> File 5 (WooCommerce) requires File 1's
                             │    component-isolation pattern
                             │
                             ├──> File 6 (Caching) requires File 1's
                             │    parity-check system to extend
                             │
                             ├──> File 7 (SEO) requires File 1's parity-
                             │    check system to extend for schema-drift
                             │
                             └──> File 11 (Right-Click/Drag) requires
                                  File 1's parity-check system to extend
                                  for drag-induced structural corruption
                                  (Part 2, Step 5) — referenced in prose
                                  as "our existing parity-check system,"
                                  not by file number, in File 11's text.

File 2 (Performance/Editor) ┬──> File 3 (Animation) requires File 2's
                             │    dedicated editor environment
                             │
                             ├──> File 6 (Caching) requires File 2's
                             │    dedicated editor environment
                             │
                             ├──> File 7 (SEO) credits File 2's
                             │    performance work
                             │
                             ├──> File 9 (Controls) requires File 2's
                             │    performance BASELINE NUMBERS — Step 5
                             │    of File 9 explicitly compares against
                             │    them
                             │
                             └──> File 11 (Right-Click/Drag) requires
                                  File 2's deeply-nested performance
                                  test PAGE to reuse for its drag stress
                                  test (Part 2, Step 4) — same page,
                                  different kind of test run on it.

File 4 (Content Slots) ─────┬──> File 5 (WooCommerce) requires File 4's
                             │    content-mode view (Step 7)
                             │
                             ├──> File 7 (SEO) requires File 4's
                             │    content-slots system (Step 4)
                             │
                             ├──> File 11 (Right-Click/Drag) requires
                             │    File 4's reusable-components system
                             │    for its "Save as Reusable Component"
                             │    context-menu action (Part 1)
                             │
                             └──> File 12 (Forms/Widget Library) requires
                                  File 4's reusable-components system
                                  directly for its ENTIRE Part 3 (the
                                  starter widget library is built on
                                  nothing but File 4's existing system)

File 6 (Caching) ───────────────> File 7 (SEO) credits File 6's caching
                                  work for Core Web Vitals gains

File 8 (Accessibility) ─────────> File 11 (Right-Click/Drag) requires
                                  File 8's keyboard-accessibility
                                  pattern for its Part 1, Step 3
                                  (keyboard path to context-menu actions)

File 9 (Controls) ───┬──────────> File 10 (Simple/Advanced Panel Modes)
File 2 (Performance) ┘            requires File 9's centralized
                                  conditional-visibility system directly
                                  (reuses it rather than building a
                                  second one), and File 2's dedicated
                                  editor environment as the surface it
                                  attaches to.

File 1, 2, 4, 8 ─────────────────> File 11 (Right-Click/Drag) has FOUR
                                  separate prerequisites — the most
                                  dependency-heavy file in this folder.
                                  Do not attempt it until all four exist.

File 4 ───────────────────────────> File 12 (Forms/Widget Library) has
                                  two parts: Part 2 (forms) needs File 1
                                  for its parity-check extension (Step
                                  4); Part 3 (widget library) needs
                                  File 4 directly and entirely.
```

**In plain terms**: Files 1, 2, and 4 are the true foundation — nearly
every later file reaches back into at least one of them, and several
(File 11 especially) reach into three or four at once. File 9 sits in
the middle: it needs File 2 but is itself needed by File 10. Build
foundation files completely before touching anything that cites them,
even when the citation is a plain-English description rather than an
explicit file number.

---

## Recommended build order

This order satisfies every dependency traced above, including the
prose-only ones. Follow it top to bottom.

1. **`upgrade-implementation-plan.md`** (File 1 — Standing Out) — first,
   no exceptions. Component-isolation and parity-check systems are
   prerequisites for Files 5, 6, 7, and 11.
2. **`upgrade-implementation-plan-2.md`** (File 2 — Performance/
   Dedicated Editor/Responsive) — second. Its performance baseline
   numbers, deep-nesting test page, and dedicated editor environment
   are prerequisites for Files 3, 6, 9, and 11.
3. **`upgrade-implementation-plan-4.md`** (File 4 — Content Slots) —
   third. Needed by Files 5, 7, 11, and — entirely, for its whole
   third part — File 12.
4. **`upgrade-implementation-plan-3.md`** (File 3 — Conditional Asset
   Loading / Animation) — needs File 2's dedicated editor environment.
5. **`upgrade-implementation-plan-6.md`** (File 6 — Caching) — needs
   File 1's parity system and File 2's dedicated editor environment.
6. **`upgrade-implementation-plan-5.md`** (File 5 — WooCommerce) —
   needs File 1's isolation pattern and File 4's content-mode view.
7. **`upgrade-implementation-plan-7.md`** (File 7 — SEO) — needs
   Files 1, 4, and 6 all in place.
8. **`upgrade-implementation-plan-8.md`** (File 8 — Accessibility) —
   no hard dependency on Files 1–7, but do it here since File 11 needs
   its keyboard-accessibility pattern, and it should exist before that.
9. **`upgrade-implementation-plan-9.md`** (File 9 — Complete Control
   Panel) — needs File 2's performance baseline for its own Step 5.
   Also needs to exist before File 10.
10. **`upgrade-implementation-plan-10.md`** (File 10 — Simple/Advanced
    Panel Modes) — needs File 9's conditional-visibility system
    directly, and File 2's dedicated editor environment.
11. **`upgrade-implementation-plan-11.md`** (File 11 — Right-Click
    Menu + Drag/Nesting Reliability) — the most dependency-heavy file
    in the folder. Needs File 1 (parity extension), File 2 (reuses the
    deep-nesting test page), File 4 (reusable-components action in the
    context menu), and File 8 (keyboard-accessibility pattern for
    Part 1 Step 3). Do not start this file until all four exist and
    are verified complete.
12. **`upgrade-implementation-plan-12.md`** (File 12 — Forms + Starter
    Widget Library) — last. Part 2 (forms) needs File 1's parity
    system for its Step 4. Part 3 (widget library) is built entirely
    on File 4's reusable-components system — this file's third part
    cannot be meaningfully started without File 4 complete.

---

## Non-negotiable rules that apply across every file in this folder

These are drawn directly from patterns established across all twelve
files and the base development plan. Do not relax them for the sake
of speed.

- **Never mark a step "done" from a description alone.** Every
  checkpoint in every file asks for real, inspectable evidence — actual
  output, an actual test result, an actual before/after number, an
  actual attempted security bypass. If a step's checkpoint can't be
  verified this way, it isn't done.
- **Security-and-legal-sensitive steps get extra scrutiny, not less.**
  Specifically: File 5's cart/checkout flow, File 8's accessibility
  checker language (must never claim "compliance" — see the accessiBe
  FTC precedent cited directly in that file), and File 12's Step 2
  (every spam/validation check must be verified server-side-enforced by
  attempting to bypass it using only browser dev tools — client-side
  checks are explicitly "decoration, not security" per that file's own
  cited research). Do not let these move faster just because they're
  mid-list.
- **Update `decisions-log.md` as instructed.** Nearly every file ends
  with an explicit "Note for decisions-log.md" section. Do not skip
  these — they exist so a real design decision made once doesn't get
  silently reversed by a later, unrelated change.
- **Never build a second, parallel version of a system that already
  exists.** This is named explicitly in multiple files (File 10 reusing
  File 9's conditional-visibility system rather than building a second
  one; File 12's widget library reusing File 4's reusable-components
  system rather than a new architecture; File 12's form block reusing
  the existing control panel rather than a separate styling system).
  Treat this as a standing rule for anything built after this folder
  too, not just within it.
- **If a file's checkpoint reveals a problem, stop and fix it in that
  file before moving to the next one.** Do not carry a known-broken
  checkpoint forward hoping a later file will incidentally fix it —
  none of them are designed to, and this is how small problems compound
  into large ones.
- **If something in one file's Step turns out to conflict with a
  decision already made in an earlier file**, treat this as worth
  surfacing and resolving deliberately, not silently overriding the
  earlier decision. Check `decisions-log.md` for context on why the
  earlier decision was made before changing course.

---

## What to do when a file is fully complete

Update this README's checklist below by marking the file done, and
note the actual completion date. This gives a real, at-a-glance status
of the whole folder without needing to open every file individually.

### Status checklist

The 2026-08-25 acceptance review found that the previous checked state was based largely on code presence rather than each file's mandatory evidence. See `ACCEPTANCE_AUDIT.md` for findings, live proof, fixes, and required next work.

- [ ] File 1 — Standing Out From Elementor & Divi — **Partial** (real canvas/frontend parity now runs on save; durable third-party pipeline fixtures remain)
- [ ] File 2 — Performance / Dedicated Editor / Responsive Controls — **Partial** (asset isolation fixed; required browser performance and responsive-hide proof unmet)
- [x] File 4 — Content Slots — **Completed 2026-08-25** (typed Content Mode, safe latest-document patches, duplicate/refill, rich text, image upload, and linked-instance props verified)
- [x] File 3 — Conditional Asset Loading / Animation — **Completed 2026-08-25** (CSS-only and GSAP controls/execution plus frontend/editor conditional-network checkpoints verified)
- [ ] File 6 — Native Caching — **Partial** (hash CSS exists; public HTML freshness, scheduled cleanup, and vendor tests unmet)
- [ ] File 5 — WooCommerce Integration — **Unmet** (grid styling fixed; major native workflows, parity, fixtures, and isolation absent)
- [ ] File 7 — SEO Architecture — **Partial** (JSON-LD escaping fixed; title, drift guard, Article/validator work unmet)
- [ ] File 8 — Accessibility — **Partial** (architecture/checker scaffold exists; keyboard, icon, save-time, screen-reader checkpoints unmet)
- [ ] File 9 — Complete Control Panel — **Partial** (mapping allowlists fixed; structured taxonomy/tokens/performance incomplete)
- [ ] File 10 — Simple/Advanced Panel Modes — **Partial** (hide/filter fixed live; complete tier audit and stress proof absent)
- [ ] File 11 — Right-Click Context Menu + Drag/Nesting Reliability — **Partial** (Shift+F10 fixed; action reuse/deep drag/structural parity unmet)
- [ ] File 12 — Forms (Native + External) + Starter Widget Library — **Partial** (critical native path fixed live; visual/file/external/parity/reusable-widget checkpoints unmet)

---

## What this folder does not cover

Tier 2 items from the original `DEVELOPMENT_PLAN.md` (import from
Elementor/Divi, full Theme Builder equivalent, version history/
rollback, white-label mode) are not addressed by any file in this
folder. They remain deliberately deferred, same as originally planned
— do not pull them forward into this folder's scope without a
separate, explicit decision to do so.

If a future upgrade file is added to this folder, update this README's
Dependency Map and build order accordingly BEFORE building it — do not
let the map go stale. A README that doesn't reflect the actual files
present is worse than no README, since it creates false confidence
about ordering.
