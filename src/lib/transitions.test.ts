import { describe, it, expect, beforeEach, vi } from "vitest";
import { fade, fly, slide } from "./transitions";

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

function element() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  mockMatchMedia(false);
});

describe("motion-aware transitions — normal motion", () => {
  it("passes params through to the underlying transition", () => {
    const config = fade(element(), { duration: 350, delay: 40 });
    expect(config.duration).toBe(350);
    expect(config.delay).toBe(40);
  });

  it("keeps svelte's defaults when no params are given", () => {
    const config = fade(element());
    expect(config.duration).toBe(400); // svelte/transition fade default
  });

  it("fly and slide behave the same", () => {
    expect(fly(element(), { duration: 500 }).duration).toBe(500);
    expect(slide(element(), { duration: 500 }).duration).toBe(500);
  });
});

describe("motion-aware transitions — prefers-reduced-motion", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it("collapses fade duration and delay to zero", () => {
    const config = fade(element(), { duration: 700, delay: 200 });
    expect(config.duration).toBe(0);
    expect(config.delay).toBe(0);
  });

  it("collapses fly duration and delay to zero", () => {
    const config = fly(element(), { duration: 700, delay: 200, y: 40 });
    expect(config.duration).toBe(0);
    expect(config.delay).toBe(0);
  });

  it("collapses slide duration and delay to zero", () => {
    const config = slide(element(), { duration: 700, delay: 200 });
    expect(config.duration).toBe(0);
    expect(config.delay).toBe(0);
  });

  it("still returns a usable config so elements appear/disappear", () => {
    const config = fade(element(), { duration: 700 });
    expect(typeof config.css).toBe("function");
  });
});

describe("motion-aware transitions — environment guards", () => {
  it("does not crash when matchMedia is unavailable", () => {
    // @ts-expect-error — simulating an environment without matchMedia
    delete window.matchMedia;
    const config = fade(element(), { duration: 250 });
    expect(config.duration).toBe(250);
  });
});
