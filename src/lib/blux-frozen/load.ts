import { frozenSlotsFromDoc, type FrozenRenderSlot } from "./from-doc";
import { getFrozenPageDoc, type FrozenPageDoc } from "./frozen-page-doc";
import { frozenArtifacts, type FrozenArtifact } from "./artifacts";

// Production frozen-page resolution for the shared `[[preview]]` routes. A repo is
// a frozen Blux site iff it has BOTH a committed per-uid template artifact AND a
// published `frozen_page` doc. The committed artifact is checked FIRST (a cheap,
// build-time gate), so a non-frozen repo pays no extra Prismic query and falls
// straight through to the normal `getPageDoc` → `SliceZone` path.

export interface FrozenPageData {
  frozen: true;
  template: string;
  styleCss: string;
  fontLinks: string[];
  slots: FrozenRenderSlot[];
  // SEO/head keys mirror `pageMeta()` (snake_case) — the root +layout.svelte
  // <Seo> reads `page.data.meta_title|meta_description|meta_image|meta_image_alt`,
  // so both load paths must agree on this shape or a frozen page's meta is dropped.
  title: string;
  meta_title?: string | undefined;
  meta_description?: string | undefined;
  meta_image?: string | undefined;
  meta_image_alt?: string | undefined;
}

/** Compose a committed artifact + a Prismic `frozen_page` doc into the render
 * shape `<FrozenPage>` wants. Slots are decoded via the shared mapper; SEO meta
 * comes from the doc (same keys as `pageMeta`); fontLinks come from the artifact. */
export function buildFrozenData(
  art: FrozenArtifact,
  doc: FrozenPageDoc,
): FrozenPageData {
  return {
    frozen: true,
    template: art.template,
    styleCss: art.styleCss,
    fontLinks: art.fontLinks,
    slots: frozenSlotsFromDoc(doc.data.slots),
    title: doc.data.title ?? "",
    meta_title: doc.data.meta_title || undefined,
    meta_description: doc.data.meta_description || undefined,
    meta_image: doc.data.meta_image?.url || undefined,
    meta_image_alt: doc.data.meta_image?.alt || undefined,
  };
}

type FrozenReadClient = Parameters<typeof getFrozenPageDoc>[0];

/**
 * Frozen render data for `uid`, or `null` to fall through to the normal path.
 * `artifacts` is injectable for testing; it defaults to the glob-built map.
 */
export async function resolveFrozen(
  client: FrozenReadClient,
  uid: string,
  artifacts: Record<string, FrozenArtifact> = frozenArtifacts,
): Promise<FrozenPageData | null> {
  // Own-key check (not a bracket read): a plain object inherits Object.prototype
  // members, so `artifacts["toString"|"constructor"|"__proto__"|…]` would be a
  // truthy INHERITED value and wrongly trigger a Prismic query on a non-frozen
  // repo. `Object.hasOwn` keeps the "no artifact → no query" invariant exact.
  if (!Object.hasOwn(artifacts, uid)) return null; // not a frozen site → fall through
  const art = artifacts[uid]!;
  const doc = await getFrozenPageDoc(client, uid);
  return doc ? buildFrozenData(art, doc) : null;
}

/** Uids with a committed frozen artifact — the prerender entry list. */
export function frozenUids(
  artifacts: Record<string, FrozenArtifact> = frozenArtifacts,
): string[] {
  return Object.keys(artifacts);
}
