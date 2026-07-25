// Per-site frozen build artifacts, committed under `./frozen/<uid>.{html,style.css,
// fonts.json}`. The starter TEMPLATE ships this directory EMPTY (only `.gitkeep`),
// so a native `page` / `catalog_page` repo has no artifacts and the production
// frozen route branch never fires — that empty map is the Blux-only scoping gate.
// A frozen site's own repo commits its `<uid>.*` here (produced by the freeze).

export interface FrozenArtifact {
  /** Tokenized freeze template (`<uid>.html`). */
  template: string;
  /** Extracted `<style>` + reveal-force (`<uid>.style.css`). */
  styleCss: string;
  /** Font stylesheet hrefs (`<uid>.fonts.json`) — load-bearing for text metrics. */
  fontLinks: string[];
}

const htmls = import.meta.glob("./frozen/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const styles = import.meta.glob("./frozen/*.style.css", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const fonts = import.meta.glob("./frozen/*.fonts.json", {
  eager: true,
}) as Record<string, { default: string[] }>;

const stem = (path: string, suffix: string): string =>
  path.slice(path.lastIndexOf("/") + 1, -suffix.length);

function collect(): Record<string, FrozenArtifact> {
  const out: Record<string, FrozenArtifact> = {};
  for (const [path, template] of Object.entries(htmls)) {
    const uid = stem(path, ".html");
    out[uid] = {
      template,
      styleCss: styles[`./frozen/${uid}.style.css`] ?? "",
      fontLinks: fonts[`./frozen/${uid}.fonts.json`]?.default ?? [],
    };
  }
  return out;
}

/** uid → committed frozen artifact. `{}` in the starter template (dir is empty). */
export const frozenArtifacts: Record<string, FrozenArtifact> = collect();
