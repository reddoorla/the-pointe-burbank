import { describe, it, expect } from "vitest";
import { shouldIntercept, type NavigationLike } from "./preNavIntercept";

function nav(overrides: Partial<NavigationLike> = {}): NavigationLike {
  return {
    type: "link",
    willUnload: false,
    from: { url: new URL("https://example.com/") },
    to: {
      url: new URL("https://example.com/about"),
      route: { id: "/about" },
    },
    ...overrides,
  };
}

describe("shouldIntercept", () => {
  it("intercepts a normal cross-page link navigation", () => {
    expect(shouldIntercept(nav())).toBe(true);
  });

  it("never intercepts under prefers-reduced-motion", () => {
    expect(shouldIntercept(nav(), { reducedMotion: true })).toBe(false);
  });

  it("never intercepts popstate (back/forward must stay native)", () => {
    expect(shouldIntercept(nav({ type: "popstate" }))).toBe(false);
  });

  it("never intercepts unloading navigations", () => {
    expect(shouldIntercept(nav({ type: "leave", willUnload: true }))).toBe(
      false,
    );
  });

  it("skips external navigations (no target)", () => {
    expect(shouldIntercept(nav({ to: null }))).toBe(false);
  });

  it("skips URLs that match no route (route id null)", () => {
    expect(
      shouldIntercept(
        nav({
          to: {
            url: new URL("https://example.com/unmatched"),
            route: { id: null },
          },
        }),
      ),
    ).toBe(false);
  });

  it("skips same-pathname hash navigation", () => {
    expect(
      shouldIntercept(
        nav({
          from: { url: new URL("https://example.com/about") },
          to: {
            url: new URL("https://example.com/about#team"),
            route: { id: "/about" },
          },
        }),
      ),
    ).toBe(false);
  });

  it("skips same-pathname query-only navigation", () => {
    expect(
      shouldIntercept(
        nav({
          from: { url: new URL("https://example.com/products?page=1") },
          to: {
            url: new URL("https://example.com/products?page=2"),
            route: { id: "/products" },
          },
        }),
      ),
    ).toBe(false);
  });

  it("lets its own deferred goto through (pendingHref matches)", () => {
    expect(
      shouldIntercept(nav(), { pendingHref: "https://example.com/about" }),
    ).toBe(false);
  });

  it("re-intercepts a different target while one is pending (rapid click)", () => {
    expect(
      shouldIntercept(nav(), { pendingHref: "https://example.com/other" }),
    ).toBe(true);
  });

  it("intercepts when there is no `from` (defensive default)", () => {
    expect(shouldIntercept(nav({ from: null }))).toBe(true);
  });
});
