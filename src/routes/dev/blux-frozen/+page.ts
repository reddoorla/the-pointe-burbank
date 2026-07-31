import template from "$lib/blux-frozen/frozen/home.html?raw";
import styleCss from "$lib/blux-frozen/frozen/home.style.css?raw";
import manifest from "$lib/blux-frozen/frozen/home.slots.json";

// Offline frozen-render gate: the PRODUCTION freeze artifacts rendered through
// the production <FrozenPage>, with the freeze's own default slot values in
// place of a Prismic query. The Playwright gate (tests/gate/frozen-fidelity)
// and the a11y suite (tests/a11y/fixtures) both drive this route.
//
// The template, stylesheet and font links are imported from `$lib/.../frozen/`
// — the very files `artifacts.ts` globs for the real `/` route — NOT from a
// copy beside this file. There used to be a copy, and it had silently drifted:
// it was a three-minutes-older freeze run missing five media bands'
// `data-loaded`/`position:relative` attributes, so every gate assertion was
// measuring markup that production does not serve. Import the real artifact and
// that whole class of divergence cannot recur.
//
// `home.slots.json` is the one thing production has no use for (it reads slot
// values from Prismic), so it stays a distinct artifact rather than a duplicate.
// Regen all four via:
//   node dist/cli/bin.js blux freeze ~/Desktop/thePointe --out <tmp> --site home
//   cp <tmp>/frozen/home.{html,style.css,fonts.json} <tmp>/home.slots.json \
//      src/lib/blux-frozen/frozen/
export const prerender = true;

export function load() {
  return {
    frozen: true, // render bare (no app chrome) — the frozen page is standalone
    template,
    styleCss,
    fontLinks: manifest.fontLinks,
    // Narrow `kind` from the JSON artifact's widened `string` to the slot union.
    slots: manifest.slots.map((s) => ({
      ...s,
      kind: s.kind as "text" | "image",
    })),
  };
}
