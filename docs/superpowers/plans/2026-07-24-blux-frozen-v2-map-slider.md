# Blux Frozen Render v2 — Map Placeholder + Slider Pin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frozen render's dead Google-Map DOM with a clean, height-reserving placeholder (carrying the KML mid for a future production hydrator) and pin each hero `caslider` to slide 1, so the frozen the-pointe render is cleaner and re-freezes are deterministic.

**Architecture:** Two new string-in/string-out freeze transforms (`node-html-parser`, mirroring `bakeImages`/`tokenizeText`) wired into `freezeSite()` between settle and bake. No render-side code (the placeholder is inert HTML with an inline height). The committed the-pointe dev fixture is regenerated, and the fidelity gate's now-dead `maps.*` console allow-list is removed.

**Tech Stack:** TypeScript (ESM, Node), `node-html-parser`, vitest, `@playwright/test` (gate), SvelteKit.

**Repos / worktrees:**
- maintenance: `scratchpad/frozen-v2-maint` on branch `feat/blux-frozen-map-slider` (off main `24b3d62`)
- starter: `scratchpad/frozen-v2` on branch `feat/blux-frozen-v2` (off main `eabf65c`)

**Per-task gate:** run only the branch-owned test files / the whole freeze suite; format only files this branch touches.

---

## File Structure

**maintenance:**
- Create `src/blux/freeze/map-placeholder.ts` — `mapPlaceholder(html, exportHtml)`: strip a rendered map container's dead DOM, annotate it as a `.blux-frozen-map` placeholder with the KML `mid`.
- Create `src/blux/freeze/slider-pin.ts` — `pinSliders(html)`: force the first slide of each `.caslider` visible, hide the rest.
- Modify `src/blux/freeze/index.ts` — read the raw export, run both transforms in `freezeSite()`.
- Create `tests/blux/freeze/map-placeholder.test.ts`, `tests/blux/freeze/slider-pin.test.ts`.
- Modify `tests/blux/freeze/freeze-golden.test.ts` — assert the placeholder replaced the map.

**starter:**
- Modify `src/routes/dev/blux-frozen/the-pointe.{html,style.css,slots.json}` — regenerated from the new freeze.
- Modify `tests/gate/frozen-fidelity.spec.ts` — drop the `maps.*` allow-list entry.

---

## Task 1: Map placeholder transform (maintenance)

**Files:**
- Create: `src/blux/freeze/map-placeholder.ts`
- Test: `tests/blux/freeze/map-placeholder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/blux/freeze/map-placeholder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapPlaceholder } from "../../../src/blux/freeze/map-placeholder.js";

// The KML url as it appears in the Blux export (custom Google My Maps).
const EXPORT = `<a href="https://www.google.com/maps/d/u/0/kml?forcekmz=1&mid=1KwcmcAbc-9&other=x">map</a>`;

describe("mapPlaceholder", () => {
  it("turns a rendered map container into a clean placeholder with the KML mid", () => {
    const settled = `<div id="burbank_map" style="height:600px"><div class="gm-style"><img src="https://maps.googleapis.com/vt?x=1"></div></div>`;
    const out = mapPlaceholder(settled, EXPORT);
    expect(out).toContain('class="blux-frozen-map"');
    expect(out).toContain('data-kml-mid="1KwcmcAbc-9"');
    expect(out).toContain("height:600px"); // band box preserved
    expect(out).not.toContain("gm-style"); // dead DOM gone
    expect(out).not.toContain("maps.googleapis.com");
  });

  it("only converts a map container that actually rendered (has a .gm-style descendant)", () => {
    const settled = `<div id="sitemap"><a href="/s">links</a></div>`;
    const out = mapPlaceholder(settled, EXPORT);
    expect(out).toContain('<a href="/s">links</a>');
    expect(out).not.toContain("blux-frozen-map");
  });

  it("emits the placeholder with no data-kml-mid when the export has no mid", () => {
    const settled = `<div id="burbank_map" style="height:600px"><div class="gm-style">x</div></div>`;
    const out = mapPlaceholder(settled, "<html></html>");
    expect(out).toContain('class="blux-frozen-map"');
    expect(out).not.toContain("data-kml-mid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/blux/freeze/map-placeholder.test.ts`
Expected: FAIL — cannot find module `../../../src/blux/freeze/map-placeholder.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/blux/freeze/map-placeholder.ts`:

