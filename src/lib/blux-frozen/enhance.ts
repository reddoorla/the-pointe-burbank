import rawAvailability from "./frozen/home.availability.json";
import {
  replaceAvailabilityImage,
  assertAvailabilityData,
  availabilityFromSlots,
  AVAILABILITY_CSS,
  type SlotLookup,
} from "./availability";
import { replaceRuleMarks, RULE_MARK_CSS } from "./rule-mark";
import { UNDERLINE_DRAW_CSS } from "./underline-draw";
import { DISTINGUISHED_CSS } from "./distinguished";
import {
  restyleCarouselCaptions,
  CAROUSEL_CAPTION_CSS,
} from "./carousel-caption";

// Render-time enhancements for frozen Blux markup. The freeze strips Blux's
// runtime JS, which leaves two kinds of dead links in the settled DOM; both are
// deterministically repairable from the markup itself, so we fix them at render
// (the committed artifact stays byte-faithful to the freeze output). The design
// review's markup changes ride the same path.

// Validated at module load, so a bad hand-edit fails the build rather than
// shipping a panel with a blank row.
const availabilityData = assertAvailabilityData(
  rawAvailability,
  "frozen/home.availability.json",
);

/** Nav deep-link target for the suite availability panel. */
export const AVAILABILITY_ANCHOR = availabilityData.anchorId;

/**
 * Retarget a nav anchor the design review repointed.
 *
 * Blux nav anchors used to be JS-driven — `href="/#N"`, meaningless without the
 * runtime — and this function resolved them to real ids. The freeze does that
 * itself now (it watches the export's own runtime during settle and bakes the
 * measured target), so the template arrives with working anchors and all that
 * is left here is the review's own change of destination.
 *
 * Keyed from-id → to-id. Anything not listed is left alone, so a re-freeze that
 * resolves an anchor differently shows up as a nav that goes somewhere
 * unexpected rather than as markup this function silently rewrote.
 */
export function rewriteHashlinks(
  html: string,
  overrides: Record<string, string> = HASHLINK_OVERRIDES,
): string {
  return html.replace(/href="#([A-Za-z0-9_-]+)"/g, (whole, id: string) =>
    overrides[id] ? `href="#${overrides[id]}"` : whole,
  );
}

/**
 * Site-verified hashlink targets. The original's Contact Us nav item scrolled to
 * the bottom contact strip — the freeze measures that and bakes `#footer0`. The
 * design review (2026-07-30) repurposed that nav slot as "Availability", so it
 * now targets the suite availability panel instead — see `AVAILABILITY_ANCHOR` /
 * `rewriteNavLabels`.
 *
 * The artifact carries exactly one `#footer0` link — the nav item — so this
 * retargets that and nothing else. `enhance.test.ts` asserts the count against
 * the real artifact rather than trusting this note, since a re-freeze could
 * introduce a second one (the footer's own Contact link, say) that would then
 * be silently redirected too.
 */
export const HASHLINK_OVERRIDES: Record<string, string> = {
  footer0: "availability",
};

/**
 * Slot key for the video cover. Carries the freeze's reserved `x.` prefix: it
 * is a site-declared slot, not one derived from a template token — the export
 * ships no `poster` attribute, so there is nothing to tokenize.
 */
export const POSTER_SLOT = "x.poster";

export interface CmsDivergence {
  /** `frozen_page` slot key, or null where no slot exists yet. */
  slot: string | null;
  what: string;
  /** What to do in Prismic, and what to delete here afterwards. */
  resolve: string;
}

/**
 * Every place the rendered page deliberately ignores or overrides the
 * `frozen_page` Prismic doc, after the 2026-07-30 design review.
 *
 * This exists because the divergences are otherwise invisible from the CMS
 * side: all four nav slots are still live, editable fields in Prismic, yet one
 * renders nothing at all and one renders text the doc does not contain. Without
 * this list, an editor who renames "Vision" sees no change on the site and has
 * no way to find out why. The trailing entry is the mirror case — nav text on
 * the page that has no field behind it anywhere in Prismic.
 *
 * Slot keys verified against the committed artifact's nav markup.
 * `enhance.test.ts` holds it in lockstep with the code below, so an entry
 * cannot rot as the overrides change.
 */
