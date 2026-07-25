// Site chrome (navigation + footer) from the Blux convert's site-config.json.
// The starter ships an empty stub, so a fresh (unconverted) site renders the
// logo-only Nav + placeholder Footer exactly as before; `blux convert` replaces
// it with the export's real nav tree, logo, and footer. Mirrors the emit
// contract in reddoor-maintenance src/blux/emit/site-config.ts.
import config from "./site-config.json";

export type NavItem = { label: string; href: string; children?: NavItem[] };
export type FooterSocial = { network: string; href?: string };

// A footer column row: a text line (optionally linked — tel:/mailto:/http(s))
// or an image (a footer logo). Mirrors the catalog chrome emit's
// ChromeFooterItem (reddoor-maintenance src/blux/catalog/chrome.ts) and is the
// shape <Footer columns> renders. Shared so the type flows from site-config
// through the layout into Footer as one source of truth.
export type FooterText = { text: string; href?: string };
export type FooterImage = {
  image: { url: string; maxWidth?: string; alt?: string };
  href?: string;
};
export type FooterItem = FooterText | FooterImage;
export type FooterColumn = { items: FooterItem[] };

export type SiteConfig = {
  nav: {
    logo?: { url: string; maxWidth?: string };
    items: NavItem[];
  };
  footer: {
    socials: FooterSocial[];
    text?: string;
    // Leasing-contact columns from the catalog chrome emit. Absent on the stub
    // and on `blux convert` (socials/text) sites; present on catalog-migrated
    // sites like the-pointe.
    columns?: FooterColumn[];
  };
};

/** The checked-in site config (empty until `blux convert`). */
export function loadSiteConfig(): SiteConfig {
  return config as SiteConfig;
}

/** Resolve the footer columns for a route. A migrated site's per-route page
 *  data wins (the dev fidelity gate injects `footerColumns`), else the
 *  catalog/convert chrome in site-config.json. Returns undefined when neither
 *  supplies columns — a fresh site, where <Footer> renders its placeholder.
 *  Without the site-config fallback, catalog-migrated sites (whose footer rides
 *  site-config.json, not page.data) silently drop their real footer. */
export function footerColumns(
  pageColumns: FooterColumn[] | undefined,
  siteConfig: SiteConfig = loadSiteConfig(),
): FooterColumn[] | undefined {
  return pageColumns ?? siteConfig.footer.columns;
}
