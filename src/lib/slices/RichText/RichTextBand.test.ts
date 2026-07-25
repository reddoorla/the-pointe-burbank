import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import RichText from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const content = [
  { type: "paragraph", text: "Body copy from Prismic", spans: [] },
];

const slice = (primary: Record<string, unknown>) =>
  ({
    slice_type: "rich_text",
    variation: "default",
    primary,
    items: [],
  }) as never;

const presentation: Presentation = {
  bands: {
    "3": { style: { "background-color": "rgb(12, 34, 56)" } },
  },
};

describe("RichText band wrap", () => {
  it("wraps today's output in a styled band section when band is set", () => {
    const { container } = render(RichText, {
      props: {
        slice: slice({ content, band: 3 }),
        context: { presentation },
      },
    });
    const sections = container.querySelectorAll("section");
    // Outer band wrapper + the original section nested inside it.
    expect(sections).toHaveLength(2);
    expect(sections[0].style.backgroundColor).toBe("rgb(12, 34, 56)");
    expect(sections[0].contains(sections[1])).toBe(true);
    expect(sections[1].getAttribute("data-slice-type")).toBe("rich_text");
    expect(sections[1].textContent).toContain("Body copy from Prismic");
  });

  it("renders exactly today's single section when band is absent", () => {
    const { container } = render(RichText, {
      props: { slice: slice({ content }), context: {} },
    });
    const sections = container.querySelectorAll("section");
    expect(sections).toHaveLength(1);
    expect(sections[0].getAttribute("data-slice-type")).toBe("rich_text");
    expect(sections[0].getAttribute("style")).toBeFalsy();
    expect(sections[0].textContent).toContain("Body copy from Prismic");
  });

  it("renders exactly today's single section when the band has no manifest entry", () => {
    const { container } = render(RichText, {
      props: {
        slice: slice({ content, band: 99 }),
        context: { presentation },
      },
    });
    const sections = container.querySelectorAll("section");
    expect(sections).toHaveLength(1);
    expect(sections[0].getAttribute("data-slice-type")).toBe("rich_text");
  });
});
