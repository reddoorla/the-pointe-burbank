# Blux Catalog Slices — Implementation Plan (Plan 2 of N)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the remaining catalog slices on the cell model Plan 1 proved — a shared `BluxCell` renderer, the container slices (Grid, Gallery, Carousel), the leaf slices (Media, MediaText, Embed, Table), and the collection entity custom types — so the catalog covers the full band vocabulary except the feed-backed `Collection` slice (deferred to Plan 3, where feed materialization lands).

**Architecture:** Extends Plan 1. A hand-written `BluxCellData` structural type + a shared `BluxCell.svelte` render the cell contract once; every container slice reuses it. Container slices carry the same `cells`+`subgrid`+`widget`+background contract as `BluxSection` plus container-specific geometry; leaf slices carry no `widget` (decision B). Entity types mirror `collection_item`.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, `@prismicio/client` 7.21, `@prismicio/svelte` 2.2, Slice Machine 2.21.3 + adapter-sveltekit 0.3.96, vitest 4, pnpm 11.8.

**Spec:** `docs/superpowers/specs/2026-07-17-blux-catalog-pipeline-design.md` (§6 catalog, §7 classifier, decision B = widgets container-level). **Builds on:** `docs/superpowers/plans/2026-07-17-blux-catalog-foundation.md`.

---

## Shared conventions (every task relies on these — established in Plan 1)

- **Namespacing:** `blux_*` slice IDs, `Blux*` dirs. Dir name MUST equal the model `name` (PascalCase).
- **Codegen (types):** `svelte-kit sync`/`vite build`/`start-slicemachine` do NOT regenerate types headlessly. Use the manager script at `/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/regen-types.mjs` — if missing, recreate it (ask the controller for content). Invoke from repo root: `node <script> "$PWD" "./src/lib/slices" "src/lib/slices/<Name>/model.json"`. It rewrites `src/prismicio-types.d.ts` and re-reads ALL models (so it also picks up new custom types). After running, `git checkout --` any incidentally-reformatted OTHER slice files (mock-key re-randomization) so only intended files change. It generates a `<Name>/mocks.json` — include it in the commit.
- **Registration (`index.js`):** the manager's `slice:update` does NOT rewrite `src/lib/slices/index.js`. Hand-edit it to add `import <Name> from "./<Name>/index.svelte";` + `<slice_id>: <Name>,` in alphabetical position (forward-compatible — SM reproduces this on its next scan). Task 9 does this for all new slices at once.
- **Tests:** vitest + `@testing-library/svelte`, file named `<Name>.test.ts`, MUST include `import { cleanup } from "@testing-library/svelte"` + `afterEach(() => cleanup())` (repo setup has no auto-cleanup). Mock slice = plain object cast `as unknown as Content.<Name>Slice`. Assert background color as `rgb(...)` (jsdom normalizes hex). Run one file: `pnpm exec vitest run <path>`.
- **Gate:** `pnpm run check` (0 errors; the `Cannot find type definition file for 'node'` warning is pre-existing/OK). `pnpm run lint` (eslint enforces `svelte/require-each-key` — every `{#each x as y}` needs `(y)`; and `svelte/no-at-html-tags` — every `{@html}` needs a preceding `<!-- eslint-disable-next-line svelte/no-at-html-tags -- <reason> -->`). Never use `any`/`@ts-ignore` to silence a real type error — STOP and report.
- **`{@html}` justification comment (reuse verbatim):** `<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->`
- **Sandbox test caveat:** the default vitest `forks` pool fails in this sandbox; run suites with `pnpm exec vitest run --pool=threads`. Single files are usually fine either way.
- **Decision B:** container slices (Grid/Gallery/Carousel) carry `widget_kind`/`widget_html`; leaf slices (Media/MediaText/Embed/Table) do NOT.

## File structure (created/modified)

- `src/lib/blux-catalog/cell.ts` — `BluxCellData` structural type (new).
- `src/lib/blux-catalog/BluxCell.svelte` — shared cell renderer (new).
- `src/lib/slices/BluxSection/index.svelte` — refactor onto `BluxCell` (modify).
- `src/lib/slices/{BluxGrid,BluxGallery,BluxCarousel}/{model.json,index.svelte,<Name>.test.ts,mocks.json}` — container slices.
- `src/lib/slices/{BluxMedia,BluxMediaText,BluxEmbed,BluxTable}/{model.json,index.svelte,<Name>.test.ts,mocks.json}` — leaf slices.
- `customtypes/{product,person,event,news_article,project}/index.json` — entity types.
- `customtypes/page/index.json`, `src/lib/slices/index.js`, `src/prismicio-types.d.ts` — registration (Task 9).

