# Blux Catalog Visual-Fidelity Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Blux catalog `blux_*` slices render the-pointe at the band prototype's fidelity — generically, from captured data — by populating a full per-band/per-cell visual dataset in emit and porting the band prototype's exact layout technique into the slice components + one generic stylesheet.

**Architecture:** Two coordinated layers meeting at one field contract. **Emit** (reddoor-maintenance, `src/blux/catalog/`) threads already-extracted visual data (`GridToken`, `node.style`, text `role`, `blockStylesByIndex`, `blockClassDefaults`) into the catalog spec + plan. **Render** (reddoor-starter, `src/lib/slices/Blux*` + a new `src/blux-layout.css`) applies it with the ported formulas (flex-basis from cols/ratio with a 4% gutter reserve, `band-pad`, cover-fill media, flow-root collapsing-margin rhythm, `.txt-role-textN` wrapping). Self-contained; the legacy `src/lib/blux/` band module retires after.

**Tech Stack:** SvelteKit (Svelte 5 runes), Tailwind CSS v4, Prismic (`@prismicio/client`, `@prismicio/svelte`, Slice Machine), TypeScript, Vitest (jsdom) + `@testing-library/svelte`, Playwright. Emit side: Node + TypeScript + Vitest.

**Reference:** the band prototype (`reddoorla/the-pointe` `main`, live at https://the-pointe.netlify.app/) ≈ live Blux. Field set = closure of the-pointe fidelity rounds #10–#25. Design spec: [../specs/2026-07-23-blux-catalog-visual-fidelity-design.md](../specs/2026-07-23-blux-catalog-visual-fidelity-design.md).

---

## Repos, branches, worktrees

- **Render tasks (Phases 0, 1, 3-gate):** reddoor-starter worktree `scratchpad/starter-4c`, branch `feat/blux-catalog-pipeline`. Commands run from that worktree root.
- **Emit tasks (Phase 2):** reddoor-maintenance worktree `scratchpad/rm-blux-cdn-fix`, branch `feat/blux-catalog-emit` (create off the current catalog-emit HEAD if not already checked out there — see Task 7 step 1). Commands run from that worktree root.
- Never commit the pre-existing uncommitted WIP in `starter-4c` (slice `model.json`s, `svelte.config.js`, `blux-theme.css`, `blux-pointe-live/`): each task stages **only its own files** by exact path.

## The field contract (LOCKED — use these names everywhere)

Band-level (on `blux_grid` + `blux_section` `primary`). "model" = exists in model.json today; "ADD" = this plan adds it.

| Prismic field | `spec.ts` (`CatalogBase`) | source at classify time | model.json |
|---|---|---|---|
| `min_height` | `minHeight` | `blockStyles[i]["min-height"]` | exists |
| `content_padding` | `contentPadding` | `defaults.padding` ‖ `blockStyles[i].padding` | ADD |
| `content_padding_mobile` | `contentPaddingMobile` | `defaults.mobilePadding` | ADD |
| `max_content_width` | `maxContentWidth` | `defaults.maxWidth` | exists |
| `vertical_align` | `verticalAlign` | `blockStyles[i]["vertical-align"]` (`"middle"`) | exists |
| `text_align` | `textAlign` | `blockStyles[i]["text-align"]` | ADD |
| `column_width` | `columnWidth` | band `_column-width` | exists (grid only) → ADD to section |
| `column_side` | `columnSide` | band `_column-side` | ADD |
| `heading_role` | `headingRole` | heading node `role` | ADD |
| `background_color` | `backgroundColor` | `blockStyles[i]["background-color"]` | exists |

Cell-level (on `cells[]` and `subgrid[]` items). `cover`/`valign` are `Text` flags emitting the literal `"on"` (mirrors the existing `scroll_load_more: "on"` pattern).

| Prismic field | `spec.ts` (`CatalogCell`) | source | model.json |
|---|---|---|---|
| `width` | `width` (e.g. `"70%"`) | `Cell.token` (`ratio`% or `100/cols`%) | ADD |
| `spacing` | `spacing` (px number) | `Cell.token.spacing` | ADD |
| `cover` | `cover` (bool) → `"on"` | `Media.fit === "cover"` ‖ card `_fill` | ADD |
| `valign` | `valign` (bool) → `"on"` | `node.style._valign === "middle"` | ADD |
| `background_color` | `backgroundColor` | `node.style["background-color"]` | ADD |
| `content_padding` | `contentPadding` | `node.style.padding` | ADD |
| `title_role` | `titleRole` | title node `role` | ADD |
| `body_role` | `bodyRole` | body node `role` | ADD |
| `media_ratio` | `mediaRatio` | `Media.aspect` ‖ `cropRatio` | exists |

## File structure

**reddoor-starter (`starter-4c`):**
- Create `src/lib/blux-catalog/layout.ts` — pure layout math (`cellBasis`, `rowBases`, `GRID_GUTTER`). One responsibility: the flex-basis/gutter formulas. Unit-tested in isolation.
- Create `src/blux-layout.css` — the generic, site-agnostic `.blux-*` layout stylesheet.
- Modify `src/app.css` — `@import "./blux-layout.css";`.
- Modify `src/lib/blux-catalog/cell.ts` — add per-cell fields to `BluxCellData`.
- Modify `src/lib/slices/BluxGrid/model.json`, `src/lib/slices/BluxSection/model.json` — add the ADD fields.
- Modify `src/lib/slices/BluxGrid/index.svelte`, `BluxSection/index.svelte` — consume band fields + compute per-cell `--cell-basis`, wrap heading role.
- Modify `src/lib/blux-catalog/BluxCell.svelte` — flow-root rhythm, cover media, cell bg/padding/valign, role wrapping.
- Modify `src/prismicio-types.d.ts` — regenerated (never hand-edited).
- Modify `src/routes/dev/blux-pointe/fixture.json` — regenerated from the new emit (Phase 3).
- Modify `tests/gate/pointe-fidelity.spec.ts` — structural assertions.

**reddoor-maintenance (`rm-blux-cdn-fix`):**
- Modify `src/blux/catalog/spec.ts` — add fields to `CatalogBase` + `CatalogCell`.
- Modify `src/blux/catalog/cells.ts` — thread `Cell.token` + `node.style` + `role` onto cells.
- Modify `src/blux/catalog/classify.ts` — `baseOf` captures band-visual fields from threaded styles/defaults.
- Modify `src/blux/catalog/emit.ts` — emit the new fields into plan primary + cell items.
- Modify `src/cli/commands/blux.ts` — compute `blockStylesByIndex`/`blockClassDefaults`, thread into `bandToCatalog`.
- Modify `tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap` — regenerated (`-u`).

---

## Phase 0 — Layout math + field contract (starter)

### Task 1: Pure layout-math helper

Ports the band prototype's exact flex-basis formulas (`presentation.ts` `cellWidth`/`rowCellBases`/`GRID_GUTTER = 4`) into a standalone, framework-free module so the render is testable without mounting components.

**Files:**
- Create: `src/lib/blux-catalog/layout.ts`
- Test: `src/lib/blux-catalog/layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/blux-catalog/layout.test.ts
import { describe, it, expect } from "vitest";
import { GRID_GUTTER, cellWidth, gridCellBasis } from "./layout";

describe("blux-catalog layout math", () => {
  it("exposes the 4% Blux gutter", () => {
    expect(GRID_GUTTER).toBe(4);
  });

  it("cellWidth: explicit width wins, else equal split by column count", () => {
    expect(cellWidth("70%", 2)).toBe("70%");
    expect(cellWidth(undefined, 2)).toBe("50%");
    expect(cellWidth(undefined, 3)).toBe("33.3333%");
    expect(cellWidth(undefined, 1)).toBe("100%");
  });

  it("gridCellBasis: reserves the gutter for a row of k columns", () => {
    // k=2 equal: reserve = ceil((4*(2-1)/2)*1e4)/1e4 = 2 → calc(50% - 2%)
    expect(gridCellBasis(undefined, 2)).toBe("calc(50% - 2%)");
    // explicit 70/30 share, still a 2-column row → reserve 2%
    expect(gridCellBasis("70%", 2)).toBe("calc(70% - 2%)");
    expect(gridCellBasis("30%", 2)).toBe("calc(30% - 2%)");
    // k=3: reserve = ceil((4*2/3)*1e4)/1e4 = 2.6667
    expect(gridCellBasis(undefined, 3)).toBe("calc(33.3333% - 2.6667%)");
    // single full-width cell: no gutter reserved
    expect(gridCellBasis(undefined, 1)).toBe("100%");
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm test:unit -- src/lib/blux-catalog/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 3: Implement the minimal code**

```ts
// src/lib/blux-catalog/layout.ts
/** Blux's fixed inter-column gutter, in percent. Ported verbatim from the band
 * prototype (reddoorla/the-pointe presentation.ts GRID_GUTTER). Kept in sync
 * with the `md:gap-x-[4%]` literal the grid row applies. */
export const GRID_GUTTER = 4;

/** A cell's width before the gutter reserve: an explicit width (a Blux
 * `grid-2-r70` ratio, already a "%") wins; otherwise an equal split of `columns`.
 * Mirrors presentation.ts `cellWidth`: `${ratio}%` else `100/cols %`, rounded to
 * 4 decimals. */
export function cellWidth(width: string | undefined, columns: number): string {
  if (width) return width;
  const cols = columns > 0 ? columns : 1;
  return `${Math.round((100 / cols) * 10000) / 10000}%`;
}

/** One cell's `flex-basis` for a row of `k` columns, reserving the shared 4%
 * gutter out of the basis so `k` cells still fit one line — mirrors
 * presentation.ts `rowCellBases` but per-cell (the catalog's flat cells[] wraps
 * by the band `columns`; a subgrid passes its own cell count as `k`). A
 * single-column row reserves nothing. `width` is an explicit share (e.g. a
 * `grid-2-r70` ratio → `"70%"`); absent → equal split of `k`. */
export function gridCellBasis(
  width: string | undefined,
  k: number,
): string {
  const base = cellWidth(width, k);
  if (k <= 1) return base;
  const reserve = Math.ceil(((GRID_GUTTER * (k - 1)) / k) * 10000) / 10000;
  return `calc(${base} - ${reserve}%)`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:unit -- src/lib/blux-catalog/layout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blux-catalog/layout.ts src/lib/blux-catalog/layout.test.ts
git commit -m "feat(blux): pure layout math — cellWidth/rowBases/GRID_GUTTER (ported from band prototype)"
```

### Task 2: Field contract — model.json + BluxCellData + regen types

Adds the ADD fields (contract tables above) to the two container slice models and the `BluxCellData` interface, and regenerates `prismicio-types.d.ts`. No behavior yet — just the schema the render (Phase 1) and emit (Phase 2) both bind to.

**Files:**
- Modify: `src/lib/slices/BluxGrid/model.json` (primary + `cells.config.fields` + `cells.config.fields.subgrid.config.fields`)
- Modify: `src/lib/slices/BluxSection/model.json` (same)
- Modify: `src/lib/blux-catalog/cell.ts` (`BluxCellData`)
- Modify (generated): `src/prismicio-types.d.ts`, and the slices' `mocks.json`
- Create (if missing): `scratchpad/regen-types.mjs`

- [ ] **Step 1: Add band-level ADD fields to `BluxGrid/model.json` and `BluxSection/model.json` `primary`**

In **both** files, inside `variations[0].primary`, add these three fields (alongside the existing `max_content_width`/`vertical_align`/`min_height`):

```json
        "content_padding": {
          "type": "Text",
          "config": { "label": "content_padding" }
        },
        "content_padding_mobile": {
          "type": "Text",
          "config": { "label": "content_padding_mobile" }
        },
        "text_align": {
          "type": "Select",
          "config": { "label": "text_align", "options": ["left", "center", "right"] }
        },
        "column_side": {
          "type": "Select",
          "config": { "label": "column_side", "options": ["left", "right"] }
        },
        "heading_role": {
          "type": "Text",
          "config": { "label": "heading_role" }
        }
```

Also add `column_width` to `BluxSection/model.json` primary only (BluxGrid already has it):

```json
        "column_width": {
          "type": "Text",
          "config": { "label": "column_width" }
        }
```

- [ ] **Step 2: Add per-cell ADD fields to both models**

In **both** files, add these fields inside `primary.cells.config.fields` **and** (except `title_role`/`body_role` which subgrid text also needs — add them there too) inside `primary.cells.config.fields.subgrid.config.fields`:

```json
              "width": { "type": "Text", "config": { "label": "width" } },
              "spacing": { "type": "Number", "config": { "label": "spacing" } },
              "cover": { "type": "Text", "config": { "label": "cover (on)" } },
              "valign": { "type": "Text", "config": { "label": "valign (on)" } },
              "background_color": { "type": "Text", "config": { "label": "background_color" } },
              "content_padding": { "type": "Text", "config": { "label": "content_padding" } },
              "title_role": { "type": "Text", "config": { "label": "title_role" } },
              "body_role": { "type": "Text", "config": { "label": "body_role" } }
```

- [ ] **Step 3: Extend `BluxCellData` in `src/lib/blux-catalog/cell.ts`**

Read the current file first, then add the optional fields to the exported cell type (names match the Prismic field keys, all optional):

```ts
  // --- visual-fidelity fields (Blux catalog visual layer) ---
  width?: string;
  spacing?: number | null;
  cover?: string | null;
  valign?: string | null;
  background_color?: string | null;
  content_padding?: string | null;
  title_role?: string | null;
  body_role?: string | null;
```

(Place them inside the existing `BluxCellData` type/interface next to `media_ratio`. Keep the file's existing style — if `media_ratio` is typed `string | null`, match that.)

- [ ] **Step 4: Ensure the type-regen script exists**

If `scratchpad/regen-types.mjs` is absent, create it:

```js
// scratchpad/regen-types.mjs — drives Slice Machine manager's updateSlice to
// rewrite src/prismicio-types.d.ts + the slice's mocks.json headlessly.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const [, , repoRoot, libraryID, modelPath] = process.argv;
const pnpmDir = path.join(repoRoot, "node_modules/.pnpm");
const managerPkg = readdirSync(pnpmDir).find((d) =>
  d.startsWith("@slicemachine+manager@"),
);
const entry = path.join(
  pnpmDir,
  managerPkg,
  "node_modules/@slicemachine/manager/dist/index.cjs",
);
const { createSliceMachineManager } = require(entry);
const model = JSON.parse(readFileSync(modelPath, "utf8"));
const manager = createSliceMachineManager();
await manager.plugins.initPlugins();
await manager.slices.updateSlice({ libraryID, model });
```

- [ ] **Step 5: Regenerate types for both changed slices**

Run (from the `starter-4c` worktree root):

```bash
node scratchpad/regen-types.mjs "$PWD" "./src/lib/slices" "src/lib/slices/BluxGrid/model.json"
node scratchpad/regen-types.mjs "$PWD" "./src/lib/slices" "src/lib/slices/BluxSection/model.json"
git checkout -- $(git diff --name-only 'src/lib/slices/*/mocks.json' | grep -v -E 'BluxGrid|BluxSection') 2>/dev/null || true
```

Expected: `src/prismicio-types.d.ts` now declares the new fields on `BluxGridSliceDefaultPrimary`, `BluxSectionSliceDefaultPrimary`, and the cells/subgrid item types. `BluxGrid/mocks.json` + `BluxSection/mocks.json` regenerate. Revert incidental re-randomized OTHER slice mocks.

- [ ] **Step 6: Verify types compile**

Run: `pnpm check`
Expected: PASS (no type errors; new fields are optional so existing code is unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/lib/slices/BluxGrid/model.json src/lib/slices/BluxSection/model.json \
        src/lib/slices/BluxGrid/mocks.json src/lib/slices/BluxSection/mocks.json \
        src/lib/blux-catalog/cell.ts src/prismicio-types.d.ts scratchpad/regen-types.mjs
git commit -m "feat(blux): add visual-fidelity fields to catalog slice models + BluxCellData"
```

---

## Phase 1 — Render layer (starter)

**Scope:** the-pointe's `home` fixture uses only `blux_grid` (8), `blux_section` (4), `blux_block` (3), `blux_carousel` (1), all built on `BluxCell`. Phase 1 covers exactly those. `blux_gallery`/`blux_media`/`blux_media_text`/`blux_text`/`blux_collection`/`blux_table`/`blux_embed` are NOT used by the-pointe — their visual polish is deferred (out of scope here; they still render structurally).

### Task 3: The generic layout stylesheet

CSS can't be unit-tested in jsdom; its effect is verified by the structural gate (Phase 3, Task 12) and the visual pre-check. This task delivers the stylesheet + wires it in; the "test" is lint + typecheck + build green.

**Files:**
- Create: `src/blux-layout.css`
- Modify: `src/app.css` (add one `@import`)

- [ ] **Step 1: Create `src/blux-layout.css`**

```css
/* Generic, site-agnostic layout for the Blux catalog `blux_*` slices. Ports the
   band prototype's flexbox technique — percentage flex-basis from cols/ratio
   with a 4% gutter (see layout.ts gridCellBasis), cover-fill media, flow-root
   stack rhythm — onto the catalog markup. Per-site values arrive via slice
   fields (inline styles / CSS vars) and theme.css tokens; nothing here is
   site-specific. Imported once from app.css. */

/* ── Band: full-bleed section with a background layer ───────────────────── */
.blux-grid,
.blux-section {
  position: relative;
  isolation: isolate;
  width: 100%;
}
.blux-grid__bg,
.blux-section__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Content wrapper = the cells row (max-width, padding, flex grid) ────── */
.blux-grid__cells,
.blux-section__cells {
  display: flex;
  flex-wrap: wrap;
  column-gap: 4%; /* the reserved Blux gutter — matches layout.ts GRID_GUTTER */
  row-gap: 2.5rem;
  max-width: var(--blux-max-width, 1280px);
  margin-inline: auto;
  padding: var(--band-pad, 0 4%);
  align-content: flex-start;
}
@media (max-width: 700px) {
  .blux-grid__cells,
  .blux-section__cells {
    padding: var(--band-pad-m, var(--band-pad, 0 4%));
  }
}
/* vertical centering when the band pins its own height */
.blux-grid__cells[data-align="middle"],
.blux-section__cells[data-align="middle"] {
  align-content: center;
  min-height: inherit;
}

/* ── Cell: a flex item, full-width on mobile, --cell-basis at md+ ───────── */
.blux-cell {
  display: flow-root; /* contains child block margins = the stack rhythm */
  min-width: 0;
  flex-basis: 100%;
}
@media (min-width: 768px) {
  .blux-cell {
    flex-basis: var(--cell-basis, auto);
  }
}
.blux-cell[data-valign="on"] {
  align-self: center;
}

/* ── Media: in-flow natural, or cover-fill a ratio box ─────────────────── */
.blux-cell__media img {
  display: block;
  max-width: 100%;
  height: auto;
}
.blux-cell__media[data-cover="on"] {
  position: relative;
  aspect-ratio: var(--media-ratio, 3 / 2);
}
.blux-cell__media[data-cover="on"] img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Subgrid: nested flex row inside a cell ────────────────────────────── */
.blux-subgrid {
  display: flex;
  flex-wrap: wrap;
  column-gap: 4%;
  row-gap: 1.5rem;
  width: 100%;
}
```

- [ ] **Step 2: Import it from `src/app.css`**

Add directly under the existing `@import "./blux-theme.css";` (line 8):

```css
@import "./blux-layout.css";
```

- [ ] **Step 3: Verify lint + typecheck + build**

Run: `pnpm lint && pnpm check && pnpm build`
Expected: all PASS (a new CSS import + file is valid; no TS/Svelte impact).

- [ ] **Step 4: Commit**

```bash
git add src/blux-layout.css src/app.css
git commit -m "feat(blux): generic blux-layout.css — flex-basis grid, cover media, stack rhythm"
```

### Task 4: BluxGrid + BluxSection consume the band + per-cell layout fields

Wires the band fields (max-width, padding + mobile, text-align, vertical-align) onto the cells wrapper, computes each cell's `--cell-basis` via `gridCellBasis`, and wraps the heading in its type-role container.

**Files:**
- Modify: `src/lib/slices/BluxGrid/index.svelte`
- Modify: `src/lib/slices/BluxSection/index.svelte`
- Modify: `src/lib/slices/BluxGrid/BluxGrid.test.ts`
- Modify: `src/lib/slices/BluxSection/BluxSection.test.ts`

- [ ] **Step 1: Write the failing tests (BluxGrid)**

Append to `src/lib/slices/BluxGrid/BluxGrid.test.ts`:

```ts
it("gives each cell a --cell-basis reserving the 4% gutter for the column count", () => {
  const twoCol = {
    slice_type: "blux_grid",
    variation: "default",
    primary: {
      columns: 2,
      max_content_width: "1100px",
      content_padding: "80px 4%",
      cells: [
        { kind: "text", title: rt("heading3", "A"), subgrid: [] },
        { kind: "text", width: "70%", title: rt("heading3", "B"), subgrid: [] },
      ],
    },
  } as unknown as Content.BluxGridSlice;

  const { container } = render(BluxGrid, { props: { slice: twoCol } });
  const cellsEl = container.querySelector(".blux-grid__cells") as HTMLElement;
  expect(cellsEl.getAttribute("style")).toContain("max-width: 1100px");
  expect(cellsEl.getAttribute("style")).toContain("--band-pad: 80px 4%");
  const cells = container.querySelectorAll<HTMLElement>(".blux-grid__cells > .blux-cell");
  // equal (no width) in a 2-col row → calc(50% - 2%); explicit 70% → calc(70% - 2%)
  expect(cells[0].style.getPropertyValue("--cell-basis")).toBe("calc(50% - 2%)");
  expect(cells[1].style.getPropertyValue("--cell-basis")).toBe("calc(70% - 2%)");
});

it("wraps the heading in its type-role container when heading_role is set", () => {
  const withRole = {
    slice_type: "blux_grid",
    variation: "default",
    primary: {
      columns: 1,
      heading_role: "text5",
      heading: rt("heading2", "The Space"),
      cells: [{ kind: "text", title: rt("heading3", "A"), subgrid: [] }],
    },
  } as unknown as Content.BluxGridSlice;
  const { container } = render(BluxGrid, { props: { slice: withRole } });
  expect(container.querySelector(".txt-role-text5 h2")).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:unit -- src/lib/slices/BluxGrid/BluxGrid.test.ts`
Expected: FAIL — `--cell-basis` empty, no `.txt-role-text5`.

- [ ] **Step 3: Rewrite `src/lib/slices/BluxGrid/index.svelte`**

```svelte
<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import BluxCell from "$lib/blux-catalog/BluxCell.svelte";
  import BluxWidget from "$lib/blux-catalog/BluxWidget.svelte";
  import type { BluxCellData } from "$lib/blux-catalog/cell";
  import { gridCellBasis } from "$lib/blux-catalog/layout";

  let { slice }: { slice: Content.BluxGridSlice } = $props();
  type Cell = Content.BluxGridSliceDefaultPrimaryCellsItem;
  let cells = $derived((slice.primary.cells ?? []) as Cell[]);
  let columns = $derived(slice.primary.columns ?? 1);
  let bases = $derived(
    cells.map((c) => gridCellBasis((c as BluxCellData).width || undefined, columns)),
  );

  let bandStyle = $derived(
    [
      isFilled.keyText(slice.primary.background_color)
        ? `background-color:${slice.primary.background_color}`
        : "",
      isFilled.keyText(slice.primary.min_height)
        ? `min-height:${slice.primary.min_height}`
        : "",
    ]
      .filter(Boolean)
      .join(";"),
  );

  let cellsStyle = $derived(
    [
      isFilled.keyText(slice.primary.max_content_width)
        ? `max-width:${slice.primary.max_content_width}`
        : "",
      isFilled.keyText(slice.primary.content_padding)
        ? `--band-pad:${slice.primary.content_padding}`
        : "",
      isFilled.keyText(slice.primary.content_padding_mobile)
        ? `--band-pad-m:${slice.primary.content_padding_mobile}`
        : "",
      isFilled.select(slice.primary.text_align)
        ? `text-align:${slice.primary.text_align}`
        : "",
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<section class="blux-grid" data-overlay={slice.primary.overlay} style={bandStyle}>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage field={slice.primary.background_image} class="blux-grid__bg" />
  {/if}
  {#if isFilled.richText(slice.primary.heading)}
    {#if isFilled.keyText(slice.primary.heading_role)}
      <div class="txt-role-{slice.primary.heading_role}">
        <PrismicRichText field={slice.primary.heading} />
      </div>
    {:else}
      <PrismicRichText field={slice.primary.heading} />
    {/if}
  {/if}
  <div
    class="blux-grid__cells"
    data-columns={columns}
    data-align={slice.primary.vertical_align}
    style={cellsStyle}
  >
    {#each cells as cell, i (cell)}
      <BluxCell cell={cell as unknown as BluxCellData} basis={bases[i]} />
    {/each}
  </div>
  {#if isFilled.keyText(slice.primary.widget_html)}
    <BluxWidget kind={slice.primary.widget_kind} html={slice.primary.widget_html} />
  {/if}
</section>
```

- [ ] **Step 4: Apply the same changes to `src/lib/slices/BluxSection/index.svelte`**

`BluxSection` has no `columns` field, so its cells all sit in one row — pass `cells.length` as the column count:

```svelte
<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import BluxCell from "$lib/blux-catalog/BluxCell.svelte";
  import BluxWidget from "$lib/blux-catalog/BluxWidget.svelte";
  import type { BluxCellData } from "$lib/blux-catalog/cell";
  import { gridCellBasis } from "$lib/blux-catalog/layout";

  let { slice }: { slice: Content.BluxSectionSlice } = $props();
  type Cell = Content.BluxSectionSliceDefaultPrimaryCellsItem;
  let cells = $derived((slice.primary.cells ?? []) as Cell[]);
  let bases = $derived(
    cells.map((c) => gridCellBasis((c as BluxCellData).width || undefined, cells.length || 1)),
  );

  let bandStyle = $derived(
    [
      isFilled.keyText(slice.primary.background_color)
        ? `background-color:${slice.primary.background_color}`
        : "",
      isFilled.keyText(slice.primary.min_height)
        ? `min-height:${slice.primary.min_height}`
        : "",
    ]
      .filter(Boolean)
      .join(";"),
  );

  let cellsStyle = $derived(
    [
      isFilled.keyText(slice.primary.max_content_width)
        ? `max-width:${slice.primary.max_content_width}`
        : "",
      isFilled.keyText(slice.primary.content_padding)
        ? `--band-pad:${slice.primary.content_padding}`
        : "",
      isFilled.keyText(slice.primary.content_padding_mobile)
        ? `--band-pad-m:${slice.primary.content_padding_mobile}`
        : "",
      isFilled.select(slice.primary.text_align)
        ? `text-align:${slice.primary.text_align}`
        : "",
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<section
  class="blux-section"
  data-cells={cells.length}
  data-overlay={slice.primary.overlay}
  style={bandStyle}
>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage field={slice.primary.background_image} class="blux-section__bg" />
  {/if}
  {#if isFilled.richText(slice.primary.heading)}
    {#if isFilled.keyText(slice.primary.heading_role)}
      <div class="txt-role-{slice.primary.heading_role}">
        <PrismicRichText field={slice.primary.heading} />
      </div>
    {:else}
      <PrismicRichText field={slice.primary.heading} />
    {/if}
  {/if}
  <div
    class="blux-section__cells"
    data-align={slice.primary.vertical_align}
    style={cellsStyle}
  >
    {#each cells as cell, i (cell)}
      <BluxCell cell={cell as unknown as BluxCellData} basis={bases[i]} />
    {/each}
  </div>
  {#if isFilled.keyText(slice.primary.widget_html)}
    <BluxWidget kind={slice.primary.widget_kind} html={slice.primary.widget_html} />
  {/if}
</section>
```

Add the matching `BluxSection.test.ts` case (same shape as the BluxGrid basis/role tests, using `cells.length` as the column count — two cells → `calc(50% - 2%)` each).

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test:unit -- src/lib/slices/BluxGrid/BluxGrid.test.ts src/lib/slices/BluxSection/BluxSection.test.ts && pnpm check`
Expected: PASS (existing cases still green; new basis/role cases pass). `isFilled.select`/`isFilled.keyText` exist on `@prismicio/client`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/slices/BluxGrid/index.svelte src/lib/slices/BluxSection/index.svelte \
        src/lib/slices/BluxGrid/BluxGrid.test.ts src/lib/slices/BluxSection/BluxSection.test.ts
git commit -m "feat(blux): BluxGrid/BluxSection apply band + per-cell layout fields"
```

### Task 5: BluxCell — cover media, cell card, valign, role wrapping, subgrid basis

**Files:**
- Modify: `src/lib/blux-catalog/BluxCell.svelte`
- Create: `src/lib/blux-catalog/BluxCell.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/blux-catalog/BluxCell.test.ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import BluxCell from "./BluxCell.svelte";
import type { BluxCellData } from "./cell";

afterEach(() => cleanup());
const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
const img = { url: "https://cdn/x.jpg", alt: "x", dimensions: { width: 800, height: 600 } };

describe("BluxCell visual fields", () => {
  it("sets --cell-basis from the basis prop and the cell's card style", () => {
    const cell = {
      kind: "text",
      title: rt("heading3", "Card"),
      background_color: "#ffffff",
      content_padding: "100px 4% 80px",
      valign: "on",
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, {
      props: { cell, basis: "calc(30% - 2%)" },
    });
    const el = container.querySelector(".blux-cell") as HTMLElement;
    expect(el.style.getPropertyValue("--cell-basis")).toBe("calc(30% - 2%)");
    expect(el.getAttribute("style")).toContain("background-color: rgb(255, 255, 255)");
    expect(el.getAttribute("style")).toContain("padding: 100px 4% 80px");
    expect(el.getAttribute("data-valign")).toBe("on");
  });

  it("marks cover media so the stylesheet crops it", () => {
    const cell = { kind: "media", media: img, cover: "on", media_ratio: "3:2" } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    expect(container.querySelector(".blux-cell__media[data-cover='on']")).not.toBeNull();
  });

  it("wraps title/body in their type-role containers", () => {
    const cell = {
      kind: "text",
      title: rt("heading3", "T"),
      title_role: "text11",
      body: rt("paragraph", "B"),
      body_role: "text1",
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    expect(container.querySelector(".txt-role-text11 h3")).not.toBeNull();
    expect(container.querySelector(".txt-role-text1 p")).not.toBeNull();
  });

  it("gives each subgrid cell its own basis for a row of that many cells", () => {
    const cell = {
      kind: "subgrid",
      subgrid: [
        { kind: "text", title: rt("heading4", "L") },
        { kind: "text", title: rt("heading4", "R") },
      ],
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    const subCells = container.querySelectorAll<HTMLElement>(".blux-subgrid > .blux-cell");
    expect(subCells).toHaveLength(2);
    expect(subCells[0].style.getPropertyValue("--cell-basis")).toBe("calc(50% - 2%)");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:unit -- src/lib/blux-catalog/BluxCell.test.ts`
Expected: FAIL — `basis` prop unknown, no card style, no role wrap.

- [ ] **Step 3: Rewrite `src/lib/blux-catalog/BluxCell.svelte`**

```svelte
<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import type { BluxCellData } from "$lib/blux-catalog/cell";
  import { gridCellBasis } from "$lib/blux-catalog/layout";
  import Self from "./BluxCell.svelte";

  let { cell, basis }: { cell: BluxCellData; basis?: string } = $props();
  let sub = $derived(cell.subgrid ?? []);
  let subBases = $derived(sub.map((s) => gridCellBasis(s.width || undefined, sub.length || 1)));

  // "H:W"/"W:H" ratio string → a CSS aspect-ratio; used only by cover media.
  let mediaRatio = $derived(
    cell.media_ratio ? cell.media_ratio.replace(":", " / ") : undefined,
  );

  let style = $derived(
    [
      basis ? `--cell-basis:${basis}` : "",
      mediaRatio ? `--media-ratio:${mediaRatio}` : "",
      cell.background_color ? `background-color:${cell.background_color}` : "",
      cell.content_padding ? `padding:${cell.content_padding}` : "",
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<div
  class="blux-cell"
  data-kind={cell.kind}
  data-valign={cell.valign || undefined}
  {style}
>
  {#if isFilled.image(cell.media)}
    <div class="blux-cell__media" data-ratio={cell.media_ratio} data-cover={cell.cover || undefined}>
      <PrismicImage field={cell.media} />
    </div>
  {/if}
  {#if isFilled.richText(cell.title)}
    {#if cell.title_role}
      <div class="txt-role-{cell.title_role}"><PrismicRichText field={cell.title} /></div>
    {:else}<PrismicRichText field={cell.title} />{/if}
  {/if}
  {#if isFilled.richText(cell.body)}
    {#if cell.body_role}
      <div class="txt-role-{cell.body_role}"><PrismicRichText field={cell.body} /></div>
    {:else}<PrismicRichText field={cell.body} />{/if}
  {/if}
  {#if isFilled.keyText(cell.embed_html)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html cell.embed_html}
  {/if}
  {#if isFilled.link(cell.link)}<PrismicLink field={cell.link}
      >{cell.link_label || "Read more"}</PrismicLink
    >{/if}
  {#if sub.length}
    <div class="blux-subgrid" data-cells={sub.length}>
      {#each sub as s, i (s)}<Self cell={s} basis={subBases[i]} />{/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:unit -- src/lib/blux-catalog/BluxCell.test.ts && pnpm check`
Expected: PASS (4 new cases). `cell.link`/`cell.link_label`/`cell.embed_html` still read as before (already on `BluxCellData`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blux-catalog/BluxCell.svelte src/lib/blux-catalog/BluxCell.test.ts
git commit -m "feat(blux): BluxCell — cover media, card style, valign, role wrap, subgrid basis"
```

### Task 6: BluxCarousel cover frames + BluxBlock verification

`blux_carousel` (band 8) needs its frames to cover-fill; `blux_block` (bands via the fallback) already renders emitted inline styles — verify it still renders after the layout import and add a guard test.

**Files:**
- Modify: `src/lib/slices/BluxCarousel/index.svelte` (+ its `.test.ts`)
- Test (guard): `src/lib/slices/BluxBlock/BluxBlock.test.ts`

- [ ] **Step 1: Read `src/lib/slices/BluxCarousel/index.svelte`** and confirm how it renders frames (it reuses `BluxCell`/`BluxWidget`). If frames are `BluxCell` media, they already gain cover support from Task 5 when the cell carries `cover: "on"`; no change needed beyond confirming the carousel frame wrapper has a defined height. If frames render `<PrismicImage>` directly, add `class="blux-carousel__frame"` and a rule to `blux-layout.css`:

```css
.blux-carousel__frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

- [ ] **Step 2: Write a guard test for BluxBlock** (`src/lib/slices/BluxBlock/BluxBlock.test.ts`, if absent) asserting the payload tree renders with its inline band style intact:

```ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxBlock from "./index.svelte";

afterEach(() => cleanup());

it("renders the payload tree with its inline wrap style", () => {
  const slice = {
    slice_type: "blux_block",
    variation: "default",
    primary: {
      payload: JSON.stringify({
        tag: "div",
        style: { "background-color": "#eeeeee" },
        children: [{ tag: "p", html: "Hello" }],
      }),
    },
  } as unknown as Content.BluxBlockSlice;
  const { container, getByText } = render(BluxBlock, { props: { slice } });
  expect(getByText("Hello")).not.toBeNull();
  expect(container.querySelector("[style*='background-color']")).not.toBeNull();
});
```

- [ ] **Step 3: Run the affected tests + build**

Run: `pnpm test:unit -- src/lib/slices/BluxCarousel src/lib/slices/BluxBlock && pnpm build`
Expected: PASS; build green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/slices/BluxCarousel src/lib/slices/BluxBlock/BluxBlock.test.ts src/blux-layout.css
git commit -m "feat(blux): carousel cover frames + BluxBlock render guard"
```

---

## Phase 2 — Emit capture (reddoor-maintenance)

All Phase-2 tasks run in the reddoor-maintenance worktree `scratchpad/rm-blux-cdn-fix`. **Test command:** `pnpm vitest run <file>`. The visual data is already extracted upstream (`GridToken` on `Cell.token`; `node.style` `background-color`/`padding`/`_valign`/`_fill` from `parse-grid.ts`; text `role`; `blockStylesByIndex`/`blockClassDefaults` from `block-styles.ts`) — these tasks **thread** it into the catalog spec, they do not re-extract it.

### Task 7: Branch + spec types

**Files:**
- Modify: `src/blux/catalog/spec.ts`

- [ ] **Step 1: Check out the emit branch**

```bash
cd <rm-blux-cdn-fix worktree root>
git fetch origin
git checkout feat/blux-catalog-emit || git checkout -b feat/blux-catalog-emit origin/feat/blux-catalog-emit
git log --oneline -1
```

- [ ] **Step 2: Add band-visual fields to `CatalogBase`** (`src/blux/catalog/spec.ts`, the `CatalogBase` type ~line 29). Insert after `backgroundColor?: string;`:

```ts
  minHeight?: string;
  contentPadding?: string;
  contentPaddingMobile?: string;
  maxContentWidth?: string;
  verticalAlign?: string;
  textAlign?: string;
  columnWidth?: string;
  columnSide?: string;
  headingRole?: string;
```

- [ ] **Step 3: Add per-cell fields to `CatalogCell`** (~line 11). Insert after `mediaRatio?: string;`:

```ts
  width?: string;
  spacing?: number;
  cover?: boolean;
  valign?: boolean;
  backgroundColor?: string;
  contentPadding?: string;
  titleRole?: string;
  bodyRole?: string;
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm vitest run tests/blux/catalog/emit.test.ts`
Expected: PASS (types are additive/optional; existing tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/blux/catalog/spec.ts
git commit -m "feat(blux): CatalogBase/CatalogCell carry the visual-fidelity fields"
```

### Task 8: Thread per-cell token + style + role in `cells.ts`

**Files:**
- Modify: `src/blux/catalog/cells.ts`
- Test: `tests/blux/catalog/cells.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/blux/catalog/cells.test.ts`:

```ts
import { nodeToCells } from "../../../src/blux/catalog/cells.js";
import type { Node, Cell } from "../../../src/blux/grid/types.js";

it("threads token width/spacing, card style, and text roles onto cells", () => {
  const row: Node = {
    kind: "row",
    cells: [
      {
        token: { cols: 2, ratio: 70, raw: "grid-2-r70" },
        node: {
          kind: "stack",
          style: { "background-color": "#fff", padding: "100px 4% 80px", _valign: "middle" },
          children: [
            { kind: "heading", level: 3, html: "Card", role: "text5" },
            { kind: "body", html: "<p>Body</p>", role: "text1" },
          ],
        },
      },
      {
        token: { cols: 2, ratio: 30, raw: "grid-2-r30" },
        node: { kind: "media", media: { kind: "image", assetId: "u1", fit: "cover" } },
      },
    ],
  } as unknown as Node;

  const cells = nodeToCells(row);
  expect(cells[0]).toMatchObject({
    width: "70%",
    backgroundColor: "#fff",
    contentPadding: "100px 4% 80px",
    valign: true,
    titleRole: "text5",
    bodyRole: "text1",
  });
  expect(cells[1]).toMatchObject({ width: "30%", kind: "media", cover: true });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/blux/catalog/cells.test.ts`
Expected: FAIL — `width`/`backgroundColor`/`titleRole` undefined.

- [ ] **Step 3: Implement — thread the token + style + roles**

In `src/blux/catalog/cells.ts`:

(a) Import the token type at the top if not present: `import type { GridToken } from "../grid/types.js";`

(b) Add helpers near the top:

```ts
/** Per-cell visual fields recovered from the grid token + the (unboxed) node's
 * card style. `token.ratio` is the cell's width share; card keys land on
 * `node.style` via parse-grid's withCardStyle. */
function visualFieldsOf(u: Node, token?: GridToken): Partial<CatalogCell> {
  const style = "style" in u && u.style ? u.style : {};
  const media = collectMedia(u)[0];
  const out: Partial<CatalogCell> = {};
  if (typeof token?.ratio === "number") out.width = `${token.ratio}%`;
  if (typeof token?.spacing === "number") out.spacing = token.spacing;
  if (style["background-color"]) out.backgroundColor = style["background-color"];
  if (style["padding"]) out.contentPadding = style["padding"];
  if (style["_valign"] === "middle") out.valign = true;
  if (style["_fill"] === "column" || media?.fit === "cover") out.cover = true;
  return out;
}
```

(c) Extend `textOf` to also return roles. Change its return type and, in the loop, capture the FIRST heading's `role` as `titleRole` and the FIRST body's `role` as `bodyRole`:

```ts
function textOf(n: Node): { title?: string; body?: string; titleRole?: string; bodyRole?: string } {
  let title: string | undefined;
  let titleRole: string | undefined;
  const bodyParts: string[] = [];
  let bodyRole: string | undefined;
  for (const t of collectText(n)) {
    if (t.kind === "heading") {
      if (blockPlainText(t.html) === "") continue;
      const wrapped = `<h${t.level}>${t.html}</h${t.level}>`;
      if (title === undefined) { title = wrapped; titleRole = t.role; }
      else bodyParts.push(wrapped);
    } else if (t.kind === "body") {
      if (t.html) { bodyParts.push(wrapBare(t.html)); bodyRole ??= t.role; }
    } else if (t.kind === "subtitle") {
      bodyParts.push(`<p>${t.text}</p>`);
    }
  }
  return {
    ...(title ? { title } : {}),
    ...(bodyParts.length ? { body: bodyParts.join("\n") } : {}),
    ...(titleRole ? { titleRole } : {}),
    ...(bodyRole ? { bodyRole } : {}),
  };
}
```

(d) Thread the token into `buildCell`. Change its signature and every call site:

```ts
function buildCell(node: Node, depth: number, state: CellBuildState, token?: GridToken): CatalogCell {
  const u = unbox(node);
  if (u.kind === "row" && depth === 0) {
    return {
      kind: "subgrid",
      subgrid: u.cells.map((c) => buildCell(c.node, depth + 1, state, c.token)),
    };
  }
  // ... existing allMedia / depth-0 split logic unchanged, but spread visual fields
  //     and text roles into each returned cell:
  const vis = visualFieldsOf(u, token);
  const { title, body, titleRole, bodyRole } = textOf(u);
  // media branch:
  //   return { kind: "media", ...(media?{media}:{}), ...(title?{title}:{}), ...(body?{body}:{}),
  //            ...(embedHtml?{embedHtml}:{}), ...(titleRole?{titleRole}:{}), ...(bodyRole?{bodyRole}:{}), ...vis };
  // text/embed branch: same spread of ...vis, titleRole, bodyRole.
}
```

Update `buildCells` to pass the token: `u.cells.map((c) => buildCell(c.node, 0, state, c.token))` (and the `u.children.map((c) => buildCell(c, 0, state))` stack branch keeps `token` undefined — stack children carry no row token). Update the exported `cellFromNode` wrapper to call `buildCell(node, 0, { flattened: false }, undefined)`.

- [ ] **Step 4: Run tests + the existing golden**

Run: `pnpm vitest run tests/blux/catalog/cells.test.ts tests/blux/catalog/emit.test.ts`
Expected: `cells.test.ts` PASS; `emit.test.ts` still PASS (emit doesn't read the new cell fields yet).

- [ ] **Step 5: Commit**

```bash
git add src/blux/catalog/cells.ts tests/blux/catalog/cells.test.ts
git commit -m "feat(blux): capture per-cell width/spacing/card-style/roles from the grid tree"
```

### Task 9: Capture band-level visuals in `classify.ts` + wire the CLI

**Files:**
- Modify: `src/blux/catalog/classify.ts` (`baseOf`, `BandToCatalogOptions`, `splitHeadingAndCells`)
- Modify: `src/cli/commands/blux.ts` (compute + thread the style/default records)
- Test: `tests/blux/catalog/classify.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/blux/catalog/classify.test.ts`:

```ts
import { bandToCatalog } from "../../../src/blux/catalog/classify.js";
import type { Band } from "../../../src/blux/grid/types.js";

it("captures band-level min-height, padding, max-width, alignment from threaded styles", () => {
  const band = {
    index: 0,
    root: { kind: "stack", children: [{ kind: "heading", level: 2, html: "The Space", role: "text2" }] },
  } as unknown as Band;
  const spec = bandToCatalog(band, {
    styles: { 0: { "min-height": "100vh", "text-align": "center", "background-color": "#053a6c" } },
    defaults: { padding: "100px 4%", mobilePadding: "40px 4%", maxWidth: "1280px" },
  });
  expect(spec).toMatchObject({
    minHeight: "100vh",
    textAlign: "center",
    backgroundColor: "#053a6c",
    contentPadding: "100px 4%",
    contentPaddingMobile: "40px 4%",
    maxContentWidth: "1280px",
    headingRole: "text2",
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/blux/catalog/classify.test.ts`
Expected: FAIL — `bandToCatalog` ignores `styles`/`defaults`; fields undefined.

- [ ] **Step 3: Implement — `baseOf` reads the threaded records**

In `src/blux/catalog/classify.ts`:

(a) Extend `BandToCatalogOptions` (~line 23) with:

```ts
  styles?: Record<number, Record<string, string>>;
  defaults?: { padding?: string; mobilePadding?: string; maxWidth?: string };
```

(b) Rewrite `baseOf` (~line 35) to take `opts` and fill the band-visual fields:

```ts
const baseOf = (band: Band, opts?: BandToCatalogOptions): CatalogBaseFields => {
  const st = opts?.styles?.[band.index] ?? {};
  const def = opts?.defaults ?? {};
  return {
    index: band.index,
    ...(band.background ? { background: band.background } : {}),
    ...(st["background-color"] ? { backgroundColor: st["background-color"] } : {}),
    ...(st["min-height"] ? { minHeight: st["min-height"] } : {}),
    ...(st["text-align"] ? { textAlign: st["text-align"] } : {}),
    ...(st["vertical-align"] === "middle" ? { verticalAlign: "middle" } : {}),
    ...(st["padding"] ?? def.padding ? { contentPadding: st["padding"] ?? def.padding } : {}),
    ...(def.mobilePadding ? { contentPaddingMobile: def.mobilePadding } : {}),
    ...(def.maxWidth ? { maxContentWidth: def.maxWidth } : {}),
    ...(st["_column-width"] ? { columnWidth: st["_column-width"] } : {}),
    ...(st["_column-side"] ? { columnSide: st["_column-side"] } : {}),
  };
};
```

Widen `CatalogBaseFields` (~line 17) to include the new optional string fields (`backgroundColor?`, `minHeight?`, `textAlign?`, `verticalAlign?`, `contentPadding?`, `contentPaddingMobile?`, `maxContentWidth?`, `columnWidth?`, `columnSide?`). Pass `opts` at every `baseOf(band)` call site in the container routes (`...baseOf(band, opts)`).

(c) In `splitHeadingAndCells` (~line 429), capture the heading node's `role` onto the returned spec as `headingRole` (the heading node is the first heading under `band.root`; read its `role`).

- [ ] **Step 4: Wire the CLI** (`src/cli/commands/blux.ts` ~line 577-654). Mirror `convert.ts:79-80`:

```ts
import { blockStylesByIndex, blockClassDefaults } from "../../blux/emit/block-styles.js";
// ... inside the catalog command, where siteJson + pageItemsByIndex are in scope:
const styles = blockStylesByIndex(siteJson, pageIndex); // per current page
const defaults = blockClassDefaults(siteJson);
// pass into the per-band call:
const specs = bands.map((b) =>
  bandOrCollection(b, pageItems?.[b.index], feeds, { ...catalogOpts, styles, defaults }),
);
```

(`blockStylesByIndex(siteJson, pageIndex)` returns `Record<number, Record<string,string>>` keyed by band index; `pageIndex` is the current page's index — use `0` for a single-page site like the-pointe. Confirm `bandOrCollection` forwards `opts` to `bandToCatalog`/`baseOf`.)

- [ ] **Step 5: Run classify tests + typecheck-by-test**

Run: `pnpm vitest run tests/blux/catalog/classify.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/blux/catalog/classify.ts src/cli/commands/blux.ts tests/blux/catalog/classify.test.ts
git commit -m "feat(blux): capture band-level visuals (height/pad/max-width/align) + CLI wiring"
```

### Task 10: Emit the new fields into the plan + regen golden

**Files:**
- Modify: `src/blux/catalog/emit.ts` (`cellToItem`, `catalogSpecToPlanSlice`)
- Modify: `tests/blux/catalog/emit.test.ts` (assert the new fields)
- Modify (regenerated): `tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap`

- [ ] **Step 1: Write the failing emit test** — append to `tests/blux/catalog/emit.test.ts` a case with a spec carrying `minHeight`/`contentPadding`/`verticalAlign` at band level and a cell with `width`/`cover`/`backgroundColor`/`titleRole`:

```ts
it("emits band-visual primary fields and per-cell visual fields", () => {
  const spec = {
    slice: "BluxGrid",
    index: 0,
    columns: 2,
    minHeight: "100vh",
    contentPadding: "100px 4%",
    contentPaddingMobile: "40px 4%",
    maxContentWidth: "1280px",
    verticalAlign: "middle",
    textAlign: "center",
    headingRole: "text2",
    cells: [
      { kind: "text", title: "<h3>A</h3>", titleRole: "text5", width: "70%",
        backgroundColor: "#fff", contentPadding: "100px 4% 80px", valign: true },
      { kind: "media", media: { kind: "image", assetId: "u1" }, width: "30%", cover: true, mediaRatio: "4:3" },
    ],
  } as unknown as import("../../../src/blux/catalog/spec.js").CatalogSpec;
  const slice = catalogSpecToPlanSlice(spec);
  expect(slice.primary).toMatchObject({
    min_height: "100vh",
    content_padding: "100px 4%",
    content_padding_mobile: "40px 4%",
    max_content_width: "1280px",
    vertical_align: "middle",
    text_align: "center",
    heading_role: "text2",
  });
  const cells = slice.primary.cells as Record<string, unknown>[];
  expect(cells[0]).toMatchObject({ width: "70%", background_color: "#fff", content_padding: "100px 4% 80px", valign: "on", title_role: "text5" });
  expect(cells[1]).toMatchObject({ width: "30%", cover: "on", media_ratio: "4:3" });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/blux/catalog/emit.test.ts`
Expected: FAIL — new keys absent from `primary`/cells.

- [ ] **Step 3: Implement in `src/blux/catalog/emit.ts`**

(a) Add a shared band-visual emitter near the other helpers:

```ts
function bandVisual(spec: CatalogBase): Record<string, unknown> {
  return {
    ...(spec.minHeight ? { min_height: spec.minHeight } : {}),
    ...(spec.contentPadding ? { content_padding: spec.contentPadding } : {}),
    ...(spec.contentPaddingMobile ? { content_padding_mobile: spec.contentPaddingMobile } : {}),
    ...(spec.maxContentWidth ? { max_content_width: spec.maxContentWidth } : {}),
    ...(spec.verticalAlign ? { vertical_align: spec.verticalAlign } : {}),
    ...(spec.textAlign ? { text_align: spec.textAlign } : {}),
    ...(spec.columnWidth ? { column_width: spec.columnWidth } : {}),
    ...(spec.columnSide ? { column_side: spec.columnSide } : {}),
    ...(spec.headingRole ? { heading_role: spec.headingRole } : {}),
  };
}
```

Spread `...bandVisual(spec)` into the `blux_section`, `blux_grid`, `blux_gallery`, and `blux_carousel` cases (right after `...bgc`).

(b) In `cellToItem`, add the per-cell fields to the returned object (after `media_ratio`):

```ts
    ...(cell.width ? { width: cell.width } : {}),
    ...(cell.spacing !== undefined ? { spacing: cell.spacing } : {}),
    ...(cell.cover ? { cover: "on" } : {}),
    ...(cell.valign ? { valign: "on" } : {}),
    ...(cell.backgroundColor ? { background_color: cell.backgroundColor } : {}),
    ...(cell.contentPadding ? { content_padding: cell.contentPadding } : {}),
    ...(cell.titleRole ? { title_role: cell.titleRole } : {}),
    ...(cell.bodyRole ? { body_role: cell.bodyRole } : {}),
```

- [ ] **Step 4: Run the emit test**

Run: `pnpm vitest run tests/blux/catalog/emit.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate the golden snapshot + review the diff**

Run: `pnpm vitest run tests/blux/catalog/plan-golden.test.ts -u`
Then `git diff tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap` — confirm the diff ADDS the expected visual fields to the-pointe bands (min_height on band 0, content_padding on padded bands, per-cell width on split bands) and removes nothing.

- [ ] **Step 6: Run the whole catalog suite**

Run: `pnpm vitest run tests/blux/catalog`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/blux/catalog/emit.ts tests/blux/catalog/emit.test.ts \
        tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap
git commit -m "feat(blux): emit band-visual + per-cell visual fields into the plan"
```

---

## Phase 3 — Fidelity gate + validation (starter)

### Task 11: Regenerate the /dev/blux-pointe fixture from the enriched emit

The gate renders the committed `fixture.json`; it must be re-emitted so it carries the new visual fields. Cross-repo: build the maintenance CLI (Phase-2 branch), emit the-pointe, copy the fixture into the starter worktree.

**Files:**
- Modify: `src/routes/dev/blux-pointe/fixture.json` (regenerated), and `theme.css` if it changed
- Verify: `src/routes/dev/blux-pointe/page-load.test.ts` still green

- [ ] **Step 1: Build the maintenance CLI + emit the-pointe** (in the `rm-blux-cdn-fix` worktree, on `feat/blux-catalog-emit`):

```bash
pnpm build   # or the repo's compile step → dist/cli/bin.js
node dist/cli/bin.js blux catalog ~/Desktop/thePointe --out "$TMPDIR/pointe-fidelity-out"
ls "$TMPDIR/pointe-fidelity-out"   # expect render-fixture.json, site-config.json, theme.css
```

- [ ] **Step 2: Copy the fixture into the starter gate dir** (from the `starter-4c` worktree):

```bash
cp "$TMPDIR/pointe-fidelity-out/render-fixture.json" src/routes/dev/blux-pointe/fixture.json
cp "$TMPDIR/pointe-fidelity-out/theme.css" src/routes/dev/blux-pointe/theme.css
pnpm exec prettier --write src/routes/dev/blux-pointe/fixture.json src/routes/dev/blux-pointe/theme.css
```

- [ ] **Step 3: Verify the load canaries still hold**

Run: `pnpm test:unit -- src/routes/dev/blux-pointe/page-load.test.ts`
Expected: PASS — still 16 slices, 4 nav links, 2 footer columns (structure unchanged; only new fields added).

- [ ] **Step 4: Commit**

```bash
git add src/routes/dev/blux-pointe/fixture.json src/routes/dev/blux-pointe/theme.css
git commit -m "test(blux): regenerate the-pointe gate fixture with visual-fidelity fields"
```

### Task 12: Structural assertions in the fidelity gate

**Files:**
- Modify: `tests/gate/pointe-fidelity.spec.ts`

- [ ] **Step 1: Add a structural test** to `tests/gate/pointe-fidelity.spec.ts` (a new `test(...)` block; keep the existing render/console test):

```ts
test("catalog visual layer resolves grid, cover, padding, and type roles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/blux-pointe");

  // Grid columns resolve to a real flex-basis (not 'auto') at desktop.
  const cell = page.locator(".blux-grid__cells > .blux-cell").first();
  const basis = await cell.evaluate((el) => getComputedStyle(el).flexBasis);
  expect(basis).not.toBe("auto");
  expect(basis).toMatch(/\d/); // a resolved length/percentage

  // At least one band content wrapper carries resolved padding (band-pad).
  const pad = await page
    .locator(".blux-grid__cells, .blux-section__cells")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
  expect(pad).toBeGreaterThan(0);

  // Cover media crops via object-fit.
  const cover = page.locator(".blux-cell__media[data-cover='on'] img");
  if (await cover.count()) {
    await expect(cover.first()).toHaveCSS("object-fit", "cover");
  }

  // Type-role wrapping is applied to real text runs.
  await expect(page.locator("[class*='txt-role-text']").first()).toBeVisible();

  // A full-viewport band (hero min-height) is at least the fold tall.
  const tallest = await page
    .locator("section.blux-grid, section.blux-section")
    .evaluateAll((els) =>
      Math.max(...els.map((el) => (el as HTMLElement).getBoundingClientRect().height)),
    );
  expect(tallest).toBeGreaterThan(600);
});
```

- [ ] **Step 2: Run the gate**

Run: `pnpm exec playwright test tests/gate/pointe-fidelity.spec.ts`
Expected: PASS (both the existing render test and the new structural test). If a structural assertion fails, it is a real fidelity gap — fix the render/emit before proceeding (do NOT weaken the assertion).

- [ ] **Step 3: Commit**

```bash
git add tests/gate/pointe-fidelity.spec.ts
git commit -m "test(blux): structural fidelity assertions — grid bases, band-pad, cover, roles"
```

### Task 13: AI visual pre-check → human sign-off (not TDD)

This is the working validation the operator asked for: I confirm it's genuinely close before they look.

- [ ] **Step 1: Build + serve** the starter and open `/dev/blux-pointe`. Also open a build with the-pointe theme dropped into `src/blux-theme.css` for full palette fidelity (per the gate comment).
- [ ] **Step 2: Screenshot** the catalog render at desktop (1280) and mobile (390) with the browser tool.
- [ ] **Step 3: Compare** each band against the band prototype (https://the-pointe.netlify.app/) and the live Blux site at the same widths — column splits, hero height, band padding, cover crops, type sizes, stack rhythm.
- [ ] **Step 4: Close gaps** by adjusting `blux-layout.css` (render) or the emit capture (maintenance), re-running the affected tests + the gate after each change. Iterate until the comparison is faithful.
- [ ] **Step 5: Assemble a sign-off artifact** — side-by-side screenshots (catalog vs band prototype vs live) at both widths — and present it to the operator for approval. Do NOT swap the-pointe to production until they sign off.

---

## Definition of done

- All unit tests green in both repos (`pnpm test:unit` in starter; `pnpm vitest run tests/blux/catalog` in maintenance); `pnpm check` + `pnpm lint` clean in starter.
- The gate (`pnpm exec playwright test tests/gate/pointe-fidelity.spec.ts`) passes both the render and the structural test.
- The regenerated golden snapshot diff is reviewed and adds only the expected visual fields.
- The AI visual pre-check comparison is faithful at desktop + mobile, and the operator has signed off.
- The legacy `src/lib/blux/` band module is untouched by this plan (its retirement is a follow-up once the-pointe repo adopts the catalog render — out of scope here).

## Notes for the executor

- **Two repos, two branches.** Starter tasks (1-6, 11-13) on `feat/blux-catalog-pipeline` in `starter-4c`; maintenance tasks (7-10) on `feat/blux-catalog-emit` in `rm-blux-cdn-fix`. Task 11 crosses both (build in maintenance, copy into starter).
- **Stage only your files.** Both worktrees carry unrelated pre-existing changes — every commit above lists exact paths; never `git add -A`.
- **`docs/superpowers` is force-added** past a local `.git/info/exclude` in the starter (see the sibling plans); this plan file itself was committed that way.
- **Ordering:** Phase 0 → 1 → 2 → 3. The render (Phase 1) is testable against hand-written fixtures before emit (Phase 2) lands; Task 11 needs Phase 2 complete.
