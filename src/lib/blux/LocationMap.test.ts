import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import LocationMap from "./LocationMap.svelte";
import { loadMapsApi, type GMapsNS } from "./maps-loader";
import type { MapRenderConfig } from "./presentation";

vi.mock("./maps-loader", () => ({ loadMapsApi: vi.fn() }));
const loadMapsApiMock = vi.mocked(loadMapsApi);

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  loadMapsApiMock.mockReset();
});

// Recording stubs for the narrow google.maps surface the component uses.
class StubLayer {
  opts: Record<string, unknown>;
  setMapCalls: unknown[] = [];
  constructor(opts: Record<string, unknown>) {
    this.opts = opts;
  }
  setMap(m: unknown) {
    this.setMapCalls.push(m);
  }
}

function makeStubMaps() {
  // Layers record creation order — the component iterates config.layers in
  // order, so index 0/1/2 = Portfolio/Dining/Parks below.
  const layers: StubLayer[] = [];
  const created: { map: unknown } = { map: undefined };
  class StubMap {
    constructor(_el: HTMLElement, _opts: Record<string, unknown>) {
      created.map = this;
    }
  }
  class RecordingKmlLayer extends StubLayer {
    constructor(opts: Record<string, unknown>) {
      super(opts);
      layers.push(this);
    }
  }
  const ns = {
    Map: StubMap,
    KmlLayer: RecordingKmlLayer,
  } as unknown as GMapsNS;
  return { ns, layers, created };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const config: MapRenderConfig = {
  mid: "test-mid",
  layers: [
    {
      name: "Portfolio",
      lid: "L0",
      initiallyVisible: true,
      preserveViewport: false,
    },
    {
      name: "Dining",
      lid: "L1",
      initiallyVisible: false,
      preserveViewport: true,
    },
    {
      name: "Parks",
      lid: "L2",
      initiallyVisible: false,
      preserveViewport: true,
    },
  ],
  toggles: [
    { label: "All", layers: ["Portfolio"] },
    { label: "Dining", layers: ["Dining"] },
    { label: "Parks", layers: ["Parks"] },
  ],
  styles: [],
};

describe("LocationMap", () => {
  it("renders the keyless placeholder and never injects the Maps script", () => {
    const { container } = render(LocationMap, { props: { map: config } });
    expect(container.querySelector("[data-map-placeholder]")).not.toBeNull();
    expect(document.querySelector('script[src*="maps.googleapis"]')).toBeNull();
  });

  it("renders one tab button per toggle with its label (glyph outside the name)", () => {
    const { getAllByRole, getByRole } = render(LocationMap, {
      props: { map: config },
    });
    const chips = getAllByRole("button");
    expect(chips).toHaveLength(3);
    // The plus/minus state glyph is aria-hidden: the accessible name is the
    // bare label, so `name:`-based queries keep working.
    for (const label of ["All", "Dining", "Parks"]) {
      expect(getByRole("button", { name: label })).toBeDefined();
    }
    // Full-width equal tabs (the original's 25%-per-tab bar): every tab flexes
    // to an equal share of the row instead of hugging its label.
    for (const c of chips) expect(c.className).toContain("flex-1");
  });

  it("active tab shows a minus glyph, inactive tabs a plus", async () => {
    const { getAllByRole } = render(LocationMap, { props: { map: config } });
    const glyphs = () =>
      getAllByRole("button").map((c) =>
        c.querySelector("[aria-hidden]")?.textContent?.trim(),
      );
    expect(glyphs()).toEqual(["−", "+", "+"]);
    const chips = getAllByRole("button");
    const second = chips[1];
    if (!second) throw new Error("missing chip");
    await fireEvent.click(second);
    expect(glyphs()).toEqual(["+", "−", "+"]);
  });

  it("selecting a tab notifies the owner via onselect (no prop mutation)", async () => {
    const seen: number[] = [];
    const { getAllByRole } = render(LocationMap, {
      props: { map: config, onselect: (i: number) => seen.push(i) },
    });
    const chips = getAllByRole("button");
    const third = chips[2];
    if (!third) throw new Error("missing chip");
    await fireEvent.click(third);
    expect(seen).toEqual([2]);
    // re-clicking the active tab does not re-notify
    await fireEvent.click(third);
    expect(seen).toEqual([2]);
  });

  it("chips are radio-style: first pressed by default, click moves the press", async () => {
    const { getAllByRole } = render(LocationMap, { props: { map: config } });
    const chips = getAllByRole("button");
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    const second = chips[1];
    expect(second).toBeDefined();
    if (!second) throw new Error("missing chip");
    await fireEvent.click(second);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });
});

describe("LocationMap with a key (mocked Maps API)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_MAPS_KEY", "test-key");
  });

  it("creates layers with initiallyVisible on the map, others off", async () => {
    const { ns, layers, created } = makeStubMaps();
    loadMapsApiMock.mockResolvedValue(ns);
    render(LocationMap, { props: { map: config } });
    await vi.waitFor(() => expect(layers).toHaveLength(3));
    const [portfolio, dining, parks] = layers;
    expect(portfolio?.opts["map"]).toBe(created.map);
    expect(dining?.opts["map"]).toBeNull();
    expect(parks?.opts["map"]).toBeNull();
    expect(portfolio?.opts["preserveViewport"]).toBe(false);
    expect(dining?.opts["preserveViewport"]).toBe(true);
  });

  it("URL-encodes mid and lid in the KML url", async () => {
    const special: MapRenderConfig = {
      ...config,
      mid: "mid with&chars",
      layers: [
        {
          name: "Portfolio",
          lid: "lid/1",
          initiallyVisible: true,
          preserveViewport: false,
        },
      ],
      toggles: [{ label: "All", layers: ["Portfolio"] }],
    };
    const { ns, layers } = makeStubMaps();
    loadMapsApiMock.mockResolvedValue(ns);
    render(LocationMap, { props: { map: special } });
    await vi.waitFor(() => expect(layers).toHaveLength(1));
    expect(layers[0]?.opts["url"]).toBe(
      "https://www.google.com/maps/d/u/0/kml?forcekmz=1&mid=mid%20with%26chars&lid=lid%2F1",
    );
  });

  it("never removes group 0's layers; other groups leave the map when toggled away", async () => {
    const { ns, layers, created } = makeStubMaps();
    loadMapsApiMock.mockResolvedValue(ns);
    const { getByRole } = render(LocationMap, { props: { map: config } });
    await vi.waitFor(() => expect(layers).toHaveLength(3));
    const [portfolio, dining, parks] = layers;

    await fireEvent.click(getByRole("button", { name: "Dining" }));
    expect(dining?.setMapCalls).toEqual([created.map]);
    // Leaving group 0 must NOT remove the portfolio layer (original quirk).
    expect(portfolio?.setMapCalls).not.toContain(null);

    await fireEvent.click(getByRole("button", { name: "Parks" }));
    expect(dining?.setMapCalls).toEqual([created.map, null]);
    expect(parks?.setMapCalls).toEqual([created.map]);
    expect(portfolio?.setMapCalls).not.toContain(null);
  });

  it("applies a toggle clicked before the Maps API resolves (I1)", async () => {
    const { ns, layers, created } = makeStubMaps();
    const d = deferred<GMapsNS>();
    loadMapsApiMock.mockReturnValue(d.promise);
    const { getByRole } = render(LocationMap, { props: { map: config } });

    // Click while the loader is still pending — must not be lost.
    await fireEvent.click(getByRole("button", { name: "Dining" }));
    expect(layers).toHaveLength(0);

    d.resolve(ns);
    await vi.waitFor(() => expect(layers).toHaveLength(3));
    const [portfolio, dining] = layers;
    // The pre-load selection is caught up: Dining ends up on the map.
    expect(dining?.setMapCalls.at(-1)).toBe(created.map);
    // prev=0 catch-up keeps the portfolio on the map.
    expect(portfolio?.setMapCalls).not.toContain(null);
  });

  it("re-clicking the active chip does not re-apply its layers (M2)", async () => {
    const { ns, layers } = makeStubMaps();
    loadMapsApiMock.mockResolvedValue(ns);
    const { getByRole } = render(LocationMap, { props: { map: config } });
    await vi.waitFor(() => expect(layers).toHaveLength(3));

    await fireEvent.click(getByRole("button", { name: "All" }));
    for (const l of layers) expect(l.setMapCalls).toEqual([]);
  });
});
