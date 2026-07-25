# Blux Catalog Foundation — Implementation Plan (Plan 1 of N)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-risk Prismic nested-group modeling and prove the entire Blux catalog content-model architecture end-to-end with a three-slice walking skeleton (container-with-cells+subgrid, a leaf, and the recursive fallback) that renders on a page.

**Architecture:** Ground-up catalog slices in `reddoor-starter`, namespaced `blux_*` and coexisting with the general starter slices. A container slice (`BluxSection`) carries a repeatable `cells` Group whose cells may hold a single nested `subgrid` Group — exactly one level of nesting, the Prismic ceiling. A leaf slice (`BluxText`) and a content-preserving fallback (`BluxBlock`, an opaque serialized-JSON tree rendered recursively) complete the skeleton. Everything is verified with vitest + `@testing-library/svelte`, `svelte-check`, and `vite build`.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), `@prismicio/client` 7.21, `@prismicio/svelte` 2.2, Slice Machine UI 2.21.3 + `@slicemachine/adapter-sveltekit` 0.3.96, vitest 4, pnpm 11.8.

**Spec:** `docs/superpowers/specs/2026-07-17-blux-catalog-pipeline-design.md` (§6 catalog, §7 classifier, §10 phases 0–1).

---

## Scope & context (read before starting)

- **This is Plan 1 of a multi-plan project.** It covers spec Phase 0 (freeze the content-model contract — in this repo the Prismic slice models _are_ the contract; Slice Machine generates `src/prismicio-types.d.ts` from them) and the Phase-1 nesting spike + a walking skeleton. **Out of scope here:** the remaining 8 catalog slices (Grid, Gallery, Carousel, Collection, Media, MediaText, Embed, Table — Plan 2), the CLI Extract/Classify/Emit stages (Plans 3–4, `reddoor-maintenance`), the `Render` of the full catalog, and migration.
- **Namespacing.** Catalog slices use `blux_*` slice IDs and `Blux*` directories so they never collide with the general slices (Accordion, RichText, …) that `new-site` builds use. They are added as _additional_ choices on the existing `page` custom type; general sites simply don't use them.
- **Repo patterns (verified) you MUST follow:**
  - Slice model: `src/lib/slices/<Name>/model.json`, a `SharedSlice` with `variations[]`; repeatable content historically lives in the flat top-level `items{}` map. **This plan deliberately introduces the modern `Group`-in-`primary` pattern** (no in-repo precedent — that is what Task 1 de-risks).
  - Component: `src/lib/slices/<Name>/index.svelte`, Svelte 5 runes: `let { slice }: { slice: Content.<Name>Slice } = $props();`, types from `import { isFilled, type Content } from "@prismicio/client"`.
  - Test: `src/lib/slices/<Name>/<Name>.test.ts` (NOT `index.test.ts`), vitest + `@testing-library/svelte`, mock slice built as a plain object cast `as unknown as Content.<Name>Slice`.
  - Registration: `src/lib/slices/index.js` and `src/prismicio-types.d.ts` are **generated — DO NOT hand-edit**; they regenerate from `model.json` + `customtypes/*/index.json` via the Slice Machine adapter. Task 1 establishes the exact regeneration command.
  - Custom types: `customtypes/<id>/index.json` (+ `mocks.json`). The `page` type's SliceZone is `json.Main.slices.config.choices` (a map of slice id → `{ "type": "SharedSlice" }`).
  - Gate commands: `pnpm run check` (svelte-kit sync + svelte-check), `pnpm run lint` (prettier + eslint), `pnpm run test:unit` (vitest run), `pnpm run build` (vite build).
- **Cross-plan flag (not resolved here):** the existing `reddoor-maintenance` Classify parses **rendered HTML** (`parseGridBands`), whereas the spec's Extract reads **`site.json` authoring intent**. Which is the Extract source is a Plan-3 decision; it does not affect this plan (the slice models are source-agnostic).

## File structure (created/modified by this plan)

