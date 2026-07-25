<script lang="ts">
  import { X } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  interface ModalProps {
    open: boolean;
    onclose?: () => void;
    class?: string;
    children?: Snippet;
  }

  let {
    open = $bindable(false),
    onclose,
    class: passedClasses = "",
    children,
  }: ModalProps = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();

  // No use:trapFocus here: showModal() already gives native focus containment,
  // Escape handling, and focus restore — adding the action would double-trap.
  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  });

  function close() {
    open = false;
    onclose?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialogEl) close();
  }
</script>

<dialog
  bind:this={dialogEl}
  onclose={close}
  onclick={handleBackdropClick}
  class="bg-transparent p-0 max-w-lg w-full mx-4 backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-[fade-in_200ms_ease-out]"
>
  <div
    class="relative bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto {passedClasses}"
  >
    <button
      type="button"
      onclick={close}
      class="absolute top-4 right-4 text-dark/60 hover:text-dark transition cursor-pointer"
      aria-label="Close"
    >
      <X size={20} />
    </button>
    <div class="p-8">
      {@render children?.()}
    </div>
  </div>
</dialog>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
