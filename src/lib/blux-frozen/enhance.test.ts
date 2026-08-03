import { describe, it, expect } from "vitest";
import {
  rewriteHashlinks,
  decodeCfEmail,
  rewriteCfEmails,
  restoreLinkSpacing,
  addVideoPoster,
  addMainLandmark,
  nameBareLinks,
  nameMenuToggle,
  liftHeadingLevels,
  rewriteNavLabels,
  dropNavLinks,
  addContactNavItem,
  CONTACT_NAV_ITEM,
  enhanceFrozenHtml,
  FROZEN_ENHANCE_CSS,
  VIDEO_POSTER,
  AVAILABILITY_ANCHOR,
  CMS_DIVERGENCES,
  NAV_LINKS_DROPPED,
  NAV_LABEL_OVERRIDES,
  HASHLINK_OVERRIDES,
} from "./enhance";
import { UNDERLINE_DRAW_CSS, NAV_UNDERLINE_RUN_CLASS } from "./underline-draw";
import { RULE_MARK_CSS } from "./rule-mark";
import { substitute, type SlotValue } from "./substitute";
import extra from "./frozen/home.extra-slots.json";
import template from "./frozen/home.html?raw";
import freezeDefaults from "./frozen/home.slots.json";

/**
 * The freeze's own default slot values, i.e. what the page renders with when
 * Prismic returns nothing. Enough to exercise the label-keyed nav steps, which
 * see raw `⟦t:…⟧` tokens and match nothing without it.
 */
const freezeValues = new Map<string, SlotValue>(
  (freezeDefaults.slots as { key: string; kind: string; text?: string }[]).map(
    (s) => [s.key, s.kind === "image" ? {} : { text: s.text }],
  ),
);

describe("CMS_DIVERGENCES", () => {
  // Anchor target -> label slot, read from the REAL committed artifact so the
  // manifest is checked against the markup rather than a hand-copied note. The
  // freeze resolves these targets from the export's own runtime, so they are
  // real ids (`#page-block-1`, `#footer0`) rather than Blux's old `/#N` form.
  const navSlots = new Map(
    [
      ...template.matchAll(
        /<a class="navigation0ullia data-hashlink" href="#([A-Za-z0-9_-]+)">⟦t:([^⟧]+)⟧<\/a>/g,
      ),
    ].map((m) => [m[1], m[2]]),
  );
  const listed = CMS_DIVERGENCES.map((d) => d.slot);

  it("reads four nav label slots out of the artifact", () => {
    expect([...navSlots.entries()]).toEqual([
      ["page-block-1", "h.t1"],
      ["page-block-5", "h.t2"],
      ["page-block-8", "h.t3"],
      ["footer0", "h.t4"],
    ]);
  });

  it("names the true slot behind every dropped nav link", () => {
    for (const target of NAV_LINKS_DROPPED) {
      const slot = navSlots.get(target);
      expect(slot, `no nav item targeting #${target}`).toBeDefined();
      // Editing this slot in Prismic does nothing until the drop is undone,
      // so it has to be listed.
      expect(listed).toContain(slot);
    }
  });

  it("covers the overridden nav label too", () => {
    expect(Object.keys(NAV_LABEL_OVERRIDES)).toHaveLength(1);
    expect(listed).toContain(navSlots.get("footer0"));
  });

  it("covers the Contact item, which has no slot behind it at all", () => {
    // The mirror case: nav text on the page that Prismic cannot reach. It is
    // listed with a null slot, so the "nothing stale" check below skips it —
    // this is what proves it is listed.
    const noSlot = CMS_DIVERGENCES.filter((d) => d.slot === null);
    expect(noSlot).toHaveLength(1);
    expect(noSlot[0].what).toContain(CONTACT_NAV_ITEM.label);
  });

  it("retargets exactly one link, so nothing else is silently redirected", () => {
    for (const from of Object.keys(HASHLINK_OVERRIDES)) {
      const hits = [...template.matchAll(new RegExp(`href="#${from}"`, "g"))];
      expect(hits, `#${from} links in the artifact`).toHaveLength(1);
    }
  });

  it("tells you what to do about each one", () => {
    for (const d of CMS_DIVERGENCES) {
      expect(d.what.length, JSON.stringify(d)).toBeGreaterThan(10);
      expect(d.resolve.length, JSON.stringify(d)).toBeGreaterThan(10);
    }
  });

  it("lists nothing stale — every slot entry really exists somewhere", () => {
    // Two kinds of slot, proved two different ways: a DERIVED slot exists
    // because the artifact carries its token, while a SITE-DECLARED `x.` slot
    // has no token by definition (that is why it is declared) and must instead
    // appear in the extra-slots file the freeze pushes.
    const declared = new Set(
      (extra.slots as { key: string }[]).map((s) => s.key),
    );
    for (const d of CMS_DIVERGENCES) {
      if (!d.slot) continue;
      if (d.slot.startsWith("x.")) {
        expect([...declared], `${d.slot} is not declared`).toContain(d.slot);
      } else {
        expect(template).toContain(`⟦t:${d.slot}⟧`);
      }
    }
  });
});

