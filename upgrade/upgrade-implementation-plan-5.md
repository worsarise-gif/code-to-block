# Upgrade Implementation Plan 5 — WooCommerce Integration That Heals Real Pain

**Purpose**: This file builds native, deeply-integrated commerce blocks on
top of WooCommerce's actual engine — not a replacement for it (see
decisions-log.md for why: rebuilding payment/order/inventory logic
from scratch was evaluated and explicitly rejected as disproportionate
risk for a solo builder). Every design decision in this file is mapped
to a specific, real pain point found by researching actual WooCommerce
integration bugs across Elementor, Divi, and WooCommerce's own GitHub
issue tracker — not a generic feature checklist.

**Foundational architecture decision, locked before Step 1**: build on
WooCommerce's Blocks-based Cart and Checkout (the Interactivity-API-based
system), not the legacy shortcode/AJAX system. This single choice
structurally avoids the largest bug category found in research — real,
repeated WooCommerce GitHub issues where custom template markup broke
`cart.js` because it depended on specific hardcoded HTML structure
(e.g. a `<table>` element) being present. The newer Blocks system
doesn't carry that same fragile assumption.

---

## The six pains this file addresses, and how each is solved

| # | The real pain, from research | The design response |
|---|---|---|
| 1 | AJAX/markup fragility — custom templates silently breaking cart.js | Build on WooCommerce Blocks (Interactivity API), not legacy shortcodes |
| 2 | Editor/frontend divergence on product data specifically | Extend the existing parity-check system (Upgrade 1) to explicitly cover commerce blocks |
| 3 | Dynamic content bugs still being patched release-by-release | Test against real WooCommerce fixtures before marking complete (extends Upgrade 4) |
| 4 | "Deactivate all plugins one by one" as the default debugging ritual | A dedicated, built-in conflict-diagnostic tool |
| 5 | Business owners stacking 3-4 paid plugins (ACF, CPT UI, dynamic content helpers) just for full functionality | Native product data, custom fields, and variation handling - no external plugin dependency |
| 6 | Non-developer setup friction across multiple disconnected interfaces | Guided in-builder commerce setup + product editing through the existing content-mode view |

---

## Step 1 — Native product display blocks (Layer 1-2, lowest risk, build first)

```
Add native block types for displaying WooCommerce product data: a
single product block (price, title, image, short description, stock
status) and a product grid/loop block (for shop pages, category
pages, "related products").

These blocks should query WooCommerce's actual product data directly
via WooCommerce's own functions/data store - not reimplement product
storage. Style these using our existing style panel system, exactly
like any other block type - full visual customization, standard drag
and drop, standard responsive controls.

Test using a real WooCommerce test install with at least 5 sample
products, including at least one variable product (with real
variations - size, color, etc.) and one simple product. Show me both
block types rendering correctly on the canvas and on the live
frontend, styled distinctly from WooCommerce's own default theme
styling to confirm our style panel actually controls the appearance.
```

## Checkpoint for Step 1
Confirm product data renders correctly for both simple and variable
products, and that styling changes made in our panel actually take
effect - not silently overridden by WooCommerce's own default CSS.

---

## Step 2 — Native Cart and Checkout blocks (Layer 4, the highest-risk layer, build on the resilient foundation)

```
Add native cart and checkout block types, built directly on
WooCommerce's official Cart and Checkout Blocks (Interactivity API
based) - not the legacy [woocommerce_cart] / [woocommerce_checkout]
shortcodes, and not a custom-written add-to-cart AJAX implementation.

Our blocks should provide visual styling and layout control around
WooCommerce's actual Cart/Checkout Block components, the same way our
other blocks wrap and style content - we are not reimplementing add-
to-cart logic, session handling, or checkout processing ourselves.

Specifically test the exact failure pattern found in research: modify
the surrounding markup/layout significantly (different container
structure, custom styling wrapping the cart block) and confirm cart
functionality (add item, remove item, update quantity, apply a test
coupon) still works correctly - this is testing that we've actually
avoided the markup-dependency fragility that broke the legacy system.
```

## Checkpoint for Step 2 — the most important checkpoint in this file
Actually go through a real add-to-cart → view cart → remove item →
re-add → proceed to checkout flow yourself, using our styled blocks,
not WooCommerce's default theme. If anything breaks, silently
misbehaves (item counts wrong, cart not updating without a manual
refresh), or requires disabling our styling to work, this is not done -
this is the exact bug category the whole file exists to avoid, so do
not treat "looks fine at a glance" as sufficient here.

---

## Step 3 — Native custom fields and variations (addresses pain #5 - no external plugin stacking)

```
Add the ability to display and edit WooCommerce product custom fields
and variation attributes natively in our editor, without requiring
ACF or a separate custom-fields plugin. Use WooCommerce's own product
meta system directly.

In the product block's settings panel, allow adding/editing custom
product attributes (e.g. "Material", "Care Instructions") and full
variation management (size/color combinations with individual
pricing/stock per variation) - all within our existing editor
interface, not requiring the person to leave our builder and configure
this in a separate WooCommerce admin screen or a third-party plugin.

Test by adding a new variable product with 2 custom attributes and 4
variations entirely from within our editor, then confirming it appears
correctly on the frontend product block from Step 1.
```

## Checkpoint for Step 3
Confirm a variable product can be fully configured - attributes,
variations, per-variation pricing/stock - without ever needing to open
WooCommerce's own default admin product-edit screen or any third-party
plugin. This is the concrete test of "no external tools needed."

---

## Step 4 — Parity check extension for commerce blocks (addresses pain #2)

