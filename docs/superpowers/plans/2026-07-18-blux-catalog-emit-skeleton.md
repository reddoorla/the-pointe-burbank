# Blux Catalog Emit — Walking Skeleton (Plan 3 of N)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove the full Blux→catalog vertical slice end-to-end for ONE band archetype — parse a real the-pointe Section band, classify it to a catalog spec, emit a real Prismic page document whose SliceZone carries the actual field data, and render it through the Plan-2 `BluxSection` slice — with zero manual massaging. This de-risks the cross-repo Prismic-document boundary before we fan out to every band type, feed, and entity.

**Architecture:** Additive, non-destructive. A new `src/blux/catalog/` module in **reddoor-maintenance** classifies a `Band` into a catalog spec and emits it as a populated `PlanSlice` (full data in the document, **no `blux-presentation.json` sidecar**). It reuses the existing parser (`parseGridBands`, `parseBluxSite`), asset collection (`collectPlanAssets`), and — unchanged — the network migrator (`run-migration.ts`, whose `resolveDocData` already recurses into nested groups). The render side already exists: the Plan-2 `BluxSection.svelte` in **reddoor-starter** consumes `primary.cells`. The existing Path A (`emit`) and Path B (`convert`/`SliceSpec`/sidecar) are left completely untouched so all current tests stay green.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), tsup build, Vitest + golden snapshots (reddoor-maintenance); SvelteKit 2 / Svelte 5, `@prismicio/svelte`, Vitest + @testing-library/svelte (reddoor-starter). `@prismicio/migrate` supplies `htmlAsRichText`.

**Spec:** `docs/superpowers/specs/2026-07-17-blux-catalog-pipeline-design.md` (§4 pipeline, §6 catalog/cell model, §8 custom types/feeds). **Builds on:** Plan 1 (`…-blux-catalog-foundation.md`) + Plan 2 (`…-blux-catalog-slices.md`) — the catalog slice library is BUILT + GREEN on `feat/blux-catalog-pipeline`.

---

## Confirmed groundwork (verified by reading the maintenance code — do not re-litigate)

- **Extract is reused, not built.** `parseBluxSite(JSON.parse(site.json)): BluxRaw` supplies data/feeds/theme/nav; `parseGridBands(indexHtml): Band[]` (`src/blux/grid/parse-grid.ts`) supplies the rendered layout tree. Path B joins them positionally (`site.json items[i] ↔ band[i]`). The skeleton reuses both verbatim.
- **`Band`/`Node`/`Media`/`Cell` IR** lives in `src/blux/grid/types.ts` and stays as-is. `Node` is a discriminated union: `row{cells:Cell[],slider?}`, `stack{children}`, `heading{level,html,role?}`, `body{html,role?}`, `subtitle{text,role?}`, `media{media:Media}`, `widget{widget}`, `raw{html}`. `Cell = { token: GridToken; node: Node }`. `Band = { index; blockClass?; background?: Media; root: Node }`.
- **Plan/document types** (`src/blux/emit/plan.ts`): `PlanSlice = { slice_type; variation; primary: Record<string,unknown>; items: Record<string,unknown>[] }`; `PlanDocument = { type; uid; data: Record<string,unknown> }`; markers `richText(html) → {__richtext_html}`, `assetRef(uuid) → {__asset_id}`.
- **The emit pattern to mirror** (`src/blux/emit/grid-plan.ts` `buildGridSitePlan`): `documents = pages.map(p => ({ type:"page", uid:p.uid, data:{ title: richText(`<h1>…</h1>`), slices: p.specs.map(sliceSpecToPlanSlice) } }))`; assets via `collectPlanAssets(specs, resolve, diagnostics)`. The OLD `sliceSpecToPlanSlice` (`emit/grid-slice.ts`) emits `primary:{ band: spec.index }` only — the redesign instead emits the **full** `primary`.
- **Marker resolution recurses** (`src/blux/emit/resolve-doc.ts` `resolveDocData`): it maps over arrays and rebuilds objects recursively, so `{__richtext_html}`/`{__asset_id}` nested inside `primary.cells[].title` / `subgrid[].media` resolve correctly. `{__asset_id}` resolves to `{ id }`; `{__richtext_html}` to `htmlAsRichText(html).result`. **run-migration.ts needs NO changes for the skeleton.**
- **Migrate is creds-gated.** `run-migration.ts` reads `PRISMIC_REPOSITORY_NAME` + `PRISMIC_WRITE_TOKEN` (never print values). The live push + visual render is the skeleton's only non-automatable step (Task 6), matching the memory note that the-pointe upload "awaits creds".
- **Target field names** (Plan-2 `BluxSection` model `primary`): `heading` (StructuredText), `background_image` (Image), `background_color` (Text), `overlay` (Text), `max_content_width` (Text), `vertical_align` (Select), `min_height` (Text), `widget_kind` (Text), `widget_html` (Text), `cells` (Group). Each `cells` item: `kind` (Select: text|media|embed|button|subgrid), `title` (StructuredText), `body` (StructuredText), `media` (Image), `media_ratio` (Text), `embed_html` (Text), `link` (Link), `link_label` (Text), `subgrid` (nested Group with kind|title|body|media|media_ratio|link|link_label|embed_html). Emit must use these exact keys.

