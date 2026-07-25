<script lang="ts">
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import SectionBand from "$lib/blux/SectionBand.svelte";
  import BandContent from "$lib/blux/BandContent.svelte";
  import BandTitle from "$lib/blux/BandTitle.svelte";

  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: {
        band?: number | null;
        heading?: string | null;
        subtitle?: string | null;
      };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();
  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );
</script>

<SectionBand
  {band}
  sliceType={slice.slice_type}
  sliceVariation={slice.variation}
>
  <BandContent {band}>
    <BandTitle
      heading={slice.primary.heading}
      subtitle={slice.primary.subtitle}
      text={band?.text}
    />
  </BandContent>
</SectionBand>
