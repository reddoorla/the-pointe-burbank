<script lang="ts">
  import type { HTMLFormAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  interface Props extends HTMLFormAttributes {
    errors?: Record<string, string>;
    errorSummaryTitle?: string;
    children?: Snippet;
  }

  let {
    errors,
    errorSummaryTitle = "There was a problem with your submission",
    children,
    ...rest
  }: Props = $props();

  const errorEntries = $derived(errors ? Object.entries(errors) : []);
  let summaryEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (errorEntries.length > 0) {
      summaryEl?.focus();
    }
  });
</script>

<form {...rest}>
  {#if errorEntries.length > 0}
    <div
      bind:this={summaryEl}
      tabindex="-1"
      role="alert"
      aria-labelledby="form-error-summary-title"
      class="mb-6 border-2 border-red-600 bg-red-50 rounded p-4"
    >
      <h2 id="form-error-summary-title" class="font-semibold text-red-900">
        {errorSummaryTitle}
      </h2>
      <ul class="mt-2 list-disc list-inside text-sm text-red-900">
        {#each errorEntries as [field, message] (field)}
          <li>{message}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {@render children?.()}
</form>
