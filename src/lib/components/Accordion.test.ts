import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import Accordion from "./Accordion.svelte";

beforeAll(() => {
  // jsdom lacks Web Animations API used by svelte transitions
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

describe("Accordion", () => {
  const items = [
    { label: "First", content: "Body A" },
    { label: "Second", content: "Body B" },
  ];

  it("renders all item labels and starts collapsed", () => {
    const { getByText, queryByText } = render(Accordion, { items });
    expect(getByText("First")).toBeTruthy();
    expect(getByText("Second")).toBeTruthy();
    expect(queryByText("Body A")).toBeNull();
    expect(queryByText("Body B")).toBeNull();
  });

  it("expands on click and toggles aria-expanded", async () => {
    const { getAllByRole } = render(Accordion, { items });
    const [first] = getAllByRole("button");

    expect(first.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    await fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");
  });

  it("allows multiple panels open when allowMultiple=true (default)", async () => {
    const { getAllByRole } = render(Accordion, { items });
    const [first, second] = getAllByRole("button");
    await fireEvent.click(first);
    await fireEvent.click(second);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes other panels when allowMultiple=false", async () => {
    const { getAllByRole } = render(Accordion, {
      items,
      allowMultiple: false,
    });
    const [first, second] = getAllByRole("button");
    await fireEvent.click(first);
    await fireEvent.click(second);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(second.getAttribute("aria-expanded")).toBe("true");
  });
});