describe("freeze invariants the render depends on", () => {
  // The export encodes some blank rows as content — a footer list item holding
  // `&nbsp;` purely to occupy a line. Those must stay LITERAL in the template.
  // Tokenizing one makes a Prismic Rich Text field that cannot hold the value:
  // it round-trips to "" and the row collapses to its padding, silently
  // shortening the page. reddoor-maintenance 0.76.0 stopped tokenizing them;
  // this is the site-side guard that a future re-freeze does not undo it.
  it("tokenizes no whitespace-only leaf", () => {
    const blank = (
      freezeDefaults.slots as { key: string; kind: string; text?: string }[]
    ).filter(
      (s) =>
        s.kind === "text" &&
        (s.text ?? "") !== "" &&
        (s.text ?? "").replace(/&nbsp;/g, " ").trim() === "",
    );
    expect(blank).toEqual([]);
  });

  it("keeps the footer spacer as markup instead", () => {
    expect(template).toMatch(/<div class="footer0ullia">\s*&nbsp;\s*<\/div>/);
  });

  // The freeze resolves nav anchors against the export's own runtime. If a
  // re-freeze ever emits the old JS-driven form again, dropNavLinks and
  // rewriteHashlinks would both silently match nothing.
  it("ships resolved anchors, not Blux's JS-driven /#N form", () => {
    expect(template).not.toContain('href="/#');
  });
});

describe("rewriteHashlinks", () => {
  it("retargets the repurposed Contact link at the availability panel", () => {
    const html =
      '<a class="navigation0ullia data-hashlink" href="#footer0">C</a>';
    expect(rewriteHashlinks(html)).toContain('href="#availability"');
  });

  it("leaves every anchor it was not told about alone", () => {
    // Including the three surviving band targets — the freeze already resolved
    // those correctly, so touching them could only make things worse.
    const html =
      '<a href="#page-block-1">a</a><a href="#page-block-5">b</a>' +
      '<a href="#page-block-8">c</a><a href="#site-icon-left">x</a>' +
      '<a href="/">y</a><a href="https://example.com/#footer0">z</a>';
    expect(rewriteHashlinks(html)).toBe(html);
  });

  it("is a no-op with an empty override map", () => {
    const html = '<a href="#footer0">C</a>';
    expect(rewriteHashlinks(html, {})).toBe(html);
  });

  it("rewrites only the fragment, not a same-named path", () => {
    const html = '<a href="/footer0">p</a><a href="#footer0">f</a>';
    expect(rewriteHashlinks(html)).toBe(
      '<a href="/footer0">p</a><a href="#availability">f</a>',
    );
  });
});

describe("decodeCfEmail", () => {
  it("decodes a real payload from the-pointe's footer", () => {
    expect(decodeCfEmail("7e2a111a1a503a11101b073e1d1c0c1b501d1113")).toBe(
      "Todd.Doney@cbre.com",
    );
  });
});

