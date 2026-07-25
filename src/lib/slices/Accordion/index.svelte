<script lang="ts">
  import Accordion from "$lib/components/Accordion.svelte";
  import ContentBand from "$lib/components/ContentBand.svelte";
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import BluxSectionBand from "$lib/blux/SectionBand.svelte";

  // Thin slice over the shared, already-accessible Accordion primitive
  // ($lib/components/Accordion.svelte — button[aria-expanded]+aria-controls,
  // role=region, index-keyed). Body is plain text to match the primitive.
  type Item = { title?: string | null; body?: string | null };
  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: {
        band?: number | null;
        allowMultiple?: boolean | null;
        items: Item[];
      };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();

  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );
  const items = $derived(
    (slice.primary.items ?? []).map((i) => ({
      label: i.title ?? "",
      content: i.body ?? "",
    })),
  );
</script>

{#snippet content()}
  <ContentBand
    sliceType={slice.slice_type}
    variation={slice.variation}
    contentClass="max-w-3xl px-6 py-10"
  >
    <Accordion {items} allowMultiple={slice.primary.allowMultiple ?? true} />
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
