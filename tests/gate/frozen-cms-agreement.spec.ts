import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Read from disk rather than importing: this spec runs under Playwright's plain
// node loader, not Vite, so `?raw` and JSON imports are unavailable here.
const artifact = (name: string): string =>
  readFileSync(
    fileURLToPath(
      new URL(`../../src/lib/blux-frozen/frozen/${name}`, import.meta.url),
    ),
    "utf8",
  );
const manifest = JSON.parse(artifact("home.slots.json")) as {
  slots: { key: string; kind: string; text?: string }[];
};
const template = artifact("home.html");

// Does the COMMITTED template still agree with the PUBLISHED Prismic document?
//
// The frozen render is a join across two artifacts that ship separately: the
// template supplies `⟦t:KEY⟧` positions, the document supplies the values. Slot
// keys are positional (`s{section}.t{n}`), so any re-freeze that adds or drops
// a text leaf renumbers every later key in that section — and the two halves
// then disagree SILENTLY. Nothing errors; the page just renders the right words
// in the wrong places.
//
// That is not hypothetical. The 2026-07-31 re-freeze stopped tokenizing a
// whitespace-only footer spacer, which shifted h.t12–h.t16 down one. Rendered
// against the not-yet-republished document, the footer lost "818.502.6707" and
// "A Property Within" and grew a stray "[email protected]" — a plausible-looking
// contact block with a missing phone number.
//
// This drives "/", which resolves the live document, and checks the footer
// contact column against the freeze's own defaults. The footer is the right
// probe: it is where the shifting keys live, and its values are stable facts
// (names, numbers, licence ids) rather than marketing copy someone may reword.
//
// A failure here means "template and CMS are out of step", and the fix is to
// republish rather than to edit this file. Deploying while it is red ships the
// scrambled footer, so it is deliberately a gate and not a warning.
test("committed template and published Prismic document agree", async ({
  page,
}) => {
  // The values the template's footer tokens expect, straight from the freeze
  // manifest — never hand-copied, so a future re-freeze updates them with it.
  const byKey = new Map(
    manifest.slots
      .filter((s) => s.kind === "text")
      .map((s) => [s.key, s.text ?? ""]),
  );
  // Scoped to the FOOTER region of the template. The nav is the wrong probe:
  // `dropNavLinks` deletes three of its items and `rewriteNavLabels` renames a
  // fourth, so its slots are expected not to render and would fail this on
  // purpose. The footer renders its slots verbatim.
  const footerAt = template.indexOf("<footer");
  expect(footerAt, "no <footer> in the artifact").toBeGreaterThan(-1);
  const expected = [...template.slice(footerAt).matchAll(/⟦t:(h\.t\d+)⟧/g)]
    .map((m) => byKey.get(m[1]!))
    .filter((v): v is string => v !== undefined)
    .map((v) => decodeEntities(v).trim())
    .filter(Boolean);
  expect(
    expected.length,
    "no footer text slots found — the artifact or its key scheme changed",
  ).toBeGreaterThan(8);

  await page.goto("/", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  const rendered: string[] = await page.evaluate(() =>
    [...document.querySelectorAll("footer li")]
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );

  // Every expected value must appear, IN ORDER. A subsequence rather than
  // strict equality, so the Cloudflare email rewrite (which replaces the
  // "[email protected]" placeholder with the real address) does not fail it —
  // a key shift still breaks the ordering, which is what this catches.
  const missing: string[] = [];
  let at = 0;
  for (const want of expected) {
    const hit = rendered.findIndex((line, i) => i >= at && line.includes(want));
    if (hit === -1) missing.push(want);
    else at = hit;
  }
  expect(
    missing,
    `published document is out of step with the committed template — ` +
      `republish the frozen_page migration release. Rendered: ${JSON.stringify(rendered)}`,
  ).toEqual([]);
});

/** The freeze stores a text node's RAW source, so defaults carry entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}
