import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import { SliceZone } from "@prismicio/svelte";
import { components } from "$lib/slices";

/**
 * Breadth emit → render proof (offline). Mirrors what the reddoor-maintenance
 * breadth emit (`catalogSpecToPlanSlice`, src/blux/catalog/emit.ts) produces for
 * each catalog slice AFTER `resolveDocData` + Prismic hydration: richtext
 * markers → rich-text nodes, asset markers → image fields. Field names are
 * copied from the emit verbatim (`media_side`, `layout_ratio`,
 * `columns_visible`, `caption`, `cells`/`subgrid`) — if an emit field name
 * drifts from what a Plan-2 component reads, the assertion for that slice goes
 * empty and this fails: fix the emit, not the test.
 */
const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
const img = (name: string) => ({
  url: `https://cdn.example/${name}.jpg`,
  alt: name,
  dimensions: { width: 800, height: 600 },
  edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
});

afterEach(() => cleanup());

const slices = [
  {
    slice_type: "blux_grid",
    variation: "default",
    primary: {
      heading: rt("heading2", "GridHead"),
      columns: 2,
      cells: [
        { kind: "text", title: rt("heading3", "GCell"), subgrid: [] },
        {
          kind: "subgrid",
          subgrid: [
            { kind: "media", media: img("sub-img") },
            {
              kind: "text",
              body_html: '<div class="txt-role-text1"><p>SubText</p></div>',
            },
          ],
        },
      ],
    },
  },
  {
    slice_type: "blux_gallery",
    variation: "default",
    primary: {
      cells: [
        { kind: "media", media: img("g1"), subgrid: [] },
        { kind: "media", media: img("g2"), subgrid: [] },
      ],
    },
  },
  {
    slice_type: "blux_carousel",
    variation: "default",
    primary: {
      columns_visible: 2,
      cells: [
        {
          kind: "media",
          media: img("slide1"),
          title: rt("heading4", "SlideCap"),
          subgrid: [],
        },
      ],
    },
  },
  {
    slice_type: "blux_media",
    variation: "default",
    primary: { media: img("solo"), caption: rt("paragraph", "MCap") },
  },
  {
    slice_type: "blux_media_text",
    variation: "default",
    primary: {
      media: img("split"),
      background_image: img("mt-bg"),
      background_color: "#112233",
      media_side: "right",
      layout_ratio: 40,
      title: rt("heading2", "MTTitle"),
      body: rt("paragraph", "MTBody"),
    },
  },
  // A video cell arrives as embed_html (fix round: video never goes into an
  // Image field) — BluxCell renders it via {@html}.
  {
    slice_type: "blux_section",
    variation: "default",
    primary: {
      cells: [
        {
          kind: "embed",
          embed_html:
            '<video class="cell-vid" controls playsinline src="https://cdn.example/v.mp4"></video>',
          subgrid: [],
        },
      ],
    },
  },
  // The BluxBlock fallback: emit serializes the node tree (background-wrapped)
  // to a JSON payload string; the slice parses + renders it recursively.
  {
    slice_type: "blux_block",
    variation: "default",
    primary: {
      payload: JSON.stringify({
        tag: "div",
        style: { backgroundImage: "url(https://cdn.example/block-bg.jpg)" },
        children: [
          { tag: "h3", html: "BlockHead" },
          {
            tag: "figure",
            image: { url: "https://cdn.example/block-img.jpg", alt: "block" },
          },
        ],
      }),
    },
  },
];

describe("breadth emit shapes render through the registered catalog slices", () => {
  it("renders every slice's distinctive content", () => {
    const { getByText } = render(SliceZone, {
      props: { slices: slices as never, components },
    });
    for (const text of [
      "GridHead",
      "GCell",
      "SubText",
      "SlideCap",
      "MCap",
      "MTTitle",
      "MTBody",
      "BlockHead",
    ]) {
      expect(getByText(text)).not.toBeNull();
    }
  });

  it("wires geometry + media through the emit field names", () => {
    const { container } = render(SliceZone, {
      props: { slices: slices as never, components },
    });
    expect(
      container.querySelector(".blux-grid__cells[data-columns='2']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(".blux-gallery__cells > .blux-cell img"),
    ).toHaveLength(2);
    expect(
      container.querySelector(
        ".blux-carousel__track[data-columns-visible='2']",
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(".blux-media-text[data-media-side='right']"),
    ).not.toBeNull();
    expect(container.querySelector(".blux-media img")).not.toBeNull();
    // The nested subgrid renders its media one level down.
    expect(
      container.querySelector(".blux-grid__cells .blux-subgrid img"),
    ).not.toBeNull();
    // Fix-round contracts: leaf backgrounds, video-as-embed, BluxBlock payload.
    expect(
      container.querySelector(".blux-media-text img.blux-media-text__bg"),
    ).not.toBeNull();
    expect(container.querySelector("video.cell-vid")).not.toBeNull();
    expect(
      container.querySelector("img[src='https://cdn.example/block-img.jpg']"),
    ).not.toBeNull();
  });
});
