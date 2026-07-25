// `src/lib/blux-catalog/` is the NEW ground-up Blux catalog content model
// (spec 2026-07-17). It is distinct from the legacy `src/lib/blux/` band/
// presentation module, which is slated for retirement (spec §9) — edit the
// right one.

/** The fallback tree a BluxBlock slice carries as stringified JSON in its
 * `payload` field. Renders any depth via BluxNode.svelte. Structure/media are
 * preserved; assets are Prismic asset URLs rewritten by Emit (see spec §6). */
export type BluxNode = {
  tag?: string; // container element tag, default "div"
  className?: string;
  // Emitted verbatim into the `style` attribute — keys MUST be kebab-case CSS
  // property names (e.g. "background-color", not "backgroundColor"); camelCase
  // is silently ignored by the browser.
  style?: Record<string, string>;
  html?: string; // leaf raw HTML (rich text / embed), rendered with {@html}
  image?: { url: string; alt?: string; width?: number; height?: number };
  children?: BluxNode[];
};

export function parseBluxPayload(
  payload: string | null | undefined,
): BluxNode | null {
  if (!payload) return null;
  try {
    const node = JSON.parse(payload) as BluxNode;
    return node && typeof node === "object" && !Array.isArray(node)
      ? node
      : null;
  } catch {
    return null;
  }
}

export function styleString(style: Record<string, string> | undefined): string {
  if (!style) return "";
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
