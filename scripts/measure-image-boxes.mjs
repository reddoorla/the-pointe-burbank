// Measure the box every frozen image is actually painted into, and record its
// source width, so the render can ask the CDN for the size the page needs.
//
// WHY THIS IS MEASURED AND NOT DERIVED. The markup does not predict the painted
// box: an element with an inline `width:5774px` renders into an 823px box, and
// one with `width:1334px` renders into 816px. Blux sizes these with CSS, so the
// only honest source is a laid-out page.
//
// WHY IT RUNS OFFLINE. `/dev/blux-frozen` renders the real artifact through the
// real <FrozenPage> with the freeze's own default slot values. Its photographs
// are CSP-blocked (the defaults point at Blux CloudFront) — which does not
// matter here, because every box is driven by the `.mediaRatio` spacer, the
// inline width or a vh rule, none of which need the picture to have loaded.
//
// WHY `data-size` IS THE SOURCE WIDTH. The freeze builds each url as
// `{data-base}w:{data-size}/{data-media}` — `data-size` is the CDN variant Blux
// itself served, and that variant is what was migrated into Prismic. Asking
// imgix for more than that UPSCALES: the 123px LEED badge goes from 4.9KB to
// 30KB at w=900. So the source width is a ceiling, not a suggestion.
//
// Usage (needs a dev server on the port given, default 5173):
//   node scripts/measure-image-boxes.mjs [port]

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const FROZEN = join(here, "..", "src", "lib", "blux-frozen", "frozen");
const OUT = join(FROZEN, "home.image-boxes.json");
const PORT = process.argv[2] ?? "5173";

// The freeze bakes its layout at 1440; measuring anywhere else measures a
// different page. Same constant as the Playwright gate.
const VIEWPORT = { width: 1440, height: 950 };

const slots = JSON.parse(readFileSync(join(FROZEN, "home.slots.json"), "utf8"));
/** Committed default url -> every slot key that resolves to it. */
const keysByUrl = new Map();
for (const s of slots.slots) {
  if (s.kind !== "image" || !s.url) continue;
  if (!keysByUrl.has(s.url)) keysByUrl.set(s.url, []);
  keysByUrl.get(s.url).push(s.key);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
await page.goto(`http://localhost:${PORT}/dev/blux-frozen`, {
  waitUntil: "load",
});
await page.evaluate(() => document.fonts.ready.then(() => undefined));
await page.waitForTimeout(400);

const measured = await page.evaluate(() => {
  const media = [...document.querySelectorAll("*")].filter((el) =>
    /url\(/.test(el.style.backgroundImage),
  );

  const read = (el) => {
    const r = el.getBoundingClientRect();
    return {
      url: /url\(['"]?([^'")]+)/.exec(el.style.backgroundImage)?.[1] ?? "",
      w: Math.round(r.width),
      h: Math.round(r.height),
      source: Number(el.getAttribute("data-size")) || null,
    };
  };

  const out = [];
  for (const el of media) {
    let row = read(el);
    // A slide or gallery item the freeze settled hidden measures 0x0. Reveal
    // just that one, measure, and put it back — one at a time, so the others'
    // layout is never disturbed while it is being read.
    if (row.w === 0) {
      const hidden = [];
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).display === "none") {
          hidden.push([n, n.style.display]);
          n.style.display = "block";
        }
      }
      row = read(el);
      for (const [n, prev] of hidden.reverse()) n.style.display = prev;
    }
    out.push(row);
  }
  return out;
});

await browser.close();

// Fold onto slot keys, keeping the LARGEST box a shared image is asked to fill.
const boxes = {};
let unmatched = 0;
for (const m of measured) {
  const keys = keysByUrl.get(m.url);
  if (!keys) {
    unmatched += 1;
    continue;
  }
  for (const key of keys) {
    const prev = boxes[key];
    if (!prev || m.w > prev.w)
      boxes[key] = { w: m.w, h: m.h, source: m.source };
  }
}

const sorted = Object.fromEntries(
  Object.entries(boxes).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(
  OUT,
  `${JSON.stringify({ viewport: VIEWPORT.width, boxes: sorted }, null, 2)}\n`,
);

const zero = Object.values(sorted).filter((b) => b.w === 0).length;
console.log(
  `measured ${measured.length} painted backgrounds at ${VIEWPORT.width}px`,
);
console.log(`wrote ${Object.keys(sorted).length} slot boxes -> ${OUT}`);
if (unmatched) console.log(`WARNING: ${unmatched} urls matched no slot`);
if (zero) console.log(`WARNING: ${zero} slots still measured 0 wide`);
