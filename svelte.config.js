import { readFileSync, readdirSync } from "node:fs";
import adapter from "@sveltejs/adapter-netlify";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const slicemachine = JSON.parse(
  readFileSync(new URL("./slicemachine.config.json", import.meta.url), "utf-8"),
);
const isPlaceholderRepo =
  (process.env.VITE_PRISMIC_ENVIRONMENT || slicemachine.repositoryName) ===
  "your-prismic-repo-name";

// A frozen Blux site commits page artifacts under src/lib/blux-frozen/frozen.
// Its prerendered pages keep dead Blux link artifacts — JS-driven `#n` slider
// anchors whose targets never existed statically — so tolerate missing fragment
// ids during the crawl rather than failing the build (a native site still fails
// loudly on a genuine broken in-page anchor).
let isFrozenSite = false;
try {
  isFrozenSite = readdirSync(
    new URL("./src/lib/blux-frozen/frozen", import.meta.url),
  ).some((f) => f.endsWith(".html"));
} catch {
  // no frozen artifact dir → not a frozen site
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    warningFilter: (warning) =>
      warning.code !== "element_invalid_self_closing_tag",
  },
  kit: {
    adapter: adapter(),
    // Until a clone is wired to a real Prismic repo, every Prismic-backed
    // route returns 404 during prerender. Tolerate that on the placeholder
    // so `pnpm build` (and Netlify CI) succeed; real sites still fail loudly
    // because `repositoryName` no longer matches the sentinel.
    prerender: {
      // Prerendered endpoints (robots.txt, sitemap.xml) bake `url.origin` into
      // their output at build time; without this it would be SvelteKit's
      // "http://sveltekit-prerender" placeholder. Netlify sets URL to the
      // site's production origin during builds. Local builds keep the
      // placeholder, which only shows up in build/ output, never in dev.
      ...(process.env.URL ? { origin: process.env.URL } : {}),
      handleHttpError: ({ path, status, message, referrer }) => {
        if (isPlaceholderRepo && status === 404) {
          return;
        }
        // Cloudflare infrastructure paths are never prerenderable routes. Frozen
        // Blux HTML keeps a dead `/cdn-cgi/l/email-protection` link (Cloudflare's
        // email-obfuscation, only resolvable behind Cloudflare) — a 404 on it
        // during the crawl is expected, not a build failure.
        if (status === 404 && path.startsWith("/cdn-cgi/")) {
          return;
        }
        throw new Error(
          `${status} ${path}${referrer ? ` (linked from ${referrer})` : ""}: ${message}`,
        );
      },
      handleMissingId: isFrozenSite ? "warn" : "fail",
    },
    alias: {
      $components: "src/lib/components",
      "$components/*": "src/lib/components/*",
      $utils: "src/lib/utils",
      "$utils/*": "src/lib/utils/*",
      $stores: "src/lib/stores",
      "$stores/*": "src/lib/stores/*",
      $assets: "src/lib/assets",
      "$assets/*": "src/lib/assets/*",
    },
    // Baseline CSP for Prismic + Vimeo. Extend per project — any new CDN or
    // analytics host must be added to the relevant directive. SvelteKit
    // automatically adds nonces/hashes for inline scripts and styles it emits.
    csp: {
      mode: "auto",
      // Violations POST to /api/csp-report. To stage a stricter policy without
      // blocking, copy `directives` below into a sibling `reportOnly: { ... }`
      // block — SvelteKit will then emit a Content-Security-Policy-Report-Only
      // header alongside the enforced one.
      directives: {
        "default-src": ["self"],
        "script-src": [
          "self",
          "https://static.cdn.prismic.io",
          "https://player.vimeo.com",
          // Cloudflare Turnstile contact-form widget (enable via PUBLIC_TURNSTILE_SITE_KEY).
          "https://challenges.cloudflare.com",
          // Google Maps JS API — frozen-page map hydration (VITE_GOOGLE_MAPS_KEY).
          // Hosts + blob: per Google's documented Maps-JS CSP requirements.
          "blob:",
          "https://*.googleapis.com",
          "https://*.gstatic.com",
          "https://*.google.com",
          "https://*.ggpht.com",
          "https://*.googleusercontent.com",
        ],
        // Modern Maps JS spawns blob: workers; without this directive the
        // worker-src→script-src→default-src fallback lands on 'self' and
        // blocks them.
        "worker-src": ["self", "blob:"],
        // Google Fonts stylesheet host — frozen Blux sites load their type from
        // fonts.googleapis.com (paired with fonts.gstatic.com under font-src).
        "style-src": ["self", "unsafe-inline", "https://fonts.googleapis.com"],
        "img-src": [
          "self",
          "data:",
          "https://images.prismic.io",
          "https://*.prismic.io",
          // Google Maps tiles, markers, and My-Maps KML pin sprites (pins are
          // served from mt.google.com / maps.google.com, not maps.gstatic).
          "https://*.googleapis.com",
          "https://*.gstatic.com",
          "https://*.google.com",
          "https://*.ggpht.com",
          "https://*.googleusercontent.com",
        ],
        // Prismic hosts non-image media (e.g. migrated .mp4 assets) on
        // <repo>.cdn.prismic.io — first-party content, same origin family as
        // images.prismic.io already allowed under img-src.
        "media-src": ["self", "https://*.vimeocdn.com", "https://*.prismic.io"],
        "frame-src": [
          "self",
          "https://player.vimeo.com",
          // Cloudflare Turnstile renders its challenge in an iframe from this host.
          "https://challenges.cloudflare.com",
          // Google Maps JS may frame google.com surfaces (per its CSP doc).
          "https://*.google.com",
        ],
        "connect-src": [
          "self",
          "https://*.prismic.io",
          "https://static.cdn.prismic.io",
          // Google Maps JS API telemetry, tile and KML fetches.
          "https://*.googleapis.com",
          "https://*.google.com",
          "https://*.gstatic.com",
          "data:",
          "blob:",
        ],
        "font-src": ["self", "data:", "https://fonts.gstatic.com"],
        "base-uri": ["self"],
        "form-action": ["self"],
        "frame-ancestors": ["self"],
        "report-uri": ["/api/csp-report"],
      },
    },
  },
  preprocess: vitePreprocess(),
};

export default config;
