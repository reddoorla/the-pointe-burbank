# Blux Catalog Plan 4d — the-pointe Fidelity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between "catalog plan emits" and "the-pointe renders faithfully": CDN→Prismic URL rewrite for serialized payload/widget strings, theme + nav/footer chrome emit, interactive map hydration in the starter, and an offline fidelity gate (text coverage vs the live Blux export) that runs without Prismic creds.

**Architecture:** Maintenance side stays pure-and-composable: a real IR asset index wired into the catalog CLI action, a pure `rewriteDocUrls` module invoked by a new two-phase `migrate-catalog` action (assets-first `runMigration` call → rewrite → docs call; the frozen `run-migration.ts` is only imported), a `chrome.ts` builder (nav reuses `buildSiteConfig`, footer gets rich columns), and a `resolveFixture` module that resolves plan markers offline into Prismic-hydrated document shapes. Starter side consumes: a `/dev/blux-pointe` gate route renders the committed fixture through the production SliceZone wiring with theme + chrome, and a `BluxWidget` component upgrades `widget_kind:"map"` HTML into a live Google map via the existing `maps-loader.ts`. The gate = Playwright drives the route, dumps rendered HTML, and maintenance's existing `validateCoverage` scores it against the export.

**Tech Stack:** TypeScript, vitest, SvelteKit 2/Svelte 5 runes, Playwright, `@prismicio/svelte` SliceZone, Google Maps JS (`VITE_GOOGLE_MAPS_KEY`, KML layers).

---

## Repos, branches, constraints (READ FIRST)

