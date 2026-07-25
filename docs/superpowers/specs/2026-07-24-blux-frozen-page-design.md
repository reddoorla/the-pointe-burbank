# Blux Frozen-Page Render — Design

**Status:** approved-direction (forks confirmed), spec under review
**Date:** 2026-07-24
**Supersedes (for layout fidelity):** the semantic catalog render surface
(`blux_grid`/`blux_section`/`blux_block`/`blux_carousel`/`blux_gallery` +
`src/lib/blux-catalog`). Those reconstruct layout from an IR and are
provably not pixel-faithful (see "Why").

---

## Goal

Migrate a Blux site onto the Reddoor stack (SvelteKit + Prismic) so the
rendered page **matches the live Blux site pixel-for-pixel**, while keeping
**copy and images editable in Prismic** — deterministically, no LLM in path.

## Why the current approach fails

The catalog pipeline ignores the Blux export's rendered HTML and rebuilds the
layout semantically: export JSON → IR → grid-tree → cells → typed slices with
**heuristic** flex-basis widths and **role-mapped** font sizes. The live Blux
layout, however, lives entirely in **inline styles on the markup** — measured,
empirically:

- `~/Desktop/thePointe/index.html` = the full **132 KB** rendered page.
- **316 inline `style=` attributes**, **14 `<section>` bands**, one `<style>`
  block, Google Fonts, and a Blux JS runtime (lazy media, reveal-on-scroll,
  sticky nav, carousel).
- Live site body height **15,333 px**. The semantic reconstruction renders
  **16,487 px** — visibly different rhythm, sizing, and media treatment.

No amount of emit-tuning closes this, because the reconstruction never sees the
316 inline styles. **Preserve the layout instead of re-deriving it.**

## Validated approach (proof-of-concept complete)

Freeze the export's own markup as the layout; expose only the editable leaves
(text runs + image urls) as Prismic content. Proven end-to-end in
`scratchpad/freeze-final.mjs`: a deterministic transform produced a static page
at **exactly 15,333 px with all 57 images**, matching the live site.

Three empirical facts the pipeline relies on:

1. **Layout = the settled DOM.** The Blux JS makes layout-affecting
   adjustments (heights/positions). Freezing the *raw* HTML renders 16,873 px;
   freezing the **JS-settled** DOM renders 15,333 px (exact). So the freeze
   must hydrate once in a headless browser and snapshot the settled DOM.
2. **Reveal is a CSS class.** `.block-effects{opacity:0}` → JS adds
   `.block-effects-applied{opacity:1}`. Baking `.block-effects{opacity:1
   !important; transform:none !important; animation:none !important}` makes the
   page fully visible with no runtime.
3. **Images are deterministic from attributes.** Each media element carries
   `data-base` (folder) + `data-size` (width) + `data-media`/`data-bgmedia`
   (filename). The url is `{data-base}w:{data-size}/{data-media}` — verified
   200/`image/png` for the raw, `w:475`, and `w:950` variants. 52
   `.camediaload` + 5 `data-bgmedia` = **57 image urls**, assembled in Node,
   no runtime, no browser-timing games.

---

## Architecture

```text
blux freeze <exportDir> --out <site>        (reddoor-maintenance)
  ├─ settle:  headless-render index.html, scroll to apply JS layout, snapshot
  ├─ transform (in the settled DOM / Node):
  │    strip <script>; force reveal end-state;
  │    assemble+inline 57 image background-images from data-* attrs;
  │    tokenize every text node  → ⟦t:KEY⟧  + record {key, text}
  │    tokenize every image url  → ⟦i:KEY⟧  + record {key, url}   (OFFLINE — no upload)
  └─ emit:
       frozen/<site>.html         → repo template (tokenized, layout frozen)
       frozen/<site>.style.css     → the extracted <style> block
       <site>.slots.json           → { slots:[{key, kind, text|url}], ... }

migrate-frozen <site>                         (reddoor-maintenance)
  ├─ upload the slot image urls (cloudfront → images.prismic.io), url→asset map
  └─ POST a `frozen_page` doc (uid, title, meta, slots[]) into an unpublished
     release, image slots resolved to Prismic assets (reuse migrate-catalog)

<FrozenPage>                                  (reddoor-starter)
  └─ import template + style; read frozen_page.slots from Prismic;
     substitute ⟦t:KEY⟧/⟦i:KEY⟧ → current slot values; {@html} + inject <style>
```

### Component 1 — `blux freeze` (reddoor-maintenance, `src/blux/freeze/`)

- **Input:** an export dir containing `index.html` (single page for v1).
- **Settle:** Playwright chromium, viewport 1440, `goto(file://…index.html)`,
  scroll top→bottom in steps to trigger the JS layout pass, snapshot
  `document` after settle. (Playwright is already a maintenance/starter dep.)
- **Tokenize (in-page, deterministic DOM walk):**
  - A `TreeWalker` over text nodes: skip `<script>/<style>` and
    whitespace-only nodes; for each, assign key `s{sectionIdx}.t{n}` (section =
    nearest ancestor `<section>` index; `n` = document-order counter), replace
    the node's text with `⟦t:KEY⟧`, record `{key, text}`.
  - For each media element (has `data-base`+`data-media`/`data-bgmedia`):
    assemble the url, assign key `s{sectionIdx}.i{n}`, set inline
    `background-image:url(⟦i:KEY⟧)`, record `{key, url}`.