```ts
import { parse } from "node-html-parser";

// The frozen export's Google-Map band is a CUSTOM Google My Maps: a KmlLayer
// keyed by a My Maps id (`…/kml?…&mid=<ID>`) rendered at runtime. With the Blux
// JS stripped, the settled `gm-style` DOM Google left behind is dead (broken
// tiles + CSP console noise). Replace it with a clean, height-preserving
// placeholder that carries the `mid` so a future (production) hydrator can bring
// the real map back once a domain-scoped Maps key exists.

// The My Maps id, pulled from the export's KML url (deterministic, not from the
// settled DOM which no longer holds it).
const MID_RE = /[?&]mid=([\w-]+)/;

/**
 * Convert each rendered Google-Map container into a `.blux-frozen-map`
 * placeholder. A container is an element whose `id` names a map (`/map/i`) AND
 * that actually rendered (has a `.gm-style` descendant); its dead children are
 * removed and the KML `mid` (if found in `exportHtml`) is attached. Its existing
 * id + inline height are kept so the band's box is unchanged. `exportHtml` is the
 * raw Blux export string.
 */
export function mapPlaceholder(html: string, exportHtml: string): string {
  const root = parse(html);
  const mid = exportHtml.match(MID_RE)?.[1];

  for (const el of root.querySelectorAll("[id]")) {
    const id = el.getAttribute("id") ?? "";
    if (!/map/i.test(id)) continue;
    if (!el.querySelector(".gm-style")) continue; // only actually-rendered maps
    el.set_content(""); // drop the dead gm-style DOM
    el.classList.add("blux-frozen-map");
    if (mid) el.setAttribute("data-kml-mid", mid);
  }

  return root.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/blux/freeze/map-placeholder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/blux/freeze/map-placeholder.ts tests/blux/freeze/map-placeholder.test.ts
git commit -m "feat(blux): freeze map-placeholder transform (strip dead Google-Map DOM)"
```

---

## Task 2: Slider pin transform (maintenance)

**Files:**
- Create: `src/blux/freeze/slider-pin.ts`
- Test: `tests/blux/freeze/slider-pin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/blux/freeze/slider-pin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parse, HTMLElement } from "node-html-parser";
import { pinSliders } from "../../../src/blux/freeze/slider-pin.js";

const slidesOf = (out: string) =>
  parse(out)
    .querySelector(".caslider")!
    .childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);

describe("pinSliders", () => {
  it("forces the first slide visible and hides the siblings", () => {
    const html = `<div class="caslider"><div style="width:100%">a</div><div>b</div><div>c</div></div>`;
    const slides = slidesOf(pinSliders(html));
    expect(slides[0].getAttribute("style")).toContain("translateX(0%)");
    expect(slides[0].getAttribute("style")).not.toContain("display:none");
    expect(slides[1].getAttribute("style")).toContain("display:none");
    expect(slides[2].getAttribute("style")).toContain("display:none");
  });

  it("preserves the first slide's existing inline style", () => {
    const html = `<div class="caslider"><div style="width:100%">a</div><div>b</div></div>`;
    const slides = slidesOf(pinSliders(html));
    expect(slides[0].getAttribute("style")).toContain("width:100%");
  });

  it("is a no-op for a slider with no slides", () => {
    expect(pinSliders(`<div class="caslider"></div>`)).toContain('class="caslider"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/blux/freeze/slider-pin.test.ts`
Expected: FAIL — cannot find module `../../../src/blux/freeze/slider-pin.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/blux/freeze/slider-pin.ts`:

```ts
import { parse, HTMLElement } from "node-html-parser";

// Blux hero sliders (`.caslider`) animate through their slides at runtime. The
// settle snapshot freezes whichever slide happened to be active, which is not
// reproducible across re-freezes. Pin every slider to its first slide: force
// slide 1 visible + in position, hide the rest with `display:none`. Appended
// declarations win (inline-style last-wins), so the first slide's own styles are
// preserved and height is unchanged (slide 1 keeps the band's natural height).

/**
 * Make each `.caslider` show only its first slide, deterministically.
 */
export function pinSliders(html: string): string {
  const root = parse(html);

  for (const slider of root.querySelectorAll(".caslider")) {
    const slides = slider.childNodes.filter(
      (n): n is HTMLElement => n instanceof HTMLElement,
    );
    slides.forEach((slide, i) => {
      const style = slide.getAttribute("style") ?? "";
      const pin =
        i === 0
          ? "display:block;transform:translateX(0%);opacity:1"
          : "display:none";
      slide.setAttribute("style", style ? `${style};${pin}` : pin);
    });
  }

  return root.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/blux/freeze/slider-pin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/blux/freeze/slider-pin.ts tests/blux/freeze/slider-pin.test.ts
git commit -m "feat(blux): freeze slider-pin transform (pin caslider to slide 1)"
```

---

## Task 3: Wire both transforms into freezeSite + golden update (maintenance)

**Files:**
- Modify: `src/blux/freeze/index.ts`
- Modify: `tests/blux/freeze/freeze-golden.test.ts`

