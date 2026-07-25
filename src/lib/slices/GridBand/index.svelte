<script lang="ts">
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import SectionBand from "$lib/blux/SectionBand.svelte";
  import BandContent from "$lib/blux/BandContent.svelte";
  import Grid from "$lib/blux/Grid.svelte";

  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: { band?: number | null };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();

  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );
</script>

{#if band?.tree}
  <SectionBand
    {band}
    sliceType={slice.slice_type}
    sliceVariation={slice.variation}
  >
    <BandContent {band}>
      <Grid node={band.tree} map={band.map} />
    </BandContent>
  </SectionBand>
{:else}
  <!-- grid_band without a manifest entry: nothing to render faithfully. -->
{/if}
