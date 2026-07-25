# Blux Frozen Render v2 — Map Placeholder + Slider Pin

**Status:** approved (2026-07-24)
**Predecessor:** [2026-07-24-blux-frozen-page-design.md](2026-07-24-blux-frozen-page-design.md) (v1, merged: starter #82, maintenance #462)

## Goal

Advance the frozen Blux render from static-first v1 toward the live experience by
handling the two dynamic bands v1 deliberately deferred: the **Google Map** and
the **hero slider**. (The third deferred item — reveal effects — is already fully
handled in v1 via `REVEAL_FORCE_CSS` + the settled `block-effects-applied` state,
so it is out of scope here.)

## Context

v1 freezes the export's JS-settled DOM, strips all `<script>`, bakes images, and
tokenizes editable leaves. Two bands survive that process in a degraded form:

1. **The map** (`<div id="burbank_map" style="height:600px">`) is a **custom
   Google My Maps** — a `KmlLayer` keyed by a My Maps id
   (`mid=1KwcmcCf1kd-8jN7lLt36kQ9lFjLab0bz`), loaded at runtime via
   `maps.googleapis.com/maps/api/js?key=…&callback=initMap`. Because a custom KML
   overlay cannot be reproduced by the Google Static Maps API, v1 leaves the
   settled `gm-style` DOM in place. With JS stripped and CSP blocking the map
   hosts, that DOM renders as a dead/broken map and emits CSP console violations
   (`maps.gstatic.com`, `maps.googleapis.com`) that the fidelity gate currently
   allow-lists.
2. **The hero slider** (`caslider`) is frozen on whichever slide was active when
   settle snapshotted it. That is non-deterministic across re-freezes.

**Decisions made during design (AskUserQuestion, 2026-07-24):**
- **Map = keep it interactive, but defer hydration to production.** This round
  builds only the freeze-side clean placeholder + config extraction. No hydrator,
  no API key work now — the map renders as a clean, height-reserving empty box,
  ready to hydrate in production once a domain-scoped Maps key is provisioned.
  (The export's embedded key is HTTP-referrer-restricted to the live Pointe
  domain, so it cannot be reused on previews/other domains.)
- **Slider = pin to slide 1 at freeze**, siblings hidden, for reproducibility.

## Non-goals (explicitly deferred)

- Live map hydration (`google.maps.Map` + `KmlLayer`) and the render-side
  hydrator. Deferred to the production-route work, when a domain-scoped key
  exists. The placeholder's `data-*` config is the forward-compatible contract
  the future hydrator will consume.
- Provisioning / configuring a Google Maps API key.
- Any change to the slider's runtime behavior (there is none — it stays static).

## Design

### 1. Map placeholder (freeze-side)

A new freeze transform, applied during finalize (after settle, before tokenize):

- **Detect** the map band: the settled DOM element that Blux initialized as the
  map. Primary signal is the container id/height from the export
  (`#burbank_map`, `height:600px`); generalize by also matching a descendant
  carrying Google's `.gm-style` marker so the band is found even if the id
  differs on other sites.
- **Extract config** from the export (deterministic, not from the settled DOM):
  regex the My Maps id out of the export's KML url
  (`google.com/maps/d/.../kml?...&mid=<ID>`); read the container's inline
  `height`. If no `mid` is found, the map is not KML-based — fall back to
  emitting the placeholder with only the height (still strips the dead DOM).
- **Transform the map container in place** (do not emit a new sibling): empty the
  container of all settled children, add the `blux-frozen-map` class and the
  `data-kml-mid` attribute, and keep its existing id + inline `height`. Reusing
  the same element preserves its exact position and box in the flow, so page
  height is unchanged:
  ```html
  <!-- before: <div id="burbank_map" style="height:600px"> …gm-style soup… </div> -->
  <div id="burbank_map" class="blux-frozen-map" data-kml-mid="1Kwcmc…" style="height:600px"></div>
  ```
  Emptying the container removes the dead `gm-style` descendants (tile `<img>`s
  pointing at `maps.googleapis.com`, control buttons, cursor assets) — which is
  what clears the CSP console noise. `.blux-frozen-map` is the stable class the
  future production hydrator will query.

**Module:** `src/blux/freeze/map-placeholder.ts` exporting
`mapPlaceholder(root: HTMLElement, exportHtml: string): void` (mutates the parsed
root in place, mirroring `bakeImages`/`tokenizeText`). `exportHtml` is the raw
export string the freeze already holds, used for the `mid` regex. Wired into
`freezeSite()` in `index.ts` between settle-snapshot and tokenize.

### 2. Slider pin (freeze-side)

A freeze transform that makes each `caslider` deterministic:

- For every `.caslider` (or its slide track), keep the **first** slide visible and
  set the remaining sibling slides to `display:none` via an inline style, so the
  settled snapshot always shows slide 1 regardless of settle timing.
- Emitted as inline styles on the slide elements (no runtime, consistent with the
  freeze's static philosophy). Does not touch the slider container's own
  dimensions, so band height is unaffected.

**Module:** `src/blux/freeze/slider-pin.ts` exporting
`pinSliders(root: HTMLElement): void`. Wired into `freezeSite()` alongside the map
transform.

### 3. Render + gate (starter)

- The placeholder needs **no new render code** — it is inert HTML with an inline
  height, rendered through the existing `<FrozenPage>` `{@html}` path.
- **Regenerate** the committed the-pointe dev fixture
  (`src/routes/dev/blux-frozen/the-pointe.{html,style.css,slots.json}`) from the
  updated freeze so the dev route and gate exercise the new output.
- **Fidelity gate** (`tests/gate/frozen-fidelity.spec.ts`): drop the now-dead
  `maps.(googleapis|gstatic).com` entry from `ALLOWED_CONSOLE` (the dead map DOM
  is gone, so those violations no longer fire — and if they somehow do, the gate
  should now catch them). Confirm the height band still holds (~15211px — the
  600px placeholder preserves the map band).

## Data flow

```
export index.html ──▶ settle (headless 1440) ──▶ settled DOM
settled DOM ──▶ mapPlaceholder(root, exportHtml)  # strip gm-style, emit placeholder w/ mid+height
           ──▶ pinSliders(root)                    # slide 1 visible, siblings display:none
           ──▶ bakeImages ──▶ tokenizeText ──▶ finalize ──▶ template + style + slots
migrate-frozen: unchanged (placeholder carries no tokens/assets)
render: <FrozenPage> {@html template}  # placeholder is inert reserved-height box
```

## Testing

- **maintenance unit** (`tests/blux/freeze/`):
  - `map-placeholder.test.ts`: given settled DOM with a `#burbank_map`/`gm-style`
    band + an export string containing the KML `mid`, asserts the band is replaced
    by `.blux-frozen-map` with `data-kml-mid` + preserved height, and no
    `maps.googleapis.com` / `gm-style` nodes remain. Fallback case: no `mid` →
    placeholder with height only.
  - `slider-pin.test.ts`: given a `caslider` with N slides, asserts slide 1 is
    visible and siblings carry `display:none`.
  - **golden** (`freeze-golden.test.ts`, FREEZE_E2E-gated): update the the-pointe
    expectations — placeholder present, zero `maps.googleapis.com` references,
    height band unchanged.
- **starter**:
  - Fidelity gate passes with the regenerated fixture and the trimmed
    `ALLOWED_CONSOLE` (no map hosts); height ~15000–15700; no `⟦` tokens; zero
    unexpected console errors.

## Rollout / acceptance

1. maintenance: build both transforms + tests on a worktree off main
   (`24b3d62`); PR.
2. Regenerate the-pointe fixture with the new freeze.
3. starter: commit the regenerated fixture + gate trim on a worktree off main
   (`eabf65c`); PR. Gate green.
4. Both PRs merged → the frozen the-pointe render shows a clean (empty,
   height-correct) map band + a deterministic slide-1 hero, with no CSP console
   noise. Live map hydration remains a production follow-up.
