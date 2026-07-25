import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { path: "/dev/a11y-fixtures", name: "a11y fixtures" },
  { path: "/dev/animate-in", name: "animate-in demo" },
  { path: "/dev/blux-page", name: "blux band fixture" },
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
