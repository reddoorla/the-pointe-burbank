<script lang="ts">
  import { PrismicLink, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";

  let { slice }: { slice: Content.BluxTextSlice } = $props();
  type Button = Content.BluxTextSliceDefaultPrimaryButtonsItem;
  let buttons = $derived((slice.primary.buttons ?? []) as Button[]);
</script>

<div class="blux-text">
  {#if isFilled.richText(slice.primary.title)}<PrismicRichText
      field={slice.primary.title}
    />{/if}
  {#if isFilled.richText(slice.primary.subtitle)}<PrismicRichText
      field={slice.primary.subtitle}
    />{/if}
  {#if isFilled.richText(slice.primary.body)}<PrismicRichText
      field={slice.primary.body}
    />{/if}
  {#if isFilled.richText(slice.primary.subbody)}<PrismicRichText
      field={slice.primary.subbody}
    />{/if}
  {#if buttons.length}
    <div class="blux-text__buttons">
      {#each buttons as b (b)}
        {#if isFilled.link(b.link)}<PrismicLink
            field={b.link}
            class="blux-button">{b.label || "Learn more"}</PrismicLink
          >{/if}
      {/each}
    </div>
  {/if}
</div>
