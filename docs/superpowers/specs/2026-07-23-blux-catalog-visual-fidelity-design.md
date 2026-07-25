# Blux Catalog — Visual-Fidelity Layer — Design Spec

- **Date:** 2026-07-23
- **Status:** Approved design, pending implementation plan
- **Repos touched:** `reddoor-maintenance` (the `blux` CLI: classify/emit — branch `feat/blux-catalog-emit`), `reddoor-starter` (catalog slice render + generic stylesheet — branch `feat/blux-catalog-pipeline`)
- **Completes:** [2026-07-17-blux-catalog-pipeline-design.md](2026-07-17-blux-catalog-pipeline-design.md). That spec built the catalog **content model** and named geometry as first-class slice fields ("columns / ratios / crop / background / nesting"), but explicitly deferred the **visual render** ("defines the content model, not the site design"). This spec finishes the job: fully **populate** the geometry capture in emit, and **build the render** that applies it.
- **Retires (on completion):** the legacy `src/lib/blux/` band module + `blux-presentation.json` side-car in per-site repos, once the catalog render reaches parity.

---

## 1. Context & motivation

The catalog migration is content-complete: the-pointe's `home` document publishes into Prismic (`the-pointe-burbank`) with all 16 bands, 75/75 text blocks, and every image. But the `blux_*` slices render **content-complete and visually unstyled** — they emit semantic markup (`.blux-grid__cells[data-columns]`, `.blux-cell[data-kind]`, inline band `background-color`/`min-height`) with **no CSS turning any of it into layout**. There is no `.blux-*` grid/spacing/ratio rule anywhere in the starter, and no slice carries a `<style>` block. The prior gate's "99%" was **text coverage**, and the human visual pass was deferred.

**Why the gap exists.** Two things are missing, one on each side of the contract:

1. **Emit under-populates geometry.** The catalog emit captures structure, content, band `background_image`, per-band `columns`, and (when the classifier detects them) `background_color` + `media_ratio`. It does **not** capture `min_height`, content padding, alignment, `max_content_width`, per-cell `{cols, ratio, spacing}` widths, or per-line type roles.
2. **No render layer.** None of the band prototype's proven layout technique exists on the catalog slices.

**The reference is already a generic engine.** the-pointe's live band prototype ([the-pointe.netlify.app](https://the-pointe.netlify.app/), `reddoorla/the-pointe` `main`) reached fidelity through two phases: a deterministic engine (PRs #1–#6 — design-system capture, generic `SectionBand`/`BandContent`/`Grid`/`Media` primitives, a data manifest) that got ~80–90% there, then **~15 hand-tuning rounds** (#10–#25) that each discovered one missing piece of visual data — gutters, per-band padding (`100px 4% 80px`), stack rhythm, cell containment, cover-crop, column widths, valign, button skins, an off-center column, a cell-level "white stats card." **Those rounds are the empirical enumeration of the visual dataset.** This spec captures that whole dataset **once, deterministically**, so no future site repeats the 15 rounds.

## 2. Goals / non-goals

**Goals**

- Reproduce the band prototype's fidelity (≈ live Blux) on the catalog `blux_*` slices, **generically** — every migrated site inherits it with no per-site hand-tuning.
- Capture the full visual dataset (§4) in emit as first-class slice fields; **no side-car manifest**.
- Port the band prototype's **exact** layout technique into self-contained `blux_*` slice components + one generic, site-agnostic stylesheet.
- Keep all per-site variance in the emitted `theme.css` tokens; the render CSS stays site-agnostic.

**Non-goals**

- Redesigning the-pointe's theme (palette/fonts already captured in `theme.css` / `app.css`).
- Per-record collection detail pages (still deferred, per the 2026-07-17 spec §9).
- The footer tel-number data inconsistency (a source-data decision for the operator).
- Chrome-asset CDN durability (separate track).
- Automated pixel screenshot-diff in CI (explicitly rejected — see §10).

## 3. Architecture & boundaries

Two coordinated layers, one contract between them:

