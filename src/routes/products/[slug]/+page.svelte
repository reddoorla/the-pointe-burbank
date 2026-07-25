<script lang="ts">
  import ProductDetail from "$lib/components/ProductDetail.svelte";
  import ProductListing from "$lib/components/ProductListing.svelte";

  let { data } = $props();
</script>

{#if data.mode === "detail"}
  <ProductDetail product={data.product} />
{:else}
  <ProductListing category={data.category} products={data.products} />
{/if}
