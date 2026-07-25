import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import GridBand from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const slice = (band: number) =>
  ({
    slice_type: "grid_band",
    variation: "default",
    primary: { band },
    items: [],
  }) as never;

const presentation: Presentation = {
  bands: {
    "5": {
      style: { "background-color": "rgb(10, 20, 30)" },
      tree: { kind: "heading", level: 3, html: "From the manifest" },
    },
  },
};

describe("GridBand slice", () => {
  it("renders its band tree from context inside a styled SectionBand", () => {
    const { container } = render(GridBand, {
      props: { slice: slice(5), context: { presentation } },
    });
    expect(container.querySelector("h3")?.textContent).toBe(
      "From the manifest",
    );
    expect(container.querySelector("section")?.style.backgroundColor).toBe(
      "rgb(10, 20, 30)",
    );
    // Slice-identity parity with the generated slices.
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-slice-type")).toBe("grid_band");
    expect(section?.getAttribute("data-slice-variation")).toBe("default");
  });

  it("renders nothing (no crash) when the band has no manifest entry", () => {
    const { container } = render(GridBand, {
      props: { slice: slice(99), context: { presentation } },
    });
    expect(container.querySelector("section")).toBeNull();
  });

  it("tolerates a missing context entirely", () => {
    const { container } = render(GridBand, {
      props: { slice: slice(5), context: {} },
    });
    expect(container.querySelector("section")).toBeNull();
  });

  it("mounts the map for a grid band whose tree carries a widget:map + map payload", () => {
    const presentation = {
      bands: {
        "9": {
          tree: {
            kind: "stack",
            children: [
              { kind: "widget", widget: { type: "map" } },
              { kind: "body", html: "<p>addr</p>" },
            ],
          },
          map: { mid: "M", layers: [], toggles: [], styles: [] },
        },
      },
    } as unknown as Presentation;
    const { container } = render(GridBand, {
      props: { slice: slice(9), context: { presentation } },
    });
    expect(container.querySelector("[data-map-placeholder]")).not.toBeNull();
  });
});
