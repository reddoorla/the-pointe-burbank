import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxGallery from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

const slice = {
  slice_type: "blux_gallery",
  variation: "default",
  primary: {
    heading: rt("heading2", "Gallery"),
    columns: 3,
    spacing: 16,
    masonry: "on",
    cells: [
      { kind: "text", title: rt("heading3", "Pool"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Gym"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Roof"), subgrid: [] },
    ],
  },
} as unknown as Content.BluxGallerySlice;

describe("BluxGallery slice", () => {
  it("renders one cell per entry and reflects the masonry flag", () => {
    const { container, getAllByRole } = render(BluxGallery, {
      props: { slice },
    });
    expect(
      container.querySelector(".blux-gallery__cells[data-masonry='on']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(".blux-gallery__cells > .blux-cell"),
    ).toHaveLength(3);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
