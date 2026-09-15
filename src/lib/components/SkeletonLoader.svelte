<script lang="ts">
  interface SkeletonProps {
    lines?: number;
    circle?: boolean;
    height?: string;
    width?: string;
    class?: string;
  }

  let {
    lines = 1,
    circle = false,
    height = "",
    width = "100%",
    class: passedClasses = "",
  }: SkeletonProps = $props();
</script>

{#if circle}
  <div
    class="rounded-full bg-light/30 animate-pulse {passedClasses}"
    style="width: {height || '3rem'}; height: {height || '3rem'};"
  ></div>
{:else}
  <div class="flex flex-col gap-3 {passedClasses}" style="width: {width};">
    {#each Array(lines) as _, i (i)}
      <div
        class="rounded bg-light/30 animate-pulse"
        style="height: {height || '1rem'}; width: {i === lines - 1 && lines > 1 ? '75%' : '100%'};"
      ></div>
    {/each}
  </div>
{/if}
