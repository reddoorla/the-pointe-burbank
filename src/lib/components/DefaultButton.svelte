<script lang="ts">
  import type { Snippet } from "svelte";

  interface ButtonProps {
    href?: string;
    onclick?: (event: MouseEvent) => void;
    class?: string;
    children?: Snippet;
  }

  let {
    href = "",
    onclick = () => {},
    class: passedClasses = "",
    children = undefined,
  }: ButtonProps = $props();

  // `bump` supplies the transition (transform + hover colors) itself — do not
  // add Tailwind's `transition` utility alongside it: it emits later in the
  // built CSS and its longhands would override bump's timings.
  const baseClasses =
    "bump rounded border-2 border-solid border-dark px-10 pt-4 pb-3 h-fit hover:bg-dark hover:text-white";
</script>

{#if href}
  <a {href} {onclick} class="{baseClasses} {passedClasses}">
    {@render children?.()}
  </a>
{:else}
  <button {onclick} class="{baseClasses} {passedClasses}">
    {@render children?.()}
  </button>
{/if}
