import { describe, it, expect } from "vitest";
import {
  widthFor,
  sizeUrl,
  sizeImageSlots,
  type ImageBoxes,
} from "./image-size";
import type { SlotValue } from "./substitute";
import boxes from "./frozen/home.image-boxes.json";
import slots from "./frozen/home.slots.json";

const PRISMIC = "https://images.prismic.io/the-pointe-burbank/abc_photo.jpg";
const CLOUDFRONT = "https://d3syaxnfm3oj0e.cloudfront.net/ea3/w:3600/abc.jpg";

describe("widthFor", () => {
  it("asks for twice the painted box, so 2x displays stay sharp", () => {
    expect(widthFor({ w: 800, h: 600, source: 5000 })).toBe(1600);
  });

  it("rounds up to a shared step instead of minting a variant per box", () => {
    // 823 and 816 are two different boxes on this page; both should land on one
    // CDN render rather than two near-identical ones.
    expect(widthFor({ w: 823, h: 548, source: 5774 })).toBe(1700);
    expect(widthFor({ w: 816, h: 612, source: 2563 })).toBe(1700);
  });

  it("caps a full-bleed band rather than asking for 2850", () => {
    expect(widthFor({ w: 1425, h: 760, source: 3960 })).toBe(2400);
  });

  it("leaves a source that is already small enough alone", () => {
    // The whole ceiling: imgix UPSCALES. Asking w=900 for the 123px LEED badge
    // takes it from 4.9KB to 30KB, so a source at or below what the box needs
    // must never be resized.
    expect(widthFor({ w: 73, h: 73, source: 123 })).toBeNull();
    expect(widthFor({ w: 1425, h: 950, source: 1920 })).toBeNull();
  });

  it("returns null rather than a no-op width equal to the source", () => {
    // `w=<source>` changes nothing but forks the CDN cache key.
    expect(widthFor({ w: 850, h: 500, source: 1700 })).toBeNull();
  });

  it("resizes when the source width is unknown", () => {
    expect(widthFor({ w: 400, h: 300, source: null })).toBe(800);
  });

  it("ignores a box that never painted", () => {
    expect(widthFor({ w: 0, h: 0, source: 5000 })).toBeNull();
  });
});

describe("sizeUrl", () => {
  it("joins with & when the url already has a query", () => {
    expect(sizeUrl(`${PRISMIC}?auto=format,compress`, 1700)).toBe(
      `${PRISMIC}?auto=format,compress&w=1700`,
    );
  });

  it("joins with ? when it does not", () => {
    expect(sizeUrl(PRISMIC, 1700)).toBe(`${PRISMIC}?w=1700`);
  });

  it("leaves hosts that do not understand w= alone", () => {
    // The freeze's committed defaults point at Blux CloudFront, and the offline
    // gate renders from exactly those.
    expect(sizeUrl(CLOUDFRONT, 1700)).toBe(CLOUDFRONT);
  });

  it("does not stack a second width onto one that is already there", () => {
    const already = `${PRISMIC}?auto=format&w=800`;
    expect(sizeUrl(already, 1700)).toBe(already);
  });
});

describe("sizeImageSlots", () => {
  const values = (): Map<string, SlotValue> =>
    new Map<string, SlotValue>([
      ["s6.i0", { url: `${PRISMIC}?auto=format,compress` }],
      ["h.t0", { text: "not an image" }],
    ]);
  const measured: ImageBoxes = {
    viewport: 1440,
    boxes: { "s6.i0": { w: 1425, h: 760, source: 3960 } },
  };

  it("re-points an image slot at the variant its box needs", () => {
    const out = sizeImageSlots(values(), measured);
    expect(out.get("s6.i0")).toEqual({
      url: `${PRISMIC}?auto=format,compress&w=2400`,
    });
  });

  it("leaves text slots and unmeasured slots untouched", () => {
    const out = sizeImageSlots(values(), measured);
    expect(out.get("h.t0")).toEqual({ text: "not an image" });
    expect(sizeImageSlots(values(), { viewport: 1440, boxes: {} })).toEqual(
      values(),
    );
  });

  it("does not mutate the map it was given", () => {
    const before = values();
    sizeImageSlots(before, measured);
    expect(before.get("s6.i0")).toEqual({
      url: `${PRISMIC}?auto=format,compress`,
    });
  });

  it("degrades to today's behaviour with no artifact at all", () => {
    // A site whose freeze predates the measurement should render exactly as it
    // does now, not fail to build.
    expect(sizeImageSlots(values(), null)).toEqual(values());
  });

  it("skips a measured slot the page has no value for", () => {
    const out = sizeImageSlots(new Map(), measured);
    expect(out.size).toBe(0);
  });
});

describe("the committed measurements", () => {
  const artifact = boxes as ImageBoxes;

  it("was measured at the viewport the freeze bakes its layout for", () => {
    // Measuring anywhere else measures a different page; the Playwright gate
    // pins the same 1440.
    expect(artifact.viewport).toBe(1440);
  });

  it("covers every image slot the page actually paints", () => {
    // 50, not the freeze's 56: the review replaced the flattened availability
    // artwork with a real table (-1) and the five baked rule PNGs with inline
    // SVG (-5), so those slots have no painted box to measure.
    expect(Object.keys(artifact.boxes)).toHaveLength(50);
  });

  it("names only slots that exist", () => {
    const known = new Set(
      (slots.slots as { key: string; kind: string }[])
        .filter((s) => s.kind === "image")
        .map((s) => s.key),
    );
    for (const key of Object.keys(artifact.boxes)) {
      expect(known, `${key} is not an image slot`).toContain(key);
    }
  });

  it("measured a real box for every one of them", () => {
    for (const [key, b] of Object.entries(artifact.boxes)) {
      expect(b.w, `${key} measured zero wide`).toBeGreaterThan(0);
      expect(b.h, `${key} measured zero tall`).toBeGreaterThan(0);
    }
  });

  it("actually shrinks the page's heaviest images", () => {
    // The four that dominate the transfer, with the numbers measured on
    // production: 5774px into an 823px box at 1.34MB, and the three carousel
    // slides at 3.4MB between them.
    const shrunk = Object.entries(artifact.boxes).filter(
      ([, b]) => widthFor(b) !== null,
    );
    expect(shrunk.length).toBeGreaterThanOrEqual(26);
    expect(widthFor(artifact.boxes["s10.i1"])).toBe(1700);
    for (const k of ["s6.i0", "s6.i1", "s6.i2"]) {
      expect(widthFor(artifact.boxes[k]), k).toBe(2400);
    }
  });

  it("never asks any slot for more than its source", () => {
    for (const [key, b] of Object.entries(artifact.boxes)) {
      const w = widthFor(b);
      if (w === null || b.source === null) continue;
      expect(w, `${key} would upscale`).toBeLessThan(b.source);
    }
  });
});
