# Upgrade Implementation Plan 15 — Shape-Aware Skeleton Loaders

**Purpose**: Add skeleton loading placeholders that reflect the actual
shape of the content they're replacing, derived directly from data our
schema already stores — not a new system, a thin rendering layer over
the content-slots system from File 4.

**Tier placement, decided deliberately**: Free tier, not Pro. This is
baseline UX craftsmanship, not a premium capability - it requires no
new infrastructure or ongoing cost, and gating it would work against
the trust-building purpose the Free tier already serves (a site that
looks janky while loading, on the tier meant to build trust, actively
undermines that goal).

**Why shape-aware over generic shimmer, decided deliberately**: our
schema already stores `slot_content_type` (text, rich_text, image,
link) on every content slot, from File 4. A generic shimmer would
throw away information we already have. Shape-aware skeletons are
cheaper to build well BECAUSE of that existing data, not despite it -
this is a case where the more polished option is also the more
efficient one to build, given our architecture.

---

## Step 1 — Map content types to skeleton shapes

```
Define a skeleton shape for each existing slot_content_type from our
schema (File 4):
- "text" -> a single rounded-rectangle bar, width roughly matching
  typical short text
- "rich_text" -> multiple stacked bars of varying width, mimicking
  paragraph line lengths (e.g. 3 lines, last line shorter)
- "image" -> a rectangle matching the image block's actual aspect
  ratio/dimensions if known, otherwise a sensible default ratio
- "link" (e.g. a button) -> a single rounded-rectangle bar sized like
  a typical button, not a full-width bar

Also define a shape for structural container blocks (not slots
themselves, but their layout): a container should show its child
skeletons in the same layout arrangement (flex/grid) it will actually
use once loaded, using the layout controls already defined in the
control-panel upgrade files - not a generic stacked list regardless of
actual layout.

Show me this mapping applied to our existing pricing-card and
testimonial-card examples from earlier files - confirm the resulting
skeleton for each genuinely resembles the real component's shape, not
a generic placeholder.
```

## Checkpoint for Step 1
Compare a skeleton side-by-side with its real, loaded component -
would someone recognize "this is about to be a testimonial card" from
the skeleton alone, or does it look like an undifferentiated gray box?
The former is the goal.

---

## Step 2 — Apply the shimmer/animation effect, subtly

```
Add a subtle shimmer animation to skeleton placeholders (a soft,
slow-moving gradient sweep is the standard pattern) - using CSS only,
no JS library needed for this, consistent with our existing principle
of using CSS-native solutions wherever they suffice (from the
animation/conditional-loading upgrade file's classification system -
this is squarely a "css_native" case, should never trigger a GSAP
load).

Keep the effect restrained: slow, low-contrast, not distracting -
consistent with the "accent colors sparingly, nothing screams" visual
principle already applied in the recent UI overhaul files.
```

## Checkpoint for Step 2
Confirm this uses zero JS and never triggers any conditional asset
loading - check the network tab the same way we verified this for
GSAP in the animation upgrade file's checkpoint.

---

## Step 3 — Wire skeletons into actual loading states

```
Apply these skeletons wherever content is genuinely loading:
1. In the editor, when a page's block tree is being fetched (Phase 2's
   REST load route) - show skeletons matching the previously-saved
   structure if available, or a sensible generic layout if this is a
   brand new page
2. On the live frontend, for any content that loads asynchronously
   (e.g. a product block from the WooCommerce upgrade file fetching
   live price/stock data) - show the shape-aware skeleton until real
   data arrives, then swap in seamlessly
3. Specifically for images and videos - these are typically NOT
   backend/PHP round-trips, they're direct file/network loads, and are
   very often the slowest-loading elements on a real page (large image
   files, embedded video players). Every image and video block should
   show its shape-aware skeleton (matching its actual declared
   dimensions/aspect ratio) for the entire duration the browser is
   still downloading that file - this is a pure frontend concern, using
   the browser's native image/video load events, not a new backend
   call of any kind

Test on a real WooCommerce product block: throttle network speed in
browser dev tools to simulate a slow connection, and confirm the
skeleton appears with the correct product-block shape, then smoothly
transitions to real content once loaded - no layout shift when the
swap happens (the skeleton's dimensions should match the real
content's dimensions closely enough that nothing jumps).

Separately, test on a page containing a large image and an embedded
video: throttle network speed heavily, and confirm both show their
skeleton for the full download duration rather than a blank space or a
broken-image icon flash before the real content appears.
```

## Checkpoint for Step 3
This "no layout shift" detail matters for a reason beyond aesthetics -
check this against Cumulative Layout Shift (CLS), one of the Core Web
Vitals metrics named in the SEO upgrade file. A skeleton that doesn't
match its real content's dimensions would actively hurt CLS scores,
undermining the SEO architecture built earlier rather than supporting
it.

---

## What this file does NOT need to build

No new schema fields beyond what File 4 already defined. No new
loading-state management system - this hooks into loading states that
already exist (the REST fetch from Phase 2, async data fetching from
the WooCommerce file) rather than inventing new ones.

## Note for decisions-log.md

Record the decision to keep this in Free tier and the reasoning (a
loading-state polish detail, not a premium capability, and gating it
would undermine Free tier's trust-building purpose) - worth protecting
if a future pricing review considers moving polish features behind a
paywall without re-examining this specific reasoning.
