import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import CountUp from "./CountUp.svelte";

// A controllable IntersectionObserver: tests trigger intersection by hand.
class MockIO {
  static instances: MockIO[] = [];
  cb: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    MockIO.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  enter() {
    this.cb(
      [
        { isIntersecting: true, target: this.observed[0] },
      ] as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
  MockIO.instances = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  // @ts-expect-error — install the controllable observer
  window.IntersectionObserver = MockIO;
});

afterEach(() => cleanup());

const visible = (c: HTMLElement) =>
  c.querySelector('[aria-hidden="true"]')?.textContent;
const forAT = (c: HTMLElement) => c.querySelector(".sr-only")?.textContent;

const base = { value: 1234, locale: "en-US" };

describe("CountUp accessibility layers", () => {
  it("exposes the final value to assistive tech, start value to sight", () => {
    const { container } = render(CountUp, base);
    // Before it enters view: visible layer shows the start value.
    expect(visible(container)).toBe("0");
    // sr-only always carries the real, formatted final number.
    expect(forAT(container)).toBe("1,234");
  });

  it("lets a label override the accessible text", () => {
    const { container } = render(CountUp, {
      ...base,
      label: "1,234 projects delivered",
    });
    expect(forAT(container)).toBe("1,234 projects delivered");
  });

  it("formats with the given prefix/suffix/decimals", () => {
    const { container } = render(CountUp, {
      value: 38,
      suffix: "%",
      locale: "en-US",
    });
    expect(forAT(container)).toBe("38%");
  });
});

describe("CountUp trigger + reduced motion", () => {
  it("does not start until scrolled into view", async () => {
    const { container } = render(CountUp, base);
    expect(MockIO.instances).toHaveLength(1);
    expect(MockIO.instances[0].observed).toHaveLength(1);
    // Still at start until the observer fires.
    expect(visible(container)).toBe("0");
  });

  it("jumps straight to the final value under reduced motion (no observer)", async () => {
    reducedMotion = true;
    const { container } = render(CountUp, base);
    await tick();
    // No animation, no IntersectionObserver — final value shown immediately.
    expect(MockIO.instances).toHaveLength(0);
    expect(visible(container)).toBe("1,234");
  });

  it("reaches the final value once intersecting, even under reduced motion", async () => {
    reducedMotion = true;
    // reduced-motion path skips the observer, so use the visible-trigger with
    // motion on but assert the instantaneous set via the observer wiring.
    reducedMotion = false;
    const { container } = render(CountUp, base);
    // Make the tween instantaneous for a deterministic assertion.
    reducedMotion = true;
    MockIO.instances[0].enter();
    await tick();
    expect(visible(container)).toBe("1,234");
  });

  it("disconnects after the first intersection when once=true (default)", async () => {
    render(CountUp, base);
    const io = MockIO.instances[0];
    reducedMotion = true; // instant set so the run resolves synchronously
    io.enter();
    await tick();
    expect(io.disconnected).toBe(true);
  });

  it("keeps observing when once=false", async () => {
    render(CountUp, { ...base, once: false });
    const io = MockIO.instances[0];
    reducedMotion = true;
    io.enter();
    await tick();
    expect(io.disconnected).toBe(false);
  });

  it("starts on mount (no observer) when startOnVisible=false", async () => {
    reducedMotion = true; // instant, so we can read the settled value
    const { container } = render(CountUp, { ...base, startOnVisible: false });
    await tick();
    expect(MockIO.instances).toHaveLength(0);
    expect(visible(container)).toBe("1,234");
  });

  it("falls back to starting immediately if IntersectionObserver is missing", async () => {
    reducedMotion = true;
    // @ts-expect-error — simulate an environment without the observer
    delete window.IntersectionObserver;
    const { container } = render(CountUp, base);
    await tick();
    expect(visible(container)).toBe("1,234");
  });
});

describe("CountUp WCAG 2.2.2 duration guard", () => {
  it("warns in dev when the animation would run past 5s", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(CountUp, { ...base, duration: 10000 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("exceeds 5s"));
    warn.mockRestore();
  });

  it("stays quiet at a compliant duration", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(CountUp, { ...base, duration: 2000 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