describe("rewriteCfEmails", () => {
  it("turns email-protection hrefs into mailto: and fills placeholder text", () => {
    const html =
      '<a class="footer0ullia" href="/cdn-cgi/l/email-protection#7e2a111a1a503a11101b073e1d1c0c1b501d1113">' +
      '<span class="__cf_email__" data-cfemail="7e2a111a1a503a11101b073e1d1c0c1b501d1113">[email&#160;protected]</span></a>';
    const out = rewriteCfEmails(html);
    expect(out).toContain('href="mailto:Todd.Doney@cbre.com"');
    expect(out).toContain(">Todd.Doney@cbre.com<");
    expect(out).not.toContain("email&#160;protected");
    expect(out).not.toContain("cdn-cgi");
  });
});

describe("restoreLinkSpacing", () => {
  // The exact Amenities run, post-substitution: the freeze tokenized the three
  // text runs separately and dropped the spaces the original site rendered.
  const amenities =
    '<div class="block-body text14">Renew and recover with exclusive access to ' +
    'a state-of-the-art<a href="https://www.tbpfit.com/" class="links">' +
    "FIT Health Club</a>with full-service locker rooms in a spa-like " +
    "atmosphere.<br></div>";

  it("restores the spaces around an inline .links anchor", () => {
    const out = restoreLinkSpacing(amenities);
    expect(out).toContain('state-of-the-art <a href="https://www.tbpfit.com/"');
    expect(out).toContain("FIT Health Club</a> with full-service");
  });

  it("is idempotent — already-spaced markup is untouched", () => {
    const spaced = restoreLinkSpacing(amenities);
    expect(restoreLinkSpacing(spaced)).toBe(spaced);
  });

  it("leaves tag-bounded 'Visit Website' anchors alone", () => {
    const button =
      '<div class="text8 buttons"><a class="ib middle links" ' +
      'href="http://www.thepointeburbank.com/" target="_blank">Visit Website' +
      "</a></div>";
    expect(restoreLinkSpacing(button)).toBe(button);
  });

  it("never splits an anchor from trailing punctuation", () => {
    const punct = 'See <a class="links" href="/x">the terms</a>, then sign.';
    expect(restoreLinkSpacing(punct)).toBe(punct);
  });

  it("ignores anchors that are not .links", () => {
    const other = 'art<a class="buttons2" href="/x">Label</a>with';
    expect(restoreLinkSpacing(other)).toBe(other);
  });
});

describe("rewriteNavLabels", () => {
  const nav = (label: string) =>
    `<a class="navigation0ullia data-hashlink" href="#availability">${label}</a>`;

  it("renames the repurposed nav slot to Availability", () => {
    expect(rewriteNavLabels(nav("Contact Us"))).toContain(">Availability<");
  });

  it("no-ops once the CMS itself is updated, so it never pins the nav", () => {
    const already = nav("Availability");
    expect(rewriteNavLabels(already)).toBe(already);
  });

  it("leaves the other nav items alone", () => {
    for (const label of ["Vision", "Amenities", "Burbank"]) {
      expect(rewriteNavLabels(nav(label))).toBe(nav(label));
    }
  });

  it("only touches nav anchors, not body links with the same text", () => {
    const body = '<a class="links" href="/x">Contact Us</a>';
    expect(rewriteNavLabels(body)).toBe(body);
  });
});

