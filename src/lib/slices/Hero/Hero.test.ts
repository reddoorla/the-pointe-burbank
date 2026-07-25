import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import Hero from "./index.svelte";

const slice = {
  slice_type: "hero",
  variation: "default",
  primary: {
    heading: [{ type: "heading1", text: "The Pinnacle", spans: [] }],
    body: [{ type: "paragraph", text: "Luxury living in Burbank.", spans: [] }],
    background_image: {
      url: "https://img.example/hero.jpg",
      alt: "Building exterior",
      dimensions: { width: 1600, height: 900 },
    },
    cta_label: "Explore",
    cta_link: { link_type: "Web", url: "https://example.com" },
  },
  items: [],
} as unknown as Content.HeroSlice;

describe("Hero slice", () => {
  it("renders the heading and a labelled CTA", () => {
    const { getByRole } = render(Hero, { props: { slice } });
    expect(getByRole("heading", { level: 1 }).textContent).toContain(
      "The Pinnacle",
    );
    expect(getByRole("link", { name: "Explore" }).getAttribute("href")).toBe(
      "https://example.com",
    );
  });

  it("sets slice data attributes", () => {
    const { container } = render(Hero, { props: { slice } });
    const section = container.querySelector("[data-slice-type='hero']");
    expect(section?.getAttribute("data-slice-variation")).toBe("default");
  });
});
