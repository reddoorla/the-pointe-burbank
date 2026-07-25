import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import type { RichTextField } from "@prismicio/client";
import RichTextBody from "./RichTextBody.svelte";

afterEach(() => cleanup());

function field(...types: string[]): RichTextField {
  return types.map((type, i) => ({
    type,
    text: `${type}-${i}`,
    spans: [],
  })) as unknown as RichTextField;
}

describe("RichTextBody", () => {
  it("keeps the original tags but compresses aria-levels gap-free from 2", () => {
    // Editor jumped h2 → h4: tag stays h4 (visual), announced level becomes 3.
    const { container } = render(RichTextBody, {
      field: field("heading2", "paragraph", "heading4"),
    });

    const h2 = container.querySelector("h2")!;
    const h4 = container.querySelector("h4")!;
    expect(h2.getAttribute("aria-level")).toBe("2");
    expect(h4.getAttribute("aria-level")).toBe("3");
  });

  it("re-bases a body that starts deep (h3, h5) to levels 2 and 3", () => {
    const { container } = render(RichTextBody, {
      field: field("heading3", "heading5"),
    });

    expect(container.querySelector("h3")!.getAttribute("aria-level")).toBe("2");
    expect(container.querySelector("h5")!.getAttribute("aria-level")).toBe("3");
  });

  it("demotes an editor h1 so it can't compete with the page title", () => {
    const { container } = render(RichTextBody, {
      field: field("heading1", "heading2"),
    });

    expect(container.querySelector("h1")!.getAttribute("aria-level")).toBe("2");
    expect(container.querySelector("h2")!.getAttribute("aria-level")).toBe("3");
  });

  it("renders heading text and non-heading nodes untouched", () => {
    const { getByText, container } = render(RichTextBody, {
      field: field("heading2", "paragraph"),
    });

    expect(getByText("heading2-0")).toBeTruthy();
    const p = container.querySelector("p")!;
    expect(p.textContent).toBe("paragraph-1");
    expect(p.hasAttribute("aria-level")).toBe(false);
  });
});
