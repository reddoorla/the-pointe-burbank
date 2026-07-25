# Blux Catalog Breadth Classify — Plan 4a of N

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the walking-skeleton's single-archetype classifier with a breadth classifier that routes every Blux `Band` to the right catalog slice (BluxSection/Grid/Gallery/Carousel/Media/MediaText + a content-preserving BluxBlock fallback) and carries FULL cell data — lifting the-pointe media capture from the skeleton's 7/52 toward ~52/52, with zero content loss.

**Architecture:** Reuse, don't rebuild. The existing `classifyBand(band)` (`src/blux/grid/classify-band.ts`) already routes a Band to a thin `SliceSpec` via a battle-tested, golden-covered 10-branch promotion order. Plan 4a keeps that routing verbatim and adds a `sliceSpecToCatalog(spec, band)` mapper that turns each thin `SliceSpec` into a RICH `CatalogSpec`, building cells with a recursive node-walker (`nodeToCells`) so nested rows/stacks and buried media are never dropped. The band → catalog router becomes `bandToCatalog(band) = sliceSpecToCatalog(classifyBand(band), band)`. Emit is extended to serialize every new spec to its Plan-2 slice. Additive: `classify-band.ts` / Path A / Path B stay untouched.

**Tech Stack:** TypeScript (ESM `.js` specifiers), tsup, Vitest + golden snapshots (reddoor-maintenance). Renders through the Plan-2 catalog slices in reddoor-starter (already built + green).

**Spec:** `docs/superpowers/specs/2026-07-17-blux-catalog-pipeline-design.md` (§7 classifier). **Builds on:** Plan 3 skeleton (`…-blux-catalog-emit-skeleton.md`) — `src/blux/catalog/{spec,classify,emit,index}.ts` + CLI `catalog` action exist and are green on branch `feat/blux-catalog-emit`.

---

## Confirmed groundwork (verified by exploration — do not re-litigate)

- **`classifyBand(band, opts): SliceSpec`** (`classify-band.ts:316`) routes via first-match promotion order: (1) LocationMap `sole widget map`; (2) VideoFeature `1 video, no text/widgets/row/raw`; (3) TitleBand `text-only, 1 heading, ≤1 subtitle, 0 body, no bg`; (4) RichText `text-only, 0 heading/subtitle, >0 body, no bg`; (5) Hero `bg + 1 heading + ≤1 subtitle + ≤1 body, no row/media/widgets/raw`; (6) Carousel `rowNode.slider && carouselSlides()`; (7) Gallery `row && galleryMedia()`; (8) MediaFull `1 media, no text/row/widgets/raw`; (9) SplitFeature `row of 2, one pure-media + one text`; (10) **Grid fallback** carrying the full `root: Node` tree. Every branch refuses promotion when content it can't carry is present → falls to Grid, so **the existing classifier never loses content**.
- **`SliceSpec` richness** (`slice-spec.ts`): only `SplitFeatureSpec.text: Node` (line 47) and `GridSpec.root: Node` (line 87) carry full subtrees; Hero/TitleBand/RichText carry plain strings; Gallery carries `media: Media[]`; Carousel carries `slides:{media,caption?,subcaption?}[]`; MediaFull/VideoFeature carry `media: Media`. Every spec extends `SpecBase = {index; blockClass?; background?: Media}` (line 8).
- **Reusable recursive walker:** `collectMedia(node): Media[]` (`classify-band.ts:6`, re-exported via `grid/index.ts`) DFS-recurses row cells + stack children — the recursion the skeleton lacked. Also exported/liftable: `collectText`, `collectWidgets`, `topRowNode`(line 79, root row or single-child-stack-wrapping-a-row), `isEmptyRaw`, `unboxed`(line 145, peels one-child style-box stacks). The `Node` union (`grid/types.ts`): `row{cells:Cell[],slider?}`, `stack{children}`, `heading{level,html,role?}`, `body{html,role?}`, `subtitle{text,role?}`, `media{media:Media}`, `widget{widget}`, `raw{html}`; `Cell={token:GridToken,node:Node}`; `Media` has `{kind:"image"|"video", assetId, base?, ext?, alt?}`; `GridToken` has `{cols, ratio?, raw}`.
- **Prismic depth-2 ceiling:** cells may hold ONE nested `subgrid`. A band nested deeper than cell→subgrid cannot render natively → routes to the **BluxBlock** fallback (opaque serialized tree), preserving content.
- **Plan-2 slice field names** (emit targets): `blux_section`/`blux_grid`/`blux_gallery`/`blux_carousel` primary carry `heading`(richtext), background fields, geometry, and `cells` (Group) — each cell `{kind, title(rt), body(rt), media(asset), media_ratio, embed_html, link, link_label, subgrid[]}`. `blux_media` primary: `media`(asset), `video_embed`, `ratio`, `crop`, `caption`(rt), `link`, `link_label`. `blux_media_text` primary: `media`(asset), `media_side`, `layout_ratio`, `title`(rt), `body`(rt), `link`, `link_label`. `blux_block` primary: `payload` (JSON string of a `{tag,children,html,image,style}` tree — see `starter src/lib/slices/BluxBlock/node.ts`).
- **CLI is wired** (`src/cli/commands/blux.ts:471`): the `catalog` action calls `parseGridBands(html).map(bandToCatalogSection)`. Swap that call to the new `bandToCatalog`.
- **Golden pattern:** `tests/blux/grid-classify-golden.test.ts` = parse the-pointe fixture → classify → per-band `summary()` one-liner → `toMatchSnapshot()`. Mirror it for catalog, and include a **per-band media-capture count** so the golden asserts the 7/52→~52/52 jump.

