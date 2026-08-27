# Starter Prompt Template — Builder-Compatible ( Paste One-By-One )

Copy the prompt inside the box and paste it into **any AI** (ChatGPT, Claude, Gemini, Cursor, v0, Lovable, Bolt, etc.). Fill in the `[BRACKETS]`. The AI will return code **already separated** into HTML / CSS / JS / PHP blocks so you just copy each one into your builder/file one at a time.

---

## COPY FROM HERE ↓

```
You are a senior frontend engineer + UI/UX designer + WordPress builder specialist.

Build a complete, production-ready website for:

PROJECT: [PROJECT NAME - e.g., "Lumina - A skincare DTC brand"]
TYPE: [Landing Page / Marketing Site / SaaS / Portfolio / E-commerce / Blog / Web App]
GOAL: [Primary goal - e.g., "Convert visitors to waitlist signups"]
TARGET AUDIENCE: [e.g., "Tech founders 25-40, US/EU"]
BRAND VIBE: [e.g., "Minimal editorial, warm monochrome, premium like Aesop"]

### 1. REQUIRED PAGE STRUCTURE - BUILD ALL, DO NOT SKIP

Build ALL sections in order. If one doesn't apply, state why and propose an alternative — do NOT silently omit:

A. DOCUMENT FOUNDATION — semantic HTML5: <header>, <nav>, <main>, <section>, <footer>, skip-to-content link
B. NAVIGATION — sticky header with logo (text fallback), nav links + primary CTA, mobile hamburger (slide/drawer, closes on link click + Esc + outside click, keyboard accessible), active scrollspy
C. HERO — single H1 with value prop, subheadline, Primary CTA + Secondary CTA (ghost), visual with alt text, trust line ("Trusted by 10k+")
D. SOCIAL PROOF — 4-6 logos (grayscale hover) or testimonial
E. FEATURES — min 3 cards, each: inline SVG icon (never emoji), h3, description, optional link. Grid 3→2→1 cols, equal height
F. HOW IT WORKS — 3-4 steps with numbered indicators, connecting line on desktop
G. CONTENT SECTION — choose by TYPE: SaaS=screenshot with browser chrome / E-comm=product grid / Portfolio=project grid with filter / Marketing=3 testimonials with avatar/name/role/company
H. PRICING — 2-3 tiers, middle = "Most Popular", each: name, price, feature list with check/x icons, CTA. Include monthly/annual toggle if relevant. If not applicable, replace with CTA Banner
I. FAQ — accordion, only one open at a time, aria-expanded, keyboard nav (Enter/Space)
J. FINAL CTA — contrasting background, headline, subtext, primary CTA + email input if lead capture
K. FOOTER — 4 columns: Brand (logo+tagline+social inline SVGs with aria-label) | Product | Company | Legal, bottom bar © Year Brand | Privacy | Terms

### 2. TECHNICAL REQUIREMENTS - MANDATORY

HTML:
- Semantic HTML5 only. <button> for actions, <a> for navigation. Never <div onclick>.
- All <img> have descriptive alt + width/height (prevent CLS), loading="lazy" except hero (eager + fetchpriority="high")
- Forms: <label for/id>, required, autocomplete, inline validation messages

CSS:
- Mobile-first, breakpoints 640px, 768px, 1024px, 1280px. Use CSS variables (--color-primary, --space-md).
- No horizontal scroll at 320px/375px/768px/1440px. No fixed widths that break mobile.
- System font stack OR 1 Google Font (max 2 weights). All states: :hover, :focus-visible (ring), :active, :disabled.
- BUILDER COMPATIBLE: Use plain resolvable CSS only (classes, IDs, element selectors). Avoid @import inside CSS, avoid CSS-in-JS, avoid Tailwind @apply that a parser can't resolve. Keep specificity predictable (.card .title overrides h2).

JS:
- Vanilla JS only (no jQuery). Progressive enhancement — page usable with JS disabled.
- Smooth scroll for anchors, throttled scroll, no layout thrashing, zero console errors.

ACCESSIBILITY (WCAG 2.1 AA):
- Contrast >=4.5:1 text, 3:1 large text. Keyboard: Tab/Shift+Tab/Enter/Space/Esc. Focus visible & never trapped. aria-label on icon buttons, aria-expanded on toggles.

SEO:
- One H1, logical H2/H3 (no skipped levels). Meta title 50-60 chars, description 140-160, OG+Twitter cards, JSON-LD (Organization/Product/Article as appropriate).

DESIGN:
- NO default Tailwind blue/purple gradient. Pick deliberate palette, list hex codes as CSS variables.
- 8px spacing scale (4/8/16/24/32/48/64/96/128). Typography: H1 48-72px desktop / 32-40px mobile, body 16-18px, line-height 1.6.
- Cards: border+shadow, radius 8-16px, hover lift (translateY -2px). Buttons: min 44px height, weight 600, 150ms transition.
- No lorem ipsum — write real benefit-driven copy for [PROJECT NAME]. Micro-interactions on hover/scroll.

### 3. OUTPUT FORMAT — CRITICAL: SEPARATE INTO PASTE-READY BLOCKS

You MUST output the code in SEPARATED blocks, in this exact order. Each block gets its own fenced code block with a paste instruction header. Do NOT merge into one file. Do NOT use placeholders like "<!-- add here -->".

Your response MUST be exactly this structure:

───────────────────────────────────────
### 📄 BLOCK 1: HTML — index.html
PASTE TO: Code-to-Block Importer → HTML (#ctb-import-html) OR index.html OR WordPress "Custom HTML" block
───────────────────────────────────────
```html
<!-- Paste this HTML as-is -->
<!-- For 2-field builders (HTML/CSS only) — AVOID section comments like <!-- ===== HERO ===== --> (they crash old parser.js before fix); on 4-field builds they are now ignored -->
<!-- All images have alt/width/height. Single H1. Semantic tags only. No <svg>/<form>/<input> (use text glyphs + divs) -->
... complete HTML here (no <style> and no <script> inside) ...
```

───────────────────────────────────────
### 🎨 BLOCK 2: CSS — styles.css
PASTE TO: Code-to-Block Importer → CSS (#ctb-import-css) OR styles.css OR Appearance → Customize → Additional CSS
───────────────────────────────────────
```css
/* Paste this entire CSS as-is — resolvable by builder parser */
/* Note: at-rules / var() / :hover will parse but show as warnings — they still render via fallback. For zero warnings use flat hex + fluid grids. */
:root {
  /* PALETTE: --color-primary: #...; --color-bg: #... etc. */
  /* FONT: ... */
}
... complete CSS here (mobile-first, variables, no @import if you want zero warnings) ...
```

───────────────────────────────────────
### ⚡ BLOCK 3: JS — script.js
PASTE TO: Code-to-Block Importer → JS (#ctb-import-js) — its OWN textarea (NOT the canvas!)
         Fallback if you only see 2 fields (HTML/CSS): Append at END of HTML field wrapped as <script>…</script>
         Or: script.js before </body> OR Code Snippets → JS snippet
───────────────────────────────────────
```javascript
// Paste this JS as-is — vanilla, no dependencies
// Handles: mobile menu, smooth scroll, scrollspy, FAQ accordion, etc.
// IMPORTANT: In Code-to-Block this does NOT become a visual block; after Parse it appears under
// "Detected JavaScript → Unverified script preserved for manual review (Attached to main-1)" — that is EXPECTED.
// If your builder only has 2 fields, wrap this entire file in <script>…</script> and append to HTML field.
... complete JS here (progressive enhancement, no console.log) ...
```

───────────────────────────────────────
### 🐘 BLOCK 4: PHP — functions.php (ONLY if TYPE needs it, else write "Not needed for this project — skip this block")
PASTE TO: Code-to-Block Importer → PHP disclosure (#ctb-import-php) — OPTIONAL, no canvas slot
         Fallback if you only see 2 fields: Plugins → Code Snippets → Add PHP Snippet (NOT canvas)
         Never paste unverified PHP to live without review
───────────────────────────────────────
```php
<?php
// Paste only if confirmed. Shortcode / CPT / form handler etc.
// Must pass safety scan: NO eval/exec/system/base64_decode+eval
// NOTE: In Code-to-Block this does NOT become a block; it shows as "Detected PHP" panel (needs admin confirmation)
// If your builder only has 2 fields, use Code Snippets → PHP snippet instead of Importer.
... safe PHP here OR comment "Not needed" ...
?>
```

───────────────────────────────────────
### 📋 BLOCK 5: PASTE GUIDE + SELF-AUDIT (plain text, not code)
───────────────────────────────────────
PASTE ORDER (Code-to-Block Importer — NOT canvas):
1. HTML → #ctb-import-html (creates blocks)
2. CSS  → #ctb-import-css  (maps to Style panel)
3. JS   → #ctb-import-js   (does NOT create a block — see "Detected JavaScript" panel)
4. PHP  → #ctb-import-php  (does NOT create a block — see "Detected PHP" panel) — skip if "Not needed"

TROUBLESHOOTING:
- "Cannot read properties of undefined (reading 'toLowerCase')" → You are on old build OR your HTML still contains <!-- ===== --> comments. FIXED in parser.js:266 for new builds; for 2-field old builds, remove all HTML comments from BLOCK 1 (this template now instructs AI to avoid them). Hard-refresh editor to load new build/index.js.
- "Block 3/4 has no slot to paste" → Your builder shows only 2 fields (HTML/CSS) — you are on older build. Use fallback: JS → append at END of HTML field as <script>…</script> (parser will extract it), or Customizer → Additional JS / Code Snippets. PHP → Code Snippets → PHP snippet. On 4-field builds, JS/PHP have their own Importer textareas (#ctb-import-js / #ctb-import-php) and never appear as canvas blocks — check "Detected JavaScript/PHP" panels below Importer after Parse.

BUILDER NOTES:
- Code-to-Block / Elementor / Gutenberg compatible: HTML uses clean classes (no <svg>/<form>/<input> — use text glyphs ✓ ✕ ★ ⚡ and <div> for inputs), CSS is flat resolvable stylesheet, JS uses class toggles (no inline onclick)
- If builder strips <script>, enqueue script.js via functions.php or builder's JS field

AUDIT:
- Sections built: [list A-K]
- Palette: [hex codes]
- Font: [name + weights]
- Responsive: verified 320/375/768/1024/1440 — no overflow
- Accessibility: [score/notes]
- Known limitations: [what needs backend/CMS]

RULES:
- Every block must be COMPLETE and runnable alone. No "add later" comments.
- HTML block contains ONLY HTML (no <style>/<script>).
- CSS block contains ONLY CSS (no HTML/JS).
- JS block contains ONLY JS (no HTML/CSS).
- PHP block is safe, scanned, and opt-in — include plain-language description of what it does.
- Do NOT use <br> for spacing, inline styles (except JS-driven), alert/prompt, or <svg>/<form>/<input> in HTML (Code-to-Block v1 allowlist rejects them — use <span> glyphs ✓ ✕ ★ ⚡ ◧ and <div> for inputs; SVG is OK for non-Code-to-Block builders).

Build it now.
```