## Scope guardrails (thin by design)

- ONE archetype: a **Section** band (heading + a row of text/media cells, optional background). Cells are limited to `text`, `media`, and one `subgrid` level. `embed`/`button`/`link` cells, widgets, and all other band types (Grid/Gallery/Carousel/Media/MediaText/Table/Collection) are OUT — they are the breadth fan-out in Plan 4.
- Feeds, entity documents, and the Collection slice are OUT (Plan 4/5).
- Path A (`emit`) and Path B (`convert`) are NOT modified or retired here.

## File structure

**reddoor-maintenance** (branch `feat/blux-catalog-emit`):

- `src/blux/catalog/spec.ts` — catalog spec types (new).
- `src/blux/catalog/classify.ts` — `bandToCatalogSection` (new).
- `src/blux/catalog/emit.ts` — `catalogSpecToPlanSlice` + `buildCatalogPlan` (new).
- `src/blux/catalog/index.ts` — barrel (new).
- `src/cli/commands/blux.ts` — add a `catalog` action (modify, additive).
- `tests/blux/catalog/{classify,emit,plan-golden}.test.ts` + `tests/cli/blux-catalog-command.test.ts` (new).

**reddoor-starter** (branch `feat/blux-catalog-pipeline`, already checked out):

- `src/lib/slices/BluxSection/BluxSection.emit-skeleton.test.ts` — offline render proof (new).
- `docs/superpowers/plans/2026-07-18-blux-catalog-emit-skeleton.md` — this plan (already created).

---

### Task 0: Branch + module scaffold (reddoor-maintenance)

**Files:** create `src/blux/catalog/index.ts`.

- [ ] **Step 1: Branch.** In `/Users/tuckerlemos/Documents/GitHub/reddoor-maintenance`, confirm a clean tree (`git status`), then `git checkout -b feat/blux-catalog-emit` (if it already exists from a prior attempt, `git checkout feat/blux-catalog-emit` and `git log --oneline -3` to see progress).

- [ ] **Step 2: Baseline gate.** Run `pnpm run build` then `pnpm test` — confirm the suite is GREEN before adding anything (record the pass count; the new module must not regress it).

- [ ] **Step 3: Barrel stub.** Create `src/blux/catalog/index.ts`:

```ts
export * from "./spec.js";
export * from "./classify.js";
export * from "./emit.js";
```

(The three modules are created in Tasks 1–3; the barrel referencing not-yet-created files is fine — nothing imports it until Task 4. Do not build/commit until Task 1 adds `spec.ts`.)

---

### Task 1: Catalog spec types (reddoor-maintenance)

**Files:** create `src/blux/catalog/spec.ts`.

- [ ] **Step 1: Write the spec types.** Create `src/blux/catalog/spec.ts`:

