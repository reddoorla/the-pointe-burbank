// Ask the image CDN for the size the page actually paints, not the size the
// Blux export happened to ship.
//
// THE PROBLEM. A frozen Blux page inherits whatever CDN variant the export was
// using, which bears no relation to the box the browser paints it into. On
// the-pointe: a 5774px-wide file (1.34MB) into an 823px box, a 5341px one into
// a 1425px band, 3960px carousel slides into 1425x760. Measured on production,
// 50 images cost 5.06MB of which 4.03MB is in oversized ones.
//
// That is not only weight. It is what made the carousel's white flash so hard
// to kill: preloading and waiting for `decode()` are both races against the
// download, and none of them can be won while the download is seven times
// larger than it needs to be.
//
// WHERE IT IS APPLIED. To the slot VALUES, before `substitute` puts them in the
// template — not by rewriting html afterwards. The values are keyed by slot, so
// each url is matched to its own measured box exactly, with no parsing, no
// element identification, and no risk of appending a query parameter outside
// the quotes `substitute` emits (a bug that shipped once and that a
// `toContain` assertion passed straight over).
//
// THE CEILING IS REAL. imgix upscales: asking w=900 for the 123px LEED badge
// grows it from 4.9KB to 30KB. So `source` — the CDN variant width the freeze
// recorded, which is what was migrated into Prismic — is a hard ceiling, and a
// slot whose source is already at or below what its box needs is left alone.
//
// The boxes come from `frozen/<uid>.image-boxes.json`, measured by
// `scripts/measure-image-boxes.mjs` against a laid-out page. They cannot be
// derived from the markup: Blux sizes these with CSS, so an element carrying
// `width:5774px` renders into 823px.

import type { SlotValue } from "./substitute";

/** One image's painted box at the freeze viewport, plus its source width. */
export interface ImageBox {
  /** Painted width in CSS px. */
  w: number;
  /** Painted height in CSS px, recorded for diagnosis rather than used here. */
  h: number;
  /** The CDN variant width the freeze recorded, or null if it had none. */
  source: number | null;
}

export interface ImageBoxes {
  /** Viewport the boxes were measured at — the freeze's own layout width. */
  viewport: number;
  boxes: Record<string, ImageBox>;
}

/**
 * Widest variant worth requesting.
 *
 * A full-bleed band is 1425px at the 1440 freeze viewport and wants 2850 for a
 * 2x display, which is more picture than these photographs repay: they sit
 * under a scrim at `background-size:cover`, where the eye is forgiving in a way
 * it would not be with type or line-art. 2400 covers a 2400px viewport at 1x
 * and a 1200px one at 2x, and it is where the size curve flattens — the
 * carousel's worst slide is 1399KB at source, 647KB at 2400 and 537KB at 1920,
 * so the last 480px of width costs a tenth of what the first 1560 saved.
 */
const MAX_WIDTH = 2400;

/** Painted CSS px are multiplied by this, so 2x displays stay sharp. */
const DPR = 2;

/**
 * Variants are rounded up to this, so a hundred slightly different boxes do not
 * become a hundred separate CDN renders and cache entries.
 */
const STEP = 100;

/** Only Prismic understands `w=`; the freeze's own defaults point elsewhere. */
const SIZEABLE = "images.prismic.io";

/**
 * The width to request for a box, or null to leave the url alone.
 *
 * Null rather than the source width when no reduction is available: adding
 * `w=<source>` would be a no-op that still forks the CDN cache key.
 */
export function widthFor(box: ImageBox, max = MAX_WIDTH): number | null {
  if (!box.w) return null;
  const want = Math.min(max, Math.ceil((box.w * DPR) / STEP) * STEP);
  if (box.source !== null && want >= box.source) return null;
  return want;
}

/** Append `w=` to a url, respecting whatever query it already carries. */
export function sizeUrl(url: string, width: number): string {
  if (!url.includes(SIZEABLE)) return url;
  if (/[?&]w=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}w=${width}`;
}

/**
 * Re-point every image slot at a variant sized to its own painted box.
 *
 * Slots with no measured box, no url, or nothing to gain are passed through
 * untouched, so an artifact measured before a re-freeze degrades to today's
 * behaviour rather than to a broken page.
 */
export function sizeImageSlots(
  values: Map<string, SlotValue>,
  boxes: ImageBoxes | null,
  max = MAX_WIDTH,
): Map<string, SlotValue> {
  if (!boxes) return values;
  const out = new Map(values);
  for (const [key, box] of Object.entries(boxes.boxes)) {
    const value = out.get(key);
    if (!value?.url) continue;
    const width = widthFor(box, max);
    if (width === null) continue;
    out.set(key, { ...value, url: sizeUrl(value.url, width) });
  }
  return out;
}
