// Body-link underlines that draw themselves in left-to-right instead of just
// being there.
//
// Nicole's comment on node 51:42 (2026-08-03) — "could this underline come in
// like the other double line graphic?", pinned on the FIT Health Club body link
// — asks for the double-rule mark's gesture (`rule-mark.ts`) applied to link
// underlines. Same easing and duration as the mark, so the page has one motion
// vocabulary rather than two that nearly match.
//
// SCOPE. Body links only. Round 4 briefly gave the NAV the same treatment, on a
// reading of that comment as covering links generally; the pin is on a body
// link, and the nav lines were dropped on 2026-08-03 for looking wrong under the
// items. The nav is back to carrying no underline at all, which is what the
// export always did — so there is deliberately no `.navigation0ullia` rule here,
// and `enhance.test.ts` asserts the absence rather than leaving it to memory.
//
// MECHANISM. The underline is painted as a background gradient and animated
// through `background-size`. A pseudo-element cannot be used: the FIT Health
// Club link is a true inline that wraps at narrow widths, and an absolutely
// positioned line would only underline one fragment.
// `box-decoration-break:clone` gives each wrapped fragment its own.
//
// TRIGGER. The links ride the frozen page's existing IntersectionObserver
// (`rd-fx-wait` → `rd-fx-run`), exactly as the rule marks do — they are in the
// document flow, so "scrolls into view" is meaningful.
//
// FALLBACKS. No JS: the observer never runs, so links keep a finished
// underline. Reduced motion: app.css's `@layer base` reset clamps
// `transition-duration` with `!important` — it beats these unlayered rules — so
// the underline snaps to full width instead of sweeping.

/** The rule mark's draw easing and duration, reused verbatim. */
const DRAW = ".7s cubic-bezier(.2,.55,.88,.95)";

/**
 * Where the underline sits, as `calc(EM em + 4px)` from the top of the anchor's
 * content box.
 *
 * app.css draws these with `text-decoration:underline 1px` +
 * `text-underline-offset:4px`, which this replaces — a text-decoration cannot be
 * wiped across, only a painted box can. The replacement has to land on the SAME
 * pixel row or the swap shows up as the underline jumping when it settles.
 *
 * The `+ 4px` is `text-underline-offset` (a fixed length, so it does not scale);
 * the em part is the font's own ascent + underline position, which does. Solved
 * from the two font sizes actually on the page, measured by ink coverage on
 * rendered screenshots rather than derived from font tables:
 *
 *     22px (Martel, "FIT Health Club")     row 29     → (29 - 4) / 22 = 1.1364
 *     18px (Montserrat, "Visit Website")   row 24/25  → (24.5 - 4) / 18 = 1.1389
 *
 * The 18px links measure 24 on four of them and 25 on three — identical
 * elements, so that spread is subpixel rounding from their y-position on the
 * page, and the true value is the 24.5 midpoint. 1.137 reproduces both: 29.01 at
 * 22px and 24.47 at 18px, i.e. under 0.03px from measured at both sizes.
 */
const UNDERLINE_EM = 1.137;

// Id-scoped, and it must be: app.css's `.links` is unlayered at (0,1,0), so a
// bare `.links` rule here would tie it and fall to source order — which depends
// on whether the bundled stylesheet or this injected <style> lands later in the
// head. `#page-content` is the wrapper `addMainLandmark` promotes to <main>, and
// it contains all eight `.links` anchors (the footer's links carry
// `.footer0ullia` instead).
const BODY_LINK = "#page-content .links";

export const UNDERLINE_DRAW_CSS = [
  `${BODY_LINK}{text-decoration:none;` +
    `background-image:linear-gradient(currentColor,currentColor);` +
    `background-repeat:no-repeat;background-size:100% 1px;` +
    `background-position:0 calc(${UNDERLINE_EM}em + 4px);` +
    `-webkit-box-decoration-break:clone;box-decoration-break:clone}`,
  // Armed only for anchors fully below the fold, by the same observer that
  // drives `.block-effects` and `.rd-rule`; anything already on screen keeps the
  // finished underline and never blinks.
  `${BODY_LINK}.rd-fx-wait{background-size:0 1px;transition:none}`,
  `${BODY_LINK}.rd-fx-run{background-size:100% 1px;` +
    `transition:background-size ${DRAW}}`,
].join("");
