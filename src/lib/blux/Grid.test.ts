import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import Grid from "./Grid.svelte";
import type { RenderNode } from "./presentation";

afterEach(() => cleanup());

const tree: RenderNode = {
  kind: "stack",
  children: [
    { kind: "heading", level: 2, html: "The <em>Space</em>", role: "text2" },
    {
      kind: "row",
      cells: [
        {
          token: { cols: 2, ratio: 60 },
          node: { kind: "body", html: "<p>Left copy</p>", role: "text4" },
        },
        {
          token: { cols: 2, ratio: 40 },
          node: {
            kind: "media",
            media: { kind: "image", url: "https://cdn/a.jpg" },
          },
        },
      ],
    },
  ],
};

describe("Grid (recursive fallback)", () => {
  it("renders nested rows/cells with token widths and role classes", () => {
    const { container } = render(Grid, { props: { node: tree } });
    const h2 = container.querySelector("h2");
    expect(h2?.innerHTML).toContain("The <em>Space</em>");
    expect(h2?.className).toContain("txt-role-text2");
    const cells = container.querySelectorAll("[data-grid-cell]");
    expect(cells).toHaveLength(2);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn/a.jpg");
    expect(container.textContent).toContain("Left copy");
  });

  it("renders raw html verbatim and a placeholder for widgets", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          children: [
            { kind: "raw", html: "<div class='legacy'>kept</div>" },
            { kind: "widget", widget: { type: "map" } },
          ],
        },
      },
    });
    expect(container.querySelector(".legacy")?.textContent).toBe("kept");
    expect(container.querySelector("[data-widget='map']")).not.toBeNull();
  });

  it("mounts LocationMap for a widget:map when a map config is provided", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          children: [{ kind: "widget", widget: { type: "map" } }],
        },
        map: { mid: "M", layers: [], toggles: [], styles: [] },
      },
    });
    expect(container.querySelector("[data-map-placeholder]")).not.toBeNull();
    expect(container.querySelector("[data-widget='map']")).toBeNull();
  });

  it("clamps heading levels to the h1–h6 range", () => {
    const { container } = render(Grid, {
      props: {
        node: { kind: "heading", level: 9, html: "Deep" },
      },
    });
    expect(container.querySelector("h6")).not.toBeNull();
    expect(container.querySelector("h9")).toBeNull();
  });

  it("an _overlay stack renders a hover-caption card over a cover image (feed tile)", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: {
            _overlay: "4:3",
            _overlayColor: "rgba(1,2,3,0.85)",
            _overlayValign: "top",
          },
          children: [
            {
              kind: "media",
              media: { kind: "image", url: "https://cdn/t.jpg" },
            },
            { kind: "heading", level: 6, html: "Suite", role: "text6" },
          ],
        },
      },
    });
    // The box reserves the crop aspect; the image cover-fills it.
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute("style")).toContain("aspect-ratio: 4 / 3");
    const img = box.querySelector("img") as HTMLElement;
    // The caption panel overlays (absolute), hover-revealed, colored, over the image.
    const panel = [...box.children].find(
      (c) => c !== img.parentElement && (c as HTMLElement).className.includes("group-hover"),
    ) as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("style")?.replace(/\s/g, "")).toContain("rgba(1,2,3,0.85)");
    expect(panel.textContent).toContain("Suite");
    // Reveals on hover (pointer), but stays visible on touch (no-hover) and on
    // keyboard focus — the caption is never permanently hidden from a visitor.
    expect(panel.className).toContain("group-hover:opacity-100");
    expect(panel.className).toContain("[@media(hover:none)]:opacity-100");
    expect(panel.className).toContain("focus-within:opacity-100");
    // The _overlay hints never leak as literal CSS.
    expect(box.getAttribute("style")).not.toContain("_overlay");
  });

  it("a cropRatio media renders as a fixed-aspect object-cover box (feed tile)", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "media",
          media: {
            kind: "image",
            url: "https://cdn/tile.jpg",
            cropRatio: "4:3",
          },
        },
      },
    });
    const img = container.querySelector("img") as HTMLElement;
    // The wrapper reserves the crop aspect (4:3 → "4 / 3").
    const box = img.parentElement as HTMLElement;
    expect(box.getAttribute("style")).toContain("aspect-ratio: 4 / 3");
  });

  it("applies a text node's export style: inline color/padding, margin-right as a md-scoped var", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "subtitle",
          text: "aside",
          role: "text5",
          style: {
            color: "rgb(255, 255, 255)",
            padding: "8px",
            "margin-right": "20%",
          },
        },
      },
    });
    const p = container.querySelector("p") as HTMLElement;
    // Role class is preserved.
    expect(p.className).toContain("txt-role-text5");
    // color + padding apply inline at every width.
    expect(p.style.color).toBe("rgb(255, 255, 255)");
    expect(p.style.padding).toBe("8px");
    // margin-right is desktop-only: it rides a custom property + md: class, and
    // must NOT be an unconditional inline margin-right that leaks onto mobile.
    expect(p.style.marginRight).toBe("");
    expect(p.style.getPropertyValue("--node-mr")).toBe("20%");
  });

  it("applies inline color to a styled heading", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "heading",
          level: 2,
          html: "Bright",
          role: "text11",
          style: { color: "rgb(255, 255, 255)" },
        },
      },
    });
    const h2 = container.querySelector("h2") as HTMLElement;
    expect(h2.className).toContain("txt-role-text11");
    expect(h2.style.color).toBe("rgb(255, 255, 255)");
    // No margin var when the export carries no margin-right.
    expect(h2.className).not.toContain("md:mr-(--node-mr)");
  });

  it("a text node with no style carries only its role class and no inline style", () => {
    const { container } = render(Grid, {
      props: {
        node: { kind: "subtitle", text: "plain", role: "text5" },
      },
    });
    const p = container.querySelector("p") as HTMLElement;
    expect(p.className).toContain("txt-role-text5");
    expect(p.getAttribute("style")).toBeNull();
  });

  it("a cell with cols 'any' falls back to an auto basis from md: up", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [{ token: { cols: "any" }, node: { kind: "subtitle", text: "s" } }],
        },
      },
    });
    const cell = container.querySelector("[data-grid-cell]") as HTMLElement;
    expect(cell.style.getPropertyValue("--cell-basis")).toBe("auto");
  });

  it("reserves the gutter per line (cols), not per cell, on a wrapping grid", () => {
    // Band 14 shape: 7 cells at cols=4 → 4 per line. Every cell reserves the
    // same gutter a single full line of 4 does, not a 7-cell line's.
    const cards = (n: number) =>
      Array.from({ length: n }, () => ({
        token: { cols: 4 },
        node: { kind: "subtitle", text: "card" } as RenderNode,
      }));
    const { container } = render(Grid, {
      props: { node: { kind: "row", cells: cards(7) } },
    });
    const rendered = container.querySelectorAll("[data-grid-cell]");
    expect(rendered).toHaveLength(7);
    const { container: oneLine } = render(Grid, {
      props: { node: { kind: "row", cells: cards(4) } },
    });
    const lineBasis = (
      oneLine.querySelector("[data-grid-cell]") as HTMLElement
    ).style.getPropertyValue("--cell-basis");
    for (const c of rendered) {
      expect((c as HTMLElement).style.getPropertyValue("--cell-basis")).toBe(lineBasis);
    }
  });

  it("leaves a single-per-line (cols 1) stat stack at full-width, no gutter carved out", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [
            {
              token: { cols: 1, spacing: 40 },
              node: { kind: "subtitle", text: "stat a" },
            },
            {
              token: { cols: 1, spacing: 40 },
              node: { kind: "subtitle", text: "stat b" },
            },
          ],
        },
      },
    });
    const cells = container.querySelectorAll("[data-grid-cell]");
    for (const c of cells) {
      expect((c as HTMLElement).style.getPropertyValue("--cell-basis")).toBe("100%");
    }
  });

  it("paints a row's card background from its style (a peeled .blocks0 fill)", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          style: { "background-color": "rgb(255, 255, 255)" },
          cells: [{ token: { cols: 1 }, node: { kind: "subtitle", text: "s" } }],
        },
      },
    });
    const row = container.querySelector("[data-grid-row]") as HTMLElement;
    expect(row.style.backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("a row without a card style carries no inline background", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [{ token: { cols: 1 }, node: { kind: "subtitle", text: "s" } }],
        },
      },
    });
    const row = container.querySelector("[data-grid-row]") as HTMLElement;
    expect(row.style.backgroundColor).toBe("");
  });

  it("paints a stack's card background from its style", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: { "background-color": "rgb(0, 0, 0)" },
          children: [{ kind: "subtitle", text: "y" }],
        },
      },
    });
    const stack = container.firstElementChild as HTMLElement;
    expect(stack.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("a min-height + _valign stack centers its content in the box, keeping flow rhythm inside", () => {
    // A nested block-in-cell (e.g. an 80vh gradient panel): the stack pins its
    // own box and vertically centers the copy. The outer flex column centers;
    // the inner flow-root wrapper keeps children in NORMAL FLOW so their
    // margins still collapse (flex items' margins can't).
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: {
            "min-height": "80vh",
            background: "linear-gradient(45deg, rgb(82, 102, 126), rgb(175, 173, 168))",
            _valign: "middle",
          },
          children: [
            { kind: "heading", level: 1, html: "the tower", role: "text11" },
            { kind: "subtitle", text: "Stand above the rest", role: "text10" },
          ],
        },
      },
    });
    const outer = container.firstElementChild as HTMLElement;
    // min-height + background apply; the _valign hint never leaks as CSS.
    expect(outer.getAttribute("style")).toContain("min-height: 80vh");
    expect(outer.getAttribute("style")).toContain("linear-gradient");
    expect(outer.getAttribute("style")).not.toContain("_valign");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.querySelector("h1")?.textContent).toBe("the tower");
  });

  it("a `_fill: column` stack stretches to its cell (h-full) so its paint covers the column", () => {
    // A cagridFlexHeight cell's painted block: the original stretches it to
    // the full row height — the gradient must not stop at the content box.
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: {
            background: "linear-gradient(rgb(1, 1, 1), rgb(2, 2, 2))",
            padding: "80px 12%",
            _fill: "column",
          },
          children: [{ kind: "subtitle", text: "panel copy", role: "text5" }],
        },
      },
    });
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("h-full");
    expect(outer.className).toContain("flow-root");
    expect(outer.getAttribute("style")).not.toContain("_fill");
    // Centered min-height boxes stretch the same way when marked.
    const { container: c2 } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: { "min-height": "80vh", _valign: "middle", _fill: "column" },
          children: [{ kind: "subtitle", text: "x", role: "text5" }],
        },
      },
    });
    const centered = c2.firstElementChild as HTMLElement;
    expect(centered.className).toContain("h-full");
    expect(centered.className).toContain("justify-center");
  });

  it("a min-height + _valign ROW packs its lines mid-box (content-center)", () => {
    // The producer attaches the centered box to rows too (a nested block whose
    // content parses to a grid) — the row analogue of the stack's centering.
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          style: { "min-height": "80vh", _valign: "middle" },
          cells: [{ token: { cols: 1 }, node: { kind: "subtitle", text: "a" } }],
        },
      },
    });
    const row = container.querySelector("[data-grid-row]") as HTMLElement;
    expect(row.className).toContain("content-center");
    expect(row.getAttribute("style")).toContain("min-height: 80vh");
    // A plain row stays unpacked.
    const { container: c2 } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [{ token: { cols: 1 }, node: { kind: "subtitle", text: "b" } }],
        },
      },
    });
    expect((c2.querySelector("[data-grid-row]") as HTMLElement).className).not.toContain(
      "content-center",
    );
  });

  it("a panels row shows only the active toggle's cell; the rest stay mounted hidden", async () => {
    // The clickMap shape: stack[widget:map, panels row], toggles drive which
    // panel is visible. Clicking tab 2 hides panel 0 and reveals panel 1.
    const node: RenderNode = {
      kind: "stack",
      children: [
        { kind: "widget", widget: { type: "map" } },
        {
          kind: "row",
          panels: true,
          cells: [
            {
              token: { cols: 1 },
              node: { kind: "subtitle", text: "addresses" },
            },
            { token: { cols: 1 }, node: { kind: "subtitle", text: "logos" } },
          ],
        },
      ],
    };
    const map = {
      mid: "M",
      layers: [],
      toggles: [
        { label: "All", layers: [] },
        { label: "Offices", layers: [] },
      ],
      styles: [],
    };
    const { container, getByRole } = render(Grid, { props: { node, map } });
    const panelCells = () =>
      [...container.querySelectorAll("[data-panels] > [data-grid-cell]")].map((c) =>
        (c as HTMLElement).className.includes("hidden"),
      );
    expect(panelCells()).toEqual([false, true]);
    await fireEvent.click(getByRole("button", { name: "Offices" }));
    expect(panelCells()).toEqual([true, false]);
  });

  it("a panels row without toggles renders its first cell (no crash, nothing hidden twice)", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          panels: true,
          cells: [{ token: { cols: 1 }, node: { kind: "subtitle", text: "only" } }],
        },
      },
    });
    const cells = container.querySelectorAll("[data-panels] > [data-grid-cell]");
    expect(cells).toHaveLength(1);
    expect((cells[0] as HTMLElement).className).not.toContain("hidden");
    expect(container.textContent).toContain("only");
  });
});
