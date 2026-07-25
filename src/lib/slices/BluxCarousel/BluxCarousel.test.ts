import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxCarousel from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

const slice = {
  slice_type: "blux_carousel",
  variation: "default",
  primary: {
    heading: rt("heading2", "Slides"),
    columns_visible: 1,
    arrows: "on",
    cells: [
      { kind: "text", title: rt("heading3", "Pool"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Gym"), subgrid: [] },
      { kind: "text", title: rt("heading3", "Roof"), subgrid: [] },
    ],
  },
} as unknown as Content.BluxCarouselSlice;

describe("BluxCarousel slice", () => {
  it("renders one cell per entry and reflects the arrows flag", () => {
    const { container, getAllByRole } = render(BluxCarousel, {
      props: { slice },
    });
    expect(
      container.querySelector(".blux-carousel__track[data-arrows='on']"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(".blux-carousel__track > .blux-cell"),
    ).toHaveLength(3);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
