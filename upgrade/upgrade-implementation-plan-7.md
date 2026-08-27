# Upgrade Implementation Plan 7 — SEO Architecture (What This Does and Doesn't Guarantee)

**Purpose**: This file makes technical SEO a structural property of every
page this builder produces, rather than a set of tags a non-expert has
to correctly choose. It corrects an overpromise from an earlier version
of this plan — read the honesty section below before building anything,
because it changes how success here should be measured.

---

## What this file honestly guarantees, and what it does not

**This builder will not be the reason a site fails at SEO.** Every
architectural/technical failure mode within a builder's control — poor
Core Web Vitals from bloated loading, crawlability problems, schema
that contradicts visible content, mobile/desktop content mismatches —
is addressed by this file, largely by extending upgrades already built
for other reasons (conditional loading, versioned caching, the parity-
check system).

**This builder cannot guarantee rankings.** Content quality, relevance,
topical authority, and backlinks are the primary ranking factors across
every source researched, and none of them are something a page builder's
architecture touches. Two sites built with identical technical quality
in this builder can rank completely differently based on content and
authority alone. Do not market or design toward "every site will rank
well" — the honest, defensible claim is "every site will be technically
sound," which is a real, valuable, and true guarantee this architecture
can actually keep.

**A note on Core Web Vitals' actual weight, since sources disagree**:
one source claims Core Web Vitals as "roughly 28% of ranking weight,"
while multiple others frame them explicitly as a tiebreaker rather than
a primary factor - "Performance supports rankings. It does not
substitute for substance." Treat Core Web Vitals as a confirmed,
real, measurable ranking signal worth optimizing rigorously - but not
as a claim that good scores alone will overcome weak content.

---

## Why this file is different from a typical "SEO plugin" approach

Most SEO in page builders is a settings panel where a human types in
tags. This file takes a different approach specifically because your
builder already has something most builders don't: a parser that
understands the actual semantic structure of what's on a page (product
blocks, content slots, service lists) - so schema data can be generated
FROM that structure rather than hand-typed by a non-expert who might
get it wrong. This is the direct answer to the original concern about
non-experts "picking the wrong tags": remove the picking, generate from
what's already true in the block tree.

**Critical dependency, not a suggestion**: auto-generating schema
creates its own new risk - generated data can silently drift out of
sync with the actual page content, the same way the original "wrong
tags" problem existed, just automated instead of manual. This is why
Step 1 (generation) and Step 2 (drift guard) must be built and treated
as ONE dependent unit, not sequenced as a feature followed by an
optional polish item. Do not consider Step 1 done without Step 2.

---

## Step 1 — Automated Schema.org/JSON-LD generation from block structure

```
Add a system that automatically generates Schema.org structured data
(as JSON-LD) from our existing block tree, based on block type and
content - without requiring the person building the page to manually
write or select any schema markup.

Map our existing block types to appropriate schema types:
- A product block (from the WooCommerce upgrade file) generates
  Product schema: name, price, availability, image - pulled directly
  from the block's actual data, not separately entered
- A content-slot-labeled block matching common patterns (address,
  phone number, business hours - relevant to the business-owner
  audience from our industry-list research) generates LocalBusiness
  schema fields
- A page's title/heading structure generates basic Article or
  WebPage schema as appropriate

This generation should happen automatically at save/render time, using
data already present in the block tree - never requiring a separate
manual schema-entry step. Show me the generated JSON-LD output for a
test page containing a product block and a business address in a
content slot, and confirm it validates against Schema.org's own
structure (use Google's Rich Results Test or the Schema.org validator
to confirm).
```

## Checkpoint for Step 1
Confirm the generated JSON-LD is valid schema (passes a real validator,
not just "looks plausible") and accurately reflects the actual block
content, not placeholder or guessed values. Do not proceed to consider
this "done" independent of Step 2 - they ship together.

---