describe("dropNavLinks", () => {
  const li = (id: string, label: string) =>
    '<li class="navigation0ulli">' +
    `<a class="navigation0ullia data-hashlink" href="#${id}">${label}</a></li>`;
  const nav =
    li("page-block-1", "Vision") +
    li("page-block-5", "Amenities") +
    li("page-block-8", "Burbank") +
    li("footer0", "Contact Us");

  it("drops Vision and keeps the three items asked back in", () => {
    const out = dropNavLinks(nav);
    expect(out).toBe(
      li("page-block-5", "Amenities") +
        li("page-block-8", "Burbank") +
        li("footer0", "Contact Us"),
    );
  });

  it("removes the whole list item, not just the anchor", () => {
    expect(dropNavLinks(nav)).not.toContain('navigation0ulli"></li>');
    expect([...dropNavLinks(nav).matchAll(/<li /g)]).toHaveLength(3);
  });

  it("does not touch the logo link, which has no hashlink", () => {
    const logo =
      '<li class="navigation0ulli"><a class="navigation0ullia" href="/">L</a></li>';
    expect(dropNavLinks(logo)).toBe(logo);
  });
});

describe("addContactNavItem", () => {
  const li = (href: string, label: string) =>
    '<li class="navigation0ulli">' +
    `<a class="navigation0ullia data-hashlink" href="${href}">${label}</a></li>`;
  // The nav as the earlier steps leave it: Contact Us already relabelled and
  // retargeted into the Availability item.
  const nav =
    "<ul>" +
    li("#page-block-5", "Amenities") +
    li("#page-block-8", "Burbank") +
    li(`#${AVAILABILITY_ANCHOR}`, "Availability") +
    "</ul>";

  it("appends Contact Us after Availability, inside the same list", () => {
    expect(addContactNavItem(nav)).toBe(
      "<ul>" +
        li("#page-block-5", "Amenities") +
        li("#page-block-8", "Burbank") +
        li(`#${AVAILABILITY_ANCHOR}`, "Availability") +
        li("#footer0", "Contact Us") +
        "</ul>",
    );
  });

  it("points it at the footer contact strip, not the availability panel", () => {
    const out = addContactNavItem(nav);
    expect(out).toContain('href="#footer0">Contact Us<');
    expect([...out.matchAll(/href="#footer0"/g)]).toHaveLength(1);
    // The Availability item is untouched — this adds, it does not retarget.
    expect(out).toContain(`href="#${AVAILABILITY_ANCHOR}">Availability<`);
  });

  it("is a no-op when a Contact link is already present", () => {
    const once = addContactNavItem(nav);
    expect(addContactNavItem(once)).toBe(once);
  });

  it("leaves markup with no Availability item alone", () => {
    const logo =
      '<li class="navigation0ulli"><a class="navigation0ullia" href="/">L</a></li>';
    expect(addContactNavItem(logo)).toBe(logo);
  });
});

describe("addMainLandmark", () => {
  it("promotes the real artifact's page-content wrapper to <main>", () => {
    expect(template).toContain('<div id="page-content"');
    expect(template).not.toContain("<main");
    const out = addMainLandmark(template);
    expect(out).toContain('<main id="page-content"');
    expect([...out.matchAll(/<main\b/g)]).toHaveLength(1);
    expect([...out.matchAll(/<\/main>/g)]).toHaveLength(1);
  });

  it("closes at the wrapper's own end, leaving the footer outside it", () => {
    const out = addMainLandmark(template);
    const close = out.indexOf("</main>");
    expect(close).toBeGreaterThan(out.indexOf("<main"));
    // The footer is a sibling landmark: inside <main> it would stop being
    // contentinfo, which is the bug a naive "wrap everything" fix creates.
    expect(out.indexOf('<footer id="footer0"')).toBeGreaterThan(close);
    // The nav precedes it and must also stay outside.
    expect(out.indexOf('<nav id="navigation0"')).toBeLessThan(
      out.indexOf("<main"),
    );
  });

  it("keeps the id the frozen CSS styles, and adds no extra element", () => {
    const out = addMainLandmark(template);
    expect(out).toContain('<main id="page-content"');
    // Renamed, not wrapped: total element count is unchanged.
    const tags = (s: string) => [...s.matchAll(/<[a-zA-Z][^>]*>/g)].length;
    expect(tags(out)).toBe(tags(template));
  });

  it("balances nested divs rather than closing at the first </div>", () => {
    const html =
      '<div id="page-content"><div><div>deep</div></div></div><footer>f</footer>';
    expect(addMainLandmark(html)).toBe(
      '<main id="page-content"><div><div>deep</div></div></main><footer>f</footer>',
    );
  });

  it("leaves an unbalanced or absent wrapper untouched", () => {
    const missing = "<div>no page content here</div>";
    expect(addMainLandmark(missing)).toBe(missing);
    const unbalanced = '<div id="page-content"><div>never closed</div>';
    expect(addMainLandmark(unbalanced)).toBe(unbalanced);
  });
});