```
Extend the automated editor/frontend parity check we built earlier
(from the first upgrade file) to explicitly include commerce blocks:
product price display, variation selection state, and cart contents
should be checked for editor/frontend agreement, the same way we
already check general block styles.

Demonstrate this by deliberately creating a mismatch (e.g. a stale
cached price shown in editor vs. an updated live price) and confirming
the parity warning fires correctly for this commerce-specific case,
not just the general style-mismatch case we tested before.
```

## Checkpoint for Step 4
Confirm the parity system catches a commerce-specific mismatch, not
just generic style mismatches. This directly targets the "on-canvas
styles now match the resolved colors shown on the live site" class of
bug found in Divi's own changelog - proving we catch it automatically
rather than discovering it in production the way they did.

---

## Step 5 — Real-fixture testing before calling commerce features complete (addresses pain #3)

```
Before considering our WooCommerce integration complete, test it
against realistic messy scenarios, not just clean sample data:
1. A product with a very long variation list (10+ variations)
2. A product with an out-of-stock variation mixed with in-stock ones
3. A cart with a mix of simple and variable products plus an applied
   coupon
4. A checkout attempt with an invalid/expired coupon

Report honestly where any of these expose bugs or confusing behavior,
the same way we tested messy fixtures in earlier phases. Fix what's
found before marking this file's core work complete - the goal is
catching this now, in a small controlled test, rather than the pattern
we saw in Divi's own changelog of patching dynamic-content bugs
release after release, months after shipping.
```

## Checkpoint for Step 5
All four scenarios handled correctly, or honestly documented as a
known limitation if not fully solvable in this pass - never silently
shipped as "working" without this specific testing having happened.

---

## Step 6 — The conflict-diagnostic tool (addresses pain #4 — a genuinely new, standout feature)

**This is the part that directly answers "heal the ache" rather than
just avoiding new pain.** Every single WooCommerce GitHub issue found
in research required the same manual ritual: deactivate all other
plugins, switch to a default theme, reactivate one at a time, to
isolate whether a bug is theirs, WooCommerce's, or a conflict. This
tool automates that ritual instead of leaving developers to do it by
hand every time.

```
Build a diagnostic tool, accessible from within our dedicated editor
environment, that helps identify whether a commerce-related problem is
caused by a plugin conflict - without requiring the manual
deactivate-everything ritual that WooCommerce's own bug reports show
developers repeating constantly.

Specifically:
1. Detect and list all active plugins alongside WooCommerce and our
   builder, flagging any known-common conflict patterns (e.g. plugins
   that also hook into cart AJAX, session handling, or checkout - the
   same category of plugin implicated in the research we found)
2. Offer a safe, reversible "isolation test" mode: temporarily disable
   other plugins' effects on a single test page/preview only (not
   site-wide, not affecting the live site), render our cart/checkout
   blocks in that isolated context, and compare behavior against the
   normal (non-isolated) rendering
3. If behavior differs between isolated and normal rendering, surface
   this clearly: "This may be caused by a conflict with [plugin name]"
   rather than requiring the developer to manually guess and test each
   plugin one at a time
4. This must be genuinely safe - it should never actually deactivate
   plugins on the live site or affect real visitors, only provide an
   isolated diagnostic view for the developer

Show me this working: introduce a deliberate test conflict (a small
test plugin that interferes with cart behavior in an obvious way),
confirm the diagnostic tool correctly flags it without requiring
manual one-by-one plugin deactivation.
```

## Checkpoint for Step 6
This is the standout feature of this whole file, so hold it to a high
bar: does using this tool genuinely feel faster and less painful than
the manual process described in every WooCommerce bug report we found?
If a developer would still end up manually deactivating plugins anyway
because the tool's flagging isn't reliable or clear enough, this needs
more work before being considered done.

---

## Step 7 — Guided setup and content-mode integration (addresses pain #6)

```
Build a guided, in-builder commerce setup flow for first-time
configuration (connecting a payment method via WooCommerce's own
settings, setting up basic tax/shipping zones) - presented within our
editor's interface rather than requiring the person to navigate
WooCommerce's own separate settings screens to get started.

Then confirm that product content (price, description, images) added
via our Step 1 blocks is properly exposed as editable slots in the
"content mode" simplified view we built in the content-slots upgrade
file - so a business owner managing their own shop's product
descriptions and prices can do so through the same simple, safe
interface as their other page content, without touching structural
editing or WooCommerce's own admin screens directly.

Test this as a business owner would: update a product's price and
description entirely through content mode, confirm the change reflects
correctly on the live product block from Step 1.
```

## Checkpoint for Step 7
A non-technical business owner persona test: can product content be
updated without ever seeing WooCommerce's own admin interface or our
full structural editor? If yes, this genuinely closes the loop on
"packaged, no other tools needed" - achieved through integration depth,
not through rebuilding WooCommerce's engine.

---

## Suggested order

Steps 1 → 2 → 3 are the core functional build, in that order (lowest
risk to highest risk). Step 4 and 5 are verification passes that should
happen as each preceding step is completed, not saved entirely for the
end. Step 6 (the conflict tool) can be built in parallel with Steps 1-3
once the basic block architecture exists, since it's a diagnostic layer
observing the same blocks, not dependent on all of them being finished
first. Step 7 comes last, since it depends on Steps 1 and 3 (product
blocks and custom fields) being in place.

## What's still explicitly out of scope

Subscriptions, complex multi-vendor marketplace functionality, and
advanced shipping-rate calculators remain real future possibilities but
are not part of this file - each would need its own research pass into
what specifically causes pain in existing solutions, the same
discipline used to scope this file, rather than being added speculatively.
