<script lang="ts">
  import { animateIn } from "$lib/actions/animateIn";
  import { viewport } from "$stores/viewport.svelte";
  import { onMount } from "svelte";

  let {
    /** When true, reveals the content block on scroll into view via `use:animateIn`. Viewport-triggered only. */
    animateInOnScroll = false,
    class: passedClasses = "",
    style: passedStyle = "",
    children = undefined,
    edgeFadeColor = "",
  } = $props();

  onMount(() => viewport.subscribe());

  // Width constants mirror the inline classes below; change them here if the
  // content max-width changes so the edge fade math stays in sync.
  const CONTAINER_MAX_MD = 1220;
  const CONTAINER_MAX_XL = 1440;
  const XL_BREAKPOINT = 1340;
  const SIDE_MARGIN_RATIO = 0.04;

  // Note: keep these as literal strings — Tailwind's JIT doesn't scan template
  // literals with interpolations. If the numbers below change, update the
  // constants above so the edge-fade math stays in sync.
  const baseClasses =
    "max-w-[1220px] xl:max-w-[1440px] xl:mx-auto mx-[4%] w-[92%]";
  const defaultLayouts = "flex flex-col items-center justify-center relative";

  const edgeWidthPx = $derived.by(() => {
    const w = viewport.width;
    const mdCenteredAt = CONTAINER_MAX_MD / (1 - 2 * SIDE_MARGIN_RATIO);
    const xlCenteredAt = CONTAINER_MAX_XL / (1 - 2 * SIDE_MARGIN_RATIO);

    if (w < mdCenteredAt) return w * SIDE_MARGIN_RATIO;
    if (w < XL_BREAKPOINT) return (w - CONTAINER_MAX_MD) / 2;
    if (w < xlCenteredAt) return w * SIDE_MARGIN_RATIO;
    return (w - CONTAINER_MAX_XL) / 2;
  });
</script>

{#snippet content()}
  {#if animateInOnScroll}
    <div
      use:animateIn
      class="{baseClasses} {passedClasses || defaultLayouts}"
      style={passedStyle}
    >
      {@render children?.()}
    </div>
  {:else}
    <div
      class="{baseClasses} {passedClasses || defaultLayouts}"
      style={passedStyle}
    >
      {@render children?.()}
    </div>
  {/if}
{/snippet}

{#if edgeFadeColor}
  <div class="w-screen relative">
    <div
      class="absolute h-full top-0 right-0 z-20"
      style="background: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, {edgeFadeColor} 100%);width:{edgeWidthPx}px;"
    ></div>
    <div
      class="absolute h-full top-0 left-0 z-20"
      style="background: linear-gradient(270deg, rgba(0, 0, 0, 0) 0%, {edgeFadeColor} 100%);width:{edgeWidthPx}px;"
    ></div>
    <div class="w-screen relative">
      {@render content()}
    </div>
  </div>
{:else}
  {@render content()}
{/if}
