import { describe, it, expect } from "vitest";
import cfg from "./frozen/home.map.json";
import type { FrozenMapConfig } from "./frozen-map";

// Integrity gate for the committed map artifact: the hydrator trusts this
// shape (extracted from the catalog emit's fidelity-reviewed data-map-config),
// so a malformed artifact should fail here, not silently on the live page.
describe("frozen/home.map.json (map artifact)", () => {
  const config = cfg as FrozenMapConfig;

  it("targets the frozen map mount", () => {
    expect(config.mountId).toBe("burbank_map");
    expect(config.mid).toMatch(/^[\w-]{10,}$/);
  });

  it("carries complete lid-scoped layers", () => {
    expect(config.layers.length).toBeGreaterThan(0);
    for (const l of config.layers) {
      expect(l.name).toBeTruthy();
      expect(l.lid).toBeTruthy();
    }
    // Exactly one layer seeds the viewport (the portfolio group).
    const seeds = config.layers.filter(
      (l) => l.initiallyVisible && l.preserveViewport === false,
    );
    expect(seeds).toHaveLength(1);
  });

  it("toggles reference only real layers and start at the portfolio", () => {
    const names = new Set(config.layers.map((l) => l.name));
    expect(config.toggles.length).toBeGreaterThan(0);
    for (const t of config.toggles) {
      expect(t.label).toBeTruthy();
      for (const n of t.layers) expect(names.has(n)).toBe(true);
    }
    expect(config.defaultToggle ?? 0).toBe(0);
  });

  it("ships the original's custom map styling", () => {
    expect(Array.isArray(config.styles)).toBe(true);
    expect(config.styles.length).toBeGreaterThan(0);
  });
});
