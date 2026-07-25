/**
 * Cloudflare Turnstile explicit-render helper.
 *
 * We render the widget explicitly via `turnstile.render()` from the component
 * lifecycle rather than dropping the auto-render `<script>` in `<svelte:head>`.
 * The auto-render scan only runs on api.js's FIRST load; on a SvelteKit
 * client-side (SPA) navigation into the form, api.js is already loaded so the
 * scan never re-fires — the widget silently fails to render and the form submits
 * with no `cf-turnstile-response` token. (Verified in a real browser 2026-07-02:
 * SPA nav left the `.cf-turnstile` div empty and logged "Turnstile already has
 * been loaded".) Explicit render fires on every mount, SPA nav included.
 *
 * Verification is central (the dashboard holds `TURNSTILE_SECRET_KEY`); a site
 * needs only the public sitekey, and `loadTurnstile` rejecting (offline / blocked
 * / CSP) is safe — central ingest is fail-open, so a missing token degrades to
 * the honeypot + timing + heuristic screen rather than dropping the lead.
 */

/** The slice of Cloudflare's global `turnstile` API we use. */
export type TurnstileApi = {
  // `render` can return undefined (e.g. the container already has a widget, or an
  // internal failure) — hence the `!== undefined` guard before `remove` at the call site.
  render: (
    el: HTMLElement,
    opts: { sitekey: string; callback?: (token: string) => void },
  ) => string | undefined;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// `render=explicit` disables auto-rendering — we call `turnstile.render()` ourselves.
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loader: Promise<TurnstileApi> | undefined;

/**
 * Load Cloudflare's api.js exactly once (idempotent across component mounts and
 * SPA navigations) and resolve the global `turnstile` API. Subsequent calls reuse
 * the same promise, or resolve immediately once `window.turnstile` exists.
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("turnstile: no window (server context)"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;

  loader = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else
        reject(
          new Error("turnstile: api.js loaded but window.turnstile is missing"),
        );
    };
    script.onerror = () => {
      loader = undefined; // allow a later mount to retry
      script.remove(); // don't accumulate dead <script> tags in <head> on repeated failures
      reject(new Error("turnstile: api.js failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}
