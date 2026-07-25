# Blux Frozen-Page Render — Implementation Plan

> **For agentic workers:** TDD, task-by-task. Steps use checkbox (`- [ ]`).
> Spec: `docs/superpowers/specs/2026-07-24-blux-frozen-page-design.md`.

**Goal:** Render a Blux site pixel-faithfully by freezing its export's own
`index.html` as the layout, exposing text runs + images as editable Prismic
slots. Prove on the-pointe → the-pointe-burbank.

**Architecture:** `blux freeze` (offline, maintenance) → repo template +
`<style>` + `slots.json`; `migrate-frozen` (maintenance) → `frozen_page`
Prismic doc; `<FrozenPage>` (starter) → template + slots → `{@html}`.

**Tech Stack:** TypeScript, Playwright (settle), cac CLI, Prismic Migration/
Custom-Types API, SvelteKit + `@prismicio/svelte`.

**Repos/worktrees:** MAINT `feat/blux-frozen-freeze` (scratchpad/frozen-maint);
STARTER `feat/blux-frozen-page` (scratchpad/frozen-page).

---

## Shared contract (define once, both repos import/mirror)

- **Tokens:** text slot → `⟦t:KEY⟧` (whole text-node value); image slot →
  `url(⟦i:KEY⟧)` inside an inline `background-image`. `KEY` = `s{sec}.{t|i}{n}`
  where `sec` = nearest-ancestor `<section>` index (document order, `h` for
  head/nav above the first section), `n` = per-kind document-order counter.
- **`<site>.slots.json`:**
  ```json
  {
    "site": "the-pointe", "uid": "home",
    "title": "The Pointe", "metaTitle": "...", "metaImageUrl": "https://...",
    "slots": [
      { "key": "s1.t0", "kind": "text",  "text": "A Monument Of Excellence", "section": "s1" },
      { "key": "s1.i0", "kind": "image", "url": "https://d3sy.../w:475/uuid.png", "section": "s1" }
    ]
  }
  ```
- **Template:** `frozen/<site>.html` = tokenized `<body>` innerHTML (no
  `<script>`, reveal forced). **Style:** `frozen/<site>.style.css` = the
  extracted `<style>` block text.

---

## MAINTENANCE tasks (worktree scratchpad/frozen-maint, `feat/blux-frozen-freeze`)

New module dir: `src/blux/freeze/`.

### Task M1: slots + token types

**Files:** Create `src/blux/freeze/types.ts`; Test `tests/blux/freeze/types.test.ts`

- [ ] Define `Slot` (`{key; kind:"text"|"image"; text?; url?; section}`),
  `FrozenManifest` (`{site; uid; title; metaTitle?; metaImageUrl?; slots:Slot[]}`),
  and `tokenFor(kind, key)` / `TOKEN_RE` (`/⟦([ti]):([^⟧]+)⟧/g`).
- [ ] Test: `tokenFor("text","s1.t0")==="⟦t:s1.t0⟧"`; `TOKEN_RE` round-trips.
- [ ] Commit.

### Task M2: settle (headless render → settled DOM)

**Files:** Create `src/blux/freeze/settle.ts`; Test `tests/blux/freeze/settle.test.ts`

- [ ] `settleExport(indexHtmlPath): Promise<string>` — Playwright chromium,
  viewport 1440×1000, `goto(file://…)`, scroll top→bottom in 500px steps
  (waitFor 120ms each) to apply the JS layout pass, scroll to 0, wait 1200ms,
  return `page.content()`. (Ported from `scratchpad/freeze-final.mjs` phase 1.)
