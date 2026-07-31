// The double-rule mark — two horizontal blue lines — used as a section-heading
// accent throughout the site.
//
// The Blux export baked it as two raster PNGs (137x26 and 40x7), which is what
// the design review flagged: it should be vector. Geometry and stroke are taken
// from the Figma source (node 4:37 "lines"), which exports as:
//
//   <line x1="0" y1="0.453988" x2="20.8835" y2="0.453988"
//         stroke="#053A6C" stroke-width="0.907976"/>
//   <line x1="0" y1="4.99388"  x2="20.8834" y2="4.99388" ... />
//
// `stroke` is `currentColor` here rather than a fixed navy: Figma exports the
// same mark white for the Lush Haven caption (node 12:132), so inheriting the
// caption's colour covers both without a second asset.
//
// Like Figma's own export the mark uses `preserveAspectRatio="none"` and
// stretches to whatever box it is given. In-page placements keep the exact box
// the PNG occupied, so swapping raster for vector shifts no layout; the strokes
// stay 1px at any box size via `vector-effect`.

/** `data-media` of each rule PNG the freeze baked in, with its natural size. */
export const RULE_MARK_MEDIA = [
  "ec0c6ec6-45b9-4ac8-84e5-0438c84629b9.png", // 137x26, rendered 50px wide
  "bf56be7d-863c-4f44-8247-6d92ea7762a9.png", // 40x7,   rendered 40px wide
];

/** Figma's box for the mark, used by the two placements the review added. */
export const RULE_MARK_BOX = { width: 20.8835, height: 5.44787 };

const LINE = (y: number) =>
  `<line x1="0" y1="${y}" x2="20.8835" y2="${y}" stroke="currentColor" ` +
  `stroke-width="0.907976" vector-effect="non-scaling-stroke"/>`;

/**
 * The mark itself. Decorative, so it is hidden from assistive tech — the
 * heading it accents carries the meaning.
 */
export function ruleMarkSvg(): string {
  return (
    `<svg class="rd-rule" viewBox="0 0 20.8835 5.44787" fill="none" ` +
    `preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
    LINE(0.453988) +
    LINE(4.99388) +
    "</svg>"
  );
}

const px = (n: number): string => String(+n.toFixed(5));

/**
 * The mark wrapped in a box of an explicit pixel size.
 *
 * `--rd-rule-len` hands the box's rendered width to the draw-in animation, and
 * has to be emitted here beside the width so the two cannot drift apart:
 * `vector-effect="non-scaling-stroke"` makes `stroke-dasharray` resolve in
 * SCREEN pixels, not viewBox units, so a dash sized to the 20.8835-unit viewBox
 * under-covers every placement wider than that. The 50px marks finished as
 * dash-gap-dash and the 40px ones finished half-drawn.
 */
export function ruleMarkBox(widthPx: number, heightPx: number): string {
  const w = px(widthPx);
  return (
    `<span class="rd-rule-box" style="width:${w}px;` +
    `aspect-ratio:${w}/${px(heightPx)};--rd-rule-len:${w}">` +
    ruleMarkSvg() +
    "</span>"
  );
}

/**
 * Swap every baked rule PNG for the vector mark, preserving each element's box.
 * The freeze renders these as a background-image div wrapping a `.mediaRatio`
 * spacer, so width comes from the div's inline `width` and height from the
 * spacer's `padding-bottom` percentage — the same fixed two-element shape the
 * availability artwork used.
 *
 * Unmatched markup is left alone; `rule-mark.test.ts` asserts the swap fires
 * five times against the real committed artifact, so a re-freeze that renames
 * the media fails loudly rather than silently keeping the raster.
 */
export function replaceRuleMarks(
  html: string,
  media: string[] = RULE_MARK_MEDIA,
): string {
  let out = html;
  for (const name of media) {
    const key = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = new RegExp(
      `<div class="ib img imgfit camediaload"([^>]*)data-media="${key}"([^>]*)>` +
        `\\s*<div class="mediaRatio"([^>]*)></div>\\s*</div>`,
      "g",
    );
    out = out.replace(
      block,
      (whole, pre: string, post: string, spacer: string) => {
        const width = /width:\s*([\d.]+px)/.exec(pre + post)?.[1];
        const ratio = /padding-bottom:\s*([\d.]+)%/.exec(spacer)?.[1];
        if (!width || !ratio) return whole; // unexpected shape — leave it be
        const w = parseFloat(width);
        return ruleMarkBox(w, (w * parseFloat(ratio)) / 100);
      },
    );
  }
  return out;
}

/**
 * The mark draws itself on left-to-right as it scrolls into view (design review
 * comment 3). It rides the same reveal the frozen page already runs: FrozenPage
 * adds `rd-fx-wait` to below-the-fold marks and swaps to `rd-fx-run` on
 * intersection, and only ever does so when motion is allowed — so no-JS and
 * reduced-motion users get the finished mark with no animation at all.
 *
 * The dash is `--rd-rule-len` (see `ruleMarkBox`), i.e. the box's own width in
 * screen pixels, so a finished mark is exactly one unbroken dash. There is
 * deliberately no fallback value: should the property ever go missing, both
 * declarations become invalid at computed-value time and fall back to a solid
 * undashed line — the mark stays visible and simply does not animate, rather
 * than animating to a wrong length or vanishing.
 */
export const RULE_MARK_CSS = [
  ".rd-rule-box{display:inline-block;vertical-align:top;color:#053a6c}",
  ".rd-rule{display:block;width:100%;height:100%;overflow:visible}",
  ".rd-rule.rd-fx-wait line{stroke-dasharray:var(--rd-rule-len);" +
    "stroke-dashoffset:var(--rd-rule-len);transition:none}",
  ".rd-rule.rd-fx-run line{stroke-dasharray:var(--rd-rule-len);" +
    "stroke-dashoffset:0;" +
    "transition:stroke-dashoffset .7s cubic-bezier(.2,.55,.88,.95)}",
  ".rd-rule.rd-fx-run line:nth-child(2){transition-delay:.12s}",
].join("");