export const CMS_DIVERGENCES: CmsDivergence[] = [
  {
    slot: "h.t1",
    what: 'Nav "Vision" (#page-block-1) — dropped, renders nothing',
    resolve:
      "remove 'page-block-1' from NAV_LINKS_DROPPED to bring the item back",
  },
  {
    slot: "h.t4",
    what: 'Nav label — doc still reads "Contact Us", page shows "Availability"',
    resolve:
      'set h.t4 to "Availability" in Prismic, then delete NAV_LABEL_OVERRIDES ' +
      "(the override is keyed on the current text, so it no-ops on its own first)",
  },
  {
    slot: null,
    what:
      'Nav "Contact Us" (#footer0) — a fifth item the freeze has no slot for, ' +
      "so its label is hardcoded and NOT editable in Prismic",
    resolve:
      "edit CONTACT_NAV_ITEM here; to make it CMS-editable the export itself " +
      "needs a fifth nav entry, which a re-freeze would then tokenize",
  },
];

/**
 * Nav labels the design review changed. Keyed on the CURRENT text, so once the
 * `frozen_page` doc is edited in Prismic the override stops matching and
 * quietly no-ops rather than pinning the nav against the CMS forever. See
 * `CMS_DIVERGENCES` for the full picture.
 */
export const NAV_LABEL_OVERRIDES: Record<string, string> = {
  "Contact Us": "Availability",
};

export function rewriteNavLabels(
  html: string,
  overrides: Record<string, string> = NAV_LABEL_OVERRIDES,
): string {
  return html.replace(
    /(<a\b[^>]*\bclass="[^"]*\bnavigation0ullia\b[^"]*"[^>]*>)([^<]*)(<\/a>)/g,
    (whole, open: string, label: string, close: string) => {
      const next = overrides[label.trim()];
      return next ? `${open}${next}${close}` : whole;
    },
  );
}

/**
 * Anchor targets of the nav items that render nothing. Keyed on the target
 * rather than the label because the labels are CMS content, and a label can be
 * renamed in Prismic without this silently ceasing to match.
 *
 * The 2026-07-30 design review dropped Vision, Amenities and Burbank, leaving
 * Availability alone. Amenities (#page-block-5) and Burbank (#page-block-8) were
 * asked back in on 2026-08-03; Vision was not, so it is the one that stays here.
 *
 * These are the ids the freeze resolved from the export's own runtime. They were
 * Blux hash indexes (`/#1`, `/#5`, `/#8`) until the freeze started baking real
 * anchors; the ids happen to correspond, but this keys on what is actually in
 * the markup. `enhance.test.ts` asserts every entry exists in the artifact, so a
 * re-freeze that resolves them differently fails rather than quietly restoring
 * a nav item nobody wanted back.
 */
export const NAV_LINKS_DROPPED = ["page-block-1"];

export function dropNavLinks(
  html: string,
  targets: string[] = NAV_LINKS_DROPPED,
): string {
  let out = html;
  for (const id of targets) {
    out = out.replace(
      new RegExp(
        `<li class="navigation0ulli">\\s*` +
          `<a class="navigation0ullia data-hashlink" href="#${id}">` +
          `[^<]*</a>\\s*</li>`,
        "g",
      ),
      "",
    );
  }
  return out;
}

/**
 * The nav's fifth item, added 2026-08-03.
 *
 * The export ships four nav entries and the freeze tokenized all four, so there
 * is no spare slot to put this in: the original "Contact Us" entry is the one
 * the review repurposed as "Availability", and the site wants BOTH now. So this
 * item is composed here rather than driven by Prismic — which is a real CMS
 * divergence, listed as such in `CMS_DIVERGENCES`.
 *
 * `#footer0` is the contact strip at the page bottom — the target the original
 * Contact Us item carried before `HASHLINK_OVERRIDES` sent it to the
 * availability panel instead.
 */
