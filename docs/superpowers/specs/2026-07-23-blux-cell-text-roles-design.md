# Role-Aware Cell Text — Design Spec

**Date:** 2026-07-23
**Scope:** Blux catalog pipeline — grid/section/gallery/carousel cell text rendering
**Repos:** reddoor-maintenance (`feat/blux-catalog-emit`, emit) + reddoor-starter worktree (`feat/blux-catalog-pipeline`, render/model)

---

## Problem

Blux's prominent display text — secondary headings and subtitles carrying large
type roles (e.g. `text2` = 70px, `text5` = 15px eyebrow) — renders at the default
(small) body size in the catalog render. Content is complete; visual prominence
is lost.

### Root cause

A catalog cell's `body` is a Prismic **StructuredText (RichText)** field. RichText
JSON cannot carry a class attribute, so `<PrismicRichText>` renders each `<h4>`/`<p>`
with **no** per-block `txt-role-*` wrapper. The starter theme sizes text *only*
through `.txt-role-textN :is(h1..h6,p){font-size:var(--text-textN)}` — a block with
no role wrapper falls back to the default small size.

A single `body_role` field wraps the *entire* body blob in one size, but a cell body
is frequently multi-role (a big secondary heading + an eyebrow + paragraph text).
`cells.ts textOf` compounds this by discarding role information in three places when
it folds text into the body:

- **later headings:** `bodyParts.push(wrapped)` — role dropped
- **bodies:** collapsed to one blanket `bodyRole ??= t.role`
- **subtitles:** `bodyParts.push(\`<p>${t.text}</p>\`)` — role dropped entirely

The `blux_block` fallback slice does **not** have this problem: it stores its whole
roled node tree as one flat Text field of serialized JSON and renders it through
`BluxNode.svelte`, which honors `className` (role divs) + `{@html}`. `embed_html`
uses the same `{@html}` escape hatch at the cell level and already works.

## Goal

Each cell body block keeps its Blux display role, so a `text2`=70px secondary
heading renders at 70px — reusing the already-trusted `{@html}` render path.

## Non-goals

- **Title path is untouched.** `title` + `title_role` is a single-role heading and
  already renders correctly.
- **No inline-run role fidelity.** Role preservation is block-level; a roled `<span>`
  mid-paragraph is out of scope (no evidence Blux uses inline role changes for
  prominence).
- **No backward-compat shim.** This is a breaking model change. The pipeline is
  offline-deterministic and the-pointe-burbank was a test migration, so affected
  sites are re-migrated from scratch. No runtime migration of old `body` RichText docs.

## Approach (chosen: "B — baked roled HTML + `{@html}`")

Replace the cell's `body` RichText with a `body_html` **Text** field holding
pre-baked HTML in which each block is wrapped in its own `txt-role-*` div. Render it
via `{@html}` exactly as `embed_html` is rendered today.

Two approaches were rejected:

- **A — structured roled-segment group.** Cleanest data model in the abstract, but a
  cell's text would need a repeatable `body_segments` group, a **third** level of
  Prismic Group nesting inside `cells → subgrid`. Prismic does not reliably support
  three levels; the shape would be asymmetric (works for top-level cells, fails for
  subgrid cells). Rejected.
- **C — unify every cell's text onto the BlockNode payload tree.** Maximal
  architectural unification (one roled-node path across `blux_block` and cells), but
  it dissolves the semantic `title`/`body` split that BluxCell layout, gallery/
  carousel derivations, and entity-doc mapping rely on — larger blast radius for no
  extra fidelity over B. Rejected.

## Design

### 1. Data-model delta (the entire model change)

Per cell **and** subgrid item, in each container slice's `model.json`:

- **Remove** `body` (StructuredText). **Add** `body_html` (**Text**) — pre-baked HTML
  with per-block `txt-role-*` divs. Applies to all four slices
  (`BluxGrid`, `BluxSection`, `BluxGallery`, `BluxCarousel`).
- **Remove** `body_role` (Text) **where it exists — `BluxGrid` and `BluxSection` only**.
  `BluxGallery`/`BluxCarousel` cells never carried a role field, so there is nothing
  to remove there; `body_html`'s baked per-block roles are a strict improvement for
  them (previously their body text had no role at all).
- `title` (StructuredText) + `title_role` (Text, Grid/Section only): **unchanged**.
  Gallery/Carousel title staying role-less is a pre-existing state, out of scope here.

Regenerate `prismicio-types.d.ts`. Update `BluxCellData` (`src/lib/blux-catalog/cell.ts`):
`body: prismic.RichTextField` → `body_html: prismic.KeyTextField`; drop `body_role`.

### 2. Emit (`src/blux/catalog/cells.ts`)

Introduce a shared string helper mirroring the existing `roleWrap` (which wraps
`BlockNode`s):

