<script lang="ts">
  import { onMount } from "svelte";

  import {
    enhanceFrozenHtml,
    FROZEN_ENHANCE_CSS,
  } from "$lib/blux-frozen/enhance";
  import {
    hydrateFrozenMap,
    type FrozenMapConfig,
  } from "$lib/blux-frozen/frozen-map";
  import {
    substitute,
    styleTag,
    type SlotValue,
  } from "$lib/blux-frozen/substitute";

  // Committed map artifacts (`frozen/<uid>.map.json`): one per hydratable map,
  // keyed by its mountId — only configs whose mount exists in this page's DOM
  // take effect, so the glob needs no uid plumbing.
  const frozenMapConfigs = import.meta.glob("./frozen/*.map.json", {
    eager: true,
  }) as Record<string, { default: FrozenMapConfig }>;

  // A frozen page = the Blux export's own settled markup (byte-faithful layout,
  // 316 inline styles) with editable leaves tokenized. We inject the extracted
  // <style> + font links and substitute the tokens with current content, so the
  // render matches the live site exactly while copy/images stay CMS-editable.

  interface FrozenSlot {
    key: string;
    kind: "text" | "image";
    text?: string;
    url?: string;
  }

  let {
    template,
    styleCss,
    fontLinks = [],
    slots,
  }: {
    /** Tokenized `<body>` inner HTML from the freeze (repo build artifact). */
    template: string;
    /** Extracted `<style>` block + reveal-force override. */
    styleCss: string;
    /** External stylesheet hrefs (Google Fonts) — load-bearing for metrics. */
    fontLinks?: string[];
    /** Content slots: image → resolved url, text → HTML-safe string. */
    slots: FrozenSlot[];
  } = $props();

  const values = $derived(
    new Map<string, SlotValue>(
      slots.map((s) => [
        s.key,
        s.kind === "image" ? { url: s.url } : { text: s.text },
      ]),
    ),
  );
  const html = $derived(enhanceFrozenHtml(substitute(template, values)));

  // Progressive enhancement on the frozen markup (the bare frozen route owns
  // the whole document, so page-scoped document queries are safe here):
  // 1. Scroll-reveal: the freeze force-bakes every `.block-effects` element
  //    visible (right for no-JS/SEO/reduced-motion). With JS + motion allowed,
  //    re-arm a fade-up for elements still below the fold — never above-fold
  //    ones, so nothing already visible ever flashes.
  // 2. Map: the freeze swapped the dead Google-Map DOM for a placeholder
  //    carrying the custom My-Maps KML id. With a Maps key configured, hydrate
  //    it into a live interactive map (KmlLayer re-fits the viewport).
  onMount(() => {
    const cleanups: (() => void)[] = [];

    // Sticky nav: Blux's runtime flips the `data-type="sticky"` nav from its
    // settled position:absolute to fixed once the page scrolls (measured on
    // the original: absolute at top, fixed + same white background after
    // scroll). The nav is out of flow either way, so the flip never shifts
    // layout.
    const stickyNav = document.querySelector<HTMLElement>(
      'nav[data-type="sticky"]',
    );
    if (stickyNav) {
      const pin = () => {
        stickyNav.style.position = window.scrollY > 0 ? "fixed" : "absolute";
      };
      pin();
      window.addEventListener("scroll", pin, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", pin));
    }

    // Mobile menu: the hamburger is a pure-CSS checkbox hack, so without
    // Blux's JS the overlay stays open after tapping an anchor. Close it on
    // any nav-link click.
    const menuToggle = document.querySelector<HTMLInputElement>(
      'input[id$="-menuicon"]',
    );
    if (menuToggle) {
      const closeMenu = (e: Event) => {
        if ((e.target as HTMLElement).closest("a")) menuToggle.checked = false;
      };
      document.addEventListener("click", closeMenu);
      cleanups.push(() => document.removeEventListener("click", closeMenu));
    }

    const reduced =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            io.unobserve(el);
            requestAnimationFrame(() => {
              el.classList.add("rd-fx-run");
              el.classList.remove("rd-fx-wait");
            });
          }
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      // Only elements FULLY below the viewport animate — anything partially
      // visible at load stays put (hiding it would blink: wait-class, then an
      // immediate IO reveal).
      const foldLine = window.innerHeight;
      for (const el of document.querySelectorAll<HTMLElement>(
        ".block-effects",
      )) {
        if (el.getBoundingClientRect().top > foldLine) {
          el.classList.add("rd-fx-wait");
          io.observe(el);
        }
      }
      cleanups.push(() => io.disconnect());
    }

    // Maps: hydrate each committed map artifact whose mount is in this page's
    // DOM — the full Blux location-map widget (lid-scoped KML layers + the
    // frozen legend chips), not a bare KML dump. See frozen-map.ts.
    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
    for (const mod of Object.values(frozenMapConfigs)) {
      cleanups.push(hydrateFrozenMap(mod.default, mapsKey));
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  });
</script>

<svelte:head>
  {#each fontLinks as href (href)}
    <link rel="stylesheet" {href} />
  {/each}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted freeze-emitted style block (build-time, no user input) -->
  {@html styleTag(styleCss + FROZEN_ENHANCE_CSS)}
</svelte:head>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted freeze template; tokens substituted for CMS content -->
{@html html}
