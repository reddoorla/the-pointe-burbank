<script lang="ts">
  import { onMount } from "svelte";

  let { children } = $props();

  let isMounted = $state(false);

  onMount(() => {
    isMounted = true;
  });
</script>

{#if isMounted}
  {@render children?.()}
{/if}
