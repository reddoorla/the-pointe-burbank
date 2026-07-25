// Render-side product catalog from the Blux convert's products.json. Blux
// serves a detail page per "products" feed record at /products/<slug> from a
// Handlebars template; the emit (reddoor-maintenance src/blux/products.ts)
// rebuilds the catalog — cleaned categories, faithful slugs, resolved images —
// and this module is the render's read side. The starter ships an empty
// catalog, so an unconverted site has no product routes; `blux convert`
// replaces products.json per-site. Server-side only (imports the full catalog);
// client components import ./product-types instead.
import catalog from "./products.json";
import type { Product } from "./product-types";

export type { Product, ProductImage } from "./product-types";
export { categorySlug } from "./product-types";

import { categorySlug } from "./product-types";

const PRODUCTS = catalog as Product[];
const BY_SLUG = new Map(PRODUCTS.map((p) => [p.slug, p]));

// The distinct categories, in first-seen order, keyed by their listing slug.
// Detail pages and category listings share the /products/<x> namespace (like
// Blux), so the route disambiguates <x> as a product slug or a category slug.
const CATEGORY_BY_SLUG = new Map<string, string>();
for (const p of PRODUCTS) {
  if (p.category) CATEGORY_BY_SLUG.set(categorySlug(p.category), p.category);
}

/** The whole catalog (checked-in; empty until `blux convert`). */
export function allProducts(): Product[] {
  return PRODUCTS;
}

/** One product by its slug, or undefined. */
export function getProduct(slug: string): Product | undefined {
  return BY_SLUG.get(slug);
}

/** Every product slug — part of the prerender entry list for /products/[slug]. */
export function productSlugs(): string[] {
  return PRODUCTS.map((p) => p.slug);
}

/** The canonical category name for a listing slug, or undefined. */
export function getCategory(slug: string): string | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

/** Every category's listing slug — the other half of the prerender entries. */
export function categorySlugs(): string[] {
  return [...CATEGORY_BY_SLUG.keys()];
}

/** The listable products in a category — enabled only (Blux hides disabled
 * products from the listing grids, though their detail page still exists). */
export function productsInCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category && !p.disabled);
}
