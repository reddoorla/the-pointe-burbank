<script lang="ts">
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";
  import {
    RT_HEADING_CTX,
    defaultLevel,
    type HeadingLevelLookup,
  } from "$lib/utils/richTextHeadings";

  // PrismicRichText renders this for every heading node, passing the node and a
  // snippet for its inner content.
  let { node, children }: { node: { type: string }; children: Snippet } =
    $props();

  // "heading3" -> 3 ("heading" is 7 chars).
  const original = $derived(Number(node.type.slice(7)));

  // Keep the original tag (so the visual size is unchanged) and only override the
  // announced level via aria-level — axe/Lighthouse compute heading level from it.
  const lookup = getContext<HeadingLevelLookup | undefined>(RT_HEADING_CTX);
  const level = $derived(lookup ? lookup(original) : defaultLevel(original));
</script>

<svelte:element this={`h${original}`} aria-level={level}
  >{@render children()}</svelte:element
>
