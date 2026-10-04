// Server-rendered on every host so hooks.server.ts, not netlify.toml's static
// [[headers]] block, decides this page's framing policy: it is the one route
// the Prismic Type Builder and Page Builder frame from another origin. While it
// was prerendered (the root layout's `prerender = "auto"`), Netlify served it as
// a static file with X-Frame-Options: SAMEORIGIN and its CSP in a <meta> tag,
// which cannot carry frame-ancestors, so the Type Builder could not frame it.
// See $lib/security/cms-framing.ts.
export const prerender = false;
