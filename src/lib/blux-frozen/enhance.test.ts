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
  enhanceFrozenHtml,
  FROZEN_ENHANCE_CSS,
  VIDEO_POSTER,
  AVAILABILITY_ANCHOR,
  CMS_DIVERGENCES,
  NAV_LINKS_DROPPED,
  NAV_LABEL_OVERRIDES,
  SPACER_SLOTS,
  restoreSpacerSlots,
} from "./enhance";
import extra from "./frozen/home.extra-slots.json";
import template from "./frozen/home.html?raw";
import freezeDefaults from "./frozen/home.slots.json";

describe("CMS_DIVERGENCES", () => {
  // Slot keys read from the REAL committed artifact, so the manifest is checked
  // against the markup rather than against a hand-copied note.
  const navSlots = new Map(
    [
      ...template.matchAll(
        /<a class="navigation0ullia data-hashlink" href="\/#(\d+)">⟦t:([^⟧]+)⟧<\/a>/g,
      ),
    ].map((m) => [m[1], m[2]]),
  );
  const listed = CMS_DIVERGENCES.map((d) => d.slot);

  it("reads four nav label slots out of the artifact", () => {
    expect([...navSlots.entries()]).toEqual([
      ["1", "h.t1"],
      ["5", "h.t2"],
      ["8", "h.t3"],
      ["11", "h.t4"],
    ]);
  });

  it("names the true slot behind every dropped nav link", () => {
    for (const hash of NAV_LINKS_DROPPED) {
      const slot = navSlots.get(hash);
      expect(slot, `no nav item for /#${hash}`).toBeDefined();
      // Editing this slot in Prismic does nothing until the drop is undone,
      // so it has to be listed.
      expect(listed).toContain(slot);
    }
  });

  it("covers the overridden nav label too", () => {
    expect(Object.keys(NAV_LABEL_OVERRIDES)).toHaveLength(1);
    expect(listed).toContain(navSlots.get("11"));
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

describe("SPACER_SLOTS", () => {
  // The freeze's own default values, so the list is derived from the artifact
  // rather than hand-copied. A whitespace-only default means the export used
  // that leaf as layout — a row that exists only to hold a blank line — and
  // Prismic Rich Text cannot store it, so it comes back "" and the row
  // collapses. Any re-freeze that introduces another one fails here.
  const blank = (
    freezeDefaults.slots as { key: string; kind: string; text?: string }[]
  )
    .filter(
      (s) =>
        s.kind === "text" &&
        (s.text ?? "") !== "" &&
        (s.text ?? "").replace(/&nbsp;/g, " ").trim() === "",
    )
    .map((s) => s.key);

  it("names exactly the whitespace-only slots the freeze captured", () => {
    expect(blank).toEqual([...SPACER_SLOTS]);
  });

  it("carries a token in the artifact, so refilling it lands somewhere", () => {
    for (const key of SPACER_SLOTS) expect(template).toContain(`⟦t:${key}⟧`);
  });

  it("refills a slot Prismic blanked", () => {
    const out = restoreSpacerSlots(new Map([["h.t11", { text: "" }]]));
    expect(out.get("h.t11")).toEqual({ text: "\u00A0" });
  });

  it("refills a slot that is missing altogether", () => {
    expect(restoreSpacerSlots(new Map()).get("h.t11")).toEqual({
      text: "\u00A0",
    });
  });

  it("leaves a real edit alone, so Prismic can win", () => {
    const values = new Map([["h.t11", { text: "Suite 700" }]]);
    const out = restoreSpacerSlots(values);
    expect(out.get("h.t11")).toEqual({ text: "Suite 700" });
    // Nothing to repair → the very same map, not a copy.
    expect(out).toBe(values);
  });

  it("never mutates the map it was handed", () => {
    const values = new Map<string, { text?: string }>([
      ["h.t11", { text: "" }],
    ]);
    restoreSpacerSlots(values);
    expect(values.get("h.t11")).toEqual({ text: "" });
  });

  it("keeps the freeze's own defaults untouched (the offline gate path)", () => {
    // /dev/blux-frozen feeds the freeze defaults straight in, where the value is
    // still " &nbsp;" — non-empty, so the repair must no-op and both render
    // paths converge on the same 32px row.
    const values = new Map(
      (freezeDefaults.slots as { key: string; text?: string }[]).map((s) => [
        s.key,
        { text: s.text },
      ]),
    );
    expect(restoreSpacerSlots(values)).toBe(values);
  });
});

describe("rewriteHashlinks", () => {
  it("maps Blux digit hashlinks to their page-block ids", () => {
    const html =
      '<a class="navigation0ullia data-hashlink" href="/#1">A</a>' +
      '<a class="navigation0ullia data-hashlink" href="/#5">B</a>';
    const out = rewriteHashlinks(html);
    expect(out).toContain('href="#page-block-1"');
    expect(out).toContain('href="#page-block-5"');
    expect(out).not.toContain('href="/#');
  });

  it("points the repurposed #11 slot at the availability panel", () => {
    const html = '<a class="navigation0ullia data-hashlink" href="/#11">C</a>';
    expect(rewriteHashlinks(html)).toContain('href="#availability"');
  });

  it("leaves named anchors, plain roots, and external urls alone", () => {
    const html =
      '<a href="#site-icon-left">x</a><a href="/">y</a>' +
      '<a href="https://example.com/#5">z</a><a href="/#about">w</a>';
    expect(rewriteHashlinks(html)).toBe(html);
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
  const li = (n: string, label: string) =>
    '<li class="navigation0ulli">' +
    `<a class="navigation0ullia data-hashlink" href="/#${n}">${label}</a></li>`;
  const nav =
    li("1", "Vision") +
    li("5", "Amenities") +
    li("8", "Burbank") +
    li("11", "Contact Us");

  it("leaves only the Availability item", () => {
    const out = dropNavLinks(nav);
    expect(out).toBe(li("11", "Contact Us"));
  });

  it("removes the whole list item, not just the anchor", () => {
    expect(dropNavLinks(nav)).not.toContain('navigation0ulli"></li>');
    expect([...dropNavLinks(nav).matchAll(/<li /g)]).toHaveLength(1);
  });

  it("does not touch the logo link, which has no hashlink", () => {
    const logo =
      '<li class="navigation0ulli"><a class="navigation0ullia" href="/">L</a></li>';
    expect(dropNavLinks(logo)).toBe(logo);
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
      '<a class="data-hashlink" href="/#5">Nav</a>' +
      '<a href="/cdn-cgi/l/email-protection#7e2a111a1a503a11101b073e1d1c0c1b501d1113">mail</a>';
    const out = enhanceFrozenHtml(html);
    expect(out).toContain('href="#page-block-5"');
    expect(out).toContain('href="mailto:Todd.Doney@cbre.com"');
  });

  it("also restores link spacing, posters the video, and renames the nav slot", () => {
    const html =
      'state-of-the-art<a class="links" href="/f">FIT Health Club</a>with ' +
      '<video src="x.mp4"></video>' +
      '<a class="navigation0ullia data-hashlink" href="/#11">Contact Us</a>';
    const out = enhanceFrozenHtml(html);
    expect(out).toContain("state-of-the-art <a");
    expect(out).toContain("FIT Health Club</a> with");
    expect(out).toContain(`poster="${VIDEO_POSTER}"`);
    expect(out).toContain(`href="#${AVAILABILITY_ANCHOR}"`);
    expect(out).toContain(">Availability<");
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
