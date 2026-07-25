<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  type FieldType =
    | "text"
    | "email"
    | "tel"
    | "url"
    | "password"
    | "number"
    | "search"
    | "textarea";

  interface Props {
    name: string;
    label: string;
    type?: FieldType;
    value?: string;
    description?: string;
    error?: string;
    required?: boolean;
    autocomplete?: HTMLInputAttributes["autocomplete"];
    placeholder?: string;
    minlength?: number;
    maxlength?: number;
    pattern?: string;
    inputmode?: HTMLInputAttributes["inputmode"];
    rows?: number;
  }

  let {
    name,
    label,
    type = "text",
    value = $bindable(""),
    description,
    error,
    required = false,
    autocomplete,
    placeholder,
    minlength,
    maxlength,
    pattern,
    inputmode,
    rows = 4,
  }: Props = $props();

  const uid = $props.id();
  const inputId = `${uid}-input`;
  const descriptionId = `${uid}-description`;
  const errorId = `${uid}-error`;

  const describedBy = $derived(
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined,
  );
</script>

<div class="flex flex-col gap-1">
  <label for={inputId} class="text-sm font-medium">
    {label}
    {#if required}
      <span aria-hidden="true" class="text-red-600">*</span>
      <span class="sr-only">(required)</span>
    {/if}
  </label>

  {#if description}
    <p id={descriptionId} class="text-sm text-secondary">{description}</p>
  {/if}

  {#if type === "textarea"}
    <textarea
      id={inputId}
      {name}
      {required}
      {rows}
      {placeholder}
      {minlength}
      {maxlength}
      {autocomplete}
      bind:value
      aria-describedby={describedBy}
      aria-invalid={error ? "true" : undefined}
      class="border-2 border-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary aria-invalid:border-red-600"
    ></textarea>
  {:else}
    <input
      id={inputId}
      {type}
      {name}
      {required}
      {placeholder}
      {minlength}
      {maxlength}
      {pattern}
      {autocomplete}
      {inputmode}
      bind:value
      aria-describedby={describedBy}
      aria-invalid={error ? "true" : undefined}
      class="border-2 border-light rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary aria-invalid:border-red-600"
    />
  {/if}

  {#if error}
    <p id={errorId} role="alert" class="text-sm text-red-600">{error}</p>
  {/if}
</div>