## Scope guardrails (4a)

- IN: routing reuse + rich enrichment + emit for **BluxSection** (from Hero/TitleBand/RichText), **BluxMediaText** (from SplitFeature), **BluxMedia** (from MediaFull/VideoFeature), **BluxGallery** (from Gallery), **BluxCarousel** (from Carousel), **BluxGrid** (from Grid when depth ≤ 2), and the **BluxBlock** fallback (Grid when deeper / irregular). The recursive cell-builder guaranteeing no media loss.
- OUT (later sub-plans): `<table>`→BluxTable, generic embed/iframe→BluxEmbed, widget→Section-with-`widget_html` / map handling (decision B) — **Plan 4b**. Feeds→entity documents + Collection slice — **Plan 4c**. the-pointe full fidelity gate vs live — **Plan 4d**. In 4a, map/embed/table bands fall through to the BluxBlock fallback (content preserved, not yet promoted). Do NOT inject `opts.isMapMount` in 4a (so maps stay `raw`→Grid→BluxBlock).

## File structure

**reddoor-maintenance** (branch `feat/blux-catalog-emit`):

- `src/blux/catalog/spec.ts` — expand `CatalogSpec` union (modify).
- `src/blux/catalog/cells.ts` — recursive `nodeToCells` cell-builder + `blockPayload` serializer (new).
- `src/blux/catalog/classify.ts` — add `sliceSpecToCatalog` + `bandToCatalog`; keep `bandToCatalogSection` as a thin deprecated re-export or delete after CLI swap (modify).
- `src/blux/catalog/emit.ts` — extend `catalogSpecToPlanSlice` for all specs (modify).
- `src/cli/commands/blux.ts` — swap `bandToCatalogSection`→`bandToCatalog` (modify, 1 line).
- `tests/blux/catalog/{cells,classify-breadth,emit-breadth}.test.ts` + `tests/blux/catalog/classify-golden.test.ts` (new); update `plan-golden.test.ts` snapshot.

---

### Task 0: Baseline

- [ ] **Step 1: Confirm state.** In `/Users/tuckerlemos/Documents/GitHub/reddoor-maintenance`, `git status` (clean bar untracked `app.html`/`pr_body.md`), on branch `feat/blux-catalog-emit`, `git log --oneline -3` shows the skeleton commits (`…golden`, `…CLI action`, `…emitter`). Run `pnpm run build` + `pnpm exec vitest run tests/blux/catalog/ tests/cli/blux-catalog-command.test.ts` → green. (Full `pnpm test` exceeds the 5-min tool timeout; run targeted or background it.)

---

### Task 1: Expand the `CatalogSpec` union

**Files:** modify `src/blux/catalog/spec.ts`.

- [ ] **Step 1: Extend `CatalogCell`** to carry the fields the breadth cells need (add `embedHtml?` for later; keep skeleton fields). Replace the `CatalogCell` type with:

```ts
export type CatalogCell = {
  kind: "text" | "media" | "embed" | "subgrid";
  title?: CatalogRichText;
  body?: CatalogRichText;
  media?: Media;
  mediaRatio?: string;
  embedHtml?: string;
  subgrid?: CatalogCell[];
};
```

