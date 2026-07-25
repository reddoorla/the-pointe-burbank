// jsdom ships no `matchMedia`. Some libraries (notably `svelte/motion`, whose
// `Tween`/`tweened` reads `prefers-reduced-motion` when the module loads) call
// it at import time — before any test's beforeEach can stub it. Provide a
// default here so importing such a module never throws. Tests that need to
// drive reduced-motion still reassign `window.matchMedia` in beforeEach.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom ships no `IntersectionObserver`. The `animateIn` action (now on every
// Blux band via SectionBand) constructs one at mount, so any component test that
// renders revealed content would throw without it. A no-op default keeps those
// tests green; tests that need to DRIVE intersection reassign it in beforeEach.
if (
  typeof window !== "undefined" &&
  typeof window.IntersectionObserver !== "function"
) {
  class NoopIntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
