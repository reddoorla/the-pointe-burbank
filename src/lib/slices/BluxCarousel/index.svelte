<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import BluxCell from "$lib/blux-catalog/BluxCell.svelte";
  import BluxWidget from "$lib/blux-catalog/BluxWidget.svelte";
  import type { BluxCellData } from "$lib/blux-catalog/cell";

  let { slice }: { slice: Content.BluxCarouselSlice } = $props();
  type Cell = Content.BluxCarouselSliceDefaultPrimaryCellsItem;
  let cells = $derived((slice.primary.cells ?? []) as Cell[]);

  let bandStyle = $derived(
    [
      isFilled.keyText(slice.primary.background_color)
        ? `background-color:${slice.primary.background_color}`
        : "",
      isFilled.keyText(slice.primary.min_height)
        ? `min-height:${slice.primary.min_height}`
        : "",
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<section
  class="blux-carousel"
  data-overlay={slice.primary.overlay}
  style={bandStyle}
>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage
      field={slice.primary.background_image}
      class="blux-carousel__bg"
    />
  {/if}
  {#if isFilled.richText(slice.primary.heading)}
    <PrismicRichText field={slice.primary.heading} />
  {/if}
  <div
    class="blux-carousel__track"
    data-columns-visible={slice.primary.columns_visible ?? 1}
    data-arrows={slice.primary.arrows}
    data-dots={slice.primary.dots}
    data-autoplay={slice.primary.autoplay}
  >
    {#each cells as cell (cell)}
      <BluxCell cell={cell as unknown as BluxCellData} />
    {/each}
  </div>
  {#if isFilled.keyText(slice.primary.widget_html)}
    <BluxWidget
      kind={slice.primary.widget_kind}
      html={slice.primary.widget_html}
    />
  {/if}
</section>
