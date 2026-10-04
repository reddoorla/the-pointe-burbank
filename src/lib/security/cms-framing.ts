/**
 * Routes the CMS loads in an iframe from another origin. The Prismic Type
 * Builder and Page Builder (https://*.prismic.io) frame /slice-simulator to
 * render slice previews, and a local simulator URL (http://localhost:*) does
 * the same while developing. Every other response is SAMEORIGIN with
 * `frame-ancestors 'self'`, which made each preview read "Error". X-Frame-Options
 * has no multi-origin form, so these routes carry none and name their framers
 * in the CSP instead. The page renders nothing but the slices it is handed, so
 * there is nothing on it to clickjack. Ported from reddoor-website, where it has
 * been live since 2026-08-19 (src/lib/security/headers.ts there).
 */
export const CMS_FRAMED_ROUTES: ReadonlySet<string> = new Set(["/slice-simulator"]);

export const CMS_FRAME_ANCESTORS =
  "frame-ancestors 'self' http://localhost:* https://*.prismic.io https://prismic.io";

export function isCmsFramedRoute(pathname: string): boolean {
  return CMS_FRAMED_ROUTES.has(pathname.replace(/\/+$/, "") || "/");
}

/** Replace the policy's frame-ancestors directive, adding it if absent. */
export function widenFrameAncestors(policy: string): string {
  const directives = policy
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => !/^frame-ancestors(\s|$)/i.test(d));
  return [...directives, CMS_FRAME_ANCESTORS].join("; ");
}
