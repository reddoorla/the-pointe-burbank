import { describe, expect, it } from "vitest";
import { frozenSlotsFromDoc } from "./from-doc";

describe("frozenSlotsFromDoc", () => {
  it("maps image → url, media_url fallback, and re-encodes decoded text", () => {
    const out = frozenSlotsFromDoc([
      {
        key: "s0.i0",
        kind: "image",
        image: { url: "https://images.prismic.io/x.jpg" },
        media_url: null,
      },
      {
        key: "s8.i2",
        kind: "image",
        image: {},
        media_url: "https://r.cdn.prismic.io/v.mp4",
      },
      {
        key: "s0.t0",
        kind: "text",
        text: [{ type: "paragraph", text: "2255 & 2233 Ontario", spans: [] }],
      },
    ]);
    expect(out).toEqual([
      { key: "s0.i0", kind: "image", url: "https://images.prismic.io/x.jpg" },
      { key: "s8.i2", kind: "image", url: "https://r.cdn.prismic.io/v.mp4" },
      { key: "s0.t0", kind: "text", text: "2255 &amp; 2233 Ontario" },
    ]);
  });

  it("yields undefined url for an empty image with no media_url", () => {
    const [slot] = frozenSlotsFromDoc([
      { key: "s0.i0", kind: "image", image: {} },
    ]);
    expect(slot!.url).toBeUndefined();
  });
});
