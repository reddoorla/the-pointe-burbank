import { error } from "@sveltejs/kit";

import {
  collectionTypesOf,
  loadCollections,
} from "$lib/blux-catalog/collections-load";
import { getPageDoc, pageMeta } from "$lib/blux-catalog/page-doc";
import { resolveFrozen } from "$lib/blux-frozen/load";
import { createClient, isPlaceholderRepo } from "$lib/prismicio";

export async function load({ fetch, cookies }) {
  const client = createClient({ fetch, cookies });

  // A frozen Blux site (committed template artifact + published frozen_page doc)
  // renders the homepage through <FrozenPage>; every other repo falls through
  // unchanged (no artifact → no query).
  const frozen = await resolveFrozen(client, "home");
  if (frozen) return frozen;

  try {
    // Native `page` or Blux-migrated `catalog_page` — both pin home to "home".
    const page = await getPageDoc(client, "home");

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

// On an unconfigured starter, skip prerendering "/" — the load above would
// 404 on the placeholder repo and fail the build. Real sites still prerender
// the home route normally.
export function entries() {
  return isPlaceholderRepo ? [] : [{}];
}
