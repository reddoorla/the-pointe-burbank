<script lang="ts">
  import { isFilled, type Content } from "@prismicio/client";
  import { parseBluxPayload } from "$lib/blux-catalog/node";
  import BluxNode from "./BluxNode.svelte";
  import BluxWidget from "$lib/blux-catalog/BluxWidget.svelte";

  let { slice }: { slice: Content.BluxBlockSlice } = $props();
  let root = $derived(parseBluxPayload(slice.primary.payload));
</script>

{#if root || isFilled.keyText(slice.primary.widget_html)}
  <div class="blux-block">
    {#if root}
      <BluxNode node={root} />
    {/if}
    {#if isFilled.keyText(slice.primary.widget_html)}
      <BluxWidget
        kind={slice.primary.widget_kind}
        html={slice.primary.widget_html}
      />
    {/if}
  </div>
{/if}
