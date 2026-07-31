import { describe, it, expect } from "vitest";

import {
  renderAvailability,
  replaceAvailabilityImage,
  assertAvailabilityData,
  availabilityFromSlots,
  availabilitySlots,
  AVAILABILITY_CSS,
  type AvailabilityData,
} from "./availability";
import { POSTER_SLOT, VIDEO_POSTER } from "./enhance";
import data from "./frozen/home.availability.json";
import extra from "./frozen/home.extra-slots.json";
import template from "./frozen/home.html?raw";

const site = data as AvailabilityData;

describe("renderAvailability", () => {
  const html = renderAvailability(site);

  it("renders every suite and its area as real text", () => {
    for (const suite of site.suites) {
      expect(html).toContain(suite.name);
      expect(html).toContain(suite.area);
    }
    expect(html).toContain(site.total);
  });

  it("stacks one row per suite, in the Figma order", () => {
    const names = [...html.matchAll(/rd-avail-suite">([^<]+)</g)].map(
      (m) => m[1],
    );
    expect(names).toEqual(site.suites.map((s) => s.name));
  });

  it("carries the nav anchor id", () => {
    expect(html).toContain(`id="${site.anchorId}"`);
  });

  it("labels rows for screen readers rather than relying on layout", () => {
    expect(html).toContain('<th scope="row"');
    expect(html).toContain("<caption");
  });

  it("puts the rule mark between the total and the available list", () => {
    const rule = html.indexOf("rd-avail-rule-row");
    expect(rule).toBeGreaterThan(html.indexOf(site.total));
    // Positional, not text-matched: the visually-hidden caption also mentions
    // availability, so searching for the label would find that first.
    expect(rule).toBeLessThan(html.indexOf("rd-avail-head"));
    expect(rule).toBeLessThan(html.indexOf("rd-avail-suite"));
    expect(html.slice(rule)).toContain("rd-rule");
  });

  it("escapes content rather than injecting it raw", () => {
    const out = renderAvailability({
      ...site,
      total: "<script>alert(1)</script>",
    });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("replaceAvailabilityImage", () => {
  it("swaps the flattened image out of the real committed artifact", () => {
    expect(template).toContain(site.mediaId);
    const out = replaceAvailabilityImage(template, site);
    expect(out).not.toContain(`data-media="${site.mediaId}"`);
    expect(out).toContain('class="rd-avail"');
    expect(out).toContain(site.total);
  });

  it("leaves markup untouched when the artwork is absent", () => {
    const html = "<div>no panel here</div>";
    expect(replaceAvailabilityImage(html, site)).toBe(html);
  });
});

describe("assertAvailabilityData", () => {
  it("accepts the committed sidecar", () => {
    expect(assertAvailabilityData(data)).toBe(data);
  });

  // The file is hand-edited for leasing updates, so every way an edit can go
  // wrong has to fail loudly at build rather than render a blank row.
  const bad: [string, unknown, RegExp][] = [
    ["a missing label", { ...site, totalLabel: undefined }, /totalLabel/],
    ["an empty value", { ...site, total: "  " }, /total /],
    ["a mistyped value", { ...site, total: 480000 }, /total /],
    ["no suites at all", { ...site, suites: [] }, /suites/],
    ["suites as an object", { ...site, suites: {} }, /suites/],
    [
      "a suite missing its area",
      { ...site, suites: [{ name: "Suite 300" }] },
      /suites\[0\]\.area/,
    ],
    [
      "a suite naming the wrong key",
      { ...site, suites: [{ name: "Suite 300", sf: "18,000 SF" }] },
      /suites\[0\]\.area/,
    ],
    ["a non-object", "nope", /root/],
    ["null", null, /root/],
  ];

  for (const [label, value, match] of bad) {
    it(`rejects ${label}`, () => {
      expect(() => assertAvailabilityData(value)).toThrow(match);
    });
  }

  it("names the source file so the error points at what to fix", () => {
    expect(() =>
      assertAvailabilityData({}, "frozen/home.availability.json"),
    ).toThrow(/^frozen\/home\.availability\.json: mediaId/);
  });
});

describe("availabilitySlots", () => {
  const slots = availabilitySlots(site);

  it("declares one slot per editable value, all under the reserved prefix", () => {
    expect(slots).toHaveLength(4 + site.suites.length * 2);
    for (const s of slots) expect(s.key.startsWith("x.")).toBe(true);
  });

  it("seeds each slot with the committed value", () => {
    const byKey = new Map(slots.map((s) => [s.key, s.text]));
    expect(byKey.get("x.avail.total")).toBe(site.total);
    expect(byKey.get("x.avail.suite1.name")).toBe(site.suites[0]!.name);
    expect(byKey.get("x.avail.suite5.area")).toBe(site.suites[4]!.area);
  });

  it("uses unique keys, so no value can shadow another", () => {
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length);
  });
});

describe("home.extra-slots.json", () => {
  // The declaration is what `blux freeze --extra-slots` pushes to Prismic, and
  // the render reads those same keys back. Drift between the two would show up
  // as a panel that silently ignores the CMS, so pin them to each other.
  const declared = extra.slots as {
    key: string;
    kind: string;
    text?: string;
  }[];

  it("declares exactly the availability slots the render reads, plus the poster", () => {
    const avail = declared.filter((s) => s.key.startsWith("x.avail."));
    expect(avail.map((s) => ({ key: s.key, text: s.text }))).toEqual(
      availabilitySlots(site),
    );
    expect(declared.filter((s) => s.key === POSTER_SLOT)).toHaveLength(1);
    expect(declared).toHaveLength(avail.length + 1);
  });

  it("keeps every key under the freeze's reserved prefix", () => {
    for (const s of declared) expect(s.key.startsWith("x.")).toBe(true);
  });

  it("declares the poster as an image slot with a fetchable url", () => {
    const poster = declared.find((s) => s.key === POSTER_SLOT) as {
      kind: string;
      url?: string;
    };
    expect(poster.kind).toBe("image");
    // The migration fetches the bytes itself before uploading, so this has to
    // resolve at migration time — not merely look like a url.
    expect(poster.url).toMatch(/^https?:\/\//);
    expect(poster.url).toContain(VIDEO_POSTER.replace(/^\//, ""));
  });
});

describe("availabilityFromSlots", () => {
  const lookup = (m: Record<string, string>) => ({
    get: (k: string) => (k in m ? { text: m[k] } : undefined),
  });

  it("returns the committed data untouched when there are no slots", () => {
    expect(availabilityFromSlots(site)).toBe(site);
  });

  it("falls back per-key, so a partly-migrated CMS still renders", () => {
    const out = availabilityFromSlots(
      site,
      lookup({ "x.avail.total": "500,000 SF" }),
    );
    expect(out.total).toBe("500,000 SF");
    expect(out.totalLabel).toBe(site.totalLabel); // absent → committed
    expect(out.suites).toEqual(site.suites);
  });

  it("lets Prismic win over the committed value", () => {
    const out = availabilityFromSlots(
      site,
      lookup({
        "x.avail.suite1.name": "Suite 310",
        "x.avail.suite1.area": "19,000 SF",
      }),
    );
    expect(out.suites[0]).toEqual({ name: "Suite 310", area: "19,000 SF" });
  });

  it("drops a suite whose fields are both blanked — the 'leased' gesture", () => {
    const out = availabilityFromSlots(
      site,
      lookup({ "x.avail.suite2.name": "", "x.avail.suite2.area": "  " }),
    );
    expect(out.suites).toHaveLength(site.suites.length - 1);
    expect(out.suites.map((s) => s.name)).not.toContain(site.suites[1]!.name);
  });

  it("keeps a suite when only one field is blank, rather than losing the row", () => {
    const out = availabilityFromSlots(
      site,
      lookup({ "x.avail.suite2.area": "" }),
    );
    expect(out.suites).toHaveLength(site.suites.length);
    expect(out.suites[1]).toEqual({ name: site.suites[1]!.name, area: "" });
  });

  it("still renders as real markup after the overlay", () => {
    const out = renderAvailability(
      availabilityFromSlots(site, lookup({ "x.avail.total": "512,000 SF" })),
    );
    expect(out).toContain("512,000 SF");
    expect(out).not.toContain(site.total);
  });
});

describe("AVAILABILITY_CSS", () => {
  it("uses the Figma type spec, mapped onto the project's sans", () => {
    expect(AVAILABILITY_CSS).toContain("font-size:13px");
    expect(AVAILABILITY_CSS).toContain("color:#053a6c");
    expect(AVAILABILITY_CSS).toContain("font-family:Montserrat,sans-serif");
    // Gotham is specified in Figma but not licensed or loaded on this site.
    expect(AVAILABILITY_CSS).not.toContain("Gotham");
  });

  it("sets the 80px columns and 15px gutter from Figma", () => {
    expect(AVAILABILITY_CSS).toContain("width:80px");
    expect(AVAILABILITY_CSS).toContain("padding-left:15px");
    // Value cell is border-box: 15px gutter + 80px column, so the block is
    // 80 + 95 = 175px wide and the value's right edge lands where Figma puts
    // it. `min-width` here would let the column set its own width instead.
    expect(AVAILABILITY_CSS).toContain("width:95px");
    expect(AVAILABILITY_CSS).not.toContain("min-width");
  });

  it("tracks the uppercase rows only, per Figma", () => {
    // Figma puts tracking-[0.39px] on Total and the heading; the Light rows
    // carry none. 0.39px == .03em at 13px.
    expect(AVAILABILITY_CSS).toContain("letter-spacing:.03em");
    expect(
      [...AVAILABILITY_CSS.matchAll(/letter-spacing/g)],
      "only the .rd-avail-term rule should set tracking",
    ).toHaveLength(1);
  });
});
