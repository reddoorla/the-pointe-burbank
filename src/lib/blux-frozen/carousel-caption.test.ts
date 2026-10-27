import { describe, it, expect } from "vitest";

import { restyleCarouselCaptions, CAROUSEL_CAPTION_CSS } from "./carousel-caption";
import template from "./frozen/home.html?raw";

describe("restyleCarouselCaptions", () => {
  const out = restyleCarouselCaptions(template);

  it("restyles all three Lush Haven captions in the real artifact", () => {
    expect([...out.matchAll(/rd-caption-host/g)]).toHaveLength(3);
    expect([...out.matchAll(/block-content rd-caption"/g)]).toHaveLength(3);
  });

  it("keeps the captions' own ids and content tokens", () => {
    expect(out).toContain('id="page-block-8-item-0-item-0-item-0"');
    expect(out).toContain("⟦t:s6.t0⟧");
    expect(out).toContain("⟦t:s6.t1⟧");
    expect(out).toContain("⟦t:s6.t2⟧");
  });

  it("leaves markup alone when the captions are absent", () => {
    const html = "<div>no carousel here</div>";
    expect(restyleCarouselCaptions(html)).toBe(html);
  });
});

describe("CAROUSEL_CAPTION_CSS", () => {
  it("clears the baked white bar (inline, so !important)", () => {
    expect(CAROUSEL_CAPTION_CSS).toContain("background-color:transparent!important");
  });

  it("stacks the mark over a left-aligned white caption, per Figma", () => {
    expect(CAROUSEL_CAPTION_CSS).toContain("flex-direction:column");
    expect(CAROUSEL_CAPTION_CSS).toContain("gap:10px");
    expect(CAROUSEL_CAPTION_CSS).toContain("align-items:flex-start");
    expect(CAROUSEL_CAPTION_CSS).toContain("color:#fff");
    expect(CAROUSEL_CAPTION_CSS).toContain("font-size:15px");
  });

  it("gives the white type a legibility floor over photography", () => {
    expect(CAROUSEL_CAPTION_CSS).toContain("text-shadow");
  });

  it("puts a dim backdrop under the photographs, not the page's light one", () => {
    // The slides are transparent until their picture paints, and the page
    // behind them is light — which is what made the failure mode a WHITE flash.
    // The preload, the readiness gate and the width cap all shorten that window
    // without closing it: the gate must give up eventually or a broken image
    // would freeze the slider.
    const rule = /#page-block-8 \.blocks2\{([^}]*)\}/.exec(CAROUSEL_CAPTION_CSS)?.[1];
    expect(rule).toContain("background-color:rgb(63,62,40)");
    // Darker than either photograph's mean, so it never reads as a bright hole.
    const [r, g, b] = [63, 62, 40];
    const mean = (109 + 87 + 109 + 108 + 87 + 104 + 65 + 52 + 78) / 9;
    expect((r + g + b) / 3).toBeLessThan(mean);
  });

  it("scrims the sides as well as the bottom, for the arrows", () => {
    // One pseudo-element carries all three gradients. The bottom one is the
    // caption's (Nicole, 51:27 + 51:30); the two side ones are the arrows'.
    const rule = /#page-block-8 \.blocks2::after\{([^}]*)\}/.exec(CAROUSEL_CAPTION_CSS)?.[1];
    expect(rule, "the scrim rule moved").toBeTruthy();
    // GUARD: the side ramps are what lift the white arrow glyph on slide 1's
    // right from 1.17:1 to 3.53:1 at p90 (median 2.53:1 to 8.02:1), against WCAG
    // 1.4.11's 3:1 (measured in carousel-caption.ts). Slide 1 right, the
    // brightest background in that table, is the binding case: see the floor
    // test below.
    // This is a CSS-string proxy for that contrast; no gate test computes it.
    expect(rule).toContain("linear-gradient(to right,");
    expect(rule).toContain("linear-gradient(to left,");
    expect(rule).toContain("linear-gradient(to top,");
  });

  it("keeps both arrow scrims dark enough for a 3:1 control over the arrow", () => {
    // The floor is derived from carousel-caption.ts's own measured table, the
    // p90 contrast of the white glyph against the unscrimmed photo:
    const P90_UNSCRIMMED = { "slide 1 right": 1.17, "slide 3 left": 2.0 };
    // A white glyph (L = 1) at contrast C sits on a background of luminance
    // L = 1.05 / C - 0.05. Browsers composite the black overlay in encoded
    // sRGB, so alpha a scales the encoded value V to V * (1 - a), and the
    // glyph reaches 3:1 when the background's luminance drops to
    // 1.05 / 3 - 0.05 = 0.300 (V = 0.584). So a >= 1 - 0.584 / V(L):
    //   slide 1 right: L = 1.05 / 1.17 - 0.05 = 0.847, V = 0.930, a >= 0.372
    //   slide 3 left:  L = 1.05 / 2.00 - 0.05 = 0.475, V = 0.719, a >= 0.188
    // Slide 1 right binds. Calibration against the same table: its measured
    // "after" p90 of 3.53:1 needs a = 0.425 in this model, which the shipped
    // ramp reaches 10px from the edge, just outside the ink's start at 11.9px.
    // At a flat .34 the model gives 2.73:1, under the floor.
    const encode = (l: number) => (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
    const background = (contrast: number) => 1.05 / contrast - 0.05;
    const needed = (contrast: number) => 1 - encode(background(3)) / encode(background(contrast));
    const [binding, FLOOR] = Object.entries(P90_UNSCRIMMED)
      .map(([slide, c]) => [slide, needed(c)] as const)
      .reduce((a, b) => (b[1] > a[1] ? b : a));
    // The floor applies where the glyph has ink. The arrow is a 32px icon
    // inset 4px whose chevron path (`#site-icon-left`/`-right` in the frozen
    // artifact, viewBox 32) spans x 8.64-23.36, and hover scales it 1.1 about
    // its centre: 16 -/+ 7.36 * 1.1 = 7.90-24.10, plus the 4px inset, is
    // 11.9-28.1px from the slide's edge. WCAG 1.4.11 measures the glyph
    // against the colours adjacent to it, so the span takes a pixel either
    // side: 10.9-29.1px. The shipped ramp is .36 at 36px, the icon box's inner
    // edge, and its lowest point over that span is .377 at 29.1px, 0.005
    // clear. A floor, not the shipped .45: a darker ramp, or a different curve
    // that stays above it, is a designer's call.
    const [INK_FROM, INK_TO] = [10.9, 29.1];
    const ramps = new Map(
      [
        ...CAROUSEL_CAPTION_CSS.matchAll(
          /linear-gradient\(to (right|left),((?:[^()]|\([^()]*\))*)\)/g,
        ),
      ].map((m) => [m[1], m[2]]),
    );
    // The ramp is piecewise linear, so its lowest alpha over the ink span is at
    // a stop inside it or at one of its two ends: check all of those. Stops are
    // read up to the first one at or past the span's end, which is the last
    // one that shapes the ramp over the ink. A % stop cannot be placed against
    // the arrow's fixed px geometry, so one in that run fails rather than being
    // guessed or skipped.
    const floorPoints = (ramp: string, side: string) => {
      // Every stop, split at the ramp's top-level commas. Up to the ink span's
      // end each one must be black at a px position: a `transparent`, an
      // `hsl()` or a white stop would otherwise drop out of the reading and
      // the interpolation would run straight across a clear patch. The parser
      // accepts only `rgba(0,0,0,a)`, so a red from a darker ramp written in
      // another syntax is about the syntax, not the contrast.
      const stops = ramp
        .split(/,(?![^(]*\))/)
        .map((t) => t.trim())
        .filter(Boolean);
      expect(stops.length, `no stops in the "to ${side}" ramp`).toBeGreaterThan(0);
      const placed: { a: number; at: number }[] = [];
      for (const stop of stops) {
        if (placed.length && placed[placed.length - 1].at >= INK_TO) break;
        const m = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)\s+([\d.]+)(px)?$/.exec(stop);
        expect(
          m !== null && (m[3] === "px" || Number(m[2]) === 0),
          `"to ${side}" stop "${stop}" is not black at a px position over the arrow's ink (to ${INK_TO}px)`,
        ).toBe(true);
        // CSS clamps a stop placed before the one ahead of it to that one's
        // position, so a stop written out of order sits where the browser
        // draws it.
        const at = Math.max(Number(m![2]), placed.length ? placed[placed.length - 1].at : 0);
        placed.push({ a: Number(m![1]), at });
      }
      const alphaAt = (px: number) => {
        if (px <= placed[0].at) return placed[0].a;
        for (let i = 1; i < placed.length; i++) {
          const [l, r] = [placed[i - 1], placed[i]];
          if (px <= r.at) return l.a + ((r.a - l.a) * (px - l.at)) / (r.at - l.at || 1);
        }
        return placed[placed.length - 1].a;
      };
      // Each stop's own alpha inside the ink span (two stops at one position
      // are a hard step, and both sides of it are drawn), plus the span's ends.
      return [
        { px: INK_FROM, a: alphaAt(INK_FROM) },
        { px: INK_TO, a: alphaAt(INK_TO) },
        ...placed
          .filter((p) => p.at >= INK_FROM && p.at <= INK_TO)
          .map((p) => ({ px: p.at, a: p.a })),
      ];
    };
    for (const side of ["right", "left"]) {
      const ramp = ramps.get(side);
      expect(ramp, `the "to ${side}" arrow scrim is gone`).toBeTruthy();
      for (const { px, a } of floorPoints(ramp!, side)) {
        expect(
          a,
          `"to ${side}" scrim at ${px}px, under the ${FLOOR.toFixed(3)} that ${binding} needs`,
        ).toBeGreaterThanOrEqual(FLOOR);
      }
    }
  });
});
