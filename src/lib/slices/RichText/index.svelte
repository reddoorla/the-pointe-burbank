<script lang="ts">
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import ContentBand from "$lib/components/ContentBand.svelte";
  import type { Content } from "@prismicio/client";
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import BluxSectionBand from "$lib/blux/SectionBand.svelte";

  // `band` is a new optional Number field not in the generated prismic types
  // yet (regenerating them needs a wired Prismic repo), so intersect it in.
  let {
    slice,
    context,
  }: {
    slice: Content.RichTextSlice & { primary: { band?: number | null } };
    context?: { presentation?: Presentation };
  } = $props();

  const band = $derived(
    bandFor(context?.presentation, slice.primary.band ?? null),
  );
</script>

<!-- Standalone copy blocks are centered section openers and interstitial
     blurbs — centered, on a comfortable measure. -->
{#snippet content()}
  <ContentBand
    sliceType={slice.slice_type}
    variation={slice.variation}
    contentClass="richtext-block max-w-3xl px-6 py-10 text-center"
  >
    <RichTextBody field={slice.primary.content} />
  </ContentBand>
{/snippet}

{#if band}
  <!-- A Blux band index wraps today's output in the band's <section> (block
       style + background from the manifest); without one the slice renders
       exactly as before. -->
  <BluxSectionBand {band}>
    {@render content()}
  </BluxSectionBand>
{:else}
  {@render content()}
{/if}
