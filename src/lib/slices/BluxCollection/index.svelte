<script lang="ts">
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import {
    asText,
    isFilled,
    type Content,
    type ImageField,
    type LinkField,
    type RichTextField,
  } from "@prismicio/client";
  import { tagFilter } from "$lib/blux-catalog/tag-filter";
  import BluxWidget from "$lib/blux-catalog/BluxWidget.svelte";

  /** An entity document delivered via SliceZone `context.collections` —
   * structurally the Plan-2 shared-base fields a card renders. */
  type EntityDoc = {
    uid: string;
    data: {
      title?: unknown;
      media?: unknown;
      body?: unknown;
      tags?: string | null;
      date?: string | null;
      link?: unknown;
      /** Extension field from the Blux record: disabled records still migrate
       * as documents (their detail pages exist) but the live site hides them
       * from listing grids — the collection must too (feed-grid parity). */
      disabled?: boolean | null;
    };
  };

  interface Props {
    slice: Content.BluxCollectionSlice;
    context?: { collections?: Record<string, EntityDoc[]> };
  }

  let { slice, context }: Props = $props();

  const splitTags = (tags: string | null | undefined): string[] =>
    (tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const titleText = (doc: EntityDoc): string =>
    asText((doc.data.title ?? []) as RichTextField);

  /** Card-link contract: a card links ONLY to an external Web URL the record
   * carries; otherwise it does not link (detail pages are deferred). */
  const externalUrl = (doc: EntityDoc): string | undefined => {
    const link = doc.data.link as LinkField | undefined;
    return isFilled.link(link) && link.link_type === "Web"
      ? link.url
      : undefined;
  };

  let docs = $derived.by(() => {
    const all =
      context?.collections?.[slice.primary.collection_type ?? ""] ?? [];
    const match = tagFilter(slice.primary.filter_tag ?? undefined);
    const filtered = all.filter(
      (doc) => doc.data.disabled !== true && match(splitTags(doc.data.tags)),
    );
    const sorted =
      slice.primary.sort === "date"
        ? [...filtered].sort((a, b) =>
            String(b.data.date ?? "").localeCompare(String(a.data.date ?? "")),
          )
        : slice.primary.sort === "title"
          ? [...filtered].sort((a, b) =>
              titleText(a).localeCompare(titleText(b)),
            )
          : filtered;
    return isFilled.number(slice.primary.limit)
      ? sorted.slice(0, slice.primary.limit)
      : sorted;
  });

  let bandStyle = $derived(
    isFilled.keyText(slice.primary.background_color)
      ? `background-color:${slice.primary.background_color}`
      : "",
  );
</script>

{#snippet card(doc: EntityDoc)}
  <article class="blux-collection__card">
    {#if isFilled.image(doc.data.media as ImageField)}
      <PrismicImage
        field={doc.data.media as ImageField}
        class="blux-collection__card-media"
      />
    {/if}
    <PrismicRichText field={(doc.data.title ?? []) as RichTextField} />
  </article>
{/snippet}

<section
  class="blux-collection"
  data-layout={slice.primary.layout}
  data-media-ratio={slice.primary.media_ratio}
  data-scroll-load-more={slice.primary.scroll_load_more}
  style={bandStyle}
>
  {#if isFilled.image(slice.primary.background_image)}
    <PrismicImage
      field={slice.primary.background_image}
      class="blux-collection__bg"
    />
  {/if}

  {#if isFilled.richText(slice.primary.heading)}
    <PrismicRichText field={slice.primary.heading} />
  {/if}

  <div class="blux-collection__cards">
    {#each docs as doc (doc.uid)}
      {@const href = externalUrl(doc)}
      {#if href}
        <a class="blux-collection__card-link" {href}>
          {@render card(doc)}
        </a>
      {:else}
        {@render card(doc)}
      {/if}
    {/each}
  </div>

  {#if isFilled.keyText(slice.primary.widget_html)}
    <BluxWidget
      kind={slice.primary.widget_kind}
      html={slice.primary.widget_html}
    />
  {/if}
</section>
