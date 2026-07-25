<script lang="ts">
  import { PrismicRichText } from "@prismicio/svelte";
  import type { RichTextComponents } from "@prismicio/svelte";
  import { setContext } from "svelte";
  import type { RichTextField } from "@prismicio/client";
  import {
    RT_HEADING_CTX,
    buildHeadingLevelMap,
    defaultLevel,
    type HeadingLevelLookup,
  } from "$lib/utils/richTextHeadings";
  import RichTextHeading from "./RichTextHeading.svelte";

  // Drop-in replacement for <PrismicRichText> that normalizes editor-authored
  // heading levels into a valid sub-outline (heading-order a11y) via aria-level,
  // without changing any visual. See $lib/utils/richTextHeadings. Everything else
  // (paragraphs, links, lists, images, embeds) renders with PrismicRichText's
  // defaults — only the heading nodes are overridden.
  let { field }: { field: RichTextField } = $props();

  const levelMap = $derived(buildHeadingLevelMap(field));
  const lookup: HeadingLevelLookup = (original) =>
    levelMap.get(original) ?? defaultLevel(original);
  setContext(RT_HEADING_CTX, lookup);

  const headingComponents: RichTextComponents = {
    heading1: RichTextHeading,
    heading2: RichTextHeading,
    heading3: RichTextHeading,
    heading4: RichTextHeading,
    heading5: RichTextHeading,
    heading6: RichTextHeading,
  };
</script>

<PrismicRichText {field} components={headingComponents} />
