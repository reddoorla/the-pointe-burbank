import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import LocationMap from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
  bands: {
    "14": {
      map: {
        mid: "test-mid",
        layers: [
          {
            name: "Portfolio",
            lid: "L0",
            initiallyVisible: true,
            preserveViewport: false,
          },
        ],
        toggles: [{ label: "All", layers: ["Portfolio"] }],
        styles: [],
      },
    },
  },
};

const slice = {
  slice_type: "location_map",
  variation: "default",
  primary: { band: 14 },
  items: [],
} as never;

describe("LocationMap slice", () => {
  it("renders the keyless map placeholder inside the band section", () => {
    const { container } = render(LocationMap, {
      props: { slice, context: { presentation } },
    });
    const section = container.querySelector(
      'section[data-slice-type="location_map"]',
    );
    expect(section).not.toBeNull();
    expect(section?.querySelector("[data-map-placeholder]")).not.toBeNull();
  });

  it("renders nothing without a manifest map payload", () => {
    const { container } = render(LocationMap, {
      props: { slice, context: { presentation: { bands: {} } } },
    });
    expect(container.querySelector("section")).toBeNull();
  });

  it("tolerates an empty context", () => {
    const { container } = render(LocationMap, {
      props: { slice, context: {} },
    });
    expect(container.querySelector("section")).toBeNull();
  });
});
