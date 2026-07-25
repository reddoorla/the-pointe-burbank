import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import BluxCell from "./BluxCell.svelte";
import type { BluxCellData } from "./cell";

afterEach(() => cleanup());
const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
const img = {
  url: "https://cdn/x.jpg",
  alt: "x",
  dimensions: { width: 800, height: 600 },
};

describe("BluxCell visual fields", () => {
  it("sets --cell-basis from the basis prop and the cell's card style", () => {
    const cell = {
      kind: "text",
      title: rt("heading3", "Card"),
      background_color: "#ffffff",
      content_padding: "100px 4% 80px",
      valign: "on",
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, {
      props: { cell, basis: "calc(30% - 2%)" },
    });
    const el = container.querySelector(".blux-cell") as HTMLElement;
    expect(el.style.getPropertyValue("--cell-basis")).toBe("calc(30% - 2%)");
    expect(el.getAttribute("style")).toContain(
      "background-color: rgb(255, 255, 255)",
    );
    expect(el.getAttribute("style")).toContain("padding: 100px 4% 80px");
    expect(el.getAttribute("data-valign")).toBe("on");
  });

  it("marks cover media so the stylesheet crops it", () => {
    const cell = {
      kind: "media",
      media: img,
      cover: "on",
      media_ratio: "3:2",
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    expect(
      container.querySelector(".blux-cell__media[data-cover='on']"),
    ).not.toBeNull();
  });

  it("wraps the title in its role container and renders roled body_html via {@html}", () => {
    const cell = {
      kind: "text",
      title: rt("heading3", "T"),
      title_role: "text11",
      body_html: '<div class="txt-role-text1"><p>B</p></div>',
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    expect(container.querySelector(".txt-role-text11 h3")).not.toBeNull();
    expect(
      container.querySelector(".blux-cell__body .txt-role-text1 p"),
    ).not.toBeNull();
  });

  it("gives each subgrid cell its own basis for a row of that many cells", () => {
    const cell = {
      kind: "subgrid",
      subgrid: [
        { kind: "text", title: rt("heading4", "L") },
        { kind: "text", title: rt("heading4", "R") },
      ],
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell, basis: "100%" } });
    const subCells = container.querySelectorAll<HTMLElement>(
      ".blux-subgrid > .blux-cell",
    );
    expect(subCells).toHaveLength(2);
    expect(subCells[0].style.getPropertyValue("--cell-basis")).toBe(
      "calc(50% - 2%)",
    );
  });
});

describe("BluxCell image_embed (doubly-nested subgrid media)", () => {
  it("renders image_embed inside .blux-cell__media with cover + ratio", () => {
    const cell = {
      kind: "media",
      image_embed:
        '<img src="https://images.prismic.io/repo/u1.jpg" alt="Pool">',
      media_ratio: "4:3",
      cover: "on",
    } as unknown as BluxCellData;
    const { container } = render(BluxCell, { props: { cell } });
    const wrap = container.querySelector(".blux-cell__media") as HTMLElement;
    expect(wrap).not.toBeNull();
    expect(wrap.getAttribute("data-cover")).toBe("on");
    expect(wrap.getAttribute("data-ratio")).toBe("4:3");
    const im = wrap.querySelector("img") as HTMLImageElement;
    expect(im.getAttribute("src")).toBe(
      "https://images.prismic.io/repo/u1.jpg",
    );
    expect(im.getAttribute("alt")).toBe("Pool");
  });
});
