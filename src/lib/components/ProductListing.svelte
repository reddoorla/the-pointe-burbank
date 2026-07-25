<script lang="ts">
  import { categorySlug, type Product } from "$lib/blux/product-types";

  interface Props {
    category: string;
    products: Product[];
  }

  let { category, products }: Props = $props();

  // Group by sub-category so each group gets an `id` anchor — a product detail
  // page's back-link points at `/products/<category>#<sub_category>`, and this
  // is where that anchor lands. Groups preserve first-seen order; "" (no
  // sub-category) collects into a trailing unlabelled group.
  // Plain-array grouping (few sub-categories): a Map/Set here trips
  // svelte/prefer-svelte-reactivity, and this is a transient derived value, not
  // reactive state.
  const groups = $derived.by(() => {
    const result: { subCategory: string; items: Product[] }[] = [];
    for (const p of products) {
      const key = p.subCategory ?? "";
      let group = result.find((g) => g.subCategory === key);
      if (!group) {
        group = { subCategory: key, items: [] };
        result.push(group);
      }
      group.items.push(p);
    }
    return result;
  });
</script>

<section class="mx-auto max-w-6xl px-6 pt-32 pb-16">
  <h1 class="mb-10 text-3xl font-light tracking-wide uppercase">{category}</h1>

  {#each groups as group (group.subCategory)}
    <section
      id={group.subCategory ? categorySlug(group.subCategory) : undefined}
      class="mb-12 scroll-mt-28"
    >
      {#if group.subCategory}
        <h2 class="text-secondary mb-6 text-xl font-light">
          {group.subCategory}
        </h2>
      {/if}
      <ul
        class="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4"
      >
        {#each group.items as product (product.slug)}
          <li>
            <a href={`/products/${product.slug}`} class="group block">
              <div class="aspect-square overflow-hidden bg-light">
                {#if product.image}
                  <img
                    src={product.image.url}
                    alt={product.title}
                    loading="lazy"
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                {/if}
              </div>
              <p class="mt-3 text-sm">{product.title}</p>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</section>
