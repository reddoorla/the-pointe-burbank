# Blux catalog `image_embed` for subgrid media — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let doubly-nested (subgrid) image media survive `migrate-catalog` by emitting them as a url-based `<img>` in a new `image_embed` Text field instead of an unresolvable depth-2 Image field, rendered with unchanged cover/ratio fidelity.

**Architecture:** Emit (maintenance) emits `image_embed` for image media at subgrid depth (top-level media stay Image fields); the migrate's existing `rewriteValueUrls` swaps the baked CDN url → the uploaded Prismic url; render (starter) shows `image_embed` in the same `.blux-cell__media` wrapper as `PrismicImage`, so the existing cover/ratio CSS applies.

**Tech Stack:** TypeScript, Vitest (maint + starter unit), Svelte 5 + @testing-library/svelte (render), Prismic Slice Machine models, Playwright (offline fidelity gate).

**Spec:** `docs/superpowers/specs/2026-07-24-blux-catalog-subgrid-image-embed-design.md`

---

## Worktrees & branches

- **MAINT:** `scratchpad/rm-subgrid`, branch `fix/blux-catalog-subgrid-image-embed` (off maint `origin/main`, has #457).
- **STARTER:** `scratchpad/start-subgrid`, branch `fix/blux-catalog-subgrid-image-embed` (off starter `origin/main`, has #80).
- Per-task lint gate = branch-owned files only (`eslint <files>` + `prettier --check --plugin prettier-plugin-svelte <files>`).

## File structure

**MAINT** (`scratchpad/rm-subgrid`):
- `src/blux/catalog/cells.ts` — new `imgTag(m, resolveUrl, resolveAlt)` helper (beside `videoTag`).
- `src/blux/catalog/emit.ts` — `EmitCtx` gains `inSubgrid` + media resolvers; `cellToItem` image branch; `catalogSpecToPlanSlice` 4th arg; `buildCatalogPlan` builds + passes resolvers.
- `tests/blux/catalog/emit.test.ts` — subgrid-image / top-level-image / subgrid-video assertions.
- `tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap` — regenerated.

**STARTER** (`scratchpad/start-subgrid`):
- `src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/model.json` — `image_embed` on cells + subgrid groups.
- `src/lib/blux-catalog/cell.ts` — `BluxCellData.image_embed`.
- `src/lib/blux-catalog/BluxCell.svelte` — `image_embed` render branch.
- `src/prismicio-types.d.ts` — generated `image_embed` on the 8 cell/subgrid interfaces.
- `src/lib/slices/*/mocks.json` + `src/routes/dev/blux-pointe/fixture.json` — regenerated.
- `src/lib/blux-catalog/BluxCell.test.ts` — `image_embed` render test.
- `src/app.css` (or the blux-catalog CSS) — confirm/append `.blux-cell__media img` rule.

---

# MAINT tasks (worktree `scratchpad/rm-subgrid`)

### Task 1: `imgTag` helper

**Files:**
- Modify: `src/blux/catalog/cells.ts` (add after `videoTag`, ~line 315)
- Test: `tests/blux/catalog/cells.test.ts` (create if absent; else append)

- [ ] **Step 1: Write the failing test**

Append to `tests/blux/catalog/cells.test.ts` (create the file with the import header if it does not exist):

```ts
import { describe, it, expect } from "vitest";
import { imgTag } from "../../../src/blux/catalog/cells.js";
import type { Media } from "../../../src/blux/grid/types.js";

describe("imgTag", () => {
  const img: Media = { kind: "image", assetId: "u1", base: "https://cdn/", ext: "jpg" };
  const url = (m: Media) => (m.base ? `${m.base}${m.assetId}.${m.ext}` : null);

  it("builds an <img> with the resolved url and alt", () => {
    expect(imgTag(img, url, () => "Pool deck")).toBe(
      '<img src="https://cdn/u1.jpg" alt="Pool deck">',
    );
  });

  it("keeps the raw url (so the migrate url-rewrite still matches) and escapes the alt", () => {
    expect(imgTag(img, url, () => 'A "quoted" & <tagged> alt')).toBe(
      '<img src="https://cdn/u1.jpg" alt="A &quot;quoted&quot; &amp; &lt;tagged&gt; alt">',
    );
  });

  it("falls back to the bare assetId when the url cannot resolve", () => {
    const baseless: Media = { kind: "image", assetId: "u2" };
    expect(imgTag(baseless, () => null, () => "")).toBe('<img src="u2" alt="">');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scratchpad/rm-subgrid && npx vitest run tests/blux/catalog/cells.test.ts`
Expected: FAIL — `imgTag` is not exported.

- [ ] **Step 3: Implement `imgTag`**

Add after `videoTag` in `src/blux/catalog/cells.ts`:

```ts
/** An inline `<img>` for an image Media — the doubly-nested (subgrid) delivery.
 * The Prismic Migration API can't resolve Image-field asset refs inside a
 * doubly-nested group, so a subgrid image rides a Text field as a url-based
 * `<img>` (exactly as video rides `<video>`). `resolveUrl` returns the
 * plan-asset CDN url (kept RAW so the migrate's `rewriteValueUrls` swaps it to
 * the uploaded Prismic url — escaping the `&` in a query string would break
 * that match); `resolveAlt` returns the IR asset alt (escaped for the
 * attribute), else "". */
export function imgTag(
  m: Media,
  resolveUrl: (m: Media) => string | null,
  resolveAlt: (id: string) => string,
): string {
  const src = resolveUrl(m) ?? m.assetId;
  const alt = resolveAlt(m.assetId)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<img src="${src}" alt="${alt}">`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/blux/catalog/cells.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/blux/catalog/cells.ts tests/blux/catalog/cells.test.ts
npx prettier --write src/blux/catalog/cells.ts tests/blux/catalog/cells.test.ts
git add src/blux/catalog/cells.ts tests/blux/catalog/cells.test.ts
git commit -m "feat(blux): imgTag — url-based <img> for subgrid image media"
```

---

### Task 2: `cellToItem` emits `image_embed` at subgrid depth

**Files:**
- Modify: `src/blux/catalog/emit.ts` (`EmitCtx` ~47; `cellToItem` ~71–101; `catalogSpecToPlanSlice` ~195–210; `buildCatalogPlan` ~378–436)
- Test: `tests/blux/catalog/emit.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe("buildCatalogPlan", …)` block (or a new describe) in `tests/blux/catalog/emit.test.ts`:

```ts
describe("subgrid image media → image_embed", () => {
  const gridWithSubgrid = {
    slice: "BluxGrid",
    index: 0,
    columns: 2,
    cells: [
      {
        kind: "subgrid",
        subgrid: [
          { kind: "media", media: { kind: "image", assetId: "u1" }, cover: true, mediaRatio: "4:3" },
          { kind: "text", title: "<h3>Caption</h3>" },
        ],
      },
      { kind: "media", media: { kind: "image", assetId: "u2" } }, // top-level, stays Image field
    ],
  } as unknown as import("../../../src/blux/catalog/spec.js").CatalogSpec;

  const ir = {
    assets: [
      { id: "u1", url: "https://cdn/u1.jpg", alt: "Pool", sourceUrl: "https://cdn/u1.jpg" },
      { id: "u2", url: "https://cdn/u2.jpg", alt: "", sourceUrl: "https://cdn/u2.jpg" },
    ],
    diagnostics: [],
  };

  it("emits a subgrid image as image_embed (<img>) and NOT a media marker; top-level stays a media marker", () => {
    const plan = buildCatalogPlan([{ uid: "home", title: "Home", specs: [gridWithSubgrid] }], ir);
    const primary = (plan.documents[0]!.data as { slices: { primary: Record<string, unknown> }[] })
      .slices[0]!.primary;
    const cells = primary.cells as Record<string, unknown>[];
    const subgrid = cells[0]!.subgrid as Record<string, unknown>[];
    // Subgrid image → image_embed, no media marker.
    expect(subgrid[0]!.image_embed).toBe('<img src="https://cdn/u1.jpg" alt="Pool">');
    expect(subgrid[0]).not.toHaveProperty("media");
    // cover/media_ratio still ride the cell for the render wrapper.
    expect(subgrid[0]!.cover).toBe("on");
    expect(subgrid[0]!.media_ratio).toBe("4:3");
    // Top-level image → still an Image-field marker, no image_embed.
    expect(cells[1]!.media).toEqual({ __asset_id: "u2" });
    expect(cells[1]).not.toHaveProperty("image_embed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/blux/catalog/emit.test.ts -t "subgrid image media"`
Expected: FAIL — `subgrid[0].image_embed` is undefined (still emits a `media` marker).

- [ ] **Step 3: Extend `EmitCtx`**

In `src/blux/catalog/emit.ts`, replace the `EmitCtx` type (~line 47):

```ts
type EmitCtx = {
  index: number;
  pageUid?: string;
  diagnostics?: Diagnostic[];
  /** True while emitting a subgrid's cells (depth 2). At this depth an image
   *  media cannot ride an Image field — the Migration API can't resolve a
   *  doubly-nested Image ref — so it emits `image_embed` instead. */
  inSubgrid?: boolean;
  /** Resolve a media's plan-asset CDN url (mediaCdnUrl, else IR sourceUrl) so
   *  the emitted `image_embed` src matches what `rewriteValueUrls` swaps. */
  resolveUrl?: (m: Media) => string | null;
  /** Resolve a media's IR alt (else ""). */
  resolveAlt?: (id: string) => string;
};
```

Ensure `imgTag` is imported at the top of `emit.ts` (it lives in `./cells.js` alongside `videoTag`, which is already imported):

```ts
import { videoTag, imgTag } from "./cells.js";
```

(`mediaCdnUrl` is already importable from `../emit/grid-plan.js`; add it to that import if not present, for the default fallback.)

- [ ] **Step 4: Branch `cellToItem` on `inSubgrid`, and mark subgrid recursion**

In `cellToItem` (~line 88), replace the media line:

```ts
    ...(cell.media && cell.media.kind !== "video"
      ? ctx.inSubgrid
        ? {
            image_embed: sanitizeHtml(
              imgTag(cell.media, ctx.resolveUrl ?? mediaCdnUrl, ctx.resolveAlt ?? (() => "")),
            ),
          }
        : { media: assetRef(cell.media.assetId) }
      : {}),
```

And the subgrid line (~line 100), mark the recursion:

```ts
    ...(cell.subgrid ? { subgrid: emitCells(cell.subgrid, { ...ctx, inSubgrid: true }) } : {}),
```

- [ ] **Step 5: Thread resolvers through `catalogSpecToPlanSlice`**

Update the signature + `ctx` (~line 195):

```ts
export function catalogSpecToPlanSlice(
  spec: CatalogSpec,
  diagnostics?: Diagnostic[],
  pageUid?: string,
  media?: { resolveUrl: (m: Media) => string | null; resolveAlt: (id: string) => string },
): PlanSlice {
  const ctx: EmitCtx = {
    index: spec.index,
    ...(pageUid !== undefined ? { pageUid } : {}),
    ...(diagnostics ? { diagnostics } : {}),
    ...(media ? { resolveUrl: media.resolveUrl, resolveAlt: media.resolveAlt } : {}),
  };
```

- [ ] **Step 6: Build + pass the resolvers in `buildCatalogPlan`**

In `buildCatalogPlan`, BEFORE the `documents` map, build the resolvers from `ir` (reuse/relocate the existing `sourceUrlById` at ~line 417 to the top so it is in scope):

```ts
  const sourceUrlById = new Map(ir.assets.map((a) => [a.id, a.sourceUrl] as const));
  const altById = new Map(ir.assets.map((a) => [a.id, a.alt] as const));
  const mediaResolvers = {
    resolveUrl: (m: Media) => mediaUrl(m, sourceUrlById),
    resolveAlt: (id: string) => altById.get(id) ?? "",
  };
```

(Remove the later duplicate `const sourceUrlById = …` if you relocated it.) Then pass `mediaResolvers` in the `documents` map:

```ts
      slices: p.specs.map((s) => catalogSpecToPlanSlice(s, diagnostics, p.uid, mediaResolvers)),
```

- [ ] **Step 7: Run the new test + full catalog suite**

Run: `npx vitest run tests/blux/catalog/emit.test.ts`
Expected: PASS (subgrid → image_embed, top-level → media marker).

- [ ] **Step 8: Lint + commit**

```bash
npx eslint src/blux/catalog/emit.ts tests/blux/catalog/emit.test.ts
npx prettier --write src/blux/catalog/emit.ts tests/blux/catalog/emit.test.ts
git add src/blux/catalog/emit.ts tests/blux/catalog/emit.test.ts
git commit -m "feat(blux): emit subgrid image media as image_embed, not a nested Image field"
```

---

### Task 3: Regenerate the-pointe golden + full green + PR

**Files:**
- Modify: `tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap`

- [ ] **Step 1: Regenerate the golden snapshot**

Run: `npx vitest run tests/blux/catalog/plan-golden.test.ts -u`
Expected: snapshot updated — the-pointe subgrid image rows change from `{ "__asset_id": … }` (media markers) to `"image_embed": "<img src=…>"`.

- [ ] **Step 2: Inspect the diff — confirm only subgrid media changed**

Run: `git diff tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap | grep -E "image_embed|__asset_id" | head`
Expected: subgrid cells gained `image_embed`; top-level cell `media` markers unchanged. No unexpected structural churn.

- [ ] **Step 3: Full maint suite + tsc**

Run: `npx vitest run tests/blux && npx tsc --noEmit`
Expected: all green, tsc clean.

- [ ] **Step 4: Commit + push + PR**

```bash
git add tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap
git commit -m "test(blux): regenerate the-pointe golden for subgrid image_embed"
git push -u origin fix/blux-catalog-subgrid-image-embed
gh pr create -R reddoorla/reddoor-maintenance --base main \
  --title "feat(blux): emit subgrid image media as image_embed (Migration-API-resolvable)" \
  --body "Doubly-nested cells→subgrid→media Image fields are unresolvable by the Prismic Migration API (\"Missing asset\"). Emit subgrid image media as a url-based <img> in a new image_embed Text field; rewriteValueUrls swaps the CDN url to the uploaded Prismic url. Top-level media stay Image fields. Pairs with starter render PR. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

# STARTER tasks (worktree `scratchpad/start-subgrid`)

### Task 4: Add `image_embed` to the four band models

**Files:**
- Modify: `src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/model.json`

- [ ] **Step 1: Add the field (script, inserts after `embed_html` in cells + subgrid groups)**

Run from `scratchpad/start-subgrid`:

```bash
node -e '
const fs=require("fs");
const withIE=(fields)=>{const o={};for(const[k,v]of Object.entries(fields)){o[k]=v;if(k==="embed_html")o.image_embed={type:"Text",config:{label:"image_embed"}};}return o;};
for(const s of ["BluxGrid","BluxSection","BluxGallery","BluxCarousel"]){
  const p=`src/lib/slices/${s}/model.json`;
  const m=JSON.parse(fs.readFileSync(p,"utf8"));
  const cells=m.variations[0].primary.cells;
  cells.config.fields=withIE(cells.config.fields);
  const sg=cells.config.fields.subgrid;
  if(sg) sg.config.fields=withIE(sg.config.fields);
  fs.writeFileSync(p,JSON.stringify(m,null,2)+"\n");
  console.log("updated",s);
}
'
npx prettier --write src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/model.json
```

- [ ] **Step 2: Verify**

Run:
```bash
for s in BluxGrid BluxSection BluxGallery BluxCarousel; do
  node -e 'const m=require("./src/lib/slices/"+process.argv[1]+"/model.json");const c=m.variations[0].primary.cells.config.fields;console.log(process.argv[1],"cells.image_embed:",!!c.image_embed,"subgrid.image_embed:",!!(c.subgrid&&c.subgrid.config.fields.image_embed))' "$s"
done
```
Expected: all four print `cells.image_embed: true subgrid.image_embed: true`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slices/*/model.json
git commit -m "feat(blux): add image_embed Text field to the four band slice models"
```

---

### Task 5: Render `image_embed` + type + CSS

**Files:**
- Modify: `src/lib/blux-catalog/cell.ts` (~line 14)
- Modify: `src/lib/blux-catalog/BluxCell.svelte` (after the `cell.media` block, ~line 49)
- Test: `src/lib/blux-catalog/BluxCell.test.ts`

- [ ] **Step 1: Write the failing render test**

Append to `src/lib/blux-catalog/BluxCell.test.ts`:

```ts
describe("BluxCell image_embed (doubly-nested subgrid media)", () => {
  it("renders image_embed inside .blux-cell__media with cover + ratio", () => {
    const cell = {
      kind: "media",
      image_embed: '<img src="https://images.prismic.io/repo/u1.jpg" alt="Pool">',
      media_ratio: "4:3",
      cover: "on",
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell } });
    const wrap = container.querySelector(".blux-cell__media") as HTMLElement;
    expect(wrap).not.toBeNull();
    expect(wrap.getAttribute("data-cover")).toBe("on");
    expect(wrap.getAttribute("data-ratio")).toBe("4:3");
    const im = wrap.querySelector("img") as HTMLImageElement;
    expect(im.getAttribute("src")).toBe("https://images.prismic.io/repo/u1.jpg");
    expect(im.getAttribute("alt")).toBe("Pool");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scratchpad/start-subgrid && npx vitest run src/lib/blux-catalog/BluxCell.test.ts -t image_embed`
Expected: FAIL — no `.blux-cell__media` (image_embed not rendered).

- [ ] **Step 3: Add `image_embed` to `BluxCellData`**

In `src/lib/blux-catalog/cell.ts`, after the `embed_html` line (~14):

```ts
  embed_html: prismic.KeyTextField;
  /** A url-based <img> for a doubly-nested (subgrid) image: the Migration API
   *  can't resolve a depth-2 Image field, so subgrid images ride this Text
   *  field (src rewritten to the Prismic-hosted url at migrate). Rendered in
   *  the same .blux-cell__media wrapper as a `media` Image field. */
  image_embed: prismic.KeyTextField;
```

- [ ] **Step 4: Add the render branch**

In `src/lib/blux-catalog/BluxCell.svelte`, immediately AFTER the `{#if isFilled.image(cell.media)} … {/if}` block (~line 49), add:

```svelte
  {#if isFilled.keyText(cell.image_embed)}
    <div
      class="blux-cell__media"
      data-ratio={cell.media_ratio}
      data-cover={cell.cover || undefined}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration <img>, sanitized at Emit; src rewritten to the Prismic-hosted url at migrate. Doubly-nested subgrid media ride a Text field because the Migration API can't resolve depth-2 Image-field refs. -->
      {@html cell.image_embed}
    </div>
  {/if}
```

- [ ] **Step 5: Run the render test**

Run: `npx vitest run src/lib/blux-catalog/BluxCell.test.ts`
Expected: PASS.

- [ ] **Step 6: Confirm the `.blux-cell__media img` CSS covers a plain `<img>`**

Run: `grep -rn "blux-cell__media" src/app.css src/lib/blux-catalog 2>/dev/null | grep -iE "img|object-fit|aspect"`
- If a rule like `.blux-cell__media img { width:100%; height:100%; object-fit: … }` (with `[data-cover] img { object-fit: cover }` and `[data-ratio]` aspect handling) already exists, no change — `PrismicImage` already renders a plain `<img>`, so the same rule applies.
- If NOT present, add to the same stylesheet where `.blux-cell__media` is defined:

```css
.blux-cell__media img { display: block; width: 100%; height: 100%; }
.blux-cell__media[data-cover] img { object-fit: cover; }
```

(Only add what is missing — do not duplicate an existing rule.)

- [ ] **Step 7: svelte-check**

Run: `npm run check`
- If it errors that the generated `slice.primary.cells[]`/`subgrid[]` type lacks `image_embed`, proceed to Task 6 Step 1 (generated types); otherwise it passes.

- [ ] **Step 8: Lint + commit**

```bash
npx eslint src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.test.ts
npx prettier --write --plugin prettier-plugin-svelte src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.svelte src/lib/blux-catalog/BluxCell.test.ts
git add src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.svelte src/lib/blux-catalog/BluxCell.test.ts
git commit -m "feat(blux): render image_embed subgrid media in the media wrapper"
```

---

### Task 6: Regenerate generated types + mocks + fidelity fixture

**Files:**
- Modify: `src/prismicio-types.d.ts`
- Modify: `src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/mocks.json`
- Modify: `src/routes/dev/blux-pointe/fixture.json`

- [ ] **Step 1: Add `image_embed` to the generated cell/subgrid interfaces**

Add `image_embed: prismic.KeyTextField;` immediately after the `embed_html: prismic.KeyTextField;` line of each of these 8 generated interfaces in `src/prismicio-types.d.ts` (identify each by its doc-comment **API ID Path**):

```
blux_grid.default.primary.cells[].embed_html
blux_grid.default.primary.cells[].subgrid[].embed_html
blux_section.default.primary.cells[].embed_html
blux_section.default.primary.cells[].subgrid[].embed_html
blux_gallery.default.primary.cells[].embed_html
blux_gallery.default.primary.cells[].subgrid[].embed_html
blux_carousel.default.primary.cells[].embed_html
blux_carousel.default.primary.cells[].subgrid[].embed_html
```

(Do NOT touch `blux_embed.default.primary.embed_html` — that is a primary-level field, not a cell.) Mirror the exact doc-comment style of the neighboring `embed_html` entry.

- [ ] **Step 2: svelte-check passes**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Regenerate slice mocks**

Slice mocks are generated from the models. Regenerate via Slice Machine's mock generation OR, if the running SM instance is unavailable, add an `image_embed` entry to the `primary.cells[].(subgrid[].)` items of the four `mocks.json` files so they type-check against the new model. Minimal deterministic edit:

```bash
node -e '
const fs=require("fs");
const add=(cell)=>{ if(cell && typeof cell==="object"){ if("embed_html" in cell && !("image_embed" in cell)) cell.image_embed="<img src=\"https://images.prismic.io/example/mock.jpg\" alt=\"\">"; for(const k in cell) if(Array.isArray(cell[k])) cell[k].forEach(add); } };
for(const s of ["BluxGrid","BluxSection","BluxGallery","BluxCarousel"]){
  const p=`src/lib/slices/${s}/mocks.json`;
  const m=JSON.parse(fs.readFileSync(p,"utf8"));
  JSON.stringify(m,(k,v)=>{ if(v && typeof v==="object" && "embed_html" in v && !("image_embed" in v)) v.image_embed="<img src=\"https://images.prismic.io/example/mock.jpg\" alt=\"\">"; return v; });
  fs.writeFileSync(p,JSON.stringify(m,null,2)+"\n");
}
'
npx prettier --write src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/mocks.json
```

(If a running Slice Machine is available, prefer its "Update mocks" — it produces equivalent content and keeps the model.json untouched, per prior guidance that mock regen rewrites the model you pass it.)

- [ ] **Step 4: Regenerate the fidelity-gate fixture**

Per the recipe in `src/routes/dev/blux-pointe/+page.ts` (regenerate the committed fixtures). Using the maint CLI built in the acceptance task:

```bash
# from the maint worktree with the built CLI (Task 7 Step 2 builds it):
OUT=$TMPDIR/pointe-fix
node scratchpad/rm-subgrid/dist/cli/bin.js blux catalog ~/Desktop/thePointe --out "$OUT"
cp "$OUT/render-fixture.json" src/routes/dev/blux-pointe/fixture.json
cp "$OUT/site-config.json" src/routes/dev/blux-pointe/site-config.json
npx prettier --write src/routes/dev/blux-pointe/fixture.json src/routes/dev/blux-pointe/site-config.json
```

Expected: `fixture.json` subgrid cells now carry `image_embed` (`<img>`), not a resolved media object.

- [ ] **Step 5: Offline fidelity gate + build**

Run (sandbox off — the gate serves a local vite host):
```bash
npm run build
npx playwright test tests/gate/pointe-fidelity.spec.ts
```
Expected: gate green (text coverage + role sizing unchanged; subgrid images now render via `image_embed`).

- [ ] **Step 6: Full unit suite + lint + commit + push + PR**

```bash
npx vitest run
npm run lint
git add src/prismicio-types.d.ts src/lib/slices/*/mocks.json src/routes/dev/blux-pointe/fixture.json src/routes/dev/blux-pointe/site-config.json
git commit -m "chore(blux): regen types + mocks + fidelity fixture for image_embed"
git push -u origin fix/blux-catalog-subgrid-image-embed
gh pr create -R reddoorla/reddoor-starter --base main \
  --title "feat(blux): render doubly-nested subgrid media via image_embed" \
  --body "Adds image_embed to the four band slice models + BluxCellData + BluxCell (rendered in the same .blux-cell__media wrapper as a media Image field, so cover/ratio CSS applies). Pairs with maint emit PR. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

# Acceptance: live proof into the-pointe-burbank

### Task 7: End-to-end migrate with 0 "Missing asset"

- [ ] **Step 1: Merge both PRs when green** (verify each PR's file list first, per the verify-before-merge rule; squash + delete-branch).

- [ ] **Step 2: Rebuild the CLI from merged maint main**

```bash
MAINT=/Users/tuckerlemos/Documents/GitHub/reddoor-maintenance
git -C "$MAINT" fetch origin
git -C scratchpad/rm-subgrid merge --ff-only origin/main   # or a fresh worktree at origin/main
cd scratchpad/rm-subgrid && pnpm build
```

- [ ] **Step 3: Re-push the updated slice models** (models gained `image_embed`):

```bash
set -a; . scratchpad/burbank-secrets.env; set +a
export PRISMIC_REPOSITORY_NAME=the-pointe-burbank PRISMIC_WRITE_TOKEN="$THE_POINTE_BURBANK_WRITE_TOKEN"
node scratchpad/push-blux-slices.mjs scratchpad/start-subgrid/src/lib/slices   # sandbox off
```
Expected: `synced 11/11 blux slice models`.

- [ ] **Step 4: Regenerate the catalog + re-run migrate** (sandbox off):

```bash
OUT=scratchpad/migrate-out/thepointe
node scratchpad/rm-subgrid/dist/cli/bin.js blux catalog ~/Desktop/thePointe --out "$OUT"
node scratchpad/rm-subgrid/dist/cli/bin.js blux migrate-catalog "$OUT"
```
Expected: **`created home`** — 0 "Missing asset", the home doc staged in an unpublished migration release.

- [ ] **Step 5: Verify the staged release** (asset-url rewrite count, 0 missing) and report to Tucker to publish. Do NOT publish the release.

---

## Self-review

- **Spec coverage:** data model (T4/T5/T6), emit (T1/T2), url-rewrite reliance (T2 resolvers + Task-7 proof), render (T5), sanitize boundary (T2 Step 4 `sanitizeHtml(imgTag(...))`), testing (T2/T3/T5), live proof (T7). All spec sections mapped.
- **Type consistency:** `imgTag(m, resolveUrl, resolveAlt)` defined T1, used T2; `EmitCtx.{inSubgrid,resolveUrl,resolveAlt}` defined + consumed T2; `catalogSpecToPlanSlice(…, media?)` shape matches `buildCatalogPlan`'s `mediaResolvers`; `BluxCellData.image_embed: prismic.KeyTextField` (T5) matches the model Text field (T4) and generated type (T6).
- **No placeholders:** every code step shows full code; the one conditional (T5 Step 6 CSS / T5 Step 7 → T6 Step 1) is gated on a deterministic `grep`/`svelte-check` result, not vague judgment.
- **Non-goals honored:** top-level media untouched; no triple-nesting handling; slice-model-sync durability tracked separately.
