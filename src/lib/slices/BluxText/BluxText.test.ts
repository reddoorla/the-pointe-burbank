import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxText from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

afterEach(() => cleanup());

const slice = {
  slice_type: "blux_text",
  variation: "default",
  primary: {
    title: rt("heading2", "Welcome"),
    body: rt("paragraph", "Ground-floor retail."),
    buttons: [
      {
        label: "Contact",
        link: { link_type: "Web", url: "https://example.com" },
      },
    ],
  },
} as unknown as Content.BluxTextSlice;

describe("BluxText slice", () => {
  it("renders title and body", () => {
    const { getByRole, getByText } = render(BluxText, { props: { slice } });
    expect(getByRole("heading", { level: 2 }).textContent).toContain("Welcome");
    expect(getByText("Ground-floor retail.")).not.toBeNull();
  });

  it("renders a button when the link is filled", () => {
    const { getByText } = render(BluxText, { props: { slice } });
    expect(getByText("Contact").closest("a")?.getAttribute("href")).toBe(
      "https://example.com",
    );
  });
});