```ts
import type { Media } from "../grid/types.js";

/** A rich-text run kept as raw HTML — emit turns it into a `{__richtext_html}`
 * marker; the parser already produces HTML for heading/body nodes. */
export type CatalogRichText = string;

/** One catalog cell — the structural unit the Plan-2 `BluxCell` renders. Only
 * the skeleton subset is modelled: text, media, and one nested subgrid level.
 * `kind` mirrors the Prismic Select ("text" | "media" | "subgrid" here). */
export type CatalogCell = {
  kind: "text" | "media" | "subgrid";
  title?: CatalogRichText;
  body?: CatalogRichText;
  media?: Media;
  mediaRatio?: string;
  subgrid?: CatalogCell[];
};

/** A container band → the Plan-2 `blux_section` slice. `index` is the slice-zone
 * position (kept for parity with SliceSpec + future manifest-free ordering). */
export type BluxSectionSpec = {
  slice: "BluxSection";
  index: number;
  background?: Media;
  backgroundColor?: string;
  heading?: CatalogRichText;
  cells: CatalogCell[];
};

/** The catalog classify target. One member for the skeleton; Plan 4 adds the
 * rest (Grid/Gallery/Carousel/Media/MediaText/Embed/Table/Collection + BluxBlock). */
export type CatalogSpec = BluxSectionSpec;

export type CatalogKind = CatalogSpec["slice"];
```

- [ ] **Step 2: Typecheck.** Run `pnpm run build` (tsup + tsc) → no errors. Commit:

```bash
git add src/blux/catalog/spec.ts src/blux/catalog/index.ts
git commit -m "feat(blux-catalog): catalog spec types (Section skeleton)"
```

---

### Task 2: `bandToCatalogSection` classifier (reddoor-maintenance)

**Files:** create `src/blux/catalog/classify.ts`, `tests/blux/catalog/classify.test.ts`.

- [ ] **Step 1: Write the failing test.** Create `tests/blux/catalog/classify.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Band, Node } from "../../../src/blux/grid/types.js";
import { bandToCatalogSection } from "../../../src/blux/catalog/index.js";

const heading = (html: string): Node => ({ kind: "heading", level: 2, html });
const body = (html: string): Node => ({ kind: "body", html });
const cell = (node: Node) => ({ token: { cols: 1, raw: "grid-1" }, node });
const row = (nodes: Node[]): Node => ({ kind: "row", cells: nodes.map(cell) });

describe("bandToCatalogSection", () => {
  it("maps a heading + a row of text cells to a BluxSection spec", () => {
    const band: Band = {
      index: 3,
      root: {
        kind: "stack",
        children: [
          heading("<h2>Amenities</h2>"),
          row([body("<p>Pool</p>"), body("<p>Gym</p>")]),
        ],
      },
    };
    const spec = bandToCatalogSection(band);
    expect(spec.slice).toBe("BluxSection");
    expect(spec.index).toBe(3);
    expect(spec.heading).toContain("Amenities");
    expect(spec.cells).toHaveLength(2);
    expect(spec.cells[0]).toMatchObject({ kind: "text", body: "<p>Pool</p>" });
  });

  it("captures a media cell's Media and carries the band background", () => {
    const media = { assetId: "u1", base: "https://cdn/", ext: "jpg" };
    const band: Band = {
      index: 0,
      background: { assetId: "bg", base: "https://cdn/", ext: "jpg" },
      root: { kind: "row", cells: [cell({ kind: "media", media })] },
    };
    const spec = bandToCatalogSection(band);
    expect(spec.background?.assetId).toBe("bg");
    expect(spec.cells[0]).toMatchObject({ kind: "media" });
    expect(spec.cells[0].media?.assetId).toBe("u1");
  });
});
```

- [ ] **Step 2: Run it — expect failure.** `pnpm exec vitest run tests/blux/catalog/classify.test.ts` → FAIL (`bandToCatalogSection` not exported).

- [ ] **Step 3: Implement.** Create `src/blux/catalog/classify.ts`:

