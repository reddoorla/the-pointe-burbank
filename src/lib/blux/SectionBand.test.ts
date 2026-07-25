import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import SectionBand from "./SectionBand.svelte";

// jsdom has no matchMedia; Media queries prefers-reduced-motion for videos.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
});

afterEach(() => cleanup());
const children = () =>
  createRawSnippet(() => ({ render: () => "<p>content</p>" }));

describe("SectionBand", () => {
  it("applies the style record inline and renders children", () => {
    const { container } = render(SectionBand, {
      props: {
        band: {
          style: { "background-color": "rgb(1, 2, 3)", "min-height": "50vh" },
        },
        children: children(),
      },
    });
    const section = container.querySelector("section");
    expect(section?.style.backgroundColor).toBe("rgb(1, 2, 3)");
    expect(section?.style.minHeight).toBe("50vh");
    expect(section?.textContent).toContain("content");
  });

  it("renders a background video behind the content when band.background is a video", () => {
    const { container } = render(SectionBand, {
      props: {
        band: { background: { kind: "video", url: "https://cdn/bg.mp4" } },
        children: children(),
      },
    });
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "https://cdn/bg.mp4",
    );
    // Decorative background media must stay out of the a11y tree.
    expect(
      container.querySelector("[aria-hidden='true'] video"),
    ).not.toBeNull();
  });

  it("passes eager loading to the background image when eagerBackground is set", () => {
    const { container } = render(SectionBand, {
      props: {
        band: { background: { kind: "image", url: "https://cdn/bg.jpg" } },
        eagerBackground: true,
        children: children(),
      },
    });
    expect(container.querySelector("img")?.getAttribute("loading")).toBe(
      "eager",
    );
  });

  it("background image stays lazy by default", () => {
    const { container } = render(SectionBand, {
      props: {
        band: { background: { kind: "image", url: "https://cdn/bg.jpg" } },
        children: children(),
      },
    });
    expect(container.querySelector("img")?.getAttribute("loading")).toBe(
      "lazy",
    );
  });

  it("carries slice identity data-attrs when given, omits them when not", () => {
    const withAttrs = render(SectionBand, {
      props: {
        band: null,
        sliceType: "grid_band",
        sliceVariation: "default",
        children: children(),
      },
    });
    const section = withAttrs.container.querySelector("section");
    expect(section?.getAttribute("data-slice-type")).toBe("grid_band");
    expect(section?.getAttribute("data-slice-variation")).toBe("default");

    const bare = render(SectionBand, {
      props: { band: null, children: children() },
    });
    const bareSection = bare.container.querySelector("section");
    expect(bareSection?.hasAttribute("data-slice-type")).toBe(false);
    expect(bareSection?.hasAttribute("data-slice-variation")).toBe(false);
  });

  it("renders a bare section with no media when band is null", () => {
    const { container } = render(SectionBand, {
      props: { band: null, children: children() },
    });
    expect(container.querySelector("section")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("gates non-hero band content behind an animateIn scroll reveal (starts hidden)", () => {
    const { container } = render(SectionBand, {
      props: { band: { style: {} }, children: children() },
    });
    const reveal = container.querySelector("section > div.w-full");
    expect(reveal).not.toBeNull();
    // animateIn hides the wrapper until it intersects the viewport.
    expect((reveal as HTMLElement).style.opacity).toBe("0");
    expect((reveal as HTMLElement).style.transform).toContain("translateY");
    expect(reveal?.textContent).toContain("content");
  });

  it("renders the hero band content immediately (no reveal gate) when eagerBackground", () => {
    const { container } = render(SectionBand, {
      props: {
        band: { style: {} },
        eagerBackground: true,
        children: children(),
      },
    });
    // The hero is above the fold and the LCP — it must not start hidden.
    expect(container.querySelector("section > div.w-full")).toBeNull();
    expect(container.querySelector("section")?.textContent).toContain(
      "content",
    );
  });

  it("does not hide content under prefers-reduced-motion", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));
    const { container } = render(SectionBand, {
      props: { band: { style: {} }, children: children() },
    });
    const reveal = container.querySelector("section > div.w-full");
    // Wrapper still renders, but animateIn early-returns → no opacity gate.
    expect((reveal as HTMLElement)?.style.opacity).not.toBe("0");
  });
});
