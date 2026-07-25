<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
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
    <PrismicImage
      field={slice.primary.background_image}
      class="blux-media-text__bg"
    />
  {/if}
  {#if isFilled.image(slice.primary.media)}
    <div class="blux-media-text__media">
      <PrismicImage field={slice.primary.media} />
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
