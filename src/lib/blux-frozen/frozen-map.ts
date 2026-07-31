// Hydrate a frozen page's map mount into the live Blux location map — the
// working widget the catalog pipeline built (KML layers by lid + legend-chip
// toggles), NOT a bare whole-KML dump. The wiring mirrors
// src/lib/blux-catalog/BluxWidget.svelte verbatim, adapted to the frozen DOM:
// the mount (`#<mountId>`, the freeze's `.blux-frozen-map` placeholder) and
// the legend chips (`.map_icon`, CMS-tokenized labels) already live in the
// frozen markup, and the frozen CSS drives the active-chip skin entirely off
// `data-clicked="1"` — so toggling that attribute restores the original look.

import { loadMapsApi, type GLayer, type GMapsNS } from "$lib/blux/maps-loader";

/** Shape of a committed `frozen/<uid>.map.json` artifact (the catalog emit's
 * `data-map-config` payload, fidelity-reviewed against the live original). */
export interface FrozenMapConfig {
  mountId: string;
  mid: string;
  zoom?: number;
  center?: { lat: number; lng: number };
  defaultToggle?: number;
  styles: unknown[];
  layers: {
    name: string;
    lid: string;
    initiallyVisible?: boolean;
    preserveViewport?: boolean;
  }[];
  toggles: { label: string; layers: string[]; panelIndex: number }[];
}

/**
 * Hydrate one map config against the current document. Returns a cleanup
 * function (always safe to call). No mount in the DOM or no key → no-op.
 */
export function hydrateFrozenMap(
  cfg: FrozenMapConfig,
  key: string | undefined,
): () => void {
  const mount = document.getElementById(cfg.mountId);
  if (!mount || !key) return () => {};

  let cancelled = false;
  // Listeners bind to chips in frozen DOM Svelte doesn't own, so cleanup must
  // remove them itself — one AbortController covers every chip.
  const ac = new AbortController();
  const layerObjs: Record<string, GLayer> = {};
  let active = cfg.defaultToggle ?? 0;

  // clickMap's second half: each chip ALSO reveals its logo panel below the
  // map (`toggles[i].panelIndex`) — sibling `.cagriditem.grid-1` cells,
  // exactly one visible (the frozen DOM ships the default toggle's panel
  // shown, the rest display:none; measured on the original: shown =
  // inline-block, hidden = none). The hero slider's slides are ALSO grid-1
  // cells, so scope to the map's own page-block band and take the largest
  // sibling group big enough for every panelIndex.
  const findPanels = (): HTMLElement[] => {
    if (cfg.toggles.length === 0) return [];
    const band = mount.closest<HTMLElement>('[id^="page-block-"]');
    if (!band) return [];
    const need = Math.max(...cfg.toggles.map((t) => t.panelIndex)) + 1;
    const groups = new Map<HTMLElement, HTMLElement[]>();
    for (const cell of band.querySelectorAll<HTMLElement>(
      ".cagriditem.grid-1",
    )) {
      const parent = cell.parentElement;
      if (!parent) continue;
      const group = groups.get(parent) ?? [];
      group.push(cell);
      groups.set(parent, group);
    }
    return (
      [...groups.values()]
        .filter((g) => g.length >= need)
        .sort((a, b) => b.length - a.length)[0] ?? []
    );
  };
  const panels = findPanels();
  const showPanel = (i: number) => {
    if (panels.length === 0) return;
    const want = cfg.toggles[i]?.panelIndex ?? i;
    panels.forEach((p, idx) => {
      p.style.display = idx === want ? "inline-block" : "none";
    });
  };

  // clickMap semantics (verbatim from LocationMap/BluxWidget): radio chips,
  // exactly one active; group 0 (the portfolio) is NEVER removed from the map.
  const applyToggle = (next: number, prev: number, map: unknown) => {
    if (prev !== 0)
      cfg.toggles[prev]?.layers.forEach((n) => layerObjs[n]?.setMap(null));
    cfg.toggles[next]?.layers.forEach((n) => layerObjs[n]?.setMap(map));
  };

  void loadMapsApi(key)
    .then((g: GMapsNS) => {
      if (cancelled) return;
      const map = new g.Map(mount, {
        ...(cfg.center ? { center: cfg.center } : {}),
        ...(cfg.zoom !== undefined ? { zoom: cfg.zoom } : {}),
        styles: cfg.styles,
      });
      for (const l of cfg.layers) {
        layerObjs[l.name] = new g.KmlLayer({
          url: `https://www.google.com/maps/d/u/0/kml?forcekmz=1&mid=${encodeURIComponent(cfg.mid)}&lid=${encodeURIComponent(l.lid)}`,
          preserveViewport: l.preserveViewport,
          map: l.initiallyVisible ? map : null,
        });
      }
      // Reconcile the on-map layers with defaultToggle (LocationMap's
      // catch-up): `initiallyVisible` seeds group 0; a non-zero default
      // applies its group so chips, layers, and panel agree on first paint.
      // (Panel 0 is already the frozen default, so 0 needs no touch.)
      if (active !== 0) {
        applyToggle(active, 0, map);
        showPanel(active);
      }

      // The frozen chip bar sits next to the mount inside the same custom
      // element; the settled DOM ships chip 0 with data-clicked="1".
      const chips =
        mount.parentElement?.querySelectorAll<HTMLElement>(".map_icon") ??
        ([] as unknown as NodeListOf<HTMLElement>);
      const mark = () =>
        chips.forEach((c, j) => {
          if (j === active) c.setAttribute("data-clicked", "1");
          else c.removeAttribute("data-clicked");
          c.setAttribute("aria-pressed", String(j === active));
        });
      chips.forEach((chip, i) => {
        chip.setAttribute("role", "button");
        chip.setAttribute("tabindex", "0");
        const select = () => {
          if (i === active) return; // re-applying re-fetches the KML (flicker)
          const prev = active;
          active = i;
          applyToggle(i, prev, map);
          showPanel(i);
          mark();
        };
        chip.addEventListener("click", select, { signal: ac.signal });
        chip.addEventListener(
          "keydown",
          (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              select();
            }
          },
          { signal: ac.signal },
        );
      });
      mark();
    })
    .catch(() => {
      // Accepted degraded state: the placeholder stays, chips stay inert.
    });

  return () => {
    cancelled = true;
    ac.abort();
  };
}
