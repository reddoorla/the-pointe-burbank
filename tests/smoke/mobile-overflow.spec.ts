import { test, expect, type Page } from "@playwright/test";

// No page may be wider than a phone or a tablet, and no text a visitor can see
// may run past the right edge. Ported from medical-solutions-of-texas
// tests/smoke/mobile-overflow.spec.ts (reddoorla/medical-solutions-of-texas#100)
// by way of vineyard-custom-homes (reddoorla/vineyard-custom-homes#108), for
// P1-90 (reddoorla/reddoor-maintenance#1876). On 2026-11-01 the home page was
// 335px wide on a 320px phone: the 48px "distinguished" heading in a 305px
// column with no side padding. The original Blux site overflows the same way;
// the fix is a render-time rule in FROZEN_ENHANCE_CSS
// (src/lib/blux-frozen/enhance.ts).
//
// A plain desktop context at the device width, because Chromium's mobile
// emulation zooms the page out to fit and hides the overflow. Three changes
// from MSOT's check. Only text that straddles the edge counts: text wholly past
// it is a closed menu or a carousel slide parked off-screen, not a cut. Text the
// browser does not paint (hidden, or opacity 0) is skipped. And so is a line
// the ancestors that clip it leave nothing of: the sr-only pattern, and a
// slider's parked slides, run past the edge in layout but are never seen. (This
// generalises vineyard-custom-homes#108, which only skipped text inside an
// ancestor clipped to 1px or less; under it a slide parked outside its track's
// window fails.) A box the visitor can scroll (overflow auto or scroll) hides
// nothing they can scroll to.

const ROUTES = ["/", "/contact"];
const WIDTHS = [320, 390, 768, 820, 1024];

async function gotoLoaded(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: "load" });
  // An unpublished page would otherwise measure the error page and pass.
  expect(res?.ok(), `${path} answered ${res?.status()}`).toBe(true);
  // Measure the page script has taken over: `load` fires about 2s before
  // hydration under `vite dev`, which CI's smoke step runs on.
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
}

