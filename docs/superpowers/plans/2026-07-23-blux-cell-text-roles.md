# Role-Aware Cell Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make catalog cell body text keep each block's Blux display role (e.g. a `text2`=70px secondary heading renders at 70px, not demoted to default body size) by baking per-block `txt-role-*` divs into a `body_html` Text field rendered via `{@html}`.

**Architecture:** A cell's `body` RichText field (which cannot carry a class, so `<PrismicRichText>` renders every block role-less) is replaced by a `body_html` Text field. Emit's `textOf` wraps each folded body block in its own `txt-role-*` div (the string sibling of the existing `roleWrap` used by the BluxBlock path). `BluxCell.svelte` renders it via `{@html}`, exactly like `embed_html`. The theme emitter gains a runtime-resolvable `:root` mirror of its `@theme` tokens so the `.txt-role-*` rules' `var(--text-*)` resolve when `theme.css` is injected raw at runtime (the gate does this). Approved spec: `docs/superpowers/specs/2026-07-23-blux-cell-text-roles-design.md`.

**Tech Stack:** TypeScript (emit CLI, tsup+vitest), SvelteKit + Prismic (starter, vite+vitest+Playwright), Tailwind v4 `@theme`.

---

## Worktrees & branches

Two repos, each in a dedicated worktree. **Every task names which one.** Never touch the reddoor-starter MAIN checkout; never commit from a checkout another session may share.

- **MAINT** = `/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/rm-emit` — branch `feat/blux-catalog-emit` (reddoor-maintenance).
- **START** = `/private/tmp/claude-501/-Users-tuckerlemos-Documents-GitHub-reddoor-starter/4e4b6729-02ba-49d5-a7f4-952ed54e3e23/scratchpad/starter-4c` — branch `feat/blux-catalog-pipeline` (reddoor-starter).

**Per-task lint gate = branch-owned files ONLY** (both repos carry pre-existing lint noise unrelated to this work). Lint exactly the files the task changed, not the whole repo.

**Task order is linear: 1 → 2 → 3 → 4 → 5.** Task 4 regenerates the gate fixtures from the Task 1+2 CLI and needs the Task 3 render contract in place first.

---

## File Structure

**MAINT (emit):**
- `src/blux/catalog/spec.ts` — `CatalogCell`: `body`+`bodyRole` → `bodyHtml`.
- `src/blux/catalog/cells.ts` — `roleWrapHtml` helper; `textOf` returns `bodyHtml`; `buildCell` plumbing.
- `src/blux/catalog/emit.ts` — `cellToItem` emits `body_html` (plain string, no `richText()` marker), drops `body_role`.
- `src/blux/emit/theme.ts` — `themeVarLines` helper + `emitRootVarsCss` (`:root` mirror).
- `src/cli/commands/blux.ts` — concatenate the `:root` mirror into the two `theme.css` write sites.
- Tests: `tests/blux/catalog/cells.test.ts`, `tests/blux/catalog/emit.test.ts`, `tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap` (regen), `tests/blux/emit/theme.test.ts` (create).

**START (render):**
- `src/lib/slices/{BluxGrid,BluxSection,BluxGallery,BluxCarousel}/model.json` — cell+subgrid `body`→`body_html`; drop `body_role` (Grid/Section only).
- `src/prismicio-types.d.ts` — regenerated.
- `src/lib/blux-catalog/cell.ts` — `BluxCellData`.
- `src/lib/blux-catalog/BluxCell.svelte` — body render swap.
- `src/lib/blux-catalog/BluxCell.test.ts` — updated.
- `src/routes/dev/blux-pointe/{fixture.json,theme.css,site-config.json}` — regenerated (Task 4).
- `tests/gate/pointe-fidelity.spec.ts` — role→font-size assertion (Task 5).

---

## Task 1: Emit `bodyHtml` (baked roled HTML) instead of `body`+`bodyRole` [MAINT]

**Repo:** MAINT (`feat/blux-catalog-emit`). This is one atomic commit — the `CatalogCell` type change ripples through `cells.ts` and `emit.ts`, so all three change together to keep the build green.

**Files:**
- Modify: `src/blux/catalog/spec.ts` (CatalogCell, ~lines 10–27)
- Modify: `src/blux/catalog/cells.ts` (add `roleWrapHtml`; `textOf` lines 83–116; `buildCell` lines 144–209)
- Modify: `src/blux/catalog/emit.ts` (`cellToItem` lines 68–92)
- Test: `tests/blux/catalog/cells.test.ts`, `tests/blux/catalog/emit.test.ts`
- Snapshot: `tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap` (regenerated)

- [ ] **Step 1: Write the failing unit test (the core regression)**

In `tests/blux/catalog/cells.test.ts`, add this test (it exercises a multi-role body — the exact case that used to demote):

