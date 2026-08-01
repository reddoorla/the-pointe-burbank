// Distinguished Design band — design review round 3, Figma comments 5/6/7.
//
//   5 (node 12:116) "move the icons to a row between the title and graphic"
//   6 (node 21:8)   "white rectangle spans content width behind the graphic"
//   7 (node 3:18)   "move the list to the right of the graphic, increase font size"
//
// The freeze builds this section (`#page-block-3`) as a two-column grid:
//
//   ┌─────────────────────┬─────────────────────┐
//   │ building graphic    │ WHITE PANEL         │
//   │ availability table  │   icon ▸ label ×4   │
//   └─────────────────────┴─────────────────────┘
//
// Figma's target (frame 3:18) rearranges all three pieces:
//
//   ┌─────────────────────────────────────────────┐
//   │  ▸icon    ▸icon    ▸icon    ▸icon           │  full-width row
//   │        ┌──────────────────────────────┐     │
//   │  build │ ing        white band        │ tbl │  band spans content width
//   │        └──────────────────────────────┘     │
//   └─────────────────────────────────────────────┘
//
// Done as CSS rather than a markup transform. Every piece already exists in the
// artifact in the right nesting order; only the boxes move. That keeps the
// token positions untouched, so the freeze↔CMS key agreement cannot drift here.
//
// SCALE. The artifact is Figma's design at 1.0958×: the target's white band is
// 1064px wide inside a 1440 frame, ours is 1166px (`.blocks0container` is
// `max-width:1280px` with 4% padding). Two independent checks confirm the ratio
// rather than assume it — the building's painted ink is 451px wide in Figma and
// 494px here (494/451 = 1.095), and both sit at exactly 0.847 of their own box
// width, i.e. the same asset at the same crop. So every distance below is
// Figma's, expressed as a percentage of a box that carries the same ratio.
//
// The band's vertical placement is pinned to the BUILDING rather than to itself:
// the figure's height is the building's height (the table is taken out of flow),
// so a percentage `top`/`height` on the band resolves against the graphic and
// the three stay locked together at any width.
//
//   Figma          building 633.15 tall, band top 171.04 below its top,
//                  band 341 tall, table 71 below the band's top
//   as % of building height     top 27.0%   height 53.9%   table 38.2%
//
// ON "increase font size" (comment 7). The size it should increase TO is not
// in the design: Figma's list is 13px in a 175px column and ours already
// matched it exactly, 175 × 187.4px against 175 × 186.54, with per-string ink
// within 2px. Two things explain the note, and only one of them is real.
//
// Not real: the staging capture Nicole pasted beside the target (node 21:6) is
// at 0.845 scale, so the live list looked ~18% smaller there than it renders at
// 1440 — the same string, "PREMIER 14-STORY", measures 142px in that capture
// against 168px in a true 1440 render.
//
// Real: everything AROUND the list is 1.0958× the design, so at Figma's
// absolute 13px it reads proportionally smaller here than it does there. The
// list is therefore scaled by that same 1.0958 (see section 4) rather than to a
// number picked by eye — which satisfies the note and leaves the band
// internally consistent. Worth confirming with her, since it is an inference.
//
// Desktop only. Below 1000px the artifact's own 700/600px steps stack these
// blocks into a single column, which is already the right answer on a phone;
// re-flowing a four-across icon row and a half-width graphic into that space
// would only reintroduce the crowding those steps exist to avoid.

/** The four icon cells, whose ids all share this prefix. */
const CELL = '[id^="page-block-3-item-1-item-0-item-"]';

