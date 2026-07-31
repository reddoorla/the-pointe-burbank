// The suite-availability panel in the "Distinguished Design" band.
//
// WHY THIS IS MARKUP AND NOT THE ARTWORK: the Blux export baked the panel as a
// flattened 1645x534 PNG, so its type was raster. Rasterised type is soft on
// any display whose pixel ratio is not 1, resamples again under browser zoom,
// cannot be selected, searched, translated or read aloud, and ignores the
// reader's own font settings. Rebuilt as real text it renders from the font at
// whatever size and density the device asks for — that fidelity is the point of
// the change. The committed HTML artifact stays byte-faithful to the freeze;
// the image element is simply never rendered.
//
// Being data-driven is a CONSEQUENCE of that, not the goal. Content lives in
// `frozen/<uid>.availability.json` because the values have to come from
// somewhere, the same way `frozen/<uid>.map.json` carries the location map's
// config — see `assertAvailabilityData` for how the text is protected.
//
// The strings are transcribed from the artwork and verified against it:
// TOTAL 480,000 SF, then Suites 300/400/600/620/990. Two things Figma changes
// from the artwork on purpose, so neither is a transcription error — the
// artwork sets its type in BLACK where Figma specifies #053a6c, and the
// artwork's label reads "AVAILABLE" where Figma reads "Availab(li)lity".
//
// Layout follows the design review's Figma (node 4:36 "text only"): a single
// column of rows, each an 80px term and a right-aligned 80px value 15px apart —
// a 175px block — with the double-rule mark between the total and the available
// list. The artwork's own layout is a wider two-column arrangement; Figma
// supersedes it. Type is 13px #053a6c with 0.39px tracking on the uppercase
// rows. Figma specifies Gotham, which this site neither licenses nor loads, so
// it maps to Montserrat, the project's sans (Medium 500 for terms, Light 300
// for values).

import { ruleMarkBox, RULE_MARK_BOX } from "./rule-mark";

export interface AvailabilitySuite {
  name: string;
  area: string;
}

export interface AvailabilityData {
  /** `data-media` of the flattened image this table replaces. */
  mediaId: string;
  /** Element id, so nav can deep-link to the panel. */
  anchorId: string;
  /** Accessible table caption (visually hidden). */
  caption: string;
  totalLabel: string;
  total: string;
  availableLabel: string;
  suites: AvailabilitySuite[];
}

/**
 * Validate a committed availability sidecar.
 *
 * The panel exists to render this text faithfully, so text that silently goes
 * missing is the one failure that defeats the whole change — and it would be
 * quiet: a dropped or misnamed key reads as `undefined`, which renders as an
 * empty cell that still lays out correctly. A raster at least fails visibly.
 * So a malformed sidecar stops the build instead, naming the offending path.
 * Returns the value typed on success.
 */
export function assertAvailabilityData(
  value: unknown,
  source = "availability data",
): AvailabilityData {
  const fail = (path: string, why: string): never => {
    throw new Error(`${source}: ${path} ${why}`);
  };
  const str = (v: unknown, path: string): string =>
    typeof v === "string" && v.trim() !== ""
      ? v
      : fail(path, `must be a non-empty string (got ${JSON.stringify(v)})`);

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("root", `must be an object (got ${JSON.stringify(value)})`);
  }
  const d = value as Record<string, unknown>;
  for (const key of [
    "mediaId",
    "anchorId",
    "caption",
    "totalLabel",
    "total",
    "availableLabel",
  ]) {
    str(d[key], key);
  }

  if (!Array.isArray(d.suites) || d.suites.length === 0) {
    fail("suites", "must be a non-empty array");
  }
  (d.suites as unknown[]).forEach((s, i) => {
    if (typeof s !== "object" || s === null)
      fail(`suites[${i}]`, "must be an object");
    const suite = s as Record<string, unknown>;
    str(suite.name, `suites[${i}].name`);
    str(suite.area, `suites[${i}].area`);
  });

  return value as AvailabilityData;
}

/** Minimal read surface over the render's slot values (see FrozenPage). */
export interface SlotLookup {
  get(key: string): { text?: string; url?: string } | undefined;
}

/**
 * Slot keys the panel reads, each paired with its committed default.
 *
 * Single source of truth for two consumers: the render (below) and the site's
 * `extra-slots.json`, which is generated from this so the declaration and the
 * reader cannot drift. Keys carry the freeze's reserved `x.` prefix, which is
 * what keeps them from colliding with the export's derived slots.
 */
export function availabilitySlots(
  data: AvailabilityData,
): { key: string; text: string }[] {
  return [
    { key: "x.avail.caption", text: data.caption },
    { key: "x.avail.totalLabel", text: data.totalLabel },
    { key: "x.avail.total", text: data.total },
    { key: "x.avail.availableLabel", text: data.availableLabel },
    ...data.suites.flatMap((s, i) => [
      { key: `x.avail.suite${i + 1}.name`, text: s.name },
      { key: `x.avail.suite${i + 1}.area`, text: s.area },
    ]),
  ];
}

/**
 * Overlay Prismic's values on the committed defaults.
 *
 * Rule: an ABSENT slot falls back to the committed file (so the panel renders
 * correctly on a repo whose CMS has not been migrated yet); a PRESENT slot
 * wins, blank included. The one special case is a suite with both fields
 * blanked — that is the editing gesture for "this suite is leased", so the row
 * is dropped rather than rendered empty.
 *
 * The suite COUNT is fixed by the declaration: five rows exist because five
 * were declared at freeze time. Blanking removes one; adding a sixth needs a
 * new pair of slots in `extra-slots.json`, a re-freeze and a re-migrate.
 */