- **reddoor-maintenance**: `/Users/tuckerlemos/Documents/GitHub/reddoor-maintenance`, branch `feat/blux-catalog-emit`.
- **reddoor-starter**: work ONLY in the worktree `/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/starter-4c`, branch `feat/blux-catalog-pipeline`. NEVER touch `/Users/tuckerlemos/Documents/GitHub/reddoor-starter` (another session's checkout).
- **Frozen (import-only, never modify):** `src/blux/grid/*`, `src/blux/emit/*` (incl. `run-migration.ts`, `resolve-doc.ts`, `theme.ts`, `site-config.ts`, `rewrite-manifest.ts`), `src/blux/products.ts`. Grid-classify goldens must stay byte-unchanged.
- **Fleet exports** on `~/Desktop` (e.g. `thePointe`) are READ-ONLY; CLI output goes to `--out` dirs under the session scratchpad.
- Never read/print `.env` values. Live Prismic migrate remains creds-gated (`PRISMIC_REPOSITORY_NAME`/`PRISMIC_WRITE_TOKEN` names only) — nothing in this plan needs creds; the `migrate-catalog` action is built but only smoke-tested credless.
- Maintenance tests: `pnpm exec vitest run tests/blux/ tests/cli/` (full `pnpm test` exceeds tool timeouts). Starter tests: `pnpm exec vitest run <paths> --pool=threads`. Starter lint checks `.md` — run `pnpm exec prettier --write` on this plan file itself.
- Commit style: `feat(blux-catalog): …` / `feat(blux): …`, each ending `Co-Authored-By:` line per session convention.

## Key facts discovered in research (trust these; verify only if code moved)

- `runMigration(plan, log?)` (`src/blux/emit/run-migration.ts:148`) returns `MigrationResult` with `assetUrlByCdn: Map<string,string>` (plan-asset CDN url → Prismic-servable url), fully populated for every uploaded/reused asset. Assets upload BEFORE documents post, but the map is only _returned_ after docs post — hence the two-phase design.
- Documents reference structured media via `{__asset_id: uuid}` + rich text via `{__richtext_html: html}` markers (`src/blux/emit/plan.ts:4-6`), resolved at migrate time by `resolveDocData` (`src/blux/emit/resolve-doc.ts:7`). Markers are the SAFE path. The UNSAFE strings that keep raw CDN urls into Prismic: BluxBlock `payload` (image leaves `{image:{url:"<cdn>"}}` from `cells.ts:231-241`, `<video src>` leaves), BluxBlock wrapper `background-image:url(...)` (`emit.ts:243-245`), `embed_html`, `widget_html`.
- Plan-asset url and payload-leaf url are byte-identical exactly when the media has a CDN `base` (`mediaUrl` at `src/blux/emit/grid-plan.ts:20`, `mediaCdnUrl` in `cells.ts`) — the rewrite keys on that. All 4175 real fleet assets are CloudFront-based.
- The catalog CLI action (`src/cli/commands/blux.ts`, `action === "catalog"`) currently passes an EMPTY asset index: `buildCatalogPlan(pages, { assets: [], diagnostics }, feeds)` — no-base media emit `unresolved-asset` diagnostics and never upload. `assembleIR({ siteJson, htmls })` (`src/blux/assemble.ts:7`) produces `SiteIR` with `.assets: AssetRef[]` (`{id, sourceUrl, name, mime, alt}`) and `.theme: ThemeIR`.
- Theme: `emitThemeCss/emitRolesCss/emitButtonsCss(theme: ThemeIR)` (`src/blux/emit/theme.ts:6/49/79`); the old emit action concatenates all three into `theme.css` (`blux.ts:115-121`). Starter consumes it via `src/blux-theme.css` (placeholder imported by `app.css` line 8).
- Chrome: `buildSiteConfig(siteJson, resolveLogo, resolveSocialHref?)` (`src/blux/emit/site-config.ts:179`) → `{nav:{logo?,items:NavItem[]}, footer:{socials,text?}}`; `NavItem = {label, href, children?}`. Its footer is too thin for the-pointe (live footer = leasing-contact columns with tel numbers); `siteJson.footer[0].items[].items[]` carries the columns.
- Starter chrome: `Nav.svelte` already takes `navLinks?: {text, href}[]`; `Footer.svelte` is 7 hardcoded lines; `+layout.server.ts` fetches nothing. No settings/navigation custom types — 4d stays render-side (files, not Prismic docs), matching the proven old-path pattern.
- Starter map seam: `src/lib/blux/maps-loader.ts` exports idempotent `loadMapsApi(key)`; `src/lib/blux/LocationMap.svelte` shows the `$effect` + `bind:this` + `KmlLayer` + `data-map-placeholder` (no key) pattern to mirror. `MapConfig` (maintenance `src/blux/grid/extract-map.ts:28`): `{mountId, mid, layers, toggles, styles, center?, zoom?, height?, defaultToggle?}`.
- Gate pattern: `/dev/blux-page` + `fixtures.ts` renders production SliceZone wiring offline; `tests/a11y/fixtures.spec.ts` drives it via Playwright webServer. Gap: it passes no `collections` context.
- Parity metric: `validateCoverage(exportHtml, renderedHtml)` (`src/blux/validate.ts:90`) → `{total, covered, missing[], coveragePct}` over normalized visible text runs.
- the-pointe: export dir `~/Desktop/thePointe`; live URL `www.thepointeburbank.com`; `feeds` is EMPTY (`{}`) — the gate exercises grids/maps/blocks/chrome, not collections (collections proven on composition in 4c). Its map = the shared Burbank-portfolio widget (`mountId: burbank_map`), 4 KML layers, 3 toggle chips ("Studio And Offices", "Retail And Dining", "Hotel And Services"), center carries Google's default `{lat:-34.397,lng:150.644}` verbatim from source — viewport comes from KML `preserveViewport:false` layers, DO NOT "fix" the center.

## File structure

**reddoor-maintenance (new files all under `src/blux/catalog/` — the emit/ dir is frozen):**

- `src/blux/catalog/rewrite-doc-urls.ts` — pure CDN→Prismic string rewriter over plan documents.
- `src/blux/catalog/chrome.ts` — `buildChrome`: nav (via `buildSiteConfig`) + rich footer columns.
- `src/blux/catalog/resolve-fixture.ts` — offline marker resolver: plan → Prismic-hydrated doc shapes.
- Modify: `src/cli/commands/blux.ts` — catalog action gains real IR index + `theme.css` + `site-config.json` + `render-fixture.json` outputs; new `migrate-catalog` action.
- Tests: `tests/blux/catalog/rewrite-doc-urls.test.ts`, `chrome.test.ts`, `resolve-fixture.test.ts`; extend `tests/cli/blux-catalog-command.test.ts`.

**reddoor-starter worktree:**

- `src/lib/blux-catalog/BluxWidget.svelte` (+ `BluxWidget.test.ts`) — widget renderer; hydrates `widget_kind:"map"`.
- Modify: `src/lib/slices/{BluxSection,BluxGrid,BluxBlock,BluxCollection,BluxGallery,BluxCarousel}/index.svelte` — swap the inline `{@html widget_html}` block for `<BluxWidget …>` (identical DOM when not a map). Only the slices that HAVE the widget block today; check each with `grep -l widget_html src/lib/slices/*/index.svelte`.
- Modify: `src/lib/components/Footer.svelte` — optional `columns`/`copyright` props, hardcoded default preserved.
- `src/routes/dev/blux-pointe/{+page.svelte,+page.ts,fixture.json,site-config.json,theme.css}` — the gate route (fixture files generated by the maintenance CLI, committed).
- `tests/gate/pointe-fidelity.spec.ts` — Playwright gate: renders, asserts, dumps HTML artifact.
- Maintenance closes the loop: `tests/blux/catalog/pointe-coverage.test.ts` — coverage vs export over the dumped artifact (skips when artifact absent).

---

### Task 1: Wire the real IR asset index into the catalog action (maintenance)

**Files:**

- Modify: `src/cli/commands/blux.ts` (catalog action, ~line 451-540)
- Test: `tests/cli/blux-catalog-command.test.ts`

- [ ] **Step 1: Write the failing test.** The existing CLI test fixture (find the fixture builder in `tests/cli/blux-catalog-command.test.ts` — it writes a temp export dir with `site.json` + `index.html`) gets a media WITHOUT a CDN base but WITH a site.json `media` record carrying a source url, e.g. add to the fixture site.json:

```ts
// in the fixture siteJson:
media: {
  "aaaa-bbbb": { name: "loose.png", src: "https://example.com/loose.png" },
},
```

and to the fixture page html a bare-id image the parser captures without `data-base`. Then assert:

```ts
it("resolves no-base media through the IR asset index (sourceUrl fallback)", async () => {
  const { plan } =
    await runCatalogFixture(/* fixture with the no-base media */);
  const asset = plan.assets.find((a: { id: string }) => a.id === "aaaa-bbbb");
  expect(asset?.url).toBe("https://example.com/loose.png");
  expect(
    plan.diagnostics.filter(
      (d: { kind: string }) => d.kind === "unresolved-asset",
    ),
  ).toHaveLength(0);
});
```

Adapt the fixture helper names to what the test file actually uses — read it first; the site.json `media` record shape must match what `parseBluxSite` (`src/blux/parse.ts:74`) reads (check how `AssetRef.sourceUrl` gets populated — grep `sourceUrl` in `src/blux/parse.ts`/`normalize.ts`).

- [ ] **Step 2: Run it — expect FAIL** (asset missing + an `unresolved-asset` diagnostic): `pnpm exec vitest run tests/cli/blux-catalog-command.test.ts`

- [ ] **Step 3: Implement.** In the catalog action, collect page htmls while looping (they are already read one by one), then build the IR and pass its assets:

```ts
// before the page loop:
const htmls: string[] = [];
// inside the loop, after `html` is read successfully:
htmls.push(html);
// after the loop, replacing the empty-index call:
const ir = assembleIR({ siteJson, htmls });
const plan = buildCatalogPlan(
  pages,
  {
    assets: ir.assets.map((a) => ({
      id: a.id,
      url: a.sourceUrl ?? "",
      alt: a.alt,
      sourceUrl: a.sourceUrl,
    })),
    diagnostics: [...classifyDiagnostics, ...ir.diagnostics],
  },
  feeds,
);
```

Import `assembleIR` from `../../blux/assemble.js`. Check `SiteIR.diagnostics` exists (grep `diagnostics` in `src/blux/ir.ts` SiteIR type) — if IR diagnostics overlap classify ones or the field is named differently, merge accordingly; do NOT drop either set. The `CatalogAssetIndex.assets[].url` field is unused by `buildCatalogPlan` (it derives urls via `mediaUrl`) but the type requires it.

- [ ] **Step 4: Run the test — PASS**, then the full catalog+CLI suites: `pnpm exec vitest run tests/blux/ tests/cli/` — all green, snapshots (plan-golden) may legitimately change ONLY by previously-unresolved assets now appearing / `unresolved-asset` diagnostics disappearing. Inspect any snapshot diff line by line before accepting.

- [ ] **Step 5: Real-export probe.** Run the CLI over `~/Desktop/thePointe` and one more export, `--out` to scratchpad; compare `unresolved-asset` diagnostic counts before/after (before = `git stash` not needed — count from the 4c-era outputs if still in scratchpad, else re-run at HEAD~1 via `git worktree add`). Report counts in the commit message body.

- [ ] **Step 6: Commit.**

```bash
git add src/cli/commands/blux.ts tests/cli/blux-catalog-command.test.ts
git commit -m "feat(blux-catalog): wire the real IR asset index into the catalog action"
```

---

### Task 2: `rewriteDocUrls` — pure CDN→Prismic rewriter (maintenance)

**Files:**

- Create: `src/blux/catalog/rewrite-doc-urls.ts`
- Test: `tests/blux/catalog/rewrite-doc-urls.test.ts`

- [ ] **Step 1: Write the failing tests:**

```ts
import { describe, it, expect } from "vitest";
import { rewriteDocUrls } from "../../../src/blux/catalog/rewrite-doc-urls.js";

const CDN = "https://d3syaxnfm3oj0e.cloudfront.net/img/abc-123.jpg";
const PRISMIC = "https://images.prismic.io/repo/xyz.jpg";
const map = new Map([[CDN, PRISMIC]]);

describe("rewriteDocUrls", () => {
  it("rewrites CDN urls inside serialized payload strings", () => {
    const docs = [
      {
        type: "page",
        uid: "home",
        data: {
          slices: [
            {
              slice_type: "blux_block",
              primary: {
                payload: JSON.stringify({ image: { url: CDN, alt: "" } }),
              },
            },
          ],
        },
      },
    ];
    const r = rewriteDocUrls(docs, map);
    expect(JSON.stringify(r.documents)).toContain(PRISMIC);
    expect(JSON.stringify(r.documents)).not.toContain(CDN);
    expect(r.rewritten).toBe(1);
  });

  it("rewrites widget_html / embed_html / background-image strings", () => {
    const docs = [
      {
        type: "page",
        uid: "home",
        data: {
          slices: [
            {
              slice_type: "blux_section",
              primary: {
                widget_html: `<div class="blux-map"><img src="${CDN}"></div>`,
                background_html: `background-image:url(${CDN})`,
              },
            },
          ],
        },
      },
    ];
    const r = rewriteDocUrls(docs, map);
    const s = JSON.stringify(r.documents);
    expect(s).not.toContain(CDN);
    expect(r.rewritten).toBe(2);
  });

  it("does not touch markers, non-string values, or unrelated strings; input not mutated", () => {
    const docs = [
      {
        type: "page",
        uid: "home",
        data: {
          title: { __richtext_html: "<h1>x</h1>" },
          media: { __asset_id: "abc-123" },
          n: 4,
        },
      },
    ];
    const before = JSON.stringify(docs);
    const r = rewriteDocUrls(docs, map);
    expect(JSON.stringify(r.documents)).toBe(before);
    expect(JSON.stringify(docs)).toBe(before);
    expect(r.rewritten).toBe(0);
  });

  it("reports surviving cloudfront urls as unmatched (never silent)", () => {
    const other = "https://d3syaxnfm3oj0e.cloudfront.net/img/UNKNOWN.jpg";
    const docs = [
      { type: "page", uid: "home", data: { s: `<img src="${other}">` } },
    ];
    const r = rewriteDocUrls(docs, map);
    expect(r.unmatched).toEqual([other]);
  });
});
```

- [ ] **Step 2: Run — FAIL** (module missing): `pnpm exec vitest run tests/blux/catalog/rewrite-doc-urls.test.ts`

- [ ] **Step 3: Implement:**

```ts
import type { PlanDocument } from "../emit/plan.js";

export type RewriteResult = {
  documents: PlanDocument[];
  /** Total url occurrences swapped. */
  rewritten: number;
  /** CDN-looking urls that survived the swap — surface these, never silent. */
  unmatched: string[];
};

const CDN_URL_RE = /https?:\/\/[a-z0-9.-]*cloudfront\.net\/[^\s"'\\)]+/g;

/** Swap every occurrence of a plan-asset CDN url for its uploaded Prismic url
 * inside EVERY string value of the documents (serialized BluxBlock payloads,
 * widget_html, embed_html, background wrappers — the surfaces resolveDocData
 * does not touch). Pure: returns a deep copy; marker objects pass through
 * untouched because they hold no CDN urls. */
export function rewriteDocUrls(
  documents: PlanDocument[],
  urlByCdn: Map<string, string>,
): RewriteResult {
  let rewritten = 0;
  const unmatched = new Set<string>();
  const swapString = (s: string): string => {
    let out = s;
    for (const [cdn, prismic] of urlByCdn) {
      if (!out.includes(cdn)) continue;
      rewritten += out.split(cdn).length - 1;
      out = out.split(cdn).join(prismic);
    }
    for (const m of out.matchAll(CDN_URL_RE)) unmatched.add(m[0]);
    return out;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return swapString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, walk(x)]),
      );
    return v;
  };
  return {
    documents: documents.map((d) => walk(d) as PlanDocument),
    rewritten,
    unmatched: [...unmatched],
  };
}
```

Check `PlanDocument` is exported from `src/blux/emit/plan.ts` (import-only is fine); if the type import path differs, follow the existing import in `src/blux/catalog/emit.ts`.

- [ ] **Step 4: Run — PASS.** Then typecheck: `pnpm run typecheck`.

- [ ] **Step 5: Commit.**

```bash
git add src/blux/catalog/rewrite-doc-urls.ts tests/blux/catalog/rewrite-doc-urls.test.ts
git commit -m "feat(blux-catalog): pure CDN-to-Prismic url rewriter for plan documents"
```

---

### Task 3: Two-phase `migrate-catalog` CLI action (maintenance)

**Files:**

- Modify: `src/cli/commands/blux.ts` (new action; mirror the existing `migrate` action's structure at ~line 155-190)
- Test: `tests/cli/blux-catalog-command.test.ts`

The frozen `runMigration` posts documents before returning `assetUrlByCdn`, so a single call cannot rewrite first. Two calls can: phase 1 uploads assets with `documents: []`, returning the complete map; the rewrite runs; phase 2 posts everything (assets all hit the "reused" branch).

- [ ] **Step 1: Failing test** — credless smoke only (live migrate is creds-gated). Assert the action exists, reads the plan, and fails gracefully without creds:

```ts
it("migrate-catalog: reads the plan and reports missing creds without throwing", async () => {
  // write a minimal migration-plan.json into a temp out dir first (reuse the
  // catalog fixture run from earlier tests)
  const r = await runBluxCommand(["migrate-catalog", outDir]);
  expect(r.code).not.toBe(0);
  expect(r.output.toLowerCase()).toMatch(/cred|prismic_repository_name|token/);
});
```

Mirror how the existing `migrate` action reports missing creds (read `readCreds` usage in `run-migration.ts` — it throws/returns a message; the CLI catches). Match that behavior.

- [ ] **Step 2: Run — FAIL** (unknown action).

- [ ] **Step 3: Implement** in `blux.ts`:

```ts
if (action === "migrate-catalog") {
  if (!dir)
    return {
      output: "blux migrate-catalog needs the catalog --out dir.",
      code: 1,
    };
  let plan: MigrationPlan;
  try {
    plan = JSON.parse(
      await readFile(join(dir, "migration-plan.json"), "utf-8"),
    );
  } catch (err) {
    return {
      output: `could not read migration-plan.json in ${dir}: ${(err as Error).message}`,
      code: 1,
    };
  }
  const log = (line: string) => lines.push(line);
  const lines: string[] = [];
  try {
    if (plan.customTypes.length) await pushCustomTypes(plan.customTypes);
    // Phase 1: assets only — populates Prismic and returns the complete url map.
    const assetsPass = await runMigration({ ...plan, documents: [] }, log);
    // Rewrite the serialized-string surfaces resolveDocData never touches.
    const r = rewriteDocUrls(plan.documents, assetsPass.assetUrlByCdn);
    if (r.unmatched.length)
      lines.push(
        `WARNING: ${r.unmatched.length} CDN url(s) survived the rewrite: ${r.unmatched.slice(0, 5).join(", ")}`,
      );
    // Phase 2: documents (assets re-listed and reused, not re-uploaded).
    const docsPass = await runMigration(
      { ...plan, documents: r.documents },
      log,
    );
    return {
      output:
        lines.join("\n") +
        `\nmigrate-catalog: assets ${assetsPass.assetsUploaded} uploaded/${assetsPass.assetsReused} reused; ` +
        `urls rewritten ${r.rewritten} (${r.unmatched.length} unmatched); ` +
        `docs ${docsPass.docsCreated} created/${docsPass.docsUpdated} updated`,
      code: r.unmatched.length ? 1 : 0,
    };
  } catch (err) {
    return {
      output:
        lines.join("\n") +
        `\nmigrate-catalog failed: ${(err as Error).message}`,
      code: 1,
    };
  }
}
```

Adapt: `MigrationPlan` import already exists in the file; `pushCustomTypes`/`runMigration` are imported at line ~158 for the old action — hoist/reuse. Confirm `runMigration` accepts `documents: []` (read its doc loop — an empty array is a no-op loop). Verify phase-2 asset reuse is by-filename (`listAssetsByFilename`) so re-listing is cheap.

- [ ] **Step 4: Run tests — PASS**; typecheck clean.

- [ ] **Step 5: Commit.**

```bash
git add src/cli/commands/blux.ts tests/cli/blux-catalog-command.test.ts
git commit -m "feat(blux-catalog): two-phase migrate-catalog action — upload, rewrite CDN urls, then post docs"
```

---

### Task 4: Chrome + theme emit from the catalog action (maintenance)

**Files:**

- Create: `src/blux/catalog/chrome.ts`
- Modify: `src/cli/commands/blux.ts` (catalog action outputs)
- Test: `tests/blux/catalog/chrome.test.ts`, extend `tests/cli/blux-catalog-command.test.ts`

- [ ] **Step 1: Failing tests for `buildChrome`.** Model the-pointe's real shapes (from `~/Desktop/thePointe/site.json`: `navigation[0].items[]` = `{text, link, title, media?, items?}`, `footer[0].items[].items[]` = columns):

```ts
import { describe, it, expect } from "vitest";
import { buildChrome } from "../../../src/blux/catalog/chrome.js";

const siteJson = {
  navigation: [
    {
      items: [
        { title: "logo", media: { media: "uuid-logo", "max-width": "200px" } },
        { text: "Availability", link: "/availability" },
        { text: "Gallery", link: "/gallery" },
      ],
    },
  ],
  footer: [
    {
      items: [
        {
          items: [
            { title: "Todd Doney" },
            { text: "213.613.3330", link: "tel:2136133330" },
            { text: "Todd.Doney@cbre.com", link: "mailto:Todd.Doney@cbre.com" },
          ],
        },
        { items: [{ title: "© The Pointe" }] },
      ],
    },
  ],
};

describe("buildChrome", () => {
  it("nav rides buildSiteConfig; footer keeps full columns", () => {
    const c = buildChrome(siteJson, (uuid) =>
      uuid === "uuid-logo" ? "https://cdn/logo.png" : null,
    );
    expect(c.nav.items.map((i) => i.label)).toEqual([
      "Availability",
      "Gallery",
    ]);
    expect(c.nav.logo?.url).toBe("https://cdn/logo.png");
    expect(c.footer.columns).toHaveLength(2);
    expect(c.footer.columns[0].items).toEqual([
      { text: "Todd Doney", title: true },
      { text: "213.613.3330", href: "tel:2136133330" },
      { text: "Todd.Doney@cbre.com", href: "mailto:Todd.Doney@cbre.com" },
    ]);
  });

  it("tolerates missing navigation/footer arrays", () => {
    const c = buildChrome({}, () => null);
    expect(c.nav.items).toEqual([]);
    expect(c.footer.columns).toEqual([]);
  });
});
```

Before finalizing the fixture, print the REAL shapes: `node -e 'const s=require("/Users/tuckerlemos/Desktop/thePointe/site.json"); console.log(JSON.stringify(s.navigation,null,1).slice(0,2000)); console.log(JSON.stringify(s.footer,null,1).slice(0,2000))'` and align field names exactly (`text` vs `title`, `link` shape — a `link` may be an object or string; handle both).

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `chrome.ts`:**

```ts
import { buildSiteConfig, type SiteConfig } from "../emit/site-config.js";

export type ChromeFooterItem = { text: string; href?: string; title?: boolean };
export type ChromeConfig = {
  nav: SiteConfig["nav"];
  footer: { columns: { items: ChromeFooterItem[] }[] };
};

const asHref = (link: unknown): string | undefined => {
  if (typeof link === "string" && link.trim()) return link.trim();
  if (
    link &&
    typeof link === "object" &&
    typeof (link as { url?: unknown }).url === "string"
  )
    return (link as { url: string }).url;
  return undefined;
};

/** Site chrome for the catalog path. Nav reuses the proven buildSiteConfig
 * extraction verbatim; the footer keeps FULL columns (the-pointe's leasing
 * contacts with tel/mailto links) instead of site-config's socials+text
 * reduction — the emit/site-config module is frozen, so the richer footer
 * lives here. */
export function buildChrome(
  siteJson: unknown,
  resolveLogo: (uuid: string) => string | null,
): ChromeConfig {
  const nav = buildSiteConfig(siteJson, resolveLogo).nav;
  const footerRoot = (siteJson as { footer?: { items?: unknown[] }[] })
    .footer?.[0];
  const columns = (footerRoot?.items ?? []).flatMap((col) => {
    const items = ((col as { items?: unknown[] }).items ?? []).flatMap((it) => {
      const o = it as { text?: unknown; title?: unknown; link?: unknown };
      const text =
        typeof o.text === "string" && o.text.trim() ? o.text.trim() : undefined;
      const title =
        typeof o.title === "string" && o.title.trim()
          ? o.title.trim()
          : undefined;
      if (title) return [{ text: title, title: true } as ChromeFooterItem];
      if (!text) return [];
      const href = asHref(o.link);
      return [href ? { text, href } : { text }];
    });
    return items.length ? [{ items }] : [];
  });
  return { nav, footer: { columns } };
}
```

Verify `buildSiteConfig`'s exact export + `SiteConfig` type name against `src/blux/emit/site-config.ts:15,179` and that its second param is `resolveLogo` (it is: `(uuid) => string | null`). Adjust the item-shape handling to the real export (Step-1 probe) — e.g. media-only logo rows in footer columns may need an `{image}` variant; add only what the-pointe's real footer needs (YAGNI).

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: CLI outputs.** In the catalog action, after `plan` is built (Task 1 gave us `ir`):

```ts
const chrome = buildChrome(siteJson, (uuid) => {
  const a = ir.assets.find((x) => x.id === uuid);
  return a?.sourceUrl ?? null;
});
await writeFile(
  join(outDir, "site-config.json"),
  JSON.stringify(chrome, null, 2),
);
await writeFile(
  join(outDir, "theme.css"),
  emitThemeCss(ir.theme) + emitRolesCss(ir.theme) + emitButtonsCss(ir.theme),
);
```

Match the exact concatenation the old emit action uses at `blux.ts:115-121` (it may join with newlines) — copy that expression. CLI test: extend the catalog fixture test to assert both files exist and `site-config.json` parses with `nav`/`footer` keys.

- [ ] **Step 6: Real-export probe:** run the CLI on `~/Desktop/thePointe`; eyeball `site-config.json` (nav items, footer columns incl. tel numbers) and `theme.css` (`--color-*` navy `#053a6c`, Martel/Montserrat). Paste the footer columns into the commit body — Tucker has an open question about the live footer tel numbers; the emitted values are the export's ground truth.

- [ ] **Step 7: Commit.**

```bash
git add src/blux/catalog/chrome.ts tests/blux/catalog/chrome.test.ts src/cli/commands/blux.ts tests/cli/blux-catalog-command.test.ts
git commit -m "feat(blux-catalog): emit site chrome (nav + full footer columns) and theme.css from the catalog action"
```

---

### Task 5: Offline fixture resolver (maintenance)

**Files:**

- Create: `src/blux/catalog/resolve-fixture.ts`
- Modify: `src/cli/commands/blux.ts` (catalog action writes `render-fixture.json`)
- Test: `tests/blux/catalog/resolve-fixture.test.ts`

The starter's slices consume Prismic-HYDRATED shapes (richtext node arrays, image fields `{url, alt, dimensions}`), but the plan carries markers. `resolveDocData` resolves markers for the Prismic API (assets → `{id}`), which is useless offline. This module resolves for RENDER: richtext via the same html→richtext library `resolve-doc.ts` uses, assets → CDN-url image fields from `plan.assets`.

- [ ] **Step 1: Read `src/blux/emit/resolve-doc.ts` (frozen, import-only)** — note the exact html→richtext import (`htmlAsRichText` from `@prismicio/migrate` or similar) and the marker key names. Mirror them.

- [ ] **Step 2: Failing tests:**

```ts
import { describe, it, expect } from "vitest";
import { resolveFixture } from "../../../src/blux/catalog/resolve-fixture.js";

const plan = {
  customTypes: [],
  documents: [
    {
      type: "page",
      uid: "home",
      data: {
        title: { __richtext_html: "<h1>The Pointe</h1>" },
        slices: [
          {
            slice_type: "blux_grid",
            variation: "default",
            primary: {
              cells: [
                {
                  title: { __richtext_html: "<h3>Card</h3>" },
                  media: { __asset_id: "asset-1" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
  assets: [{ id: "asset-1", url: "https://cdn/img.jpg", alt: "Card art" }],
  stylesManifest: [],
  diagnostics: [],
};

describe("resolveFixture", () => {
  it("richtext markers become node arrays; asset markers become url image fields", () => {
    const fx = resolveFixture(plan as never);
    const doc = fx.documents[0];
    expect(Array.isArray(doc.data.title)).toBe(true);
    expect((doc.data.title as { type: string }[])[0].type).toBe("heading1");
    const cell = (doc.data.slices as any[])[0].primary.cells[0];
    expect(cell.media).toMatchObject({
      url: "https://cdn/img.jpg",
      alt: "Card art",
      dimensions: { width: 1600, height: 1200 },
    });
  });

  it("unknown asset ids resolve to null media (isFilled-safe), reported", () => {
    const broken = { ...plan, assets: [] };
    const fx = resolveFixture(broken as never);
    const cell = (fx.documents[0].data.slices as any[])[0].primary.cells[0];
    expect(cell.media).toBeNull();
    expect(fx.missingAssets).toEqual(["asset-1"]);
  });

  it("groups entity documents by type for SliceZone context.collections", () => {
    const withEntity = {
      ...plan,
      documents: [
        ...plan.documents,
        {
          type: "product",
          uid: "steel-chair",
          data: {
            title: { __richtext_html: "<h1>Steel Chair</h1>" },
            tags: "metal",
          },
        },
      ],
    };
    const fx = resolveFixture(withEntity as never);
    expect(fx.collections.product).toHaveLength(1);
    expect(fx.collections.product[0].uid).toBe("steel-chair");
  });
});
```

- [ ] **Step 3: Run — FAIL.** Then implement:

```ts
import type { MigrationPlan, PlanDocument } from "../emit/plan.js";
// Mirror resolve-doc.ts's exact import for html→richtext:
import { htmlAsRichText } from "@prismicio/migrate";

export type FixtureDoc = {
  type: string;
  uid: string;
  data: Record<string, unknown>;
};
export type RenderFixture = {
  /** Page documents, markers resolved to render shapes. */
  documents: FixtureDoc[];
  /** Entity documents grouped by type — feed straight into SliceZone context.collections. */
  collections: Record<string, FixtureDoc[]>;
  missingAssets: string[];
};

/** Resolve plan markers OFFLINE for the starter's fidelity-gate route:
 * `{__richtext_html}` → richtext node arrays, `{__asset_id}` → image fields
 * pointing at the plan asset's CDN url (placeholder dimensions — the gate
 * measures text coverage and layout, not intrinsic image size). The live
 * migrate path uses resolve-doc.ts instead; keep the two in sync on marker
 * names. */
export function resolveFixture(plan: MigrationPlan): RenderFixture {
  const assetById = new Map(plan.assets.map((a) => [a.id, a] as const));
  const missing = new Set<string>();
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.__richtext_html === "string")
        return htmlAsRichText(o.__richtext_html).result;
      if (typeof o.__asset_id === "string") {
        const a = assetById.get(o.__asset_id);
        if (!a) {
          missing.add(o.__asset_id);
          return null;
        }
        return {
          url: a.url,
          alt: a.alt,
          dimensions: { width: 1600, height: 1200 },
        };
      }
      return Object.fromEntries(
        Object.entries(o).map(([k, x]) => [k, walk(x)]),
      );
    }
    return v;
  };
  const resolved = plan.documents.map((d) => ({
    ...d,
    data: walk(d.data) as Record<string, unknown>,
  }));
  const documents = resolved.filter((d) => d.type === "page");
  const collections: Record<string, FixtureDoc[]> = {};
  for (const d of resolved) {
    if (d.type === "page") continue;
    (collections[d.type] ??= []).push(d);
  }
  return { documents, collections, missingAssets: [...missing] };
}
```

Confirm `htmlAsRichText(...).result` matches resolve-doc.ts's call shape exactly (it may need options for heading serialization — copy its invocation verbatim).

- [ ] **Step 4: Run — PASS.** Wire the CLI: catalog action appends

```ts
const fixture = resolveFixture(plan);
await writeFile(
  join(outDir, "render-fixture.json"),
  JSON.stringify(fixture, null, 2),
);
```

and the CLI test asserts `render-fixture.json` exists with `documents[0].data.slices` array. Full suites green; typecheck clean.

- [ ] **Step 5: Commit.**

```bash
git add src/blux/catalog/resolve-fixture.ts tests/blux/catalog/resolve-fixture.test.ts src/cli/commands/blux.ts tests/cli/blux-catalog-command.test.ts
git commit -m "feat(blux-catalog): offline render-fixture resolver — plan markers to Prismic-hydrated shapes"
```

---

### Task 6: Starter Footer props (worktree)

**Files:**

- Modify: `src/lib/components/Footer.svelte`
- Test: `src/lib/components/Footer.test.ts` (create if absent)

- [ ] **Step 1: Failing test:**

```ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import Footer from "./Footer.svelte";

afterEach(() => cleanup());

describe("Footer", () => {
  it("default: renders the hardcoded copyright (fleet behavior unchanged)", () => {
    const { container } = render(Footer);
    expect(container.querySelector("footer")?.textContent).toContain(
      "Company Name",
    );
  });

  it("columns prop renders chrome columns with links", () => {
    const { container, getByText } = render(Footer, {
      props: {
        columns: [
          {
            items: [
              { text: "Todd Doney", title: true },
              { text: "213.613.3330", href: "tel:2136133330" },
            ],
          },
        ],
        copyright: "© The Pointe",
      },
    });
    expect(getByText("Todd Doney")).not.toBeNull();
    expect(
      container.querySelector("a[href='tel:2136133330']")?.textContent,
    ).toContain("213.613.3330");
    expect(container.textContent).toContain("© The Pointe");
    expect(container.textContent).not.toContain("Company Name");
  });
});
```

- [ ] **Step 2: Run — FAIL** (`--pool=threads`). **Step 3: Implement** (read the current 7-line `Footer.svelte` first; keep its element/class structure as the default branch — the `<footer>` element is the smoke-suite hydration marker, it must ALWAYS render):

```svelte
<script lang="ts">
  export type FooterItem = { text: string; href?: string; title?: boolean };
  interface Props {
    columns?: { items: FooterItem[] }[];
    copyright?: string;
  }
  let { columns, copyright }: Props = $props();
</script>

<footer>
  {#if columns?.length}
    <div class="footer-columns">
      {#each columns as col}
        <div class="footer-column">
          {#each col.items as item}
            {#if item.title}
              <p class="footer-title">{item.text}</p>
            {:else if item.href}
              <a href={item.href}>{item.text}</a>
            {:else}
              <p>{item.text}</p>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    {#if copyright}<p class="footer-copyright">{copyright}</p>{/if}
  {:else}
    <!-- preserve the existing hardcoded default markup here verbatim -->
    <p>© {new Date().getFullYear()} Company Name</p>
  {/if}
</footer>
```

Adapt the default branch to the ACTUAL current file content (copy it verbatim), and match the Svelte-5 runes idiom used by `Nav.svelte` for the Props interface. Note: `export type` inside the instance script may need `<script module>` — follow whatever `Nav.svelte` does for its `NavLink` type.

- [ ] **Step 4: Run — PASS**; also run `Nav.test.ts` + the layout-adjacent tests; `pnpm run check` 0 errors; lint clean.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/components/Footer.svelte src/lib/components/Footer.test.ts
git commit -m "feat(chrome): Footer accepts chrome columns/copyright props, hardcoded default preserved"
```

---

### Task 7: `BluxWidget` — map hydration (worktree)

**Files:**

- Create: `src/lib/blux-catalog/BluxWidget.svelte`, `src/lib/blux-catalog/BluxWidget.test.ts`
- Modify: every slice with a widget block (`grep -l widget_html src/lib/slices/*/index.svelte`): swap the inline block for `<BluxWidget kind={slice.primary.widget_kind} html={slice.primary.widget_html} />`

- [ ] **Step 1: Failing tests:**

```ts
import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import BluxWidget from "./BluxWidget.svelte";

afterEach(() => cleanup());

const mapHtml =
  '<div class="blux-map" data-map-config=\'{"mountId":"burbank_map","mid":"m1","layers":[{"name":"a","lid":"l1","initiallyVisible":true}],"toggles":[{"label":"Studio And Offices","layers":["a"],"panelIndex":0}],"styles":[]}\'>' +
  '<div id="burbank_map" style="height:600px"></div>' +
  "<div class='chips'><span>Studio And Offices</span></div></div>";

describe("BluxWidget", () => {
  it("non-map widgets render the html verbatim in the .blux-widget wrapper", () => {
    const { container } = render(BluxWidget, {
      props: { kind: "divider", html: "<hr class='x'>" },
    });
    expect(
      container.querySelector(".blux-widget[data-widget='divider'] hr.x"),
    ).not.toBeNull();
  });

  it("renders nothing when html is empty", () => {
    const { container } = render(BluxWidget, {
      props: { kind: "map", html: "" },
    });
    expect(container.querySelector(".blux-widget")).toBeNull();
  });

  it("map without a maps key: static html + placeholder marker (no crash, config parsed)", () => {
    const { container } = render(BluxWidget, {
      props: { kind: "map", html: mapHtml },
    });
    expect(
      container.querySelector(".blux-widget[data-widget='map']"),
    ).not.toBeNull();
    expect(container.querySelector("#burbank_map")).not.toBeNull();
    // jsdom has no VITE_GOOGLE_MAPS_KEY: hydration is skipped, marker set.
    expect(container.querySelector("[data-map-placeholder]")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL.** **Step 3: Implement.** First read `src/lib/blux/LocationMap.svelte` (the proven `$effect`/`loadMapsApi`/`KmlLayer`/placeholder pattern) and `src/lib/blux/maps-loader.ts` (exact `loadMapsApi` signature + `GMapsNS` types) — mirror them:

```svelte
<script lang="ts">
  import { loadMapsApi } from "$lib/blux/maps-loader";

  interface Props {
    kind?: string | null;
    html?: string | null;
  }
  let { kind, html }: Props = $props();

  let host = $state<HTMLElement | null>(null);
  let placeholder = $state(false);

  type WidgetMapConfig = {
    mountId: string;
    mid: string;
    layers: {
      name: string;
      lid: string;
      initiallyVisible?: boolean;
      preserveViewport?: boolean;
    }[];
    toggles: { label: string; layers: string[]; panelIndex: number }[];
    styles: unknown[];
    center?: { lat: number; lng: number };
    zoom?: number;
    defaultToggle?: number;
  };

  const parseConfig = (root: HTMLElement): WidgetMapConfig | null => {
    const el = root.querySelector<HTMLElement>(".blux-map[data-map-config]");
    if (!el) return null;
    try {
      return JSON.parse(el.getAttribute("data-map-config") ?? "");
    } catch {
      return null;
    }
  };

  $effect(() => {
    if (kind !== "map" || !host) return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
    const config = parseConfig(host);
    const mount = config
      ? host.querySelector<HTMLElement>(`#${CSS.escape(config.mountId)}`)
      : null;
    if (!key || !config || !mount) {
      placeholder = true;
      return;
    }
    let cancelled = false;
    void loadMapsApi(key).then((g) => {
      if (cancelled) return;
      const map = new g.Map(mount, {
        center: config.center ?? { lat: -34.397, lng: 150.644 },
        zoom: config.zoom ?? 8,
        styles: config.styles as never,
      });
      const layerByName = new Map(
        config.layers.map((l) => [
          l.name,
          new g.KmlLayer({
            url: `https://www.google.com/maps/d/kml?mid=${config.mid}&lid=${l.lid}`,
            map: l.initiallyVisible === false ? null : map,
            preserveViewport: l.preserveViewport ?? false,
          }),
        ]),
      );
      // Legend chips (DOM order = toggles order): clicking chip i shows ONLY
      // that toggle group's layers — the live Blux clickMap behavior.
      const chips = host!.querySelectorAll<HTMLElement>(
        ".blux-map .chips span, .blux-map [data-map-chip]",
      );
      chips.forEach((chip, i) => {
        const group = config.toggles[i];
        if (!group) return;
        chip.style.cursor = "pointer";
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        const activate = () => {
          for (const [name, layer] of layerByName)
            layer.setMap(group.layers.includes(name) ? map : null);
        };
        chip.addEventListener("click", activate);
        chip.addEventListener("keydown", (e) => {
          if ((e as KeyboardEvent).key === "Enter") activate();
        });
      });
    });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if html}
  <div
    class="blux-widget"
    data-widget={kind}
    bind:this={host}
    data-map-placeholder={placeholder ? "" : undefined}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html html}
  </div>
{/if}
```

ADAPT to reality: (a) `loadMapsApi`'s return type/generics come from `maps-loader.ts` — use its `GMapsNS` names, not `g.Map` guesses; copy `LocationMap.svelte`'s constructor calls verbatim. (b) The chip selector must match what the sanitized `widget_html` actually contains — inspect `~/Desktop/thePointe`'s emitted `widget_html` (from a catalog CLI run) with `node -e` and target the REAL legend markup (the old pipeline used `map_icon_text` chip labels; the sanitized mount+legend survived as 705 chars — find the chip elements in it). (c) `data-map-placeholder` semantics mirror `LocationMap.svelte`. (d) `isFilled.keyText` guards belong in the callers; here empty-string html renders nothing.

- [ ] **Step 4: Run — PASS.** **Step 5: Swap the slice widget blocks.** In each slice from `grep -l widget_html src/lib/slices/*/index.svelte`, replace

```svelte
{#if isFilled.keyText(slice.primary.widget_html)}
  <div class="blux-widget" data-widget={slice.primary.widget_kind}>
    {@html slice.primary.widget_html}
  </div>
{/if}
```

with

```svelte
{#if isFilled.keyText(slice.primary.widget_html)}
  <BluxWidget
    kind={slice.primary.widget_kind}
    html={slice.primary.widget_html}
  />
{/if}
```

(plus the import). The rendered DOM for non-map widgets must stay IDENTICAL (`.blux-widget[data-widget=…]` wrapper + raw html) — the existing slice tests prove it: run the full starter suite `pnpm exec vitest run src --pool=threads`, expect zero regressions. BluxBlock's widget block (added in the round-3 commit `8683878`) swaps the same way.

- [ ] **Step 6: `pnpm run check`** 0 errors, lint clean. **Step 7: Commit.**

```bash
git add src/lib/blux-catalog/BluxWidget.svelte src/lib/blux-catalog/BluxWidget.test.ts src/lib/slices/*/index.svelte
git commit -m "feat(blux): BluxWidget hydrates map widgets — KML layers + legend toggles over the emitted html"
```

---

### Task 8: `/dev/blux-pointe` gate route (worktree)

**Files:**

- Create: `src/routes/dev/blux-pointe/+page.ts`, `+page.svelte`, and fixture files `fixture.json`, `site-config.json`, `theme.css` (generated by the maintenance CLI over `~/Desktop/thePointe`, then copied in and committed)
- Test: extend `tests/a11y/fixtures.spec.ts` route list only if trivially green; the real assertions live in Task 9.

- [ ] **Step 1: Generate the fixtures.** In maintenance: `pnpm exec tsx src/cli/bin.ts blux catalog /Users/tuckerlemos/Desktop/thePointe --out <scratchpad>/pointe-4d` then copy `render-fixture.json` → `src/routes/dev/blux-pointe/fixture.json`, `site-config.json` and `theme.css` alongside. Sanity-check sizes (`fixture.json` likely 1-3 MB — fine to commit on this branch; note it in the commit body as a gate artifact, relocatable at PR time).

- [ ] **Step 2: `+page.ts`** (universal load, no server dependency, prerenderable):

```ts
import fixture from "./fixture.json";
import siteConfig from "./site-config.json";

export const prerender = true;

export function load() {
  const home =
    fixture.documents.find((d) => d.uid === "home") ?? fixture.documents[0];
  return {
    slices: home.data.slices,
    collections: fixture.collections,
    nav: siteConfig.nav,
    footer: siteConfig.footer,
  };
}
```

Confirm JSON imports work under the starter's tsconfig (`resolveJsonModule` — the dev fixtures already import `.ts`, so if JSON import fails, rename to `fixture.ts` with `export default {...}` via a tiny generation script, or `satisfies` cast).

- [ ] **Step 3: `+page.svelte`:**

```svelte
<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
  import Nav from "$lib/components/Nav.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import themeCss from "./theme.css?raw";

  let { data } = $props();
  const navLinks = data.nav.items.map((i: { label: string; href: string }) => ({
    text: i.label,
    href: i.href,
  }));
</script>

<svelte:head>
  <title>the-pointe catalog fidelity gate</title>
  {@html `<style>${themeCss}</style>`}
</svelte:head>

<Nav {navLinks} />
<SliceZone
  slices={data.slices as never}
  {components}
  context={{ collections: data.collections }}
/>
<Footer columns={data.footer.columns} />
```

Notes: the root `+layout.svelte` ALREADY renders `<Nav />`/`<Footer />` around children — rendering them again here would duplicate chrome. Check how `/dev/blux-page` handles this (it lives under the same layout): if the layout chrome wraps dev routes, DON'T render Nav/Footer in the page — instead the gate accepts the layout's defaults for structure and the fidelity coverage measures the SliceZone content; in that case pass chrome to the layout via a route group or leave chrome assertions to DOM checks on the fixture's own footer columns rendered as a page-level block. Resolve by reading `+layout.svelte`; prefer the SIMPLEST thing that puts nav links + footer columns in the DOM exactly once. Document the choice in the code comment.

- [ ] **Step 4: Local verify:** `pnpm exec vite build` (or `pnpm run build`) succeeds; `pnpm run check` 0 errors. Quick jsdom smoke: a tiny test rendering the page component with the fixture load result is optional — the Playwright gate (Task 9) is the real check.

- [ ] **Step 5: Commit** (fixture files included; `git add -f` not needed inside `src/routes/`):

```bash
git add src/routes/dev/blux-pointe/
git commit -m "feat(blux): /dev/blux-pointe fidelity-gate route — real the-pointe catalog fixture through production SliceZone"
```

---

### Task 9: The fidelity gate — Playwright + coverage (cross-repo)

**Files:**

- Starter: `tests/gate/pointe-fidelity.spec.ts` + add the route to the a11y spec's route list
- Maintenance: `tests/blux/catalog/pointe-coverage.test.ts`

- [ ] **Step 1: Starter Playwright gate spec:**

```ts
import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// Fidelity gate: the real the-pointe catalog fixture must render cleanly, and
// the rendered HTML is dumped for maintenance's text-coverage check
// (tests/blux/catalog/pointe-coverage.test.ts reads the artifact).
test("the-pointe catalog fixture renders; HTML artifact dumped", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/dev/blux-pointe");
  await expect(page.locator("footer")).toBeVisible();
  // The map widget is present (static html; hydration is keyless here).
  await expect(page.locator(".blux-widget[data-widget='map']")).toHaveCount(1);
  // No console errors beyond the shared allowlist (mirror tests/smoke/pages.spec.ts's allowlist).
  expect(
    errors.filter(
      (e) => !/vimeo|turnstile|maps\.googleapis|cloudfront/.test(e),
    ),
  ).toEqual([]);
  const html = await page.content();
  mkdirSync("test-results/gate", { recursive: true });
  writeFileSync("test-results/gate/pointe-rendered.html", html);
});
```

Check `playwright.config.ts` picks up `tests/gate/` (its testDir may be scoped — extend `testMatch`/projects accordingly, mirroring how `tests/a11y` and `tests/smoke` are wired). Image/network failures from CloudFront are allowlisted — offline runs tolerate 404s; text coverage is the metric.

- [ ] **Step 2: Run it:** `pnpm exec playwright test tests/gate/ --project=<the same project a11y uses>` — expect PASS with the artifact written. If the webServer needs the dev-route build, mirror the a11y spec invocation exactly.

- [ ] **Step 3: Maintenance coverage test:**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { validateCoverage } from "../../../src/blux/validate.js";

const EXPORT_HTML = "/Users/tuckerlemos/Desktop/thePointe/index.html";
const RENDERED =
  process.env.POINTE_RENDERED_HTML ??
  "/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/starter-4c/test-results/gate/pointe-rendered.html";

describe("the-pointe catalog fidelity: text coverage vs the export", () => {
  it.skipIf(!existsSync(RENDERED) || !existsSync(EXPORT_HTML))(
    "covers the export's visible text",
    () => {
      const report = validateCoverage(
        readFileSync(EXPORT_HTML, "utf-8"),
        readFileSync(RENDERED, "utf-8"),
      );
      // 4a proved 46/46 content capture; the render should hold ≥95% of text
      // runs (chrome-only runs like cookie banners may legitimately miss).
      expect(report.coveragePct).toBeGreaterThanOrEqual(95);
      if (report.coveragePct < 100)
        console.log("MISSING RUNS:", report.missing.slice(0, 20));
    },
  );
});
```

Verify `validateCoverage`'s export name/signature at `src/blux/validate.ts:90` and the homepage export path (homepage html at export root). This test self-skips in CI (artifact absent) — it's the controller's gate ritual, run after the Playwright dump.

- [ ] **Step 4: Run the full ritual once end-to-end** and iterate on real gaps: missing text runs → classify which side (emit vs render) → file follow-up fixes as their own TDD'd commits. The gate is DONE when coverage ≥95% with every missing run explained (list them in the commit body).

- [ ] **Step 5: Visual pass vs live (controller step, not code):** open `http://www.thepointeburbank.com/` and the local `/dev/blux-pointe` side by side (superpowers-chrome), desktop + mobile widths; note discrepancies as follow-ups. This mirrors the old-path the-pointe review.

- [ ] **Step 6: Commits** (one per repo):

```bash
# starter
git add tests/gate/pointe-fidelity.spec.ts playwright.config.ts
git commit -m "test(blux): the-pointe fidelity gate — render + console-clean + HTML artifact"
# maintenance
git add tests/blux/catalog/pointe-coverage.test.ts
git commit -m "test(blux-catalog): the-pointe text-coverage gate vs the export (artifact-driven, self-skipping)"
```

---

### Task 10 (STRETCH, only after Tasks 1-9 are green): map panel switching

The live Blux `clickMap` widget shows panel `i` (address grid / logo strips below the map) when chip `i` is active; the panels ride the BluxBlock payload with their source `display:none` inline styles intact, so the static render already matches the initial state. Enhancement: in `BluxWidget`, after the map mounts, locate the payload panel rows (siblings of the widget inside the same slice DOM, initially one visible + N hidden) and toggle `style.display` by `toggles[i].panelIndex`. This couples to payload DOM structure — implement ONLY with a test pinned to the real emitted the-pointe DOM (extract the map band's rendered HTML into a fixture), and keep the no-panels path (chips still toggle layers) as the default when the expected structure is absent. If the structure probe shows the panels do NOT ride the payload with usable markers, STOP and record the finding instead of forcing it.

**Probe result (2026-07-21) — STOPPED, finding recorded (no code).** The premise does not hold: the switchable panels do NOT ride the emitted BluxBlock payload. The map band emits as `blux_block` slice[14] (`widget_kind:"map"`); its 5,330-char payload contains the initially-visible address panel ("2900 West Alameda"/"Alameda" present) but **zero `display:none`** — while the source export carries 5 `display:none` panels + `clickMap` refs. So the emit's visible-content capture (`hasVisibleContent`) correctly keeps the one visible panel and drops the hidden logo-strip panels, which means there is no per-panel structure keyed to `toggles[i].panelIndex` to switch. Reconstructing panel-switching would require an EMIT-level change to preserve `display:none` panels + panel-index markers (Phase-7 scope), not a starter-render change. Fidelity impact is minor and bounded: the legend chips still toggle the map LAYERS (Task 7 — the primary interaction), and the default below-map state (address grid) is faithful; only the secondary panel-content swap on chip click is unavailable. Deferred with the other emit-preservation items.

---

## Verification gate (whole plan)

- Maintenance: `pnpm run typecheck` 0; `pnpm exec vitest run tests/blux/ tests/cli/` green; grid goldens byte-unchanged; capture 46/46; catalog CLI over ALL 12 exports exits 0 with no new diagnostic kinds beyond expected (`unresolved-asset` count strictly decreases after Task 1).
- Starter worktree: `pnpm run check` 0 errors; `pnpm exec vitest run src --pool=threads` green; lint clean; Playwright gate green with artifact.
- The coverage number and its missing-run list reported to Tucker verbatim — that's the deliverable of the fidelity gate.
- Live `migrate-catalog` NOT run (creds-gated); its credless smoke test green.
