<script lang="ts">
  import { slide } from "$lib/transitions";
  import { ChevronRight } from "@lucide/svelte";
  import { SvelteSet } from "svelte/reactivity";

  interface AccordionItem {
    label: string;
    content: string;
  }

  interface Props {
    items?: AccordionItem[];
    allowMultiple?: boolean;
    class?: string;
  }

  let {
    items = [],
    allowMultiple = true,
    class: passedClasses = "",
  }: Props = $props();

  const openIndexes = new SvelteSet<number>();
  const uid = $props.id();

  function toggle(i: number) {
    if (openIndexes.has(i)) {
      openIndexes.delete(i);
    } else {
      if (!allowMultiple) openIndexes.clear();
      openIndexes.add(i);
    }
  }
</script>

<div class="w-full flex flex-col border-light border-b-2 {passedClasses}">
  {#each items as item, i (i)}
    {@const isOpen = openIndexes.has(i)}
    {@const panelId = `${uid}-panel-${i}`}
    {@const triggerId = `${uid}-trigger-${i}`}
    <div class="border-t-2 border-light">
      <button
        type="button"
        id={triggerId}
        class="w-full cursor-pointer text-left"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onclick={() => toggle(i)}
      >
        <div class="h-20 p-8 w-full flex flex-row justify-between items-center">
          <p>{item.label}</p>
          <ChevronRight
            class="transition-transform duration-300 ease-in-out opacity-80 {isOpen
              ? 'rotate-90'
              : ''}"
            size={16}
          />
        </div>
      </button>
      {#if isOpen}
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          transition:slide={{ duration: 500 }}
        >
          <p class="p-8 pt-0">{item.content}</p>
        </div>
      {/if}
    </div>
  {/each}
</div>