```ts
import type { Band, Node, Cell } from "../grid/types.js";
import type { BluxSectionSpec, CatalogCell } from "./spec.js";

/** Flatten a band root to its top-level content nodes: a `stack` yields its
 * children; a bare node yields itself. (Skeleton: one level — nested stacks are
 * a Plan-4 concern.) */
function topNodes(root: Node): Node[] {
  return root.kind === "stack" ? root.children : [root];
}

/** The first heading node's HTML becomes the section heading. */
function findHeading(nodes: Node[]): string | undefined {
  const h = nodes.find((n) => n.kind === "heading");
  return h && h.kind === "heading" ? h.html : undefined;
}

/** One row cell → one catalog cell. Media cell keeps its Media; a text-bearing
 * cell keeps heading/body HTML. (Skeleton: no embed/button/link/subgrid-from-HTML
 * detection — a media node ⇒ media, else ⇒ text.) */
function cellToCatalog(c: Cell): CatalogCell {
  const n = c.node;
  if (n.kind === "media") return { kind: "media", media: n.media };
  if (n.kind === "heading") return { kind: "text", title: n.html };
  if (n.kind === "body") return { kind: "text", body: n.html };
  if (n.kind === "stack") {
    // A cell wrapping heading+body: fold into one text cell.
    const title = n.children.find((x) => x.kind === "heading");
    const bodyN = n.children.find((x) => x.kind === "body");
    return {
      kind: "text",
      ...(title && title.kind === "heading" ? { title: title.html } : {}),
      ...(bodyN && bodyN.kind === "body" ? { body: bodyN.html } : {}),
    };
  }
  // Fallback: raw/subtitle/widget → a text cell carrying whatever HTML we have.
  const html =
    n.kind === "raw" ? n.html : n.kind === "subtitle" ? `<p>${n.text}</p>` : "";
  return { kind: "text", body: html };
}

/** Map a Section-like band (heading + a row of cells, optional background) to a
 * `blux_section` spec. Rows contribute their cells; a bare media/text root
 * contributes a single cell. */
export function bandToCatalogSection(band: Band): BluxSectionSpec {
  const nodes = topNodes(band.root);
  const heading = findHeading(nodes);
  const cells: CatalogCell[] = [];
  for (const n of nodes) {
    if (n.kind === "heading") continue; // consumed as the section heading
    if (n.kind === "row") cells.push(...n.cells.map(cellToCatalog));
    else
      cells.push(cellToCatalog({ token: { cols: 1, raw: "grid-1" }, node: n }));
  }
  return {
    slice: "BluxSection",
    index: band.index,
    ...(band.background ? { background: band.background } : {}),
    ...(heading ? { heading } : {}),
    cells,
  };
}
```

- [ ] **Step 4: Run it — expect pass.** `pnpm exec vitest run tests/blux/catalog/classify.test.ts` → PASS. If `Cell`/`Node`/`GridToken` field names differ from what the test assumes, read `src/blux/grid/types.ts` and adjust the test's node builders to the real shape (do NOT change production types).

- [ ] **Step 5: Commit.**

```bash
git add src/blux/catalog/classify.ts tests/blux/catalog/classify.test.ts
git commit -m "feat(blux-catalog): bandToCatalogSection classifier"
```

---

### Task 3: `catalogSpecToPlanSlice` + `buildCatalogPlan` emitter (reddoor-maintenance)

**Files:** create `src/blux/catalog/emit.ts`, `tests/blux/catalog/emit.test.ts`.

- [ ] **Step 1: Write the failing test.** Create `tests/blux/catalog/emit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { BluxSectionSpec } from "../../../src/blux/catalog/index.js";
import {
  catalogSpecToPlanSlice,
  buildCatalogPlan,
} from "../../../src/blux/catalog/index.js";

const spec: BluxSectionSpec = {
  slice: "BluxSection",
  index: 2,
  backgroundColor: "#f4f4f4",
  heading: "<h2>Amenities</h2>",
  cells: [
    { kind: "text", title: "<h3>Pool</h3>", body: "<p>Heated</p>" },
    {
      kind: "media",
      media: { assetId: "u1", base: "https://cdn/", ext: "jpg" },
      mediaRatio: "4:3",
    },
  ],
};

describe("catalogSpecToPlanSlice", () => {
  it("emits a blux_section slice with the heading + cells as nested groups", () => {
    const slice = catalogSpecToPlanSlice(spec);
    expect(slice.slice_type).toBe("blux_section");
    expect(slice.variation).toBe("default");
    expect(slice.items).toEqual([]);
    expect(slice.primary.background_color).toBe("#f4f4f4");
    expect(slice.primary.heading).toEqual({
      __richtext_html: "<h2>Amenities</h2>",
    });
    const cells = slice.primary.cells as Record<string, unknown>[];
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({
      kind: "text",
      title: { __richtext_html: "<h3>Pool</h3>" },
      body: { __richtext_html: "<p>Heated</p>" },
    });
    expect(cells[1]).toMatchObject({
      kind: "media",
      media: { __asset_id: "u1" },
      media_ratio: "4:3",
    });
  });
});

describe("buildCatalogPlan", () => {
  it("wraps specs in one page document and collects the referenced assets", () => {
    const plan = buildCatalogPlan(
      [{ uid: "home", title: "Home", specs: [spec] }],
      {
        assets: [
          {
            id: "u1",
            url: "https://cdn/u1.jpg",
            alt: "pool",
            sourceUrl: "https://cdn/u1.jpg",
          },
        ],
        diagnostics: [],
      },
    );
    expect(plan.documents).toHaveLength(1);
    expect(plan.documents[0]).toMatchObject({ type: "page", uid: "home" });
    const slices = (plan.documents[0].data as { slices: unknown[] }).slices;
    expect(slices).toHaveLength(1);
    expect(plan.assets.find((a) => a.id === "u1")?.url).toBe(
      "https://cdn/u1.jpg",
    );
  });
});
```