export function availabilityFromSlots(
  base: AvailabilityData,
  values?: SlotLookup,
): AvailabilityData {
  if (!values) return base;
  const read = (key: string, fallback: string): string => {
    const slot = values.get(key);
    if (!slot) return fallback; // not in the CMS → committed default
    return (slot.text ?? "").trim();
  };
  const suites = base.suites
    .map((s, i) => ({
      name: read(`x.avail.suite${i + 1}.name`, s.name),
      area: read(`x.avail.suite${i + 1}.area`, s.area),
    }))
    .filter((s) => s.name !== "" || s.area !== "");

  return {
    ...base,
    caption: read("x.avail.caption", base.caption),
    totalLabel: read("x.avail.totalLabel", base.totalLabel),
    total: read("x.avail.total", base.total),
    availableLabel: read("x.avail.availableLabel", base.availableLabel),
    suites,
  };
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const row = (term: string, value: string, termClass: string): string =>
  `<tr><th scope="row" class="${termClass}">${escapeHtml(term)}</th>` +
  `<td class="rd-avail-value">${escapeHtml(value)}</td></tr>`;

/**
 * The panel as a real table: genuinely tabular data, so `<th scope="row">`
 * pairs each suite with its area regardless of how the columns are styled.
 * The "Available" heading spans the row above its list rather than sitting in
 * the term column, matching the Figma stack.
 */
export function renderAvailability(data: AvailabilityData): string {
  return (
    `<div class="rd-avail" id="${escapeHtml(data.anchorId)}">` +
    '<table class="rd-avail-table">' +
    `<caption class="rd-avail-caption">${escapeHtml(data.caption)}</caption>` +
    "<tbody>" +
    row(data.totalLabel, data.total, "rd-avail-term") +
    '<tr class="rd-avail-rule-row"><td colspan="2">' +
    ruleMarkBox(RULE_MARK_BOX.width, RULE_MARK_BOX.height) +
    "</td></tr>" +
    '<tr class="rd-avail-head"><th scope="col" colspan="2" class="rd-avail-term">' +
    `${escapeHtml(data.availableLabel)}</th></tr>` +
    data.suites.map((s) => row(s.name, s.area, "rd-avail-suite")).join("") +
    "</tbody></table></div>"
  );
}

/**
 * The freeze renders the panel as a background-image div wrapping a single
 * `.mediaRatio` spacer — a fixed two-element shape, keyed by the artwork's
 * `data-media`. Replace that whole element with the live table.
 *
 * Returns the html unchanged if the shape is not found; `availability.test.ts`
 * asserts the swap fires against the real committed artifact, so a re-freeze
 * that renames the media fails loudly instead of silently keeping the image.
 */
export function replaceAvailabilityImage(
  html: string,
  data: AvailabilityData,
): string {
  const media = data.mediaId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const imageBlock = new RegExp(
    `<div class="ib img imgfit camediaload"[^>]*data-media="${media}"[^>]*>` +
      `\\s*<div class="mediaRatio"[^>]*></div>\\s*</div>`,
  );
  return html.replace(imageBlock, renderAvailability(data));
}

/**
 * Figma's absolute metrics (13px type, 80px columns, 15px gutter, 10px row gap)
 * are kept as-is rather than made fluid: the panel now sits in a single narrow
 * column, so it no longer needs to scale with a full-width artwork box the way
 * the flattened PNG did.
 */
export const AVAILABILITY_CSS = [
  ".rd-avail{padding:0 0 20px}",
  // Figma's rows are 16px tall on a 10px gap — a 26px pitch.
  ".rd-avail-table{border-collapse:collapse;font-family:Montserrat,sans-serif;" +
    "font-size:13px;line-height:16px;color:#053a6c;text-align:left}",
  ".rd-avail-caption{position:absolute;width:1px;height:1px;overflow:hidden;" +
    "clip-path:inset(50%);white-space:nowrap}",
  ".rd-avail-table th,.rd-avail-table td{padding:0 0 10px;vertical-align:top}",
  // The mark's row must hug the mark. Without this the cell inherits the 16px
  // text line-height and the row stands 26px tall instead of ~15px, pushing
  // the heading and all five suites ~11px down the block — visible against
  // Figma even though every individual row pitch measured correct.
  ".rd-avail-table .rd-avail-rule-row td{line-height:0}",
  ".rd-avail-table tr:last-child th,.rd-avail-table tr:last-child td" +
    "{padding-bottom:0}",
  ".rd-avail-table th.rd-avail-term{font-weight:500;letter-spacing:.03em;" +
    "text-transform:uppercase;width:80px}",
  ".rd-avail-table th.rd-avail-suite{font-weight:300;width:80px;" +
    "white-space:nowrap}",
  // 95px border-box = Figma's 15px gutter + 80px column, putting the value's
  // right edge at 175px exactly. Measured: the widest value ("480,000 SF") sets
  // 72.86px in Montserrat Light 13px, so Figma's 80px holds without the wider
  // column an earlier mismeasurement had suggested. `nowrap` is a guard, not a
  // fix — the table's auto layout would widen the column rather than wrap.
  ".rd-avail-table td.rd-avail-value{font-weight:300;width:95px;" +
    "padding-left:15px;text-align:right;white-space:nowrap}",
].join("");
