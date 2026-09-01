<script lang="ts">
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import ContentBand from "$lib/components/ContentBand.svelte";
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { cappedWidths } from "@reddoorla/maintenance/images";

  let { slice }: { slice: Content.SectionGridSlice } = $props();
  let columns = $derived(slice.primary.columns ?? 3);
  const colClass: Record<number, string> = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };

  type Item = Content.SectionGridSliceDefaultItem;
  const hasText = (i: Item) =>
    isFilled.richText(i.item_heading) || isFilled.richText(i.item_body);
  const hasMedia = (i: Item) => isFilled.image(i.item_media);

  let items = $derived(slice.items as Item[]);

  // Four layouts, chosen by what the items carry (mirrors the original's
  // archetypes): all bare images → tile strip; all image+text → card grid;
  // text plus bare-image items → magazine split; no bare-image items → copy.
  let textItems = $derived(items.filter((i) => hasText(i) || !hasMedia(i)));
  let mediaItems = $derived(items.filter((i) => hasMedia(i) && !hasText(i)));
  let mode = $derived(
    items.length > 0 && items.every((i) => hasMedia(i) && !hasText(i))
      ? "tiles"
      : items.length > 0 && items.every((i) => hasMedia(i) && hasText(i))
        ? "cards"
        : mediaItems.length === 0
          ? "copy"
          : "split",
  );
  // Small images (rule ornaments, logos) render at natural size; photos fill.
  const isSmall = (i: Item) => (i.item_media?.dimensions?.width ?? 9999) < 480;
</script>

<ContentBand
  sliceType={slice.slice_type}
  variation={slice.variation}
  contentClass="max-w-7xl px-6 py-16"
>
  {#if isFilled.richText(slice.primary.heading)}
    <div class="mb-10 text-center">
      <PrismicRichText field={slice.primary.heading} />
    </div>
  {/if}

  {#if mode === "tiles"}
    <div class="grid grid-cols-2 gap-6 md:grid-cols-3">
      {#each items as item (item)}
        <PrismicLink
          field={item.item_link}
          class="flex items-center justify-center bg-surface p-8"
        >
          <!-- Logo tile: capped at 4rem tall, so it never needs a wide candidate. -->
          <PrismicImage
            field={item.item_media}
            widths={cappedWidths(item.item_media, [160, 320, 480])}
            sizes="(min-width: 768px) 320px, 45vw"
            loading="lazy"
            class="max-h-16 w-auto object-contain"
          />
        </PrismicLink>
      {/each}
    </div>
  {:else if mode === "cards"}
    <div
      data-grid-columns={columns}
      class="grid grid-cols-1 gap-10 {colClass[columns] ?? 'md:grid-cols-3'}"
    >
      {#each items as item (item)}
        <PrismicLink field={item.item_link} class="block">
          <!-- Card thumb: 3 columns of the 80rem band, so ~384px at md and up. -->
          <PrismicImage
            field={item.item_media}
            widths={cappedWidths(item.item_media)}
            sizes="(min-width: 768px) 384px, calc(100vw - 3rem)"
            loading="lazy"
            class="mb-4 aspect-[4/3] w-full object-cover"
          />
          <PrismicRichText field={item.item_heading} />
          <RichTextBody field={item.item_body} />
        </PrismicLink>
      {/each}
    </div>
  {:else if mode === "copy"}
    <div class="flex max-w-3xl flex-col gap-6">
      {#each textItems as item (item)}
        <div>
          <PrismicRichText field={item.item_heading} />
          <RichTextBody field={item.item_body} />
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
      <div class="flex flex-col gap-6 lg:col-span-5">
        {#each textItems as item (item)}
          <div>
            <PrismicRichText field={item.item_heading} />
            {#if hasMedia(item)}
              <!-- Inline in the 5-of-12 copy column (~480px). -->
              <PrismicImage
                field={item.item_media}
                widths={cappedWidths(item.item_media)}
                sizes="(min-width: 1024px) 480px, calc(100vw - 3rem)"
                loading="lazy"
                class="mt-2 h-auto w-auto"
              />
            {/if}
            <RichTextBody field={item.item_body} />
          </div>
        {/each}
      </div>
      <div class="flex flex-col gap-10 lg:col-span-7">
        {#each mediaItems as item, i (item)}
          <!-- Media column: 7 of 12 (~700px), every other one inset to 85%. -->
          <PrismicImage
            field={item.item_media}
            widths={cappedWidths(item.item_media)}
            sizes="(min-width: 1024px) 700px, calc(100vw - 3rem)"
            loading="lazy"
            class="h-auto {isSmall(item) ? 'w-auto' : 'w-full'} {i % 2 === 1
              ? 'lg:ml-12 lg:max-w-[85%]'
              : ''}"
          />
        {/each}
      </div>
    </div>
  {/if}
</ContentBand>