- [ ] **Step 2: Run it — expect failure.** `pnpm exec vitest run tests/blux/catalog/emit.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement.** Create `src/blux/catalog/emit.ts`:

```ts
import type { Media } from "../grid/types.js";
import type { Diagnostic } from "../ir.js";
import { mediaUrl } from "../emit/grid-plan.js";
import {
  type MigrationPlan,
  type PlanAsset,
  type PlanDocument,
  type PlanSlice,
  assetRef,
  richText,
} from "../emit/plan.js";
import type { BluxSectionSpec, CatalogCell, CatalogSpec } from "./spec.js";

/** One catalog cell → its nested-group item object. Rich text and media become
 * `{__richtext_html}` / `{__asset_id}` markers (resolveDocData resolves them,
 * including at this depth). Absent fields are omitted so the item stays lean. */
function cellToItem(cell: CatalogCell): Record<string, unknown> {
  return {
    kind: cell.kind,
    ...(cell.title ? { title: richText(cell.title) } : {}),
    ...(cell.body ? { body: richText(cell.body) } : {}),
    ...(cell.media ? { media: assetRef(cell.media.assetId) } : {}),
    ...(cell.mediaRatio ? { media_ratio: cell.mediaRatio } : {}),
    ...(cell.subgrid ? { subgrid: cell.subgrid.map(cellToItem) } : {}),
  };
}

/** Map one catalog spec to its populated page-doc slice. Skeleton: BluxSection. */
export function catalogSpecToPlanSlice(spec: CatalogSpec): PlanSlice {
  return {
    slice_type: "blux_section",
    variation: "default",
    items: [],
    primary: {
      ...(spec.background
        ? { background_image: assetRef(spec.background.assetId) }
        : {}),
      ...(spec.backgroundColor
        ? { background_color: spec.backgroundColor }
        : {}),
      ...(spec.heading ? { heading: richText(spec.heading) } : {}),
      cells: spec.cells.map(cellToItem),
    },
  };
}

/** Every Media a catalog spec references (background + cell media + subgrid media). */
function specMedia(spec: CatalogSpec): Media[] {
  const out: Media[] = [];
  if (spec.background) out.push(spec.background);
  const walk = (cells: CatalogCell[]) => {
    for (const c of cells) {
      if (c.media) out.push(c.media);
      if (c.subgrid) walk(c.subgrid);
    }
  };
  walk(spec.cells);
  return out;
}

export type CatalogAssetIndex = {
  assets: { id: string; url: string; alt: string; sourceUrl?: string | null }[];
  diagnostics?: Diagnostic[];
};

/** Build the migration plan for catalog-converted pages: one text+slices page
 * document each, plus the asset union (uploaded so nested `{__asset_id}` markers
 * resolve at migrate time). No custom types / sidecar in the skeleton. */
