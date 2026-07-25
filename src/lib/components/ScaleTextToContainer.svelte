<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  interface Props {
    children?: Snippet;
    class?: string;
  }

  let { children, class: passedClasses = "" }: Props = $props();

  let parent: HTMLElement | undefined = $state();

  function getFontSizeInPixels(element: Element): number {
    const computedStyle = window.getComputedStyle(element);
    return parseFloat(computedStyle.fontSize) || 16;
  }

  onMount(() => {
    if (!parent) return;

    const originals = new SvelteMap<HTMLElement, number>();
    const nodes = [...parent.children] as HTMLElement[];
    nodes.forEach((node) => {
      originals.set(node, getFontSizeInPixels(node));
    });

    function rescale() {
      if (!parent) return;
      const parentWidth = parent.offsetWidth;

      nodes.forEach((node) => {
        const original = originals.get(node);
        if (original) node.style.fontSize = `${original}px`;
      });

      let largest = 1;
      nodes.forEach((node) => {
        if (node.offsetWidth > largest) largest = node.offsetWidth;
      });

      const scale = parentWidth / largest;
      if (scale < 1) {
        nodes.forEach((node) => {
          const original = originals.get(node);
          if (original) node.style.fontSize = `${original * scale}px`;
        });
      }
    }

    rescale();

    const observer = new ResizeObserver(() => rescale());
    observer.observe(parent);

    return () => observer.disconnect();
  });
</script>

<div bind:this={parent} class="w-full transition-all {passedClasses}">
  {@render children?.()}
</div>
