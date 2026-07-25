import { error } from "@sveltejs/kit";
import {
  getProduct,
  getCategory,
  productsInCategory,
  productSlugs,
  categorySlugs,
} from "$lib/blux/products";

// Inherit the layout's `prerender = "auto"`: the entries below are prerendered
// as static pages, and an unconverted starter (empty catalog → no entries)
// simply generates nothing instead of erroring on an unseen forced-prerender
// route.

// The prerender entry list: every product slug AND every category-listing slug.
// /products/<x> is a shared namespace (like Blux) — <x> is a product or a
// category. Empty on an unconverted starter until `blux convert` fills the
// catalog.
export function entries() {
  return [...productSlugs(), ...categorySlugs()].map((slug) => ({ slug }));
}

export function load({ params }) {
  // A product slug → the detail page.
  const product = getProduct(params.slug);
  if (product) {
    return {
      mode: "detail" as const,
      product,
      title: product.title,
      // og:image = the product image so shared cards aren't blank; description
      // = its dimensions (what the detail page shows).
      meta_image: product.image?.url,
      meta_description: product.dimensions || undefined,
    };
  }

  // A category slug → the listing page (the detail pages' back-link target).
  const category = getCategory(params.slug);
  if (category) {
    return {
      mode: "listing" as const,
      category,
      products: productsInCategory(category),
      title: category,
    };
  }

  error(404, { message: "Product not found" });
}
