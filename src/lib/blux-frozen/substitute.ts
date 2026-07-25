// Frozen-page render: substitute the freeze template's slot tokens with current
// content values. The freeze (reddoor-maintenance `blux freeze`) tokenizes every
// editable leaf — text runs as `⟦t:KEY⟧`, image urls as `⟦i:KEY⟧` (inside a CSS
// `url(...)` for backgrounds, or bare in a `src`/`href`). This is the inverse.
// The token grammar is single-sourced there; kept in lockstep by the gate tests.

export interface SlotValue {
  /** For text slots — already HTML-safe (see FrozenPage). */
  text?: string;
  /** For image slots — a resolved url (Prismic-hosted in production). */
  url?: string;
}

const TEXT_RE = /⟦t:([^⟧]+)⟧/g;
const IMG_URL_RE = /url\(⟦i:([^⟧]+)⟧\)/g;
const IMG_BARE_RE = /⟦i:([^⟧]+)⟧/g;
/** Any residual token — a render bug if one survives substitution. */
export const ANY_TOKEN_RE = /⟦[ti]:[^⟧]+⟧/;

/**
 * Replace every slot token in `template` with its value from `values`. A missing
 * key resolves to empty (never leaves a raw token). CSS `url(...)` image tokens
 * are quoted so query-string commas (`?auto=format,compress`) stay valid.
 */
export function substitute(
  template: string,
  values: Map<string, SlotValue>,
): string {
  return template
    .replace(TEXT_RE, (_, key: string) => values.get(key)?.text ?? "")
    .replace(
      IMG_URL_RE,
      (_, key: string) => `url('${values.get(key)?.url ?? ""}')`,
    )
    .replace(IMG_BARE_RE, (_, key: string) => values.get(key)?.url ?? "");
}

/**
 * Wrap the freeze's extracted CSS in a `<style>` element for injection via
 * `{@html}` in `<svelte:head>`. This lives in a `.ts` module on purpose: a
 * literal `<style>`/`</style>` token in `.svelte` source makes Svelte's parser
 * try to extract it as the component's own style block, which breaks
 * `svelte-check` (`element_unclosed: <script> was left open`). Building the tag
 * in TS keeps that token out of the component source.
 */
export function styleTag(css: string): string {
  return `<style>${css}</style>`;
}
