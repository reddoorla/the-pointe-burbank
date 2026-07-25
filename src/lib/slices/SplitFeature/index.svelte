<script lang="ts">
  import { PrismicRichText } from "@prismicio/svelte";
  import {
    bandFor,
    type Presentation,
    type RenderMedia,
  } from "$lib/blux/presentation";
  import SectionBand from "$lib/blux/SectionBand.svelte";
  import BandContent from "$lib/blux/BandContent.svelte";
  import Grid from "$lib/blux/Grid.svelte";
  import Media from "$lib/blux/Media.svelte";
  import { isFilled } from "@prismicio/client";
  import type { RichTextField } from "@prismicio/client";

  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: { band?: number | null; body?: RichTextField | null };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();
  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );
  const split = $derived(band?.split ?? null);

  // A framed (min-height) split fills its box with the image — the source's
  // intrinsic width/aspect must not fight the cover fill: Media renders them
  // as INLINE width/aspect-ratio, which would beat the h-full/w-full classes
  // and leave the frame partially uncovered. (Rest-destructure drops them.)
  const coverMedia = (m: RenderMedia): RenderMedia => {
    const { width: _w, aspect: _a, ...rest } = m;
    return rest;
  };
</script>

{#if split}
  <SectionBand
    {band}
    sliceType={slice.slice_type}
    sliceVariation={slice.variation}
  >
    <BandContent {band}>
      <!--
        Two columns with a horizontal gutter between them at md: up, mirroring
        Blux's ~4% column gutter. The gutter is reserved out of each cell's basis
        (half of 4% per cell) so the columns still fit on one line — a plain
        gap-x with basis summing to 100% would push past the row and wrap. On
        mobile the columns stack (basis-full) and gap-y-8 spaces them instead.

        A FRAMED split (media.minHeight — the source pins the row at e.g. 90vh)
        stretches both columns to the frame instead of centering them: the
        text side's painted panel (a `_fill: column` stack) must cover its full
        column like the original, and the decorative top insets stay off — the
        reserved frame IS the design.
      -->
      <div
        class="flex w-full flex-wrap gap-y-8 md:gap-x-[4%] {split.media
          .minHeight
          ? 'md:items-stretch'
          : 'items-center'}"
        class:flex-row-reverse={split.mediaSide === "left"}
      >
        <div
          data-split-cell
          class="min-w-0 grow basis-full text-left md:basis-[calc(var(--cell-basis)_-_2%)] {split
            .media.minHeight
            ? ''
            : 'md:pt-20'}"
          style:--cell-basis="{100 - split.ratio}%"
        >
          {#if slice.primary.body && isFilled.richText(slice.primary.body)}
            <PrismicRichText field={slice.primary.body} />
          {:else}
            <Grid node={split.text} />
          {/if}
        </div>
        <div
          data-split-cell
          class="min-w-0 grow basis-full md:basis-[calc(var(--cell-basis)_-_2%)] {split
            .media.minHeight
            ? ''
            : 'md:pt-[100px]'}"
          style:--cell-basis="{split.ratio}%"
        >
          {#if split.media.minHeight}
            <!-- The source reserves the frame's height (a bg-cover block, e.g.
                 a 90vh panel) — a natural-height img would collapse the band.
                 Same cover-frame idiom as CarouselFrames; coverMedia strips
                 the intrinsic width/aspect so the inline sizing can't defeat
                 the cover fill. -->
            <div
              class="relative w-full"
              style={`min-height:${split.media.minHeight}`}
            >
              <Media
                media={coverMedia(split.media)}
                class="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          {:else}
            <Media media={split.media} class="h-auto w-full" />
          {/if}
        </div>
      </div>
    </BandContent>
  </SectionBand>
{/if}
