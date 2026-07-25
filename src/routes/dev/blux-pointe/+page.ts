import fixture from "./fixture.json";
import siteConfig from "./site-config.json";

// Offline fidelity-gate data: the real the-pointe catalog output rendered
// through the production SliceZone + chrome, with no Prismic round-trip. The
// Playwright gate (tests/gate) drives this route and the coverage check scores
// the rendered HTML against the export. Chrome (navLinks/footerColumns) is
// surfaced via page data so the app layout's Nav/Footer render it once.
//
// REGEN the committed fixtures (fixture.json / site-config.json / theme.css)
// from a fresh the-pointe catalog run in reddoor-maintenance:
//   node dist/cli/bin.js blux catalog ~/Desktop/thePointe --out <tmp>
//   cp <tmp>/{render-fixture.json,site-config.json,theme.css} this-dir/
//   # (render-fixture.json → fixture.json), then `prettier --write` them.
// The load test's count canaries catch structural drift after a regen.
export const prerender = true;

type FixtureDoc = { uid: string; data: { slices: unknown[] } };

export function load() {
  const docs = fixture.documents as FixtureDoc[];
  const home = docs.find((d) => d.uid === "home") ?? docs[0];
  return {
    slices: home.data.slices,
    collections: fixture.collections,
    navLinks: siteConfig.nav.items.map(
      (i: { label: string; href: string }) => ({
        text: i.label,
        href: i.href,
      }),
    ),
    footerColumns: siteConfig.footer.columns,
  };
}
