<script lang="ts">
  import type { Snippet } from "svelte";
  import type { BandPresentation } from "./presentation";
  import Media from "./Media.svelte";
  import { animateIn } from "$lib/actions/animateIn";

  type Props = {
    band: BandPresentation | null;
    children: Snippet;
    /** True for the first band: its background image is the likely LCP. */
    eagerBackground?: boolean;
    /** Slice-identity data-attrs, for parity with the generated slice roots. */
    sliceType?: string;
    sliceVariation?: string;
  };
  let {
    band,
    children,
    eagerBackground = false,
    sliceType,
    sliceVariation,
  }: Props = $props();

  // Band style carries a few keys that aren't valid CSS-as-is:
  //  - `_`-prefixed synthetic hints (e.g. `_contentPadding`, `_max-content-width`)
  //    are consumed by the slice wrappers, not emitted here.
  //  - `vertical-align: middle` is Blux's vertical centering → flex below.
  //  - a fixed `height` would clip taller content → relax to `min-height`.
  const styleAttr = $derived.by(() => {
    const s = band?.style;
    if (!s) return undefined;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(s)) {
      if (k.startsWith("_")) continue;
      if (k === "vertical-align") continue;
      // Content alignment + geometry is owned by BandContent, not the section.
      if (k === "text-align") continue;
      if (k === "height") {
        parts.push(`min-height: ${v}`);
        continue;
      }
      parts.push(`${k}: ${v}`);
    }
    return parts.length ? parts.join("; ") : undefined;
  });
  // Blux centers a band's content vertically with `vertical-align: middle`.
  const centered = $derived(band?.style?.["vertical-align"] === "middle");
</script>

<!-- One rendered band: full-bleed section carrying the band's block style and
     optional background media; content sits above the background. -->
<section
  id={band?.index != null ? String(band.index) : undefined}
  class="relative isolate w-full scroll-mt-24 {centered
    ? 'flex flex-col justify-center'
    : ''}"
  style={styleAttr}
  data-slice-type={sliceType}
  data-slice-variation={sliceVariation}
>
  {#if band?.background}
    <div class="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <Media
        media={band.background}
        class="h-full w-full object-cover"
        loading={eagerBackground ? "eager" : "lazy"}
      />
    </div>
  {/if}
  <!-- Reveal the band's content on scroll-in with the fleet's animateIn (fade +
       subtle rise) — the faithful stand-in for Blux's runtime scroll effects,
       using our own system. The background stays static; the hero
       (`eagerBackground`, above the fold) renders immediately so it isn't
       hidden on load; animateIn no-ops under prefers-reduced-motion. A fixed
       32px rise (not the action's height-relative 50% default) keeps the slide
       subtle regardless of how tall the band is. -->
  {#if eagerBackground}
    {@render children()}
  {:else}
    <div class="w-full" use:animateIn={{ translateY: "32px" }}>
      {@render children()}
    </div>
  {/if}
</section>