- [ ] **Step 1: Add the golden assertions (failing until wired)**

In `tests/blux/freeze/freeze-golden.test.ts`, immediately after the existing line
`expect(res.manifest.fontLinks.join(" ")).toContain("fonts.googleapis.com");` (currently line 27), add:

```ts
    // v2: the dead Google-Map DOM is replaced by a clean placeholder.
    expect(res.templateHtml).toContain("blux-frozen-map");
    expect(res.templateHtml).not.toContain("gm-style");
    expect(res.templateHtml).not.toContain("maps.googleapis.com");
```

- [ ] **Step 2: Run the golden to confirm it fails (only if the export is present)**

Run: `FREEZE_E2E=1 pnpm exec vitest run tests/blux/freeze/freeze-golden.test.ts`
Expected: FAIL on `expect(res.templateHtml).toContain("blux-frozen-map")` (transforms not wired yet).
Note: if `~/Desktop/thePointe/index.html` is absent the suite is skipped — proceed; Task 4 re-runs it end-to-end.

- [ ] **Step 3: Wire the transforms into `freezeSite()`**

In `src/blux/freeze/index.ts`:

a) Extend the `node:fs/promises` import (currently `import { mkdir, writeFile } from "node:fs/promises";`) to include `readFile`:

```ts
import { mkdir, writeFile, readFile } from "node:fs/promises";
```

b) Add imports for the two transforms, after the `import { finalize } from "./finalize.js";` line:

```ts
import { mapPlaceholder } from "./map-placeholder.js";
import { pinSliders } from "./slider-pin.js";
```

c) Replace the body of `freezeSite` up to the `bakeImages` call. Change:

```ts
  const settled = await settleExport(opts.indexHtmlPath);
  const baked = bakeImages(settled);
```

to:

```ts
  const settled = await settleExport(opts.indexHtmlPath);
  // v2 transforms run on the settled DOM before image/text tokenizing: swap the
  // dead Google-Map DOM for a placeholder (using the raw export for the KML mid)
  // and pin each hero slider to slide 1.
  const exportHtml = await readFile(opts.indexHtmlPath, "utf-8");
  const mapped = mapPlaceholder(settled, exportHtml);
  const pinned = pinSliders(mapped);
  const baked = bakeImages(pinned);
```

- [ ] **Step 4: Run the freeze unit suite (non-E2E)**

Run: `pnpm exec vitest run tests/blux/freeze`
Expected: PASS — all freeze unit tests (map-placeholder, slider-pin, bake-images, finalize, tokenize-text, types, frozen-page-type, migrate-frozen, freeze-cli); golden is skipped without `FREEZE_E2E`.

- [ ] **Step 5: Typecheck + lint the branch-owned files**

Run: `pnpm typecheck`
Expected: PASS.
Run: `pnpm exec prettier --write src/blux/freeze/map-placeholder.ts src/blux/freeze/slider-pin.ts src/blux/freeze/index.ts tests/blux/freeze/map-placeholder.test.ts tests/blux/freeze/slider-pin.test.ts tests/blux/freeze/freeze-golden.test.ts`
Then: `pnpm exec eslint src/blux/freeze/map-placeholder.ts src/blux/freeze/slider-pin.ts src/blux/freeze/index.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/blux/freeze/index.ts tests/blux/freeze/freeze-golden.test.ts
git commit -m "feat(blux): run map-placeholder + slider-pin in freezeSite; golden asserts placeholder"
```

---

## Task 4: Regenerate the-pointe fixture with the new freeze (maintenance → starter)

**Files:**
- Modify: `src/routes/dev/blux-frozen/the-pointe.html` (starter)
- Modify: `src/routes/dev/blux-frozen/the-pointe.style.css` (starter)
- Modify: `src/routes/dev/blux-frozen/the-pointe.slots.json` (starter)

- [ ] **Step 1: Run the golden end-to-end to prove the real freeze (maintenance worktree)**

Run: `FREEZE_E2E=1 pnpm exec vitest run tests/blux/freeze/freeze-golden.test.ts`
Expected: PASS — including the new `blux-frozen-map` / no-`gm-style` / no-`maps.googleapis.com` assertions and the height band (15100–15600). If `~/Desktop/thePointe` is absent, this step cannot run; STOP and ask the user to confirm the export path before regenerating the fixture.

- [ ] **Step 2: Build the CLI and regenerate the fixture (maintenance worktree)**

```bash
pnpm build
node dist/cli/bin.js blux freeze ~/Desktop/thePointe --site the-pointe --out /tmp/frozen-v2-regen
ls /tmp/frozen-v2-regen/frozen/the-pointe.html /tmp/frozen-v2-regen/frozen/the-pointe.style.css /tmp/frozen-v2-regen/the-pointe.slots.json
```

