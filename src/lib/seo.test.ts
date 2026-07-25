import { describe, it, expect } from "vitest";
import {
  jsonLdScript,
  canonicalUrl,
  resolveOgImage,
  organizationJsonLd,
  composeTitle,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from "./seo";

const PRISMIC = "https://images.prismic.io/acme/abc.png?auto=compress";

describe("composeTitle", () => {
  it("appends the site name for brand recall", () => {
    expect(composeTitle("Contact")).toBe("Contact | Reddoor");
  });

  it("returns the bare site name for the home page (no page title)", () => {
    expect(composeTitle(undefined)).toBe("Reddoor");
    expect(composeTitle("")).toBe("Reddoor");
    expect(composeTitle("   ")).toBe("Reddoor");
  });

  it("does not double the brand when the title already contains it", () => {
    expect(composeTitle("Reddoor")).toBe("Reddoor");
    expect(composeTitle("Reddoor Studio — Work")).toBe("Reddoor Studio — Work");
  });
});

describe("jsonLdScript", () => {
  it("wraps data in an ld+json script tag", () => {
    const out = jsonLdScript({ "@type": "Thing", name: "x" });
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('"@type":"Thing"');
    expect(out.endsWith("</script>")).toBe(true);
  });

  it("escapes < so CMS strings cannot break out of the script tag", () => {
    const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script><script>alert");
    expect(out).toContain("\\u003c/script>");
    // The only literal </script> is the real closing tag.
    expect(out.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe("canonicalUrl", () => {
  it("drops the query string and hash", () => {
    expect(
      canonicalUrl(new URL("https://acme.com/about?utm_source=x#top")),
    ).toBe("https://acme.com/about");
  });

  it("strips the /preview route segment", () => {
    expect(canonicalUrl(new URL("https://acme.com/preview/work"))).toBe(
      "https://acme.com/work",
    );
  });

  it("maps a bare /preview to the home page", () => {
    expect(canonicalUrl(new URL("https://acme.com/preview"))).toBe(
      "https://acme.com/",
    );
  });

  it("leaves a normal path untouched", () => {
    expect(canonicalUrl(new URL("https://acme.com/team/jane"))).toBe(
      "https://acme.com/team/jane",
    );
  });

  it("does not strip paths that merely start with the word preview", () => {
    expect(canonicalUrl(new URL("https://acme.com/previews/2024"))).toBe(
      "https://acme.com/previews/2024",
    );
  });

  it("accepts a string url", () => {
    expect(canonicalUrl("https://acme.com/x?y=1")).toBe("https://acme.com/x");
  });
});

describe("resolveOgImage", () => {
  it("returns undefined when there is no image", () => {
    expect(resolveOgImage(undefined, "https://acme.com")).toBeUndefined();
    expect(resolveOgImage("", "https://acme.com")).toBeUndefined();
  });

  it("crops a Prismic image to the card canvas and reports its size", () => {
    const og = resolveOgImage(PRISMIC, "https://acme.com");
    expect(og?.width).toBe(OG_IMAGE_WIDTH);
    expect(og?.height).toBe(OG_IMAGE_HEIGHT);
    const u = new URL(og!.url);
    expect(u.searchParams.get("w")).toBe(String(OG_IMAGE_WIDTH));
    expect(u.searchParams.get("h")).toBe(String(OG_IMAGE_HEIGHT));
    expect(u.searchParams.get("fit")).toBe("crop");
  });

  it("passes an absolute non-Prismic URL through without dimensions", () => {
    const og = resolveOgImage(
      "https://cdn.example.com/card.jpg",
      "https://acme.com",
    );
    expect(og).toEqual({ url: "https://cdn.example.com/card.jpg" });
  });

  it("makes a root-relative static asset absolute against the origin", () => {
    expect(resolveOgImage("/og-default.png", "https://acme.com")).toEqual({
      url: "https://acme.com/og-default.png",
    });
  });

  it("rejects a non-http(s) scheme instead of emitting it as a card", () => {
    expect(
      resolveOgImage("javascript:alert(1)", "https://acme.com"),
    ).toBeUndefined();
    expect(
      resolveOgImage("data:image/png;base64,AAAA", "https://acme.com"),
    ).toBeUndefined();
  });
});

describe("organizationJsonLd", () => {
  it("emits the given type and drops empty fields", () => {
    const ld = organizationJsonLd({
      name: "Acme",
      url: "https://acme.com",
      type: "LocalBusiness",
      telephone: "",
      logo: undefined,
    }) as Record<string, unknown>;
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.name).toBe("Acme");
    expect("telephone" in ld).toBe(false);
    expect("logo" in ld).toBe(false);
  });

  it("defaults to Organization and nests a PostalAddress", () => {
    const ld = organizationJsonLd({
      name: "Acme",
      url: "https://acme.com",
      sameAs: ["https://instagram.com/acme"],
      address: {
        streetAddress: "1 Main",
        addressLocality: "Austin",
        addressRegion: "TX",
        postalCode: "78701",
      },
    }) as Record<string, unknown>;
    expect(ld["@type"]).toBe("Organization");
    expect(ld.sameAs).toEqual(["https://instagram.com/acme"]);
    expect(ld.address).toMatchObject({
      "@type": "PostalAddress",
      addressCountry: "US",
      addressLocality: "Austin",
    });
  });

  it("omits sameAs when the list is empty", () => {
    const ld = organizationJsonLd({
      name: "Acme",
      url: "https://acme.com",
      sameAs: [],
    }) as Record<string, unknown>;
    expect("sameAs" in ld).toBe(false);
  });
});
