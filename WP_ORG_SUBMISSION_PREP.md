# WordPress.org Submission Prep — Code to Block

**Read with:** https://developer.wordpress.org/plugins/wordpress.org/detailed-plugin-guidelines/ (fetched 2026-08-21, last updated March 11 2026) and your current `plugin/code-to-block/readme.txt:1` + `plugin/code-to-block/code-to-block.php:1`.

## What WordPress.org actually requires

A submission is a zip that contains a complete, runnable plugin at the time of review (`#16`). Review is on the zip, not on SVN trunk later.

### 1. Required files and headers

* **Plugin header** in the main PHP file (`code-to-block.php:2-10`) — must have `Plugin Name`, `Description`, `Version`, `Requires at least`, `Requires PHP`, `Author`, `License` (`GPLv2 or later` recommended), `Text Domain`. You already have these, and they match `CODE_TO_BLOCK_VERSION:17`.
* **readme.txt** at the plugin root — must parse as WP.org’s readme format. WP.org’s validator expects at minimum:
  ```
  === Plugin Name ===
  Contributors: (wordpress.org usernames, not display names)
  Tags: (1–5, no spam, no competitor names per #12)
  Requires at least: 6.5
  Tested up to: 6.8
  Requires PHP: 7.4
  Stable tag: 0.11.0
  License: GPLv2 or later
  License URI: https://www.gnu.org/licenses/gpl-2.0.html
  ```
  Then sections `== Description ==`, `== Installation ==`, `== Frequently Asked Questions ==`, `== Screenshots ==`, `== Changelog ==`, `== Upgrade Notice ==` where applicable. The parser is strict about `===` and `==` markers.
* **License compatibility** (`#1`): Every file, image, library (including `postcss`, `zustand`, `@dnd-kit`, `specificity`) must be GPL-compatible. Document their licenses and source links in the readme. Your `package.json:22-28` lists them; keep that list in the readme under a `== Third-Party Libraries ==` note.
* **Human-readable code** (`#4`): Built `build/index.js` is minified but source is included in `src/` and build is reproducible via `npm install && npm run build` (`readme.txt:33`). That satisfies #4 if you keep source in the zip and document the build step. Do not ship `node_modules` in the zip.
* **Versioning** (`#15`): Bump `Stable tag` and `Version` together for each release. You do (`0.11.0` in both). SVN: `trunk` is latest, `tags/0.11.0` is the stable tag, `assets/` holds `banner-772x250`, `icon-128x128`, `screenshot-*.jpg`.

### 2. Readme fixes needed before you submit

Your current `readme.txt` is functional but will be flagged as incomplete. Fix before first submit:

1. **Contributors**: replace `code-to-block` placeholder with real wordpress.org usernames.
2. **Tags**: pick 1–5, no spam (`#12`). Example: `page builder, blocks, css, landing page, gutenberg`. Do not use `elementor` or `divi` as tags.
3. **Sections to add:**
   * `== Installation ==` — “1. Upload to `/wp-content/plugins/` 2. Activate 3. Create Code to Block Page 4. Paste HTML/CSS 5. Save”.
   * `== Frequently Asked Questions ==` — include: “Does this execute my JavaScript?” (answer: only narrow click patterns after explicit confirmation; otherwise preserved as never-executed), “Does this run my PHP?” (answer: only after explicit `REGISTER …` phrase and only `manage_options` + `unfiltered_html` on the owning page), “Where is the data stored?”.
   * `== Screenshots ==` — number your committed screenshots and describe each. You already have `phase-7-*.png`; copy them to `assets/` as `screenshot-1.png` etc. for the directory.
   * `== Changelog ==` — list `0.11.0`, `0.10.0`, etc. with plain changes.
   * `== Upgrade Notice ==` if any migration is needed (none for v1).
4. **Privacy policy**: you do not track users without consent (`#7`). State that explicitly: “Code to Block does not contact external servers or collect personal data.” If you later add Stripe/Paddle, document what they collect and link to their terms.

### 3. Guideline audit — what will be questioned

#### PHP code-execution shortcode (needs flag before submit)

* **What the guideline says:** `#8` forbids executing outside code via a third-party system, and `#9` forbids dishonest/illegal behavior. There is no explicit “no PHP execution” line in the public 18 guidelines, but the plugins team *in practice* treats arbitrary PHP execution as high-risk and will scrutinize it. Plugins that do allow it and are in the directory (e.g., Code Snippets) only pass because they: require `manage_options`, require `unfiltered_html`, are disabled when `DISALLOW_FILE_EDIT`/`DISALLOW_FILE_MODS` is set, never auto-execute on import, and document the risk. You already implement all of those (`includes/class-code-to-block-shortcodes.php`, `src/php-snippets.mjs:119`, `php-scanner.php:11`).

