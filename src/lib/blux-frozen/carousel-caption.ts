// Lush Haven carousel captions (design review comment 10, Figma node 12:130).
//
// The freeze renders each slide's caption as a centred navy title on an opaque
// white bar. Figma restyles it as the double-rule mark above a left-aligned
// white caption sitting directly on the photograph. The mark has to be inserted
// into the markup, so this is a render-time transform rather than pure CSS.
//
// The three captions share one fixed shape in the artifact:
//   <div id="page-block-8-item-N-item-0-item-0" class="blocks0" style="…">
//     <div class="blockcontainer blocks0container" style="padding: 15px 30px;">
//       <div class="block-content"><h5 class="block-title text5">…</h5>
//
// `rd-caption-host` clears the baked white background (inline, so the CSS needs
// !important) and `rd-caption` turns the content box into the Figma stack.

import { ruleMarkBox, RULE_MARK_BOX } from "./rule-mark";

// Group 3 deliberately stops BEFORE `block-content`'s closing quote, so the
// replacement appends a second class inside the attribute rather than emitting
// a stray one after it.
const CAPTION =
  /<div id="(page-block-8-item-\d+-item-0-item-0)" class="blocks0"([^>]*)>(<div class="blockcontainer blocks0container"[^>]*><div class="block-content)">(<h5 class="block-title text5">)/g;

/**
 * Restyle every Lush Haven caption. Unmatched markup is left alone;
 * `carousel-caption.test.ts` asserts all three fire against the real committed
 * artifact, so a re-freeze that reshapes them fails loudly.
 */
export function restyleCarouselCaptions(html: string): string {
  return html.replace(
    CAPTION,
    (_, id: string, rest: string, wrappers: string, heading: string) =>
      `<div id="${id}" class="blocks0 rd-caption-host"${rest}>` +
      `${wrappers} rd-caption">` +
      ruleMarkBox(RULE_MARK_BOX.width, RULE_MARK_BOX.height) +
      heading,
  );
}

/**
 * The caption now sits on a photograph rather than a white bar, so the white
 * type needs its own legibility floor.
 *
 * Round 3 used a soft text shadow alone, deliberately avoiding a scrim to keep
 * Figma's clean look, and flagged the risk: the live slides are bright daylight
 * garden shots where white type washes out. Round 4 settles it — Nicole asked
 * for the scrim twice on the same section, "could we do a slight gradient
 * overlay on the image? maybe that will help..." (node 51:27) and "gradient
 * overlay on top of this image" (node 51:30). The shadow stays underneath it;
 * the two together are what carry the contrast, and the scrim alone would have
 * to be much heavier to do it on its own.
 */
export const CAROUSEL_CAPTION_CSS = [
  // The scrim. Black rather than the brand navy so it reads as shade on a
  // photograph instead of a colour cast, and bottom-weighted so it only darkens
  // the band the caption occupies — the top two-thirds of the image are left
  // completely untouched, which is what keeps it "slight".
  //
  // It sits on the slide's own background box, ABOVE the photograph and BELOW
  // the content: `.block-holder` already carries `position:relative;z-index:2`,
  // so z-index 1 slots the scrim between them without touching either. The
  // slide is `position:relative` for the same reason the nav links are — the
  // artifact already sets it, restated so a re-freeze that drops it cannot
  // silently anchor this to the page instead.
  // Three gradients on one pseudo-element rather than three elements: they are
  // all translucent black, and alpha compositing is order-independent for that,
  // so stacking them as background layers gives the same result as separate
  // overlays for a third of the boxes.
  //
  // The two SIDE gradients are for the arrows, not the caption (Tucker,
  // 2026-08-03: "so the arrows have better contrast on light photos"). The
  // arrows are 32px white glyphs inset 4px, with no plate behind them, and on
  // the bright daylight shots they disappear. Measured on the deploy preview as
  // WCAG contrast against a white glyph, sampling the arrow's own box and
  // excluding the glyph's own pixels:
  //
  //                          before              after
  //   slide 1 right          2.53:1  (p90 1.17)  8.02:1  (p90 3.53)
  //   slide 3 left           5.48:1  (p90 2.00)
  //
  // 1.4.11 asks 3:1 for a control. The median was the honest number to design
  // against but the p90 is the one that fails — a glyph is legible only if its
  // WORST few pixels separate from the photo, which is why the ramp is sized to
  // the arrow rather than to the slide. Fixed pixels, not percentages: the
  // arrow does not grow with the viewport, so a percentage would over-darken a
  // wide slide and under-cover a narrow one. Zero by 168px, well before the
  // caption's first ink at 103px is meaningfully touched (.09 there).
  // A backdrop under the photograph, so the worst case is dim rather than
  // white.
  //
  // The slides are transparent until their picture paints, and what sits behind
  // them is the page's own light background — which is what made the failure
  // mode a WHITE flash specifically. Preloading, the readiness gate and the
  // width cap all shorten the window in which that can happen; none of them can
  // close it, because the gate has to give up eventually or a broken image
  // would freeze the slider. Under 1.6Mbps throttling the 4s cap still expires
  // first.
  //
  // rgb(63,62,40) is the mean colour of the three photographs (109,108,65 /
  // 87,87,52 / 109,104,78 — averaging 102,100,65) taken to 62%, so an unpainted
  // slide reads as the picture not being there yet rather than as a hole in the
  // page. It is never seen once an image has painted: `background-size:cover`
  // leaves no gap at any aspect ratio.
  "#page-block-8 .blocks2{position:relative;background-color:rgb(63,62,40)}",
  '#page-block-8 .blocks2::after{content:"";position:absolute;inset:0;' +
    "z-index:1;pointer-events:none;background:" +
    "linear-gradient(to right,rgba(0,0,0,.45) 0,rgba(0,0,0,.34) 44px," +
    "rgba(0,0,0,.12) 96px,rgba(0,0,0,0) 168px)," +
    "linear-gradient(to left,rgba(0,0,0,.45) 0,rgba(0,0,0,.34) 44px," +
    "rgba(0,0,0,.12) 96px,rgba(0,0,0,0) 168px)," +
    "linear-gradient(to top," +
    "rgba(0,0,0,.55) 0%,rgba(0,0,0,.34) 14%,rgba(0,0,0,.12) 28%," +
    "rgba(0,0,0,0) 45%)}",
  // Round 3: "just needs to move down". Restyling the caption left it at the
  // TOP of the 720px slide, where the freeze's white bar used to sit; Figma
  // (12:130) puts it bottom-left, its frame ending 33px above the photo in an
  // 800px-tall crop — 30px at our 720px height. The slide container already
  // reserves `padding: 40px 0`, so making it a bottom-justified column drops
  // the caption to the floor and the padding sets the gap; trimmed to 30px to
  // match the Figma proportion.
  "#page-block-8 .blocks2container{display:flex;flex-direction:column;" +
    "justify-content:flex-end;padding-bottom:30px}",
  "#page-block-8 .rd-caption-host{background-color:transparent!important;" +
    "text-align:left!important}",
  "#page-block-8 .rd-caption{display:flex;flex-direction:column;gap:10px;" +
    "align-items:flex-start;text-align:left}",
  "#page-block-8 .rd-caption .block-title{margin:0;color:#fff;" +
    "font-family:Montserrat,sans-serif;font-size:15px;font-weight:500;" +
    "line-height:normal;letter-spacing:.03em;text-transform:uppercase;" +
    "text-shadow:0 1px 6px rgba(0,0,0,.55)}",
  "#page-block-8 .rd-caption .rd-rule-box{color:#fff;" +
    "filter:drop-shadow(0 1px 4px rgba(0,0,0,.55))}",
].join("");