---

### Task 0: Shared `BluxCell` + refactor BluxSection onto it

**Files:** Create `src/lib/blux-catalog/cell.ts`, `src/lib/blux-catalog/BluxCell.svelte`; Modify `src/lib/slices/BluxSection/index.svelte`.

- [ ] **Step 1: Write the shared cell type.** Create `src/lib/blux-catalog/cell.ts`:

```ts
import type * as prismic from "@prismicio/client";

/** The structural cell shape shared by every catalog container slice's
 * generated cell-item type (BluxSection/Grid/Gallery/... CellsItem, and their
 * SubgridItem). BluxCell.svelte renders any of them; a container casts its
 * generated `cells` items to this at the render boundary. `subgrid` is the one
 * nested level (leaf cells only); it is absent on subgrid items themselves. */
export type BluxCellData = {
  kind: prismic.SelectField<string> | null;
  title: prismic.RichTextField;
  body: prismic.RichTextField;
  media: prismic.ImageField;
  media_ratio: prismic.KeyTextField;
  embed_html: prismic.KeyTextField;
  link: prismic.LinkField;
  link_label: prismic.KeyTextField;
  subgrid?: BluxCellData[];
};
```

- [ ] **Step 2: Write the shared cell renderer.** Create `src/lib/blux-catalog/BluxCell.svelte`:

