import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxMedia from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

describe("BluxMedia slice", () => {
  it("renders an image with caption and ratio", () => {
    const slice = {
      slice_type: "blux_media",
      variation: "default",
      primary: {
        media: {
          url: "https://cdn.example/x.jpg",
          alt: "x",
          dimensions: { width: 800, height: 600 },
          edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
        },
        ratio: "4:3",
        caption: rt("paragraph", "A view"),
      },
    } as unknown as Content.BluxMediaSlice;
    const { container, getByText } = render(BluxMedia, { props: { slice } });
    expect(
      container.querySelector(".blux-media[data-ratio='4:3'] img"),
    ).not.toBeNull();
    expect(getByText("A view")).not.toBeNull();
  });

  it("renders a raw video embed when there is no image", () => {
    const slice = {
      slice_type: "blux_media",
      variation: "default",
      primary: { media: {}, video_embed: "<iframe class='yt'></iframe>" },
    } as unknown as Content.BluxMediaSlice;
    const { container } = render(BluxMedia, { props: { slice } });
    expect(container.querySelector("iframe.yt")).not.toBeNull();
  });
});
