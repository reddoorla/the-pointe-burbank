import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// Plan 4d fidelity gate. Drives the offline /dev/blux-pointe route (the real
// the-pointe catalog fixture rendered through the production SliceZone + chrome)
// under the same webServer the a11y/smoke suites use, asserts it renders and
// hydrates cleanly, and dumps the rendered HTML. That dump feeds the
// maintenance coverage gate (tests/blux/catalog/pointe-coverage.test.ts) only
// when POINTE_RENDERED_HTML points at it; that gate's DEFAULT artifact is the
// `pnpm run build` prerender — both render the same fixture identically.

// Console noise that isn't actionable for an OFFLINE render, scoped to the
// third-party HOSTS whose resources legitimately 404/telemetry-fail without a
// live CDN (matched against both the message text and the resource URL). NOT a
// broad "Failed to load resource" catch — a 404 on a LOCAL asset must fail the
// gate — and a real execution failure surfaces via `pageerror` regardless.
const ALLOWED_CONSOLE: RegExp[] = [
  /cloudfront\.net/i, // export images have no live CDN in the gate
  /maps\.googleapis|maps\.google/i,
  /vimeo/i,
  /turnstile|challenges\.cloudflare/i,
];

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  const allowed = (s: string) =>
    !!s && ALLOWED_CONSOLE.some((re) => re.test(s));
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const url = m.location()?.url ?? "";
    if (allowed(text) || allowed(url)) return;
    errors.push(`[console.error] ${text}${url ? ` (${url})` : ""}`);
  });
  page.on("pageerror", (e) => {
    if (!allowed(e.message)) errors.push(`[pageerror] ${e.message}`);
  });
  return errors;
}

test("the-pointe catalog fixture renders faithfully; HTML dumped for coverage", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto("/dev/blux-pointe");

  // Chrome renders once (from the app layout, fed by the fixture page data).
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.getByText("Todd Doney")).toBeVisible();
  // The map widget's static markup is present (hydration is keyless in CI).
  await expect(page.locator(".blux-map")).toHaveCount(1);
  await expect(page.locator("#burbank_map")).toHaveCount(1);
  // Band content rendered through the SliceZone.
  await expect(page.getByText(/Burbank/i).first()).toBeVisible();

  // No unexpected console errors beyond the offline-render allowlist.
  expect(errors).toEqual([]);

  // Dump the rendered HTML so the maintenance coverage gate can score it
  // (POINTE_RENDERED_HTML → this path).
  const html = await page.content();
  mkdirSync("test-results/gate", { recursive: true });
  writeFileSync("test-results/gate/pointe-rendered.html", html);
});

// The visual-fidelity layer: assert the emitted data actually resolves into
// layout (a real flex-basis grid, band padding, cover crops, type-role
// wrapping, laid-out heights). A failure here is a REAL fidelity gap — fix the
// render/emit, never weaken the assertion.
test("catalog visual layer resolves grid, cover, padding, and type roles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dev/blux-pointe");

  // Grid columns resolve to a real flex-basis (not 'auto') at desktop.
  const cell = page.locator(".blux-grid__cells > .blux-cell").first();
  const basis = await cell.evaluate((el) => getComputedStyle(el).flexBasis);
  expect(basis).not.toBe("auto");
  expect(basis).toMatch(/\d/); // a resolved length/percentage

  // At least one band wrapper carries resolved horizontal padding (band-pad →
  // content_padding). Some bands are "40px 0" (zero horizontal), so check the
  // MAX across wrappers — not the first, which may legitimately be 0.
  const pads = await page
    .locator(".blux-grid__cells, .blux-section__cells")
    .evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).paddingLeft)),
    );
  expect(Math.max(...pads)).toBeGreaterThan(0);

  // Cover media crops via object-fit (only asserted when the fixture has
  // cover cells — the-pointe may have none).
  const cover = page.locator(".blux-cell__media[data-cover='on'] img");
  if (await cover.count()) {
    await expect(cover.first()).toHaveCSS("object-fit", "cover");
  }

  // Type-role wrapping is applied to real text runs.
  await expect(page.locator("[class*='txt-role-text']").first()).toBeVisible();

  // Role SIZING resolves at runtime: at least one big display-role block inside
  // a cell body computes to a materially larger font-size than default body
  // text. Locks the regression where cell subtitles / secondary headings kept
  // the role CLASS but rendered at default size (RichText could not carry the
  // class; the theme vars did not resolve at runtime). Fix the emit/render/theme
  // if this fails — never weaken the assertion.
  const cellRoleSizes = await page
    .locator(
      ".blux-cell__body [class*='txt-role-text'] :is(h1,h2,h3,h4,h5,h6,p)",
    )
    .evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );
  expect(cellRoleSizes.length).toBeGreaterThan(0);
  expect(Math.max(...cellRoleSizes)).toBeGreaterThan(40); // default body ~18px; display roles 44–84px

  // The tallest band is at least the fold tall — a real, laid-out page.
  const tallest = await page
    .locator("section.blux-grid, section.blux-section")
    .evaluateAll((els) =>
      Math.max(...els.map((el) => el.getBoundingClientRect().height)),
    );
  expect(tallest).toBeGreaterThan(600);
});
