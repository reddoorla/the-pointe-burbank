<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { cappedWidths } from "@reddoorla/maintenance/images";
  let { slice }: { slice: Content.BluxMediaTextSlice } = $props();

  let bandStyle = $derived(
    isFilled.keyText(slice.primary.background_color)
      ? `background-color:${slice.primary.background_color}`
      : "",
  );
</script>

<div
  class="blux-media-text"
  data-media-side={slice.primary.media_side}
  data-ratio={slice.primary.layout_ratio}
  style={bandStyle}
>
  {#if isFilled.image(slice.primary.background_image)}
    <!-- Band backdrop: absolutely positioned and cover-filled, so genuinely 100vw. -->
    <PrismicImage
      field={slice.primary.background_image}
      widths={cappedWidths(slice.primary.background_image)}
      sizes="100vw"
      class="blux-media-text__bg"
    />
  {/if}
  {#if isFilled.image(slice.primary.media)}
    <div class="blux-media-text__media">
      <PrismicImage
        field={slice.primary.media}
        widths={cappedWidths(slice.primary.media)}
        sizes="(min-width: 768px) min(1280px, 92vw), 92vw"
        loading="lazy"
      />
    </div>
  {/if}
  <div class="blux-media-text__text">
    {#if isFilled.richText(slice.primary.title)}<PrismicRichText
        field={slice.primary.title}
      />{/if}
    {#if isFilled.richText(slice.primary.body)}<PrismicRichText
        field={slice.primary.body}
      />{/if}
    {#if isFilled.link(slice.primary.link)}<PrismicLink
        field={slice.primary.link}
        >{slice.primary.link_label || "Learn more"}</PrismicLink
      >{/if}
  </div>
</div>