describe("nameBareLinks", () => {
  it("names both nameless links in the real artifact", () => {
    const out = nameBareLinks(template);
    expect(out).toContain(
      '<a class="navigation0ullia" href="/" aria-label="The Pointe — home">',
    );
    expect(out).toContain(
      '<a class="footer0ullia" href="https://www.theburbankportfolio.com/"' +
        ' aria-label="The Burbank Portfolio">',
    );
  });

  it("covers the logo link in both the desktop and mobile navs", () => {
    // The freeze emits it twice; axe only flags the visible one, so a
    // first-match-only fix would leave the other unnamed at mobile widths.
    const before = [
      ...template.matchAll(/<a class="navigation0ullia" href="\/">/g),
    ];
    expect(before.length).toBeGreaterThan(1);
    const out = nameBareLinks(template);
    expect([...out.matchAll(/aria-label="The Pointe — home"/g)]).toHaveLength(
      before.length,
    );
  });

  it("leaves other links alone", () => {
    const html = '<a class="links" href="/x">Real text</a>';
    expect(nameBareLinks(html)).toBe(html);
  });
});

describe("nameMenuToggle", () => {
  it("names the hamburger checkbox in the real artifact", () => {
    expect(template).toContain('id="navigation0-menuicon"');
    expect(nameMenuToggle(template)).toContain('aria-label="Menu"');
  });

  it("does not double-label an input that already has a name", () => {
    const html = '<input id="nav-menuicon" type="checkbox" aria-label="Open">';
    expect(nameMenuToggle(html)).toBe(html);
  });

  it("ignores unrelated inputs", () => {
    const html = '<input id="search" type="text">';
    expect(nameMenuToggle(html)).toBe(html);
  });
});

describe("liftHeadingLevels", () => {
  const levels = (html: string) =>
    [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));

  it("leaves the real artifact's outline with no skipped levels", () => {
    const before = levels(template);
    expect(before).toContain(4); // the export really does skip
    const after = levels(liftHeadingLevels(template));
    let prev = 0;
    for (const l of after) {
      if (prev)
        expect(l, `h${prev} -> h${l} skips a level`).toBeLessThanOrEqual(
          prev + 1,
        );
      prev = l;
    }
    expect(after).not.toContain(4);
    expect(after).not.toContain(5);
  });

  it("keeps the h1 and the section h2s exactly as they were", () => {
    const out = liftHeadingLevels(template);
    const count = (s: string, re: RegExp) => [...s.matchAll(re)].length;
    expect(count(out, /<h1\b/g)).toBe(count(template, /<h1\b/g));
    // The four section headings must survive as h2 — plus the one pre-section
    // heading this lifts up to join them.
    expect(count(out, /<h2\b/g)).toBe(count(template, /<h2\b/g) + 1);
  });

  it("lifts a pre-section heading to h2 and a post-section one to h3", () => {
    const html =
      "<h1>Title</h1><h4>Subtitle</h4><h2>Section</h2><h5>Detail</h5>";
    expect(liftHeadingLevels(html)).toBe(
      "<h1>Title</h1><h2>Subtitle</h2><h2>Section</h2><h3>Detail</h3>",
    );
  });

  it("preserves attributes, which carry all the visual styling", () => {
    const html = '<h5 class="block-title text5" style="padding:1px">x</h5>';
    const out = liftHeadingLevels(html);
    expect(out).toBe(
      '<h2 class="block-title text5" style="padding:1px">x</h2>',
    );
  });

  it("pairs each open tag with its own level's close", () => {
    const html = "<h2>a</h2><h4>b</h4><h2>c</h2><h4>d</h4>";
    expect(liftHeadingLevels(html)).toBe(
      "<h2>a</h2><h3>b</h3><h2>c</h2><h3>d</h3>",
    );
  });
});

