import { error, redirect } from "@sveltejs/kit";

import {
  collectionTypesOf,
  loadCollections,
} from "$lib/blux-catalog/collections-load";
import {
  getAllPageDocs,
  getPageDoc,
  pageMeta,
  toPrerenderEntries,
} from "$lib/blux-catalog/page-doc";
import { frozenUids, resolveFrozen } from "$lib/blux-frozen/load";
import { createClient, isFrozenSite, isPlaceholderRepo } from "$lib/prismicio";

export async function load({ params, fetch, cookies }) {
  if (params.uid === "home") redirect(308, "/");

  const client = createClient({ fetch, cookies });

  // A frozen Blux page (committed template artifact + published frozen_page doc)
  // renders through <FrozenPage>; every other repo falls through unchanged.
  const frozen = await resolveFrozen(client, params.uid);
  if (frozen) return frozen;

  try {
    // Native `page` or Blux-migrated `catalog_page` — a repo has only one.
    const page = await getPageDoc(client, params.uid);

    // Entity documents for any blux_collection slices on this page — slices
    // never fetch; SliceZone hands these down as context.collections.
    const collections = await loadCollections(
      client,
      collectionTypesOf(page.data.slices as never),
    );

    return { page, collections, ...pageMeta(page) };
  } catch {
    error(404, { message: "Page not found" });
  }
}

export async function entries() {
  if (isPlaceholderRepo) return [];

  // A frozen Blux site's routes ARE its committed frozen artifacts — its Prismic
  // holds only `frozen_page` docs (never native `page`/`catalog_page`), so skip
  // the page-doc probe entirely: it would either error on the absent types or, in
  // a repo that also carries stray `catalog_page` docs, prerender them as junk.
  // ("home" renders at "/" via the root route, so it is excluded here.)
  if (isFrozenSite) {
    return frozenUids()
      .filter((uid) => uid !== "home")
      .map((uid) => ({ uid }));
  }

  const client = createClient();

  // Both native `page` and Blux-migrated `catalog_page` docs, so a migrated
  // multi-page site prerenders every page at its real route.
  const pageEntries = toPrerenderEntries(await getAllPageDocs(client));

  // Frozen Blux pages prerender at their real routes too (home renders at "/",
  // handled by the root route, so it is excluded here). Deduped against page
  // entries, though a repo is only ever one kind.
  const seen = new Set(pageEntries.map((e) => e.uid));
  const frozenEntries = frozenUids()
    .filter((uid) => uid !== "home" && !seen.has(uid))
    .map((uid) => ({ uid }));

  return [...pageEntries, ...frozenEntries];
}
