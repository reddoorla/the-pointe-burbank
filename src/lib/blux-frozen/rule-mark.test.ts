import { describe, it, expect } from "vitest";

import {
  ruleMarkSvg,
  ruleMarkBox,
  replaceRuleMarks,
  RULE_MARK_MEDIA,
  RULE_MARK_CSS,
} from "./rule-mark";
import template from "./frozen/home.html?raw";

describe("ruleMarkSvg", () => {
  const svg = ruleMarkSvg();

  it("is two horizontal lines on Figma's viewBox", () => {
    expect(svg).toContain('viewBox="0 0 20.8835 5.44787"');
    expect([...svg.matchAll(/<line /g)]).toHaveLength(2);
    expect(svg).toContain('y1="0.453988"');
    expect(svg).toContain('y1="4.99388"');
  });

  it("inherits colour so the same mark serves navy and white placements", () => {
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).not.toMatch(/stroke="#/);
  });

  it("keeps a hairline stroke at any box size", () => {
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it("is decorative, so it is hidden from assistive tech", () => {
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
  });
});

describe("ruleMarkBox", () => {
  it("pins the box it is given", () => {
    expect(ruleMarkBox(50, 9.489)).toContain(
      'style="width:50px;aspect-ratio:50/9.489;--rd-rule-len:50"',
    );
  });

  it("sets the dash length to the box's own width", () => {
    // Regression: `vector-effect="non-scaling-stroke"` resolves stroke-dasharray
    // in screen pixels, so a dash sized to the viewBox (20.8835) left finished
    // 50px marks as dash-gap-dash and 40px marks half-drawn.
    for (const [w, h] of [
      [50, 9.48905],
      [40, 7],
      [20.8835, 5.44787],
    ]) {
      const style = /style="([^"]*)"/.exec(ruleMarkBox(w, h))![1];
      const width = /width:([\d.]+)px/.exec(style)![1];
      const len = /--rd-rule-len:([\d.]+)/.exec(style)![1];
      expect(len).toBe(width);
    }
  });
});

describe("replaceRuleMarks", () => {
  it("swaps all five baked rule PNGs in the real committed artifact", () => {
    for (const media of RULE_MARK_MEDIA) {
      expect(template).toContain(media);
    }
    const out = replaceRuleMarks(template);
    for (const media of RULE_MARK_MEDIA) {
      expect(out).not.toContain(`data-media="${media}"`);
    }
    expect([...out.matchAll(/class="rd-rule-box"/g)]).toHaveLength(5);
  });

  it("preserves each mark's original box, so no layout shifts", () => {
    const out = replaceRuleMarks(template);
    // 50px wide at 18.9781% -> 9.48905px; 40px wide at 17.5% -> 7px.
    expect(out).toContain(
      "width:50px;aspect-ratio:50/9.48905;--rd-rule-len:50",
    );
    expect(out).toContain("width:40px;aspect-ratio:40/7;--rd-rule-len:40");
  });

  it("leaves markup alone when the media is absent", () => {
    const html =
      '<div class="ib img imgfit camediaload" data-media="other.png">x</div>';
    expect(replaceRuleMarks(html)).toBe(html);
  });
});

describe("RULE_MARK_CSS", () => {
  it("draws the lines in on reveal, using the page's existing wait/run classes", () => {
    expect(RULE_MARK_CSS).toContain(".rd-rule.rd-fx-wait line");
    expect(RULE_MARK_CSS).toContain("stroke-dashoffset:var(--rd-rule-len)");
    expect(RULE_MARK_CSS).toContain(".rd-rule.rd-fx-run line");
    expect(RULE_MARK_CSS).toContain("stroke-dashoffset:0");
  });

  it("dashes by the box's own width, never a fixed viewBox-unit length", () => {
    // A literal dash length is the bug: under non-scaling-stroke the pattern is
    // in screen pixels, so it only ever fits one box size.
    expect(RULE_MARK_CSS).toContain("stroke-dasharray:var(--rd-rule-len)");
    expect(RULE_MARK_CSS).not.toMatch(/stroke-dasharray:\s*[\d.]/);
    // No fallback: a missing property must degrade to a solid, visible mark.
    expect(RULE_MARK_CSS).not.toContain("--rd-rule-len,");
  });

  it("staggers the second line behind the first", () => {
    expect(RULE_MARK_CSS).toContain(
      ".rd-rule.rd-fx-run line:nth-child(2){transition-delay:.12s}",
    );
  });

  it("defaults to the navy the rest of the site uses", () => {
    expect(RULE_MARK_CSS).toContain("color:#053a6c");
  });
});