describe("addVideoPoster", () => {
  it("gives the frozen <video> the cover still", () => {
    const html =
      '<video src="x.mp4" playsinline="playsinline" controls></video>';
    expect(addVideoPoster(html)).toContain(`<video poster="${VIDEO_POSTER}"`);
  });

  it("does not clobber a poster the markup already has", () => {
    const html = '<video poster="/keep.jpg" src="x.mp4"></video>';
    expect(addVideoPoster(html)).toBe(html);
  });
});

describe("enhanceFrozenHtml + css", () => {
  it("applies both repairs", () => {
    const html =
      '<a class="data-hashlink" href="#footer0">Nav</a>' +
      '<a href="/cdn-cgi/l/email-protection#7e2a111a1a503a11101b073e1d1c0c1b501d1113">mail</a>';
    const out = enhanceFrozenHtml(html);
    expect(out).toContain(`href="#${AVAILABILITY_ANCHOR}"`);
    expect(out).toContain('href="mailto:Todd.Doney@cbre.com"');
  });

  it("also restores link spacing, posters the video, and renames the nav slot", () => {
    const html =
      'state-of-the-art<a class="links" href="/f">FIT Health Club</a>with ' +
      '<video src="x.mp4"></video>' +
      '<a class="navigation0ullia data-hashlink" href="#footer0">Contact Us</a>';
    const out = enhanceFrozenHtml(html);
    expect(out).toContain("state-of-the-art <a");
    expect(out).toContain("FIT Health Club</a> with");
    expect(out).toContain(`poster="${VIDEO_POSTER}"`);
    expect(out).toContain(`href="#${AVAILABILITY_ANCHOR}"`);
    expect(out).toContain(">Availability<");
  });

  it("renders the real artifact's nav as Amenities/Burbank/Availability/Contact", () => {
    // The whole nav pipeline against the committed markup, in order: Vision
    // dropped, the other two restored, the fourth slot relabelled + retargeted,
    // and Contact Us appended. Asserted end-to-end because the steps are
    // order-coupled — addContactNavItem run too early yields two Availability
    // links, which every per-function test above would still pass.
    const out = enhanceFrozenHtml(
      substitute(template, freezeValues),
      freezeValues,
    );
    const nav = out.slice(out.indexOf("<nav"), out.indexOf("</nav>"));
    const items = [
      ...nav.matchAll(
        /<a class="navigation0ullia data-hashlink" href="#([A-Za-z0-9_-]+)">([^<]*)<\/a>/g,
      ),
    ].map((m) => [m[2], m[1]]);
    expect(items).toEqual([
      ["Amenities", "page-block-5"],
      ["Burbank", "page-block-8"],
      ["Availability", AVAILABILITY_ANCHOR],
      ["Contact Us", "footer0"],
    ]);
  });

  it("puts the Contact item in the same list as the others", () => {
    // A regex that appended after the wrong `</li>` could still produce the
    // right item order above while landing it outside the right `<ul>`.
    const out = enhanceFrozenHtml(
      substitute(template, freezeValues),
      freezeValues,
    );
    const right = out.slice(
      out.indexOf('<ul class="ibb navigation0section navigation0right">'),
    );
    const list = right.slice(0, right.indexOf("</ul>"));
    expect([...list.matchAll(/<li /g)]).toHaveLength(4);
    expect(list).toContain('href="#footer0">Contact Us<');
  });

  it("ships the nav underline draw-in, gated and staggered", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(UNDERLINE_DRAW_CSS);
    // Hidden at rest, drawn on the run class, and never on the logo anchors
    // (which are `.navigation0ullia` without `.data-hashlink`).
    expect(UNDERLINE_DRAW_CSS).toContain("transform:scaleX(0)");
    expect(UNDERLINE_DRAW_CSS).toContain(
      `.${NAV_UNDERLINE_RUN_CLASS} .navigation0ullia.data-hashlink::after` +
        "{transform:scaleX(1)",
    );
    expect(UNDERLINE_DRAW_CSS).not.toMatch(/\.navigation0ullia(?!\.data-hash)/);
    // The rule mark's own easing and stagger step, reused rather than reinvented.
    expect(UNDERLINE_DRAW_CSS).toContain("cubic-bezier(.2,.55,.88,.95)");
    expect(RULE_MARK_CSS).toContain("cubic-bezier(.2,.55,.88,.95)");
    expect(UNDERLINE_DRAW_CSS).toContain("transition-delay:0.12s");
    expect(UNDERLINE_DRAW_CSS).toContain("transition-delay:0.36s");
    // Only the stagger is motion-gated; the underline itself must survive
    // reduced motion (app.css clamps its duration so it snaps into place).
    expect(UNDERLINE_DRAW_CSS).toContain(
      "@media (prefers-reduced-motion:no-preference)",
    );
    expect(
      UNDERLINE_DRAW_CSS.slice(
        0,
        UNDERLINE_DRAW_CSS.indexOf("@media (prefers-reduced-motion"),
      ),
    ).toContain("transform:scaleX(1)");
  });

  it("draws body link underlines in on scroll, wrap-safe and id-scoped", () => {
    // Nicole's 51:42 comment is pinned on a BODY link, so `.links` gets the
    // same gesture on the observer the rule marks already use.
    expect(UNDERLINE_DRAW_CSS).toContain(
      "#page-content .links.rd-fx-wait{background-size:0 1px",
    );
    expect(UNDERLINE_DRAW_CSS).toContain(
      "#page-content .links.rd-fx-run{background-size:100% 1px;" +
        "transition:background-size .7s cubic-bezier(.2,.55,.88,.95)}",
    );
    // A gradient, not a pseudo-element: the FIT link is a true inline that
    // wraps, and each fragment needs its own underline.
    expect(UNDERLINE_DRAW_CSS).toContain("box-decoration-break:clone");
    expect(UNDERLINE_DRAW_CSS).toContain(
      "background-image:linear-gradient(currentColor,currentColor)",
    );
    // Replaces app.css's text-decoration rather than doubling it, and must
    // out-specify that unlayered (0,1,0) rule rather than rely on source order.
    expect(UNDERLINE_DRAW_CSS).toContain(
      "#page-content .links{text-decoration:none",
    );
    expect(UNDERLINE_DRAW_CSS).not.toMatch(/(^|})\.links\{/);
  });

  it("keeps the body underline on the row text-decoration drew it", () => {
    // 1.137em + 4px reproduces the measured rows at both font sizes on the
    // page: 29px at 22px type and 24.5px at 18px. Guarded because a nudge here
    // moves every body underline off the row the design review signed off.
    expect(UNDERLINE_DRAW_CSS).toContain(
      "background-position:0 calc(1.137em + 4px)",
    );
    expect(1.137 * 22 + 4).toBeCloseTo(29, 1);
    expect(1.137 * 18 + 4).toBeCloseTo(24.5, 1);
  });

  it("ships the reveal + anchor css", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(".rd-fx-wait");
    expect(FROZEN_ENHANCE_CSS).toContain(".rd-fx-run");
    expect(FROZEN_ENHANCE_CSS).toContain("scroll-margin-top");
    expect(FROZEN_ENHANCE_CSS).toContain("prefers-reduced-motion");
  });

  it("re-centers the map plus/minus glyph relatively (both states)", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      ".map_icon_plusm:before{top:calc(50% - 7px)",
    );
    expect(FROZEN_ENHANCE_CSS).toContain(
      '.map_icon[data-clicked="1"] .map_icon_plusm:before{top:50%;height:0}',
    );
  });

  it("clears the three white hairline rules (inline styles, so !important)", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      "#page-block-6-item-1,#page-block-12-item-1,#page-block-12-item-2" +
        "{border-top-width:0!important}",
    );
  });

  it("applies the Figma type scale (leading only) without touching mobile", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(".text1{line-height:30px}");
    expect(FROZEN_ENHANCE_CSS).toContain(
      ".text11{font-size:50px;line-height:70px}",
    );
    expect(FROZEN_ENHANCE_CSS).toContain(
      ".text12{font-size:80px;line-height:100px}",
    );
    expect(FROZEN_ENHANCE_CSS).toContain("@media all and (max-width:700px)");
  });

  it("tightens the amenities heading block per Figma", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      "#page-block-5-item-0-item-1>.blocks0container{padding:20px 0 5px!important}",
    );
  });

  it("turns Burbank Incentives into a boxed white button", () => {
    expect(FROZEN_ENHANCE_CSS).toContain("#page-block-11 .buttons2");
    expect(FROZEN_ENHANCE_CSS).toContain("border-radius:4px");
    expect(FROZEN_ENHANCE_CSS).toContain("font-size:11px");
  });

  it("suppresses the old link underline the freeze draws as a pseudo-element", () => {
    // `.buttons2:before` is a 1px rule 4px below the box. Clearing `border`
    // and `text-decoration` does not touch it, so it has to go explicitly or a
    // stray hairline is drawn under the button.
    expect(FROZEN_ENHANCE_CSS).toContain(
      "#page-block-11 .buttons2:before{display:none}",
    );
  });

  it("inverts the button on hover and keyboard focus alike", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      "#page-block-11 .buttons2:hover,#page-block-11 .buttons2:focus-visible" +
        "{background:#053a6c;color:#fff}",
    );
  });

  it("keeps every button selector id-scoped, or the artifact outranks it", () => {
    // Base rule is (1,1,0); the freeze ships its own `.buttons2:hover` at
    // (0,2,0). Any bare `.buttons2…` rule here would silently lose.
    const bare = [
      ...FROZEN_ENHANCE_CSS.matchAll(/(^|[},])(\.buttons2[^{]*)\{/g),
    ];
    expect(bare.map((m) => m[2])).toEqual([]);
  });

  it("animates the swap with the artifact's interaction easing, not its reveal easing", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      "transition:background-color .15s ease-in-out,color .15s ease-in-out",
    );
    // cubic-bezier(.2,.55,.88,.95) is the export's entrance easing; it belongs
    // to the reveal/draw-in rules only, never to an interaction state.
    const buttonRule = /#page-block-11 \.buttons2\{[^}]*\}/.exec(
      FROZEN_ENHANCE_CSS,
    )![0];
    expect(buttonRule).not.toContain("cubic-bezier");
  });

  it("leaves the focus ring to the UA rather than removing it", () => {
    // The artifact does `.icon:focus{outline:0}`; this layer must not repeat it.
    expect(FROZEN_ENHANCE_CSS).not.toMatch(/outline\s*:/);
  });

  it("ships the caption and rule-mark styles", () => {
    expect(FROZEN_ENHANCE_CSS).toContain("rd-caption");
    expect(FROZEN_ENHANCE_CSS).toContain(".rd-rule");
  });

  it("gives the availability panel the same anchor offset as the bands", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      '[id^="page-block-"],.rd-avail{scroll-margin-top:100px}',
    );
  });

  it("ships the availability panel styles", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(".rd-avail-table");
  });

  it("halves the 80px seam between the portfolio copy and the video", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      "#page-block-9>.block-holder>.blocks0container{padding-bottom:40px}",
    );
    expect(FROZEN_ENHANCE_CSS).toContain(
      "#page-block-10>.blocks0container{padding-top:40px}",
    );
  });
});
