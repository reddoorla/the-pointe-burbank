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
});
