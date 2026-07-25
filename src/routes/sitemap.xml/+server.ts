import { createClient, isFrozenSite, isPlaceholderRepo } from "$lib/prismicio";
import { frozenUids } from "$lib/blux-frozen/load";
import type { RequestHandler } from "./$types";

export const prerender = true;

export const GET: RequestHandler = async ({ fetch, url }) => {
  const origin = url.origin;

  // Sitemap entries as { path, lastmod }. A frozen Blux site's pages ARE its
  // committed frozen artifacts (home renders at "/"), never native `page` docs —
  // list those so the sitemap robots.txt advertises isn't silently empty. Build
  // time stands in for a frozen page's lastmod (it is rebaked whenever its
  // content republishes).
  const entries: { path: string; lastmod: string }[] = isFrozenSite
    ? frozenUids().map((uid) => ({
        path: uid === "home" ? "/" : `/${uid}`,
        lastmod: new Date().toISOString(),
      }))
    : isPlaceholderRepo
      ? []
      : (await createClient({ fetch }).getAllByType("page")).map((page) => ({
          path: page.uid === "home" ? "/" : `/${page.uid}`,
          lastmod: new Date(
            page.last_publication_date ?? Date.now(),
          ).toISOString(),
        }));

  const urls = entries.map(
    ({ path, lastmod }) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
};