## COPY UNTIL HERE ↑

---

## How To Use (You — The Human)

### Step 1: Paste prompt into any AI
Copy the entire box above → fill every `[BRACKET]` → paste into ChatGPT / Claude / Gemini / Cursor / v0 / Bolt / Lovable.

### Step 2: Copy each block one-by-one from the AI's reply

The AI will reply with 5 clearly labeled blocks. Copy them in order into the **Importer panel** (not the canvas):

| Order | Block | Where to paste in Code-to-Block Importer | Fallback / File |
|-------|-------|------------------------------------------|-----------------|
| **1** | 📄 **HTML** `index.html` | Importer → **HTML** textarea `#ctb-import-html` | `index.html` |
| **2** | 🎨 **CSS** `styles.css` | Importer → **CSS** textarea `#ctb-import-css` | `styles.css` |
| **3** | ⚡ **JS** `script.js` | Importer → **JS** textarea `#ctb-import-js` *(its own field — NOT canvas)* → after Parse check "Detected JavaScript" panel | `script.js` / before `</body>` |
| **4** | 🐘 **PHP** `functions.php` | Importer → **PHP** disclosure `#ctb-import-php` *(optional — no canvas slot)* → check "Detected PHP" panel | `functions.php` / Code Snippets |
| **5** | 📋 **Guide + Audit** | Read only — verification checklist | — |

