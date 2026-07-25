import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import MediaFull from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
  bands: {
    "1": { media: { kind: "video", url: "https://cdn/full.mp4" } },
  },
};

const slice = {
  slice_type: "media_full",
  variation: "default",
  primary: { band: 1 },
  items: [],
} as never;

describe("MediaFull slice", () => {
  it("renders the manifest media as a full-bleed video", () => {
    const { container } = render(MediaFull, {
      props: { slice, context: { presentation } },
    });
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("https://cdn/full.mp4");
  });

  it("renders nothing without a manifest media payload", () => {
    const { container } = render(MediaFull, {
      props: { slice, context: { presentation: { bands: {} } } },
    });
    expect(container.querySelector("section")).toBeNull();
  });
});
