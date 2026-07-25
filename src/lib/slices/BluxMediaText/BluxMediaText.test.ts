import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxMediaText from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

describe("BluxMediaText slice", () => {
  it("renders media and text with the media on the right", () => {
    const slice = {
      slice_type: "blux_media_text",
      variation: "default",
      primary: {
        media_side: "right",
        media: {
          url: "https://cdn.example/x.jpg",
          alt: "x",
          dimensions: { width: 800, height: 600 },
          edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
        },
        title: rt("heading2", "Split"),
        body: rt("paragraph", "Two columns of content."),
      },
    } as unknown as Content.BluxMediaTextSlice;
    const { container, getByText } = render(BluxMediaText, {
      props: { slice },
    });
    expect(
      container.querySelector(".blux-media-text[data-media-side='right']"),
    ).not.toBeNull();
    expect(
      container.querySelector(".blux-media-text__media img"),
    ).not.toBeNull();
    expect(getByText("Split")).not.toBeNull();
  });
});