export const DISTINGUISHED_CSS = [
  "@media all and (min-width:1000px){",

  // — 1. Unstack the section's two columns and swap them —
  //
  // `.cagridFlexHeight>.grid-2` pins each column to `min/max-width:50%`, so
  // widening them needs all three width properties, not just `width`.
  '#page-block-3 .cagrid[data-columns="2"]{display:flex;flex-direction:column}',
  '#page-block-3 .cagrid[data-columns="2"]>.cagriditem' +
    "{display:block;width:100%;min-width:100%;max-width:100%;flex:0 0 auto}",
  // Source order is figure-then-icons; the design wants icons first.
  '#page-block-3 .cagrid[data-columns="2"]>.cagriditem:first-child{order:2}',
  '#page-block-3 .cagrid[data-columns="2"]>.cagriditem:last-child{order:1}',

  // The row now starts where the white panel's 100px inset used to, so the
  // section's own 120px top padding leaves it ~93px below where Figma puts it.
  // Three independent anchors agree on that number — the icons' shared baseline
  // (177 in Figma vs 271 here), the labels' first ink row (204 vs 300) and the
  // first icon's ink top (114 vs 205) — and none of them scale, because the
  // title and the icons are the same size in both.
  "#page-block-3>.blocks0container{padding-top:27px}",

  // — 2. Icon stack → icon row —
  //
  // The white fill and left alignment are inline on the block, hence
  // `!important`. Its 100px/80px inline padding goes too: the row's spacing to
  // the title above and the graphic below is set below, measured against Figma.
  "#page-block-3-item-1-item-0{background-color:transparent!important;" +
    "text-align:center!important}",
  "#page-block-3-item-1-item-0>.blocks0container{padding:0 0 79px!important}",
  // 93% keeps Figma's column pitch (247.32px at 1440 → 271px here) rather than
  // spreading four cells across the full content width, which would push the
  // outer two ~30px past where the design puts them.
  '#page-block-3-item-1-item-0 .cagrid[data-columns="1"]' +
    "{display:flex;width:93%;margin:0 auto}",
  '#page-block-3-item-1-item-0 .cagrid[data-columns="1"]>.cagriditem' +
    "{display:block;flex:1 1 0;width:auto;min-width:0;max-width:none;margin:0}",
  // Icon over label instead of beside it: the two holders are `grid-2-r20` /
  // `grid-2-r80` inline-blocks, i.e. a 20/80 split of the row.
  `${CELL}>.blocks0container>.block-content` +
    "{display:flex;flex-direction:column;align-items:center}",
  // A fixed media box bottom-aligns the four icons on one line the way Figma
  // does (its four sit within 3px of a shared 476px baseline) — their artboards
  // differ in height, so aligning the boxes' tops would not align the drawings.
  // 107px is the width the 20% holder gave them, kept so nothing is resized.
  `${CELL} .block-media-holder{display:flex;width:100%;height:107px;` +
    "align-items:flex-end;justify-content:center;margin:0}",
  `${CELL} .block-media-holder>.ib.img{width:107px!important}`,
  // Figma sets 26px between the icons' shared baseline and the labels' first
  // ink row (476 → 503). Stacking the holders alone left 10px, because the old
  // side-by-side arrangement had no vertical gap to inherit.
  `${CELL} .block-title-holder{display:block;width:100%;margin-top:18px}`,
  // The 8px left padding is inline (`pd_0-0-0-8px`) and was the gutter between
  // the icon and the label back when they sat side by side.
  `${CELL} .block-title{padding:0!important;margin:0;text-align:center}`,

  // — 3. Figure: white band behind a half-width graphic, table to its right —
  //
  // `.block-content` becomes the positioning root for both the band and the
  // table. The building stays in flow and therefore still sets the height.
  "#page-block-3-item-0>.blocks0container>.block-content{position:relative}",
  "#page-block-3-item-0>.blocks0container>.block-content:before" +
    '{content:"";position:absolute;left:0;right:0;top:27%;height:53.9%;' +
    "background:#fff;z-index:0}",
  // Positioned so it paints above the band — a static box would lose to it.
  "#page-block-3-item-0>.blocks0container>.block-content>.ib.img" +
    "{width:50%!important;position:relative;z-index:1}",
  // Figma puts the table 658.32px into a 1064px band, 71px below its top.
  "#page-block-3-item-0-item-0{position:absolute;left:61.9%;top:38.2%;" +
    "z-index:1}",
  "#page-block-3-item-0-item-0>.blocks0container{padding:0!important}",

  // — 4. The list, scaled to the band it now sits in (comment 7) —
  //
  // The table was built to Figma's absolute numbers and matches them: 175 ×
  // 187.4px against 175 × 186.54, with per-string ink to within 2px. But the
  // band around it is 1.0958× Figma's, so at 13px the list reads proportionally
  // SMALLER here than in the design — which is the increase Nicole is asking
  // for. Scaling the table by that same 1.0958 makes the band internally
  // consistent instead of picking a size:
  //
  //     font 13→14   line-height 16→17   row gap 10→11
  //     term/suite column 80→88   value column 95→104   gutter 15→16
  //
  // Total width 192px = 175 × 1.0958, row pitch 28px = 26 × 1.0958.
  //
  // Note this is NOT what her side-by-side appears to show: the staging capture
  // she compared against (node 21:6) is at 0.845 scale, so the live list looked
  // ~18% smaller there than it renders at 1440. The proportional argument is
  // the real one, and it lands in the same direction.
  "#page-block-3 .rd-avail-table{font-size:14px;line-height:17px}",
  "#page-block-3 .rd-avail-table th,#page-block-3 .rd-avail-table td" +
    "{padding-bottom:11px}",
  // The base rule that trims the last row is `.rd-avail-table tr:last-child th`
  // at (0,2,1) — the id above outranks it, so without this the table keeps a
  // trailing 11px and stands a full row taller than it should.
  "#page-block-3 .rd-avail-table tr:last-child th," +
    "#page-block-3 .rd-avail-table tr:last-child td{padding-bottom:0}",
  "#page-block-3 .rd-avail-table th.rd-avail-term," +
    "#page-block-3 .rd-avail-table th.rd-avail-suite{width:88px}",
  "#page-block-3 .rd-avail-table td.rd-avail-value" +
    "{width:104px;padding-left:16px}",
  // The mark's width is inline (it carries the aspect ratio with it), so this
  // has to win on !important rather than specificity. `--rd-rule-len` is emitted
  // inline BESIDE that width precisely so the two cannot drift: it is the
  // draw-in dash, resolved in screen pixels via `non-scaling-stroke`, so
  // widening the box without it finishes the animation with a hole in the line.
  "#page-block-3 .rd-avail .rd-rule-box" +
    "{width:22.9px!important;--rd-rule-len:22.9!important}",

  "}",
].join("");