- [ ] **Step 2: Add the container/leaf/fallback specs.** After `BluxSectionSpec`, add (all extend a shared base `{ index: number; background?: Media }`):

```ts
type CatalogBase = {
  index: number;
  background?: Media;
  backgroundColor?: string;
};

export type BluxGridSpec = CatalogBase & {
  slice: "BluxGrid";
  heading?: CatalogRichText;
  columns?: number;
  cells: CatalogCell[];
};
export type BluxGallerySpec = CatalogBase & {
  slice: "BluxGallery";
  heading?: CatalogRichText;
  cells: CatalogCell[]; // all kind:"media"
};
export type BluxCarouselSpec = CatalogBase & {
  slice: "BluxCarousel";
  heading?: CatalogRichText;
  columnsVisible?: number;
  cells: CatalogCell[];
};
export type BluxMediaSpec = CatalogBase & {
  slice: "BluxMedia";
  media: Media;
  caption?: CatalogRichText;
};
export type BluxMediaTextSpec = CatalogBase & {
  slice: "BluxMediaText";
  mediaSide: "left" | "right";
  layoutRatio?: number;
  media: Media;
  title?: CatalogRichText;
  body?: CatalogRichText;
};
/** Content-preserving fallback: the serialized node tree (Prismic can't nest
 * deeper than cell→subgrid). `payload` is a `{tag,children,html,image,style}`
 * tree the Plan-2 BluxBlock slice renders recursively. */
export type BluxBlockSpec = CatalogBase & {
  slice: "BluxBlock";
  payload: BlockNode;
};

/** The serialized-tree shape BluxBlock renders (mirror of starter
 * src/lib/slices/BluxBlock/node.ts BluxNode). */
export type BlockNode = {
  tag?: string;
  html?: string;
  image?: { url: string; alt?: string };
  style?: Record<string, string>;
  children?: BlockNode[];
};
```

- [ ] **Step 3: Update the union.** Replace `export type CatalogSpec = BluxSectionSpec;` with:

```ts
export type CatalogSpec =
  | BluxSectionSpec
  | BluxGridSpec
  | BluxGallerySpec
  | BluxCarouselSpec
  | BluxMediaSpec
  | BluxMediaTextSpec
  | BluxBlockSpec;
```

- [ ] **Step 4: Also give `BluxSectionSpec` the shared `backgroundColor`** if it doesn't already have it (it does per the skeleton). Run `pnpm run build`. The existing emit/classify still reference only `BluxSectionSpec` — build errors will surface in Tasks 3–4 where those are extended; if `spec.ts` alone doesn't compile, fix the type only. Commit: `git add src/blux/catalog/spec.ts && git commit -m "feat(blux-catalog): expand CatalogSpec union (grid/gallery/carousel/media/mediatext/block)"`.

---

### Task 2: Recursive cell-builder + BluxBlock serializer

**Files:** create `src/blux/catalog/cells.ts`, `tests/blux/catalog/cells.test.ts`.

The cell-builder is the crux that fixes content loss. It converts a grid `Cell` (or a bare content node) into a `CatalogCell`, recursing ONE level into a nested row (→ `subgrid`); anything deeper than cell→subgrid signals the caller to fall back to BluxBlock.