```ts
describe("cellFromNode — each folded body block keeps its own role (approach B)", () => {
  it("wraps later headings, bodies, and subtitles in their own txt-role div, in order", () => {
    const c = cellFromNode(
      stack([
        { kind: "heading", level: 3, html: "The Pointe", role: "text0" },
        { kind: "heading", level: 4, html: "distinguished design", role: "text2" },
        { kind: "body", html: "<p>Nestled among the hills</p>", role: "text1" },
      ] as unknown as Node[]),
    );
    // First heading is the title; its role rides titleRole (NOT the body).
    expect(c.title).toBe("<h3>The Pointe</h3>");
    expect(c.titleRole).toBe("text0");
    // Every later block keeps its OWN role wrapper, in document order.
    expect(c.bodyHtml).toBe(
      '<div class="txt-role-text2"><h4>distinguished design</h4></div>\n' +
        '<div class="txt-role-text1"><p>Nestled among the hills</p></div>',
    );
  });
  it("leaves a roleless body block unwrapped", () => {
    const c = cellFromNode(stack([{ kind: "body", html: "<p>plain</p>" } as unknown as Node]));
    expect(c.bodyHtml).toBe("<p>plain</p>");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd "$MAINT" && pnpm exec vitest run tests/blux/catalog/cells.test.ts`
