# Blux catalog: `image_embed` for doubly-nested subgrid media — Design

**Date:** 2026-07-24
**Status:** Approved
**Repos:** reddoor-maintenance (emit) + reddoor-starter (render/model/types)

## Problem

The Prismic **Migration API cannot resolve image-field refs in doubly-nested
groups**. The catalog pipeline stores a band's cells as a Group, and a cell may
hold a `subgrid` Group — so a media cell inside a subgrid is a depth-2
(`cells → subgrid → media`) **Image field**. When `migrate-catalog` POSTs such a
document, the API rejects it with `Missing asset with id '<prismic-id>'` even
though the asset uploaded fine. the-pointe has **10** such depth-2 image media,
so its home doc cannot stage.

This is the same limitation the legacy **band** live-migrate pipeline already
solved (subgrid img → url-based `embed_html` with a plan-asset src; top-level
cell media stay Image fields). The **catalog** pipeline never got the
equivalent. Video already dodges the limitation everywhere — it emits a
url-based `<video>` in `embed_html`/`video_embed`, never an Image field.

Subgrids are at most one level deep (the emit's `buildCell` flattens anything
deeper), so only depth-2 **image** media are affected. Confirmed on the-pointe:
0 triple-nested media.

## Approach (chosen: A — dedicated `image_embed` field)

