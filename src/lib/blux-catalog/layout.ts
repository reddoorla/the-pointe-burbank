/** Blux's fixed inter-column gutter, in percent. Ported verbatim from the band
 * prototype (reddoorla/the-pointe presentation.ts GRID_GUTTER). Kept in sync
 * with the `md:gap-x-[4%]` literal the grid row applies. */
export const GRID_GUTTER = 4;

/** A cell's width before the gutter reserve: an explicit width (a Blux
 * `grid-2-r70` ratio, already a "%") wins; otherwise an equal split of `columns`.
 * Mirrors presentation.ts `cellWidth`: `${ratio}%` else `100/cols %`, rounded to
 * 4 decimals. */
export function cellWidth(width: string | undefined, columns: number): string {
  if (width) return width;
  const cols = columns > 0 ? columns : 1;
  return `${Math.round((100 / cols) * 10000) / 10000}%`;
}

/** One cell's `flex-basis` for a row of `k` columns, reserving the shared 4%
 * gutter out of the basis so `k` cells still fit one line — mirrors
 * presentation.ts `rowCellBases` but per-cell (the catalog's flat cells[] wraps
 * by the band `columns`; a subgrid passes its own cell count as `k`). A
 * single-column row reserves nothing. `width` is an explicit share (e.g. a
 * `grid-2-r70` ratio → `"70%"`); absent → equal split of `k`. */
export function gridCellBasis(width: string | undefined, k: number): string {
  const base = cellWidth(width, k);
  if (k <= 1) return base;
  const reserve = Math.ceil(((GRID_GUTTER * (k - 1)) / k) * 10000) / 10000;
  return `calc(${base} - ${reserve}%)`;
}
