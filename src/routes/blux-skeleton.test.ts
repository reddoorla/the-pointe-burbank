import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import { SliceZone } from "@prismicio/svelte";
import { components } from "$lib/slices";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

afterEach(() => cleanup());

// A page body mixing a container, a leaf, and the fallback — the full skeleton.
const slices = [
  {
    slice_type: "blux_section",
    variation: "default",
    primary: {
      heading: rt("heading2", "Amenities"),
      cells: [{ kind: "text", title: rt("heading3", "Pool"), subgrid: [] }],
    },
  },
  {
    slice_type: "blux_text",
    variation: "default",
    primary: { title: rt("heading2", "Welcome"), buttons: [] },
  },
  {
    slice_type: "blux_block",
    variation: "default",
    primary: {
      payload: JSON.stringify({
        tag: "div",
        children: [{ html: "<p>Fallback content</p>" }],
      }),
    },
  },
  {
    slice_type: "blux_grid",
    variation: "default",
    primary: {
      heading: rt("heading2", "GridHead"),
      cells: [{ kind: "text", title: rt("heading3", "GridCell"), subgrid: [] }],
    },
  },
  {
    slice_type: "blux_gallery",
    variation: "default",
    primary: {
      cells: [
        { kind: "text", title: rt("heading3", "GalleryCell"), subgrid: [] },
      ],
    },
  },
  {
    slice_type: "blux_carousel",
    variation: "default",
    primary: {
      cells: [
        { kind: "text", title: rt("heading3", "CarouselCell"), subgrid: [] },
      ],
    },
  },
  {
    slice_type: "blux_media",
    variation: "default",
    primary: { media: {}, caption: rt("paragraph", "MediaCaption") },
  },
  {
    slice_type: "blux_media_text",
    variation: "default",
    primary: { title: rt("heading2", "MediaTextTitle") },
  },
  {
    slice_type: "blux_embed",
    variation: "default",
    primary: { embed_kind: "custom", embed_html: "<p>EmbedBody</p>" },
  },
  {
    slice_type: "blux_table",
    variation: "default",
    primary: {
      table_html: "<table><tbody><tr><td>TableCell</td></tr></tbody></table>",
    },
  },
  {
    slice_type: "blux_collection",
    variation: "default",
    primary: { collection_type: "product", layout: "grid" },
  },
];

describe("Blux catalog walking skeleton", () => {
  it("renders container, leaf, and fallback slices through the shared SliceZone", () => {
    const { getByText } = render(SliceZone, {
      props: { slices: slices as never, components },
    });
    expect(getByText("Amenities")).not.toBeNull();
    expect(getByText("Pool")).not.toBeNull();
    expect(getByText("Welcome")).not.toBeNull();
    expect(getByText("Fallback content")).not.toBeNull();
  });

  it("renders every registered catalog slice through the shared SliceZone", () => {
    const { getByText } = render(SliceZone, {
      props: { slices: slices as never, components },
    });
    for (const text of [
      "GridCell",
      "GalleryCell",
      "CarouselCell",
      "MediaCaption",
      "MediaTextTitle",
      "EmbedBody",
      "TableCell",
    ]) {
      expect(getByText(text)).not.toBeNull();
    }
  });

  it("renders blux_collection with an empty context: root section, no cards, no crash", () => {
    const { container } = render(SliceZone, {
      props: { slices: slices as never, components },
    });
    expect(container.querySelector("section.blux-collection")).not.toBeNull();
    expect(container.querySelectorAll(".blux-collection__card")).toHaveLength(
      0,
    );
  });
});
