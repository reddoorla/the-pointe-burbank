import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import ContentWidth from "./ContentWidth.svelte";

class FakeIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  // @ts-expect-error — replacing global for test
  window.IntersectionObserver = FakeIntersectionObserver;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
});

afterEach(() => cleanup());

const body = () =>
  createRawSnippet(() => ({
    render: () => "<p>Inner content</p>",
  }));

describe("ContentWidth", () => {
  it("applies animateIn hidden styles when animateInOnScroll is true", () => {
    const { getByText } = render(ContentWidth, {
      animateInOnScroll: true,
      children: body(),
    });

    const inner = getByText("Inner content").parentElement as HTMLElement;
    expect(inner.style.opacity).toBe("0");
    expect(inner.style.transform).toBe("translateY(50%)");
    expect(inner.style.transition).toContain("opacity");
  });

  it("does not apply animateIn styles when animateInOnScroll is false", () => {
    const { getByText } = render(ContentWidth, {
      animateInOnScroll: false,
      children: body(),
    });

    const inner = getByText("Inner content").parentElement as HTMLElement;
    expect(inner.style.opacity).toBe("");
    expect(inner.style.transform).toBe("");
  });
});