function measure(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const cut: string[] = [];
    // Whether a box forms a containing block for absolute and fixed
    // descendants other than by `position`: a transform in any of its forms,
    // filter or backdrop-filter, preserve-3d, paint/layout containment
    // (content-visibility: auto applies both), or will-change naming one.
    const formsBlock = (cs: CSSStyleDeclaration) =>
      cs.transform !== "none" ||
      cs.translate !== "none" ||
      cs.rotate !== "none" ||
      cs.scale !== "none" ||
      cs.perspective !== "none" ||
      cs.filter !== "none" ||
      cs.backdropFilter !== "none" ||
      cs.transformStyle === "preserve-3d" ||
      cs.contentVisibility === "auto" ||
      /paint|layout|strict|content/.test(cs.contain) ||
      /transform|translate|rotate|scale|perspective|filter/.test(cs.willChange);
    // The next box up in the flat tree: a slotted node climbs into its slot, and
    // a shadow tree's top climbs out to its host. (A closed shadow root hides
    // its slots from page script, so its clips are not seen.)
    const up = (a: Element): Element | null =>
      a.assignedSlot ??
      a.parentElement ??
      (a.parentNode instanceof ShadowRoot ? a.parentNode.host : null);
    // clip-path and mask-image clip whatever they paint, out-of-flow boxes
    // included, so they apply on every ancestor. Both are taken at the border
    // box: a mask paints nothing outside it, and clip-path is narrowed only for
    // an inset() with no negative inset (`inset(0 -100vmax)` reaches past the
    // box); any other shape leaves the line as it is.
    const clipsToBorderBox = (cs: CSSStyleDeclaration) =>
      cs.maskImage !== "none" || (/^inset\(/.test(cs.clipPath) && !cs.clipPath.includes("-"));
    // How far right a line box can be seen, or null when none of it can be seen
    // on the screen. Each ancestor that clips narrows the line, axis by axis:
    // overflow hidden and clip and paint containment show only the ancestor's
    // padding box, which leaves nothing of the sr-only pattern's 1px box or of a
    // slider's parked slides. auto and scroll let the visitor scroll anything in
    // the box's scrollable extent into view, so past one of those the line can
    // sit anywhere in its box. Overflow and containment do not apply to plain
    // inline boxes. A clipping ancestor only clips boxes whose containing block
    // it is or contains. display: contents boxes have no rect. The returned edge
    // is the line's own right edge, so text cut by a full-width clipping section
    // still fails, except where the line's own block container ends it in an
    // ellipsis (text-overflow, Tailwind's `truncate`): there the text ends where
    // the clip does.
    const seen = (start: Element, line: DOMRect): number | null => {
      let [x0, x1, y0, y1] = [line.left, line.right, line.top, line.bottom];
      let end = line.right;
      // The block container whose inline content the line is: the only box
      // whose text-overflow draws an ellipsis on it.
      let blockOf: Element | null = start;
      while (blockOf && /^(inline|contents)$/.test(getComputedStyle(blockOf).display)) {
        blockOf = up(blockOf);
      }
      // An absolute box skips static ancestors up to its containing block; a
      // fixed box skips everything up to an ancestor that forms one by
      // transform, filter or containment (usually none: then nothing clips it).
      let escaped: "" | "absolute" | "fixed" = "";
      for (let a: Element | null = start; a && a !== document.body; a = up(a)) {
        const cs = getComputedStyle(a);
        if (cs.display === "contents") continue;
        const b = a.getBoundingClientRect();
        if (clipsToBorderBox(cs)) {
          [x0, x1] = [Math.max(x0, b.left), Math.min(x1, b.right)];
          [y0, y1] = [Math.max(y0, b.top), Math.min(y1, b.bottom)];
        }
        const block = formsBlock(cs);
        const containing =
          escaped === "fixed"
            ? block
            : escaped === "absolute"
              ? cs.position !== "static" || block
              : true;
        if (containing && cs.display !== "inline") {
          escaped = "";
          // The padding box, which overflow and paint containment clip to.
          const pl = b.left + a.clientLeft;
          const pt = b.top + a.clientTop;
          const [pr, pb] = [pl + a.clientWidth, pt + a.clientHeight];
          const scrolls = (o: string) => o === "auto" || o === "scroll";
          const paint = /paint|strict|content/.test(cs.contain) || cs.contentVisibility === "auto";
          const xBefore = x1;
          if (scrolls(cs.overflowX)) {
            const l = pl - a.scrollLeft;
            if (Math.min(x1, l + a.scrollWidth) - Math.max(x0, l) <= 1) return null;
            [x0, x1] = [pl, pr];
          } else if (cs.overflowX !== "visible" || paint) {
            [x0, x1] = [Math.max(x0, pl), Math.min(x1, pr)];
          }
          if (scrolls(cs.overflowY)) {
            const t = pt - a.scrollTop;
            if (Math.min(y1, t + a.scrollHeight) - Math.max(y0, t) <= 1) return null;
            [y0, y1] = [pt, pb];
          } else if (cs.overflowY !== "visible" || paint) {
            [y0, y1] = [Math.max(y0, pt), Math.min(y1, pb)];
          }
          if (
            a === blockOf &&
            cs.textOverflow !== "clip" &&
            cs.overflowX !== "visible" &&
            x1 < xBefore - 1
          ) {
            end = Math.min(end, x1);
          }
        } else if (containing) {
          escaped = "";
        }
        if (x1 - x0 <= 1 || y1 - y0 <= 1) return null;
        if (cs.position === "fixed") escaped = "fixed";
        else if (cs.position === "absolute") escaped = "absolute";
      }
      // What the ancestors leave of it must also be on the screen.
      return x0 < vw - 1 && x1 > 1 ? end : null;
    };
    // Every text node, inside open shadow roots too.
    const texts: Text[] = [];
    const collect = (root: Node) => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n instanceof Text) texts.push(n);
        else if (n instanceof Element && n.shadowRoot) collect(n.shadowRoot);
      }
    };
    collect(document.body);
    for (const n of texts) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement ?? (n.parentNode instanceof ShadowRoot ? n.parentNode.host : null);
      if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // Text the page marks inert is out of use: a carousel's peeking
      // next slide (a designed peek, not a cut), or a parked panel.
      if (el.closest("[inert]")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      // A slotted text node is laid out inside its slot, so its clips start there.
      const start = n.assignedSlot ?? el;
      // A line counts when some of it can be seen on the screen and it
      // straddles the right edge.
      const cuts = [...range.getClientRects()].some((r) => {
        const end = seen(start, r);
        return end !== null && end > vw + 1 && r.left < vw - 1;
      });
      if (cuts) cut.push(`<${el.tagName.toLowerCase()}> "${n.textContent.trim().slice(0, 60)}"`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, cut };
  });
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    // Explicit, not inherited from playwright.config.ts: with motion allowed,
    // scroll reveals hold below-the-fold text at opacity 0 at load, and the
    // visibility check would skip it, so a cut there would pass.
    test.use({ viewport: { width, height: 800 }, reducedMotion: "reduce" });

    for (const path of ROUTES) {
      test(`${path} has no horizontal overflow`, { tag: "@smoke" }, async ({ page }) => {
        await gotoLoaded(page, path);
        const { scrollWidth, clientWidth, cut } = await measure(page);
        expect(scrollWidth, `page is wider than ${clientWidth}px`).toBeLessThanOrEqual(clientWidth);
        expect(cut, `text cut off at the ${clientWidth}px edge`).toEqual([]);
      });
    }
  });
}
