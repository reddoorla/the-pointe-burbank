<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "$lib/transitions";

  let showLandscapeModal = $state(false);

  onMount(() => {
    // `pointer: coarse` avoids the false positives on touchscreen laptops that
    // a `maxTouchPoints > 0` check would produce.
    const coarse = window.matchMedia("(pointer: coarse)");
    const landscape = window.matchMedia(
      "(orientation: landscape) and (max-width: 1023px)",
    );

    const update = () => {
      showLandscapeModal = coarse.matches && landscape.matches;
    };

    update();
    coarse.addEventListener("change", update);
    landscape.addEventListener("change", update);
    return () => {
      coarse.removeEventListener("change", update);
      landscape.removeEventListener("change", update);
    };
  });
</script>

{#if showLandscapeModal}
  <div
    transition:fade
    role="dialog"
    aria-modal="true"
    aria-labelledby="landscape-heading"
    class="w-screen h-screen fixed bg-black flex justify-center items-center top-0 left-0 z-50"
  >
    <h3 id="landscape-heading" class="text-white">
      Please Switch to Portrait Mode
    </h3>
  </div>
{/if}
