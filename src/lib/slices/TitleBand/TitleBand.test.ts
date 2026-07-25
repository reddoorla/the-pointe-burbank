import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import TitleBand from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
  bands: {
    "1": {
      style: { "background-color": "rgb(1, 2, 3)" },
      text: { headingRole: "text5", headingLevel: 2, subtitleRole: "text12" },
    },
  },
};

const slice = {
  slice_type: "title_band",
  variation: "default",
  primary: {
    band: 1,
    heading: "The Space",
    subtitle: "Every corner considered",
  },
  items: [],
} as never;

describe("TitleBand slice", () => {
  it("renders the display line as <h2> and the eyebrow with manifest roles", () => {
    const { container } = render(TitleBand, {
      props: { slice, context: { presentation } },
    });
    // The subtitle is the large display line (the visual heading); the heading
    // field is the small eyebrow above it. Roles come from band.text.
    expect(container.querySelector("h2")?.textContent).toBe(
      "Every corner considered",
    );
    expect(container.querySelector("h2")?.className).toContain(
      "txt-role-text12",
    );
    const eyebrow = container.querySelector("p.txt-role-text5");
    expect(eyebrow?.textContent).toContain("The Space");
    expect(container.querySelector("section")?.style.backgroundColor).toBe(
      "rgb(1, 2, 3)",
    );
  });

  it("renders a heading-only band without roles when the manifest has none", () => {
    const headingOnly = {
      slice_type: "title_band",
      variation: "default",
      primary: { band: 1, heading: "Come Be A Part Of It.", subtitle: "" },
      items: [],
    } as never;
    const { container } = render(TitleBand, {
      props: { slice: headingOnly, context: {} },
    });
    expect(container.querySelector("section")).not.toBeNull();
    const h2 = container.querySelector("h2");
    expect(h2?.textContent).toContain("Come Be A Part Of It.");
    // No manifest entry → no text metadata → no txt-role class.
    expect(h2?.className).not.toContain("txt-role-");
  });

  it("honors the manifest heading level for a heading-only band", () => {
    const withLevel: Presentation = {
      bands: { "2": { text: { headingRole: "text11", headingLevel: 3 } } },
    };
    const headingOnly = {
      slice_type: "title_band",
      variation: "default",
      primary: { band: 2, heading: "A closing line" },
      items: [],
    } as never;
    const { container } = render(TitleBand, {
      props: { slice: headingOnly, context: { presentation: withLevel } },
    });
    const h3 = container.querySelector("h3");
    expect(h3?.textContent).toContain("A closing line");
    expect(h3?.className).toContain("txt-role-text11");
  });
});