export const CONTACT_NAV_ITEM = { label: "Contact Us", href: "#footer0" };

/**
 * Append the Contact Us item after the Availability one.
 *
 * ORDER-COUPLED, both ways, which is why it is not just a string concat at
 * template level. It must run AFTER `rewriteHashlinks` (which rewrites every
 * `#footer0` to the availability anchor — including, otherwise, this item's own
 * href) and AFTER `rewriteNavLabels` (which rewrites the text "Contact Us" to
 * "Availability"). Run either way round and the nav grows a second Availability
 * link rather than a Contact one. `steps()` places it accordingly, and
 * `enhance.test.ts` asserts the end-to-end result rather than trusting this
 * note.
 *
 * Anchored on the Availability item so the new one lands last in the list and
 * inside the right `<ul>` — the nav has three of them (left/center/right), and
 * the two logo items live in their own. Unmatched markup is left alone; the
 * `#footer0` guard makes a second application a no-op should a re-freeze ever
 * ship a Contact entry of its own.
 */
export function addContactNavItem(
  html: string,
  item: { label: string; href: string } = CONTACT_NAV_ITEM,
): string {
  if (html.includes(`href="${item.href}"`)) return html;
  const availability = new RegExp(
    `<li class="navigation0ulli">\\s*` +
      `<a class="navigation0ullia data-hashlink" href="#${AVAILABILITY_ANCHOR}">` +
      `[^<]*</a>\\s*</li>`,
  );
  const m = availability.exec(html);
  if (!m) return html;
  const at = m.index + m[0].length;
  return (
    html.slice(0, at) +
    `<li class="navigation0ulli">` +
    `<a class="navigation0ullia data-hashlink" href="${item.href}">` +
    `${item.label}</a></li>` +
    html.slice(at)
  );
}

/**
 * Decode one Cloudflare email-protection payload: first hex byte is the XOR
 * key, the rest are the address's chars.
 */
export function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

/**
 * The original site sat behind Cloudflare, whose email obfuscation rewrote
 * mailto links to `/cdn-cgi/l/email-protection#<hex>` hrefs and `[email
 * protected]` placeholder spans carrying `data-cfemail="<hex>"`. The decoding
 * script is gone with the CDN, so restore both from the baked payloads:
 * hrefs become real `mailto:`, placeholder text becomes the address.
 */
export function rewriteCfEmails(html: string): string {
  return html
    .replace(
      /href="\/cdn-cgi\/l\/email-protection#([0-9a-fA-F]+)"/g,
      (_, hex: string) => `href="mailto:${decodeCfEmail(hex)}"`,
    )
    .replace(
      /(<[^>]*data-cfemail="([0-9a-fA-F]+)"[^>]*>)[^<]*(<)/g,
      (_, open: string, hex: string, close: string) =>
        `${open}${decodeCfEmail(hex)}${close}`,
    );
}

/**
 * The freeze tokenizes each editable text run separately, which drops the
 * whitespace that separated an inline `<a class="links">` from the prose around
 * it: the original renders `state-of-the-art <a>FIT Health Club</a> with …`,
 * the frozen template `⟦t:s4.t0⟧<a>⟦t:s4.t1⟧</a>⟦t:s4.t2⟧` — so the words run
 * together once substituted. Restore a single space wherever an alphanumeric
 * abuts a `.links` anchor's boundary. Deliberately alphanumeric-only on both
 * sides: standalone "Visit Website" anchors are bounded by tags (`>`/`<`) and
 * trailing punctuation must stay hugged, so neither is touched.
 */
const LINKS_OPEN = String.raw`<a\b[^>]*\bclass="[^"]*\blinks\b[^"]*"[^>]*>`;

