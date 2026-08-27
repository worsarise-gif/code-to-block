# Upgrade Implementation Plan 6 — Native Caching (Without the Pain)

**Purpose**: This file addresses three genuinely distinct caching failure
categories found in research across Elementor and Divi's own support
documentation and bug reports. Treating "caching" as one problem was
the wrong frame - each category needs a different fix, and conflating
them is likely why competitors still struggle with all three
simultaneously.

**The core technical decision, validated against independent industry
sources (not just competitor behavior)**: for our own generated CSS
files, use content-hash versioned filenames (e.g. `page-42-a1b2c3d4.css`)
rather than regenerating at a fixed filename/path. This isn't just our
preference - multiple independent sources converge on this as the
established best practice, specifically because it eliminates the
staleness/corruption failure category entirely rather than managing it:
"a new URL is unknown to every edge cache, so the CDN fetches the
current file from origin without any manual purge... different filename
= different cache entry = guaranteed fresh fetch." This directly targets
the exact failure described in Elementor and Divi's own documentation,
where regenerating a file at a *fixed* path left a window for staleness
or corruption.

---

## The three failure categories, and why they need separate fixes

| # | Failure, from research | Root cause | Fix |
|---|---|---|---|
| 1 | Editor breaks entirely under external caching plugins - "buttons don't respond, widgets won't drag" | External cache plugins don't know the editor route should never be cached | Explicit no-cache signaling on our dedicated editor environment |
| 2 | The builder's own generated CSS goes stale or corrupts - "sudden loss of all custom styling" | Regenerating at a fixed filename/path creates a staleness window | Content-hash versioned filenames per save |
| 3 | External plugins minify/concatenate our assets and break script load order | Generic optimization plugins don't know our assets are already optimized and order-dependent | Correct WordPress-standard signals to exclude our assets from double-processing |

---

## Step 1 — Fix Category 1: make the editor environment un-cacheable, explicitly

```
Our dedicated editor environment (from the earlier upgrade file) should
never be served from any cache - browser, CDN, or a WordPress caching
plugin. Right now we may be relying on caching plugins "guessing"
correctly that an admin-area-adjacent route shouldn't be cached, which
research shows is exactly where this breaks: "when the caching plugin
serves a cached version inside the builder's editor iframe, the
JavaScript that powers the editor never initializes properly."

Add explicit, standard cache-control headers to our dedicated editor
route specifically: Cache-Control: no-store, no-cache, must-revalidate.
Also add the standard WordPress convention that tells most caching
plugins to exclude a page (check for and respect the common exclusion
patterns caching plugins look for - logged-in user context, and our
specific route pattern).

Test this by installing a common caching plugin (WP Super Cache or
similar) on our test WordPress install, enabling aggressive caching
site-wide, then opening our dedicated editor. Confirm the editor loads
fresh every time and drag-and-drop remains fully functional - not
loading a stale cached version of the editor shell.
```

## Checkpoint for Step 1
With an aggressive caching plugin active, does the editor still work
exactly as it did with no caching plugin installed at all? If drag-and-
drop breaks, buttons stop responding, or the editor loads an outdated
version of itself, this isn't done - this is precisely the failure mode
found in research, and it needs to be impossible, not just unlikely.

---

## Step 2 — Fix Category 2: versioned, content-hashed CSS generation

```
Revise our static-CSS-generation system (from Phase 4) to use content-
hash versioned filenames instead of a fixed filename per page.

Specifically:
1. When a page is saved, generate the CSS content as before, but name
   the output file using a hash of its own content (e.g.
   page-{post_id}-{content_hash}.css) rather than a fixed name like
   page-{post_id}.css
2. Update the page's enqueued stylesheet reference to point at the new
   hashed filename
3. Set a long Cache-Control max-age (effectively "cache this forever")
   on these hashed CSS files specifically, since a URL only ever points
   to one immutable version of content by construction
4. Keep the actual HTML page itself on a short cache lifetime or
   revalidate-on-request, so it always references the current hashed
   filename - this pairing is what makes the whole system work
5. Clean up old, no-longer-referenced hashed CSS files periodically (a
   scheduled cleanup, not immediate deletion, in case of any brief
   overlap during propagation)

Test this by making a styling change to a saved page, confirming a
NEW hashed filename is generated (not the old one overwritten), and
confirming the page immediately references the new file - with the old
hashed file simply becoming unreferenced rather than needing to be
manually cleared or invalidated anywhere.
```

## Checkpoint for Step 2
This is the core fix in this file, so verify it precisely: make several
rapid successive style changes to the same page and confirm each one
produces its own distinct hashed filename with no overwriting, no
corruption, and no moment where the page could reference a half-written
file. Compare this against the old fixed-filename approach - the
staleness/corruption failure category described in Elementor and Divi's
own documentation should now be structurally impossible, not just
less likely.

---

## Step 3 — Fix Category 3: signal correctly to external optimization plugins

```
Our own generated assets (the hashed CSS from Step 2, and any
conditionally-loaded JS from the animation upgrade file) are already
optimized and, in the case of JS, load-order-dependent. External
caching/optimization plugins that minify and concatenate files without
knowing this can break them - research shows this is a real, common
failure: "page builders rely on specific script loading order - combine
those scripts and the dependency chain breaks."

Use WordPress's standard mechanisms to signal that our assets shouldn't
be re-processed by generic optimization plugins: register our scripts
and styles using wp_enqueue_script/wp_enqueue_style with correct
dependencies declared (so WordPress's own dependency system enforces
load order, which well-behaved optimization plugins respect), and where
relevant, use the standard exclusion patterns that popular optimization
plugins (WP Rocket, Autoptimize, LiteSpeed Cache) look for to skip
already-optimized assets.

Document this clearly for users too: since we can't control every
external plugin's behavior, add a short, clear note in our own
documentation about which specific settings in popular caching plugins
to check first if something looks wrong - similar to how the research
we found recommends "adjust plugin settings when the conflict is caused
by minification, deferral, aggregation" rather than leaving developers
to discover this themselves through trial and error.
```

## Checkpoint for Step 3
This category can't be fully "solved" the way Steps 1 and 2 can, since
it depends on other plugins' behavior - that's honest and expected. The
real test: install a common optimization plugin (Autoptimize or
similar) with default aggressive settings, and confirm our conditional
GSAP loading (from the animation upgrade file) and our hashed CSS still
work correctly, or that our documentation clearly explains the specific
setting to adjust if they don't.

---

## What this file does NOT attempt, and why

Full CDN/hosting-level integration (the "ideal scenario" research
describes as "a platform where the builder, host, and CDN are all part
of one system") is explicitly out of scope - that's a hosting/business
decision, not something a plugin's caching code can replicate on its
own. This file makes our builder behave correctly and predictably
regardless of hosting setup, which is the right scope for a plugin.

## Suggested order

Step 1 first - it's the most severe failure mode (editor completely
breaking) and is a relatively contained fix on top of the dedicated
editor environment we already built. Step 2 next, since it's the core
architectural improvement and the one most directly validated by
independent research as the clearly correct approach. Step 3 last,
since it's inherently about correct signaling rather than a fix we
fully control, and benefits from Steps 1-2 already being solid first.

## Note for decisions-log.md

Add an entry once this file is built: the choice of content-hash
versioned filenames over fixed-path regeneration for our static CSS
system, and why - so this doesn't get accidentally "simplified" back to
a fixed-filename approach by a future change without someone
remembering this was a deliberate, researched decision.
