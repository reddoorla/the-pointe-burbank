import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import Seo from "./Seo.svelte";

afterEach(() => cleanup());

const head = document.head;
const attr = (sel: string, name = "content") =>
  head.querySelector(sel)?.getAttribute(name) ?? null;

const base = {
  title: "About us",
  url: new URL("https://acme.com/about?utm_source=nl"),
};

describe("Seo head output", () => {
  it("renders the title and a query-stripped canonical", () => {
    render(Seo, base);
    expect(head.querySelector("title")?.textContent).toBe("About us");
    expect(attr('link[rel="canonical"]', "href")).toBe(
      "https://acme.com/about",
    );
    expect(attr('meta[property="og:url"]')).toBe("https://acme.com/about");
  });

  it("mirrors the title into og:title and twitter:title", () => {
    render(Seo, base);
    expect(attr('meta[property="og:title"]')).toBe("About us");
    expect(attr('meta[name="twitter:title"]')).toBe("About us");
  });

  it("emits og tags with property= (not name=) so scrapers read them", () => {
    render(Seo, base);
    // The bug the fleet repeats: og:* under name= is ignored by OG parsers.
    expect(head.querySelector('meta[name="og:title"]')).toBeNull();
    expect(
      head.querySelector('meta[property="og:type"]')?.getAttribute("content"),
    ).toBe("website");
    expect(attr('meta[property="og:site_name"]')).toBe("Reddoor");
    expect(attr('meta[property="og:locale"]')).toBe("en_US");
  });

  it("omits description tags when there is no description", () => {
    render(Seo, base);
    expect(head.querySelector('meta[name="description"]')).toBeNull();
    expect(head.querySelector('meta[property="og:description"]')).toBeNull();
  });

  it("renders description across the three surfaces when present", () => {
    render(Seo, { ...base, description: "We build things." });
    expect(attr('meta[name="description"]')).toBe("We build things.");
    expect(attr('meta[property="og:description"]')).toBe("We build things.");
    expect(attr('meta[name="twitter:description"]')).toBe("We build things.");
  });

  it("crops a Prismic og:image and advertises its dimensions + alt", () => {
    render(Seo, {
      ...base,
      image: "https://images.prismic.io/acme/x.png?auto=compress",
      imageAlt: "The team",
    });
    const img = attr('meta[property="og:image"]');
    expect(img).toContain("w=1200");
    expect(img).toContain("h=630");
    expect(attr('meta[property="og:image:width"]')).toBe("1200");
    expect(attr('meta[property="og:image:height"]')).toBe("630");
    expect(attr('meta[property="og:image:alt"]')).toBe("The team");
    expect(attr('meta[name="twitter:card"]')).toBe("summary_large_image");
  });

  it("falls back to the title for image alt", () => {
    render(Seo, {
      ...base,
      image: "https://images.prismic.io/acme/x.png",
    });
    expect(attr('meta[property="og:image:alt"]')).toBe("About us");
  });

  it("uses summary card and no image tags when there is no image", () => {
    render(Seo, base);
    expect(attr('meta[name="twitter:card"]')).toBe("summary");
    expect(head.querySelector('meta[property="og:image"]')).toBeNull();
  });

  it("omits width/height for an absolute non-Prismic image", () => {
    render(Seo, { ...base, image: "https://cdn.example.com/card.jpg" });
    expect(attr('meta[property="og:image"]')).toBe(
      "https://cdn.example.com/card.jpg",
    );
    expect(head.querySelector('meta[property="og:image:width"]')).toBeNull();
  });

  it("adds robots noindex only when asked", () => {
    render(Seo, base);
    expect(head.querySelector('meta[name="robots"]')).toBeNull();
    cleanup();
    render(Seo, { ...base, noindex: true });
    expect(attr('meta[name="robots"]')).toBe("noindex");
  });

  it("renders JSON-LD scripts, one per node", () => {
    render(Seo, {
      ...base,
      jsonLd: [
        { "@type": "Organization", name: "Acme" },
        { "@type": "WebSite", name: "Acme" },
      ],
    });
    const scripts = head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(2);
    expect(scripts[0].textContent).toContain('"Organization"');
    expect(scripts[1].textContent).toContain('"WebSite"');
  });

  it("accepts a single JSON-LD object", () => {
    render(Seo, {
      ...base,
      jsonLd: { "@type": "LocalBusiness", name: "Acme" },
    });
    expect(
      head.querySelectorAll('script[type="application/ld+json"]'),
    ).toHaveLength(1);
  });

  it("strips the /preview segment from the canonical", () => {
    render(Seo, { ...base, url: new URL("https://acme.com/preview/about") });
    expect(attr('link[rel="canonical"]', "href")).toBe(
      "https://acme.com/about",
    );
  });

  it("accepts a string url", () => {
    render(Seo, { ...base, url: "https://acme.com/x?y=1" });
    expect(attr('link[rel="canonical"]', "href")).toBe("https://acme.com/x");
  });
});