export function restoreLinkSpacing(html: string): string {
  return html
    .replace(new RegExp(`([A-Za-z0-9])(${LINKS_OPEN})`, "g"), "$1 $2")
    .replace(
      new RegExp(`(${LINKS_OPEN}[\\s\\S]*?</a>)(?=[A-Za-z0-9])`, "g"),
      "$1 ",
    );
}

/**
 * The freeze's `<video>` carries no `poster`, so the player renders as a black
 * box until playback starts. Give it the client-supplied cover still (Worthe
 * aerial, committed under `static/`). Applied to the frozen `<video>` markup so
 * the committed artifact stays byte-faithful. The video's own src IS a slot
 * (`s8.i2`) but no poster slot exists — see `CMS_DIVERGENCES`.
 */
export const VIDEO_POSTER = "/worthe-aerial-labelled.jpg";

export function addVideoPoster(
  html: string,
  poster: string = VIDEO_POSTER,
): string {
  return html.replace(
    /<video\b(?![^>]*\bposter=)/g,
    `<video poster="${poster}"`,
  );
}

/**
 * Promote the export's `#page-content` wrapper to a `<main>` landmark.
 *
 * Blux emits `<div id="site-icon-set">` (a display:none sprite), `<nav>`,
 * `<div id="page-content">` and `<footer>` — every region but the main one. A
 * frozen page renders bare (the root layout deliberately skips the app chrome,
 * including its own `<main id="main-content">`), so nothing else supplies the
 * landmark and every element in the body sits outside one. That is one axe
 * `region` violation per top-level node, and for a screen-reader user it means
 * no "skip to main content" target and no main region to jump to.
 *
 * `#page-content` is exactly the right element: it already spans everything
 * between the nav and the footer, so this renames the tag rather than adding a
 * wrapper — no extra box, no layout change, and the id (which the frozen CSS
 * styles) is preserved.
 *
 * The close tag is found by depth-counting from the open, not by assuming the
 * `</div><footer` adjacency the current artifact happens to have; an unbalanced
 * document leaves the html untouched rather than mis-nesting it.
 */
export function addMainLandmark(html: string, id = "page-content"): string {
  const open = `<div id="${id}"`;
  const at = html.indexOf(open);
  if (at === -1) return html;
  const openEnd = html.indexOf(">", at);
  if (openEnd === -1) return html;

  const re = /<(\/?)div\b[^>]*?(\/?)>/gi;
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[2] === "/") continue; // self-closing: opens nothing
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) {
      return (
        html.slice(0, at) +
        "<main" +
        html.slice(at + "<div".length, openEnd + 1) +
        html.slice(openEnd + 1, m.index) +
        "</main>" +
        html.slice(m.index + m[0].length)
      );
    }
  }
  return html; // never closed — leave the document alone
}

/**
 * Accessible names for the two links whose only content is a background-image
 * div. The freeze has no `<img>` to carry alt text — Blux paints logos as CSS
 * backgrounds — so the anchor itself has to be named or a screen reader
 * announces bare "link". Matched on the literal open tag: the nav logo appears
 * twice (desktop + mobile), and both need it.
 */
export const LINK_LABELS: { match: string; label: string }[] = [
  {
    match: '<a class="navigation0ullia" href="/">',
    label: "The Pointe — home",
  },
  {
    match:
      '<a class="footer0ullia" href="https://www.theburbankportfolio.com/">',
    label: "The Burbank Portfolio",
  },
];

export function nameBareLinks(
  html: string,
  labels: { match: string; label: string }[] = LINK_LABELS,
): string {
  let out = html;
  for (const { match, label } of labels) {
    if (!out.includes(match)) continue;
    out = out.split(match).join(match.slice(0, -1) + ` aria-label="${label}">`);
  }
  return out;
}

/**
 * Name the mobile menu toggle. It is a bare checkbox driving a pure-CSS
 * disclosure, so it has no label of any kind and announces as an unnamed
 * checkbox. Left alone if the freeze ever starts emitting one.
 */
