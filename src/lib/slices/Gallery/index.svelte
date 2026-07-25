<script lang="ts">
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import SectionBand from "$lib/blux/SectionBand.svelte";
  import BandContent from "$lib/blux/BandContent.svelte";
  import Media from "$lib/blux/Media.svelte";

  // Source slider bands arrive as `carousel` slices from day one — the-pointe's
  // Gallery-side carousel transition mode (its live doc predated the carousel
  // slice) does NOT port. Gallery renders manifest media tiles only.
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
  const media = $derived(band?.gallery ?? null);
  // Slider frames carry per-slide captions in the source. When present we can't
  // reduce the band to a single cover frame without dropping copy, so render the
  // frames as a captioned grid (image + caption per cell) inside the band's
  // content box. Caption-less galleries keep the full-bleed single-frame view.
  const captioned = $derived(!!media?.some((m) => m.caption));
</script>

{#if media && media.length > 0}
  <SectionBand
    {band}
    sliceType={slice.slice_type}
    sliceVariation={slice.variation}
  >
    {#if captioned}
      <BandContent {band}>
        <div class="flex w-full flex-wrap gap-y-8">
          {#each media as frame, i (i)}
            <div class="min-w-0 grow basis-full md:basis-1/3">
              <Media media={frame} class="block h-auto w-full" />
              {#if frame.caption}
                <p class="txt-role-text5 mt-4">{frame.caption}</p>
              {/if}
            </div>
          {/each}
        </div>
      </BandContent>
    {:else}
      <!-- The source is a full-bleed image slider showing ONE ~80vh cover frame
           at a time. Render the first frame full-bleed at 80vh to match the
           original's default view and height; frames 1+ stay in the manifest. -->
      <div data-gallery-cell class="w-full">
        <Media
          media={media[0]}
          class="block h-[80vh] w-full object-cover"
          loading="eager"
        />
      </div>
    {/if}
  </SectionBand>
{/if}