* **What reviewers will flag in your current implementation and what to change before submit:**
  * **Enable-by-default vs disabled-by-default.** Right now `canRegisterPhp` is true for any `administrator` with `unfiltered_html` on a `ctb_page`. Reviewers may ask for a site-wide opt-in constant or setting, default off. Recommended: gate the entire shortcode feature behind a constant, e.g., `define('CODE_TO_BLOCK_ALLOW_PHP', true);` in `wp-config.php`, or a Settings checkbox default off. Document it in the readme as “PHP execution is disabled by default; enable only if you understand the risk.”
  * **Temporary file execution.** You write `<?php … ?>` to a temp file outside `ABSPATH` and include it (`includes/class-code-to-block-shortcodes.php`). Document that the file is permission `0600`, immediate `unlink`, never in uploads or document root. Keep it. Be ready to show the code path in review notes.
  * **Scope.** You already limit execution to the current singular `ctb_page` and to exact bare `[ctb_php_…]` in text nodes — not attributes, not other pages, not drafts. Keep that; reviewers will check `do_shortcode` usage and `register_runtime` scoping. Your `blocks-contains-page-shortcode` rejection for components is correct.
  * **Error handling and logging.** Ensure no PHP errors are written to a public location and that `error_log` is not reachable via your scanner bypass (you block `error_log:46` in `php-scanner.php:46`). Good.

* **If you want zero-risk submission for the free tier:** submit the free tier with PHP registration *disabled* (remove the shortcode path from the zip, or ship it with `CODE_TO_BLOCK_ALLOW_PHP` default false and no UI). The tier is still honestly “genuinely ready to submit” (`phase-8-launch-prep.md:49`) because its core value (HTML/CSS → blocks, styles, tokens, components, templates) does not depend on PHP. Keep the PHP feature in a separate pro add-on hosted outside wordpress.org (`#5` trialware vs `#6` serviceware). That avoids any “arbitrary code execution” debate in the initial review.

#### Other checks that currently pass

* **No tracking without consent (`#7`):** No external calls, no `wp_remote_*` on frontend, no analytics. Good.
* **No executable code via third party (`#8`):** You do not load JS/CSS from CDNs, you bundle locally (`build/index.js`, `assets/runtime.js`). Good.
* **No hijack of admin (`#11`):** Notices are via `setPersistenceStatus` inside the editor shell, not site-wide admin notices. Good.
* **No external links on public site without opt-in (`#10`):** Your public `ctb_page` template adds no “Powered by”. Good.
* **Use of WordPress libraries (`#13`):** You use `jquery-core` via WP’s `admin_enqueue_scripts`, not a bundled copy. Good.
* **Code readability (`#4`):** Source in `src/` is readable; `build/` is documented. Good.
* **Spam/readme (`#12`):** No affiliate links or keyword stuffing. Good.
* **GPL (`#1`):** Header is `GPL-2.0-or-later`, compatible. Keep third-party license list in readme.

### 4. Submission mechanics (what to actually do)

1. Ensure zip contains: `code-to-block.php`, `includes/`, `templates/`, `build/`, `assets/runtime.js`, `readme.txt`, `LICENSE` (copy of GPLv2). Exclude `node_modules/`, `tests/`, `samples/`, `.git/`.
2. Validate readme with the WP.org validator: https://wordpress.org/plugins/developers/readme-validator/ (or `npx wp-readme-validator` if available). Fix any “Contributors” or “Stable tag” mismatches.
3. Create a wordpress.org account, go to https://wordpress.org/plugins/developers/add/ , upload the zip. You will get an SVN repo at `https://plugins.svn.wordpress.org/code-to-block/`.
4. Initial commit:
   ```
   svn co https://plugins.svn.wordpress.org/code-to-block/ code-to-block-svn
   cp -R plugin/code-to-block/* code-to-block-svn/trunk/
   svn add code-to-block-svn/trunk/*
   svn ci -m "Initial submission 0.11.0"
   svn cp https://plugins.svn.wordpress.org/code-to-block/trunk https://plugins.svn.wordpress.org/code-to-block/tags/0.11.0 -m "Tag 0.11.0"
   ```
5. After approval, each release is `trunk` edit + `tags/x.y.z` copy (`#15`). Avoid frequent trash commits (`#14`).

### 5. Recommendation for your setup

You read the guidelines directly as requested above. For the free tier you want to submit, the only blocking issue is the PHP shortcode. Either:

* **Option A (fastest to approval):** Ship free tier with PHP disabled by default (constant `CODE_TO_BLOCK_ALLOW_PHP` false, no UI). Document it in `USER_GUIDE.md:3` and `readme.txt` as “PHP execution is an optional pro feature, disabled in the wordpress.org version.” Review then sees no arbitrary execution in the zip.
* **Option B (keep PHP in free tier):** Ship as-is but add `CODE_TO_BLOCK_ALLOW_PHP` default false, require explicit opt-in, keep all current caps (`manage_options` + `unfiltered_html` + `DISALLOW_FILE_EDIT` guard), and include a 4-sentence review note that points reviewers to `includes/class-code-to-block-php-scanner.php:21` blocked list, `includes/class-code-to-block-shortcodes.php` temp-file handling, and `src/php-snippets.mjs:119` tag-scoping. Expect a longer review and be ready to move it to an add-on if asked.

Both satisfy `#5` (no trialware — functionality is not locked behind payment in the free zip; PHP is either not present or explicitly opt-in, not a trial).

## What you should do next (Step 3 is optional)

* If you are launching paid tiers alongside free, see `USER_GUIDE.md` step 3 in the next file — Stripe/Paddle setup is not required for wordpress.org submission itself (`phase-8-launch-prep.md:39`). You can submit the free tier first.

---

This prep satisfies `phase-8-launch-prep.md:24` Step 2. Do not submit until `readme.txt` sections and the Contributors/tags fixes above are applied and the zip validates locally.