- `src/lib/slices/_spike_group/model.json` — **temporary** nested-group probe (deleted in Task 1).
- `src/lib/slices/BluxSection/{model.json,index.svelte,BluxSection.test.ts}` — container slice.
- `src/lib/slices/BluxText/{model.json,index.svelte,BluxText.test.ts}` — leaf slice.
- `src/lib/slices/BluxBlock/{model.json,index.svelte,BluxBlock.test.ts,BluxNode.svelte}` — fallback slice + recursive node renderer.
- `src/lib/blux-catalog/node.ts` — the serialized-node TypeScript type shared by BluxBlock (the fallback tree contract).
- `customtypes/collection_item/index.json` — shared-base collection custom type.
- `customtypes/page/index.json` — **modify**: add `blux_section`, `blux_text`, `blux_block` to SliceZone choices.
- `src/lib/slices/index.js`, `src/prismicio-types.d.ts` — **regenerated** (do not hand-edit).
- `src/routes/blux-skeleton.test.ts` — route-level render integration test for the three slices.

---

## Spike result (Task 1 — RESOLVED 2026-07-17)

**Decision: NATIVE nested groups.** A `Group` in `primary` containing a nested `Group` generates correct types — the nested group is typed `prismic.NestedGroupField<Simplify<…SubgridItem>>` and the outer as `prismic.GroupField<Simplify<…CellsItem>>`. `pnpm run check` passes clean. Tasks 2–6 proceed on the native path (no serialized-cell fallback).

**Codegen command (reuse for every model change).** `svelte-kit sync` / `vite build` / `start-slicemachine` do NOT regenerate types headlessly. Drive the Slice Machine manager's `slice:update` hook via this Node script (`scratchpad/regen-types.mjs`), invoked from repo root as `node <script> "$PWD" "./src/lib/slices" "src/lib/slices/<Name>/model.json"` — `updateSlice` re-reads ALL models and rewrites `src/prismicio-types.d.ts`:

