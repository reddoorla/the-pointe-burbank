<script module lang="ts">
  import type { RenderMedia } from "./presentation";

  /** One rendered slide: manifest media + caption text (zipped from the
   * Prismic slice's items by the caller) + the caption's txt-role. A full-page
   * hero slide adds a `subcaption` (the project location) under the title. */
  export type CarouselFrame = {
    media: RenderMedia;
    caption?: string;
    role?: string;
    subcaption?: string;
    subrole?: string;
  };
</script>

<script lang="ts">
  import Slider from "$lib/components/Slider.svelte";
  import Media from "./Media.svelte";

  let {
    frames,
    label,
    columns = 1,
  }: {
    frames: CarouselFrame[];
    label: string;
    /** Slides visible at once (the source grid's data-columns); mobile is
     * always 1 per the Slider. */
    columns?: number;
  } = $props();
</script>

<!-- The source slider shows one full-bleed cover frame at a time with prev/next
     arrows and NO dots or autoplay (the export encodes none) — mirror exactly. -->
<div class="blux-carousel relative">
  <Slider
    itemCount={frames.length}
    {label}
    cardsPerView={columns}
    showDots={false}
    navigationClass="blux-carousel-nav"
    arrowClass="blux-carousel-arrow"
    class="w-full"
  >
    {#snippet children({ index }: { index: number })}
      {@const frame = frames[index]}
      {#if frame}
        <figure
          class="relative w-full"
          style={`min-height:${frame.media.minHeight ?? "60vh"}`}
        >
          <Media
            media={frame.media}
            class="absolute inset-0 h-full w-full object-cover"
          />
          {#if frame.caption || frame.subcaption}
            <!-- The source caption: a full-content-width white bar anchored
                 near the top of the slide (the original's .blocks0 bar is
                 1280px wide with 15px/30px padding, inset ~80px from the top)
                 — not a floating chip. A hero slide adds its location as a
                 second line under the title. -->
            <figcaption
              class="absolute inset-x-0 top-0 flex justify-center px-4 pt-20"
            >
              <span
                class="flex w-full max-w-[1280px] flex-col gap-1 bg-white px-[30px] py-[15px] text-center"
              >
                {#if frame.caption}
                  <span class={frame.role ? `txt-role-${frame.role}` : ""}
                    >{frame.caption}</span
                  >
                {/if}
                {#if frame.subcaption}
                  <span class={frame.subrole ? `txt-role-${frame.subrole}` : ""}
                    >{frame.subcaption}</span
                  >
                {/if}
              </span>
            </figcaption>
          {/if}
        </figure>
      {/if}
    {/snippet}
  </Slider>
</div>

<style>
  /* The source overlays its prev/next arrows on the frame edges, vertically
     centered (the export's buttons carry inline left/right:4px, top:50%) —
     reposition the Slider's below-track nav row to match. Scoped rules beat
     the Slider's single-utility classes deterministically. */
  .blux-carousel :global(.blux-carousel-nav) {
    position: absolute;
    inset-inline: 4px;
    top: 50%;
    transform: translateY(-50%);
    margin-top: 0;
    justify-content: space-between;
    pointer-events: none;
    z-index: 10;
  }
  .blux-carousel :global(.blux-carousel-arrow) {
    pointer-events: auto;
    color: white;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
  }
  .blux-carousel :global(.blux-carousel-arrow:hover) {
    background-color: rgb(255 255 255 / 0.25);
  }
</style>
