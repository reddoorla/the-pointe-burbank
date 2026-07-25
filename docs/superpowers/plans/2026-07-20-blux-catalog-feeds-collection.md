# Blux Catalog Feeds + Collection Slice — Plan 4c of N

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Feed records become real Prismic **entity documents** (product/person/event/news_article/project + `collection_item` catch-all, per the spec's frozen mapping), and feed-backed bands become a **`blux_collection` query-spec slice** the starter resolves at load time — completing the catalog (spec §6 row 5, §8) with the card-link contract (external-only until detail pages).

**Architecture:** Maintenance side: a frozen feed→type mapping, an entity-document emitter reusing the proven `modelCollections`/`recordData` machinery mapped onto the Plan-2 shared-base type fields (+ per-site extension custom types), and a collection classifier that intercepts feed bands (positional `pageItems[band.index]` + `isFeedBand`, the existing convert-path join) BEFORE `bandToCatalog`. Starter side (IN THE WORKTREE — see conventions): a `blux_collection` container slice whose component renders entity docs delivered via SliceZone `context.collections`, filtered by a ported `tagFilter` DSL; the page load function fetches `getAllByType` for each collection type on the page. No side-car anywhere.

**Tech Stack:** as Plans 3/4a/4b (TS ESM + Vitest in maintenance; SvelteKit 2/Svelte 5 + Prismic in starter).

**Spec:** §6 (Collection row: `feedIds, filterTag, sort, limit, mediaRatio, layout(grid|carousel), scrollLoadMore`; widget = container-level), §7 (rule 1: `feed.sources[]` present → Collection, carousel variant if `type=slides`), §8 (entity types + catch-all + frozen name mapping; field model = shared base + union extensions; category pages = Collection slice + filterTag; card-link contract; detail pages deferred).

---

## Confirmed groundwork (verified — do not re-litigate)

- **Feed-band detection + join (convert path, reuse verbatim):** `isFeedBand(item)` = site.json item has non-empty `sources[]` (`grid/feed-grid.ts:296`). Join is **positional**: `siteJson.content.pages[p].items[band.index]` ↔ the band (`emit/convert.ts:179-187`). Feed id = `sources[0]` = the key of the `site.json.feeds` object (`resolveFeedTiles`, `feed-grid.ts:118,165`); `"__media"` selects the media library. `filterTag` comes from `sourceConfig.filters.tag` (`feed-grid.ts:122`).
- **tagFilter DSL** (`feed-grid.ts:55-70`): `||` across OR-groups, `&&` within; `termMatchesTag` is singular/plural-insensitive; empty expr matches all.
- **Record machinery (Path A, reuse):** `modelCollections(raw)` (`collections.ts:53`) → per feed: `apiId = singularSlug(name)`, records with `uid = slug(title) || item-${i}`, `values` minus `_`-keys, `mediaRefs`. `deriveFields` types keys (body/description→richtext, `{media}`→image, array→group, `date`→date, `^(url|link)`→link, else text). `recordData(rec)` (`emit/migration-plan.ts:35`) → `{media}`→`assetRef`, body/description→`richText(demoteHeadingsHtml(...))`, else verbatim. `buildCustomType(c)` (`emit/custom-types.ts:21`) emits a repeatable type from FieldDefs. Path A emits record documents `{type: apiId, uid, data}` (`migration-plan.ts:135-142`) — the CATALOG CLI path does not yet.
- **`materializeProducts`/`productSlug`** (`products.ts`): slug from record `url` else slugified title; enabled-beats-disabled dedup.
- **Composition feed shapes (real):** `feeds` is an object; `Products` = 552 records `{title, category, sub_category, dimensions, tags, date, media, disabled, body}` with `fields` + `template` + `publish:"products"`; `Reps` = 11 `{title, body, tags}`; `All Projects List` = 545 `{title}`.
- **Starter entity base types (Plan 2, exist):** `product/person/event/news_article/project/collection_item`, identical Main: `uid`(UID), `title`(StructuredText h1), `body`(multi), `media`(Image), `gallery`(Group{image,caption}), `tags`(Text, comma-separated), `date`(Date), `link`(Link).
- **Starter render delivery:** slices do NOT fetch. `+page.server.ts` (`src/routes/[[preview=preview]]/[uid]/+page.server.ts`) does `client.getByUID("page", uid)`; `+page.svelte` passes `context={{ presentation: ... }}` to `SliceZone`. Legacy `CollectionList` reads `context.collections[type]` — mirror that key.
- **Frozen feed→type mapping (spec §8, verbatim):** product ← {Products, Equipment Grid, Center Features}; person ← {Team, Reps, Trainers}; event ← {Events, Donate Life Observances}; news_article ← {News, Outside The Lines}; project ← {All Projects List, Portfolio, Projects}; default `collection_item`; feeds named like "DO NOT USE…" are SKIPPED with a report diagnostic.
- **Card-link contract:** a collection card links ONLY to an external `url`/`link_url` the record carries; otherwise non-linking. No internal routes until detail pages (deferred).

## Conventions for this plan

- **Maintenance work**: repo `/Users/tuckerlemos/Documents/GitHub/reddoor-maintenance`, branch `feat/blux-catalog-emit`. Rules as 4a/4b: no `src/blux/grid/*` / Path A/B / run-migration edits; ESM `.js` specifiers; no `any`/`@ts-ignore`; grid goldens must stay byte-unchanged.
- **Starter work happens in the WORKTREE** `/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/starter-4c` (branch `feat/blux-catalog-pipeline` checked out there — the main checkout is in use by another session; NEVER touch `/Users/tuckerlemos/Documents/GitHub/reddoor-starter` directly). All starter commands (`pnpm run check`, `vitest`, regen) run from the worktree; run `pnpm install` there first if `node_modules` is absent. Regen script: `node /private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/regen-types.mjs "$PWD" "./src/lib/slices" "src/lib/slices/<Name>/model.json"` from the worktree root (it resolves the manager from the worktree's node_modules/.pnpm; if the worktree uses a shared store and `.pnpm` is missing, run `pnpm install` first). Regen gotchas as ever: scoped `prettier --write` (types file twice), `git checkout --` incidental churn.
- Starter tests: vitest + cleanup conventions as Plan 2; sandbox `--pool=threads` for full suite.

---

### Task 1: Frozen feed→type mapping (maintenance)

**Files:** create `src/blux/catalog/feeds.ts`, `tests/blux/catalog/feeds.test.ts`.

- [ ] **Step 1: Failing test.** Create `tests/blux/catalog/feeds.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  feedEntityType,
  isSkippedFeed,
} from "../../../src/blux/catalog/feeds.js";

describe("feedEntityType (frozen spec §8 mapping)", () => {
  it("maps the named feeds", () => {
    expect(feedEntityType("Products")).toBe("product");
    expect(feedEntityType("Equipment Grid")).toBe("product");
    expect(feedEntityType("Center Features")).toBe("product");
    expect(feedEntityType("Team")).toBe("person");
    expect(feedEntityType("Reps")).toBe("person");
    expect(feedEntityType("Trainers")).toBe("person");
    expect(feedEntityType("Events")).toBe("event");
    expect(feedEntityType("Donate Life Observances")).toBe("event");
    expect(feedEntityType("News")).toBe("news_article");
    expect(feedEntityType("Outside The Lines")).toBe("news_article");
    expect(feedEntityType("All Projects List")).toBe("project");
    expect(feedEntityType("Portfolio")).toBe("project");
    expect(feedEntityType("Projects")).toBe("project");
  });
  it("is case/space-insensitive and defaults to collection_item", () => {
    expect(feedEntityType("  products ")).toBe("product");
    expect(feedEntityType("Gallery Wall")).toBe("collection_item");
  });
  it("flags DO-NOT-USE feeds as skipped", () => {
    expect(isSkippedFeed("DO NOT USE THIS")).toBe(true);
    expect(isSkippedFeed("do not use — old")).toBe(true);
    expect(isSkippedFeed("Products")).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL**, then implement `src/blux/catalog/feeds.ts`:

```ts
/** Frozen feed→entity-type mapping (spec §8). Keyed on the NORMALIZED feed
 * name (lowercase, collapsed whitespace). `collection_item` is the catch-all
 * so nothing is unroutable; "DO NOT USE…" feeds are skipped with a report
 * entry instead of migrated. */
const NAME_TO_TYPE: Record<string, string> = {
  products: "product",
  "equipment grid": "product",
  "center features": "product",
  team: "person",
  reps: "person",
  trainers: "person",
  events: "event",
  "donate life observances": "event",
  news: "news_article",
  "outside the lines": "news_article",
  "all projects list": "project",
  portfolio: "project",
  projects: "project",
};

const normalize = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

export function feedEntityType(feedName: string): string {
  return NAME_TO_TYPE[normalize(feedName)] ?? "collection_item";
}

export function isSkippedFeed(feedName: string): boolean {
  return normalize(feedName).startsWith("do not use");
}
```

Add `export * from "./feeds.js";` to the barrel. **Step 3: PASS → commit** `feat(blux-catalog): frozen feed→entity-type mapping (spec §8)`.

---

### Task 2: Entity-document emitter (maintenance)

**Files:** create `src/blux/catalog/entities.ts`, `tests/blux/catalog/entities.test.ts`.

- [ ] **Step 1: Failing tests** — composition-shaped fixture (a Products feed with category/sub_category/dimensions/disabled extensions, a Reps feed base-only, one DO-NOT-USE feed, one record with `{media}` + `items[].media` gallery + tags array + date + url). Assert: (a) each kept feed emits documents `{type: <mapped>, uid, data}` with base fields mapped — `title` = `{__richtext_html:"<h1>…</h1>"}`, `body` = richtext marker, `media` = `{__asset_id}`, `gallery` = `[{image:{__asset_id}, caption}]`, `tags` = comma-joined string, `date` passthrough, `link` = `{link_type:"Web", url}` when the record has `url`/`link_url`; (b) extension keys (category, sub_category, dimensions, disabled) land verbatim in `data`; (c) each USED entity type yields an extension custom type: the Plan-2 shared base JSON **plus** the extension fields typed via the `deriveFields` conventions; (d) the DO-NOT-USE feed emits 0 documents + 1 diagnostic `{kind:"skipped-feed"}` (add the kind to `ir.ts`'s union — additive, like `dropped-widget`); (e) uid collisions dedupe enabled-over-disabled (reuse `productSlug` semantics: record `url` slug first, else title slug).

- [ ] **Step 2: Implement** `src/blux/catalog/entities.ts`:

```ts
export type EntityEmit = {
  documents: PlanDocument[];
  customTypes: PlanCustomType[];
  media: Media[]; // every record media (kind:"image"), for plan-asset upload
  diagnostics: Diagnostic[];
};
export function buildEntityEmit(
  feeds: Record<
    string,
    { name?: string; items?: unknown[]; fields?: unknown } | undefined
  >,
): EntityEmit;
```

Internals: per feed → `isSkippedFeed` guard (diagnostic) → `feedEntityType(name)` → records mapped as in the test contract. Base-field mapping lives in one `recordToDoc(record, type)`; extension detection = record keys minus the base set (`title body media items tags date url link_url disabled` handled explicitly — `disabled` IS an extension field but also drives dedup). Extension custom-type JSON: clone the Plan-2 base Main (inline the base JSON as a constant — it is frozen) + one field per extension key via a `FIELD_CONFIG`-style mapping (string→Text, boolean→Boolean, number→Number, array→Group{value:Text}). Media collection: record `media` uuid + `items[].media` uuids as `{kind:"image", assetId}` (the CLI resolves urls via the IR asset index / data-base like everything else). Uid dedup: `Map` keyed by uid, enabled-beats-disabled else first-seen. **Step 3: PASS → commit** `feat(blux-catalog): entity-document emitter (feeds → typed documents + extension types)`.

---

### Task 3: BluxCollection classify (maintenance)

**Files:** modify `src/blux/catalog/spec.ts`, `src/blux/catalog/classify.ts`; create `tests/blux/catalog/collection-classify.test.ts`.

- [ ] **Step 1: Spec type.** Add to `spec.ts` (+ union):

```ts
export type BluxCollectionSpec = CatalogBase & {
  slice: "BluxCollection";
  heading?: CatalogRichText;
  entityType: string; // mapped Prismic type the renderer queries
  feedIds: string[]; // original Blux feed ids (traceability)
  filterTag?: string; // tagFilter DSL expression
  sort?: string;
  limit?: number;
  mediaRatio?: string;
  layout: "grid" | "carousel";
  scrollLoadMore?: boolean;
};
```

- [ ] **Step 2: Failing tests** for a new `bandOrCollection(band, item, feeds, opts)` in `classify.ts`: (a) an item with `sources:["feed1"]` + `sourceConfig.filters.tag="metal"` and `feeds` naming feed1 "Products" → `{slice:"BluxCollection", entityType:"product", feedIds:["feed1"], filterTag:"metal", layout:"grid"}` and the band's own heading survives as `heading`; (b) `item.type==="slides"` → `layout:"carousel"`; (c) `sourceConfig.count: 8` → `limit: 8`; (d) a NON-feed item → falls through to `bandToCatalog(band, opts)` unchanged; (e) `sources:["__media"]` → NOT a collection (media-library galleries already materialize via the grid path) — falls through.

- [ ] **Step 3: Implement.** `bandOrCollection` reuses `isFeedBand` (import from `../grid/index.js` or `../grid/feed-grid.js`) and `feedEntityType`; heading via the existing `splitHeadingAndCells(band.root).heading`; `filterTag` from `sourceConfig?.filters?.tag` (string), `limit` from `sourceConfig?.count` (number), `sort` from `sourceConfig?.sort` (string) — defensive reads, omit when absent. `__media` first-source → fall through. **PASS → commit** `feat(blux-catalog): BluxCollection classify (feed bands → query-spec slice)`.

---

### Task 4: Emit + CLI wiring (maintenance)

**Files:** modify `src/blux/catalog/emit.ts`, `src/cli/commands/blux.ts`; create `tests/blux/catalog/collection-emit.test.ts`; update `tests/cli/blux-catalog-command.test.ts`.

- [ ] **Step 1: Failing emit test.** `catalogSpecToPlanSlice` on a BluxCollectionSpec → `{slice_type:"blux_collection", primary:{ heading?, background_*, collection_type, feed_ids:"feed1,feed2", filter_tag?, sort?, limit?, media_ratio?, layout, scroll_load_more?("on") }}` (snake_case, omit absent).
- [ ] **Step 2: Implement** the `BluxCollection` case in the emit switch. Also extend `buildCatalogPlan` with an optional `feeds` param: when present, run `buildEntityEmit(feeds)` and merge its `documents`/`customTypes`/`diagnostics` into the plan and its `media` into the asset walk (resolve like all other media).
- [ ] **Step 3: CLI.** In the `catalog` action: read `siteJson.content.pages[*].items` (the convert-path idiom) and use `bandOrCollection(band, pageItems?.[band.index], feeds, opts)` in place of the direct `bandToCatalog` call; pass `siteJson.feeds ?? {}` into `buildCatalogPlan`. Update the CLI test fixture: add a feed + a feed band to the minimal site.json/html; assert the written plan has a `blux_collection` slice, ≥1 entity document, and ≥1 entity custom type.
- [ ] **Step 4: Goldens.** Refresh the-pointe goldens (`-u`) — the-pointe home may have zero feed bands (report which). Capture must stay 46/46. Full targeted gate (`tests/blux/ tests/cli/` green, grid goldens byte-unchanged, typecheck 0). **Commit** `feat(blux-catalog): emit blux_collection + entity docs/types ride the catalog plan`.

---

### Task 5: Starter `blux_collection` slice (WORKTREE)

**Files (worktree):** create `src/lib/slices/BluxCollection/{model.json,index.svelte,BluxCollection.test.ts}` + generated `mocks.json`; create `src/lib/blux-catalog/tag-filter.ts` + `tag-filter.test.ts`.

- [ ] **Step 1: Port the tagFilter DSL.** `src/lib/blux-catalog/tag-filter.ts` — port the maintenance implementation verbatim (`||`/`&&` groups + singular/plural-insensitive `termMatchesTag`; JSDoc cites the source). Test: AND within group, OR across groups, plural-insensitive, empty-expr-matches-all (mirror the maintenance tests).
- [ ] **Step 2: Model.** `blux_collection` SharedSlice, container contract: primary = `heading`(StructuredText h2,h3), `background_image`(Image), `background_color`(Text), `collection_type`(Text), `feed_ids`(Text), `filter_tag`(Text), `sort`(Text), `limit`(Number), `media_ratio`(Text), `layout`(Select grid|carousel), `scroll_load_more`(Select off|on), `widget_kind`(Text), `widget_html`(Text). No `cells` group — content comes from documents. Regen types (worktree regen invocation, see conventions).
- [ ] **Step 3: Component.** `index.svelte`: props `{ slice, context }` where `context?.collections?: Record<string, EntityDoc[]>` and `EntityDoc = { uid: string; data: { title?: unknown; media?: unknown; body?: unknown; tags?: string; link?: unknown } }` (structural type in the component or `$lib/blux-catalog/collection.ts`). Derived: `docs = (context?.collections?.[collection_type] ?? [])` → filter via `tagFilter(filter_tag)(splitTags(doc.data.tags))` (`splitTags` = comma-split/trim) → sort (`sort === "date"` → by `data.date` desc; `"title"` → by title text asc; else source order) → slice to `limit`. Render: root `section.blux-collection` with `data-layout`/`data-media-ratio`/background (bandStyle pattern) + heading + a `.blux-collection__cards` container; each card = `article.blux-collection__card` with `PrismicImage` (if `isFilled.image(data.media)`), title via `PrismicRichText`, and — **card-link contract** — an `<a>` wrapper ONLY when `isFilled.link(data.link)` resolves to an external URL (`data.link.link_type === "Web"`); otherwise no link. Widget block as the other containers (`{@html}` + eslint justification comment). `{#each docs as doc (doc.uid)}`.
- [ ] **Step 4: Tests.** Component test: context with 3 docs (one tagged "metal", one "wood", one no-media external-link), slice `filter_tag:"metal"` + `limit` — assert filtered count, card renders title/img, the external-link card has an `<a href>`, the others have NO `<a>`; second test with no context → renders the empty container (no crash). Run file → PASS.
- [ ] **Step 5: Register.** Page choices (`customtypes/page/index.json` + regen — union check), `src/lib/slices/index.js` (import + `blux_collection` entry), extend `src/routes/blux-skeleton.test.ts` with a blux_collection slice (empty context renders nothing but doesn't crash — assert the section root exists via container query). **Commit** (worktree) `feat(blux): blux_collection query-spec slice + tagFilter port`.

---

### Task 6: Starter load-path collections fetch (WORKTREE)

**Files (worktree):** modify `src/routes/[[preview=preview]]/[uid]/+page.server.ts`, `src/routes/[[preview=preview]]/+page.server.ts`, both `+page.svelte`; create `src/lib/blux-catalog/collections-load.ts` + test.

- [ ] **Step 1: Shared helper (TDD).** `src/lib/blux-catalog/collections-load.ts`:

```ts
/** The collection types a page's slice zone queries: unique, ordered. */
export function collectionTypesOf(
  slices: {
    slice_type: string;
    primary?: { collection_type?: string | null };
  }[],
): string[];
/** Fetch each type via client.getAllByType, tolerating unknown types (a site
 * whose Prismic repo lacks an entity type gets an empty list, not a 500). */
export async function loadCollections(
  client: { getAllByType(type: string): Promise<unknown[]> },
  types: string[],
): Promise<Record<string, unknown[]>>;
```

Tests with a stub client: dedupes types, tolerates a rejecting `getAllByType` (→ `[]`), preserves keying.

- [ ] **Step 2: Wire the routes.** In both `+page.server.ts` load functions: after `getByUID`, `const collections = await loadCollections(client, collectionTypesOf(page.data.slices as never));` and return it; in both `+page.svelte`: `context={{ presentation: …, collections: data.collections }}`. (Check the exact existing context shape in the worktree and extend, don't replace.)
- [ ] **Step 3: Gate.** Worktree: `pnpm run check` (0 errors), `pnpm run lint` (clean), `pnpm exec vitest run --pool=threads` (all green). **Commit** (worktree) `feat(blux): load-path collections fetch → SliceZone context`.

---

### Task 7: Cross-repo proof + review

- [ ] **Step 1: Emit→render proof (worktree).** Extend `src/routes/blux-emit-breadth.test.ts` (or sibling): a resolved emit-shaped `blux_collection` slice + a `context.collections` fixture → the filtered cards render (exact emit field names: `collection_type`, `filter_tag`, `layout`). PASS.
- [ ] **Step 2: Full gates.** Maintenance: `pnpm exec vitest run tests/blux/ tests/cli/` + typecheck + build; background the full suite. Worktree: full suite + check + lint. Grid goldens byte-unchanged.
- [ ] **Step 3: Review.** 3-lens review workflow + adversarial verify (pattern of 4a/4b): (a) entity mapping fidelity vs spec §8 (base+extensions, skip-list, dedup); (b) collection classify/emit → starter render contract (field names, tagFilter parity maintenance↔starter, card-link contract external-only); (c) additivity + goldens. Fix confirmed findings; re-verify claim-by-claim (the 4a lesson).
- [ ] **Step 4: Memory.** Update `blux-catalog-pipeline-redesign` with 4c state.

## Definition of done

- Composition-shaped feeds emit typed entity documents + extension custom types + diagnostics (skip-list honored); feed bands emit `blux_collection` query-spec slices; the-pointe capture stays 46/46; both repos' suites green; the starter renders collections from load-time context with tagFilter parity and external-only card links.

## Not in this plan

Per-record detail pages + internal card links (deferred, spec Phase 7); composition full-site fidelity gate (4d); Prismic-side `scroll_load_more` behavior (data attr only — design layer); per-site Slice Machine sync of extension types (extension JSON ships in the plan; SM reconciliation is a 4d/migrate concern).
