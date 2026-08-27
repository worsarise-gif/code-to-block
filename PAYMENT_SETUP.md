# Payment Setup — Pro and Agency tiers

This is `phase-8-launch-prep.md:40` Step 3. Only do this if you want to launch paid tiers **alongside** the free wordpress.org tier. The checkpoint is `phase-8-launch-prep.md:49`: “If launching paid tiers at the same time, checkout should work end to end, tested by yourself with a real (test-mode) purchase.” Free tier is already “genuinely ready to submit” without this (`USER_GUIDE.md`, `WP_ORG_SUBMISSION_PREP.md`).

## Choice: Stripe vs Paddle

* **Stripe** — you handle tax yourself, you host the license server, you keep full control. Best if you want simple `price_xxx` + webhook + `edd_sl`-style license table. You must handle EU VAT yourself or use Stripe Tax.
* **Paddle** — Merchant of Record, handles VAT, invoicing, compliance. Best if you want to avoid tax complexity. They handle the checkout and you validate their webhook. Fees higher.

Below is a Stripe setup that works for a WordPress plugin. Swap to Paddle at the webhook step if you prefer — the plugin-side license check is identical.

## Option A — fastest path (recommended for this codebase)

Use **Stripe + a tiny license server** (could be a 30-line Cloudflare Worker or a small `licenses` table on your own site) and the free tier’s add-on pattern (`#6` serviceware). The free plugin on wordpress.org **never** contains premium code; premium features ship as a separate add-on plugin hosted outside wordpress.org (e.g., `code-to-block-pro.zip` served from your site). This satisfies `#5` trialware — functionality in the free zip is not locked behind payment.

### Stripe setup (test mode first, every time)

1. Create products in https://dashboard.stripe.com/test/products :
   * `Code to Block — Pro` — `price_pro_monthly` and `price_pro_yearly` (and optionally `price_pro_lifetime`)
   * `Code to Block — Agency` — `price_agency_monthly` / `price_agency_yearly`
   * Keep IDs. You will reference them in your checkout session.

2. Create a Checkout Session endpoint on your license server. Minimal example (Node/Worker):
   ```js
   // POST https://licenses.yourdomain.com/create-checkout
   // body: { priceId, email, siteUrl }
   const session = await stripe.checkout.sessions.create({
     mode: price.recurring ? 'subscription' : 'payment',
     line_items: [{ price: priceId, quantity: 1 }],
     customer_email: email,
     success_url: `https://yourdomain.com/thanks?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `https://yourdomain.com/pricing`,
     allow_promotion_codes: true,
     metadata: { priceId, siteUrl }
   });
   ```

3. Webhook: `checkout.session.completed` → create license.
   * Endpoint: `POST https://licenses.yourdomain.com/webhook` — verify `Stripe-Signature` with `stripe.webhooks.constructEvent`.
   * On `checkout.session.completed` and later `invoice.paid` / `customer.subscription.deleted`, upsert a row in `licenses`:
     ```
     licenses { key CHAR(26), email, price_id, stripe_customer_id, stripe_subscription_id, status ENUM('active','canceled'), created_at, expires_at }
     ```
   * Generate the key: `crypto.randomUUID()` or `base62(16 bytes)` + checksum, e.g., `ctb_7f3a9c…`. Store hashed if you want, but for v1 plain is fine with `0600` and rate limiting. Return the key in the `thanks` page and by email (via Stripe’s receipt + your own email via Postmark/Resend).

4. License verification endpoint for the plugin:
   ```
   POST https://licenses.yourdomain.com/verify
   body: { key, siteUrl }
   response: { valid: true, tier: "pro", expires_at: "2027-08-21T00:00:00Z" }
   ```
   Validate `siteUrl` optionally (allow 1 site for Pro, 25 for Agency). Rate-limit by IP and key.

### Plugin side (free tier + pro add-on split)

In the free tier (`plugin/code-to-block/code-to-block.php:17`), keep:

```php
define('CODE_TO_BLOCK_VERSION', '0.11.0');
define('CODE_TO_BLOCK_PRO_VERSION', '0.1.0'); // in pro add-on only
```

Do not put premium controls in the free zip. Instead:

* Free tier adds a filter: `apply_filters('code_to_block_is_pro', false)` and checks it before rendering premium controls (future `upgrade-implementation-plan-9.md` controls). Free shows an upsell notice inside the editor (`#11` allows upsell on the plugin’s own page, sparingly) with a link to `https://yourdomain.com/pricing` — no dashboard-wide nag.
* Pro add-on plugin `code-to-block-pro/code-to-block-pro.php`:
  ```php
  add_filter('code_to_block_is_pro', '__return_true');
  add_action('admin_init', function() {
    $key = get_option('code_to_block_pro_license_key');
    $status = get_option('code_to_block_pro_license_status');
    // verify on schedule, cache for 12h in transient
  });
  ```
* Settings page `Settings → Code to Block → License` — one field `License key`, button `Activate`, status `Active / Expired / Invalid` via `wp_remote_post` to `https://licenses.yourdomain.com/verify`. Cache the result in a transient, never block the editor if the license server is down (fail open with cached status, show admin notice only).

### Activation flow a user sees

1. User installs free `Code to Block` from wordpress.org. It works fully for core Tier 1 without a key.
2. Pricing page `https://yourdomain.com/pricing` → Stripe Checkout (test mode) → success → `thanks?session_id=cs_test_…` shows license key and emails it.
3. User installs `code-to-block-pro.zip` (from your site, not wordpress.org — `#8` forbids serving updates from outside wordpress.org for the free plugin, but a separate add-on hosted outside is explicitly allowed per `#6`).
4. User pastes key in `Settings → Code to Block → License` → `Activate` → `Active`. Premium controls appear.

## Option B — Paddle

Same plugin split, but checkout is `Paddle.CreateCheckout` and webhook is `transaction.completed` / `subscription.activated`. Validate `Paddle-Signature`. Paddle handles VAT; you still create and verify the same `licenses` row.

## What to test before you call Step 3 done

* Create a Stripe test product/price, run a `4242 4242 4242 4242` test purchase yourself, get a key, paste it in a fresh local WP (the `ctb-phase4-wp` container works: `http://localhost:8090/wp-admin/post.php?post=32&action=edit` + Settings page), see `Active`, see premium control appear, revoke the key server-side, see `Expired` after cache expiry.
* Test cancel and refund webhooks update `status` and the plugin reflects it.
* Test without a key: free tier still saves/loads, no premium control visible, no nag outside the plugin’s page (`#11`).
* Document in `readme.txt` under `== Upgrade Notice ==` and `== Frequently Asked Questions ==`: “Where do I enter my license?”, “What happens if the license server is unreachable?” (answer: cached status is used, no data loss).

## What not to do now

* Do not put Stripe secret keys in the plugin. All `sk_live_` handling stays server-side on `licenses.yourdomain.com`.
* Do not phone home without consent (`#7`). License verification is an explicit opt-in (user pasted a key and clicked Activate). Document it in the readme privacy section.
* Do not lock core Tier 1 behind a key (`#5`). The free tier must remain the complete v1 you just built. Only future `upgrade/*` controls that are genuinely premium may be gated.

---

If you want, I can scaffolding the `code-to-block-pro` add-on (settings page, `verify` client, 12h transient, `code_to_block_is_pro` filter) and a minimal Cloudflare Worker for `create-checkout` + `webhook` + `verify` so you can run a test-mode purchase today. Otherwise, this doc plus `WP_ORG_SUBMISSION_PREP.md` satisfies `phase-8-launch-prep.md:40` Step 3 as guidance and free tier remains ready to submit as-is.
