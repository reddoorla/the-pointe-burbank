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
  await page.evaluate(() => document.fonts.ready);
}

function measure(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const cut: string[] = [];
    // Whether any of a line box can be seen. Each ancestor that clips (overflow
    // other than visible) narrows it, axis by axis: hidden and clip show only
    // the ancestor's box, which leaves nothing of the sr-only pattern's 1px box
    // or of a slider's parked slides. auto and scroll let the visitor scroll
    // anything in the box's scrollable extent into view, so past one of those
    // the line can sit anywhere in its box. A clipping ancestor only clips boxes
    // whose containing block it is or contains, so an absolute box skips static
    // ancestors up to its positioned one, and a fixed box escapes them all.
    // display: contents boxes have no rect.
    const seen = (el: Element, line: DOMRect) => {
      let [x0, x1, y0, y1] = [line.left, line.right, line.top, line.bottom];
      let escaped = false;
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.display === "contents") continue;
        const containing = cs.position !== "static" || cs.transform !== "none";
        if (!escaped || containing) {
          escaped = false;
          const b = a.getBoundingClientRect();
          const scrolls = (o: string) => o === "auto" || o === "scroll";
          if (scrolls(cs.overflowX)) {
            const l = b.left - a.scrollLeft;
            if (Math.min(x1, l + a.scrollWidth) - Math.max(x0, l) <= 1) return false;
            [x0, x1] = [b.left, b.right];
          } else if (cs.overflowX !== "visible") {
            [x0, x1] = [Math.max(x0, b.left), Math.min(x1, b.right)];
          }
          if (scrolls(cs.overflowY)) {
            const t = b.top - a.scrollTop;
            if (Math.min(y1, t + a.scrollHeight) - Math.max(y0, t) <= 1) return false;
            [y0, y1] = [b.top, b.bottom];
          } else if (cs.overflowY !== "visible") {
            [y0, y1] = [Math.max(y0, b.top), Math.min(y1, b.bottom)];
          }
          if (x1 - x0 <= 1 || y1 - y0 <= 1) return false;
        }
        if (cs.position === "fixed") break;
        if (cs.position === "absolute") escaped = true;
      }
      return true;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement;
      if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      // A line counts when some of it can be seen and its laid-out box
      // straddles the edge. Clipping only decides whether the line is seen; the
      // edge test uses the line itself, so text cut by a full-width clipping
      // section still fails.
      const lines = [...range.getClientRects()].filter((r) => seen(el, r));
      if (lines.some((r) => r.right > vw + 1 && r.left < vw - 1)) {
        cut.push(`<${el.tagName.toLowerCase()}> "${n.textContent.trim().slice(0, 60)}"`);
      }
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
      test(`${path} has no horizontal overflow`, async ({ page }) => {
        await gotoLoaded(page, path);
        const { scrollWidth, clientWidth, cut } = await measure(page);
        expect(scrollWidth, `page is wider than ${clientWidth}px`).toBeLessThanOrEqual(clientWidth);
        expect(cut, `text cut off at the ${clientWidth}px edge`).toEqual([]);
      });
    }
  });
}
