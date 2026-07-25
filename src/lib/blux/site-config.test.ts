import { describe, it, expect } from "vitest";
import { loadSiteConfig, footerColumns, type SiteConfig } from "./site-config";

describe("loadSiteConfig", () => {
  it("returns a well-formed config from the checked-in stub", () => {
    const config = loadSiteConfig();
    // The starter ships an empty stub; the shape must always be safe to spread
    // into <Nav items> / <Footer socials> without guards at the call site.
    expect(Array.isArray(config.nav.items)).toBe(true);
    expect(Array.isArray(config.footer.socials)).toBe(true);
  });
});

describe("footerColumns", () => {
  const chromeCols = [
    { items: [{ text: "Leasing: (555) 123-4567", href: "tel:5551234567" }] },
  ];
  const configWithColumns: SiteConfig = {
    nav: { items: [] },
    footer: { socials: [], columns: chromeCols },
  };

  it("prefers the per-route page-data columns (the dev fidelity gate injects them)", () => {
    const pageCols = [{ items: [{ text: "from page data" }] }];
    expect(footerColumns(pageCols, configWithColumns)).toBe(pageCols);
  });

  it("falls back to the site-config chrome columns when page data has none", () => {
    // The regression this guards: a migrated site's leasing-contact footer
    // rides site-config.json (the catalog chrome emit), NOT page.data — so a
    // layout that reads only page.data.footerColumns drops the real footer.
    expect(footerColumns(undefined, configWithColumns)).toBe(chromeCols);
  });

  it("returns undefined when neither supplies columns (fresh site → Footer placeholder)", () => {
    expect(footerColumns(undefined, loadSiteConfig())).toBeUndefined();
  });
});
