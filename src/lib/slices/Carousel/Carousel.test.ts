import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import Carousel from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
  bands: {
    "8": {
      carousel: {
        slides: [
          {
            media: {
              kind: "image",
              url: "https://cdn/one.jpg",
              minHeight: "80vh",
            },
            caption: { level: 5, role: "text5" },
          },
          {
            media: {
              kind: "image",
              url: "https://cdn/two.jpg",
              minHeight: "80vh",
            },
            caption: { level: 5, role: "text5" },
          },
          // Uncaptioned slide: no caption metadata in the manifest.
          { media: { kind: "image", url: "https://cdn/three.jpg" } },
        ],
        columns: 1,
      },
    },
  },
};

const makeSlice = (overrides: Record<string, unknown> = {}) =>
  ({
    slice_type: "carousel",
    variation: "default",
    primary: { band: 8, label: "" },
    items: [
      { caption: "a place to sit and breathe" },
      { caption: "a calm escape right outside your door" },
      { caption: "" },
    ],
    ...overrides,
  }) as never;

describe("Carousel slice", () => {
  it("renders nothing without a manifest carousel payload", () => {
    const { container } = render(Carousel, {
      props: { slice: makeSlice(), context: { presentation: { bands: {} } } },
    });
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders the band section (id anchor) wrapping the slider region", () => {
    const { container, getByRole } = render(Carousel, {
      props: { slice: makeSlice(), context: { presentation } },
    });
    const section = container.querySelector("section");
    expect(section?.getAttribute("id")).toBe("8");
    expect(getByRole("region").getAttribute("aria-roledescription")).toBe(
      "carousel",
    );
  });

  it("zips caption text from the slice items by slide index", () => {
    const { container } = render(Carousel, {
      props: { slice: makeSlice(), context: { presentation } },
    });
    const captions = container.querySelectorAll("figcaption");
    // The empty third caption renders no figcaption.
    expect(captions).toHaveLength(2);
    expect(captions[0]?.textContent?.trim()).toBe("a place to sit and breathe");
    expect(captions[1]?.textContent?.trim()).toBe(
      "a calm escape right outside your door",
    );
    // The caption's txt-role comes from the manifest's caption metadata (on
    // its own inner span, so a subcaption can share the bar as a second line).
    const roleSpan = [...captions[0]!.querySelectorAll("span")].find((s) =>
      s.className.includes("txt-role-text5"),
    );
    expect(roleSpan?.textContent).toBe("a place to sit and breathe");
  });

  it("falls back to a default accessible name when label is empty", () => {
    const { getByRole } = render(Carousel, {
      props: { slice: makeSlice(), context: { presentation } },
    });
    expect(getByRole("region").getAttribute("aria-label")).toBe(
      "Photo slideshow",
    );
  });

  it("uses the editable label when present", () => {
    const { getByRole } = render(Carousel, {
      props: {
        slice: makeSlice({ primary: { band: 8, label: "Building tour" } }),
        context: { presentation },
      },
    });
    expect(getByRole("region").getAttribute("aria-label")).toBe(
      "Building tour",
    );
  });
});
