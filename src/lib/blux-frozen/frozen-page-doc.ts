import type { FrozenDocSlot } from "./from-doc";

// A migrated Blux page lives in Prismic as a `frozen_page` document — the same
// duck-typed resolution `page-doc.ts` uses for `catalog_page`: the type is never
// in this template's generated types (the migration adds it to the target repo),
// so it is queried through a minimal read client, and a repo that lacks the type
// simply misses.
export const FROZEN_PAGE_TYPE = "frozen_page";

/** The `frozen_page` document shape the render path consumes. Slots + SEO meta
 * come from Prismic; fontLinks do NOT (they are a committed build artifact). */
export interface FrozenPageDoc {
  uid: string;
  data: {
    title?: string;
    slots: FrozenDocSlot[];
    meta_title?: string;
    meta_description?: string;
    meta_image?: { url?: string | null; alt?: string | null } | null;
  };
}

/** Minimal read surface. Method syntax is load-bearing: it keeps the real,
 * narrowly-typed Prismic client assignable via method-parameter bivariance
 * (same trick as `page-doc.ts`). */
type FrozenReadClient = {
  getByUID(type: string, uid: string): Promise<unknown>;
};

/**
 * Resolve a `frozen_page` doc by uid, or `null` on any miss — including a repo
 * that has no `frozen_page` type at all (querying it just misses). Never throws.
 */
export async function getFrozenPageDoc(
  client: FrozenReadClient,
  uid: string,
): Promise<FrozenPageDoc | null> {
  try {
    return (await client.getByUID(FROZEN_PAGE_TYPE, uid)) as FrozenPageDoc;
  } catch {
    return null;
  }
}
