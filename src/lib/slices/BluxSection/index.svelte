<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import BluxCell from "$lib/blux-catalog/BluxCell.svelte";
  import BluxWidget from "$lib/blux-catalog/BluxWidget.svelte";
  import type { BluxCellData } from "$lib/blux-catalog/cell";
  import { gridCellBasis } from "$lib/blux-catalog/layout";

  let { slice }: { slice: Content.BluxSectionSlice } = $props();
  type Cell = Content.BluxSectionSliceDefaultPrimaryCellsItem;
  let cells = $derived((slice.primary.cells ?? []) as Cell[]);
  let bases = $derived(
    cells.map((c) =>
      gridCellBasis((c as BluxCellData).width || undefined, cells.length || 1),
    ),
  );

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

  let cellsStyle = $derived(
    [
      isFilled.keyText(slice.primary.max_content_width)
        ? `max-width:${slice.primary.max_content_width}`
        : "",
      isFilled.keyText(slice.primary.content_padding)
        ? `--band-pad:${slice.primary.content_padding}`
        : "",
      isFilled.keyText(slice.primary.content_padding_mobile)
        ? `--band-pad-m:${slice.primary.content_padding_mobile}`
        : "",
      isFilled.select(slice.primary.text_align)
        ? `text-align:${slice.primary.text_align}`
        : "",
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<section
  class="blux-section"
  data-cells={cells.length}
  data-overlay={slice.primary.overlay}
  style={bandStyle}
>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage
      field={slice.primary.background_image}
      class="blux-section__bg"
    />
  {/if}
  {#if isFilled.richText(slice.primary.heading)}
    {#if isFilled.keyText(slice.primary.heading_role)}
      <div class="txt-role-{slice.primary.heading_role}">
        <PrismicRichText field={slice.primary.heading} />
      </div>
    {:else}
      <PrismicRichText field={slice.primary.heading} />
    {/if}
  {/if}
  <div
    class="blux-section__cells"
    data-align={slice.primary.vertical_align}
    style={cellsStyle}
  >
    {#each cells as cell, i (cell)}
      <BluxCell cell={cell as unknown as BluxCellData} basis={bases[i]} />
    {/each}
  </div>
  {#if isFilled.keyText(slice.primary.widget_html)}
    <BluxWidget
      kind={slice.primary.widget_kind}
      html={slice.primary.widget_html}
    />
  {/if}
</section>