export function buildCatalogPlan(
  pages: { uid: string; title: string; specs: CatalogSpec[] }[],
  ir: CatalogAssetIndex,
): MigrationPlan {
  const documents: PlanDocument[] = pages.map((p) => ({
    type: "page",
    uid: p.uid,
    data: {
      title: richText(`<h1>${p.title}</h1>`),
      slices: p.specs.map(catalogSpecToPlanSlice),
    },
  }));
  const assetById = new Map(ir.assets.map((a) => [a.id, a] as const));
  const sourceUrlById = new Map(
    ir.assets.map((a) => [a.id, a.sourceUrl] as const),
  );
  const resolve = (m: Media): PlanAsset | null => {
    const asset = assetById.get(m.assetId);
    const url = mediaUrl(m, sourceUrlById);
    return url ? { id: m.assetId, url, alt: asset?.alt ?? "" } : null;
  };
  const diagnostics: Diagnostic[] = [...(ir.diagnostics ?? [])];
  // collectPlanAssets only understands SliceSpec shapes, so gather media here and
  // resolve directly (skeleton) — keep insertion order, dedupe by assetId.
  const seen = new Set<string>();
  const assets: PlanAsset[] = [];
  for (const spec of pages.flatMap((p) => p.specs)) {
    for (const m of specMedia(spec)) {
      if (seen.has(m.assetId)) continue;
      seen.add(m.assetId);
      const a = resolve(m);
      if (a) assets.push(a);
      else
        diagnostics.push({
          kind: "unresolved-asset",
          where: m.assetId,
          message: `media ${m.assetId} has no CDN base nor IR source url — not uploaded`,
        });
    }
  }
  return {
    customTypes: [],
    documents,
    assets,
    stylesManifest: [],
    diagnostics,
  };
}
```

> Note: `collectPlanAssets`/`collectMedia` are imported to stay honest about the reuse boundary, but the skeleton resolves its own media (the SliceSpec-shaped `collectPlanAssets` doesn't know `CatalogSpec`). If the unused imports trip lint, drop them and add a code comment pointing to `grid-plan.ts` as the pattern source. Verify the `Diagnostic` shape (`kind`/`where`/`message`) against `src/blux/ir.ts` and adjust if it differs.

- [ ] **Step 4: Run it — expect pass.** `pnpm exec vitest run tests/blux/catalog/emit.test.ts` → PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/blux/catalog/emit.ts tests/blux/catalog/emit.test.ts
git commit -m "feat(blux-catalog): catalogSpecToPlanSlice + buildCatalogPlan"
```

---

### Task 4: CLI `catalog` action (reddoor-maintenance)

**Files:** modify `src/cli/commands/blux.ts`; create `tests/cli/blux-catalog-command.test.ts`.

- [ ] **Step 1: Read the existing convert action.** Open `src/cli/commands/blux.ts` and read the `convert` branch (around lines 290–430) to copy its export-reading idioms verbatim: `JSON.parse(await readFile(join(dir, "site.json")))`, per-page `index.html` reads, and how it writes outputs with `writeFile`/`--out`. The `catalog` action reuses these but writes ONLY `migration-plan.json` (no sidecar, no theme/products/etc.).

- [ ] **Step 2: Write the CLI test first.** Create `tests/cli/blux-catalog-command.test.ts` following the pattern in `tests/cli/blux-command.test.ts` (read that file for the harness: temp dir, a minimal `site.json` + `index.html` fixture, invoking the command function, asserting the written `migration-plan.json`). Assert: after `blux catalog <dir> --out <out>`, `<out>/migration-plan.json` exists, its `documents[0].data.slices[0].slice_type === "blux_section"`, and NO `blux-presentation.json` is written.

- [ ] **Step 3: Run it — expect failure.** `pnpm exec vitest run tests/cli/blux-catalog-command.test.ts` → FAIL (unknown action).

- [ ] **Step 4: Implement the action.** In `src/cli/commands/blux.ts`: (a) add `"catalog"` to the action type/union and the dispatch switch; (b) implement the branch — read `site.json` + each page's `index.html` (reuse the convert idioms), `parseGridBands` each page, `bandToCatalogSection` every band (skeleton: classify ALL bands as Section — breadth routing is Plan 4), build the per-page `{uid,title,specs}`, derive a `CatalogAssetIndex` from `assembleIR({siteJson,htmls})`'s `.assets` (reuse the existing IR asset scrape) or a minimal `{assets:[],diagnostics:[]}` if IR assembly is heavy, then `buildCatalogPlan(pages, assetIndex)` and `writeFile(join(out,"migration-plan.json"), JSON.stringify(plan,null,2))`. Register `catalog` in the CLI help/usage string near the other actions in `src/cli/bin.ts`.

- [ ] **Step 5: Run it — expect pass.** `pnpm exec vitest run tests/cli/blux-catalog-command.test.ts` → PASS.

- [ ] **Step 6: Full maintenance gate.** `pnpm run build` (clean) + `pnpm test` (all pass, including the pre-existing suite — the additive module/action must not regress it). Commit:

```bash
git add src/cli/commands/blux.ts src/cli/bin.ts tests/cli/blux-catalog-command.test.ts
git commit -m "feat(blux-catalog): CLI 'catalog' action (plan-only, no sidecar)"
```