```ts
/** Wrap a body-block html string in its Blux type-role div so the starter
 * theme's `.txt-role-textN :is(hN,p)` rule sizes it; roleless blocks pass
 * through untouched. Mirrors `roleWrap` for the string (body_html) path. */
function roleWrapHtml(role: string | undefined, inner: string): string {
  return role ? `<div class="txt-role-${role}">${inner}</div>` : inner;
}
```

`textOf` returns `{ title?, titleRole?, bodyHtml? }` (was `{ title?, body?, titleRole?, bodyRole? }`):

- later heading → `bodyParts.push(roleWrapHtml(t.role, \`<h${t.level}>${t.html}</h${t.level}>\`))`
- body → `bodyParts.push(roleWrapHtml(t.role, wrapBare(t.html)))`
- subtitle → `bodyParts.push(roleWrapHtml(t.role, \`<p>${t.text}</p>\`))`
- `bodyHtml = parts.length ? parts.join("\n") : undefined`

`buildCell` / `cellToItem` populate `body_html`; all `bodyRole` plumbing is removed.
The `CatalogCell` type (`spec.ts`) swaps `body?: CatalogRichText` + `bodyRole?: string`
for `bodyHtml?: string`.

**Side benefit:** the folded-heading-level-versus-StructuredText-heading-window
tension noted in the `textOf` doc-comment disappears — `body_html` is a plain string,
so a folded heading keeps its true level with no field-window clamping.

### 3. Render (`src/lib/blux-catalog/BluxCell.svelte`)

Replace the `{#if isFilled.richText(cell.body)}…<PrismicRichText field={cell.body} />…`
block with:

```svelte
{#if cell.body_html}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
  <div class="blux-cell__body">{@html cell.body_html}</div>
{/if}
```

Identical mechanism to the existing `embed_html` render. Subgrid cells render through
the same recursive `BluxCell` component, so they inherit the behavior for free. The
`title` render (with its `title_role` wrapper) is unchanged.

### 4. Emit fixtures + migrate

- **Render fixture** (`render-fixture.json` emitter): emit `body_html` (string) per
  cell instead of a `body` RichText value. The offline `/dev/blux-pointe` route feeds
  these straight into `BluxCell`.
- **`migrate-catalog`:** `body_html` is a plain string that flows straight through to
  the Prismic Text field — no HTML→RichText conversion for the body. Only `title`
  still converts (single heading). Net simplification.
- **Sanitization** stays where it is (emit stage, spec §6), consistent with
  `embed_html` and `widget_html`.

### 5. Testing

- **`cells.test.ts`** (maintenance): each roled body block is wrapped in its
  `txt-role-*` div; a roleless block passes through bare; document order preserved;
  a multi-role body (big heading + eyebrow + paragraph) produces three distinct
  role-wrapped blocks (not one blanket role). Update the existing body/`bodyRole`
  assertions to `body_html`.
- **`BluxCell.test.ts`** (starter): `body_html` renders via `{@html}` with role divs
  intact; empty `body_html` renders nothing.
- **`/dev/blux-pointe` gate** (`tests/gate/pointe-fidelity.spec.ts`): extend the
  structural spec — assert a known big-role cell body block computes to its role
  font-size (materially larger than the default body size), locking the regression
  that motivated this work.
- Regenerate `render-fixture.json` + the emit golden plan snapshot.

## Files touched

**Maintenance (`feat/blux-catalog-emit`):**
- `src/blux/catalog/cells.ts` — `roleWrapHtml`, `textOf`, `buildCell`/`cellToItem`
- `src/blux/catalog/spec.ts` — `CatalogCell` (`bodyHtml` replaces `body`+`bodyRole`)
- `src/blux/catalog/emit.ts` — cell → item emission (`body_html`), render-fixture emitter
- `src/blux/catalog/migrate-catalog.ts` — drop body HTML→RichText conversion
- `tests/blux/catalog/cells.test.ts`, `emit.test.ts` (+ golden snapshot)

**Starter (`feat/blux-catalog-pipeline`):**
- `src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/model.json` — `body`→`body_html`, drop `body_role`
- `src/lib/blux-catalog/cell.ts` — `BluxCellData`
- `prismicio-types.d.ts` — regenerated
- `src/lib/blux-catalog/BluxCell.svelte` — body render swap
- `tests/gate/pointe-fidelity.spec.ts`, `BluxCell.test.ts`
- `static`/fixture: regenerated `render-fixture.json`

## Success criteria

1. A `text2` (70px) secondary heading in a cell body renders at 70px in
   `/dev/blux-pointe`, not the default body size.
2. Multi-role cell bodies preserve each block's role independently.
3. Subgrid cells behave identically to top-level cells.
4. All existing catalog tests green; the gate's new font-size assertion passes;
   emit golden snapshot regenerated and reviewed.