## Step 2 — Schema-drift guard (mandatory companion to Step 1, not optional)

```
Extend our existing editor/frontend parity-check system (from the
first upgrade file) to also verify that generated JSON-LD schema
matches the actual rendered content on the page - catching the
specific failure pattern where "Schema says a product is 'InStock'
but the visual button says 'Sold Out'" because one was updated and the
other wasn't.

Specifically: after generating schema in Step 1, run an automated
check that compares each schema field against the corresponding
rendered DOM value at render time. If they disagree, this should be
treated as an error requiring correction before publish, not a silent
warning - since incorrect schema can actively harm SEO if search
engines learn to distrust a site's structured data.

Demonstrate this by deliberately creating a mismatch (change a
product's stock status via content mode, but simulate a stale schema
cache) and confirming the drift guard catches it and blocks/flags
publish rather than shipping the mismatch.
```

## Checkpoint for Step 2
This determines whether Step 1 is actually safe to ship. If a
deliberately introduced mismatch isn't caught, Step 1 is not complete,
regardless of how well the generation itself works in the happy path.

---

## Step 3 — Mobile-content-parity enforcement (extends the responsive-controls upgrade)

```
Extend our responsive device controls system (from the second upgrade
file) to specifically warn when content visible on desktop has no
equivalent on mobile - not just checking that mobile styling exists,
but that mobile CONTENT parity is maintained, since "Google indexes
the mobile version of every site... whether mobile pages contain the
same content as desktop pages" directly affects indexing.

If a block is hidden on mobile via our existing responsive visibility
controls, and that block contains schema-relevant content (address,
product info, primary heading content), surface a clear warning:
"This content is hidden on mobile and won't be seen by Google's
primary index" - distinct from a purely cosmetic hide-on-mobile choice
that doesn't carry this risk.

Test this by hiding a business's address block on mobile only, and
confirming the warning appears specifically flagging the indexing
implication, not just a generic "hidden on mobile" note.
```

## Checkpoint for Step 3
Confirm the warning is specific enough to be actionable - a developer
or business owner should understand WHY this matters (indexing, not
just cosmetics) from the warning itself.

---

## Step 4 — Basic on-page tags, routed through content mode (the least differentiating layer, but still required)

```
Add title tag, meta description, canonical URL, and Open Graph fields
as content slots (using our existing content-slots system), so they
appear in the same simplified content-mode view a business owner
already uses for their other page content - not a separate, unfamiliar
SEO settings panel.

Provide sensible, clearly-labeled guidance inline (e.g. a character
counter for meta descriptions, a note on what a title tag is for) so a
non-expert can fill these in confidently without needing outside
knowledge - but do not attempt to auto-generate these from content the
way Step 1 does for schema, since title/description quality benefits
from human judgment about what to emphasize, unlike structured
factual data like price or stock status.

Test this in content mode: confirm these fields appear alongside a
page's other editable content, with the guidance visible and useful.
```

## Checkpoint for Step 4
This is real but intentionally the smallest step in this file, matching
the research finding that this layer is "table stakes" - necessary,
not differentiating. Confirm it's simply present, clear, and safely
editable through the existing content-mode system, not over-engineered.

---

## What this file explicitly does not attempt

- Guaranteeing search rankings, for the reasons stated at the top of
  this file
- Keyword research, content strategy, or backlink-building tools -
  these are real SEO disciplines entirely outside a page builder's
  architecture and outside this file's honest scope
- Advanced schema types beyond Product, LocalBusiness, and basic
  Article/WebPage - a real future expansion once these core types are
  proven, not attempted here

## Note for decisions-log.md

Record this file's central architectural insight once built: most of
this builder's SEO strength comes from upgrades already built for other
reasons (Upgrades 1, 2, 3, 6), not from new SEO-specific code. Worth
remembering so future feature work is evaluated with an eye toward
"does this also strengthen SEO as a side effect" rather than treating
SEO as a separate, siloed concern.
