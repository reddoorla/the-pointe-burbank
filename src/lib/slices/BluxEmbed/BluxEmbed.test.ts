import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxEmbed from "./index.svelte";

afterEach(() => cleanup());

describe("BluxEmbed slice", () => {
  it("renders the raw embed HTML with the embed kind", () => {
    const slice = {
      slice_type: "blux_embed",
      variation: "default",
      primary: {
        embed_kind: "custom",
        embed_html: "<div class='mc'>signup</div>",
      },
    } as unknown as Content.BluxEmbedSlice;
    const { container } = render(BluxEmbed, { props: { slice } });
    expect(
      container.querySelector(".blux-embed[data-embed-kind='custom'] .mc"),
    ).not.toBeNull();
  });

  it("renders nothing when embed_html is empty", () => {
    const slice = {
      slice_type: "blux_embed",
      variation: "default",
      primary: { embed_kind: "custom", embed_html: "" },
    } as unknown as Content.BluxEmbedSlice;
    const { container } = render(BluxEmbed, { props: { slice } });
    expect(container.querySelector(".blux-embed")).toBeNull();
  });
});
