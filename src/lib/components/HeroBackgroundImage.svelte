<script lang="ts">
  // LCP-optimized hero image. Two constraints drive the markup: the browser
  // must discover the image before hydration (hence the <link rel="preload">
  // in <svelte:head> — fixes Lighthouse "LCP request discovery"), and it must
  // never download the full-resolution master (hence the imgix srcset ladder).
  //
  // Multi-instance hazard: each preloading instance injects its own
  // fetchpriority=high <link>, so two hero-ish slices on one page would fight
  // for bandwidth at highest priority and slow the real LCP. Exactly one
  // above-the-fold hero per page should preload — pass `preload={false}` to
  // every other instance. (Deliberately NOT deduped via module state: module
  // scope is shared across requests during SSR, so a flag set by one request
  // would suppress the preload for every request after it.)
  import type { ImageField } from "@prismicio/client";
  import { imgix, srcset } from "$lib/utils/image";

  interface Props {
    image: ImageField;
    /** Used when the Prismic image has no alt text (satisfies image-alt for a11y + SEO). */
    altFallback?: string;
    class?: string;
    /**
     * Inject the fetchpriority=high <link rel="preload"> for this image.
     * Exactly ONE above-the-fold hero per page should preload; set false on
     * any additional instances (below-the-fold or secondary heroes).
     */
    preload?: boolean;
  }

  let {
    image,
    altFallback = "",
    class:
      passedClasses = "absolute bottom-0 left-0 h-full w-full object-cover",
    preload = true,
  }: Props = $props();

  const src = $derived(imgix(image?.url, { w: 1920 }));
  const candidates = $derived(srcset(image?.url));
  const alt = $derived(image?.alt || altFallback);
</script>

<svelte:head>
  {#if preload && image?.url}
    <link
      rel="preload"
      as="image"
      href={src}
      imagesrcset={candidates}
      imagesizes="100vw"
      fetchpriority="high"
    />
  {/if}
</svelte:head>

{#if image?.url}
  <img
    {src}
    srcset={candidates}
    sizes="100vw"
    width={image.dimensions?.width}
    height={image.dimensions?.height}
    {alt}
    fetchpriority="high"
    decoding="async"
    class={passedClasses}
  />
{/if}
