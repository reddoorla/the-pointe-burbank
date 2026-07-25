/** Blux tag-filter DSL, ported verbatim from the maintenance pipeline
 * (reddoor-maintenance `src/blux/grid/feed-grid.ts`) so load-time collection
 * filtering matches the emit-time semantics exactly. */

/** A term matches a tag when they're equal OR differ only by a trailing `s`
 * (singular/plural) — Blux's server-side feed resolver stems this way, so a
 * `projects` filter also selects `project`-tagged media (7 real gallery tiles
 * that an exact match drops). Conservative: only a single trailing `s`, so it
 * never over-selects unrelated tags. */
const termMatchesTag = (term: string, tag: string): boolean =>
  term === tag ||
  (term.endsWith("s") && term.slice(0, -1) === tag) ||
  (tag.endsWith("s") && tag.slice(0, -1) === term);

/** Parse a Blux tag filter expression into a predicate over a tag set. The
 * DSL: `&&` joins AND terms, `||` joins OR groups; a record matches when ANY
 * OR group has ALL its terms present (singular/plural-insensitive, see
 * `termMatchesTag`). Leading/empty terms (`&&metal&&sofa`) are ignored.
 * Case-insensitive. An empty/absent expression matches all. */
export function tagFilter(
  expr: string | undefined,
): (tags: string[]) => boolean {
  const groups = (expr ?? "")
    .split("||")
    .map((g) =>
      g
        .split("&&")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    )
    .filter((g) => g.length > 0);
  if (!groups.length) return () => true;
  return (tags) => {
    const set = tags.map((t) => t.toLowerCase());
    return groups.some((g) =>
      g.every((term) => set.some((tag) => termMatchesTag(term, tag))),
    );
  };
}
