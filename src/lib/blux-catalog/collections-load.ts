/** Load-path collections fetch for the blux_collection query-spec slice:
 * the page load resolves each collection type the slice zone queries via
 * `getAllByType` and hands the documents to every slice through SliceZone
 * `context.collections` (slices never fetch). */

/** The collection types a page's slice zone queries: unique, ordered. */
export function collectionTypesOf(
  slices: {
    slice_type: string;
    primary?: { collection_type?: string | null };
  }[],
): string[] {
  const types: string[] = [];
  for (const slice of slices) {
    if (slice.slice_type !== "blux_collection") continue;
    const type = slice.primary?.collection_type;
    if (type && !types.includes(type)) types.push(type);
  }
  return types;
}

/** Fetch each type via client.getAllByType, tolerating unknown types (a site
 * whose Prismic repo lacks an entity type gets an empty list, not a 500). */
export async function loadCollections(
  client: { getAllByType(type: string): Promise<unknown[]> },
  types: string[],
): Promise<Record<string, unknown[]>> {
  const entries = await Promise.all(
    types.map(async (type): Promise<[string, unknown[]]> => {
      try {
        return [type, await client.getAllByType(type)];
      } catch {
        return [type, []];
      }
    }),
  );
  return Object.fromEntries(entries);
}
