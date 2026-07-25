import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import DelayedLink from "./DelayedLink.svelte";

afterEach(() => cleanup());

const gotoMock = vi.fn();
vi.mock("$app/navigation", () => ({
  goto: (href: string) => gotoMock(href),
}));

const label = () =>
  createRawSnippet(() => ({
    render: () => "click me",
  }));

describe("DelayedLink", () => {
  beforeEach(() => {
    gotoMock.mockClear();
    vi.useFakeTimers();
  });

  it("delays navigation for internal links", async () => {
    const { getByText } = render(DelayedLink, {
      href: "/about",
      delay: 100,
      children: label(),
    });

    await fireEvent.click(getByText("click me"));
    expect(gotoMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(gotoMock).toHaveBeenCalledWith("/about");
  });

  it("does not intercept external links", async () => {
    const { getByText } = render(DelayedLink, {
      href: "https://example.com",
      delay: 100,
      children: label(),
    });

    await fireEvent.click(getByText("click me"));
    vi.advanceTimersByTime(1000);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("does not intercept PDF links", async () => {
    const { getByText } = render(DelayedLink, {
      href: "/files/doc.pdf",
      delay: 100,
      children: label(),
    });

    await fireEvent.click(getByText("click me"));
    vi.advanceTimersByTime(1000);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("does not intercept uppercase .PDF links with query string", async () => {
    const { getByText } = render(DelayedLink, {
      href: "/files/doc.PDF?download=1",
      delay: 100,
      children: label(),
    });

    await fireEvent.click(getByText("click me"));
    vi.advanceTimersByTime(1000);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("still intercepts non-PDF paths that contain '.pdf' in a segment", async () => {
    const { getByText } = render(DelayedLink, {
      href: "/not-a-pdf/page",
      delay: 100,
      children: label(),
    });

    await fireEvent.click(getByText("click me"));
    vi.advanceTimersByTime(100);
    expect(gotoMock).toHaveBeenCalledWith("/not-a-pdf/page");
  });

  it.each([
    ["metaKey", { metaKey: true }],
    ["ctrlKey", { ctrlKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["middle click", { button: 1 }],
  ])("does not intercept when %s is set (native nav)", async (_, init) => {
    const { getByText } = render(DelayedLink, {
      href: "/about",
      delay: 100,
      children: label(),
    });

    await fireEvent.click(getByText("click me"), init);
    vi.advanceTimersByTime(1000);
    expect(gotoMock).not.toHaveBeenCalled();
  });
});
