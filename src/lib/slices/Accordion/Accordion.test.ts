import { describe, expect, it, afterEach, beforeAll } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import Accordion from "./index.svelte";

beforeAll(() => {
  // jsdom lacks the Web Animations API the disclosure's slide transition uses.
  if (!Element.prototype.animate) {
    Element.prototype.animate = () =>
      ({
        cancel: () => {},
        finished: Promise.resolve(),
        onfinish: null,
        play: () => {},
        pause: () => {},
      }) as unknown as Animation;
  }
});

afterEach(() => cleanup());

const slice = {
  slice_type: "accordion",
  variation: "default",
  primary: {
    allowMultiple: true,
    items: [
      {
        title: "About the project",
        body: "A joint venture between two agencies.",
      },
      { title: "The team", body: "Design and strategy leads." },
    ],
    band: null,
  },
  items: [],
} as never;

describe("Accordion slice", () => {
  it("renders a disclosure button per item, collapsed by default", () => {
    const { getByRole } = render(Accordion, { props: { slice, context: {} } });
    const button = getByRole("button", { name: "About the project" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBeTruthy();
  });

  it("expands an item on click and exposes its panel", async () => {
    const { getByRole } = render(Accordion, { props: { slice, context: {} } });
    const button = getByRole("button", { name: "The team" });
    await fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });
});
