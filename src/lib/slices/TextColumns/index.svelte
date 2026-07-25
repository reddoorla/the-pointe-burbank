<script lang="ts">
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import ContentBand from "$lib/components/ContentBand.svelte";
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import BluxSectionBand from "$lib/blux/SectionBand.svelte";
  import type { RichTextField } from "@prismicio/client";

  type Column = { title?: string | null; body: RichTextField };
  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: {
        band?: number | null;
        eyebrow?: string | null;
        hasTopRule?: boolean | null;
        desktopColumns?: "2" | "3" | "4" | null;
        columns: Column[];
      };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();

  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );

  // Full class strings (not interpolated) so the Tailwind scanner keeps them.
  const columnsClass = $derived(
    (
      {
        "2": "md:grid-cols-2",
        "3": "md:grid-cols-3",
        "4": "md:grid-cols-4",
      } as Record<string, string>
    )[slice.primary.desktopColumns ?? "3"] ?? "md:grid-cols-3",
  );

  // With an eyebrow, that h2 is the section heading and column titles are its h3
  // children; without one the titles are the headings → promote to h2 so an
  // eyebrow-less instance never skips a level.
  const titleTag = $derived(slice.primary.eyebrow ? "h3" : "h2");
</script>

{#snippet content()}
  <ContentBand
    sliceType={slice.slice_type}
    variation={slice.variation}
    contentClass="richtext-block max-w-5xl px-6 py-10"
  >
    {#if slice.primary.eyebrow || slice.primary.hasTopRule}
      <div
        class="mb-6 {slice.primary.hasTopRule
          ? 'border-b border-light pb-2.5'
          : ''}"
      >
        {#if slice.primary.eyebrow}
          <h2
            class="text-sm font-semibold tracking-wide text-secondary uppercase"
          >
            {slice.primary.eyebrow}
          </h2>
        {/if}
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-10 {columnsClass}">
      <!-- Key by index: title is optional + non-unique, so keying on it would
           throw each_key_duplicate on a blank/repeated title. -->
      {#each slice.primary.columns as column, i (i)}
        <div>
          {#if column.title}
            <svelte:element
              this={titleTag}
              class="mb-2 text-lg font-semibold text-primary"
            >
              {column.title}
            </svelte:element>
          {/if}
          <RichTextBody field={column.body} />
        </div>
      {/each}
    </div>
  </ContentBand>
{/snippet}

{#if band}
  <BluxSectionBand
    {band}
    sliceType={slice.slice_type}
    sliceVariation={slice.variation}
  >
    {@render content()}
  </BluxSectionBand>
{:else}
  {@render content()}
{/if}
