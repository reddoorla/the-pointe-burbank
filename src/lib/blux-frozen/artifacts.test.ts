import { describe, it, expect } from "vitest";
import { frozenArtifacts } from "./artifacts";

// This is a frozen Blux site: it commits its page artifacts under ./frozen, so
// the map is populated (the starter TEMPLATE ships it empty — that scoping gate
// is asserted in the template, not here). Verify the committed home artifact
// loads: template (HTML ?raw) + font links (JSON).
//
// styleCss is intentionally NOT asserted here: it is a `?raw` import of a `.css`
// file, which Vite's CSS pipeline returns EMPTY under vitest (only) — the real
// build injects the full <style> block (the prerendered home carries all 18KB).
// So the extracted CSS is verified by the build/fidelity gate, not this unit.
describe("frozenArtifacts (frozen Blux site)", () => {
  it("loads the committed home artifact — template + font links", () => {
    expect(Object.keys(frozenArtifacts)).toContain("home");

    const home = frozenArtifacts.home;
    expect(home).toBeDefined();
    // Tokenized freeze template: editable leaves are ⟦t:…⟧ / ⟦i:…⟧ markers.
    expect(home?.template).toMatch(/⟦[ti]:/);
    expect(home?.fontLinks.length).toBeGreaterThan(0);
    expect(typeof home?.styleCss).toBe("string");
  });
});
