import type * as prismic from "@prismicio/client";

/** The structural cell shape shared by every catalog container slice's
 * generated cell-item type (BluxSection/Grid/Gallery/... CellsItem, and their
 * SubgridItem). BluxCell.svelte renders any of them; a container casts its
 * generated `cells` items to this at the render boundary. `subgrid` is the one
 * nested level (leaf cells only); it is absent on subgrid items themselves. */
export type BluxCellData = {
  kind: prismic.SelectField<string> | null;
  title: prismic.RichTextField;
  body_html: prismic.KeyTextField;
  media: prismic.ImageField;
  media_ratio: prismic.KeyTextField;
  embed_html: prismic.KeyTextField;
  /** A url-based <img> for a doubly-nested (subgrid) image: the Migration API
   *  can't resolve a depth-2 Image field, so subgrid images ride this Text
   *  field (src rewritten to the Prismic-hosted url at migrate). Rendered in
   *  the same .blux-cell__media wrapper as a `media` Image field. */
  image_embed: prismic.KeyTextField;
  link: prismic.LinkField;
  link_label: prismic.KeyTextField;
  // --- visual-fidelity fields (Blux catalog visual layer) ---
  width?: string;
  spacing?: number | null;
  cover?: string | null;
  valign?: string | null;
  background_color?: string | null;
  content_padding?: string | null;
  title_role?: string | null;
  subgrid?: BluxCellData[];
};
