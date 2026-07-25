<script lang="ts">
  // Renders a container-level Blux widget (the sanitized `widget_html` a
  // catalog slice carries) and, for `kind === "map"`, hydrates the emitted
  // `.blux-map` mount into a live Google map — KML layers plus the legend-chip
  // toggles. Non-map widgets, and the no-key/test path, render the static html
  // unchanged. The map wiring mirrors src/lib/blux/LocationMap.svelte (the
  // old-pipeline component), but hydrates INTO the emitted markup rather than
  // building its own DOM: the mount (`#<mountId>`) and the legend chips
  // (`.map_icon`) already live in `widget_html`.
  import {
    loadMapsApi,
    type GLayer,
    type GMapsNS,
  } from "$lib/blux/maps-loader";

  interface Props {
    kind?: string | null;
    html?: string | null;
  }
  let { kind, html }: Props = $props();

  const hasKey = !!(import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined);
  let host = $state<HTMLElement | null>(null);

  type MapCfg = {
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
  };

  /** The map config rides `.blux-map[data-map-config='<json>']` inside the
   * emitted html; parse it out of the mounted DOM. */
  const parseCfg = (root: HTMLElement): MapCfg | null => {
    const el = root.querySelector<HTMLElement>(".blux-map[data-map-config]");
    if (!el) return null;
    try {
      return JSON.parse(el.getAttribute("data-map-config") ?? "") as MapCfg;
    } catch {
      return null;
    }
  };

  $effect(() => {
    // No Maps key (dev/test) → the static legend stays, no API call. The
    // template marks `data-map-placeholder` off `hasKey` synchronously.
    if (kind !== "map" || !hasKey || !host) return;
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
    const cfg = parseCfg(host);
    const mount =
      cfg && cfg.mountId
        ? host.querySelector<HTMLElement>(`#${CSS.escape(cfg.mountId)}`)
        : null;
    if (!cfg || !mount) return; // keyed but malformed html — static legend stays

    let cancelled = false;
    // Listeners bind to chips inside {@html} DOM Svelte doesn't own, so the
    // effect must remove them itself — one AbortController covers every chip.
    const ac = new AbortController();
    const layerObjs: Record<string, GLayer> = {};
    let active = cfg.defaultToggle ?? 0;

    // clickMap semantics (verbatim from LocationMap.svelte): radio chips,
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
        // Reconcile the on-map layers with defaultToggle (LocationMap's catch-up):
        // `initiallyVisible` seeds group 0; a non-zero default applies its group
        // so the pressed chip and the visible layers can't disagree on first paint.
        if (active !== 0) applyToggle(active, 0, map);
        const chips = host!.querySelectorAll<HTMLElement>(
          ".blux-map .map_icon",
        );
        const markPressed = () =>
          chips.forEach((c, j) =>
            c.setAttribute("aria-pressed", String(j === active)),
          );
        chips.forEach((chip, i) => {
          chip.style.cursor = "pointer";
          chip.setAttribute("role", "button");
          chip.setAttribute("tabindex", "0");
          const select = () => {
            if (i === active) return; // re-applying re-fetches the KML (flicker)
            const prev = active;
            active = i;
            applyToggle(i, prev, map);
            markPressed();
          };
          chip.addEventListener("click", select, { signal: ac.signal });
          chip.addEventListener(
            "keydown",
            (e) => {
              const k = (e as KeyboardEvent).key;
              if (k === "Enter" || k === " ") {
                e.preventDefault();
                select();
              }
            },
            { signal: ac.signal },
          );
        });
        markPressed();
      })
      .catch(() => {
        // Accepted degraded state: the map div stays blank, chips stay inert.
      });

    return () => {
      cancelled = true;
      ac.abort(); // remove every chip listener bound above
    };
  });
</script>

{#if html}
  <div
    class="blux-widget"
    data-widget={kind}
    bind:this={host}
    data-map-placeholder={kind === "map" && !hasKey ? "" : undefined}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html html}
  </div>
{/if}
