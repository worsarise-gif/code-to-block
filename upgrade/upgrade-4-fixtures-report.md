# Upgrade 4 — Broader fixtures honest report

This is the `upgrade/upgrade-implementation-plan.md:135` checkpoint: run a WooCommerce-like view-source and an ACF dynamic-value snippet through the full pipeline and report honestly where it breaks.

Executed live in `http://localhost:8090/wp-admin/post.php?post=35&action=edit` (ctb_page `upgrade-fixtures`) on v0.12.0, same steps as Phase 0.

## Fixture A — WooCommerce product page (simplified view-source)

**HTML pasted:**
```html
<div class="product type-product">
  <div class="woocommerce-product-gallery">
    <img src="product.jpg" alt="Product image"><img src="thumb.jpg" alt="Thumb">
  </div>
  <div class="summary entry-summary">
    <h1 class="product_title entry-title">Woo Sample Product</h1>
    <p class="price"><span class="woocommerce-Price-amount">$29.00</span></p>
    <div class="woocommerce-product-details__short-description"><p>Short description with <strong>features</strong>.</p></div>
    <form class="cart"><div class="quantity"><input type="number" value="1"></div><button type="submit" class="single_add_to_cart_button">Add to cart</button></form>
  </div>
</div>
```

**CSS pasted:**
```css
.product { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; max-width: 1000px; margin: 0 auto; }
.woocommerce-product-gallery { display: grid; gap: 12px; }
.summary { display: flex; flex-direction: column; gap: 16px; }
.price { color: #111827; font-size: 24px; font-weight: 700; }
.single_add_to_cart_button { background: #7f54b3; color: white; padding: 12px 24px; border-radius: 4px; display: block; }
@media (max-width: 768px) { .product { grid-template-columns: 1fr; } }
```

**Result — honest breakage:**
* Parse failed with `HTML contains unsupported <form> markup.` (`class-code-to-block-schema.php:30` `HTML_TAGS` allowlist does not include `form`, `input`, `select`, `textarea`). The canvas stayed on the previous `Pricing card` and no blocks were created. No CSS warnings were surfaced because the HTML gate fails before `resolveStyles`.
* This is a real WooCommerce gap: the add-to-cart form is central to a product page, but Code to Block’s v1 tag allowlist is intentionally narrow for security. A user would need to simplify the form to a `div`/`button`/`a` representation before import, or we would need to add `form`/`input` to the allowlist with careful attribute filtering (follow-up decision, not done here).
* If the HTML is simplified to `div` instead of `form`/`input` (re-tested with `<div class="cart"><div class="quantity"><span>1</span></div><a class="single_add_to_cart_button">Add to cart</a></div>`), parse succeeds. Then the CSS produces the expected `Unsupported rule skipped: @media (max-width: 768px)` warning, and the grid/flex declarations (`display: grid`, `grid-template-columns`, `gap`, `flex-direction`) are preserved correctly but **only as raw CSS** (`custom_css_fallback`) since none of `display`/`gap`/`grid-*`/`flex-*` are in `MAPPED_STYLE_PROPERTIES` (`custom-css.mjs:14`). The responsive `@media` being skipped means the mobile single-column fallback would not apply on the live site — the product would stay two-column at 768px unless the user recreates that breakpoint via the sparse `responsive_overrides` controls. That matches the known “media queries are warnings, not preserved” behavior documented in `USER_GUIDE.md:1`.

**What still works:**
* `img`, `h1`, `p`, `span`, `strong`, `div`, `a`, `button` all parse and retain classes/attributes. Mapped `color`, `font-size`, `font-weight`, `padding`, `margin`, `border-radius` go to controls; `display`, `gap`, `grid-*`, `flex-*`, `max-width` go to raw fallback and render correctly in both editor and frontend (verified via `buildPreviewStyles` vs `Code_To_Block_Renderer::generate_css` parity, now checked automatically).

## Fixture B — ACF dynamic value placeholder

**HTML pasted:**
```html
<section class="acf-price"><h2>Product Details</h2><p>Price: [acf field="price"]</p><p>Location: [acf field="location"]</p><p>Custom: <?php echo get_field('custom'); ?></p></section>
```
**CSS pasted:**
```css
.acf-price { padding: 24px; background: #f9f9f9; }
.acf-price h2 { color: #111; font-size: 22px; }
.acf-price p { color: #333; line-height: 1.6; }
```

**Result — honest breakage / confusing but intentional:**
* Parse succeeded. Canvas showed (`main "Rendered block canvas"`):
  * `h2 · h2-2 Product Details`
  * `p · p-3 Price: [acf field="price"]`
  * `p · p-4 Location: [acf field="location"]`
  * `p · p-5 Custom: [ctb_php_35_e065be45fa2bdcc7]`
* `[acf field="price"]` and `[acf field="location"]` were preserved **verbatim as text nodes** (`p-3`, `p-4`). They were not treated as PHP and not extracted. On the live site `Code_To_Block_Renderer::render_block` outputs that text via `Code_To_Block_Shortcodes::render_text`, which does not run `do_shortcode` for non-`ctb_php` tags. So the public page would literally show “[acf field="price"]” rather than the ACF field value — confusing if the user expected dynamic ACF rendering. This is by design for v1 (only `ctb_php_*` placeholders are dynamic), but it is not obvious in the editor; the canvas gives no hint that the shortcode is inert.
* `<?php echo get_field('custom'); ?>` was correctly extracted to `phpDetections[0]` with tag `ctb_php_35_e065be45fa2bdcc7` and shown under **Detected PHP** with the warning `get_field() is not on the scanner's narrow reviewed-function list.` No **Confirm and register** control was offered (expected: `php-scanner.php` allowlist is narrow, `get_field` is WordPress/ACF-specific and not in it). The placeholder `[ctb_php_35_…]` appeared in the canvas as `p-5`. This matches the intended “strong warning, no registration” path for unknown ACF helpers.
* CSS parsed with no warnings; `padding`, `color`, `font-size` mapped to controls, `background`, `line-height` preserved as raw. No parity warnings after save (`parity: []`).

## What this means for the product

* WooCommerce-style product pages **cannot be pasted directly** without first simplifying `form`/`input`/`select` to supported tags. This is the same class of “real-world HTML contains tags we don’t support” that Phase 0 was meant to surface. It is not a regression, but it is a real integration friction that would still surface release-after-release if we claimed WooCommerce compatibility without fixing the allowlist or providing a transform.
* ACF-style shortcodes are harmlessly preserved but inert — not dynamic. A user expecting `[acf field="price"]` to become live data will be confused. A future content-slots or dynamic-content system (File 4) should explicitly route such placeholders through a content-mode view rather than leaving them as literal text.
* The pipeline as a whole did not crash, did not execute PHP, and did not misclassify the ACF shortcodes as executable. The warnings that did appear (`unsupported <form>`, `get_field not allowlisted`, `@media` skip when form is removed) are the correct, narrow warnings — not silent failures.

No code change is made for this report beyond documenting the honest behavior; the allowlist and scanner remain intentionally narrow for v1.
