import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import Gallery from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
  bands: {
    "1": {
      gallery: [
        { kind: "image", url: "https://cdn/one.jpg" },
        { kind: "image", url: "https://cdn/two.jpg" },
        { kind: "video", url: "https://cdn/three.mp4" },
      ],
    },
  },
};

const slice = {
  slice_type: "gallery",
  variation: "default",
  primary: { band: 1 },
  items: [],
} as never;

describe("Gallery slice", () => {
  it("renders the first frame full-bleed at 80vh (slider default view)", () => {
    const { container } = render(Gallery, {
      props: { slice, context: { presentation } },
    });
    // One frame shown, like the original's single-frame slider.
    const cells = container.querySelectorAll("[data-gallery-cell]");
    expect(cells).toHaveLength(1);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn/one.jpg");
    expect(img?.className).toContain("h-[80vh]");
    expect(img?.className).toContain("object-cover");
  });

  it("renders nothing without a manifest gallery payload", () => {
    const { container } = render(Gallery, {
      props: { slice, context: { presentation: { bands: {} } } },
    });
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders a captioned grid when any frame carries a caption", () => {
    const captioned: Presentation = {
      bands: {
        "1": {
          gallery: [
            { kind: "image", url: "https://cdn/one.jpg", caption: "one" },
            { kind: "image", url: "https://cdn/two.jpg", caption: "two" },
          ],
        },
      },
    };
    const { container } = render(Gallery, {
      props: { slice, context: { presentation: captioned } },
    });
    // Captioned grid, not a full-bleed frame — and never a slider (source
    // slider bands are `carousel` slices in the starter).
    expect(container.querySelector('[role="region"]')).toBeNull();
    expect(container.querySelector("[data-gallery-cell]")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(2);
    const captions = container.querySelectorAll("p.txt-role-text5");
    expect(captions).toHaveLength(2);
    expect(captions[0]?.textContent).toBe("one");
  });
});