export function nameMenuToggle(html: string, label = "Menu"): string {
  return html.replace(
    /<input\b([^>]*\bid="[^"]*-menuicon"[^>]*)>/g,
    (whole, attrs: string) =>
      /\baria-label=/.test(attrs)
        ? whole
        : `<input${attrs} aria-label="${label}">`,
  );
}

/**
 * Repair the export's heading outline.
 *
 * Blux picks heading tags for their baked type styles, not for structure, so
 * the page runs h1 → h4, h2 → h5 and h2 → h4 — four skipped levels, which
 * leaves a screen-reader's heading list implying sections that do not exist.
 *
 * No mechanical re-ranking can fix this, because the source uses h4 in two
 * different roles — once directly under the h1 (the hero's second line) and
 * again under an h2. So the rule is positional: h1 and h2 stay as they are,
 * and every other heading becomes h2 if it appears BEFORE the first section
 * heading, h3 once sections have started. The one pre-section heading is the
 * hero's own subtitle, which is genuinely section-level.
 *
 * That yields 1,2,2,3…,2,3…,2,3…,2 — no skips, and siblings keep the same
 * level as each other, which a "clamp to previous+1" pass would have broken by
 * ratcheting consecutive siblings up through 3,4,5.
 *
 * Purely semantic: verified that neither the frozen stylesheet nor app.css
 * carries a bare h1–h6 selector, so every heading is styled by its class
 * (`text11`, `text5`) and nothing moves on screen.
 *
 * Runs AFTER `restyleCarouselCaptions`, which keys on the caption's `<h5>`.
 */
export function liftHeadingLevels(html: string): string {
  // Every heading is matched, not just the ones being changed: the replacer
  // has to see h2s in document order to know when sections have begun.
  // Headings never nest, so a lazy match to the close is safe, and the
  // backreference keeps each open tag paired with its own level's close.
  let inSections = false;
  return html.replace(
    /<h([1-6])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g,
    (whole, level: string, attrs: string, inner: string) => {
      if (level === "1") return whole;
      if (level === "2") {
        inSections = true;
        return whole;
      }
      const next = inSections ? "3" : "2";
      return `<h${next}${attrs}>${inner}</h${next}>`;
    },
  );
}

/**
 * All render-time markup work, applied in order after token substitution.
 *
 * `dropNavLinks` and `rewriteHashlinks` used to be order-coupled: both keyed on
 * the raw `/#N` hrefs, so dropping had to happen before rewriting resolved them
 * away. The freeze bakes real anchors now, and the two key on disjoint targets
 * (`#page-block-1` vs `#footer0`), so that coupling is gone.
 *
 * Two orderings still matter. `addContactNavItem` must come after BOTH
 * `rewriteHashlinks` and `rewriteNavLabels`, or the item it adds gets rewritten
 * into a second Availability link — see its own doc comment. And
 * `liftHeadingLevels` runs LAST: it must see the headings the caption transform
 * produces, not the ones it replaced.
 *
 * `values` is the page's Prismic slot map. It is optional so every caller that
 * only cares about markup repair (and the whole existing test suite) can keep
 * passing html alone; when absent, the committed defaults are used unchanged.
 */
function steps(values?: SlotLookup): ((html: string) => string)[] {
  const availability = availabilityFromSlots(availabilityData, values);
  const poster = values?.get(POSTER_SLOT)?.url || VIDEO_POSTER;
  return [
    dropNavLinks,
    rewriteHashlinks,
    rewriteCfEmails,
    restoreLinkSpacing,
    rewriteNavLabels,
    // After rewriteHashlinks + rewriteNavLabels, both of which would otherwise
    // rewrite the item this adds.
    addContactNavItem,
    addMainLandmark,
    (html) => addVideoPoster(html, poster),
    (html) => replaceAvailabilityImage(html, availability),
    restyleCarouselCaptions,
    replaceRuleMarks,
    nameBareLinks,
    nameMenuToggle,
    // After restyleCarouselCaptions, which matches the caption's <h5>.
    liftHeadingLevels,
  ];
}

