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
    // Stops in px, or a bare 0; a % stop cannot be placed against the arrow's
    // fixed px box, so it is left out rather than guessed.
    const alphaAt = (ramp: string, px: number) => {
      const stops = [
        ...ramp.matchAll(/rgba\([^)]*,\s*([\d.]+)\)\s+([\d.]+)(?:px)?(?=,|\s|$)/g),
      ].map((s) => ({
        a: Number(s[1]),
        at: Number(s[2]),
      }));
      expect(stops.length, "no px stops in the ramp").toBeGreaterThan(0);
      if (px <= stops[0].at) return stops[0].a;
      for (let i = 1; i < stops.length; i++) {
        const [l, r] = [stops[i - 1], stops[i]];
        if (px <= r.at) return l.a + ((r.a - l.a) * (px - l.at)) / (r.at - l.at || 1);
      }
      return stops[stops.length - 1].a;
    };
    for (const side of ["right", "left"]) {
      const ramp = ramps.get(side);
      expect(ramp, `the "to ${side}" arrow scrim is gone`).toBeTruthy();
      for (const px of [0, 44]) {
        expect(alphaAt(ramp!, px), `"to ${side}" scrim at ${px}px`).toBeGreaterThanOrEqual(0.34);
      }
    }
  });
});