For an image media cell **at subgrid depth**, emit a url-based `<img>` in a new
`image_embed` Text field instead of a `media` Image field. The render wraps that
`<img>` in the **same** `.blux-cell__media` container the Image-field path uses,
with the same `data-cover`/`data-ratio` — so the existing cover/ratio CSS applies
unchanged and fidelity is preserved. Top-level cell media stay Image fields (they
migrate fine and keep `PrismicImage`'s responsive srcset). `embed_html` stays
reserved for links / arbitrary html.

The url baked into `image_embed` is the plan-asset CDN url, which
`rewriteValueUrls` already swaps to the durable uploaded Prismic url at
migrate time (it rewrites every string value, `embed_html` included). The media
object stays on the `CatalogCell`, so the asset walk still uploads it and the
rewrite map still contains its CDN→Prismic entry.

### Rejected alternatives
- **B — bake a fully-styled `<img>` into `embed_html`.** No new field, but the
  cover/ratio styling is baked at emit rather than driven by the data model, and
  images share `embed_html`'s semantic space. Less faithful control.
- **C — flatten depth-2 media to depth-1.** Bigger structural change to
  `buildCell`, loses the media's position within the subgrid, and churns the
  tested golden. Higher regression risk for no fidelity gain.

## Components

### 1. Data model (starter)
- Add `image_embed` (Text) to the **`cells` and `subgrid` groups of all four
  band models** — `BluxGrid`, `BluxSection`, `BluxGallery`, `BluxCarousel`
  (all four define a `subgrid` group, and each model's two groups are kept
  field-identical). Only subgrid cells populate it; keeping both groups
  identical preserves the existing invariant and keeps generated types/mocks
  clean.
- `BluxCellData` (`src/lib/blux-catalog/cell.ts`) gains `image_embed?:
  KeyTextField`.
- Regenerate `prismicio-types.d.ts` and the affected slice `mocks.json`.

### 2. Emit (maintenance, `src/blux/catalog`)
- New helper `imgTag(m: Media, resolveUrl, resolveAlt): string` in `cells.ts`,
  mirroring `videoTag`: returns `<img src="RESOLVED_URL" alt="ALT">`.
  - `RESOLVED_URL` must equal the plan-asset CDN url so `rewriteValueUrls`
    swaps it. Resolve it via the same `resolveMediaUrl` the asset walk uses
    (`mediaCdnUrl(m) ?? IR sourceUrl(m.assetId)`). the-pointe's 10 subgrid
    media all carry a CDN base, so `mediaCdnUrl` suffices today; threading the
    IR resolver makes base-less media on other sites emit a rewritable url
    rather than a bare assetId.
  - `ALT` comes from the IR asset index when present, else `""`.
- `cellToItem(cell, ctx)` gains an `inSubgrid` signal (via `ctx` or a param).
  `catalogSpecToPlanSlice` emits `cell.subgrid` with `inSubgrid: true`. When
  `inSubgrid` and the media is an **image**, emit `image_embed: imgTag(...)`
  and **omit** the `media` Image marker. Top-level (`inSubgrid` false) is
  unchanged. Video is unaffected (already `embed_html`, never reaches the
  image branch).
- Thread the IR url/alt resolver from `buildCatalogPlan` (which holds the IR)
  down into `catalogSpecToPlanSlice → emitCells → cellToItem`.
- The `CatalogCell.media` stays populated so the asset walk (`walkCells`)
  still collects and uploads the media.

### 3. Render (starter, `src/lib/blux-catalog/BluxCell.svelte`)
- Add an `image_embed` branch **parallel to** the Image-field branch:
  ```svelte
  {#if isFilled.keyText(cell.image_embed)}
    <div class="blux-cell__media" data-ratio={cell.media_ratio}
         data-cover={cell.cover || undefined}>
      <!-- trusted Blux migration HTML, sanitized at emit; url rewritten to Prismic -->
      {@html cell.image_embed}
    </div>
  {/if}
  ```
  Same wrapper + `data-*` as the `PrismicImage` path → existing cover/ratio CSS
  applies unchanged. The `<img>` should fill the frame (`width/height:100%`,
  `object-fit` driven by `data-cover`) — verify the `.blux-cell__media img`
  rule covers a plain `<img>`, not only `PrismicImage`'s output; add a rule if
  needed.

### 4. Sanitize boundary
`image_embed` is trusted migration HTML but must pass the same emit-stage
`sanitizeHtml` scalpel as `embed_html`/`body_html` (strips scripts/handlers/
js-urls, keeps the `<img>`). `imgTag` output is a bare `<img>`, so this is a
formality, but route it through the boundary for consistency.

## Data flow

```
Blux export → buildCell (cells.ts): subgrid cell keeps media:Media
  → catalogSpecToPlanSlice → emitCells(subgrid, inSubgrid:true) → cellToItem
      image + inSubgrid → image_embed: imgTag(media)   [CDN url baked]
      (media marker omitted; asset walk still uploads the media)
  → migration-plan.json
migrate-catalog:
  phase 1 upload assets → CDN→Prismic url map
  rewriteValueUrls swaps the image_embed CDN url → Prismic url
  phase 2 POST doc → API accepts (Text field, no nested asset-ref) → staged
render:
  BluxCell image_embed branch → .blux-cell__media wrapper + data-cover/ratio
```

## Testing

- **Emit unit test** (`tests/blux/catalog/emit.test.ts`): a subgrid image cell
  emits `image_embed` (`<img src=…>`) and **no** `media` marker; a top-level
  image cell still emits a `media` Image marker (unchanged). A subgrid **video**
  still emits `embed_html`/`video_embed` (unchanged).
- **Golden** (`plan-golden.test.ts`): update the-pointe snapshot — subgrid image
  rows change from `{__asset_id}` markers to `<img>` `image_embed` strings.
- **Render test** (`BluxCell.test.ts`): `image_embed` renders inside
  `.blux-cell__media` with `data-cover`/`data-ratio`; regenerate
  `render-fixture.json`.
- **Offline fidelity gate** (`/dev/blux-pointe`) stays green.
- **Live proof:** re-push the updated slice models to the-pointe-burbank,
  regenerate the catalog, re-run `migrate-catalog` → the-pointe home doc stages
  with **0 "Missing asset"**. This is the end-to-end acceptance criterion.

## Rollout
Two PRs, same pattern as the migrate fixes just landed:
- **maint**: `imgTag` + `cellToItem` `inSubgrid` emit + IR resolver threading +
  emit/golden tests.
- **starter**: model field on 4 slices + `BluxCellData` + `BluxCell` render +
  CSS check + types/mocks/fixture regen + render test.

Merge order: either first (independent), but the live-proof re-run needs both
merged + a fresh CLI build + the slice-model re-push.

## Non-goals
- Top-level cell media handling (works today; keeps responsive `PrismicImage`).
- Triple nesting (doesn't occur — `buildCell` flattens deeper than one subgrid).
- The durable slice-model-sync gap (separate concern — provisioning/migrate
  should push shared slice models; tracked in memory `catalog-migrate-live-gaps`).
