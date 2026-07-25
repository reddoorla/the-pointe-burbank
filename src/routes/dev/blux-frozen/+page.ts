import template from "./the-pointe.html?raw";
import styleCss from "./the-pointe.style.css?raw";
import manifest from "./the-pointe.slots.json";

// Offline frozen-render gate: the real the-pointe freeze artifacts (template +
// style + slot manifest) rendered through the production <FrozenPage>. The
// Playwright gate (tests/gate/frozen-fidelity) drives this route and asserts the
// render matches the live layout (15333px) with no residual tokens. Regen via
//   node dist/cli/bin.js blux freeze ~/Desktop/thePointe --out <tmp> --site the-pointe
//   cp <tmp>/frozen/the-pointe.{html,style.css} <tmp>/the-pointe.slots.json this-dir/
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
