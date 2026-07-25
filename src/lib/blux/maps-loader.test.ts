import { afterEach, describe, expect, it, vi } from "vitest";

// The loader keeps module-level once-guard state, so each test imports a
// fresh copy via resetModules + dynamic import.
async function freshLoader() {
  vi.resetModules();
  const mod = await import("./maps-loader");
  return mod.loadMapsApi;
}

function mapsScripts(): HTMLScriptElement[] {
  return Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[src*="maps.googleapis"]',
    ),
  );
}

/** Simulate the JS API arriving: invoke the callback global from the src. */
function fireCallback(script: HTMLScriptElement) {
  const cb = new URL(script.src).searchParams.get("callback");
  if (!cb) throw new Error("script src has no callback param");
  const w = window as unknown as Record<string, (() => void) | undefined>;
  w[cb]?.();
}

afterEach(() => {
  mapsScripts().forEach((s) => s.remove());
  delete (window as unknown as { google?: unknown }).google;
  vi.resetModules();
});

describe("loadMapsApi", () => {
  it("injects the script once and shares the promise across callers", async () => {
    const loadMapsApi = await freshLoader();
    const gm = { Map: class {}, KmlLayer: class {} };
    const p1 = loadMapsApi("k1");
    const p2 = loadMapsApi("k1");
    expect(p2).toBe(p1);
    const scripts = mapsScripts();
    expect(scripts).toHaveLength(1);
    const script = scripts[0];
    if (!script) throw new Error("script missing");
    expect(script.src).toContain("key=k1");

    (window as unknown as { google?: unknown }).google = { maps: gm };
    fireCallback(script);
    await expect(p1).resolves.toBe(gm);
  });

  it("resets the once-guard when the script loads without google.maps (M3)", async () => {
    const loadMapsApi = await freshLoader();
    const p1 = loadMapsApi("k1");
    p1.catch(() => {});
    const first = mapsScripts()[0];
    if (!first) throw new Error("script missing");
    fireCallback(first); // window.google absent -> reject
    await expect(p1).rejects.toThrow(/google\.maps/);

    // A retry must start a fresh load, not return the rejected promise.
    const p2 = loadMapsApi("k1");
    p2.catch(() => {});
    expect(p2).not.toBe(p1);
    expect(mapsScripts()).toHaveLength(2);
  });

  it("resets the once-guard when the script errors", async () => {
    const loadMapsApi = await freshLoader();
    const p1 = loadMapsApi("k1");
    p1.catch(() => {});
    const first = mapsScripts()[0];
    if (!first) throw new Error("script missing");
    first.dispatchEvent(new Event("error"));
    await expect(p1).rejects.toThrow(/Failed to load/);

    const p2 = loadMapsApi("k1");
    p2.catch(() => {});
    expect(p2).not.toBe(p1);
    expect(mapsScripts()).toHaveLength(2);
  });
});