Expected: the three artifacts exist.

- [ ] **Step 3: Sanity-check the regenerated template**

```bash
grep -c "blux-frozen-map" /tmp/frozen-v2-regen/frozen/the-pointe.html   # >= 1
grep -c "gm-style" /tmp/frozen-v2-regen/frozen/the-pointe.html          # 0
grep -c "maps.googleapis.com" /tmp/frozen-v2-regen/frozen/the-pointe.html # 0
```

Expected: `blux-frozen-map` ≥ 1, `gm-style` = 0, `maps.googleapis.com` = 0.

- [ ] **Step 4: Copy the artifacts into the starter worktree**

```bash
STARTER=/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/frozen-v2
cp /tmp/frozen-v2-regen/frozen/the-pointe.html "$STARTER/src/routes/dev/blux-frozen/the-pointe.html"
cp /tmp/frozen-v2-regen/frozen/the-pointe.style.css "$STARTER/src/routes/dev/blux-frozen/the-pointe.style.css"
cp /tmp/frozen-v2-regen/the-pointe.slots.json "$STARTER/src/routes/dev/blux-frozen/the-pointe.slots.json"
```

- [ ] **Step 5: Commit the regenerated fixture (starter worktree)**

```bash
cd "$STARTER"
git add src/routes/dev/blux-frozen/the-pointe.html src/routes/dev/blux-frozen/the-pointe.style.css src/routes/dev/blux-frozen/the-pointe.slots.json
git commit -m "chore(blux): regenerate the-pointe frozen fixture (map placeholder + slide-1 pin)"
```

Note: these three files are in `.prettierignore` (layout-significant whitespace) — no formatting needed.

---

## Task 5: Trim the gate's dead maps allow-list + verify (starter)

**Files:**
- Modify: `tests/gate/frozen-fidelity.spec.ts`

- [ ] **Step 1: Remove the now-dead maps console allow-list**

In `tests/gate/frozen-fidelity.spec.ts`, delete the map entry from `ALLOWED_CONSOLE`. Change:

```ts
const ALLOWED_CONSOLE: RegExp[] = [
  /cloudfront\.net/i,
  /fonts\.g(oogleapis|static)\.com/i,
  // Google-Map tiles/cursors are CSP-blocked by design in the static-first v1
  // (the embed becomes static in v2); both maps hosts emit benign violations.
  /maps\.(googleapis|gstatic)\.com/i,
  /vimeo/i,
];
```

to:

```ts
const ALLOWED_CONSOLE: RegExp[] = [
  /cloudfront\.net/i,
  /fonts\.g(oogleapis|static)\.com/i,
  /vimeo/i,
];
```

- [ ] **Step 2: Run the fidelity gate**

Run: `REDDOOR_SMOKE_PORT=5261 pnpm exec playwright test tests/gate/frozen-fidelity.spec.ts`
Expected: PASS — height in 15000–15700 (the 600px placeholder preserves the map band), ≥56 baked backgrounds, no `⟦` tokens, and **zero** console errors (the map no longer emits CSP violations now that its dead DOM is gone).

- [ ] **Step 3: Run the full smoke + unit suites**

Run: `pnpm exec vitest run` and `REDDOOR_SMOKE_PORT=5262 pnpm run test:smoke`
Expected: all green.

- [ ] **Step 4: Lint the branch-owned file**

Run: `pnpm run lint`
Expected: PASS (prettier + eslint).

- [ ] **Step 5: Commit**

```bash
git add tests/gate/frozen-fidelity.spec.ts
git commit -m "test(blux): drop dead maps allow-list from frozen-fidelity gate"
```

---

## Acceptance

- maintenance freeze unit suite green (incl. new map-placeholder + slider-pin tests); golden green E2E with placeholder assertions.
- starter fidelity gate green with the regenerated fixture and trimmed allow-list; **no** console errors; height ~15211px.
- Frozen the-pointe render: map band is a clean, height-correct empty box; hero shows slide 1 deterministically; no CSP console noise.
- Two PRs (maintenance `feat/blux-frozen-map-slider`, starter `feat/blux-frozen-v2`), each CI-green, verified file-list + head SHA before squash-merge.

## Notes / follow-ups (out of scope)

- Production map hydration (`google.maps.Map` + `KmlLayer` via `src/lib/blux/maps-loader.ts`) reading `.blux-frozen-map[data-kml-mid]`, gated on a domain-scoped Maps key — deferred to the production-route work.
- Map detection is the-pointe-first (`id` matches `/map/i` + has a `.gm-style` descendant). Generalize to other Blux map-container conventions when the next frozen site needs it.
