// Render-side contract for the Blux faithful-grid pipeline (reddoor-maintenance
// docs/superpowers/specs/2026-07-08-blux-faithful-grid-slices-design.md).
// The emit stage writes blux-presentation.json: per-band presentation
// (style record, background media, Grid fallback trees, media payloads) keyed
// by band index. Pattern-slice TEXT stays CMS-editable in Prismic; this module
// carries everything Prismic's flat model can't. The starter ships an empty
// manifest; `blux convert` output replaces it per-site.
import manifest from "./blux-presentation.json";

export type RenderMedia = {
  kind: "image" | "video";
  /** Absolute URL (Prismic CDN after emit). */
  url: string;
  alt?: string;
  /** Source display width in px (Blux inline `width`). Rendered capped to 100%
   * so in-flow images match the original instead of stretching full-bleed. */
  width?: number;
  /** Aspect ratio as height/width percentage (Blux `mediaRatio`/`data-og-ratio`). */
  aspect?: number;
  /** Source `background-size` intent. A band background's `auto` = a native-size
   * decorative accent (→ object-fit:none), not a full-bleed `cover`. */
  fit?: "contain" | "cover" | "auto";
  /** A band background's `background-position` (e.g. "right bottom") so a
   * corner-anchored accent isn't centered. */
  position?: string;
  /** The source holder's inline min-height (e.g. "80vh" on slider slides), so
   * a cover-frame carousel reserves the original's height. */
  minHeight?: string;
  /** A feed grid's tile crop ratio ("W:H", e.g. "4:3") — the render frames the
   * image in a fixed-aspect object-cover box so gallery/portfolio tiles are
   * uniformly cropped like the original instead of flowing at natural height. */
  cropRatio?: string;
  /** A `<video>`'s source playback attributes; present-only. Absent = an ambient
   * background loop; `controls` = user-initiated inline playback. */
  playback?: {
    controls?: boolean;
    playsinline?: boolean;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
  };
  /** Per-frame caption (gallery slides carry a title in the source slider). */
  caption?: string;
};

export type GridToken = {
  cols: number | "any";
  ratio?: number;
  /** Grid inter-cell spacing in px (Blux `grid-N-sM`). A gap, not a width. */
  spacing?: number;
};

export type RenderNode =
  | {
      kind: "row";
      cells: RenderCell[];
      /** A "card" background threaded onto this container by the emit stage — a
       * peeled Blux `.blocks0` wrapper's inline background-color (currently the
       * only key). Distinct from a band's `background` (a Media image). */
      style?: Record<string, string>;
      /** This row's cells are the map widget's toggle-switched content panels
       * (the Blux clickMap wiring): cell i shows when toggle i is active, the
       * rest are hidden. Set only on the row that directly follows a widget:map
       * sibling and has exactly one cell per map toggle. */
      panels?: boolean;
    }
  | { kind: "stack"; children: RenderNode[]; style?: Record<string, string> }
  | {
      kind: "heading";
      level: number;
      html: string;
      role?: string;
      /** Inline deviations the export carries on the text leaf (color, padding)
       * plus decoded margin utilities (margin-20r → margin-right:20%). The
       * margin-right percentage is desktop-only in the source (reset ≤800px) —
       * the render scopes it to md+. */
      style?: Record<string, string>;
    }
  | {
      kind: "body";
      html: string;
      role?: string;
      /** Inline deviations the export carries on the text leaf (color, padding)
       * plus decoded margin utilities (margin-20r → margin-right:20%). The
       * margin-right percentage is desktop-only in the source (reset ≤800px) —
       * the render scopes it to md+. */
      style?: Record<string, string>;
    }
  | {
      kind: "subtitle";
      text: string;
      role?: string;
      /** Inline deviations the export carries on the text leaf (color, padding)
       * plus decoded margin utilities (margin-20r → margin-right:20%). The
       * margin-right percentage is desktop-only in the source (reset ≤800px) —
       * the render scopes it to md+. */
      style?: Record<string, string>;
    }
  | { kind: "media"; media: RenderMedia }
  | { kind: "raw"; html: string }
  | { kind: "widget"; widget: { type: "map" } };

export type RenderCell = { token: GridToken; node: RenderNode };

export type MapLayer = {
  name: string;
  lid: string;
  initiallyVisible: boolean;
  preserveViewport: boolean;
};
export type MapToggle = { label: string; layers: string[] };
export type MapRenderConfig = {
  mid: string;
  layers: MapLayer[];
  toggles: MapToggle[];
  styles: unknown[];
  center?: { lat: number; lng: number };
  zoom?: number;
};

export type BandPresentation = {
  /** The band's source index, stamped by `bandFor` (not from the manifest) so
   * the band <section> can carry an `id` for the nav's section anchors. */
  index?: number;
  /** CSS property → value, applied inline on the band <section>. */
  style?: Record<string, string>;
  /** Band-level background media, rendered behind the content box. */
  background?: RenderMedia;
  /** Grid fallback: the band's whole serialized node tree. */
  tree?: RenderNode;
  /** SplitFeature payload (text side may contain nested media — render recursively). */
  split?: {
    mediaSide: "left" | "right";
    ratio: number;
    media: RenderMedia;
    text: RenderNode;
  };
  /** Gallery payload. */
  gallery?: RenderMedia[];
  /** Carousel payload: the band is a source slider (.caslider). Caption TEXT
   * lives in the page doc's items (Prismic-editable); the manifest carries the
   * media and the caption's role metadata. `columns` = slides visible at once
   * (source data-columns). */
  carousel?: {
    slides: {
      media: RenderMedia;
      caption?: { level?: number; role?: string };
      subcaption?: { role?: string };
    }[];
    columns?: number;
  };
  /** MediaFull payload. */
  media?: RenderMedia;
  /** LocationMap payload. */
  map?: MapRenderConfig;
  /** Hero/TitleBand heading textN role + h-level and subtitle role, so the
   * render applies the right display font/tag. The text itself is the Prismic
   * page-doc string; this is presentation metadata only. */
  text?: { headingRole?: string; headingLevel?: number; subtitleRole?: string };
};

