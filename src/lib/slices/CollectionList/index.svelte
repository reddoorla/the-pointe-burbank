<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import type { Content, ImageField, RichTextField } from "@prismicio/client";

  type CollectionDoc = {
    uid: string;
    data: { title: unknown; media?: { url?: string; alt?: string | null } };
  };

  interface Props {
    slice: Content.CollectionListSlice;
    context?: { collections?: Record<string, CollectionDoc[]> };
  }

  let { slice, context }: Props = $props();
  let docs = $derived(
    (context?.collections?.[slice.primary.collection_type ?? ""] ?? []).slice(
      0,
      slice.primary.max_items ?? 24,
    ),
  );
  let listClass = $derived(
    slice.variation === "list"
      ? "flex flex-col gap-6"
      : "grid grid-cols-1 gap-8 md:grid-cols-3",
  );
</script>

<section
  data-slice-type={slice.slice_type}
  data-slice-variation={slice.variation}
  class="mx-auto max-w-6xl px-6 py-12"
>
  <PrismicRichText field={slice.primary.heading} />
  <div class="mt-8 {listClass}">
    {#each docs as doc (doc.uid)}
      <article>
        {#if doc.data.media?.url}
          <PrismicImage
            field={doc.data.media as unknown as ImageField}
            class="mb-3 h-auto w-full rounded"
          />
        {/if}
        <PrismicRichText field={doc.data.title as RichTextField} />
      </article>
    {/each}
  </div>
</section>
