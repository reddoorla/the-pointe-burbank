// Underlines that draw themselves in left-to-right instead of just being there.
//
// Nicole's comment on node 51:42 (2026-08-03) — "could this underline come in
// like the other double line graphic?", pinned on the FIT Health Club body link
// — asks for the double-rule mark's gesture (`rule-mark.ts`) applied to link
// underlines. Same easing and duration as the mark, so the page has one motion
// vocabulary rather than two that nearly match.
//
// Two surfaces, two mechanisms, because the elements differ:
//
//   NAV  — `.navigation0ullia.data-hashlink`, wipes a pseudo-element with
//          `scaleX` from a left origin.
//   BODY — `.links`, paints the underline as a background gradient and animates
//          `background-size`. A pseudo-element cannot be used here: the FIT
//          Health Club link is a true inline that wraps at narrow widths, and an
//          absolutely-positioned line would only underline one fragment.
//          `box-decoration-break:clone` gives each wrapped fragment its own.
//
// TRIGGERS also differ. The body links ride the frozen page's existing
// IntersectionObserver (`rd-fx-wait` → `rd-fx-run`), exactly as the rule marks
// do — they are in the document flow, so "scrolls into view" is meaningful. The
// nav cannot: it is fixed to the top of the viewport, on screen from first
// paint, so an observer would fire during hydration every time. It watches the
// scroll position instead — see `NAV_RUN_CLASS`.
//
// FALLBACKS. No JS: the observer never runs, so body links keep a finished
// underline and the nav simply has none (which is what shipped before, so the
// degraded state is the previous design rather than a broken one). Reduced
// motion: app.css's `@layer base` reset clamps `transition-duration` with
// `!important` — it beats these unlayered rules — so every underline snaps to
// its finished state instead of sweeping.

/** Class `FrozenPage` puts on the `<nav>` once the page has scrolled. */
export const NAV_UNDERLINE_RUN_CLASS = "rd-nav-run";

/** The rule mark's draw easing and duration, reused verbatim. */
const DRAW = ".7s cubic-bezier(.2,.55,.88,.95)";

/** Seconds between one nav item's draw and the next — the mark's own step. */
const STAGGER_STEP = 0.12;

/** How many nav items get a stagger step before the delays stop increasing. */
const STAGGER_ITEMS = 6;

// ── nav ──────────────────────────────────────────────────────────────────────

// Scoped to `.data-hashlink` throughout. That is a class, not an attribute (the
// freeze emits `class="navigation0ullia data-hashlink"`), and it marks the
// in-page nav links. The other two `.navigation0ullia` anchors are the desktop
// and mobile logos, whose content is a background-image div — an underline under
// those would be a line under the wordmark.
const NAV_LINK = ".navigation0ullia.data-hashlink";

// `:nth-child` counts `li.navigation0ulli` within its own `<ul>`. The nav has
// several, but the logos sit alone in theirs and are filtered out by the
// `.data-hashlink` descendant anyway, so the count is over the real nav items:
// 1 = Amenities … 4 = Contact Us.
const navStagger = (): string => {
  const rules: string[] = [];
  for (let i = 2; i <= STAGGER_ITEMS; i++) {
    rules.push(
      `.${NAV_UNDERLINE_RUN_CLASS} .navigation0ulli:nth-child(${i}) ${NAV_LINK}` +
        `::after{transition-delay:${+((i - 1) * STAGGER_STEP).toFixed(2)}s}`,
    );
  }
  // Gated so reduced-motion users do not get the items popping in one at a
  // time — the duration clamp alone would leave the delays intact.
  return `@media (prefers-reduced-motion:no-preference){${rules.join("")}}`;
};

const NAV_CSS = [
  // `position:relative` is already on `.navigation0ullia` in the frozen
  // stylesheet, but it is restated because everything below depends on it: a
  // re-freeze that dropped it would position these lines against the page
  // rather than the link.
  //
  // `bottom:-1px` puts the line on the anchor's own bottom border-edge. The
  // frozen skin already reserves that row (`border-bottom:1px solid transparent`),
  // so the underline lands where that border would paint and nothing reflows.
  `${NAV_LINK}{position:relative}`,
  `${NAV_LINK}::after{content:"";position:absolute;left:0;right:0;bottom:-1px;` +
    `height:1px;background:currentColor;transform:scaleX(0);` +
    `transform-origin:left center}`,
  `.${NAV_UNDERLINE_RUN_CLASS} ${NAV_LINK}::after{transform:scaleX(1);` +
    `transition:transform ${DRAW}}`,
  navStagger(),
].join("");

// ── body links ───────────────────────────────────────────────────────────────

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

const BODY_CSS = [
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

export const UNDERLINE_DRAW_CSS = NAV_CSS + BODY_CSS;