```svelte
<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import type { BluxCellData } from "$lib/blux-catalog/cell";
  import Self from "./BluxCell.svelte";

  let { cell }: { cell: BluxCellData } = $props();
  let sub = $derived(cell.subgrid ?? []);
</script>

<div class="blux-cell" data-kind={cell.kind}>
  {#if isFilled.image(cell.media)}
    <div class="blux-cell__media" data-ratio={cell.media_ratio}>
      <PrismicImage field={cell.media} />
    </div>
  {/if}
  {#if isFilled.richText(cell.title)}<PrismicRichText field={cell.title} />{/if}
  {#if isFilled.richText(cell.body)}<PrismicRichText field={cell.body} />{/if}
  {#if isFilled.keyText(cell.embed_html)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html cell.embed_html}
  {/if}
  {#if isFilled.link(cell.link)}<PrismicLink field={cell.link}
      >{cell.link_label || "Read more"}</PrismicLink
    >{/if}
  {#if sub.length}
    <div class="blux-subgrid" data-cells={sub.length}>
      {#each sub as s (s)}<Self cell={s} />{/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Refactor BluxSection onto BluxCell.** In `src/lib/slices/BluxSection/index.svelte`: delete the `{#snippet cellLeaf}` block and the `LeafCell` type; import `BluxCell` and `BluxCellData`; replace the `{#each cells}` body so each top-level cell renders via the shared component. The resulting `.blux-section__cells` block must be:

```svelte
  <div
    class="blux-section__cells"
    data-align={slice.primary.vertical_align}
    data-max-width={slice.primary.max_content_width}
  >
    {#each cells as cell (cell)}
      <BluxCell cell={cell as unknown as BluxCellData} />
    {/each}
  </div>
```

Add the imports to the `<script>`: `import BluxCell from "$lib/blux-catalog/BluxCell.svelte";` and `import type { BluxCellData } from "$lib/blux-catalog/cell";`. Keep `PrismicImage`/`PrismicRichText` (still used for background + heading) but drop `PrismicLink` if now unused. Keep the `Cell` type alias for `cells`. The `.blux-cell`/`.blux-subgrid` DOM structure is now produced by `BluxCell`, so it is unchanged from the consumer's perspective.

- [ ] **Step 4: Typecheck.** Run `pnpm run check` → 0 errors. If `cell as unknown as BluxCellData` still errors, report; do not fall back to `any`.

- [ ] **Step 5: Verify BluxSection's existing tests still pass (regression gate).** Run `pnpm exec vitest run src/lib/slices/BluxSection/BluxSection.test.ts` → all 4 pass unchanged (the `.blux-section__cells > .blux-cell` direct-child count and nested `<h4>` assertions must still hold, proving the refactor preserved the DOM).

- [ ] **Step 6: Lint + commit.** Run `pnpm run lint` (expect clean). Then:

```bash
git add src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.svelte src/lib/slices/BluxSection/index.svelte
git commit -m "refactor(blux): extract shared BluxCell renderer; BluxSection uses it"
```

---

### Task 1: BluxGrid container slice

**Files:** Create `src/lib/slices/BluxGrid/{model.json,index.svelte,BluxGrid.test.ts}` (+ generated `mocks.json`).

- [ ] **Step 1: Model.** Create `src/lib/slices/BluxGrid/model.json` — the BluxSection primary (heading, background_image, background_color, overlay, max_content_width, vertical_align, min_height, widget_kind, widget_html, and the full `cells` group with its nested `subgrid`) PLUS grid geometry fields. Copy the `cells` group verbatim from `src/lib/slices/BluxSection/model.json` (it is the canonical cell field-set). The model:

```json
{
  "id": "blux_grid",
  "type": "SharedSlice",
  "name": "BluxGrid",
  "description": "Blux catalog: a uniform-column grid of typed cells (one may nest a subgrid).",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "...",
      "version": "initial",
      "description": "Grid",
      "imageUrl": "",
      "primary": {
        "heading": {
          "type": "StructuredText",
          "config": { "label": "heading", "single": "heading2,heading3" }
        },
        "background_image": {
          "type": "Image",
          "config": {
            "label": "background_image",
            "constraint": {},
            "thumbnails": []
          }
        },
        "background_color": {
          "type": "Text",
          "config": { "label": "background_color" }
        },
        "overlay": { "type": "Text", "config": { "label": "overlay" } },
        "max_content_width": {
          "type": "Text",
          "config": { "label": "max_content_width" }
        },
        "vertical_align": {
          "type": "Select",
          "config": {
            "label": "vertical_align",
            "options": ["top", "middle", "bottom"]
          }
        },
        "min_height": { "type": "Text", "config": { "label": "min_height" } },
        "widget_kind": { "type": "Text", "config": { "label": "widget_kind" } },
        "widget_html": { "type": "Text", "config": { "label": "widget_html" } },
        "columns": {
          "type": "Number",
          "config": { "label": "columns", "placeholder": "3" }
        },
        "column_width": {
          "type": "Text",
          "config": { "label": "column_width" }
        },
        "spacing": { "type": "Number", "config": { "label": "spacing" } },
        "mobile_spacing": {
          "type": "Number",
          "config": { "label": "mobile_spacing" }
        },
        "row_height": {
          "type": "Text",
          "config": { "label": "row_height (equal | <px>)" }
        },
        "cells": {
          "type": "Group",
          "config": {
            "label": "cells",
            "fields": {
              "kind": {
                "type": "Select",
                "config": {
                  "label": "kind",
                  "options": ["text", "media", "embed", "button", "subgrid"]
                }
              },
              "title": {
                "type": "StructuredText",
                "config": { "label": "title", "single": "heading3,heading4" }
              },
              "body": {
                "type": "StructuredText",
                "config": {
                  "label": "body",
                  "multi": "paragraph,strong,em,hyperlink,list-item"
                }
              },
              "media": {
                "type": "Image",
                "config": {
                  "label": "media",
                  "constraint": {},
                  "thumbnails": []
                }
              },
              "media_ratio": {
                "type": "Text",
                "config": { "label": "media_ratio" }
              },
              "link": {
                "type": "Link",
                "config": { "label": "link", "allowTargetBlank": true }
              },
              "link_label": {
                "type": "Text",
                "config": { "label": "link_label" }
              },
              "embed_html": {
                "type": "Text",
                "config": { "label": "embed_html" }
              },
              "subgrid": {
                "type": "Group",
                "config": {
                  "label": "subgrid",
                  "fields": {
                    "kind": {
                      "type": "Select",
                      "config": {
                        "label": "kind",
                        "options": ["text", "media", "embed"]
                      }
                    },
                    "title": {
                      "type": "StructuredText",
                      "config": {
                        "label": "title",
                        "single": "heading4,heading5"
                      }
                    },
                    "body": {
                      "type": "StructuredText",
                      "config": {
                        "label": "body",
                        "multi": "paragraph,strong,em,hyperlink,list-item"
                      }
                    },
                    "media": {
                      "type": "Image",
                      "config": {
                        "label": "media",
                        "constraint": {},
                        "thumbnails": []
                      }
                    },
                    "media_ratio": {
                      "type": "Text",
                      "config": { "label": "media_ratio" }
                    },
                    "link": {
                      "type": "Link",
                      "config": { "label": "link", "allowTargetBlank": true }
                    },
                    "link_label": {
                      "type": "Text",
                      "config": { "label": "link_label" }
                    },
                    "embed_html": {
                      "type": "Text",
                      "config": { "label": "embed_html" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "items": {}
    }
  ]
}
```

Run the regen script; `pnpm run check` → 0 errors; confirm `Content.BluxGridSlice` + `BluxGridSliceDefaultPrimaryCellsItem` exist.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxGrid/index.svelte`:

```svelte
<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import BluxCell from "$lib/blux-catalog/BluxCell.svelte";
  import type { BluxCellData } from "$lib/blux-catalog/cell";

  let { slice }: { slice: Content.BluxGridSlice } = $props();
  type Cell = Content.BluxGridSliceDefaultPrimaryCellsItem;
  let cells = $derived((slice.primary.cells ?? []) as Cell[]);

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
</script>

<section
  class="blux-grid"
  data-overlay={slice.primary.overlay}
  style={bandStyle}
>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage
      field={slice.primary.background_image}
      class="blux-grid__bg"
    />
  {/if}
  {#if isFilled.richText(slice.primary.heading)}
    <PrismicRichText field={slice.primary.heading} />
  {/if}
  <div
    class="blux-grid__cells"
    data-columns={slice.primary.columns ?? 3}
    data-spacing={slice.primary.spacing}
    data-row-height={slice.primary.row_height}
    data-max-width={slice.primary.max_content_width}
  >
    {#each cells as cell (cell)}
      <BluxCell cell={cell as unknown as BluxCellData} />
    {/each}
  </div>
  {#if isFilled.keyText(slice.primary.widget_html)}
    <div class="blux-widget" data-widget={slice.primary.widget_kind}>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
      {@html slice.primary.widget_html}
    </div>
  {/if}
</section>
```

Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxGrid/BluxGrid.test.ts`:

```ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxGrid from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

const slice = {
  slice_type: "blux_grid",
  variation: "default",
  primary: {
    heading: rt("heading2", "Amenities"),
    columns: 4,
    spacing: 16,
    cells: [
      { kind: "text", title: rt("heading3", "Pool"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Gym"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Roof"), subgrid: [] },
    ],
  },
} as unknown as Content.BluxGridSlice;

describe("BluxGrid slice", () => {
  it("renders one cell per entry and reflects the column count", () => {
    const { container, getAllByRole } = render(BluxGrid, { props: { slice } });
    expect(
      container.querySelector(".blux-grid__cells[data-columns='4']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(".blux-grid__cells > .blux-cell"),
    ).toHaveLength(3);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
```

Run `pnpm exec vitest run src/lib/slices/BluxGrid/BluxGrid.test.ts` → pass.

- [ ] **Step 4: Lint + commit.** `pnpm run lint` clean, then:

```bash
git add src/lib/slices/BluxGrid/ src/prismicio-types.d.ts
git commit -m "feat(blux): BluxGrid container slice"
```

---

### Task 2: BluxGallery container slice

**Files:** Create `src/lib/slices/BluxGallery/{model.json,index.svelte,BluxGallery.test.ts}`.

- [ ] **Step 1: Model.** Same as BluxGrid's model, with `id: "blux_gallery"`, `name: "BluxGallery"`, description "Blux catalog: a media grid/masonry of cells.", and REPLACE the grid geometry fields (`column_width`, `mobile_spacing`, `row_height`) with gallery fields — keep `columns`, `spacing`, and add:

```json
"masonry": { "type": "Select", "config": { "label": "masonry", "options": ["off", "on"] } },
"ratio": { "type": "Text", "config": { "label": "ratio (e.g. 4:3)" } }
```

Keep the identical `cells` group (copy from BluxSection). Run regen; `pnpm run check` 0 errors; confirm `Content.BluxGallerySlice`.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxGallery/index.svelte` — identical to BluxGrid's component but: `Content.BluxGallerySlice` / `BluxGallerySliceDefaultPrimaryCellsItem`, root class `blux-gallery`, bg class `blux-gallery__bg`, cells container class `blux-gallery__cells` with `data-columns={slice.primary.columns ?? 3}` `data-masonry={slice.primary.masonry}` `data-ratio={slice.primary.ratio}` `data-spacing={slice.primary.spacing}` `data-max-width={slice.primary.max_content_width}`. Same background/heading/widget/`{#each}<BluxCell>` structure. Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxGallery/BluxGallery.test.ts` — mirror BluxGrid's test with `slice_type: "blux_gallery"`, `Content.BluxGallerySlice`, `masonry: "on"`, 3 media-less text cells; assert `.blux-gallery__cells[data-masonry='on']` present and `.blux-gallery__cells > .blux-cell` length 3. Run the file → pass.

- [ ] **Step 4: Lint + commit.** `git add src/lib/slices/BluxGallery/ src/prismicio-types.d.ts && git commit -m "feat(blux): BluxGallery container slice"`.

---

### Task 3: BluxCarousel container slice

**Files:** Create `src/lib/slices/BluxCarousel/{model.json,index.svelte,BluxCarousel.test.ts}`.

- [ ] **Step 1: Model.** Same base as BluxGrid (heading/background/overlay/max_content_width/vertical_align/min_height/widget + the identical `cells` group), with `id: "blux_carousel"`, `name: "BluxCarousel"`, description "Blux catalog: a slides/carousel of cells.", and REPLACE the grid geometry with carousel fields:

```json
"columns_visible": { "type": "Number", "config": { "label": "columns_visible", "placeholder": "1" } },
"arrows": { "type": "Select", "config": { "label": "arrows", "options": ["on", "off"] } },
"dots": { "type": "Select", "config": { "label": "dots", "options": ["on", "off"] } },
"dots_position": { "type": "Text", "config": { "label": "dots_position" } },
"autoplay": { "type": "Select", "config": { "label": "autoplay", "options": ["off", "on"] } },
"transition": { "type": "Text", "config": { "label": "transition" } },
"transition_speed": { "type": "Number", "config": { "label": "transition_speed" } }
```

Run regen; `pnpm run check` 0 errors; confirm `Content.BluxCarouselSlice`.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxCarousel/index.svelte` — identical structure to BluxGrid but: `Content.BluxCarouselSlice` / `BluxCarouselSliceDefaultPrimaryCellsItem`, root class `blux-carousel`, bg class `blux-carousel__bg`, cells container class `blux-carousel__track` with `data-columns-visible={slice.primary.columns_visible ?? 1}` `data-arrows={slice.primary.arrows}` `data-dots={slice.primary.dots}` `data-autoplay={slice.primary.autoplay}`. (No interactive JS — the design layer wires slider behavior from these hooks; content fidelity is what matters here.) Same heading/bg/widget/`{#each}<BluxCell>`. Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxCarousel/BluxCarousel.test.ts` — mirror BluxGrid's test with `slice_type: "blux_carousel"`, `Content.BluxCarouselSlice`, `columns_visible: 1`, `arrows: "on"`, 3 text cells; assert `.blux-carousel__track[data-arrows='on']` present and `.blux-carousel__track > .blux-cell` length 3. Run → pass.

- [ ] **Step 4: Lint + commit.** `git add src/lib/slices/BluxCarousel/ src/prismicio-types.d.ts && git commit -m "feat(blux): BluxCarousel container slice"`.

---

### Task 4: BluxMedia leaf slice

**Files:** Create `src/lib/slices/BluxMedia/{model.json,index.svelte,BluxMedia.test.ts}`. (Leaf — NO widget fields.)

- [ ] **Step 1: Model.** Create `src/lib/slices/BluxMedia/model.json`:

```json
{
  "id": "blux_media",
  "type": "SharedSlice",
  "name": "BluxMedia",
  "description": "Blux catalog: a single media leaf — image, or a video/embed via raw HTML — with ratio/crop, caption, and an optional link.",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "...",
      "version": "initial",
      "description": "Media",
      "imageUrl": "",
      "primary": {
        "media": {
          "type": "Image",
          "config": { "label": "media", "constraint": {}, "thumbnails": [] }
        },
        "video_embed": {
          "type": "Text",
          "config": {
            "label": "video_embed (raw html for video/youtube/vimeo)"
          }
        },
        "ratio": { "type": "Text", "config": { "label": "ratio" } },
        "crop": { "type": "Text", "config": { "label": "crop" } },
        "caption": {
          "type": "StructuredText",
          "config": {
            "label": "caption",
            "multi": "paragraph,strong,em,hyperlink"
          }
        },
        "link": {
          "type": "Link",
          "config": { "label": "link", "allowTargetBlank": true }
        },
        "link_label": { "type": "Text", "config": { "label": "link_label" } }
      },
      "items": {}
    }
  ]
}
```

Run regen; `pnpm run check` 0 errors; confirm `Content.BluxMediaSlice`.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxMedia/index.svelte`:

```svelte
<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";

  let { slice }: { slice: Content.BluxMediaSlice } = $props();
</script>

<figure
  class="blux-media"
  data-ratio={slice.primary.ratio}
  data-crop={slice.primary.crop}
>
  {#if isFilled.image(slice.primary.media)}
    <PrismicImage field={slice.primary.media} />
  {:else if isFilled.keyText(slice.primary.video_embed)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html slice.primary.video_embed}
  {/if}
  {#if isFilled.richText(slice.primary.caption)}
    <figcaption><PrismicRichText field={slice.primary.caption} /></figcaption>
  {/if}
  {#if isFilled.link(slice.primary.link)}
    <PrismicLink field={slice.primary.link}
      >{slice.primary.link_label || "View"}</PrismicLink
    >
  {/if}
</figure>
```

Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxMedia/BluxMedia.test.ts`:

```ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxMedia from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

describe("BluxMedia slice", () => {
  it("renders an image with caption and ratio", () => {
    const slice = {
      slice_type: "blux_media",
      variation: "default",
      primary: {
        media: {
          url: "https://cdn.example/x.jpg",
          alt: "x",
          dimensions: { width: 800, height: 600 },
          edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
        },
        ratio: "4:3",
        caption: rt("paragraph", "A view"),
      },
    } as unknown as Content.BluxMediaSlice;
    const { container, getByText } = render(BluxMedia, { props: { slice } });
    expect(
      container.querySelector(".blux-media[data-ratio='4:3'] img"),
    ).not.toBeNull();
    expect(getByText("A view")).not.toBeNull();
  });

  it("renders a raw video embed when there is no image", () => {
    const slice = {
      slice_type: "blux_media",
      variation: "default",
      primary: { media: {}, video_embed: "<iframe class='yt'></iframe>" },
    } as unknown as Content.BluxMediaSlice;
    const { container } = render(BluxMedia, { props: { slice } });
    expect(container.querySelector("iframe.yt")).not.toBeNull();
  });
});
```

Run → pass.

- [ ] **Step 4: Lint + commit.** `git add src/lib/slices/BluxMedia/ src/prismicio-types.d.ts && git commit -m "feat(blux): BluxMedia leaf slice"`.

---

### Task 5: BluxMediaText leaf slice

**Files:** Create `src/lib/slices/BluxMediaText/{model.json,index.svelte,BluxMediaText.test.ts}`.

- [ ] **Step 1: Model.** `src/lib/slices/BluxMediaText/model.json` — `id: "blux_media_text"`, `name: "BluxMediaText"`, description "Blux catalog: two-column media + text.", primary:

```json
"media": { "type": "Image", "config": { "label": "media", "constraint": {}, "thumbnails": [] } },
"media_side": { "type": "Select", "config": { "label": "media_side", "options": ["left", "right"] } },
"layout_ratio": { "type": "Number", "config": { "label": "layout_ratio (media % width)", "placeholder": "50" } },
"title": { "type": "StructuredText", "config": { "label": "title", "single": "heading2,heading3" } },
"body": { "type": "StructuredText", "config": { "label": "body", "multi": "paragraph,strong,em,hyperlink,list-item" } },
"link": { "type": "Link", "config": { "label": "link", "allowTargetBlank": true } },
"link_label": { "type": "Text", "config": { "label": "link_label" } }
```

Run regen; `pnpm run check` 0 errors; confirm `Content.BluxMediaTextSlice`.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxMediaText/index.svelte`:

```svelte
<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  let { slice }: { slice: Content.BluxMediaTextSlice } = $props();
</script>

<div
  class="blux-media-text"
  data-media-side={slice.primary.media_side}
  data-ratio={slice.primary.layout_ratio}
>
  {#if isFilled.image(slice.primary.media)}
    <div class="blux-media-text__media">
      <PrismicImage field={slice.primary.media} />
    </div>
  {/if}
  <div class="blux-media-text__text">
    {#if isFilled.richText(slice.primary.title)}<PrismicRichText
        field={slice.primary.title}
      />{/if}
    {#if isFilled.richText(slice.primary.body)}<PrismicRichText
        field={slice.primary.body}
      />{/if}
    {#if isFilled.link(slice.primary.link)}<PrismicLink
        field={slice.primary.link}
        >{slice.primary.link_label || "Learn more"}</PrismicLink
      >{/if}
  </div>
</div>
```

Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxMediaText/BluxMediaText.test.ts` — mock with `media_side: "right"`, a filled image (same ImageField shape as Task 4), `title` heading2 "Split", `body` paragraph. Assert `.blux-media-text[data-media-side='right']` present, `.blux-media-text__media img` present, and the "Split" heading renders. Include `afterEach(cleanup)`. Run → pass.

- [ ] **Step 4: Lint + commit.** `git add src/lib/slices/BluxMediaText/ src/prismicio-types.d.ts && git commit -m "feat(blux): BluxMediaText leaf slice"`.

---

### Task 6: BluxEmbed leaf slice

**Files:** Create `src/lib/slices/BluxEmbed/{model.json,index.svelte,BluxEmbed.test.ts}`.

- [ ] **Step 1: Model.** `id: "blux_embed"`, `name: "BluxEmbed"`, description "Blux catalog: a standalone raw-HTML / form / social embed.", primary:

```json
"embed_kind": { "type": "Select", "config": { "label": "embed_kind", "options": ["custom", "form", "social"] } },
"embed_html": { "type": "Text", "config": { "label": "embed_html" } }
```

Run regen; `pnpm run check` 0 errors; confirm `Content.BluxEmbedSlice`.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxEmbed/index.svelte`:

```svelte
<script lang="ts">
  import { isFilled, type Content } from "@prismicio/client";
  let { slice }: { slice: Content.BluxEmbedSlice } = $props();
</script>

{#if isFilled.keyText(slice.primary.embed_html)}
  <div class="blux-embed" data-embed-kind={slice.primary.embed_kind}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html slice.primary.embed_html}
  </div>
{/if}
```

Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxEmbed/BluxEmbed.test.ts` — mock `embed_kind: "custom"`, `embed_html: "<div class='mc'>signup</div>"`; assert `.blux-embed[data-embed-kind='custom'] .mc` present; a second test with empty `embed_html` asserts `.blux-embed` is null. Include `afterEach(cleanup)`. Run → pass.

- [ ] **Step 4: Lint + commit.** `git add src/lib/slices/BluxEmbed/ src/prismicio-types.d.ts && git commit -m "feat(blux): BluxEmbed leaf slice"`.

---

### Task 7: BluxTable leaf slice

**Files:** Create `src/lib/slices/BluxTable/{model.json,index.svelte,BluxTable.test.ts}`.

- [ ] **Step 1: Model.** `id: "blux_table"`, `name: "BluxTable"`, description "Blux catalog: a tabular embed (raw table HTML).", primary:

```json
"caption": { "type": "StructuredText", "config": { "label": "caption", "single": "heading3,heading4" } },
"table_html": { "type": "Text", "config": { "label": "table_html" } }
```

Run regen; `pnpm run check` 0 errors; confirm `Content.BluxTableSlice`.

- [ ] **Step 2: Component.** Create `src/lib/slices/BluxTable/index.svelte`:

```svelte
<script lang="ts">
  import { PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  let { slice }: { slice: Content.BluxTableSlice } = $props();
</script>

<div class="blux-table">
  {#if isFilled.richText(slice.primary.caption)}<PrismicRichText
      field={slice.primary.caption}
    />{/if}
  {#if isFilled.keyText(slice.primary.table_html)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html slice.primary.table_html}
  {/if}
</div>
```

Run `pnpm run check` → 0 errors.

- [ ] **Step 3: Test.** Create `src/lib/slices/BluxTable/BluxTable.test.ts` — mock `caption` heading3 "Rates", `table_html: "<table><tr><td class='c'>A</td></tr></table>"`; assert the "Rates" heading and `td.c` render. Include `afterEach(cleanup)`. Run → pass.

- [ ] **Step 4: Lint + commit.** `git add src/lib/slices/BluxTable/ src/prismicio-types.d.ts && git commit -m "feat(blux): BluxTable leaf slice"`.

---

### Task 8: Collection entity custom types

**Files:** Create `customtypes/{product,person,event,news_article,project}/index.json`.

Each entity type mirrors `customtypes/collection_item/index.json` exactly (same `Main` tab: `uid`, `title`, `body`, `media`, `gallery` group, `tags`, `date`, `link`), differing only in `id` and `label`. Feed-specific field extensions are added per-site by Emit in Plan 3 — do NOT add them here.

- [ ] **Step 1: Author the five types.** For each `(id, label)` in `(product, "Product")`, `(person, "Person")`, `(event, "Event")`, `(news_article, "News Article")`, `(project, "Project")`: create `customtypes/<id>/index.json` identical to `customtypes/collection_item/index.json` but with the matching `id` and `label` (keep `format: "custom"`, `repeatable: true`, `status: true`, and the same `json.Main` field set).

- [ ] **Step 2: Regenerate + verify.** Run the regen script (pointed at any existing slice model — it re-reads all custom types). Run `pnpm run check` → 0 errors. Confirm each `Content.ProductDocument`, `Content.PersonDocument`, `Content.EventDocument`, `Content.NewsArticleDocument`, `Content.ProjectDocument` exists via grep.

- [ ] **Step 3: Commit.** `git add customtypes/ src/prismicio-types.d.ts && git commit -m "feat(blux): product/person/event/news_article/project entity custom types"`.

---

### Task 9: Register new slices on the page + full gate

**Files:** Modify `customtypes/page/index.json`, `src/lib/slices/index.js`; run the gate.

- [ ] **Step 1: Page choices.** In `customtypes/page/index.json` `json.Main.slices.config.choices`, ADD (keep all existing, incl. the Plan-1 blux slices): `blux_grid`, `blux_gallery`, `blux_carousel`, `blux_media`, `blux_media_text`, `blux_embed`, `blux_table` — each `{ "type": "SharedSlice" }`.

- [ ] **Step 2: Regenerate types.** Run the regen script; confirm the `PageDocumentDataSlicesSlice` union now includes the 7 new slice types.

- [ ] **Step 3: Register in the components map.** Hand-edit `src/lib/slices/index.js` to add `import` lines + `components` map entries for `BluxGrid`/`blux_grid`, `BluxGallery`/`blux_gallery`, `BluxCarousel`/`blux_carousel`, `BluxMedia`/`blux_media`, `BluxMediaText`/`blux_media_text`, `BluxEmbed`/`blux_embed`, `BluxTable`/`blux_table`, in alphabetical position (matching the generated pattern). Verify with `grep -E "blux_grid|blux_gallery|blux_carousel|blux_media|blux_media_text|blux_embed|blux_table" src/lib/slices/index.js` → all present.

- [ ] **Step 4: Extend the skeleton integration test.** In `src/routes/blux-skeleton.test.ts`, add the 7 new slice types to the `slices` array (a minimal filled primary each: BluxGrid/Gallery/Carousel with one text cell; BluxMedia with a caption; BluxMediaText with a title; BluxEmbed with `embed_html`; BluxTable with `table_html`) and add assertions that a distinctive text from each renders through the shared `SliceZone`. Run `pnpm exec vitest run src/routes/blux-skeleton.test.ts` → pass.

- [ ] **Step 5: Full gate.** Run `pnpm run check` (0 errors), `pnpm run lint` (clean — if prettier flags files, `pnpm run format` then re-lint and include the formatting in a `style(blux): format` commit), `pnpm exec vitest run --pool=threads` (all pass), `pnpm run build` (success).

- [ ] **Step 6: Commit.** `git add customtypes/page/index.json src/lib/slices/index.js src/prismicio-types.d.ts src/routes/blux-skeleton.test.ts && git commit -m "feat(blux): register catalog slices (grid/gallery/carousel/media/mediatext/embed/table) + skeleton coverage"`.

---

## Definition of done

- Shared `BluxCell` renders the cell contract once; BluxSection refactored onto it with its tests still green.
- Container slices (Grid, Gallery, Carousel) + leaf slices (Media, MediaText, Embed, Table) built, each with model + component + passing test; all carry the decision-B contract (containers have `widget`, leaves don't).
- Five entity custom types exist (shared-base shape).
- All new slices registered on the `page` SliceZone + `components` map; skeleton test covers them.
- `pnpm run check` / `lint` / `vitest --pool=threads` / `build` all green.

## Not in this plan (Plan 3+)

The feed-backed **Collection** slice (needs feed materialization); the `reddoor-maintenance` CLI Extract→IR, Classify, Emit (with the `widget`→Section routing from decision B, the `custom-as-widget` normalization, asset-index idempotency, feed→type mapping); per-site feed-specific field extensions on the entity types; the-pointe fidelity gate; rollout.
