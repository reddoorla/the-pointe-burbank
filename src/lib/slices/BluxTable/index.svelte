<script lang="ts">
  import { PrismicRichText } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  let { slice }: { slice: Content.BluxTableSlice } = $props();
</script>

<div class="blux-table">
  {#if isFilled.richText(slice.primary.caption)}<PrismicRichText
      field={slice.primary.caption}
    />{/if}
  {#if isFilled.keyText(slice.primary.table_html)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html slice.primary.table_html}
  {/if}
</div>
