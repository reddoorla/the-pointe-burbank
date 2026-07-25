<script lang="ts">
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import ContentBand from "$lib/components/ContentBand.svelte";
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import BluxSectionBand from "$lib/blux/SectionBand.svelte";
  import type { RichTextField } from "@prismicio/client";

  // Inline prop types (the generated Content.* types don't include this slice
  // until it's pushed to a wired Prismic repo), mirroring the sibling slices.
  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: {
        band?: number | null;
        eyebrow?: string | null;
        body: RichTextField;
      };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();

  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );
</script>

<!-- A labelled lead paragraph: a small eyebrow above the opening copy. Plain,
     token-driven styling so a converted site can restyle it freely. -->
{#snippet content()}
  <ContentBand
    sliceType={slice.slice_type}
    variation={slice.variation}
    contentClass="richtext-block max-w-2xl px-6 py-10"
  >
    {#if slice.primary.eyebrow}
      <!-- The eyebrow names the section → it's the section heading (h2). -->
      <h2
        class="mb-3 text-sm font-semibold tracking-wide text-secondary uppercase"
      >
        {slice.primary.eyebrow}
      </h2>
    {/if}
    <div class="text-lg">
      <RichTextBody field={slice.primary.body} />
    </div>
  </ContentBand>
{/snippet}

{#if band}
  <BluxSectionBand
    {band}
    sliceType={slice.slice_type}
    sliceVariation={slice.variation}
  >
    {@render content()}
  </BluxSectionBand>
{:else}
  {@render content()}
{/if}