- **Static transforms:** remove all `<script>`; inject the reveal-force style;
  extract the `<style>` block to `<site>.style.css`.
- **Assets (offline):** freeze records the 57 cloudfront urls in the slot
  manifest and stays offline (like `blux catalog`). Upload happens at migrate
  time, so the Prismic-hosted, CDN-durable urls land in the posted doc.
- **Emit:** the tokenized `<body>` inner HTML → `frozen/<site>.html`; the style
  block → `frozen/<site>.style.css`; the slot manifest → `<site>.slots.json`.
- **Golden test:** freezing the-pointe yields exactly 57 image slots, 14
  sections, a stable text-slot count, and a byte-stable template (canary counts
  guard against drift), rendering to 15,333 px.

### Component 2 — `frozen_page` Prismic type + `migrate-frozen`

- **Custom type `frozen_page`:** `uid` (Text), `title` (Text), `meta_title`,
  `meta_image`, and a repeatable group **`slots`** with fields `key` (Text),
  `kind` (Select: text|image), `text` (Rich Text — single-line, formatting
  preserved), `image` (Image). Only the relevant value field is populated per
  slot. **No layout modeling** — the template is opaque.
- **`migrate-frozen`:** reuse `migrate-catalog`'s two-phase machinery — upload
  the slot image urls (cloudfront → Prismic), resolve url→asset, POST the
  `frozen_page` doc into an **unpublished** release (Tucker publishes). Slot
  images become Prismic Image fields; slot texts become the editable copy.

### Component 3 — `<FrozenPage>` render (reddoor-starter, `src/lib/blux-frozen/`)

- `frozen/<site>.html` (template) and `frozen/<site>.style.css` ship in the
  repo (build artifacts of freeze). The route loads the `frozen_page` doc's
  `slots` from Prismic.
- Render: build a `Map(key → value)` from the doc's slots (text = the rich-text
  rendered to HTML; image = the Prismic image url); replace every `⟦t:KEY⟧` /
  `url(⟦i:KEY⟧)` token in the template with its current value; output via
  `{@html}` inside a wrapper that also injects `<style>` (the frozen style
  block) + the Google-Fonts `<link>`. Missing slot key → fall back to the
  frozen original value (never render a raw token).
- **Replaces** the whole `blux-catalog` + `Blux*` slice render surface for
  frozen sites. (The catalog surface can stay for any site already on it; new
  freezes use FrozenPage.)

### Cross-cutting

- **CSP:** add `https://fonts.googleapis.com` to `style-src`,
  `https://fonts.gstatic.com` to `font-src`. Image host `images.prismic.io`
  already allowed. (Google Fonts self-hosting is a possible follow-up.)
- **Interactivity (deferred — static-first, per decision):** v1 drops the Blux
  runtime. That means: no reveal-on-scroll fades (baked visible), hero carousel
  shows its first slide statically, sticky/mobile nav is a static bar, the map
  is a static image (or deferred). v2 layers these back as small vanilla
  behaviors. The at-rest layout — the actual fidelity target — is exact without
  them.
- **Editing model:** editors change copy and swap images via `slots` in
  Prismic; they cannot rearrange layout (a faithful clone doesn't need it — a
  structural change is a re-freeze). This is the "not in the slice model"
  requirement, satisfied.

---

## Scope (v1)

**the-pointe, single page**, end-to-end: freeze → migrate-frozen into
`the-pointe-burbank` → render via FrozenPage → **pixel-match vs the live
site**. Multi-page (per-page freeze + uid routing for composition's 8 pages)
is a follow-up that reuses the same freeze per page.

## Testing / acceptance

1. **Freeze golden** (maintenance): the-pointe → 57 image slots, 14 sections,
   canary text-slot count, template renders to 15,333 px (Playwright).
2. **Render unit** (starter): FrozenPage substitutes tokens, falls back on
   missing keys, never emits a raw `⟦…⟧` token, injects the style block once.
3. **Fidelity gate** (starter, Playwright): render the FrozenPage for the-pointe
   and assert body height 15,333 px ±small tol and the 57 image backgrounds
   resolve; optional pixel-diff vs a committed reference of the live site.
4. **Live proof:** migrate-frozen into the-pointe-burbank (0 missing asset,
   unpublished), render, human pixel-compare vs thepointeburbank.com.

## Edge cases / risks

- **Text nodes with inline formatting** (`<em>`, `<a>` inside a paragraph): the
  TreeWalker splits at element boundaries, so a formatted sentence becomes
  several adjacent slots. Acceptable for v1 (each run editable); a
  "coalesce a paragraph's runs into one rich-text slot" refinement is a
  follow-up if editors find it awkward.
- **Determinism of settle:** the page has no randomness; same input → same
  settled DOM. The freeze golden's canary counts catch any drift.
- **Asset sizing:** bake at the size the site chose (`data-size`); the CDN
  variant is uploaded to Prismic so it survives the Blux CDN sunset.
- **`data-swaps`/responsive variants** (2 elements): v1 bakes the primary
  size; responsive art-direction is a follow-up (rare on the-pointe).
- **Favicon/og:image** cloudfront urls (5): rewrite to Prismic in `<head>`.

## What this deletes / simplifies

The FrozenPage surface is a single small component + a template file, replacing
the multi-hundred-line `blux-catalog` lib, six `Blux*` slices, the type-role
CSS system, and the grid-tree/cell emit. Fidelity stops being a moving target
because the layout is the original, byte-for-byte.