export function enhanceFrozenHtml(html: string, values?: SlotLookup): string {
  return steps(values).reduce((acc, step) => step(acc), html);
}

/**
 * Appended AFTER the artifact CSS (same injected <style>), so these win over
 * the freeze's reveal-force block by both order and specificity:
 * - `.rd-fx-wait/.rd-fx-run`: scroll-reveal for below-fold `.block-effects`
 *   elements — FrozenPage's hydration adds `wait` only to elements below the
 *   viewport (above-fold content never flashes) and swaps to `run` on
 *   intersection. No-JS and reduced-motion users keep the force-visible page.
 * - `scroll-margin-top`: anchor targets clear the fixed Blux nav — 100px,
 *   matching the original's measured landing gap exactly.
 * - `scroll-behavior`: smooth native anchor scrolling, motion-gated.
 */
export const FROZEN_ENHANCE_CSS = [
  ".block-effects.rd-fx-wait{opacity:0!important;transform:translateY(18px)!important;transition:none!important}",
  ".block-effects.rd-fx-run{opacity:1!important;transform:none!important;transition:opacity .65s cubic-bezier(.2,.55,.88,.95),transform .65s cubic-bezier(.2,.55,.88,.95)!important}",
  '[id^="page-block-"],.rd-avail{scroll-margin-top:100px}',
  "@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}",
  // Map legend plus/minus glyph: the Blux CSS centers the horizontal bar at
  // 50% of the chip but hardcodes the vertical bar at top:10px (and the active
  // collapse at 17px) — correct only for a 34px chip, so the cross sits
  // off-center under our font metrics. Center both bars relatively; the
  // original .25s transition still animates the plus→minus collapse.
  ".map_icon_plusm:before{top:calc(50% - 7px);height:14px}",
  '.map_icon[data-clicked="1"] .map_icon_plusm:before{top:50%;height:0}',

  // Map legend chips: the freeze's #919FAD behind white 14px text is 2.7:1,
  // well under the 4.5:1 minimum, so the inactive chip labels are hard to read
  // against the photography behind them. #6d7782 is the SAME hue and
  // saturation scaled down 25% — the smallest uniform darkening that reaches
  // 4.55:1, chosen over the brand navy so the chips stay visibly inactive
  // next to the white active chip rather than reading as a second live state.
  ".map_icon{background-color:#6d7782}",

  // — Design review, round 2 (Nicole, 2026-07-30) —

  // Three 1px white rules the original site drew between stacked rows (one in
  // Amenities, two in Local Amenities). They read as stray hairlines against
  // the near-white page, so they come out. The freeze baked them as INLINE
  // border styles, hence !important.
  "#page-block-6-item-1,#page-block-12-item-1,#page-block-12-item-2" +
    "{border-top-width:0!important}",

  // (The `.links` underline weight/offset is specified in app.css, alongside
  // the platform anchor base that owns the underline itself.)

  // Halve the gap between the Burbank Portfolio copy and the video below it:
  // both sections use the stock 80px `.blocks0container` block padding, so the
  // seam was 160px. Child combinators match the two outer containers only —
  // nested block containers keep their own inline padding.
  "#page-block-9>.block-holder>.blocks0container{padding-bottom:40px}",
  "#page-block-10>.blocks0container{padding-top:40px}",

  // Type scale, per the Figma DevTools annotations. Only the leading changes —
  // the annotated font sizes already match the artifact's desktop values, so
  // these override the top-level rules and leave the ≤700px mobile step alone.
  ".text1{line-height:30px}",
  ".text11{font-size:50px;line-height:70px}",
  ".text12{font-size:80px;line-height:100px}",
  "@media all and (max-width:700px){.text1{font-size:18px;line-height:30px}" +
    ".text11{font-size:40px;line-height:60px}" +
    ".text12{font-size:48px;line-height:70px}}",

  // — Design review, round 3 (Nicole, Figma comments, 2026-07-31) —

  // Section heading blocks: the inline `20px 0 30px` becomes `20px 0 5px`.
  // Asked for on "premium amenities" in round 2 and on "A Monument of
  // Excellence" in round 3; the two are the same eyebrow/rule/heading pattern,
  // so they take the same treatment. Inline, so !important.
  "#page-block-1-item-0-item-1>.blocks0container," +
    "#page-block-5-item-0-item-1>.blocks0container" +
    "{padding:20px 0 5px!important}",

  // "Even out the spacing above/below the lines" — the double rule under each
  // section eyebrow sat 18px below the eyebrow and 44px above the heading,
  // measured as INK rather than boxes (the eyebrow's descent space and the
  // 50/70 heading's leading overhang both hide inside the box gaps, which read
  // a misleading 10 and 34.5).
  //
  // `.rd-rule-box` is inline-block, so a top margin does NOT simply push the
  // mark down — part of it is absorbed by the line box, and the holder grows by
  // less than the margin. So the margin closes the gap from BOTH sides at once:
  // every 2px added moves the upper gap +2 and the lower gap -2. Swept it
  // rather than solved it, pixel-probing the painted rows at each step:
  //
  //     margin   0  →  18 / 45.5      margin  12  →  30 / 33.5
  //     margin   8  →  26 / 37.5      margin  14  →  32 / 31.5   ← even
  //
  // 14px lands them 0.5px apart. Nicole's own reference crop measures 21/30 at
  // its scale (24.5/35 at ours), so this is if anything tighter than the
  // reference — which is what "even out" asks for.
  //
  // Scoped to the four eyebrow marks by their own containers: `.rd-rule-box`
  // also draws the availability panel's rule and the three carousel captions,
  // whose spacing is set by their own designs.
  "#page-block-1-item-0-item-0 .rd-rule-box," +
    "#page-block-5-item-0-item-0 .rd-rule-box," +
    "#page-block-9-item-0-item-0 .rd-rule-box," +
    "#page-block-11-item-0-item-0 .rd-rule-box" +
    "{margin-top:14px}",

  // Left-side padding on the copy blocks that sit to the RIGHT of their image.
  // Nicole's note is a DevTools capture reading `padding: 8% 0px 30px 8%`
  // (node 12:118) against the Amenities/FIT block, whose baked inline value is
  // `8% 0px 30px 4%` — so the single change is left 4% → 8%, opening the gutter
  // between the photograph and the copy.
  //
  // Applied to all three blocks carrying that exact inline shape, not just the
  // one screenshotted: they are the same layout case (copy right of image, no
  // right padding) in Amenities and in A City Full Of Possibilities. The
  // mirrored rows — copy LEFT of the image — are deliberately untouched; their
  // inline `6%` right padding already owns that gutter, and widening their left
  // would push them off the outer margin.
  //
  // The child combinator is load-bearing: the inline padding sits on the
  // `.blocks0container` INSIDE each `#…-item-N` wrapper, not on the wrapper
  // itself. Targeting the wrapper adds a second, outer 8% instead of widening
  // the real one — which is what the first attempt here did, narrowing the copy
  // column by 28px and reflowing it. Inline, so !important.
  "#page-block-6-item-0-item-1>.blocks0container," +
    "#page-block-6-item-2-item-1>.blocks0container," +
    "#page-block-12-item-1-item-1>.blocks0container{padding-left:8%!important}",

  // "Burbank Incentives" becomes a boxed white button rather than an underlined
  // text link (Figma node 12:140). `.buttons2` carries the freeze's link skin,
  // so its border and underline are cleared here.
  //
  // Every selector below keeps the `#page-block-11` prefix, and must: the base
  // rule is (1,1,0), so a bare `.buttons2:hover` at (0,2,0) would lose. That is
  // exactly why the artifact's own `.buttons2:hover{background-color:transparent}`
  // is inert on this element.
  "#page-block-11 .buttons2{display:inline-block;background:#fff;border:0;" +
    "border-radius:4px;padding:10px;font-family:Montserrat,sans-serif;" +
    "font-size:11px;font-weight:500;line-height:normal;letter-spacing:.03em;" +
    "text-transform:uppercase;text-decoration:none;color:#053a6c;" +
    "transition:background-color .15s ease-in-out,color .15s ease-in-out}",

  // The freeze draws the old text link's underline as a pseudo-element rather
  // than a border — `.buttons2:before{…bottom:-4px;border-bottom:1px solid}`,
  // recoloured to #4b4b6e. Clearing `border` and `text-decoration` above never
  // touched it, so a stray full-width hairline was still being drawn 4px under
  // the white box. Scoped to this block so any other `.buttons2` keeps its skin.
  "#page-block-11 .buttons2:before{display:none}",

  // Hover/focus: invert the fill. Neither the Figma redline (a single static
  // frame, no variants) nor the original site (whose only rule for this class
  // is a verified no-op) defines an interactive state, so this is a new
  // decision made to match what the codebase already does — DefaultButton's
  // `hover:bg-dark hover:text-white`, and the artifact's own map chips, which
  // swap fill and text on activation.
  //
  // `.15s ease-in-out` is the artifact's interaction timing (`.transition150`,
  // on the carousel arrows). Deliberately NOT cubic-bezier(.2,.55,.88,.95):
  // that is the export's reveal easing, used here only for entrance motion.
  //
  // No `prefers-reduced-motion` guard is needed — app.css's `@layer base` reset
  // is `!important`, so it beats this unlayered declaration and clamps the
  // duration. Verified on this element, not assumed: emulating `reduce` drops
  // its computed transition-duration to 1e-05s.
  //
  // `:focus-visible` rides the same rule so keyboard users get the same signal,
  // and nothing sets `outline` — the UA focus ring is left intact rather than
  // repeating the artifact's own `.icon:focus{outline:0}`.
  "#page-block-11 .buttons2:hover,#page-block-11 .buttons2:focus-visible" +
    "{background:#053a6c;color:#fff}",

  // Round 3: "reduce space by 50%" — the gap between the body copy and the
  // "Burbank Incentives" button (node 21:12).
  //
  // Measured as the VISIBLE white gap: the last line's ink bottom to the top
  // edge of the button's white rectangle. Both boundaries are things you can
  // see, which is what Nicole's arrow spans; the box gap reads a flat 40px
  // because the copy's box keeps 10px of unused descent space below "activities."
  // and the button's own 10px padding sits inside its visible edge.
  //
  // Halving 49.3px wants 24.65px. The wrapper's inline `padding: 40px 0 0` is
  // the only thing in that gap, so it maps 1:1 — probed at four values:
  //
  //     padding 40 → 49.3      padding 15 → 24.3   ← half
  //     padding 20 → 29.3      padding 12 → 21.3
  //
  // Scoped to the block even though this is the page's only `.buttons` wrapper —
  // a re-freeze that adds a second button elsewhere should not inherit this.
  // Inline, so !important.
  "#page-block-11-item-0-item-2 .buttons{padding-top:15px!important}",

  // Lush Haven carousel caption (Figma node 12:130): the rule mark above a
  // left-aligned white caption, over the image rather than in a white bar.
  CAROUSEL_CAPTION_CSS,

  // Suite availability panel, rebuilt from JSON in place of the flattened PNG.
  AVAILABILITY_CSS,

  // Distinguished Design band: icon row above a full-width white band, with the
  // graphic on its left half and the availability table to its right.
  // Loaded after AVAILABILITY_CSS — it repositions the table's own block.
  DISTINGUISHED_CSS,

  // The double-rule mark, now vector rather than two baked PNGs.
  RULE_MARK_CSS,

  // Link underlines that draw in left-to-right — the rule mark's gesture and
  // timing applied to the nav (on first scroll) and to body links (on scroll
  // into view). Nicole's comment on node 51:42.
  UNDERLINE_DRAW_CSS,
].join("");
