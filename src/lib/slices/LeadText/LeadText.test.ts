import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import LeadText from "./index.svelte";

afterEach(() => cleanup());

const rt = (text: string) => [{ type: "paragraph", text, spans: [] }];

const slice = {
  slice_type: "lead_text",
  variation: "default",
  primary: {
    eyebrow: "The Challenge",
    body: rt("They needed an identity on a tight timeline."),
    band: null,
  },
  items: [],
} as never;

describe("LeadText slice", () => {
  it("renders the eyebrow as an h2 and the body paragraph", () => {
    const { container, getByText } = render(LeadText, {
      props: { slice, context: {} },
    });
    const h2 = container.querySelector("h2");
    expect(h2?.textContent?.trim()).toBe("The Challenge");
    expect(
      getByText("They needed an identity on a tight timeline."),
    ).toBeTruthy();
    // Carries the slice-identity data attributes for parity with siblings.
    expect(
      container.querySelector('[data-slice-type="lead_text"]'),
    ).not.toBeNull();
  });

  it("omits the heading when no eyebrow is authored", () => {
    const noEyebrow = {
      slice_type: "lead_text",
      variation: "default",
      primary: { eyebrow: "", body: rt("Body only."), band: null },
      items: [],
    } as never;
    const { container, getByText } = render(LeadText, {
      props: { slice: noEyebrow, context: {} },
    });
    expect(container.querySelector("h2")).toBeNull();
    expect(getByText("Body only.")).toBeTruthy();
  });
});
