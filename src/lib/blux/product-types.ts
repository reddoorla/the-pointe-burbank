// Pure product types + helpers, no data import — so client components
// (ProductDetail) can use them without pulling the whole products.json catalog
// into the browser bundle. The catalog itself lives in ./products (server side).

export type ProductImage = { assetId: string; url: string };

export type Product = {
  slug: string;
  title: string;
  category: string;
  subCategory: string;
  dimensions: string;
  tags: string[];
  disabled: boolean;
  image?: ProductImage;
  gallery: ProductImage[];
};

/** A category's listing-page slug: /products/<categorySlug> (the detail page's
 * back-link target). Matches the product slug rule so it lands on the real
 * listing. */
export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
