import { asText } from "@prismicio/client";

import type { PageDocument } from "../../prismicio-types";

/** Page-document resolution for the shared `[[preview]]` routes.
 *
 * A cloned starter has EITHER native `page` documents (the /new-site flow) OR
 * `catalog_page` documents (a Blux migration) — a given repo only ever
 * populates one, and both carry a uid + a title + a slice zone the shared
 * SliceZone renders (a migration pins its homepage to uid `"home"`, matching the
 * native root-route contract). `page` is queried first so the native flow's
 * happy path stays a single request; only an actual miss (already 404-bound) or
 * a migrated repo pays the extra `catalog_page` probe.
 *
 * `catalog_page` is deliberately NOT in this template's generated types — the
 * migration adds it to the *target* repo, so shipping it to every fresh clone
 * would be noise. It is queried through the same duck-typed client the rest of
 * the catalog load path uses (see `loadCollections`). Method syntax on the
 * client type keeps the real, narrowly-typed Prismic client assignable via
 * method-parameter bivariance. */

/** The document types a rendered page can come from, native first. */
export const PAGE_DOC_TYPES = ["page", "catalog_page"] as const;

/** Minimal read surface these helpers need — method syntax is load-bearing (see
 * module note). Returns are widened to `unknown` so the real client's per-type
 * generic returns stay assignable; the resolved docs are cast to `PageDocument`
 * (a `catalog_page` doc is structurally a `page` minus the SEO tab, whose reads
 * are all undefined-safe — see `pageMeta`). */
type PageReadClient = {
  getByUID(type: string, uid: string): Promise<unknown>;
  getAllByType(type: string): Promise<unknown[]>;
};

/** Resolve one page by uid, trying each page type in order. Rejects (like
 * `getByUID`) only when NO page type has the uid — the loaders turn that into a
 * 404. */
export async function getPageDoc(
  client: PageReadClient,
  uid: string,
): Promise<PageDocument> {
  let lastError: unknown;
  for (const type of PAGE_DOC_TYPES) {
    try {
      return (await client.getByUID(type, uid)) as PageDocument;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Every page document across all page types — the prerender entry list for the
 * dynamic `[uid]` route. `getAllByType` on a type the repo has no documents for
 * returns an empty list (the filter is on the `document.type` value; only
 * `getFirst` throws on zero results), so this is safe on both fresh and migrated
 * repos WITHOUT swallowing errors: a genuine query failure rejects and fails the
 * prerender build loudly, exactly as the native page-only flow did before. */
export async function getAllPageDocs(
  client: PageReadClient,
): Promise<PageDocument[]> {
  const groups = await Promise.all(
    PAGE_DOC_TYPES.map(
      async (type) => (await client.getAllByType(type)) as PageDocument[],
    ),
  );
  return groups.flat();
}

/** The dynamic `[uid]` route's prerender entries: one per page document, with
 * "home" excluded (it renders at the root route, so /home would duplicate it). */
export function toPrerenderEntries(docs: PageDocument[]): { uid: string }[] {
  return docs
    .filter((doc) => doc.uid !== "home")
    .map((doc) => ({ uid: doc.uid }));
}

/** The layout's SEO/head payload for a page document. `catalog_page` docs carry
 * no SEO tab (meta_title/meta_description/meta_image), so every meta read is
 * undefined-safe; `title` lives on the Main tab and is always present. Shared by
 * both `[[preview]]` loaders so the two stay identical. */
export function pageMeta(page: PageDocument) {
  return {
    title: asText(page.data.title),
    meta_description: page.data.meta_description,
    meta_title: page.data.meta_title,
    meta_image: page.data.meta_image?.url,
    meta_image_alt: page.data.meta_image?.alt ?? undefined,
  };
}
