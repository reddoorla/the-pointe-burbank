import { describe, it, expect } from "vitest";

import {
  restyleCarouselCaptions,
  CAROUSEL_CAPTION_CSS,
} from "./carousel-caption";
import template from "./frozen/home.html?raw";

describe("restyleCarouselCaptions", () => {
  const out = restyleCarouselCaptions(template);

  it("restyles all three Lush Haven captions in the real artifact", () => {
    expect([...out.matchAll(/rd-caption-host/g)]).toHaveLength(3);
    expect([...out.matchAll(/block-content rd-caption"/g)]).toHaveLength(3);
  });

  it("puts a rule mark ahead of each caption heading", () => {
    const marks = [...out.matchAll(/rd-caption">.*?(rd-rule-box).*?(<h5)/g)];
    expect(marks).toHaveLength(3);
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
    expect(CAROUSEL_CAPTION_CSS).toContain(
      "background-color:transparent!important",
    );
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
    const rule = /#page-block-8 \.blocks2\{([^}]*)\}/.exec(
      CAROUSEL_CAPTION_CSS,
    )?.[1];
    expect(rule).toContain("background-color:rgb(63,62,40)");
    // Darker than either photograph's mean, so it never reads as a bright hole.
    const [r, g, b] = [63, 62, 40];
    const mean = (109 + 87 + 109 + 108 + 87 + 104 + 65 + 52 + 78) / 9;
    expect((r + g + b) / 3).toBeLessThan(mean);
  });

  it("scrims the sides as well as the bottom, for the arrows", () => {
    // One pseudo-element carries all three gradients. The bottom one is the
    // caption's (Nicole, 51:27 + 51:30); the two side ones are the arrows'.
    const rule = /#page-block-8 \.blocks2::after\{([^}]*)\}/.exec(
      CAROUSEL_CAPTION_CSS,
    )?.[1];
    expect(rule, "the scrim rule moved").toBeTruthy();
    expect([...rule!.matchAll(/linear-gradient\(/g)]).toHaveLength(3);
    expect(rule).toContain("linear-gradient(to right,");
    expect(rule).toContain("linear-gradient(to left,");
    expect(rule).toContain("linear-gradient(to top,");
  });

  it("sizes the side scrims in px, not %, so they track the arrow", () => {
    // The arrows are a fixed 32px inset 4px and do not scale with the viewport.
    // A percentage ramp would over-darken a wide slide and under-cover a narrow
    // one — the exact failure the LEED badge had in reverse.
    // One level of nesting, because every stop is an rgba(...) of its own.
    const sides = [
      ...CAROUSEL_CAPTION_CSS.matchAll(
        /linear-gradient\(to (?:right|left),((?:[^()]|\([^()]*\))*)\)/g,
      ),
    ].map((m) => m[1]);
    expect(sides).toHaveLength(2);
    for (const ramp of sides) {
      expect(ramp).not.toMatch(/\d%/);
      // Opaque enough at the arrow, gone before the caption's ink at 103px.
      expect(ramp).toContain("rgba(0,0,0,.45) 0");
      expect(ramp).toContain("rgba(0,0,0,0) 168px");
    }
    // Both sides ramp identically, so neither arrow is favoured.
    expect(sides[0]).toBe(sides[1]);
  });
});
