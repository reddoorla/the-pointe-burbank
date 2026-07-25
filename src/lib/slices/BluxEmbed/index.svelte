<script lang="ts">
  import { isFilled, type Content } from "@prismicio/client";
  let { slice }: { slice: Content.BluxEmbedSlice } = $props();
</script>

{#if isFilled.keyText(slice.primary.embed_html)}
  <div class="blux-embed" data-embed-kind={slice.primary.embed_kind}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html slice.primary.embed_html}
  </div>
{/if}
