// Editors author arbitrary heading levels inside Prismic rich-text bodies
// (heading1–6 are all enabled in the slice models). Rendered verbatim, those
// break the page's heading-order — e.g. a page <h1> title followed by an editor
// <h3>, or an editor who skips from <h3> to <h5>. axe/Lighthouse flag both.
//
// We fix the *semantic* level with `aria-level` while leaving the tag (and
// therefore the visual size) untouched — see RichTextBody/RichTextHeading. This
// module computes the mapping: rank-compress the distinct heading levels a body
// actually uses into a gap-free run starting at 2 (one below the page <h1>), so
// the shallowest editor heading becomes level 2, the next distinct level 3, etc.

import type { RichTextField } from "@prismicio/client";

/** Context key carrying the per-body original-level → aria-level lookup. */
export const RT_HEADING_CTX = Symbol("rt-heading-levels");

export type HeadingLevelLookup = (originalLevel: number) => number;

/** Fallback when there's no context: just clamp into the valid sub-outline range. */
export function defaultLevel(originalLevel: number): number {
  return Math.min(Math.max(originalLevel, 2), 6);
}

/**
 * Map each heading level *present in this field* to a compressed aria-level:
 * sort the distinct levels, then assign 2, 3, 4, … in order (capped at 6). A
 * body using {h3, h5} → {3→2, 5→3}; {h2} → {2→2}. Returns an empty map for a
 * field with no headings.
 */
export function buildHeadingLevelMap(
  field: RichTextField | null | undefined,
): Map<number, number> {
  const levels = new Set<number>();
  for (const node of field ?? []) {
    const match = /^heading([1-6])$/.exec(
      (node as { type?: string }).type ?? "",
    );
    if (match) levels.add(Number(match[1]));
  }
  const sorted = [...levels].sort((a, b) => a - b);
  const map = new Map<number, number>();
  sorted.forEach((level, index) => map.set(level, Math.min(2 + index, 6)));
  return map;
}
