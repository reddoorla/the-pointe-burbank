import { describe, it, expect } from "vitest";

import { DISTINGUISHED_CSS } from "./distinguished";
import template from "./frozen/home.html?raw";

// This transform is CSS only, so nothing here can assert on its own output the
// way a markup rewriter can. What it CAN break is the join between the rules and
// the artifact: every selector below names a class, id or attribute the freeze
// emits, and a re-freeze that renames any of them leaves the section silently
// rendering in its original two-column form. These tests are that guard.
const doc = new DOMParser().parseFromString(template, "text/html");
const band = doc.querySelector("#page-block-3");

describe("the artifact shape the Distinguished Design rules rely on", () => {
  it("still has the section", () => {
    expect(band).not.toBeNull();
  });

  it("splits it into exactly two grid columns, figure first then icons", () => {
    const grid = band!.querySelectorAll(
      '.block-grid-container[data-columns="2"]',
    );
    expect(grid).toHaveLength(1);
    const columns = grid[0]!.querySelectorAll(":scope > .cagriditem");
    expect(columns).toHaveLength(2);
    // `:first-child`/`:last-child` in the CSS reorder these, so the order the
    // freeze emits them in is load-bearing.
    expect(columns[0]!.querySelector("#page-block-3-item-0")).not.toBeNull();
    expect(columns[1]!.querySelector("#page-block-3-item-1")).not.toBeNull();
  });

  it("carries the icon panel's white fill and padding inline", () => {
    // Both are overridden with !important; if the freeze stopped emitting them
    // inline the overrides would be unnecessary rather than wrong, but the
    // panel would also have stopped being the thing these rules describe.
    const panel = doc.querySelector("#page-block-3-item-1-item-0");
    expect(panel!.getAttribute("style")).toContain("rgb(255, 255, 255)");
    expect(
      panel!.querySelector(":scope > .blocks0container")!.getAttribute("style"),
    ).toContain("padding: 100px 4% 80px");
  });

  it("stacks four icon cells in a one-column grid", () => {
    const stack = doc.querySelectorAll(
      '#page-block-3-item-1-item-0 .cagrid[data-columns="1"]',
    );
    expect(stack).toHaveLength(1);
    const cells = stack[0]!.querySelectorAll(
      '[id^="page-block-3-item-1-item-0-item-"]',
    );
    expect(cells).toHaveLength(4);
  });

  it("gives every cell one icon holder and one label holder", () => {
    for (let i = 0; i < 4; i++) {
      const cell = doc.querySelector(`#page-block-3-item-1-item-0-item-${i}`);
      expect(
        cell!.querySelectorAll(".block-media-holder .ib.img"),
      ).toHaveLength(1);
      expect(
        cell!.querySelectorAll(".block-title-holder .block-title"),
      ).toHaveLength(1);
      // The 8px gutter the row layout zeroes out.
      expect(
        cell!.querySelector(".block-title")!.getAttribute("style"),
      ).toContain("padding: 0px 0px 0px 8px");
    }
  });

  it("keeps the building as the only direct image of the figure column", () => {
    // The band and the table are positioned against this `.block-content`, and
    // the building is what gives it its height — a second in-flow image here
    // would change what every percentage below resolves against.
    const content = doc.querySelector(
      "#page-block-3-item-0 > .blocks0container > .block-content",
    );
    expect(content!.querySelectorAll(":scope > .ib.img")).toHaveLength(1);
    expect(
      content!.querySelector("#page-block-3-item-0-item-0"),
    ).not.toBeNull();
  });
});

describe("DISTINGUISHED_CSS", () => {
  it("applies only above the artifact's own stacking breakpoints", () => {
    expect(
      DISTINGUISHED_CSS.startsWith("@media all and (min-width:1000px){"),
    ).toBe(true);
    expect(DISTINGUISHED_CSS.endsWith("}")).toBe(true);
    // One block, so the closing brace above really does close the query.
    expect([...DISTINGUISHED_CSS.matchAll(/@media/g)]).toHaveLength(1);
  });

  it("unstacks the two columns and puts the icons first", () => {
    expect(DISTINGUISHED_CSS).toContain("flex-direction:column");
    expect(DISTINGUISHED_CSS).toContain(":first-child{order:2}");
    expect(DISTINGUISHED_CSS).toContain(":last-child{order:1}");
    // `.cagridFlexHeight>.grid-2` pins min AND max width; `width` alone loses.
    expect(DISTINGUISHED_CSS).toContain(
      "width:100%;min-width:100%;max-width:100%",
    );
  });

  it("clears the panel's inline white fill", () => {
    expect(DISTINGUISHED_CSS).toContain(
      "background-color:transparent!important",
    );
  });

  it("draws the band at Figma's proportions of the building", () => {
    // 171.04 / 633.15 = 27.0% down, 341 / 633.15 = 53.9% tall.
    expect(DISTINGUISHED_CSS).toContain("top:27%;height:53.9%");
    expect(DISTINGUISHED_CSS).toContain("background:#fff");
    // Half the band, so the graphic ends where Figma's does.
    expect(DISTINGUISHED_CSS).toContain("width:50%!important");
  });

  it("puts the list right of the graphic at Figma's offsets", () => {
    // 658.32 / 1064 = 61.9% across, 265.2 / 694 = 38.2% down.
    expect(DISTINGUISHED_CSS).toContain("left:61.9%;top:38.2%");
  });

  it("scales the list with the band rather than leaving it at 13px", () => {
    expect(DISTINGUISHED_CSS).toContain("font-size:14px;line-height:17px");
    expect(DISTINGUISHED_CSS).toContain("width:88px");
    expect(DISTINGUISHED_CSS).toContain("width:104px;padding-left:16px");
  });
});
