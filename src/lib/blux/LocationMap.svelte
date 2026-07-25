<script lang="ts">
  // Interactive pinned map from the Blux export (plan 4). Recreates the
  // original clickMap semantics: radio-style chips where exactly one group is
  // active, and group 0's layers (the portfolio) are never removed from the
  // map. Initial framing comes from the KML bounds — the initially-visible
  // layer has preserveViewport false — so center/zoom are optional hints.
  import type { MapRenderConfig } from "./presentation";
  import { loadMapsApi, type GLayer, type GMapsNS } from "./maps-loader";

  type Props = {
    map: MapRenderConfig;
    /** Selecting a tab notifies the owner (Grid), which switches the
     * `panels: true` content row rendered elsewhere in the band tree — the
     * owner mutates its own state, keeping Svelte's ownership model happy. */
    onselect?: (i: number) => void;
  };
  let { map: config, onselect }: Props = $props();

  const key: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  let mountEl: HTMLDivElement | undefined = $state();
  let active = $state(0);
  let gmap: unknown;
  const layerObjs: Record<string, GLayer> = {};

  function applyToggle(next: number, prev: number) {
    const off = config.toggles[prev];
    const on = config.toggles[next];
    // The original's "off" handler keeps group 0 (the portfolio) on the map.
    if (prev !== 0) off?.layers.forEach((n) => layerObjs[n]?.setMap(null));
    on?.layers.forEach((n) => layerObjs[n]?.setMap(gmap));
  }

  function select(i: number) {
    if (i === active) return; // re-applying would re-fetch the KML (flicker)
    const prev = active;
    active = i;
    onselect?.(i);
    if (gmap) applyToggle(i, prev);
  }

  $effect(() => {
    if (!key || !mountEl) return;
    let cancelled = false;
    loadMapsApi(key)
      .then((g: GMapsNS) => {
        if (cancelled || !mountEl) return;
        gmap = new g.Map(mountEl, {
          ...(config.center ? { center: config.center } : {}),
          ...(config.zoom !== undefined ? { zoom: config.zoom } : {}),
          styles: config.styles,
        });
        for (const l of config.layers) {
          layerObjs[l.name] = new g.KmlLayer({
            url: `https://www.google.com/maps/d/u/0/kml?forcekmz=1&mid=${encodeURIComponent(config.mid)}&lid=${encodeURIComponent(l.lid)}`,
            preserveViewport: l.preserveViewport,
            map: l.initiallyVisible ? gmap : null,
          });
        }
        // Catch up on a chip clicked while the API was still loading; prev=0
        // skips the off pass, preserving the portfolio quirk.
        if (active !== 0) applyToggle(active, 0);
      })
      .catch(() => {
        // Accepted degraded state: the map div stays blank, chips stay inert.
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<div class="w-full">
  {#if key}
    <div bind:this={mountEl} style:height="600px" class="w-full"></div>
  {:else}
    <!-- No Maps key in this environment (dev/test): keep the layout, skip the API. -->
    <div
      data-map-placeholder
      style:height="600px"
      class="w-full bg-neutral-100"
    ></div>
  {/if}
  {#if config.toggles.length > 0}
    <!-- The original's map_icon tab bar: equal-width tabs filling the content
         row, uppercase, label left with a plus/minus state glyph right. The
         active tab is white on the page; inactive tabs are a solid grey-blue
         with white text. Colors ride custom properties so a site theme can
         override them (defaults match the Blux widget's shipped skin). On
         mobile the row would ellipsis-crush the labels, so the tabs stack as
         full-width bars — matching the original's accordion-style stack. -->
    <div class="mt-10 flex w-full max-md:flex-col">
      {#each config.toggles as t, i (i)}
        <button
          type="button"
          aria-pressed={active === i}
          class="flex min-w-0 flex-1 basis-0 cursor-pointer items-center justify-between p-2 text-left text-sm font-light tracking-wider uppercase max-md:w-full max-md:flex-none"
          style={active === i
            ? "background-color: var(--blux-map-tab-active-bg, rgb(255, 255, 255)); color: var(--blux-map-tab-active-text, rgb(75, 75, 110))"
            : "background-color: var(--blux-map-tab-bg, rgb(145, 159, 173)); color: var(--blux-map-tab-text, rgb(255, 255, 255))"}
          onclick={() => select(i)}
        >
          <span class="truncate">{t.label}</span>
          <span aria-hidden="true" class="ml-2 shrink-0"
            >{active === i ? "−" : "+"}</span
          >
        </button>
      {/each}
    </div>
  {/if}
</div>
