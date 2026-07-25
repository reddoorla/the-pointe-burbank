import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxBlock from "./index.svelte";
import { styleString } from "$lib/blux-catalog/node";

afterEach(() => cleanup());

const tree = {
  tag: "section",
  className: "band",
  children: [
    {
      tag: "div",
      className: "row",
      children: [
        { html: "<h3>Stacking Plan</h3>" },
        { image: { url: "https://cdn.example/plan.png", alt: "plan" } },
        { tag: "div", children: [{ html: "<p>Level 4</p>" }] },
      ],
    },
  ],
};

const slice = {
  slice_type: "blux_block",
  variation: "default",
  primary: { payload: JSON.stringify(tree) },
} as unknown as Content.BluxBlockSlice;

describe("BluxBlock fallback slice", () => {
  it("recursively renders the serialized tree at any depth", () => {
    const { getByText, container } = render(BluxBlock, { props: { slice } });
    expect(getByText("Stacking Plan")).not.toBeNull();
    expect(getByText("Level 4")).not.toBeNull();
    expect(
      container.querySelector("img[alt='plan']")?.getAttribute("src"),
    ).toBe("https://cdn.example/plan.png");
    expect(container.querySelector("section.band .row")).not.toBeNull();
  });

  it("renders nothing for an unparseable payload", () => {
    const bad = {
      ...slice,
      primary: { payload: "not json" },
    } as unknown as Content.BluxBlockSlice;
    const { container } = render(BluxBlock, { props: { slice: bad } });
    expect(container.querySelector(".blux-block")).toBeNull();
  });

  it("renders nothing for an array payload", () => {
    const bad = {
      ...slice,
      primary: { payload: "[]" },
    } as unknown as Content.BluxBlockSlice;
    const { container } = render(BluxBlock, { props: { slice: bad } });
    expect(container.querySelector(".blux-block")).toBeNull();
  });

  it("renders a container-level widget after the tree (map bands ride BluxBlock)", () => {
    const withWidget = {
      ...slice,
      primary: {
        payload: JSON.stringify(tree),
        widget_kind: "map",
        widget_html:
          '<div class="blux-map" data-map-config=\'{"zoom":12}\'><div id="burbank_map"></div></div>',
      },
    } as unknown as Content.BluxBlockSlice;
    const { container } = render(BluxBlock, { props: { slice: withWidget } });
    const widget = container.querySelector(".blux-widget[data-widget='map']");
    expect(widget).not.toBeNull();
    expect(widget?.querySelector("#burbank_map")).not.toBeNull();
    // The tree still renders alongside the widget.
    expect(container.querySelector("section.band .row")).not.toBeNull();
  });

  it("renders the widget even when the payload is empty", () => {
    const widgetOnly = {
      ...slice,
      primary: {
        payload: "",
        widget_kind: "map",
        widget_html: '<div class="blux-map"><div id="m"></div></div>',
      },
    } as unknown as Content.BluxBlockSlice;
    const { container } = render(BluxBlock, { props: { slice: widgetOnly } });
    expect(container.querySelector(".blux-widget #m")).not.toBeNull();
  });

  it("defaults an empty tag to a div and keeps the subtree", () => {
    const emptyTag = {
      ...slice,
      primary: {
        payload: JSON.stringify({
          tag: "",
          children: [{ html: "<p>kept</p>" }],
        }),
      },
    } as unknown as Content.BluxBlockSlice;
    const { getByText } = render(BluxBlock, { props: { slice: emptyTag } });
    expect(getByText("kept")).not.toBeNull();
  });

  it("renders a node's inline background style intact (survives the layout import)", () => {
    const styled = {
      ...slice,
      primary: {
        payload: JSON.stringify({
          tag: "div",
          style: { "background-color": "#eeeeee" },
          children: [{ tag: "p", html: "Hello" }],
        }),
      },
    } as unknown as Content.BluxBlockSlice;
    const { container, getByText } = render(BluxBlock, {
      props: { slice: styled },
    });
    expect(getByText("Hello")).not.toBeNull();
    expect(
      container.querySelector("[style*='background-color']"),
    ).not.toBeNull();
  });
});

describe("styleString", () => {
  it("joins kebab-case style entries and handles undefined", () => {
    expect(
      styleString({ "background-color": "red", "min-height": "10px" }),
    ).toBe("background-color:red;min-height:10px");
    expect(styleString(undefined)).toBe("");
  });
});
