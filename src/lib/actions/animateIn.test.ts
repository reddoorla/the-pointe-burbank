import { describe, it, expect, beforeEach, vi } from "vitest";
import { animateIn } from "./animateIn";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  // Test helper — trigger an intersection event.
  trigger(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: this.observed[0],
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
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
  FakeIntersectionObserver.instances = [];
  // @ts-expect-error — replacing global for test
  window.IntersectionObserver = FakeIntersectionObserver;
  mockMatchMedia(false);
  Object.defineProperty(window, "innerWidth", {
    value: 1024,
    configurable: true,
  });
});

describe("animateIn — viewport mode", () => {
  it("applies initial hidden styles on mount", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el);

    expect(el.style.opacity).toBe("0");
  });

  it("reveals on intersection and disconnects the observer", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el);
    const observer = FakeIntersectionObserver.instances[0];
    expect(observer).toBeDefined();
    expect(observer.observed[0]).toBe(el);

    observer.trigger(true);

    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("translateY(0)");
    expect(observer.disconnected).toBe(true);
  });

  it("does not reveal when not intersecting", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el);
    FakeIntersectionObserver.instances[0].trigger(false);

    expect(el.style.opacity).toBe("0");
    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(false);
  });

  it("disconnects the observer on destroy", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const ret = animateIn(el);
    const observer = FakeIntersectionObserver.instances[0];
    ret.destroy();

    expect(observer.disconnected).toBe(true);
  });

  it("honors a custom delayMax", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
    const placed = (left = 500) => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      el.getBoundingClientRect = () =>
        ({
          left,
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
      return el;
    };

    // delayMax: 0 means the row reveals together, wherever it sits.
    const together = placed();
    animateIn(together, { delayMax: 0 });
    expect(parseFloat(together.style.transitionDelay)).toBe(0);

    // A positive delayMax bounds the delay, below the default's, even at
    // the right edge, where the delay is largest.
    const bounded = placed(999);
    animateIn(bounded, { delayMax: 100 });
    expect(parseFloat(bounded.style.transitionDelay)).toBeLessThanOrEqual(100);

    // The delay follows position: further right reveals later.
    const near = placed(200);
    animateIn(near, { delayMax: 800 });
    const far = placed(800);
    animateIn(far, { delayMax: 800 });
    expect(parseFloat(far.style.transitionDelay)).toBeGreaterThan(
      parseFloat(near.style.transitionDelay),
    );
  });

  it("staggers by index x step when `stagger` is set", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { stagger: 120, index: 3 });

    expect(el.style.transitionDelay).toBe("360ms");
  });

  it("treats a missing index as 0 (no delay) when staggering", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { stagger: 120 });

    expect(el.style.transitionDelay).toBe("0ms");
  });

  it("index-based stagger overrides the position-based delay", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
    // Positioned where the horizontal heuristic would give 200ms...
    el.getBoundingClientRect = () =>
      ({
        left: 500,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    // ...but an explicit index/stagger wins.
    animateIn(el, { stagger: 100, index: 4 });

    expect(el.style.transitionDelay).toBe("400ms");
  });

  it("still reveals a staggered element on intersection", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { stagger: 100, index: 2 });
    FakeIntersectionObserver.instances[0].trigger(true);

    expect(el.style.opacity).toBe("1");
    expect(el.style.transitionDelay).toBe("200ms");
  });
});

describe("animateIn — triggered mode", () => {
  it("mounts hidden when trigger is false (boolean shorthand)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, false);

    expect(el.style.opacity).toBe("0");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("mounts visible when trigger is true (boolean shorthand)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, true);

    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("translateY(0)");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("mounts visible when options have trigger: true", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { trigger: true });

    expect(el.style.opacity).toBe("1");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("does not set transition-delay in triggered mode", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, false);

    expect(el.style.transitionDelay).toBe("");
  });

  it("flips to visible when update passes trigger: true", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const ret = animateIn(el, false);
    expect(el.style.opacity).toBe("0");

    ret.update(true);
    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("translateY(0)");
  });

  it("flips back to hidden when update passes trigger: false", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const ret = animateIn(el, true);
    ret.update(false);

    expect(el.style.opacity).toBe("0");
  });

  it("update is a no-op in viewport mode", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const ret = animateIn(el);
    FakeIntersectionObserver.instances[0].trigger(true);
    const before = {
      transition: el.style.transition,
      opacity: el.style.opacity,
      transform: el.style.transform,
    };
    ret.update({ duration: 500 });

    // Viewport mode ignores updates: the transition is the one it mounted
    // with, and a revealed element stays revealed (the observer has already
    // disconnected, so a re-hide would leave the content invisible).
    expect(el.style.transition).toBe(before.transition);
    expect(el.style.opacity).toBe(before.opacity);
    expect(el.style.transform).toBe(before.transform);
  });
});

describe("animateIn — options overrides", () => {
  it("applies a custom duration in the transition", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { duration: 1200 });

    expect(el.style.transition).toContain("opacity 1200ms");
    expect(el.style.transition).toContain("transform 1200ms");
  });

  it("applies a custom translateY on the hidden transform", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { translateY: "24px" });

    expect(el.style.transform).toBe("translateY(24px)");
  });

  it("passes duration through in triggered mode too", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { trigger: false, duration: 800 });

    expect(el.style.transition).toContain("800ms");
  });
});

describe("animateIn — prefers-reduced-motion", () => {
  it("skips animation when reduced motion is preferred (viewport mode)", () => {
    mockMatchMedia(true);
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el);

    expect(el.style.opacity).toBe("");
    expect(el.style.transform).toBe("");
    expect(el.style.transition).toBe("");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("skips animation when reduced motion is preferred (triggered mode)", () => {
    mockMatchMedia(true);
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, false);

    expect(el.style.opacity).toBe("");
    expect(el.style.transition).toBe("");
  });
});
