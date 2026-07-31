import { test, expect, type ConsoleMessage } from "@playwright/test";

// Frozen-render gate. Drives the offline /dev/blux-frozen route (the real
// the-pointe freeze artifacts rendered through the production <FrozenPage>) and
// asserts the page still renders whole: expected height, every media background
// present, the rebuilt panels live, and no residual slot token. Fonts +
// Blux-CDN source images legitimately load from third-party hosts here (dev
// fixture); real errors still fail via `pageerror`.
//
// This started as a pure fidelity gate against the pre-review original. The
// design review (2026-07-30) intentionally diverges from that original, so the
// numbers below track the CURRENT intended render, not the freeze output.
const ALLOWED_CONSOLE: RegExp[] = [
  /cloudfront\.net/i,
  /fonts\.g(oogleapis|static)\.com/i,
  /vimeo/i,
];
const allowed = (s: string) => ALLOWED_CONSOLE.some((re) => re.test(s));

// The freeze settles + bakes the export's layout at a 1440px viewport, and its
// full-bleed bands are sized relative to viewport width, so the gate MUST
// measure at that same width.
export const GATE_VIEWPORT_WIDTH = 1440;
test.use({ viewport: { width: GATE_VIEWPORT_WIDTH, height: 900 } });

test("frozen the-pointe renders whole: ~14820px, 50 media, panels live, no tokens", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m: ConsoleMessage) => {
    if (
      m.type() === "error" &&
      !allowed(m.text()) &&
      !allowed(m.location()?.url ?? "")
    ) {
      errors.push(m.text());
    }
  });
  page.on("pageerror", (e) => {
    if (!allowed(e.message)) errors.push(e.message);
  });

  await page.goto("/dev/blux-frozen", { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  // Wait for web fonts to settle (they drive text height) rather than a blind sleep.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(500);

  // Wrong-viewport guard, asserted directly rather than inferred from height.
  // The height band used to double as one — 1440 vs 1280 differed by ~530px —
  // but the review's tighter leading shrank that to ~150px (14822 vs 14669),
  // inside the band's environment tolerance. Measuring the width itself keeps
  // the check exact: a change to `test.use` or to the Playwright project config
  // fails here, instead of silently measuring a different layout and passing.
  const measuredWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(measuredWidth).toBe(GATE_VIEWPORT_WIDTH);

  // ~14820px: the original Blux layout (~15333px) less the design review's
  // deliberate reductions (2026-07-30) — tightened leading on .text1/.text11/
  // .text12, the halved Burbank-Portfolio/video seam, the tighter amenities
  // heading block, three removed hairlines, and the rebuilt availability panel.
  // The band is wide enough for cross-environment text reflow (macOS vs CI
  // Linux, Google-Map tiles blocked by CSP) and catches gross regressions such
  // as the unstyled semantic render (16487px). Wrong viewports are the width
  // assertion's job, not this band's.
  const height = await page.evaluate(() => document.body.scrollHeight);
  expect(height).toBeGreaterThan(14520);
  expect(height).toBeLessThan(15130);

  // The data-* backgrounds are baked as inline declarations. 50, not the
  // freeze's 56: the review replaced the flattened availability artwork with a
  // real table (-1) and the five baked rule PNGs with inline SVG (-5).
  const backgrounds = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>("*")].filter((e) =>
        /url\(/.test(e.style.backgroundImage),
      ).length,
  );
  expect(backgrounds).toBeGreaterThanOrEqual(50);

  // The pieces that replaced those rasters are live: the availability panel
  // renders as text, and every rule mark is vector.
  const rebuilt = await page.evaluate(() => ({
    panelText: document.querySelector(".rd-avail")?.textContent ?? "",
    ruleMarks: document.querySelectorAll("svg.rd-rule").length,
    rulePngs: document.querySelectorAll(
      '[data-media*="ec0c6ec6"],[data-media*="bf56be7d"]',
    ).length,
    navItems: document.querySelectorAll("a.navigation0ullia.data-hashlink")
      .length,
  }));
  expect(rebuilt.panelText).toContain("480,000 SF");

  // The availability panel replaced a flattened PNG so its type would render
  // from the font rather than from pixels; these are the numbers that make the
  // rebuild faithful to Figma node 4:36 rather than merely close to it.
  // 175px = an 80px term column + a 95px border-box value cell (15px gutter +
  // 80px column), and every string is real selectable text.
  const panel = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".rd-avail-table");
    if (!el) return null;
    const cell = el.querySelector<HTMLElement>("td.rd-avail-value");
    const term = el.querySelector<HTMLElement>("th.rd-avail-term");
    return {
      width: +el.getBoundingClientRect().width.toFixed(2),
      height: +el.getBoundingClientRect().height.toFixed(2),
      termWidth: +(term?.getBoundingClientRect().width ?? 0).toFixed(2),
      valueWidth: +(cell?.getBoundingClientRect().width ?? 0).toFixed(2),
      fontSize: cell ? getComputedStyle(cell).fontSize : "",
      color: term ? getComputedStyle(term).color : "",
      rows: el.querySelectorAll("tr").length,
    };
  });
  expect(panel, "availability panel did not render").not.toBeNull();
  const { height: panelHeight, ...panelBox } = panel!;
  expect(panelBox).toEqual({
    width: 175,
    termWidth: 80,
    valueWidth: 95,
    fontSize: "13px",
    color: "rgb(5, 58, 108)",
    rows: 8, // total + rule + heading + 5 suites
  });
  // 187.45px, matching Figma's 187px frame. Fully determined by fixed
  // line-heights, paddings and the mark's aspect-ratio — no font metrics — so
  // it is stable across platforms. This catches the class of bug the per-row
  // pitch check missed: the rule-mark row inheriting the 16px text line-height
  // stood 26px instead of 15.4px, shifting the heading and all five suites
  // down while every individual pitch still measured a correct 26px.
  expect(panelHeight).toBeCloseTo(187.45, 1);
  expect(rebuilt.ruleMarks).toBe(9);
  expect(rebuilt.rulePngs).toBe(0);
  // Nav is a single "Availability" item after the review.
  expect(rebuilt.navItems).toBe(1);

  // Each mark's draw-in dash must equal its own rendered width. The marks carry
  // `vector-effect="non-scaling-stroke"`, which resolves stroke-dasharray in
  // SCREEN pixels rather than viewBox units, so any mismatch finishes the
  // animation with a hole in the line — 50px marks drew dash-gap-dash and 40px
  // marks drew half-length. Checked against the computed property rather than
  // the animation, so it needs no timing and cannot flake.
  const dashMismatches = await page.evaluate(() =>
    [...document.querySelectorAll<SVGSVGElement>("svg.rd-rule")]
      .map((s) => ({
        width: +s.getBoundingClientRect().width.toFixed(2),
        dash: parseFloat(getComputedStyle(s).getPropertyValue("--rd-rule-len")),
      }))
      .filter((m) => m.width > 0 && !(Math.abs(m.width - m.dash) < 0.01)),
  );
  expect(dashMismatches).toEqual([]);

  // The Burbank Incentives hover has to WIN the cascade, which no CSS-string
  // test can tell you: the freeze ships its own `.buttons2:hover` rule, and an
  // enhance rule written without the `#page-block-11` id scores lower and
  // loses silently. So hover it for real. The `::before` check catches the old
  // link underline the freeze draws as a pseudo-element coming back.
  const cta = page.locator("#page-block-11 .buttons2");
  await cta.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const atRest = await cta.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    fg: getComputedStyle(el).color,
    underline: getComputedStyle(el, "::before").display,
  }));
  expect(atRest).toEqual({
    bg: "rgb(255, 255, 255)",
    fg: "rgb(5, 58, 108)",
    underline: "none",
  });
  await cta.hover();
  await page.waitForTimeout(300);
  const onHover = await cta.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    fg: getComputedStyle(el).color,
  }));
  expect(onHover).toEqual({ bg: "rgb(5, 58, 108)", fg: "rgb(255, 255, 255)" });

  // Landmark structure. The Blux export ships a nav and a footer but no main,
  // and a frozen page renders bare — the root layout skips its own
  // <main id="main-content"> — so nothing else supplies one. The nav and footer
  // must stay OUTSIDE it: nested inside <main> they stop being their own
  // landmarks, which is what a naive "wrap the whole body" fix would do.
  const landmarks = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      mains: document.querySelectorAll("main").length,
      mainId: main?.id ?? null,
      navsOutside: document.querySelectorAll("nav").length,
      navInsideMain: !!main?.querySelector("nav"),
      footerInsideMain: !!main?.querySelector("footer"),
    };
  });
  expect(landmarks).toEqual({
    mains: 1,
    mainId: "page-content",
    navsOutside: 1,
    navInsideMain: false,
    footerInsideMain: false,
  });

  // Footer spacer. The export encodes the blank line between "Lic. 00852254"
  // and the next contact block as a list item whose VALUE is " &nbsp;" — layout
  // stored as content. Prismic Rich Text cannot hold a whitespace-only value, so
  // the migration round-tripped it to "" and the row collapsed from 32px to its
  // 8px of padding, silently shortening the page by 24px. `restoreSpacerSlots`
  // refills it; this measures the row rather than the CSS, because the repair
  // has to survive both render paths (freeze defaults here, Prismic in prod).
  const spacer = await page.evaluate(() => {
    const lis = [...document.querySelectorAll("li.footer0ulli")];
    const at = lis.findIndex((li) => li.textContent?.includes("Lic. 00852254"));
    const next = lis[at + 1];
    return {
      found: at !== -1 && !!next,
      // The row is text-driven: one 24px line-height plus 4px padding each side.
      height: next ? +next.getBoundingClientRect().height.toFixed(2) : 0,
      // …and it must be the blank one, not the next real contact line.
      blank: (next?.textContent ?? "x").trim() === "",
      // The three OTHER empty items in this list draw their height from padding
      // alone. A CSS `:empty` fix would have grown all three; these numbers fail
      // if anyone reaches for one.
      paddingSpacers: lis
        .filter((li) => (li.textContent ?? "x").trim() === "")
        .map((li) => +li.getBoundingClientRect().height.toFixed(2)),
    };
  });
  expect(spacer).toEqual({
    found: true,
    height: 32,
    blank: true,
    paddingSpacers: [74, 44, 32, 100, 32],
  });

  // No residual slot token survived substitution.
  expect(await page.content()).not.toContain("⟦");
  expect(errors).toEqual([]);
});
