import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { path: "/dev/a11y-fixtures", name: "a11y fixtures" },
  { path: "/dev/animate-in", name: "animate-in demo" },
  { path: "/dev/blux-page", name: "blux band fixture" },
  // The frozen the-pointe render. It joined this suite once the export's own
  // a11y defects were repaired at render time (2026-07-31): the missing <main>
  // landmark, the h1→h4/h2→h5 heading skips, the unnamed logo links and menu
  // checkbox, and the 2.7:1 map-legend chips. Guarding the whole page here
  // beats asserting those five individually — anything the freeze regresses,
  // or any new markup that arrives without a name, fails on this line.
  { path: "/dev/blux-frozen", name: "frozen the-pointe page" },
];

for (const { path, name } of pages) {
  test(`${name} has no axe violations`, async ({ page }) => {
    // Audit under reduced-motion: the animate-in effects no-op (elements render
    // at full opacity immediately), so axe never samples a mid-fade element —
    // whose blended color would trip a spurious color-contrast violation. This
    // is also the correct a11y baseline (motion-averse users see this state).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
