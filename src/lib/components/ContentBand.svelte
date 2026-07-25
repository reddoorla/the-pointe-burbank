<script lang="ts">
  import type { Snippet } from "svelte";

  // The shared shell for the hand-authored Prismic slices: a full-bleed
  // <section> "band" wrapping a centered content box. Layout comes entirely
  // from the Tailwind classes the caller supplies (sectionClass/contentClass).
  // `fallbackHeight` keeps a background-image band (the hero) tall enough for
  // its photo when nothing else gives it a height.
  let {
    sliceType,
    variation,
    sectionClass = "",
    contentClass = "",
    fallbackHeight,
    background,
    children,
  }: {
    sliceType?: string;
    variation?: string;
    sectionClass?: string;
    contentClass?: string;
    fallbackHeight?: string;
    background?: Snippet;
    children: Snippet;
  } = $props();
</script>

<section
  data-slice-type={sliceType}
  data-slice-variation={variation}
  class="w-full {sectionClass}"
  style={fallbackHeight
    ? `min-height: ${fallbackHeight}; display: flex; flex-direction: column; justify-content: center`
    : undefined}
>
  {@render background?.()}
  <div class="mx-auto w-full {contentClass}">
    {@render children()}
  </div>
</section>