---

### Task 5: Golden against a real the-pointe Section band (reddoor-maintenance)

**Files:** create `tests/blux/catalog/plan-golden.test.ts`.

- [ ] **Step 1: Locate a Section fixture.** Use `tests/blux/fixtures/the-pointe-page-content.html` (the real client page). Read it to pick a band that is a Section archetype (heading + a row of text/media cells). If none is cleanly a Section, use `the-pointe-map-band.html`'s sibling content or the `minimal-site.ts` fixture's first band — pick the simplest real Section-shaped band.

- [ ] **Step 2: Write the golden test.** Create `tests/blux/catalog/plan-golden.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGridBands } from "../../../src/blux/grid/index.js";
import {
  bandToCatalogSection,
  buildCatalogPlan,
} from "../../../src/blux/catalog/index.js";

describe("catalog plan — the-pointe Section band (golden)", () => {
  it("emits a populated blux_section document from a real band", () => {
    const html = readFileSync(
      join(__dirname, "../fixtures/the-pointe-page-content.html"),
      "utf-8",
    );
    const bands = parseGridBands(html);
    expect(bands.length).toBeGreaterThan(0);
    const specs = bands.map(bandToCatalogSection);
    const plan = buildCatalogPlan(
      [{ uid: "home", title: "The Pointe", specs }],
      {
        assets: [],
        diagnostics: [],
      },
    );
    const doc = plan.documents[0];
    const slices = (
      doc.data as {
        slices: { slice_type: string; primary: Record<string, unknown> }[];
      }
    ).slices;
    // Every emitted slice is a populated blux_section (skeleton routes all → Section).
    expect(slices.every((s) => s.slice_type === "blux_section")).toBe(true);
    // At least one section carries real heading text and non-empty cells.
    expect(
      slices.some(
        (s) => s.primary.heading && (s.primary.cells as unknown[]).length > 0,
      ),
    ).toBe(true);
    expect(plan).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Run + record snapshot.** `pnpm exec vitest run tests/blux/catalog/plan-golden.test.ts` → PASS (writes `__snapshots__/plan-golden.test.ts.snap`). Read the snapshot and sanity-check: headings are real the-pointe text, cells carry `{__richtext_html}` for text and `{__asset_id}` for media, no `[object Object]` / empty markers. If the classify produced obviously wrong groupings (e.g. everything in one giant cell), note it as a breadth-limitation diagnostic in the commit message — the skeleton proves the PIPELINE, not full-fidelity classification.

- [ ] **Step 4: Commit.**

```bash
git add tests/blux/catalog/plan-golden.test.ts tests/blux/catalog/__snapshots__/
git commit -m "test(blux-catalog): golden plan from a real the-pointe Section band"
```

---

### Task 6: Offline end-to-end render proof (reddoor-starter)

**Files:** create `src/lib/slices/BluxSection/BluxSection.emit-skeleton.test.ts`.

This closes the loop WITHOUT live Prismic: take an emitted `blux_section` slice, resolve its markers exactly as `resolveDocData` does (richtext HTML → the shape `PrismicRichText` renders; `{__asset_id}` → an image field), and render through the real `BluxSection.svelte`, asserting the-pointe content appears.

- [ ] **Step 1: Write the test.** Create `src/lib/slices/BluxSection/BluxSection.emit-skeleton.test.ts`:

```ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxSection from "./index.svelte";

afterEach(() => cleanup());

/** The migration emit produces `{__richtext_html}` markers; run-migration's
 * resolveDocData turns them into rich-text nodes. This mirror produces the
 * rich-text node shape @prismicio/svelte's PrismicRichText renders, so we can
 * prove emit-shape → render WITHOUT a live Prismic round-trip. */
const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

