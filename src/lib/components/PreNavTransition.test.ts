import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import PreNavTransition from "./PreNavTransition.svelte";

afterEach(() => cleanup());

type NavCallback = (nav: FakeNav) => void;

interface FakeNav {
  type: string;
  willUnload: boolean;
  from: { url: URL } | null;
  to: { url: URL; route: { id: string | null } } | null;
  cancel: ReturnType<typeof vi.fn>;
}

const gotoMock = vi.fn<(url: URL) => Promise<void>>();
let beforeNavigateCb: NavCallback | undefined;
let afterNavigateCb: (() => void) | undefined;

vi.mock("$app/navigation", () => ({
  beforeNavigate: (cb: NavCallback) => {
    beforeNavigateCb = cb;
  },
  afterNavigate: (cb: () => void) => {
    afterNavigateCb = cb;
  },
  goto: (url: URL) => gotoMock(url),
}));

function makeNav(
  toPath: string | null,
  { fromPath = "/", type = "link" }: { fromPath?: string; type?: string } = {},
): FakeNav {
  return {
    type,
    willUnload: false,
    from: { url: new URL(fromPath, "https://example.com") },
    to: toPath
      ? { url: new URL(toPath, "https://example.com"), route: { id: toPath } }
      : null,
    cancel: vi.fn(),
  };
}

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  gotoMock.mockReset();
  gotoMock.mockImplementation(() => Promise.resolve());
  beforeNavigateCb = undefined;
  afterNavigateCb = undefined;
  mockMatchMedia(false);
  vi.useFakeTimers();

  // jsdom has no Web Animations API; Svelte 5 transitions need element.animate.
  if (!Element.prototype.animate) {
    Element.prototype.animate = vi.fn(
      () =>
        ({
          cancel() {},
          finish() {},
          pause() {},
          play() {},
          onfinish: null,
          oncancel: null,
          finished: Promise.resolve(),
        }) as unknown as Animation,
    );
  }
});

afterEach(() => {
  vi.useRealTimers();
});

const overlay = (container: HTMLElement) =>
  container.querySelector('[aria-hidden="true"]');

describe("PreNavTransition", () => {
  it("cancels a cross-page nav, shows the overlay, re-issues goto after the fade", async () => {
    const { container } = render(PreNavTransition, { duration: 400 });

    const nav = makeNav("/about");
    beforeNavigateCb!(nav);
    await tick();

    expect(nav.cancel).toHaveBeenCalled();
    expect(overlay(container)).toBeTruthy();
    expect(gotoMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);
    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock.mock.calls[0][0].href).toBe("https://example.com/about");
  });

  it("lets its own deferred goto pass through without re-cancelling", async () => {
    render(PreNavTransition, { duration: 400 });

    beforeNavigateCb!(makeNav("/about"));
    await vi.advanceTimersByTimeAsync(400);

    // The re-issued goto arrives as a fresh navigation to the pending href.
    const deferred = makeNav("/about", { type: "goto" });
    beforeNavigateCb!(deferred);
    expect(deferred.cancel).not.toHaveBeenCalled();
  });

  it("re-defers rapid clicks to the newest target only", async () => {
    render(PreNavTransition, { duration: 400 });

    beforeNavigateCb!(makeNav("/first"));
    await vi.advanceTimersByTimeAsync(200);

    const second = makeNav("/second");
    beforeNavigateCb!(second);
    expect(second.cancel).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(gotoMock).toHaveBeenCalledTimes(1);
    expect(gotoMock.mock.calls[0][0].href).toBe("https://example.com/second");
  });

  it("cancels the deferred goto when Back interrupts the fade (no forward yank)", async () => {
    render(PreNavTransition, { duration: 400 });
    // Click a link: intercepted, goto deferred by `duration`.
    beforeNavigateCb!(makeNav("/about"));
    // User presses Back mid-fade: popstate proceeds natively...
    beforeNavigateCb!(makeNav("/", { type: "popstate" }));
    afterNavigateCb!();
    // ...and the stale deferred goto must never fire.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("does not intercept popstate (back/forward stays native)", async () => {
    render(PreNavTransition, { duration: 400 });

    const nav = makeNav("/about", { type: "popstate" });
    beforeNavigateCb!(nav);
    expect(nav.cancel).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("does not intercept external navigations", async () => {
    render(PreNavTransition, { duration: 400 });

    const nav = makeNav(null);
    beforeNavigateCb!(nav);
    expect(nav.cancel).not.toHaveBeenCalled();
  });

  it("skips the overlay and the delay entirely under reduced motion", async () => {
    mockMatchMedia(true);
    const { container } = render(PreNavTransition, { duration: 400 });

    const nav = makeNav("/about");
    beforeNavigateCb!(nav);
    await tick();

    expect(nav.cancel).not.toHaveBeenCalled();
    expect(overlay(container)).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("clears pending state after navigation completes (same target can fade again)", async () => {
    render(PreNavTransition, { duration: 400, holdDuration: 400 });

    beforeNavigateCb!(makeNav("/about"));
    await vi.advanceTimersByTimeAsync(400);
    afterNavigateCb!();
    await vi.advanceTimersByTimeAsync(400);

    const again = makeNav("/about", { fromPath: "/elsewhere" });
    beforeNavigateCb!(again);
    expect(again.cancel).toHaveBeenCalled();
  });

  it("keeps the overlay through a click during the post-nav hold window", async () => {
    render(PreNavTransition, { duration: 400, holdDuration: 400 });

    // First nav completes; cleanup is now scheduled 400ms out.
    beforeNavigateCb!(makeNav("/first"));
    await vi.advanceTimersByTimeAsync(400);
    afterNavigateCb!();

    // Click during the hold: the stale cleanup must not fire mid-second-fade,
    // so the deferred goto still sees its pendingHref and passes through.
    await vi.advanceTimersByTimeAsync(200);
    const second = makeNav("/second", { fromPath: "/first" });
    beforeNavigateCb!(second);
    expect(second.cancel).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);
    const deferred = makeNav("/second", { fromPath: "/first", type: "goto" });
    beforeNavigateCb!(deferred);
    expect(deferred.cancel).not.toHaveBeenCalled();
  });

  it("clears pending state if the deferred navigation fails", async () => {
    gotoMock.mockImplementationOnce(() => Promise.reject(new Error("boom")));
    render(PreNavTransition, { duration: 400 });

    beforeNavigateCb!(makeNav("/about"));
    await vi.advanceTimersByTimeAsync(400);
    expect(gotoMock).toHaveBeenCalledTimes(1);

    // pendingHref must be gone, so the same target is intercepted afresh.
    const retry = makeNav("/about");
    beforeNavigateCb!(retry);
    expect(retry.cancel).toHaveBeenCalled();
  });
});