```js
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

**Gotchas threaded into later tasks:**

- **Dir name must equal the model `name`** (PascalCase). The manager writes the slice to `<lib>/<name>/`; our dirs (`BluxSection`, `BluxText`, `BluxBlock`) already match their `name`, so no duplicate dir is created.
- **`updateSlice` does NOT touch `src/lib/slices/index.js`.** Slice _types_ regenerate (enough for Tasks 3–6 components), but the runtime `components` map is populated in Task 8 (registration). If the manager won't add it headlessly, hand-edit `index.js` (trivial import + map entry).
- **One-time normalization:** the first regen reformats `src/prismicio-types.d.ts` from 266 → ~1651 lines (codegen-version bump adding `NestedGroupField` + CR fetch helpers). Task 2 lands this normalization as its OWN commit before the BluxSection feature commit.

---

### Task 1: Nesting spike — prove (or refute) native nested Groups + establish the codegen command

**Files:**

- Create (temporary): `src/lib/slices/_spike_group/model.json`
- Inspect (generated): `src/prismicio-types.d.ts`, `src/lib/slices/index.js`

**Goal:** Answer two unknowns before building anything: (a) what command regenerates `prismicio-types.d.ts` from a `model.json` headlessly, and (b) does a `Group` field inside `primary` that itself contains a nested `Group` produce correct TypeScript types. The outcome sets the cell model for Tasks 2–6.

- [ ] **Step 1: Author the probe slice model**

Create `src/lib/slices/_spike_group/model.json`:

```json
{
  "id": "_spike_group",
  "type": "SharedSlice",
  "name": "SpikeGroup",
  "description": "TEMPORARY nested-group feasibility probe — delete after Task 1",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "...",
      "version": "initial",
      "description": "probe",
      "imageUrl": "",
      "primary": {
        "cells": {
          "type": "Group",
          "config": {
            "label": "cells",
            "fields": {
              "kind": {
                "type": "Select",
                "config": { "label": "kind", "options": ["text", "subgrid"] }
              },
              "title": {
                "type": "StructuredText",
                "config": { "label": "title", "single": "heading3" }
              },
              "subgrid": {
                "type": "Group",
                "config": {
                  "label": "subgrid",
                  "fields": {
                    "title": {
                      "type": "StructuredText",
                      "config": { "label": "title", "single": "heading4" }
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

- [ ] **Step 2: Discover the regeneration command**

Try, in order, until `src/prismicio-types.d.ts` changes (check `git diff --stat src/prismicio-types.d.ts`):

Run: `pnpm exec svelte-kit sync` then inspect. If unchanged, Run: `pnpm run build`. If still unchanged, Run: `pnpm exec start-slicemachine --help` to look for a non-interactive codegen subcommand, and as a last resort start it briefly: `timeout 25 pnpm run slicemachine` (the adapter regenerates on boot), then stop.

Expected: one of these regenerates `src/prismicio-types.d.ts` and `src/lib/slices/index.js`. **Record the working command in a comment at the top of this task** — Tasks 2–8 reuse it.

- [ ] **Step 3: Inspect the generated types for the nested group**

Run: `grep -A30 "SpikeGroup" src/prismicio-types.d.ts`

Expected (PASS): a `SpikeGroupSliceDefaultPrimaryCellsItem` interface with a `subgrid: prismic.GroupField<...>` property (a `GroupField` typed _inside_ the cells item), and `cells: prismic.GroupField<Simplify<SpikeGroupSliceDefaultPrimaryCellsItem>>` on `SpikeGroupSliceDefaultPrimary`.

- [ ] **Step 4: Record the decision**

Add a short note to the top of this plan file under a new `## Spike result` heading:

- **If the nested `GroupField` type is present:** decision = **native nested groups**. Tasks 2–6 proceed as written.
- **If codegen errors, flattens the nested group, or drops it:** decision = **serialized-cell fallback** — a cell's `subgrid` becomes a `Text` field holding stringified JSON, rendered by the same `BluxNode.svelte` recursive renderer from Task 6. Update Task 2's model (replace the `subgrid` Group with `"subgrid": { "type": "Text", "config": { "label": "subgrid (serialized)" } }`) and Task 3 to `JSON.parse` it. **Stop and report this branch to the reviewer before continuing.**

- [ ] **Step 5: Delete the probe and confirm a clean tree**

Run: `rm -rf src/lib/slices/_spike_group && pnpm run check`
Expected: PASS (removing the probe and regenerating leaves types consistent).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "spike(blux): verify Prismic nested-group cell modeling + codegen command"
```

---

### Task 2: BluxSection — container slice model

**Files:**

- Create: `src/lib/slices/BluxSection/model.json`
- Regenerate: `src/prismicio-types.d.ts`, `src/lib/slices/index.js` (via the Task-1 command)

**Note:** the `subgrid` field below assumes the Task-1 decision was _native nested groups_. If it was _serialized-cell fallback_, replace the `subgrid` Group with `{ "type": "Text", "config": { "label": "subgrid (serialized JSON)" } }`.

- [ ] **Step 1: Author the model**

Create `src/lib/slices/BluxSection/model.json`:

```json
{
  "id": "blux_section",
  "type": "SharedSlice",
  "name": "BluxSection",
  "description": "Blux catalog: a band/section carrying an optional heading, background, inline widget, and a group of typed cells (one may nest a single subgrid).",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "...",
      "version": "initial",
      "description": "Section with cells",
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

- [ ] **Step 2: Regenerate + typecheck**

Run: `<Task-1 codegen command>` then `pnpm run check`
Expected: PASS; `grep "BluxSectionSliceDefaultPrimaryCellsItem" src/prismicio-types.d.ts` returns the generated cell type with `subgrid` present.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slices/BluxSection/model.json src/prismicio-types.d.ts src/lib/slices/index.js
git commit -m "feat(blux): BluxSection container slice model"
```

---

### Task 3: BluxSection — component

**Files:**

- Create: `src/lib/slices/BluxSection/index.svelte`

- [ ] **Step 1: Write the component**

Create `src/lib/slices/BluxSection/index.svelte`:

```svelte
<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";

  let { slice }: { slice: Content.BluxSectionSlice } = $props();

  type Cell = Content.BluxSectionSliceDefaultPrimaryCellsItem;
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

<section class="blux-section" data-cells={cells.length} style={bandStyle}>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage
      field={slice.primary.background_image}
      class="blux-section__bg"
    />
  {/if}

  {#if isFilled.richText(slice.primary.heading)}
    <PrismicRichText field={slice.primary.heading} />
  {/if}

  <div class="blux-section__cells" data-align={slice.primary.vertical_align}>
    {#each cells as cell}
      <div class="blux-cell" data-kind={cell.kind}>
        {#if isFilled.image(cell.media)}<PrismicImage field={cell.media} />{/if}
        {#if isFilled.richText(cell.title)}<PrismicRichText
            field={cell.title}
          />{/if}
        {#if isFilled.richText(cell.body)}<PrismicRichText
            field={cell.body}
          />{/if}
        {#if isFilled.keyText(cell.embed_html)}{@html cell.embed_html}{/if}
        {#if isFilled.link(cell.link)}<PrismicLink field={cell.link}
            >{cell.link_label ?? "Read more"}</PrismicLink
          >{/if}

        {#if (cell.subgrid ?? []).length}
          <div class="blux-subgrid" data-cells={cell.subgrid?.length}>
            {#each cell.subgrid ?? [] as sub}
              <div class="blux-cell" data-kind={sub.kind}>
                {#if isFilled.image(sub.media)}<PrismicImage
                    field={sub.media}
                  />{/if}
                {#if isFilled.richText(sub.title)}<PrismicRichText
                    field={sub.title}
                  />{/if}
                {#if isFilled.richText(sub.body)}<PrismicRichText
                    field={sub.body}
                  />{/if}
                {#if isFilled.link(sub.link)}<PrismicLink field={sub.link}
                    >{sub.link_label ?? "Read more"}</PrismicLink
                  >{/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if isFilled.keyText(slice.primary.widget_html)}
    <div class="blux-widget" data-widget={slice.primary.widget_kind}>
      {@html slice.primary.widget_html}
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run check`
Expected: PASS. (If the Task-1 decision was _serialized-cell fallback_, `cell.subgrid` is a string — replace the `{#each cell.subgrid}` block with `{#if cell.subgrid}` + `JSON.parse(cell.subgrid)` iterating parsed nodes.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/slices/BluxSection/index.svelte
git commit -m "feat(blux): BluxSection component (cells + subgrid + widget + background)"
```

---

### Task 4: BluxSection — test

**Files:**

- Create: `src/lib/slices/BluxSection/BluxSection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/slices/BluxSection/BluxSection.test.ts`:

```ts
import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import BluxSection from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

const slice = {
  slice_type: "blux_section",
  variation: "default",
  primary: {
    heading: rt("heading2", "Amenities"),
    background_image: { link_type: "Media" },
    background_color: "#111111",
    min_height: "80vh",
    vertical_align: "middle",
    widget_kind: "Two White Lines",
    widget_html: "<hr class='divider' />",
    cells: [
      {
        kind: "text",
        title: rt("heading3", "Pool"),
        body: rt("paragraph", "Heated."),
        subgrid: [],
      },
      {
        kind: "subgrid",
        title: rt("heading3", "Floors"),
        subgrid: [
          {
            kind: "text",
            title: rt("heading4", "Level 2"),
            body: rt("paragraph", "Studios"),
          },
          {
            kind: "text",
            title: rt("heading4", "Level 3"),
            body: rt("paragraph", "One-beds"),
          },
        ],
      },
    ],
  },
} as unknown as Content.BluxSectionSlice;

describe("BluxSection slice", () => {
  it("renders the band heading and one node per cell", () => {
    const { getByRole, container } = render(BluxSection, { props: { slice } });
    expect(getByRole("heading", { level: 2 }).textContent).toContain(
      "Amenities",
    );
    expect(
      container.querySelectorAll(".blux-section__cells > .blux-cell"),
    ).toHaveLength(2);
  });

  it("renders nested subgrid cells", () => {
    const { getAllByRole } = render(BluxSection, { props: { slice } });
    expect(getAllByRole("heading", { level: 4 })).toHaveLength(2);
  });

  it("renders the inline widget html and background color", () => {
    const { container } = render(BluxSection, { props: { slice } });
    expect(
      container.querySelector(
        ".blux-widget[data-widget='Two White Lines'] hr.divider",
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(".blux-section")?.getAttribute("style"),
    ).toContain("background-color:#111111");
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/lib/slices/BluxSection/BluxSection.test.ts`
Expected: PASS (component already exists from Task 3). If a subgrid assertion fails under the _serialized-cell fallback_ branch, adapt the mock's `subgrid` to a JSON string.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slices/BluxSection/BluxSection.test.ts
git commit -m "test(blux): BluxSection renders cells, subgrid, widget, background"
```

---

### Task 5: BluxText — leaf slice (model + component + test)

**Files:**

- Create: `src/lib/slices/BluxText/{model.json,index.svelte,BluxText.test.ts}`

- [ ] **Step 1: Author the model**

Create `src/lib/slices/BluxText/model.json`:

```json
{
  "id": "blux_text",
  "type": "SharedSlice",
  "name": "BluxText",
  "description": "Blux catalog: a text leaf — title/subtitle/body/subbody with optional buttons.",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "...",
      "version": "initial",
      "description": "Text",
      "imageUrl": "",
      "primary": {
        "title": {
          "type": "StructuredText",
          "config": { "label": "title", "single": "heading1,heading2,heading3" }
        },
        "subtitle": {
          "type": "StructuredText",
          "config": { "label": "subtitle", "single": "heading4,heading5" }
        },
        "body": {
          "type": "StructuredText",
          "config": {
            "label": "body",
            "multi": "paragraph,strong,em,hyperlink,list-item,o-list-item"
          }
        },
        "subbody": {
          "type": "StructuredText",
          "config": {
            "label": "subbody",
            "multi": "paragraph,strong,em,hyperlink"
          }
        },
        "buttons": {
          "type": "Group",
          "config": {
            "label": "buttons",
            "fields": {
              "label": { "type": "Text", "config": { "label": "label" } },
              "link": {
                "type": "Link",
                "config": { "label": "link", "allowTargetBlank": true }
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

- [ ] **Step 2: Regenerate + typecheck**

Run: `<Task-1 codegen command>` then `pnpm run check`
Expected: PASS; `Content.BluxTextSlice` exists.

- [ ] **Step 3: Write the component**

Create `src/lib/slices/BluxText/index.svelte`:

```svelte
<script lang="ts">
  import { PrismicLink, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";

  let { slice }: { slice: Content.BluxTextSlice } = $props();
  type Button = Content.BluxTextSliceDefaultPrimaryButtonsItem;
  let buttons = $derived((slice.primary.buttons ?? []) as Button[]);
</script>

<div class="blux-text">
  {#if isFilled.richText(slice.primary.title)}<PrismicRichText
      field={slice.primary.title}
    />{/if}
  {#if isFilled.richText(slice.primary.subtitle)}<PrismicRichText
      field={slice.primary.subtitle}
    />{/if}
  {#if isFilled.richText(slice.primary.body)}<PrismicRichText
      field={slice.primary.body}
    />{/if}
  {#if isFilled.richText(slice.primary.subbody)}<PrismicRichText
      field={slice.primary.subbody}
    />{/if}
  {#if buttons.length}
    <div class="blux-text__buttons">
      {#each buttons as b}
        {#if isFilled.link(b.link)}<PrismicLink
            field={b.link}
            class="blux-button">{b.label ?? "Learn more"}</PrismicLink
          >{/if}
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Write the test**

Create `src/lib/slices/BluxText/BluxText.test.ts`:

```ts
import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import BluxText from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

const slice = {
  slice_type: "blux_text",
  variation: "default",
  primary: {
    title: rt("heading2", "Welcome"),
    body: rt("paragraph", "Ground-floor retail."),
    buttons: [
      {
        label: "Contact",
        link: { link_type: "Web", url: "https://example.com" },
      },
    ],
  },
} as unknown as Content.BluxTextSlice;

describe("BluxText slice", () => {
  it("renders title and body", () => {
    const { getByRole, getByText } = render(BluxText, { props: { slice } });
    expect(getByRole("heading", { level: 2 }).textContent).toContain("Welcome");
    expect(getByText("Ground-floor retail.")).not.toBeNull();
  });

  it("renders a button when the link is filled", () => {
    const { getByText } = render(BluxText, { props: { slice } });
    expect(getByText("Contact").closest("a")?.getAttribute("href")).toBe(
      "https://example.com",
    );
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run src/lib/slices/BluxText/BluxText.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/slices/BluxText/ src/prismicio-types.d.ts src/lib/slices/index.js
git commit -m "feat(blux): BluxText leaf slice + test"
```

---

### Task 6: BluxBlock — content-preserving fallback slice + recursive renderer

**Files:**

- Create: `src/lib/blux-catalog/node.ts` (the serialized-node type)
- Create: `src/lib/slices/BluxBlock/{model.json,index.svelte,BluxNode.svelte,BluxBlock.test.ts}`

- [ ] **Step 1: Define the serialized-node type**

Create `src/lib/blux-catalog/node.ts`:

```ts
/** The fallback tree a BluxBlock slice carries as stringified JSON in its
 * `payload` field. Renders any depth via BluxNode.svelte. Structure/media are
 * preserved; assets are Prismic asset URLs rewritten by Emit (see spec §6). */
export type BluxNode = {
  tag?: string; // container element tag, default "div"
  className?: string;
  style?: Record<string, string>;
  html?: string; // leaf raw HTML (rich text / embed), rendered with {@html}
  image?: { url: string; alt?: string; width?: number; height?: number };
  children?: BluxNode[];
};

export function parseBluxPayload(
  payload: string | null | undefined,
): BluxNode | null {
  if (!payload) return null;
  try {
    const node = JSON.parse(payload) as BluxNode;
    return node && typeof node === "object" ? node : null;
  } catch {
    return null;
  }
}

export function styleString(style: Record<string, string> | undefined): string {
  if (!style) return "";
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
```

- [ ] **Step 2: Write the recursive node renderer**

Create `src/lib/slices/BluxBlock/BluxNode.svelte`:

```svelte
<script lang="ts">
  import type { BluxNode } from "$lib/blux-catalog/node";
  import { styleString } from "$lib/blux-catalog/node";
  import Self from "./BluxNode.svelte";

  let { node }: { node: BluxNode } = $props();
</script>

<svelte:element
  this={node.tag ?? "div"}
  class={node.className}
  style={styleString(node.style)}
>
  {#if node.image}
    <img
      src={node.image.url}
      alt={node.image.alt ?? ""}
      width={node.image.width}
      height={node.image.height}
    />
  {/if}
  {#if node.html}{@html node.html}{/if}
  {#each node.children ?? [] as child}
    <Self node={child} />
  {/each}
</svelte:element>
```

- [ ] **Step 3: Write the slice model**

Create `src/lib/slices/BluxBlock/model.json`:

```json
{
  "id": "blux_block",
  "type": "SharedSlice",
  "name": "BluxBlock",
  "description": "Blux catalog fallback: an opaque serialized-JSON block tree for bands too deep/irregular for the catalog. Content-preserving, rendered recursively.",
  "variations": [
    {
      "id": "default",
      "name": "Default",
      "docURL": "...",
      "version": "initial",
      "description": "Fallback",
      "imageUrl": "",
      "primary": {
        "payload": {
          "type": "Text",
          "config": { "label": "payload (serialized JSON tree)" }
        }
      },
      "items": {}
    }
  ]
}
```

- [ ] **Step 4: Write the slice component**

Create `src/lib/slices/BluxBlock/index.svelte`:

```svelte
<script lang="ts">
  import { type Content } from "@prismicio/client";
  import { parseBluxPayload } from "$lib/blux-catalog/node";
  import BluxNode from "./BluxNode.svelte";

  let { slice }: { slice: Content.BluxBlockSlice } = $props();
  let root = $derived(parseBluxPayload(slice.primary.payload));
</script>

{#if root}
  <div class="blux-block">
    <BluxNode node={root} />
  </div>
{/if}
```

- [ ] **Step 5: Regenerate + typecheck**

Run: `<Task-1 codegen command>` then `pnpm run check`
Expected: PASS; `Content.BluxBlockSlice` exists.

- [ ] **Step 6: Write the test**

Create `src/lib/slices/BluxBlock/BluxBlock.test.ts`:

```ts
import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import BluxBlock from "./index.svelte";

const tree = {
  tag: "section",
  className: "band",
  children: [
    {
      tag: "div",
      className: "row",
      children: [
        { html: "<h3>Stacking Plan</h3>" },
        { image: { url: "https://cdn.example/plan.png", alt: "plan" } },
        { tag: "div", children: [{ html: "<p>Level 4</p>" }] },
      ],
    },
  ],
};

const slice = {
  slice_type: "blux_block",
  variation: "default",
  primary: { payload: JSON.stringify(tree) },
} as unknown as Content.BluxBlockSlice;

describe("BluxBlock fallback slice", () => {
  it("recursively renders the serialized tree at any depth", () => {
    const { getByText, container } = render(BluxBlock, { props: { slice } });
    expect(getByText("Stacking Plan")).not.toBeNull();
    expect(getByText("Level 4")).not.toBeNull();
    expect(
      container.querySelector("img[alt='plan']")?.getAttribute("src"),
    ).toBe("https://cdn.example/plan.png");
    expect(container.querySelector("section.band .row")).not.toBeNull();
  });

  it("renders nothing for an unparseable payload", () => {
    const bad = {
      ...slice,
      primary: { payload: "not json" },
    } as unknown as Content.BluxBlockSlice;
    const { container } = render(BluxBlock, { props: { slice: bad } });
    expect(container.querySelector(".blux-block")).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests**

Run: `pnpm exec vitest run src/lib/slices/BluxBlock/BluxBlock.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/blux-catalog/ src/lib/slices/BluxBlock/ src/prismicio-types.d.ts src/lib/slices/index.js
git commit -m "feat(blux): BluxBlock fallback slice + recursive node renderer"
```

---

### Task 7: `collection_item` shared-base custom type

**Files:**

- Create: `customtypes/collection_item/index.json`

- [ ] **Step 1: Author the base custom type**

Create `customtypes/collection_item/index.json`:

```json
{
  "id": "collection_item",
  "label": "Collection Item",
  "format": "custom",
  "repeatable": true,
  "status": true,
  "json": {
    "Main": {
      "uid": { "type": "UID", "config": { "label": "uid" } },
      "title": {
        "type": "StructuredText",
        "config": { "label": "title", "single": "heading1" }
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
        "config": { "label": "media", "constraint": {}, "thumbnails": [] }
      },
      "gallery": {
        "type": "Group",
        "config": {
          "label": "gallery",
          "fields": {
            "image": {
              "type": "Image",
              "config": { "label": "image", "constraint": {}, "thumbnails": [] }
            },
            "caption": { "type": "Text", "config": { "label": "caption" } }
          }
        }
      },
      "tags": {
        "type": "Text",
        "config": { "label": "tags (comma-separated)" }
      },
      "date": { "type": "Date", "config": { "label": "date" } },
      "link": {
        "type": "Link",
        "config": { "label": "link", "allowTargetBlank": true }
      }
    }
  }
}
```

- [ ] **Step 2: Regenerate + typecheck**

Run: `<Task-1 codegen command>` then `pnpm run check`
Expected: PASS; `Content.CollectionItemDocument` exists in `src/prismicio-types.d.ts`.

- [ ] **Step 3: Commit**

```bash
git add customtypes/collection_item/ src/prismicio-types.d.ts
git commit -m "feat(blux): collection_item shared-base custom type"
```

---

### Task 8: Register catalog slices on the `page` SliceZone

**Files:**

- Modify: `customtypes/page/index.json` (add three choices)
- Regenerate: `src/lib/slices/index.js`, `src/prismicio-types.d.ts`

- [ ] **Step 1: Add the catalog choices**

In `customtypes/page/index.json`, inside `json.Main.slices.config.choices`, add these three keys alongside the existing ones (do not remove any existing choice):

```json
"blux_section": { "type": "SharedSlice" },
"blux_text": { "type": "SharedSlice" },
"blux_block": { "type": "SharedSlice" }
```

- [ ] **Step 2: Regenerate + verify the components map**

Run: `<Task-1 codegen command>`
Then Run: `grep -E "blux_section|blux_text|blux_block" src/lib/slices/index.js`
Expected: all three appear in the generated `components` map (`blux_section: BluxSection`, etc.).

- [ ] **Step 3: Typecheck**

Run: `pnpm run check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add customtypes/page/index.json src/lib/slices/index.js src/prismicio-types.d.ts
git commit -m "feat(blux): register catalog slices on the page SliceZone"
```

---

### Task 9: Route-level render integration test (walking skeleton proof)

**Files:**

- Create: `src/routes/blux-skeleton.test.ts`

This proves the three catalog slices render together through the same `components` map + `SliceZone` the `[uid]` route uses.

- [ ] **Step 1: Write the test**

Create `src/routes/blux-skeleton.test.ts`:

```ts
import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import { SliceZone } from "@prismicio/svelte";
import { components } from "$lib/slices";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

// A page body mixing a container, a leaf, and the fallback — the full skeleton.
const slices = [
  {
    slice_type: "blux_section",
    variation: "default",
    primary: {
      heading: rt("heading2", "Amenities"),
      cells: [{ kind: "text", title: rt("heading3", "Pool"), subgrid: [] }],
    },
  },
  {
    slice_type: "blux_text",
    variation: "default",
    primary: { title: rt("heading2", "Welcome"), buttons: [] },
  },
  {
    slice_type: "blux_block",
    variation: "default",
    primary: {
      payload: JSON.stringify({
        tag: "div",
        children: [{ html: "<p>Fallback content</p>" }],
      }),
    },
  },
];

describe("Blux catalog walking skeleton", () => {
  it("renders container, leaf, and fallback slices through the shared SliceZone", () => {
    const { getByText } = render(SliceZone, {
      props: { slices: slices as never, components },
    });
    expect(getByText("Amenities")).not.toBeNull();
    expect(getByText("Pool")).not.toBeNull();
    expect(getByText("Welcome")).not.toBeNull();
    expect(getByText("Fallback content")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/routes/blux-skeleton.test.ts`
Expected: PASS — all three slice types resolve from the components map and render.

- [ ] **Step 3: Commit**

```bash
git add src/routes/blux-skeleton.test.ts
git commit -m "test(blux): walking-skeleton render integration across catalog slices"
```

---

### Task 10: Full gate + finalize

- [ ] **Step 1: Run the whole CI gate**

Run: `pnpm run check && pnpm run lint && pnpm run test:unit && pnpm run build`
Expected: all PASS. If `prettier --check` flags the new JSON/Svelte files, Run: `pnpm run format`, then re-run the gate and commit the formatting.

- [ ] **Step 2: Update the spec's phase status**

In `docs/superpowers/specs/2026-07-17-blux-catalog-pipeline-design.md`, under §10, mark Phase 0 (contract via slice models) and the Phase-1 spike + skeleton as done, referencing this plan. Commit:

```bash
git add docs/superpowers/specs/2026-07-17-blux-catalog-pipeline-design.md
git commit -m "docs(blux): mark Phase 0 + Phase-1 skeleton complete"
```

- [ ] **Step 3: Confirm the Spike result section is filled in** (Task 1, Step 4) so Plan 2 knows the cell model.

---

## Definition of done

- The nesting spike is resolved and recorded; the cell model (native nested group vs serialized) is decided.
- `BluxSection`, `BluxText`, `BluxBlock` slices exist with models, components, and passing tests.
- `collection_item` base custom type exists; the three catalog slices are registered on `page`.
- The route-level skeleton test proves all three render through the shared `SliceZone`/`components`.
- `pnpm run check && pnpm run lint && pnpm run test:unit && pnpm run build` all pass.

## Pre-freeze decisions from the final review (resolve before Plan 2 builds on the contract)

The whole-implementation review confirmed a sound, freezable foundation (no Critical issues). These contract decisions are cheap now, expensive after Plan 2 copies the pattern 8×:

1. **Widget-on-leaf policy — NEEDS A CALL (surfaced to Tucker).** Spec §6/§7 say a `widget` (custom HTML) may ride on _any_ slice, but only `BluxSection` carries `widget_kind`/`widget_html`; `BluxText` doesn't — so a text band that also has a widget would lose it. Two resolutions: **(A)** add `widget_kind`/`widget_html` to every leaf slice (spec-faithful 1:1 band→slice, but widget-field proliferation), or **(B)** amend §6/§7 so widgets are container-level and a widget-bearing band classifies as `BluxSection` (no proliferation, slight doc inflation). Pick before Plan 2 authors the other leaf slices.
2. **Extract the shared cell renderer as Plan 2 Task 0.** The `cellLeaf` snippet + subgrid loop currently live inside `BluxSection/index.svelte`. Before the 8 container slices exist, promote a hand-written `BluxCell` interface + `BluxCell.svelte` into `src/lib/blux-catalog/` (mirroring the `node.ts`/`BluxNode.svelte` pattern) so all container slices map their generated cell-item type onto one shared renderer instead of duplicating it. The per-slice `model.json` `cells`/`subgrid` field-set is unavoidably re-declared (Prismic has no include), so treat `BluxSection`'s as the canonical copy-from source.
3. **Token reconciled:** cell `kind` is `button` (singular) in both spec and model (was `button-group` in the spec) — a cell holds a single `link`+`link_label`. Documented as a conscious reduction (spec §6).
4. **Documented cell reductions** (vs. the leaf/spec richness, intentional for the reduced cell form): cell `body` omits `o-list-item`; cell `media` is Image-only (no `crop`/`caption`/video — rich media routes through `embed_html`). Plan 2's Gallery/Grid can enrich the shared cell if a real case appears.
5. **Skeleton test is registration-wiring, not route-load.** `src/routes/blux-skeleton.test.ts` drives `SliceZone`+`components` directly (no `+page.svelte`/`load`). Plan 2 should not rely on it for route coverage.

## What Plan 2 covers (not this plan)

The remaining catalog slices (Grid, Gallery, Carousel, Collection, Media, MediaText, Embed, Table), built on the cell model this plan proves (Task 0 = extract the shared `BluxCell`, per decision 2 above); the entity custom types (`product`, `person`, `event`, `news_article`, `project`) as `collection_item` + feed-derived extensions. Then Plans 3–4 (`reddoor-maintenance`): the IR/plan contract types, Extract (site.json→IR), Classify (IR→plan), Emit (plan→Prismic docs + asset index + feed materialization), reusing `feed-grid.ts`'s `tagFilter`, `run-migration.ts`, and `products.ts`; Plan 5: the-pointe fidelity gate + rollout.

```

```
