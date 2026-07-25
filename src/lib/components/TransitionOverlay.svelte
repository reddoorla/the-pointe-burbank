<script lang="ts">
  import { afterNavigate, beforeNavigate } from "$app/navigation";
  import { fade } from "$lib/transitions";

  interface Props {
    visibleDuration?: number;
    fadeOutDuration?: number;
    class?: string;
  }

  let {
    visibleDuration = 1050,
    fadeOutDuration = 700,
    class: passedClasses = "h-screen w-screen fixed z-50 bg-black top-0 left-0",
  }: Props = $props();

  let isTransitioning = $state(false);

  beforeNavigate(() => {
    isTransitioning = true;
  });

  afterNavigate(() => {
    setTimeout(() => {
      isTransitioning = false;
    }, visibleDuration);
  });
</script>

{#if isTransitioning}
  <div class={passedClasses} out:fade={{ duration: fadeOutDuration }}></div>
{/if}
