<script lang="ts">
  import type { BluxNode } from "$lib/blux-catalog/node";
  import { styleString } from "$lib/blux-catalog/node";
  import Self from "./BluxNode.svelte";

  let { node }: { node: BluxNode } = $props();
</script>

<svelte:element
  this={node.tag || "div"}
  class={node.className}
  style={styleString(node.style)}
>
  {#if node.image?.url}
    <img
      src={node.image.url}
      alt={node.image.alt ?? ""}
      width={node.image.width}
      height={node.image.height}
      loading="lazy"
    />
  {/if}
  {#if node.html}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML (fallback leaf), sanitized at the Emit stage (spec §6) -->
    {@html node.html}
  {/if}
  {#each node.children ?? [] as child (child)}
    <Self node={child} />
  {/each}
</svelte:element>