> **Builder tip (Code-to-Block):** New builds have **4 separate textareas** (HTML/CSS/JS + PHP disclosure). Paste each block into its matching textarea, then click **Parse onto canvas**. JS/PHP will **not** appear as visual blocks — they appear as **Detected JavaScript / Detected PHP** panels below the Importer. That is expected: JS attaches as `Unverified script → Attached to main-1`, PHP shows as `Detected PHP` for admin review.
> **If your builder only shows 2 fields (HTML/CSS)** — you are on an older build. Do this instead: **JS →** wrap entire BLOCK 3 in `<script>…</script>` and **append at the very end of the HTML field** (the parser extracts `<script>` from HTML identically), or enqueue via Customizer/Code Snippets. **PHP →** use **Plugins → Code Snippets → PHP snippet** (never paste into HTML/CSS fields). To avoid `toLowerCase` errors on old builds, ensure BLOCK 1 has **no HTML comments** (this template now forbids them).
> **If you still see** `Cannot read properties of undefined (reading 'toLowerCase')` after updating, hard-refresh the editor (`Ctrl+Shift+R` / `Cmd+Shift+R`) to load the fixed `build/index.js` (parser.js:266).

### Step 3: Verify quickly
After pasting, check at 320px, 768px, 1440px — no horizontal scroll, hamburger works, FAQ keyboard navigable (Tab + Enter).