- **Emit (maintenance, `src/blux/catalog/`).** The deterministic classifier + emit extract the full per-band and per-cell visual dataset from the Blux IR — the same source `blux-presentation.json` proved recoverable — into catalog slice fields. No LLM.
- **Render (starter, `src/lib/slices/Blux*` + a new `blux-layout.css`).** Each `blux_*` slice applies its fields via the band prototype's exact technique (flex-basis grid, `band-pad`, cover-fill media, collapsing-margin rhythm, type roles). Self-contained; the legacy `src/lib/blux/` band module is retired once this proves out.
- **Contract.** The catalog slice `model.json` field set (§4) + the migration-generated `catalog_page` type. Expanded to carry the visual dataset.
- **Reference.** The band prototype (≈ live Blux), validated at `/dev/blux-pointe`.

Each stage is independently testable; a change to emit is a golden-snapshot diff, a change to render is a component test, and the two meet only at the field contract.

## 4. The visual dataset (the contract) — LOCKED

Derived as the closure of the-pointe's fidelity rounds and confirmed against the live DOM (`band-pad ×27`, `txt-role-text ×47`, `object-cover ×9`, `flex justify-center` on 12/16 sections).

**Band-level** (on `blux_grid` / `blux_section` primary):
`background_color`, `background_image`, `overlay`, `min_height` (source `height`, e.g. `100vh`), `content_padding` + `content_padding_mobile`, `max_content_width`, `vertical_align`, `text_align`, `column_width` + `column_side` (off-center narrow copy column, #10).

**Cell / subgrid** (on `cells[]` / `subgrid[]` items):
`width` (per-cell flex-basis from `{cols, ratio}`; unlocks 70/30, 60/40 splits), `spacing` (distinct from width — the s-token, #11), `media_ratio`, `cover` (fill-crop vs in-flow), `valign`, `background_color` (cell-level — the white stats card, #19), `content_padding` (cell-level — `100px 4% 80px`, #20).

**Text runs:** a `role` id (`text0…text14`) per block, threaded into the richtext so the render wraps each block in a `.txt-role-textN` container (the emitted `theme.css` already ships `.txt-role-textN :is(h1…h6,p)` rules). Raw anchors keep their `ib` / `links` / `buttonsN` classes verbatim (underline + button skins ride `theme.css`).

**Specialized payloads:** `blux_carousel` (band 8 APG carousel), map widget (band 14), video cell (band 10, `blux_media`), gallery (`blux_gallery`), split (a 2-cell cover `blux_grid`).

*(Fields the emit does not yet populate: `min_height`, `content_padding`(+mobile), `max_content_width`, `vertical_align`, `text_align`, `column_width`/`column_side`, per-cell `width`/`spacing`/`cover`/`valign`, cell-level `background_color`/`content_padding`, per-line `role`.)*

## 5. Emit expansion (maintenance)

`src/blux/catalog/classify.ts` extracts the §4 dataset from the Blux IR — the identical heights/padding/alignment/per-cell-width/role data `blux-presentation.json` already encodes — and `src/blux/catalog/emit.ts` writes it into the plan's slice `primary` (band) and cell/subgrid items. This is the largest single piece of new work. Golden-snapshot tested: the plan JSON gains the populated fields with the-pointe's known values (e.g. band 7 padding `100px 4% 100px 4%`, band 0 `min_height: 100vh`, band 6 cell widths `70% / 30%`). No hand-editing of burbank — a re-migration re-emits `home` with the richer fields.

## 6. Slice model + custom type (contract)

Add the §4 fields to each `blux_*` `model.json` in the starter slice library (`src/lib/slices/Blux*`); the migration's `catalog_page` type generator picks them up; `prismicio-types` is regenerated so the render is fully typed. Fields are additive and optional purely for **graceful degradation** — a band missing a value still renders (missing `min_height` → natural height, missing `width` → equal split) rather than breaking. This is robustness, not a licence to under-populate: per the full-parity decision, emit captures the complete §4 dataset for every the-pointe band.

## 7. Render layer (starter) — self-contained port of the proven technique

One generic, site-agnostic stylesheet **`src/blux-layout.css`** (imported by `app.css`) plus per-slice component logic. The formulas are ported **verbatim** from the band prototype (re-derivation risk is low — they are simple and documented).

- **`blux_grid` / `blux_section`.** `<section class="relative isolate">` carries the background image behind content (`object-cover`), `background_color`/`min_height` inline, `overlay`. The cells wrapper is a **flex-wrap row** (`flex flex-wrap gap-y-10 md:gap-x-[4%]`). Each `BluxCell` receives `--cell-basis` from its `width`: an explicit ratio → `${ratio}%`, else an equal split `${100/cols}%`, **minus the 4% gutter reserve** `calc(${w} - ${ceil((4·(k-1)/k)·1e4)/1e4}%)`; mobile is `basis-full`, `md:basis-(--cell-basis)`. A content wrapper applies `--band-pad`(+mobile via `.band-pad`), `max-width` + `margin-inline:auto`, `text-align`, and flex-centering when `vertical_align: middle`. The off-center narrow column uses `column_width` / `column_side`.
- **`BluxCell`.** Stacks blocks in a `flow-root` so the vertical rhythm is the roles' **collapsing block margins** (never a flex gap). In-flow media renders at natural width + `aspect-ratio`; a `cover` cell renders `absolute inset-0 h-full w-full object-cover` inside a `min-height` box (intrinsic width/ratio stripped so cover wins); `self-center` when `valign`. Cell-level `background_color` + `content_padding` style the nested "card." One level of `subgrid` recurses (matches Prismic's group-nesting ceiling; deeper trees fall back to `blux_block`).
- **`blux_media` / `blux_gallery` / `blux_carousel`.** Cover-fill media in fixed-ratio frames; the carousel is the existing APG component; video cells honor emitted `playback`.
- **Map widget.** `BluxWidget` (already built) hydrates the emitted map markup.
- **`blux-layout.css`.** The pure-CSS parts only — the flex container, `.band-pad` var consumption, cover positioning, and the `md` (768px) / 700px / 767px breakpoints. Site-agnostic; all per-site values arrive through `theme.css` tokens and the slice fields.

## 8. Typography / roles

The emitted `theme.css` already carries the `@theme` tokens + `.txt-role-textN :is(h1…h6,p)` rules (per-site, measured from the original). The remaining work is **threading**: emit tags each text block with its `role` id, and the render wraps each block's richtext in a `.txt-role-textN` container so the descendant rule applies. Raw anchors keep `ib`/`links`/`buttonsN` verbatim; `.ib`/`.links` base rules live in `app.css`, the `.buttonsN` skins in `theme.css`.

## 9. Data flow

Blux export → **classify** (visual dataset) → **emit** (plan slices w/ populated fields) → **migrate** (Prismic `catalog_page`) → **render** (`blux_*` apply fields via ported technique) → page. Each stage independently testable; the field contract is the only coupling.

## 10. Testing & fidelity validation

- **Emit — golden snapshots.** The plan JSON shows the populated §4 fields with the-pointe's known values.
- **Render — component tests.** Per slice: flex-basis math (70/30, 60/40, equal, gutter reserve), `band-pad` resolution, cover-media markup, role wrapping, subgrid recursion.
- **CI hard gate — structural assertions.** The `/dev/blux-pointe` Playwright gate parses the *computed* layout and asserts it matches the band prototype's known manifest numbers: column flex-bases, `min-height` (100vh hero), resolved per-band padding, `object-cover` on the right cells, `txt-role-textN` on the right runs, subgrid nesting. Deterministic; no baseline images. **No pixel screenshot-diff in CI** (rejected — flaky, and pixel-equality is not what "faithful" means).
- **AI visual pre-check (before human review).** I render the catalog version and screenshot it against the band prototype **and** live Blux at desktop + mobile, close the gaps myself, and only surface it once I judge it genuinely close. This is a working step, not a CI gate.
- **Human sign-off.** After the pre-check passes, a one-shot screenshot comparison (desktop + mobile, vs band prototype + live Blux) for operator approval — the same way the band version was validated — before the-pointe swaps to production.

## 11. Scope / out

**In:** every band type the-pointe uses — grid, section/title, hero (tall grid), 2-col split, gallery, carousel, video, map. Retire `src/lib/blux/` after parity. **Out:** slice types the-pointe does not use; the footer tel-number data inconsistency; chrome-asset CDN durability; wiring the-pointe repo onto the CMS (resumes once the render proves out at the gate — scaffolding already staged in the `pointe-cms` worktree).

## 12. Reference & fidelity target

The band prototype (`reddoorla/the-pointe` `main`, live at [the-pointe.netlify.app](https://the-pointe.netlify.app/)) ≈ live Blux — the band version was itself tuned against the live site at desktop + mobile. The bounded target is **the closure of its fidelity rounds (#10–#25)**: reproduce, generically and from captured data, every visual decision those rounds encoded by hand.