- [ ] Test: settling `~/Desktop/thePointe/index.html` returns HTML whose
  `document` body height (re-rendered) is 15333 ±2. (Gated behind an env flag /
  `test.skip` if the export isn't present, like other export-dependent tests.)
- [ ] Commit.

### Task M3: tokenize text nodes

**Files:** Create `src/blux/freeze/tokenize-text.ts`; Test `…/tokenize-text.test.ts`

- [ ] `tokenizeText(html): { html; textSlots:Slot[] }` — parse with the repo's
  DOM lib (same as catalog uses — `node-html-parser` or `linkedom`; match
  `src/blux/catalog`), TreeWalker/recursion over text nodes: skip
  `<script>/<style>` and whitespace-only; assign `s{sec}.t{n}`; replace node
  text with `⟦t:KEY⟧`; collect `{key, kind:"text", text, section}`.
- [ ] Test: a `<section><h1>Hi</h1><p>  </p></section>` → 1 text slot keyed
  `s0.t0` text "Hi", whitespace `<p>` untouched, `<h1>` now `⟦t:s0.t0⟧`.
- [ ] Commit.

### Task M4: bake + tokenize images

**Files:** Create `src/blux/freeze/bake-images.ts`; Test `…/bake-images.test.ts`

- [ ] `bakeImages(html): { html; imageSlots:Slot[] }` — for each element with
  `data-base`+(`data-media`|`data-bgmedia`): url = `{base}` + (`data-size`?
  `w:{size}/` : "") + `{media}` (bgmedia default size 1600); assign
  `s{sec}.i{n}`; merge `background-image:url(⟦i:KEY⟧)` into the element's
  `style`; collect `{key, kind:"image", url, section}`. (Formula verified 200:
  `{base}w:475/uuid.png`.) Also rewrite `<head>` favicon/`og:image` cloudfront
  urls into image slots (or a `headAssets` list).
- [ ] Test: a `<div data-base="B/" data-size="475" data-media="x.png" style="width:200px">`
  → slot url `B/w:475/x.png`, element style ends `…;background-image:url(⟦i:s0.i0⟧)`.
- [ ] Commit.

### Task M5: static transforms + emit

**Files:** Create `src/blux/freeze/index.ts` (orchestrator `freezeSite`), `emit.ts`;
Test `…/freeze.test.ts`

- [ ] `stripAndForce(html)`: remove `<script…>…</script>` (all), inject before
  `</head>` `<style id="freeze">.block-effects{opacity:1!important;transform:none!important;animation:none!important;visibility:visible!important}</style>`, extract+return the page `<style>` block separately.
- [ ] `freezeSite({exportDir, site}): FrozenManifest & {templateHtml; styleCss}` —
  settle → bake-images → tokenize-text → stripAndForce → pull `<body>` inner +
  title/meta. Order: bake before tokenize-text (image urls become slots first).
- [ ] `emitFrozen(outDir, result)` writes `frozen/<site>.html`,
  `frozen/<site>.style.css`, `<site>.slots.json`.
- [ ] Test (golden, export-gated): freeze the-pointe → 57 image slots, 14
  sections, textSlots length canary (record actual), template contains no
  `<script`, no raw cloudfront in template body (all tokenized), re-render
  template+style+slot-values → 15333 ±2 and 57 resolved backgrounds.
- [ ] Commit.

### Task M6: `blux freeze` CLI action

**Files:** Modify `src/cli/commands/blux.ts` (add `action==="freeze"`), `src/cli/bin.ts` (register if actions are enumerated); Test `…/freeze-cli.test.ts`

- [ ] `if (action==="freeze")`: require `dir`, call `freezeSite`+`emitFrozen`
  to `opts.out ?? <dir>/frozen-out`, print `froze <site>: N image slots, M text
  slots, K sections`. OFFLINE (no creds).
- [ ] Test: invoking with a tiny fixture export writes the three files.
- [ ] Commit.

### Task M7: `migrate-frozen` action

**Files:** Modify `src/cli/commands/blux.ts` (add `action==="migrate-frozen"`);
reuse `src/blux/assets.ts` upload pass + `src/blux/emit/run-migration.ts`; Test `…/migrate-frozen.test.ts` (mock fetch)

- [ ] `if (action==="migrate-frozen")`: load `<site>.slots.json`; upload image
  slot urls (cloudfront→Prismic) via the SAME asset-upload pass migrate-catalog
  uses; `rewriteValueUrls` the slot urls → Prismic; build a `frozen_page` doc
  `{uid, data:{title, meta_title, meta_image, slots:[{key,kind,text,image}]}}`;
  push the `frozen_page` custom type; POST the doc into an unpublished release
  via the run-migration machinery (reuse `docRefKey` type+uid lookup from #456).
- [ ] Test (mock fetch): asserts the doc PUT/POST targets `frozen_page`, image
  slots carry Prismic urls, text slots carry text; unpublished release.
- [ ] Commit.

---

## STARTER tasks (worktree scratchpad/frozen-page, `feat/blux-frozen-page`)

New lib dir: `src/lib/blux-frozen/`.

### Task S1: `frozen_page` custom type + generated types

**Files:** Create `customtypes/frozen_page/index.json`; Modify `src/prismicio-types.d.ts`; Test `src/lib/blux-frozen/model.test.ts`

- [ ] Custom type `frozen_page`: `uid`, `title` (Text), `meta_title`,
  `meta_description`, `meta_image` (Image), repeatable group `slots` with
  `key`(Text), `kind`(Select text|image), `text`(Rich Text), `image`(Image).
- [ ] Add `FrozenPageDocument` + `FrozenPageDocumentDataSlotsItem` to types.
- [ ] Test: the JSON parses and declares the `slots` group fields.
- [ ] Commit.

### Task S2: token substitution lib

**Files:** Create `src/lib/blux-frozen/substitute.ts`; Test `…/substitute.test.ts`

- [ ] `substitute(template, slotsByKey): string` — replace every `⟦t:KEY⟧` with
  the text value and every `url(⟦i:KEY⟧)` with `url('<imgUrl>')`; a missing key
  → leave the original baked value? No — freeze already tokenized, so missing
  key = fall back to empty text / drop the bg. Decision: keep a `fallback` map
  (the frozen original values) emitted alongside; missing Prismic slot → use
  fallback; NEVER emit a raw `⟦…⟧`. Assert no residual `TOKEN_RE` match.
- [ ] Tests: substitutes text + image; missing key uses fallback; output has no
  `⟦`.
- [ ] Commit.

### Task S3: `<FrozenPage>` component

**Files:** Create `src/lib/blux-frozen/FrozenPage.svelte`; Test `…/FrozenPage.test.ts`

- [ ] Props: `template` (string), `styleCss` (string), `slots` (doc slots).
  Build `slotsByKey` (text = rich-text→plain/HTML via `@prismicio/client`
  `asText`/`asHTML`; image = `field.url`); `const html = substitute(...)`.
  Render `<svelte:head>{@html <style>styleCss</style>}</svelte:head>` + the
  Google-Fonts `<link>` + `{@html html}` in a wrapper. Justify the `{@html}`
  lint disable (trusted build-time frozen fixture, no user input).
- [ ] Test (vitest + @testing-library/svelte): renders substituted text +
  background-image; injects the style once.
- [ ] Commit.

### Task S4: dev gate route + fidelity gate

**Files:** Create `src/routes/dev/blux-frozen/{+page.svelte,+page.ts,fixture}`; copy the-pointe `frozen/the-pointe.{html,style.css}` + `the-pointe.slots.json`; Create `tests/gate/frozen-fidelity.spec.ts`

- [ ] `+page.ts` load: import the frozen template (`?raw`), style (`?raw`), and
  a committed `the-pointe.slots.json` (from the freeze); pass to FrozenPage.
- [ ] Gate spec (Playwright): goto route, assert body height 15333 ±small,
  `[style*="background-image"]` count ≥ 57 resolve (naturalWidth>0 sample), no
  raw `⟦` in DOM, no console errors beyond the offline allowlist.
- [ ] Commit.

### Task S5: CSP fonts + production route

**Files:** Modify `svelte.config.js` (CSP); wire a production route rendering a `frozen_page` doc (mirror `dev/blux-frozen`, fed by Prismic)

- [ ] CSP: add `https://fonts.googleapis.com` to `style-src`,
  `https://fonts.gstatic.com` to `font-src`.
- [ ] Route: render the published `frozen_page` (uid) via FrozenPage with the
  repo template + Prismic slots. (For v1 the-pointe home; multi-page later.)
- [ ] Commit.

---

## INTEGRATION / live proof

### Task X1: end-to-end

- [ ] MAINT: `blux freeze ~/Desktop/thePointe --out <tmp>` → copy
  `frozen/the-pointe.{html,style.css}` + `the-pointe.slots.json` into the
  starter route dir; run the starter fidelity gate → 15333 + 57 images.
- [ ] Push the `frozen_page` type + models to the-pointe-burbank; `migrate-frozen`
  into the-pointe-burbank (0 missing asset, unpublished). Render, human
  pixel-compare vs thepointeburbank.com. (Token session-only, sandbox-off.)
- [ ] Update memory `blux-frozen-page-approach` with results.

---

## Self-review

- **Spec coverage:** freeze (M2–M5), slots/tokens (M1/S2), Prismic type (S1),
  migrate (M7), render (S3), CSP/fonts (S5), scope single-page (X1), tests
  (M5/S4). ✓
- **Type consistency:** `Slot`/`FrozenManifest` defined M1, imported everywhere;
  token format single-sourced (`tokenFor`/`TOKEN_RE`). Starter mirrors the
  token regex in `substitute.ts` (or share via a tiny copied constant — repos
  don't share a package). ✓
- **Fallback:** S2 never emits a raw token (uses fallback map). Emit the
  fallback map from freeze (M5) as part of `slots.json` originals. ✓
- **Placeholder scan:** DOM lib in M3 must match what `src/blux/catalog` uses —
  confirm at build (node-html-parser vs linkedom) before writing M3.