Expected: FAIL — TypeScript error `Property 'bodyHtml' does not exist on type 'CatalogCell'` (and `titleRole` assertions won't compile against the current `body`/`bodyRole` shape).

- [ ] **Step 3: Update the `CatalogCell` type**

In `src/blux/catalog/spec.ts`, replace the `body`/`bodyRole` fields. The new `CatalogCell` (keep every other field exactly as-is):

```ts
export type CatalogCell = {
  kind: "text" | "media" | "embed" | "subgrid";
  title?: CatalogRichText;
  bodyHtml?: string;
  media?: Media;
  mediaRatio?: string;
  embedHtml?: string;
  // --- visual-fidelity fields (Blux catalog visual layer) ---
  width?: string;
  spacing?: number;
  cover?: boolean;
  valign?: boolean;
  backgroundColor?: string;
  contentPadding?: string;
  titleRole?: string;
  subgrid?: CatalogCell[];
};
```

(Removed `body` and `bodyRole`; added `bodyHtml`; `titleRole` stays.)

- [ ] **Step 4: Add the `roleWrapHtml` helper and rewrite `textOf` in `cells.ts`**

Add this helper immediately above `textOf` (near the existing `wrapBare` at lines 54–56):

```ts
/** Wrap a body-block html string in its Blux type-role div (`txt-role-textN`)
 * so the starter theme's `.txt-role-textN :is(hN,p)` rule sizes it; a roleless
 * block passes through untouched. The string sibling of `roleWrap` (which wraps
 * a BlockNode for the BluxBlock fallback path). */
function roleWrapHtml(role: string | undefined, inner: string): string {
  return role ? `<div class="txt-role-${role}">${inner}</div>` : inner;
}
```

Replace the whole `textOf` function (lines 83–116) with:

```ts
function textOf(n: Node): {
  title?: string;
  titleRole?: string;
  bodyHtml?: string;
} {
  let title: string | undefined;
  let titleRole: string | undefined;
  const bodyParts: string[] = [];
  for (const t of collectText(n)) {
    if (t.kind === "heading") {
      if (blockPlainText(t.html) === "") continue; // whitespace-only heading
      const wrapped = `<h${t.level}>${t.html}</h${t.level}>`;
      if (title === undefined) {
        title = wrapped;
        titleRole = t.role;
      } else bodyParts.push(roleWrapHtml(t.role, wrapped));
    } else if (t.kind === "body") {
      if (t.html) bodyParts.push(roleWrapHtml(t.role, wrapBare(t.html)));
    } else if (t.kind === "subtitle") {
      bodyParts.push(roleWrapHtml(t.role, `<p>${t.text}</p>`));
    }
  }
  return {
    ...(title ? { title } : {}),
    ...(titleRole ? { titleRole } : {}),
    ...(bodyParts.length ? { bodyHtml: bodyParts.join("\n") } : {}),
  };
}
```

- [ ] **Step 5: Update `buildCell`'s three destructures + object literals in `cells.ts`**

In `buildCell` (lines 144–209) there are three sites that destructure `textOf` and spread its fields. Change each `const { title, body, titleRole, bodyRole } = textOf(u);` to `const { title, titleRole, bodyHtml } = textOf(u);`, and in every cell object literal replace `...(body ? { body } : {})` with `...(bodyHtml ? { bodyHtml } : {})` and DELETE `...(bodyRole ? { bodyRole } : {})`. Also update the `kind`/guard expressions that referenced `body`:

  - Depth-0 split branch — the `textItem` guard and literal:
    ```ts
    const { title, titleRole, bodyHtml } = textOf(u);
    const embedHtml = rawHtmlOf(u);
    const textItem: CatalogCell[] =
      title || bodyHtml || embedHtml
        ? [
            {
              kind: "text",
              ...(title ? { title } : {}),
              ...(bodyHtml ? { bodyHtml } : {}),
              ...(embedHtml ? { embedHtml } : {}),
              ...(titleRole ? { titleRole } : {}),
            },
          ]
        : [];
    ```
  - Media branch guard + literal:
    ```ts
    const { title, titleRole, bodyHtml } = textOf(u);
    const embedHtml = rawHtmlOf(u);
    if (u.kind === "media" || (media && !title && !bodyHtml)) {
      return {
        kind: "media",
        ...(media ? { media } : {}),
        ...(title ? { title } : {}),
        ...(bodyHtml ? { bodyHtml } : {}),
        ...(embedHtml ? { embedHtml } : {}),
        ...(titleRole ? { titleRole } : {}),
        ...vis,
      };
    }
    ```
  - Final return:
    ```ts
    return {
      kind: title || bodyHtml ? "text" : embedHtml ? "embed" : "text",
      ...(title ? { title } : {}),
      ...(bodyHtml ? { bodyHtml } : {}),
      ...(media ? { media } : {}),
      ...(embedHtml ? { embedHtml } : {}),
      ...(titleRole ? { titleRole } : {}),
      ...vis,
    };
    ```

- [ ] **Step 6: Update `cellToItem` in `emit.ts` to emit `body_html` (plain string) and drop `body_role`**

In `src/blux/catalog/emit.ts`, `cellToItem` (lines 68–92): replace the body line and remove the body_role line. `title` stays exactly as-is.

Change:
```ts
    ...(cell.body ? { body: richText(cell.body) } : {}),
```
to:
```ts
    ...(cell.bodyHtml ? { body_html: cell.bodyHtml } : {}),
```
and DELETE:
```ts
    ...(cell.bodyRole ? { body_role: cell.bodyRole } : {}),
```

Do NOT run `body_html` through `richText()` — it must be a plain string so `resolveFixture`/`resolveDocData` pass it through as a Text value (that is exactly the "migrate no longer HTML→RichexText's the body" change). Do NOT run it through `sanitizeHtml` — the role divs are our own baked markup (same trust as the BluxBlock `{@html}` payload path); `sanitizeHtml` would strip the `class` attributes and defeat the fix.

- [ ] **Step 7: Fix the other `cells.test.ts` and `emit.test.ts` references (rename `body`→`bodyHtml` / `body_html`)**

`cells.test.ts`:
- Every `expect(c.body)` / `sub[0]?.body` / `.body` on a `CatalogCell` → `.bodyHtml`. (These test data use the roleless `heading`/`body` helpers, so `roleWrapHtml(undefined, …)` leaves the strings identical — only the field name changes.)
- The "threads token width/spacing, card style, and text roles" test (the one asserting `bodyRole: "text1"`): its input body node is `{ kind: "body", html: "<p>Body</p>", role: "text1" }`, so remove the `bodyRole: "text1"` expectation and instead assert the baked wrapper, keeping `titleRole: "text5"`:
  ```ts
  expect(cells[0]).toMatchObject({
    width: "70%",
    backgroundColor: "#fff",
    contentPadding: "100px 4% 80px",
    valign: true,
    titleRole: "text5",
    bodyHtml: '<div class="txt-role-text1"><p>Body</p></div>',
  });
  ```

`emit.test.ts`:
- Line ~11 input `{ kind: "text", title: "<h3>Pool</h3>", body: "<p>Heated</p>" }` → `body` becomes `bodyHtml`: `{ kind: "text", title: "<h3>Pool</h3>", bodyHtml: "<p>Heated</p>" }`.
- Line ~34 assertion `body: { __richtext_html: "<p>Heated</p>" }` → `body_html: "<p>Heated</p>"` (plain string now).
- Line ~88 input `{ kind: "text", body: "<p>kept</p>" }` → `{ kind: "text", bodyHtml: "<p>kept</p>" }`.
- Lines ~128/~159 (`titleRole`/`title_role`) stay unchanged.

- [ ] **Step 8: Run the catalog unit tests to green (except the golden snapshot)**

Run: `cd "$MAINT" && pnpm exec vitest run tests/blux/catalog/cells.test.ts tests/blux/catalog/emit.test.ts`
Expected: PASS (both files).

- [ ] **Step 9: Regenerate the plan golden snapshot**

The plan-golden snapshot encodes the old `body`/`body_role` emission and must be regenerated.

Run: `cd "$MAINT" && pnpm exec vitest run -u tests/blux/catalog/plan-golden.test.ts`
Then inspect the diff: `git -C "$MAINT" diff tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap | head -80`
Expected: `body_role`/`__richtext_html` body entries replaced by `body_html: "<div class=\"txt-role-…"` strings. Confirm no `body_role` remains: `grep -c body_role tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap` → `0`.

- [ ] **Step 10: Full suite + branch-file lint**

Run: `cd "$MAINT" && pnpm exec vitest run`
Expected: PASS (all).
Run: `cd "$MAINT" && pnpm exec eslint src/blux/catalog/spec.ts src/blux/catalog/cells.ts src/blux/catalog/emit.ts tests/blux/catalog/cells.test.ts tests/blux/catalog/emit.test.ts && pnpm exec prettier --check src/blux/catalog/spec.ts src/blux/catalog/cells.ts src/blux/catalog/emit.ts tests/blux/catalog/cells.test.ts tests/blux/catalog/emit.test.ts`
Expected: clean (run `pnpm exec prettier --write …` on those files if the check fails, then re-check).

- [ ] **Step 11: Commit**

```bash
cd "$MAINT" && git add src/blux/catalog/spec.ts src/blux/catalog/cells.ts src/blux/catalog/emit.ts tests/blux/catalog/cells.test.ts tests/blux/catalog/emit.test.ts tests/blux/catalog/__snapshots__/plan-golden.test.ts.snap && git commit -m "feat(blux): emit per-block roled body_html for catalog cells

textOf now bakes each folded heading/body/subtitle into its own
txt-role-* div (roleWrapHtml) and returns bodyHtml; CatalogCell drops
body/bodyRole for bodyHtml; cellToItem emits body_html as a plain Text
string (no richText marker, no sanitize — trusted baked markup). Fixes
multi-role cell bodies demoting to default size."
```

---

## Task 2: Emit a runtime-resolvable `:root` mirror of the theme tokens [MAINT]

**Repo:** MAINT (`feat/blux-catalog-emit`). Independent of Task 1.

**Why:** `theme.css` declares `--text-*` only inside Tailwind's build-time `@theme{}`. When the file is injected raw at runtime (the `/dev/blux-pointe` gate does `{@html <style>theme.css</style>}`), the browser ignores `@theme`, so the `.txt-role-*` rules' `var(--text-*)` never resolve. Emitting the same tokens inside a real `:root{}` block fixes runtime resolution without Tailwind, and is harmless when the file is also Tailwind-built.

**Files:**
- Modify: `src/blux/emit/theme.ts` (`emitThemeCss` lines 6–31; add `themeVarLines` + `emitRootVarsCss`)
- Modify: `src/cli/commands/blux.ts` (theme.css write sites: `catalog` ~lines 694–699, `emit` ~lines 122–127)
- Test: `tests/blux/emit/theme.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/blux/emit/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { emitThemeCss, emitRootVarsCss } from "../../../src/blux/emit/theme.js";
import type { ThemeIR } from "../../../src/blux/emit/theme.js";

const theme: ThemeIR = {
  fontLoad: [],
  colors: [{ role: "text", value: "#053a6c" }],
  fonts: { heading: "Scope One", body: "Montserrat" },
  textStyles: [
    { role: "text2", label: "Page Title", size: "70px", lineHeight: "100px", weight: "300" },
  ],
};

describe("emitRootVarsCss", () => {
  it("mirrors the @theme text tokens into a real :root block (runtime-resolvable)", () => {
    const css = emitRootVarsCss(theme);
    expect(css).toMatch(/^:root \{/);
    expect(css).toContain("--text-text2: 70px;");
    expect(css).toContain("--color-text: #053a6c;");
  });
});

describe("emitThemeCss (unchanged @theme output)", () => {
  it("still emits the tokens inside @theme, not :root", () => {
    const css = emitThemeCss(theme);
    expect(css).toContain("@theme {");
    expect(css).toContain("--text-text2: 70px;");
    expect(css).not.toContain(":root");
  });
});
```

If `ThemeIR` is not exported from `theme.ts`, import it from wherever it is declared (check the top of `src/blux/emit/theme.ts` for its `import type { ThemeIR }` source and use that path). Adjust the `theme` literal's fields to match the real `ThemeIR` shape if any required field is missing (the test only needs one color + one text style).

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd "$MAINT" && pnpm exec vitest run tests/blux/emit/theme.test.ts`
Expected: FAIL — `emitRootVarsCss is not a function` / not exported.

- [ ] **Step 3: Extract `themeVarLines` and add `emitRootVarsCss` in `theme.ts`**

Refactor `emitThemeCss` to share its token lines with the new mirror, so the two never drift. Extract the token-line body of `emitThemeCss` (the color/font/textStyle loop, currently lines ~14–29) verbatim into a helper, and have `emitThemeCss` wrap it in `@theme { … }` and `emitRootVarsCss` wrap the same lines in `:root { … }`:

```ts
/** The shared custom-property lines (colors, fonts, text tokens) that both the
 * build-time `@theme{}` block and the runtime `:root{}` mirror emit. Extracted
 * so the two blocks can never drift. */
function themeVarLines(theme: ThemeIR): string[] {
  const lines: string[] = [];
  for (const c of theme.colors) lines.push(`  --color-${c.role}: ${c.value};`);
  lines.push(`  --font-heading: ${theme.fonts.heading || "sans-serif"};`);
  lines.push(`  --font-body: ${theme.fonts.body || "sans-serif"};`);
  for (const t of theme.textStyles) {
    if (t.label) lines.push(`  /* ${t.role} — ${t.label} */`);
    lines.push(`  --text-${t.role}: ${t.size};`);
    lines.push(`  --text-${t.role}--line-height: ${t.lineHeight};`);
    lines.push(`  --text-${t.role}--font-weight: ${t.weight};`);
    if (t.fontFamily) lines.push(`  --text-${t.role}--font-family: ${t.fontFamily};`);
    if (t.transform) lines.push(`  --text-${t.role}--text-transform: ${t.transform};`);
    if (t.letterSpacing) lines.push(`  --text-${t.role}--letter-spacing: ${t.letterSpacing};`);
    if (t.margin) lines.push(`  --text-${t.role}--margin: ${t.margin};`);
    if (t.mobileSize) lines.push(`  --text-${t.role}--mobile-font-size: ${t.mobileSize};`);
    if (t.mobileLineHeight)
      lines.push(`  --text-${t.role}--mobile-line-height: ${t.mobileLineHeight};`);
  }
  return lines;
}

export function emitThemeCss(theme: ThemeIR): string {
  const lines: string[] = [];
  if (theme.fontLoad.length) {
    const spec = theme.fontLoad.map((f) => `${f.family} ${f.weights.join(",")}`).join("; ");
    lines.push(`/* Fonts to load — ${spec} */`);
  }
  lines.push("@theme {");
  lines.push(...themeVarLines(theme));
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** A runtime-resolvable mirror of the @theme token block. Tailwind's `@theme`
 * is BUILD-TIME — injected raw at runtime (the /dev/blux-pointe gate), the
 * browser ignores it and the `.txt-role-*` rules' `var(--text-*)` never
 * resolve. The same tokens inside a real `:root{}` resolve without Tailwind;
 * identical values to what @theme compiles to :root, so it is harmless when the
 * file is also Tailwind-built. */
export function emitRootVarsCss(theme: ThemeIR): string {
  return [":root {", ...themeVarLines(theme), "}"].join("\n") + "\n";
}
```

The `@theme{}` output must stay byte-identical — `themeVarLines` reproduces the exact same lines in the exact same order as the current `emitThemeCss` body. `emitRolesCss`/`emitButtonsCss` are untouched.

- [ ] **Step 4: Run the theme test to green**

Run: `cd "$MAINT" && pnpm exec vitest run tests/blux/emit/theme.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the `:root` mirror into the CLI theme.css writes**

In `src/cli/commands/blux.ts`, add `emitRootVarsCss` to the import from `../../blux/emit/theme.js` (alongside `emitThemeCss`). Then in BOTH theme.css write sites (the `catalog` action ~694–699 and the `emit` action ~122–127), insert the mirror right after `emitThemeCss(...)`:

```ts
      emitThemeCss(ir.theme) +
        "\n" +
        emitRootVarsCss(ir.theme) +
        (rolesCss ? "\n" + rolesCss : "") +
        (buttonsCss ? "\n" + buttonsCss : ""),
```

Apply the identical edit at both sites.

- [ ] **Step 6: Full suite + branch-file lint**

Run: `cd "$MAINT" && pnpm exec vitest run`
Expected: PASS (all).
Run: `cd "$MAINT" && pnpm exec eslint src/blux/emit/theme.ts src/cli/commands/blux.ts tests/blux/emit/theme.test.ts && pnpm exec prettier --check src/blux/emit/theme.ts src/cli/commands/blux.ts tests/blux/emit/theme.test.ts`
Expected: clean (prettier --write those files if needed).

- [ ] **Step 7: Commit**

```bash
cd "$MAINT" && git add src/blux/emit/theme.ts src/cli/commands/blux.ts tests/blux/emit/theme.test.ts && git commit -m "feat(blux): emit a :root mirror of theme tokens for runtime var resolution

@theme is build-time only; injected raw at runtime the .txt-role-* rules'
var(--text-*) never resolve. emitRootVarsCss mirrors the same tokens into a
real :root block (shared themeVarLines, so the two never drift), concatenated
into theme.css. Enables the gate's role->font-size assertion."
```

---

## Task 3: Swap the cell render contract to `body_html` [START]

**Repo:** START (`feat/blux-catalog-pipeline`). One atomic commit: the model + generated types + `BluxCellData` + component + test change together so `pnpm check` stays green (intermediate states won't type-check).

**Files:**
- Modify: `src/lib/slices/BluxGrid/model.json`, `BluxSection/model.json`, `BluxGallery/model.json`, `BluxCarousel/model.json`
- Regenerate: `src/prismicio-types.d.ts` (+ each slice's `mocks.json`)
- Modify: `src/lib/blux-catalog/cell.ts`, `src/lib/blux-catalog/BluxCell.svelte`
- Test: `src/lib/blux-catalog/BluxCell.test.ts`

- [ ] **Step 1: Write the failing component test**

In `src/lib/blux-catalog/BluxCell.test.ts`, replace the existing "wraps title/body in their type-role containers" test (lines 48–59) with:

```ts
  it("wraps the title in its role container and renders roled body_html via {@html}", () => {
    const cell = {
      kind: "text",
      title: rt("heading3", "T"),
      title_role: "text11",
      body_html: '<div class="txt-role-text1"><p>B</p></div>',
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    expect(container.querySelector(".txt-role-text11 h3")).not.toBeNull();
    expect(container.querySelector(".blux-cell__body .txt-role-text1 p")).not.toBeNull();
  });
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd "$START" && pnpm exec vitest run src/lib/blux-catalog/BluxCell.test.ts`
Expected: FAIL — `.blux-cell__body .txt-role-text1 p` is null (BluxCell still renders `cell.body` via PrismicRichText; `body_html` is ignored).

- [ ] **Step 3: Edit the four `model.json` — `body`→`body_html`, drop `body_role`**

In each of the four slice models, at BOTH the cell-level and the nested `subgrid`-level, replace the `body` field block:

```json
              "body": {
                "type": "StructuredText",
                "config": {
                  "label": "body",
                  "multi": "paragraph,heading1,heading2,heading3,heading4,heading5,heading6,strong,em,hyperlink,list-item,o-list-item,image,embed"
                }
              },
```

with:

```json
              "body_html": {
                "type": "Text",
                "config": {
                  "label": "body_html"
                }
              },
```

And in `BluxGrid` and `BluxSection` ONLY, DELETE both the cell-level and subgrid-level `body_role` blocks entirely:

```json
              "body_role": {
                "type": "Text",
                "config": {
                  "label": "body_role"
                }
              },
```

(`BluxGallery`/`BluxCarousel` have no `body_role` — nothing to delete there.) Keep `title` and `title_role` untouched. Field locations (from the current models):
- BluxGrid: cell `body` 155–161, subgrid `body` 262–268; cell `body_role` 237–242, subgrid `body_role` 344–349.
- BluxSection: cell `body` 130–136, subgrid `body` 237–243; cell `body_role` 212–217, subgrid `body_role` 319–324.
- BluxGallery: cell `body` 131–137, subgrid `body` 194–200 (no `body_role`).
- BluxCarousel: cell `body` 157–163, subgrid `body` 220–226 (no `body_role`).

- [ ] **Step 4: Regenerate the Prismic types for all four slices**

Read `slicemachine.config.json` at the START worktree root to get the slice library id (the `libraries` array entry, e.g. `"./src/lib/slices"`). Then regenerate types+mocks for each edited slice (this rewrites `src/prismicio-types.d.ts`):

```bash
cd "$START"
LIB="./src/lib/slices"   # confirm against slicemachine.config.json
for s in BluxGrid BluxSection BluxGallery BluxCarousel; do
  node scratchpad/regen-types.mjs "$START" "$LIB" "src/lib/slices/$s/model.json"
done
```

Confirm the generated types dropped the fields: `grep -c 'body_role' src/prismicio-types.d.ts` → `0`; and `grep -c 'cells\[\].body_html\|body_html' src/prismicio-types.d.ts` → non-zero.

- [ ] **Step 5: Update `BluxCellData` in `cell.ts`**

In `src/lib/blux-catalog/cell.ts`, change line 11 `body: prismic.RichTextField;` → `body_html: prismic.KeyTextField;`, and DELETE line 25 `body_role?: string | null;`. Keep `title`, `title_role`, and everything else:

```ts
  title: prismic.RichTextField;
  body_html: prismic.KeyTextField;
  media: prismic.ImageField;
```
(and the `title_role?: string | null;` line stays; the `body_role?` line is removed.)

- [ ] **Step 6: Swap the body render in `BluxCell.svelte`**

Replace the current body block (lines 57–63):

```svelte
  {#if isFilled.richText(cell.body)}
    {#if cell.body_role}
      <div class="txt-role-{cell.body_role}">
        <PrismicRichText field={cell.body} />
      </div>
    {:else}<PrismicRichText field={cell.body} />{/if}
  {/if}
```

with:

```svelte
  {#if cell.body_html}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML: emit bakes the role divs; content is the client's own export, same trust as the BluxBlock {@html} path -->
    <div class="blux-cell__body">{@html cell.body_html}</div>
  {/if}
```

Leave the `title`/`title_role` block (lines 50–56) and the `embed_html` block (64–67) unchanged. `isFilled` is still used by the title/media/link blocks, so keep the import.

- [ ] **Step 7: Run the component test + typecheck to green**

Run: `cd "$START" && pnpm exec vitest run src/lib/blux-catalog/BluxCell.test.ts`
Expected: PASS.
Run: `cd "$START" && pnpm run check`
Expected: 0 errors (svelte-check). If `src/routes/dev/blux-pointe/page-load.test.ts` fails because the still-stale `fixture.json` carries `body`/`body_role`, confirm it is a *count* canary (slice/doc counts) — those are unaffected by field renames — and leave it; Task 4 regenerates the fixture. If it asserts body *text presence*, note it and let Task 4 resolve it (do not weaken it here).

- [ ] **Step 8: Full unit suite + branch-file lint**

Run: `cd "$START" && pnpm run test:unit`
Expected: PASS (page-load count canaries included).
Run: `cd "$START" && pnpm exec prettier --check --plugin prettier-plugin-svelte src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.svelte src/lib/blux-catalog/BluxCell.test.ts src/lib/slices/BluxGrid/model.json src/lib/slices/BluxSection/model.json src/lib/slices/BluxGallery/model.json src/lib/slices/BluxCarousel/model.json && pnpm exec eslint src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.svelte src/lib/blux-catalog/BluxCell.test.ts`
Expected: clean (prettier --write those files if needed).

- [ ] **Step 9: Commit**

```bash
cd "$START" && git add src/lib/slices/BluxGrid/model.json src/lib/slices/BluxSection/model.json src/lib/slices/BluxGallery/model.json src/lib/slices/BluxCarousel/model.json src/prismicio-types.d.ts src/lib/blux-catalog/cell.ts src/lib/blux-catalog/BluxCell.svelte src/lib/blux-catalog/BluxCell.test.ts src/lib/slices/*/mocks.json && git commit -m "feat(blux): render cell body from roled body_html via {@html}

Cell body field body (RichText, one blanket role) -> body_html (Text) in
all four catalog container models + subgrids; drop body_role (Grid/Section).
BluxCell renders body_html via {@html} like embed_html, so each baked
txt-role-* block keeps its display size. Regenerated prismicio-types."
```

---

## Task 4: Regenerate the gate fixture + theme from the updated emit [START]

**Repo:** START (`feat/blux-catalog-pipeline`), using the MAINT CLI built from Tasks 1–2. This refreshes the offline gate data so `fixture.json` carries `body_html` and `theme.css` carries the `:root` mirror. This is a data-regeneration task (no new failing test); verification is the existing canaries + a content grep.

**Files:**
- Regenerate: `src/routes/dev/blux-pointe/fixture.json`, `theme.css`, `site-config.json`
- Possibly update: `src/routes/dev/blux-pointe/page-load.test.ts` (count canaries, only if they legitimately drift)

- [ ] **Step 1: Build the MAINT CLI**

Run: `cd "$MAINT" && pnpm build`
Expected: tsup builds `dist/cli/bin.js` with no errors.

- [ ] **Step 2: Locate the the-pointe export**

Run: `ls ~/Desktop | grep -iE 'pointe'`
Expected: a directory (the `+page.ts` regen comment names `~/Desktop/thePointe`). Use whatever exact name is printed as `EXPORT=~/Desktop/<name>` below. If none is found, STOP and report — the gate fixture cannot be regenerated without the export.

- [ ] **Step 3: Run the offline catalog conversion**

Run (offline — no token; writes only into the scratchpad):
```bash
cd "$MAINT" && node dist/cli/bin.js blux catalog ~/Desktop/thePointe --out "$START/scratchpad/pointe-regen"
```
Expected: writes `render-fixture.json`, `site-config.json`, `theme.css` into `scratchpad/pointe-regen`. (If it fails to bind/network, it should not — `catalog` is fully offline. If a sandbox write error occurs on the out dir, re-run with the sandbox disabled for that one command.)

- [ ] **Step 4: Copy the artifacts into the dev route and format**

```bash
cd "$START"
cp scratchpad/pointe-regen/render-fixture.json src/routes/dev/blux-pointe/fixture.json
cp scratchpad/pointe-regen/site-config.json    src/routes/dev/blux-pointe/site-config.json
cp scratchpad/pointe-regen/theme.css           src/routes/dev/blux-pointe/theme.css
pnpm exec prettier --write src/routes/dev/blux-pointe/fixture.json src/routes/dev/blux-pointe/site-config.json src/routes/dev/blux-pointe/theme.css
```

- [ ] **Step 5: Verify the regenerated artifacts carry the fix**

Run:
```bash
cd "$START"
grep -c 'txt-role-text' src/routes/dev/blux-pointe/fixture.json
grep -c 'body_role' src/routes/dev/blux-pointe/fixture.json
grep -n ':root' src/routes/dev/blux-pointe/theme.css
grep -n -- '--text-text2:' src/routes/dev/blux-pointe/theme.css
```
Expected: fixture `txt-role-text` count > 0; fixture `body_role` count = 0; `theme.css` contains a `:root {` line; `--text-text2: 70px;` appears (inside both `@theme` and the new `:root`).

- [ ] **Step 6: Run the unit suite; reconcile count canaries if they drifted**

Run: `cd "$START" && pnpm run test:unit`
Expected: PASS. If `page-load.test.ts` count canaries changed because the emit now produces `body_html` cells (e.g. a slightly different cell/text count), update those expected numbers to the new values — the drift is legitimate and intended. Do NOT weaken structural assertions; only adjust exact counts that reflect the new emission.

- [ ] **Step 7: Commit**

```bash
cd "$START" && git add src/routes/dev/blux-pointe/fixture.json src/routes/dev/blux-pointe/theme.css src/routes/dev/blux-pointe/site-config.json src/routes/dev/blux-pointe/page-load.test.ts && git commit -m "test(blux): regenerate the-pointe gate fixture + theme with roled body_html

Fixture cells now carry body_html with baked txt-role-* divs; theme.css
carries the runtime :root mirror. Regenerated from the updated blux catalog
CLI against the the-pointe export."
```

---

## Task 5: Extend the gate to assert role→font-size resolution [START]

**Repo:** START (`feat/blux-catalog-pipeline`). Locks the regression: a big display-role block inside a cell body must compute to a materially larger font-size than default body text.

**Files:**
- Modify: `tests/gate/pointe-fidelity.spec.ts` (the second test, "catalog visual layer resolves grid, cover, padding, and type roles")

- [ ] **Step 1: Add the role→font-size assertion**

In `tests/gate/pointe-fidelity.spec.ts`, immediately after the existing "Type-role wrapping is applied to real text runs" assertion (the `[class*='txt-role-text']` visible check, ~line 100), add:

```ts
  // Role SIZING resolves at runtime: at least one big display-role block inside
  // a cell body computes to a materially larger font-size than default body
  // text. Locks the regression where cell subtitles / secondary headings kept
  // the role CLASS but rendered at default size (RichText could not carry the
  // class; the theme vars did not resolve at runtime). Fix the emit/render/theme
  // if this fails — never weaken the assertion.
  const cellRoleSizes = await page
    .locator(".blux-cell__body [class*='txt-role-text'] :is(h1,h2,h3,h4,h5,h6,p)")
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(cellRoleSizes.length).toBeGreaterThan(0);
  expect(Math.max(...cellRoleSizes)).toBeGreaterThan(40); // default body ~18px; display roles 44–84px
```

- [ ] **Step 2: Run the gate**

The Playwright `webServer` starts `vite dev --host`, which binds `0.0.0.0` and fails under the sandbox (EPERM) — run this command with the sandbox disabled (a known sandbox-caused failure for `--host` binding):

Run: `cd "$START" && pnpm exec playwright test tests/gate/pointe-fidelity.spec.ts`
Expected: 2 passed. In particular the new assertion finds cell-body role blocks and the max computed font-size exceeds 40px (proving the `:root` vars resolved and the baked role divs are sized). If `cellRoleSizes.length` is 0, the regression premise is wrong — investigate the fixture/render, do not delete the assertion.

- [ ] **Step 3: Branch-file lint + commit**

Run: `cd "$START" && pnpm exec prettier --check tests/gate/pointe-fidelity.spec.ts && pnpm exec eslint tests/gate/pointe-fidelity.spec.ts`
Expected: clean.

```bash
cd "$START" && git add tests/gate/pointe-fidelity.spec.ts && git commit -m "test(blux): gate asserts cell-body display roles resolve to their font-size

A big display-role block inside a cell body must compute materially larger
than default body text (>40px). Locks the subtitle/secondary-heading
demotion regression end-to-end (emit body_html + :root theme mirror + render)."
```

---

## After all tasks

- Both branches build + test green; the gate is 2/2 with the new role-sizing assertion.
- Final review: dispatch a code-review over the full diff of both branches (the subagent-driven flow's final reviewer), then hand off via superpowers:finishing-a-development-branch.
- **Not part of this plan (separate session cleanup):** note the pre-existing maintenance lint debt (3 `no-explicit-any` in `resolve-fixture.test.ts`); restore the parked `blux-pointe-live` dir; push `feat/blux-catalog-emit`; reattach the detached main maintenance checkout.

---

## Self-review notes

- **Spec coverage:** model delta (Task 3) · emit `roleWrapHtml`/`textOf`/`buildCell`/`cellToItem` (Task 1) · `spec.ts` CatalogCell (Task 1) · migrate simplification (Task 1, via plain-string `body_html` — no separate task needed) · `:root` runtime mirror (Task 2) · render swap (Task 3) · fixture/theme regen (Task 4) · gate role→font-size (Task 5). Gallery/Carousel have no `body_role` — handled (Task 3 deletes it only in Grid/Section).
- **Non-goals honored:** `title`/`title_role` untouched; no inline-run roles; no back-compat shim (re-migration only).
- **Type consistency:** `bodyHtml` (CatalogCell, camelCase) ↔ `body_html` (Prismic field + BluxCellData, snake_case) ↔ `body_html` (emit item key). `roleWrapHtml(role, inner)` used only in `textOf`. `emitRootVarsCss(theme)`/`themeVarLines(theme)` names consistent across Task 2.
