import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import { SliceZone } from "@prismicio/svelte";
import { components } from "$lib/slices";

/**
 * Collection emit → render proof (offline). Mirrors the maintenance emit's
 * blux_collection primary (`catalogSpecToPlanSlice` BluxCollection case:
 * collection_type / feed_ids / filter_tag / layout / limit …) plus the
 * load-path contract: entity documents arrive via SliceZone
 * `context.collections[collection_type]` (populated by `loadCollections` in
 * +page.server.ts). If an emit field name or the context key drifts, the cards
 * go empty and this fails: fix the emit or the load path, not the test.
 */
const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
const img = (name: string) => ({
  url: `https://cdn.example/${name}.jpg`,
  alt: name,
  dimensions: { width: 800, height: 600 },
  edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
});

afterEach(() => cleanup());

// Emit-shaped (resolved) slice: exactly the snake_case primary the
// maintenance emit produces for a Products feed band filtered to "metal".
const slices = [
  {
    slice_type: "blux_collection",
    variation: "default",
    primary: {
      heading: rt("heading2", "Our Metal Work"),
      collection_type: "product",
      feed_ids: "feed-1",
      filter_tag: "metal",
      layout: "grid",
      limit: 2,
    },
  },
];

// Entity documents as the load path delivers them (Prismic-hydrated).
const collections = {
  product: [
    {
      uid: "steel-stool",
      data: {
        title: rt("heading1", "Steel Stool"),
        media: img("steel"),
        tags: "metal, seating",
        link: { link_type: "Web", url: "https://example.com/steel" },
      },
    },
    {
      uid: "brass-table",
      data: { title: rt("heading1", "Brass Table"), tags: "metal" },
    },
    {
      uid: "oak-bench",
      data: { title: rt("heading1", "Oak Bench"), tags: "wood" },
    },
  ],
};

describe("blux_collection emit shape renders through the registered slice", () => {
  it("filters by tag, respects limit, and honors the card-link contract", () => {
    const { container, getByText, queryByText } = render(SliceZone, {
      props: { slices: slices as never, components, context: { collections } },
    });
    expect(getByText("Our Metal Work")).not.toBeNull();
    expect(getByText("Steel Stool")).not.toBeNull();
    expect(getByText("Brass Table")).not.toBeNull();
    // "wood" filtered out by filter_tag=metal (and limit=2).
    expect(queryByText("Oak Bench")).toBeNull();
    // Card-link contract: only the external-Web-link card gets an <a>.
    const links = container.querySelectorAll(".blux-collection a[href]");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("https://example.com/steel");
    expect(
      container.querySelector(".blux-collection[data-layout='grid'] img"),
    ).not.toBeNull();
  });
});