- [ ] **Step 1: Write the failing tests.** Create `tests/blux/catalog/cells.test.ts` (mirror the node-builder factories from the existing `tests/blux/catalog/classify.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import type { Node, Media } from "../../../src/blux/grid/types.js";
import {
  cellFromNode,
  nodeToCells,
  blockPayload,
  cellDepthExceedsTwo,
} from "../../../src/blux/catalog/cells.js";

const img = (id: string): Media => ({ kind: "image", assetId: id });
const heading = (html: string): Node => ({ kind: "heading", level: 3, html });
const body = (html: string): Node => ({ kind: "body", html });
const media = (m: Media): Node => ({ kind: "media", media: m });
const cell = (node: Node) => ({ token: { cols: 1, raw: "grid-1" }, node });
const row = (nodes: Node[]): Node => ({ kind: "row", cells: nodes.map(cell) });
const stack = (children: Node[]): Node => ({ kind: "stack", children });

describe("cellFromNode", () => {
  it("captures media + heading + body co-located in a sub-stack (skeleton dropped these)", () => {
    const c = cellFromNode(
      stack([
        heading("<h3>The Pointe</h3>"),
        media(img("u1")),
        body("<p>x</p>"),
      ]),
    );
    expect(c.media?.assetId).toBe("u1");
    expect(c.title).toContain("The Pointe");
    expect(c.body).toContain("x");
  });
  it("turns a nested row into a subgrid (one level)", () => {
    const c = cellFromNode(row([media(img("a")), media(img("b"))]));
    expect(c.kind).toBe("subgrid");
    expect(c.subgrid).toHaveLength(2);
    expect(c.subgrid?.[0].media?.assetId).toBe("a");
  });
  it("classifies a bare media node as a media cell", () => {
    expect(cellFromNode(media(img("z"))).kind).toBe("media");
  });
});

describe("nodeToCells", () => {
  it("expands a row into one cell per grid cell, losing no media", () => {
    const cells = nodeToCells(
      row([media(img("a")), stack([heading("<h3>t</h3>"), media(img("b"))])]),
    );
    expect(cells).toHaveLength(2);
    const ids = cells.flatMap((c) => (c.media ? [c.media.assetId] : []));
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });
});

describe("cellDepthExceedsTwo", () => {
  it("flags a row nested inside a cell inside a row (depth 3)", () => {
    expect(cellDepthExceedsTwo(row([stack([row([media(img("a"))])])]))).toBe(
      true,
    );
  });
  it("allows cell→subgrid (depth 2)", () => {
    expect(cellDepthExceedsTwo(row([row([media(img("a"))])]))).toBe(false);
  });
});

describe("blockPayload", () => {
  it("serializes a node tree to a {tag,children,image,html} payload preserving media + text", () => {
    const p = blockPayload(stack([heading("<h3>H</h3>"), media(img("u9"))]));
    const flat = JSON.stringify(p);
    expect(flat).toContain("u9");
    expect(flat).toContain("H");
  });
});
```

- [ ] **Step 2: Run → FAIL.** `pnpm exec vitest run tests/blux/catalog/cells.test.ts`.

- [ ] **Step 3: Implement.** Create `src/blux/catalog/cells.ts`:

```ts
import type { Cell, Media, Node } from "../grid/types.js";
import { collectMedia, collectText } from "../grid/index.js";
import type { BlockNode, CatalogCell } from "./spec.js";

/** Peel one-child style-box stacks (mirror of classify-band unboxed). */
function unbox(n: Node): Node {
  let cur = n;
  while (cur.kind === "stack" && cur.children.length === 1)
    cur = cur.children[0];
  return cur;
}

/** First heading html and joined body html under a node (recursive), so a card
 * that buries its heading/body in sub-stacks still yields title/body. */
function textOf(n: Node): { title?: string; body?: string } {
  const text = collectText(n);
  const h = text.find((t) => t.kind === "heading");
  const bodies = text.filter((t) => t.kind === "body");
  const subs = text.filter((t) => t.kind === "subtitle");
  const title = h && h.kind === "heading" ? h.html : undefined;
  const bodyParts = [
    ...bodies.map((b) => (b.kind === "body" ? b.html : "")),
    ...subs.map((s) => (s.kind === "subtitle" ? `<p>${s.text}</p>` : "")),
  ].filter(Boolean);
  return { title, body: bodyParts.length ? bodyParts.join("\n") : undefined };
}

/** True if `node` nests a row below the cell→subgrid depth (i.e. a row that
 * contains a cell that (recursively) contains another row). Such a band cannot
 * render in Prismic's one-nesting-level model → caller falls back to BluxBlock. */
export function cellDepthExceedsTwo(node: Node): boolean {
  const rowDepth = (n: Node, depth: number): number => {
    const u = unbox(n);
    if (u.kind === "row") {
      const child = Math.max(
        0,
        ...u.cells.map((c) => rowDepth(c.node, depth + 1)),
      );
      return Math.max(depth + 1, child);
    }
    if (u.kind === "stack")
      return Math.max(depth, ...u.children.map((c) => rowDepth(c, depth)));
    return depth;
  };
  return rowDepth(node, 0) > 2;
}

/** One node → one catalog cell. A nested row becomes a subgrid (one level); a
 * media anywhere inside is captured; heading/body are pulled recursively. */
export function cellFromNode(node: Node): CatalogCell {
  const u = unbox(node);
  if (u.kind === "row") {
    return {
      kind: "subgrid",
      subgrid: u.cells.map((c) => cellFromNode(c.node)),
    };
  }
  const media = collectMedia(u)[0];
  const { title, body } = textOf(u);
  if (u.kind === "media" || (media && !title && !body)) {
    return {
      kind: "media",
      media,
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
    };
  }
  return {
    kind: "text",
    ...(title ? { title } : {}),
    ...(body ? { body } : {}),
    ...(media ? { media } : {}),
  };
}

/** A row's cells → catalog cells; a bare content node → a single cell. */
export function nodeToCells(node: Node): CatalogCell[] {
  const u = unbox(node);
  if (u.kind === "row") return u.cells.map((c) => cellFromNode(c.node));
  if (u.kind === "stack") return u.children.map(cellFromNode);
  return [cellFromNode(u)];
}

/** Serialize a node tree to a BluxBlock payload — the content-preserving
 * fallback for bands too deep/irregular for the cell model. Never drops media
 * or text (the whole point). */
export function blockPayload(node: Node): BlockNode {
  const u = node;
  switch (u.kind) {
    case "row":
      return {
        tag: "div",
        style: { display: "grid" },
        children: u.cells.map((c) => blockPayload(c.node)),
      };
    case "stack":
      return { tag: "div", children: u.children.map(blockPayload) };
    case "heading":
      return { tag: `h${u.level}`, html: u.html };
    case "body":
      return { tag: "div", html: u.html };
    case "subtitle":
      return { tag: "p", html: u.text };
    case "media":
      return mediaBlock(u.media);
    case "raw":
      return { html: u.html };
    case "widget":
      return { tag: "div", html: "" }; // 4b captures widget html
  }
}

function mediaBlock(m: Media): BlockNode {
  const url = m.base
    ? `${m.base}${m.assetId}${m.ext ? `.${m.ext}` : ""}`
    : m.assetId;
  return { tag: "figure", image: { url, alt: m.alt ?? "" } };
}
```

- [ ] **Step 4: Run → PASS.** Adjust the test node factories if `Node`/`Media`/`GridToken` fields differ from the real `src/blux/grid/types.ts` (read it; do NOT change production types). Commit: `git add src/blux/catalog/cells.ts tests/blux/catalog/cells.test.ts && git commit -m "feat(blux-catalog): recursive cell-builder + BluxBlock serializer (no content loss)"`.

---

### Task 3: `sliceSpecToCatalog` mapper + `bandToCatalog` router

**Files:** modify `src/blux/catalog/classify.ts`; create `tests/blux/catalog/classify-breadth.test.ts`.

- [ ] **Step 1: Write the failing tests** — build tiny `Band`s that `classifyBand` routes to each archetype, and assert the catalog spec + that media survives. Mirror the fixtures in `tests/blux/grid-classify.test.ts` (import its `media()/heading()/body()/stack()` style). Cover: a 2-cell media+text row → `BluxMediaText` with media + title; a `≥2` pure-media row → `BluxGallery` with N media cells; a single media band → `BluxMedia`; a heading-only band → `BluxSection`; a deep nested-row band → `BluxBlock` with a payload containing the buried media ids. Create `tests/blux/catalog/classify-breadth.test.ts` accordingly (assert `.slice`, media capture, and for BluxBlock that `JSON.stringify(spec.payload)` contains the buried asset ids).

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** In `src/blux/catalog/classify.ts`, ADD (keep `bandToCatalogSection` for now — it's still imported by the CLI until Task 5):

```ts
import { classifyBand, collectMedia, type SliceSpec } from "../grid/index.js";
import {
  cellFromNode,
  nodeToCells,
  blockPayload,
  cellDepthExceedsTwo,
} from "./cells.js";
import type { Band, Node } from "../grid/types.js";
import type { CatalogCell, CatalogSpec } from "./spec.js";

const baseOf = (band: Band) => ({
  index: band.index,
  ...(band.background ? { background: band.background } : {}),
});

/** Map a thin routed SliceSpec + its Band to a rich CatalogSpec. Reuses the
 * battle-tested routing; builds full cells by walking the node subtree. */
export function sliceSpecToCatalog(spec: SliceSpec, band: Band): CatalogSpec {
  const base = baseOf(band);
  switch (spec.slice) {
    case "Hero":
    case "TitleBand":
    case "RichText":
      // Overlay/centered/body text → a Section; heading split out of the cells.
      return {
        slice: "BluxSection",
        ...base,
        ...splitHeadingAndCells(band.root),
      };
    case "SplitFeature":
      return {
        slice: "BluxMediaText",
        ...base,
        mediaSide: spec.mediaSide,
        layoutRatio: spec.ratio,
        media: spec.media,
        ...pick(cellFromNode(spec.text)),
      };
    case "MediaFull":
    case "VideoFeature":
      return { slice: "BluxMedia", ...base, media: spec.media };
    case "Gallery":
      return {
        slice: "BluxGallery",
        ...base,
        cells: spec.media.map(
          (m) => ({ kind: "media", media: m }) as CatalogCell,
        ),
      };
    case "Carousel":
      return {
        slice: "BluxCarousel",
        ...base,
        columnsVisible: spec.columns,
        cells: spec.slides.map(
          (s) =>
            ({
              kind: "media",
              media: s.media,
              ...(s.caption ? { title: s.caption.html } : {}),
            }) as CatalogCell,
        ),
      };
    case "LocationMap":
      // 4a: no isMapMount injected, so this only fires if a caller injects it;
      // preserve content via the fallback.
      return { slice: "BluxBlock", ...base, payload: blockPayload(band.root) };
    case "Grid":
    default: {
      // Rich grid when it fits the depth-2 model; else the opaque fallback.
      if (cellDepthExceedsTwo(spec.root))
        return {
          slice: "BluxBlock",
          ...base,
          payload: blockPayload(spec.root),
        };
      return { slice: "BluxGrid", ...base, ...splitHeadingAndCells(spec.root) };
    }
  }
}

/** The band router: reuse classifyBand for routing, enrich to catalog. */
export function bandToCatalog(band: Band): CatalogSpec {
  return sliceSpecToCatalog(classifyBand(band), band);
}

// -- helpers --
/** Split a root into its section heading (first heading-only cell) + the
 * remaining content cells, so the heading is not duplicated as both the
 * section heading AND a cell title. */
function splitHeadingAndCells(root: Node): {
  heading?: string;
  cells: CatalogCell[];
} {
  const cells = nodeToCells(root).filter(
    (c) => c.title || c.body || c.media || c.subgrid,
  );
  const hIdx = cells.findIndex(
    (c) => c.title && !c.body && !c.media && !c.subgrid,
  );
  if (hIdx >= 0)
    return {
      heading: cells[hIdx].title,
      cells: cells.filter((_, i) => i !== hIdx),
    };
  return { cells };
}
function pick(c: CatalogCell): { title?: string; body?: string } {
  return {
    ...(c.title ? { title: c.title } : {}),
    ...(c.body ? { body: c.body } : {}),
  };
}
```

> The mapper reuses `classifyBand` from `grid/index.js`; confirm `classifyBand` + `SliceSpec` are exported there (the grid barrel re-exports the classifier — verify and, if `classifyBand` isn't in the barrel, import from `../grid/classify-band.js`). Read `grid/slice-spec.ts` for the exact `SliceSpec` member field names (`spec.mediaSide`, `spec.ratio`, `spec.media`, `spec.slides`, `spec.columns`, `spec.root`) and adjust if they differ.

- [ ] **Step 4: Run → PASS.** Commit: `git add src/blux/catalog/classify.ts tests/blux/catalog/classify-breadth.test.ts && git commit -m "feat(blux-catalog): sliceSpecToCatalog mapper + bandToCatalog router (reuses classifyBand)"`.

---

### Task 4: Extend emit for every spec

**Files:** modify `src/blux/catalog/emit.ts`; create `tests/blux/catalog/emit-breadth.test.ts`.

- [ ] **Step 1: Write failing tests** — one per new spec, asserting the emitted `slice_type` + populated primary (markers where rich text/media). E.g. a `BluxMediaText` spec → `{ slice_type:"blux_media_text", primary:{ media:{__asset_id}, media_side, title:{__richtext_html}, ... } }`; a `BluxGallery` → `blux_gallery` with `cells` each `{kind:"media", media:{__asset_id}}`; a `BluxBlock` → `blux_block` with `primary.payload` a JSON string containing the asset urls. Create `tests/blux/catalog/emit-breadth.test.ts`.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** In `src/blux/catalog/emit.ts`, replace the single-case `catalogSpecToPlanSlice` with a full switch. Reuse the existing `cellToItem` (skeleton) for cell groups; add per-slice primaries. Key mappings (use the exact Plan-2 field names in Confirmed groundwork):

```ts
export function catalogSpecToPlanSlice(spec: CatalogSpec): PlanSlice {
  const bg = spec.background
    ? { background_image: assetRef(spec.background.assetId) }
    : {};
  const bgc = spec.backgroundColor
    ? { background_color: spec.backgroundColor }
    : {};
  switch (spec.slice) {
    case "BluxSection":
      return sliceOf("blux_section", {
        ...bg,
        ...bgc,
        ...heading(spec),
        cells: spec.cells.map(cellToItem),
      });
    case "BluxGrid":
      return sliceOf("blux_grid", {
        ...bg,
        ...bgc,
        ...heading(spec),
        ...(spec.columns ? { columns: spec.columns } : {}),
        cells: spec.cells.map(cellToItem),
      });
    case "BluxGallery":
      return sliceOf("blux_gallery", {
        ...bg,
        ...bgc,
        ...heading(spec),
        cells: spec.cells.map(cellToItem),
      });
    case "BluxCarousel":
      return sliceOf("blux_carousel", {
        ...bg,
        ...bgc,
        ...heading(spec),
        ...(spec.columnsVisible
          ? { columns_visible: spec.columnsVisible }
          : {}),
        cells: spec.cells.map(cellToItem),
      });
    case "BluxMedia":
      return sliceOf("blux_media", {
        media: assetRef(spec.media.assetId),
        ...(spec.caption ? { caption: richText(spec.caption) } : {}),
      });
    case "BluxMediaText":
      return sliceOf("blux_media_text", {
        media: assetRef(spec.media.assetId),
        media_side: spec.mediaSide,
        ...(spec.layoutRatio ? { layout_ratio: spec.layoutRatio } : {}),
        ...(spec.title ? { title: richText(spec.title) } : {}),
        ...(spec.body ? { body: richText(spec.body) } : {}),
      });
    case "BluxBlock":
      return sliceOf("blux_block", { payload: JSON.stringify(spec.payload) });
  }
}
```

Add helpers `sliceOf(type, primary): PlanSlice = ({ slice_type: type, variation: "default", items: [], primary })` and `heading(spec) = "heading" in spec && spec.heading ? { heading: richText(spec.heading) } : {}`. Extend `cellToItem` to emit `embed_html` when `cell.embedHtml` is set (forward-compat). Update `specMedia`/`buildCatalogPlan`'s media walk to include the new specs' media (BluxMedia.media, BluxMediaText.media, gallery/carousel/grid cell media, and BluxBlock — walk the original band via the existing IR asset index rather than the payload). NOTE: for BluxBlock, media urls are already inlined in the payload; ensure those assets are still uploaded by collecting them from the band (keep the CLI's IR asset index as the asset source; the golden runs with `assets:[]` and resolves via `data-base`).

- [ ] **Step 4: Run → PASS.** Commit: `git add src/blux/catalog/emit.ts tests/blux/catalog/emit-breadth.test.ts && git commit -m "feat(blux-catalog): emit all catalog specs to their Plan-2 slices"`.

---

### Task 5: Wire the CLI to the breadth router

**Files:** modify `src/cli/commands/blux.ts`; update `tests/blux/catalog/plan-golden.test.ts` snapshot.

- [ ] **Step 1: Swap the call.** In `src/cli/commands/blux.ts` (the `catalog` action, ~line 471), change `.map(bandToCatalogSection)` to `.map(bandToCatalog)` and update the import. (Optionally delete `bandToCatalogSection` + its `tests/blux/catalog/classify.test.ts` now that it's unused — or keep it and note it's superseded; prefer deleting to avoid dead code, updating any importing test.)

- [ ] **Step 2: Refresh the skeleton golden.** The existing `tests/blux/catalog/plan-golden.test.ts` will now emit varied slice types. Run `pnpm exec vitest run tests/blux/catalog/plan-golden.test.ts -u` to update its snapshot; READ the new snapshot and confirm it now contains `blux_grid`/`blux_media_text`/`blux_gallery`/etc. (not all `blux_section`) and that markers are populated.

- [ ] **Step 3: CLI test still green.** `pnpm exec vitest run tests/cli/blux-catalog-command.test.ts` (the minimal fixture may now route to a different slice — update its assertion from `blux_section` to the actual routed type, or make the fixture a clear Section). Commit: `git add -A src/cli/commands/blux.ts tests/blux/catalog/ && git commit -m "feat(blux-catalog): CLI uses breadth bandToCatalog; refresh goldens"`.

---

### Task 6: the-pointe classify golden (the capture-rate proof)

**Files:** create `tests/blux/catalog/classify-golden.test.ts`.

- [ ] **Step 1: Write the golden** mirroring `tests/blux/grid-classify-golden.test.ts`: parse `fixtures/the-pointe-page-content.html` → `bands` → `bands.map(bandToCatalog)` → a `summary(spec)` one-liner per band INCLUDING a media count, plus an aggregate assertion. Create `tests/blux/catalog/classify-golden.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseGridBands, collectMedia } from "../../src/blux/grid/index.js";
import { bandToCatalog } from "../../src/blux/catalog/index.js";

function specMediaCount(spec: any): number {
  if (spec.slice === "BluxBlock")
    return JSON.stringify(spec.payload).split('"image"').length - 1;
  if (spec.media) return 1;
  const cells = spec.cells ?? [];
  const walk = (cs: any[]): number =>
    cs.reduce(
      (n, c) => n + (c.media ? 1 : 0) + (c.subgrid ? walk(c.subgrid) : 0),
      0,
    );
  return walk(cells);
}

describe("catalog breadth classify — the-pointe (golden)", () => {
  it("routes every band and captures the vast majority of source media", () => {
    const html = readFileSync(
      join(__dirname, "../fixtures/the-pointe-page-content.html"),
      "utf-8",
    );
    const bands = parseGridBands(html);
    const sourceMedia = bands.reduce(
      (n, b) => n + collectMedia(b.root).length,
      0,
    );
    const specs = bands.map(bandToCatalog);
    const captured = specs.reduce((n, s) => n + specMediaCount(s), 0);
    // Skeleton captured 7/52; breadth must capture the vast majority.
    expect(captured).toBeGreaterThanOrEqual(Math.floor(sourceMedia * 0.9));
    const lines = specs.map(
      (s, i) => `${i} ${s.slice} media=${specMediaCount(s)}`,
    );
    expect({ sourceMedia, captured, lines }).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run + record.** `pnpm exec vitest run tests/blux/catalog/classify-golden.test.ts`. If `captured < 90%`, READ the snapshot to find which bands still drop media (likely a Node kind the cell-builder mishandles) and fix `cells.ts` — do NOT lower the threshold to pass. Record the final `captured/sourceMedia` in the commit body. Commit: `git add tests/blux/catalog/classify-golden.test.ts tests/blux/catalog/__snapshots__/ && git commit -m "test(blux-catalog): the-pointe classify golden — media capture NN/52"`.

---

### Task 7: Full gate + review

- [ ] **Step 1: Gate.** `pnpm run build` (clean); `pnpm exec vitest run tests/blux/ tests/cli/` (catalog + grid + CLI green — the reused `classifyBand` goldens must be UNCHANGED, proving routing wasn't altered); then the full `pnpm exec vitest run` (background it; 2977+ tests, 0 regressions). Confirm `git status` shows only intended files + the untracked `app.html`/`pr_body.md`.
- [ ] **Step 2: Cross-repo render spot-check.** In reddoor-starter, extend `BluxSection.emit-skeleton.test.ts` (or add siblings) with one resolved-shape render per NEW slice type (BluxGrid/Gallery/Carousel/MediaText/Media) to prove the breadth emit's field-names line up with each Plan-2 component. Gate the starter (`pnpm run check` / `lint` / `vitest --pool=threads`). Commit in starter.
- [ ] **Step 3: Review.** Dispatch spec-compliance + code-quality review of the breadth classifier (both repos' changes), plus an adversarial check that the reused `classifyBand` goldens are byte-unchanged (routing untouched) and that no band-media is dropped relative to `collectMedia(band.root)`.

---

## Definition of done

- `bandToCatalog` routes every the-pointe band to a catalog slice, reusing `classifyBand` (its goldens unchanged), and captures ≥90% of source media (skeleton was 7/52 ≈ 13%).
- Every `CatalogSpec` emits to its Plan-2 slice with populated, marker-bearing primaries; deep/irregular bands preserve content via BluxBlock.
- Both repos' suites green; Path A / Path B / `classify-band.ts` untouched.

## Not in this plan (4b/4c/4d)

`<table>`→BluxTable + generic embed/iframe→BluxEmbed + widget→Section-with-`widget_html` / map config (decision B) = **4b**. Feed materialization → entity documents + feed-backed Collection slice = **4c**. the-pointe FULL fidelity gate vs the live site (all bands, pixel/text parity) + rollout to tower/composition = **4d**.