export type Presentation = { bands: Record<string, BandPresentation> };

/** A multi-page manifest: per-page band manifests keyed by page uid. Band
 * indices are page-local in a Blux export (page-block-N restarts at 0 on
 * every page), so pages can't share one flat bands map. Single-page sites
 * keep shipping the flat form. */
export type SitePresentation =
  Presentation | { pages: Record<string, Presentation> };

/** One page's slice of a manifest: `uid` selects from a multi-page manifest;
 * a flat single-page manifest ignores it (both existing converted sites and
 * the starter stub are flat). An unknown uid yields an empty presentation —
 * slices then render on their own defaults, same as an unwired context. */
export function selectPresentation(
  m: SitePresentation,
  uid = "home",
): Presentation {
  if ("pages" in m && m.pages) return m.pages[uid] ?? { bands: {} };
  return m as Presentation;
}

/** The checked-in presentation manifest for one page. */
export function loadPresentation(uid = "home"): Presentation {
  return selectPresentation(manifest as SitePresentation, uid);
}

/** The presentation entry for a band index, or null. Tolerates an absent
 * presentation entirely (SliceZone context not wired, simulator, tests). */
export function bandFor(
  presentation: Presentation | undefined,
  band: number | null | undefined,
): BandPresentation | null {
  if (!presentation || band === null || band === undefined) return null;
  const entry = presentation.bands?.[String(band)];
  // Stamp the index so the <section> can expose it as an anchor target.
  return entry ? { ...entry, index: band } : null;
}

/** A cell's CSS width from its grid token; null = let flex distribute. Width
 * comes from an explicit `ratio` or an equal split of the column count;
 * `spacing` is a gap, never a width, so a 1-column `grid-1-s40` stat list
 * stacks full-width instead of collapsing to a spacing-derived phantom width. */
export function cellWidth(token: GridToken): string | null {
  if (typeof token.ratio === "number") return `${token.ratio}%`;
  // Covers "any" plus malformed cols (0, negative) that would yield Infinity%.
  if (typeof token.cols !== "number" || token.cols <= 0) return null;
  return `${Math.round((100 / token.cols) * 10000) / 10000}%`;
}

/** Blux's baseline column gutter between side-by-side grid cells, as a % of the
 * row. A uniform default (matching the SplitFeature slice), independent of a
 * grid's per-band `spacing` token. Kept in sync with the `md:gap-x-[4%]` utility
 * on the row in Grid.svelte — Tailwind needs the literal there, so change both. */
export const GRID_GUTTER = 4;

/** Per-cell `--cell-basis` values for a grid row, with the column gutter
 * reserved out of each basis so the cells still fit one flex line instead of the
 * last one wrapping. A plain `gap-x` on cells whose bases already sum to 100%
 * pushes past the row and wraps (the same failure the SplitFeature fix solved).
 *
 * The reserve is keyed off cells-per-LINE `k`, not cell count: a `cols=4` row of
 * 7 cells lays out 4 per line (25% each), so it must reserve `gutter*(k-1)/k`
 * (3% at k=4), not `gutter/2`. `k` is the greedy count of leading cells whose
 * bases fit within the row. Rows that are one-per-line (100% cells) or
 * auto-width (`cols:"any"`) carry no reservation — there's no adjacent cell to
 * gutter against, or no percentage basis to reserve from. */
export function rowCellBases(
  cells: RenderCell[],
  gutter: number = GRID_GUTTER,
): string[] {
  const widths = cells.map((c) => cellWidth(c.token));
  // Any auto/content-width cell → don't reserve; cells flex around the gap.
  if (widths.some((w) => w === null)) return widths.map((w) => w ?? "auto");
  const pcts = (widths as string[]).map((w) => parseFloat(w));
  // Cells per line: leading cells whose bases sum within the row. The small
  // epsilon admits rounding overshoot from equal splits (thirds 33.3333% × 3 =
  // 99.9999%, sixths 16.6667% × 6 = 100.0002%) without also swallowing a
  // genuine next-line cell.
  let k = 0;
  let sum = 0;
  for (const p of pcts) {
    if (sum + p <= 100.05) {
      sum += p;
      k += 1;
    } else break;
  }
  if (k <= 1) return widths as string[]; // one per line → no horizontal gutter
  // Round the reserve UP so k cells + (k-1) gutters never exceed 100% (a
  // rounded-down reserve leaves the line marginally wide, e.g. cols=6).
  const reserve = Math.ceil(((gutter * (k - 1)) / k) * 10000) / 10000;
  return (widths as string[]).map((w) => `calc(${w} - ${reserve}%)`);
}
