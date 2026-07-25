<script lang="ts">
  import { page } from "$app/state";
  import BrandIcon from "./BrandIcon.svelte";
  import { categorySlug, type Product } from "$lib/blux/product-types";

  interface Props {
    product: Product;
  }

  let { product }: Props = $props();

  // Back-link → the category listing, anchored to the sub-category section
  // (matching Blux's runtime `/products/<category>#<sub_category>`).
  const backHref = $derived(
    `/products/${categorySlug(product.category)}` +
      (product.subCategory ? `#${categorySlug(product.subCategory)}` : ""),
  );
  const backLabel = $derived(
    [product.category, product.subCategory].filter(Boolean).join(" "),
  );

  // All images, the main one first; the thumbnail rail swaps which is shown.
  const images = $derived([
    ...(product.image ? [product.image] : []),
    ...product.gallery,
  ]);
  let activeIndex = $state(0);
  const active = $derived(images[activeIndex]);

  // Share targets need the page's absolute url (client + prerender both resolve
  // it from the request origin).
  const pageUrl = $derived(page.url.href);
  const shares = $derived([
    {
      network: "facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    },
    {
      network: "twitter",
      label: "Share on Twitter",
      href: `https://twitter.com/share?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(product.title)}`,
    },
    {
      network: "pinterest",
      label: "Share on Pinterest",
      href:
        `https://www.pinterest.com/pin/create/link/?url=${encodeURIComponent(pageUrl)}` +
        (active ? `&media=${encodeURIComponent(active.url)}` : ""),
    },
  ]);
</script>

<!-- Back-link band. The top padding clears the fixed nav (matches Blux). -->
<div class="w-full bg-light px-4 pt-32 pb-6 text-center">
  <a
    href={backHref}
    class="text-sm font-medium tracking-widest uppercase hover:opacity-70"
  >
    <span aria-hidden="true">‹</span>
    {backLabel}
  </a>
</div>

<article
  class="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-start md:gap-12"
>
  <!-- Image first on mobile; the 30% info column on the left at md+ — but
       full width when the product has no image, so it isn't crammed into 30%
       with dead space. -->
  <div
    class="order-2 flex flex-col gap-6 md:order-1 {active
      ? 'md:w-[30%]'
      : 'md:w-full'}"
  >
    <div>
      <h1 class="text-accent text-3xl leading-tight font-light">
        {product.title}
      </h1>
      {#if product.dimensions}
        <p class="text-secondary mt-3 text-lg">{product.dimensions}</p>
      {/if}
    </div>

    {#if images.length > 1}
      <ul class="flex flex-wrap gap-3">
        {#each images as img, i (img.assetId + i)}
          <li>
            <button
              type="button"
              class="block h-24 w-24 overflow-hidden border-2 transition-colors"
              class:border-accent={i === activeIndex}
              class:border-light={i !== activeIndex}
              aria-label={`View image ${i + 1} of ${images.length}`}
              aria-pressed={i === activeIndex}
              onclick={() => (activeIndex = i)}
            >
              <img
                src={img.url}
                alt=""
                loading="lazy"
                class="h-full w-full object-cover"
              />
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex items-center gap-4">
      <span class="text-accent text-sm">Share</span>
      <ul class="flex items-center gap-3">
        {#each shares as share (share.network)}
          <li>
            <a
              href={share.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={share.label}
              class="inline-flex min-h-11 min-w-11 items-center justify-center text-secondary hover:opacity-70"
            >
              <BrandIcon platform={share.network} class="h-5 w-5" />
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <!-- The 70% image column. -->
  {#if active}
    <div class="order-1 flex-1 md:order-2 md:w-[70%]">
      <img
        src={active.url}
        alt={product.title}
        class="h-auto w-full object-contain"
      />
    </div>
  {/if}
</article>