describe("BluxSection renders an emit-shaped (resolved) document", () => {
  it("shows the section heading and every resolved cell", () => {
    // Shape mirrors buildCatalogPlan's blux_section primary AFTER resolveDocData:
    // richtext markers → rich-text nodes; kept field names identical to emit.
    const slice = {
      slice_type: "blux_section",
      variation: "default",
      primary: {
        background_color: "#f4f4f4",
        heading: rt("heading2", "Amenities"),
        cells: [
          {
            kind: "text",
            title: rt("heading3", "Pool"),
            body: rt("paragraph", "Heated"),
            subgrid: [],
          },
          { kind: "text", title: rt("heading3", "Gym"), subgrid: [] },
        ],
      },
    } as unknown as Content.BluxSectionSlice;

    const { container, getByText } = render(BluxSection, { props: { slice } });
    expect(getByText("Amenities")).not.toBeNull();
    expect(getByText("Pool")).not.toBeNull();
    expect(getByText("Heated")).not.toBeNull();
    expect(getByText("Gym")).not.toBeNull();
    expect(
      container.querySelectorAll(".blux-section__cells > .blux-cell"),
    ).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it.** `pnpm exec vitest run src/lib/slices/BluxSection/BluxSection.emit-skeleton.test.ts` → PASS. This proves the emit field-names (`heading`, `cells`, `kind`, `title`, `body`) line up exactly with what `BluxSection.svelte` reads. If a name mismatches, the render is empty → FIX THE EMIT (Task 3), not the test — the emit must speak the slice's field names.

- [ ] **Step 3: Document the marker↔resolved correspondence.** Add a top-of-file comment block cross-referencing the maintenance emit (`buildCatalogPlan` → `{__richtext_html}`) and `resolveDocData` (→ rich-text nodes), so a future reader sees the two goldens describe the same document at two stages.

- [ ] **Step 4: Gate + commit** (reddoor-starter). `pnpm run check` (0 errors) + `pnpm run lint` (clean) + `pnpm exec vitest run --pool=threads` (all pass). Commit:

```bash
git add src/lib/slices/BluxSection/BluxSection.emit-skeleton.test.ts
git commit -m "test(blux): offline emit-shape → BluxSection render proof"
```

---

### Task 7: Live migrate + visual render (creds-gated, MANUAL) + skeleton review

**Files:** none (verification + a short RUNBOOK note).

- [ ] **Step 1: RUNBOOK.** Append a short "Catalog skeleton — live proof" section to the maintenance Blux docs (or this plan's tail) with the exact commands: `reddoor-maint blux catalog <the-pointe-export> --out <out>` then `PRISMIC_REPOSITORY_NAME=… PRISMIC_WRITE_TOKEN=… reddoor-maint blux migrate <out>` (a scratch/staging Prismic repo, NEVER production). Note the env var KEYS only.

- [ ] **Step 2: Gated execution.** This step runs ONLY when the operator has scratch-repo Prismic creds (memory: the-pointe upload "awaits creds"). It is NOT part of the automated gate. When creds exist: migrate the skeleton plan, then load the migrated page in the starter and confirm the `blux_section` renders the-pointe content through the Plan-2 slice. Record the outcome. If `{__asset_id}` does not resolve to a working image field via the Migration API, THAT is the skeleton's key finding — file it and adjust `assetRef`/emit accordingly before Plan 4.

- [ ] **Step 3: Final skeleton review.** Dispatch a spec-compliance + code-quality review of the whole skeleton (both repos' new files) per subagent-driven-development. Confirm: additive-only (Path A/B untouched, all prior tests green in both repos), no `any`/`@ts-ignore`, emit field-names match the slice model exactly, marker nesting verified.

- [ ] **Step 4: Update memory** (`blux-catalog-pipeline-redesign.md`): skeleton BUILT + GREEN, the Extract-source question resolved (reuse parser), `resolveDocData` recursion confirmed, and the live-migrate finding (Step 2) if run.

---

## Definition of done

- `src/blux/catalog/` classifies a Section band and emits a populated `blux_section` page document (full data, no sidecar), reusing the existing parser + asset resolution + (unchanged) migrator.
- A real the-pointe band flows parse → classify → emit to a golden migration plan whose markers nest correctly.
- The emit field-names are proven to line up with the Plan-2 `BluxSection.svelte` via an offline resolved-render test.
- Both repos' full suites stay green; Path A and Path B are untouched.
- The live migrate+render path is documented and gated on scratch creds.

## Not in this plan (Plan 4+)

Breadth classify routing (Band → the right catalog slice: Grid/Gallery/Carousel/Media/MediaText/Embed/Table + BluxBlock fallback + widget→Section promotion per decision B); feed materialization → entity documents + the feed-backed Collection slice; per-site feed-specific entity field extensions; theme/nav/footer emit; the full the-pointe fidelity gate (all bands, vs live); Path A retirement; rollout to tower/composition/remaining sites.