---

## Optional Modifiers — Append to the prompt if needed

Add ONE of these lines to the very end of the prompt before sending:

| Add this line | When to use |
|---|---|
| `Stack: Next.js 14 App Router + Tailwind. Keep BLOCK separation: output page.tsx (HTML+JS), globals.css, and route.ts (PHP equiv) as separate blocks.` | Next.js |
| `Stack: React + Vite. Keep BLOCK separation: App.jsx, index.css, main.js as separate blocks.` | React SPA |
| `Stack: Astro. Keep BLOCK separation.` | Astro |
| `Language: [Spanish/French/etc.], keep code comments in English.` | Non-English site |
| `Add dark mode toggle (prefers-color-scheme + manual toggle in localStorage) — include logic in JS block, variables in CSS block.` | Dark mode |
| `Add GSAP ScrollTrigger — put GSAP CDN in HTML block <head>, animation code in JS block only.` | Premium motion |
| `E-commerce: include WooCommerce-ready PHP block with product loop shortcode, else mark PHP as "Not needed".` | Shop |

---

## Why Separated Blocks?

| Old (single file) | New (separated) — builder compatible |
|---|---|
| AI dumps one huge HTML with `<style>`+`<script>` mixed — builder parser chokes or strips it | HTML is pure semantic markup — parser resolves styles cleanly |
| CSS buried inside `<style>` — can't paste into builder CSS panel | CSS is a flat stylesheet — paste directly into Custom CSS / Additional CSS |
| JS inline — stripped by WordPress `wp_kses` | JS isolated — enqueue properly or paste into builder JS field |
| PHP hidden or missing — unsafe to guess | PHP isolated, scanned, with plain-language description — opt-in only |
| User has to manually split the file | User pastes **one block at a time** — zero splitting, zero errors |

---

## Variants

### Minimal Variant (for small-context AIs)
If the full prompt is too long, use this:

```
Build a complete [TYPE] website for "[PROJECT NAME]" — [ONE SENTENCE GOAL]. Vibe: [BRAND VIBE].

REQUIRED SECTIONS (all, no placeholders): sticky nav+hamburger, hero (single H1+2 CTAs+trust line), logo bar, 3-feature grid (SVG icons), how-it-works 3 steps, testimonials 3, pricing 3 tiers (middle highlighted), FAQ accordion (aria-expanded), CTA banner, 4-col footer.

TECH: Semantic HTML5, CSS variables, mobile-first 320/375/768/1024/1440 no overflow, vanilla JS, WCAG AA, SEO (one H1, meta+OG+JSON-LD).

OUTPUT AS 4 SEPARATED PASTE-READY BLOCKS IN ORDER:
BLOCK 1 HTML (```html pure HTML only, no style/script)
BLOCK 2 CSS (```css flat stylesheet, :root palette, mobile-first)
BLOCK 3 JS (```javascript vanilla only, menu+scroll+accordion)
BLOCK 4 PHP (```php only if needed else "Not needed — skip")
BLOCK 5 audit (sections+palette+font+limitations)

RULES: Each block complete+runnable. No placeholders. No <br> for spacing. No emoji icons (inline SVG). No inline styles.
```

### Framework Add-On
```
Framework: [Next.js 14 / Astro / Vue 3 / SvelteKit / Plain HTML]
Styling: [Tailwind / CSS Modules / Vanilla CSS]
Keep the 4-block separation regardless of framework — map HTML→component, CSS→stylesheet, JS→client script, PHP→server route/handler.
```
