# How to use this folder

Each file in here is one phase of building your WordPress builder plugin,
written as literal messages you can copy and paste into OpenCode.

## The one rule that matters more than anything else in these files

**Open and use only one phase file at a time.** Each file ends with a
checkpoint telling you what to check before opening the next one. Do not
skip ahead, even if a later phase looks more interesting — the earlier
phases exist specifically to catch problems while they're still cheap to
fix.

## The order

1. `phase-0-prove-the-parser.md` — start here, always
2. `phase-1-lock-the-schema.md`
3. `phase-2-plugin-plumbing.md`
4. `phase-3-minimum-editor.md` — this is where the real product first exists
5. `phase-4-frontend-render.md`
6. `phase-5-round-out-tier-0.md`
7. `phase-6-dogfood-and-security.md` — build a real page yourself, then a
   dedicated security pass; don't merge these two
8. `phase-7-tier-1-features.md`
9. `phase-8-launch-prep.md`

## Current progress

Phases 0 through 6 and Phase 7 Items 1 through 7 are complete. Phase 7 evidence
is in `phase-7-testing.md`. The next gated step is `phase-8-launch-prep.md`.

## How each file works

Every file has:
- A short explanation of what that phase is actually for
- One or more ready-to-paste messages for OpenCode
- A checkpoint: something concrete for *you* to check yourself, not just
  trust that it worked
- A clear "if this fails, do this" instruction, and a clear "if this
  passes, open this next file" instruction

## What to do if something breaks mid-phase

Stay in that phase. Tell OpenCode exactly what you saw (paste the actual
output, don't summarize it) and let it fix that specific thing before
continuing. Don't move to the next phase file hoping a later step will
fix an earlier problem — it won't, and it'll be harder to trace later.
