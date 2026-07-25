# Blux Frozen — Production `[uid]`/home Route — Design

**Status:** approved (approach + Blux-scoping, 2026-07-24)
**Predecessors:** frozen render v1 ([2026-07-24-blux-frozen-page-design.md](2026-07-24-blux-frozen-page-design.md)) + v2 ([2026-07-24-blux-frozen-v2-map-slider-design.md](2026-07-24-blux-frozen-v2-map-slider-design.md)), both merged.

## Goal

Render a migrated Blux `frozen_page` document at its real site route (home `/` and
`/[uid]`) through the production `<FrozenPage>` — instead of the `/dev/blux-frozen`
fixture route — so a frozen site serves its pixel-faithful page live. Additive and
**fall-through by default**: any repo without a `frozen_page` doc + committed
template is completely unaffected.

## Hard scoping guarantee (Blux-only, inert elsewhere)

The frozen branch fires only when BOTH are true for a uid:
1. a committed per-uid template artifact exists in this repo, AND
2. a published `frozen_page` document exists for that uid in Prismic.

The starter template ships the artifact directory **empty**, and `frozen_page` (like
`catalog_page`) is never in the template's custom types — it is added only to a
migrated target repo. So a native `page` site or a `catalog_page` (Blux-catalog)
site has no artifact → the frozen branch is skipped with **no extra Prismic query**
and the existing `getPageDoc` → `SliceZone` path runs byte-for-byte as today. The
committed artifact is the cheap build-time gate; absence of it = normal behavior.

## Data facts (verified against the live published doc)

- Published `frozen_page:home` (the-pointe-burbank Prismic) `data` = `{ title, slots,
  meta_title, meta_description, meta_image }`. 188 slots (61 image + 127 text),
  image urls Prismic-hosted. Slots + SEO meta come from Prismic.
- **fontLinks are NOT in the doc** → they are a committed build artifact (the freeze
  emits them in its manifest; they are load-bearing for text metrics).
- The root `+layout.svelte` already renders bare when `page.data.frozen` (v1 hook).

## Artifact contract

Per frozen site, per uid, committed under `src/lib/blux-frozen/frozen/`:
- `<uid>.html` — the freeze template (tokenized).
- `<uid>.style.css` — the extracted `<style>` + reveal-force.
- `<uid>.fonts.json` — `string[]` of font stylesheet hrefs (freeze `fontLinks`).

The starter template ships `src/lib/blux-frozen/frozen/.gitkeep` only (dir empty). A
frozen site's repo commits its `<uid>.*` artifacts here (produced by the freeze;
wiring the freeze to emit this production set is a small follow-up — for the-pointe
the three files are the dev-route artifacts + fontLinks extracted from the manifest).

## Modules (starter, `src/lib/blux-frozen/`)

- **`frozen-page-doc.ts`**
  - `FROZEN_PAGE_TYPE = "frozen_page"`.
  - `getFrozenPageDoc(client, uid): Promise<FrozenPageDoc | null>` — `client.getByUID(
    FROZEN_PAGE_TYPE, uid)`, returns `null` on any miss (querying a type the repo
    lacks is a miss — same duck-typed `PageReadClient` shape as `page-doc.ts`).
  - `FrozenPageDoc` type: `{ uid, data: { title?, slots: FrozenDocSlot[], meta_title?,
    meta_description?, meta_image?: { url?: string } } }` (`FrozenDocSlot` from
    `from-doc.ts`).
- **`artifacts.ts`**
  - `frozenArtifacts: Record<string, FrozenArtifact>` built once via
    `import.meta.glob("./frozen/*.html" | "*.style.css" | "*.fonts.json", { eager })`,
    keyed by uid (filename stem). `FrozenArtifact = { template, styleCss, fontLinks }`.
  - Empty `{}` in the template repo (dir has only `.gitkeep`).
- **`load.ts`**
  - `buildFrozenData(artifact, doc)` — PURE: `{ frozen: true, template, styleCss,
    fontLinks, slots: frozenSlotsFromDoc(doc.data.slots), title, metaTitle,
    metaDescription, metaImageUrl }`. Fully unit-testable with fixtures.
  - `resolveFrozen(client, uid): Promise<ReturnType<buildFrozenData> | null>` —
    `const art = frozenArtifacts[uid]; if (!art) return null; const doc = await
    getFrozenPageDoc(client, uid); return doc ? buildFrozenData(art, doc) : null;`.
  - `frozenUids(): string[]` — `Object.keys(frozenArtifacts)` (for prerender entries).

## Route wiring

Both `src/routes/[[preview=preview]]/+page.server.ts` (home, uid `"home"`) and
`.../[uid]/+page.server.ts`:

```
const frozen = await resolveFrozen(client, uid);
if (frozen) return frozen;
// ...unchanged getPageDoc → SliceZone path
```

`[uid]/+page.server.ts` `entries()` also unions `frozenUids()` so migrated pages
prerender at their real routes. Home `entries()` unchanged (still `[{}]`).

Both `+page.svelte`:

```svelte
{#if data.frozen}
  <FrozenPage template={data.template} styleCss={data.styleCss}
    fontLinks={data.fontLinks} slots={data.slots} />
{:else}
  <SliceZone ... />  <!-- unchanged -->
{/if}
```

## Testing

- `frozen-page-doc.test.ts`: `getFrozenPageDoc` returns the doc (mock client) and
  `null` on a miss / a type the repo lacks.
- `load.test.ts`: `buildFrozenData` maps a fixture doc+artifact to the render shape
  (frozen:true, slots via mapper, meta passthrough); `resolveFrozen` returns `null`
  when the artifact is absent (the **fall-through guarantee**) and when the doc is
  absent.
- `artifacts.test.ts`: `frozenArtifacts` is `{}` in the template repo (proves no
  artifact is shipped → native/catalog sites are unaffected).
- Existing frozen-fidelity gate (dev route) unchanged — still proves `<FrozenPage>`
  renders the-pointe faithfully.

## Live verification (this PR)

A one-off check (not committed) reads the LIVE published `frozen_page:home`
(the-pointe-burbank) and runs `frozenSlotsFromDoc` over its real slots, proving the
getter + mapper handle production data. Full live end-to-end render is gated on a v2
re-migrate (the published doc is v1/127-text; the merged template is v2/95-text —
different keys) + deploy topology, which are **out of scope** here.

## Out of scope / deferred (Tucker-gated)

- v2 re-migrate of the-pointe-burbank so the published doc matches the v2 template.
- Deploy topology: which deployed repo serves the frozen the-pointe and which Prismic
  repo it reads (the `the-pointe` repo currently points at the `the-pointe` Prismic,
  not `the-pointe-burbank`).
- Freeze-side emit of the production artifact set (`<uid>.fonts.json`) + a
  provisioning step that drops artifacts into a frozen site's repo.
- Live map hydration (needs a domain-scoped Maps key).
