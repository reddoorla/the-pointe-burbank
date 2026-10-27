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
    // GUARD: the side ramps are what lift the white arrow glyphs on slide 1 from
    // 2.53:1 to 8.02:1, against WCAG 1.4.11's 3:1 (measured in carousel-caption.ts).
    // The light slide 3, at 2.00:1 unscrimmed, is the binding case: see the floor
    // test below.
    // This is a CSS-string proxy for that contrast; no gate test computes it.
    expect(rule).toContain("linear-gradient(to right,");
    expect(rule).toContain("linear-gradient(to left,");
    expect(rule).toContain("linear-gradient(to top,");
  });

  it("keeps both arrow scrims dark enough for a 3:1 control over the arrow", () => {
    // The arrows are 32px glyphs inset 4px, so they span 4-36px from each edge.
    // On the light slide 3 the white glyph measures 2.00:1 unscrimmed (p90), and
    // a ramp of at least .34 black from the edge to 44px is what lifts its worst
    // pixels past WCAG 1.4.11's 3:1. A floor, not the shipped .45: a darker
    // ramp, or a different curve that stays above it, is a designer's call.
    const ramps = new Map(
      [
        ...CAROUSEL_CAPTION_CSS.matchAll(
          /linear-gradient\(to (right|left),((?:[^()]|\([^()]*\))*)\)/g,
        ),
      ].map((m) => [m[1], m[2]]),
    );
    // The ramp is piecewise linear, so its lowest alpha over 0-44px is at a stop
    // inside that box or at one of its two ends: check all of those. A % stop
    // cannot be placed against the arrow's fixed px box, so one that comes
    // before the box ends fails rather than being guessed or skipped.
    const BOX = 44;
    const floorPoints = (ramp: string, side: string) => {
      // Every stop, split at the ramp's top-level commas. Inside the arrow's
      // box each one must be black at a px position: a `transparent`, an
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
        if (placed.length && placed[placed.length - 1].at >= BOX) break;
        const m = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)\s+([\d.]+)(px)?$/.exec(stop);
        expect(
          m !== null && (m[3] === "px" || Number(m[2]) === 0),
          `"to ${side}" stop "${stop}" is not black at a px position inside the arrow's ${BOX}px box`,
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
      // Each stop's own alpha inside the box (two stops at one position are a
      // hard step, and both sides of it are drawn), plus the box's two ends.
      return [
        { px: 0, a: alphaAt(0) },
        { px: BOX, a: alphaAt(BOX) },
        ...placed.filter((p) => p.at < BOX).map((p) => ({ px: p.at, a: p.a })),
      ];
    };
    for (const side of ["right", "left"]) {
      const ramp = ramps.get(side);
      expect(ramp, `the "to ${side}" arrow scrim is gone`).toBeTruthy();
      for (const { px, a } of floorPoints(ramp!, side)) {
        expect(a, `"to ${side}" scrim at ${px}px`).toBeGreaterThanOrEqual(0.34);
      }
    }
  });
});
