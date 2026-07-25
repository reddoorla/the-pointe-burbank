# Accessibility

This starter targets **WCAG 2.2 Level AA**. Accessibility is treated as a default, not a phase — every component ships accessible-by-default and every PR is gated against regressions.

## What's wired by default

- **Skip-to-main-content link** on every page ([+layout.svelte](../src/routes/+layout.svelte)).
- **Focus-managed `<main>`** with `tabindex="-1"` so route changes can move focus into content.
- **Accessible primitives** for the patterns most likely to ship a11y bugs:
  - [Accordion](../src/lib/components/Accordion.svelte) — disclosure pattern with `aria-expanded`, `aria-controls`, `aria-labelledby`.
  - [Modal](../src/lib/components/Modal.svelte) — native `<dialog>` with backdrop, ESC-to-close, and implicit focus trap.
  - [Slider](../src/lib/components/Animation/Slider.svelte) — `aria-roledescription="carousel"`, per-slide controls with `aria-current`.
  - [Form / Field](../src/lib/components/Form.svelte) — every input has a programmatic label, required fields announce "(required)" to screen readers, errors link via `aria-describedby` and surface in a focused error summary.
- **`prefers-reduced-motion` honored** in animation primitives ([animateIn.ts:51](../src/lib/actions/animateIn.ts#L51)) — users with the OS preference get no transform, no transition, immediate reveal.
- **Compiler-level a11y warnings** via Svelte's built-in checks (run on `pnpm lint`).

## Automated testing

| Tool                      | What it gates                                                                               | Where                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `axe-core` via Playwright | Zero WCAG 2 A/AA, 2.1 A/AA, 2.2 AA violations on `/dev/a11y-fixtures` and `/dev/animate-in` | [tests/a11y/fixtures.spec.ts](../tests/a11y/fixtures.spec.ts), runs on every PR |
| Lighthouse CI             | Accessibility ≥ 0.95                                                                        | [lighthouserc.json](../lighthouserc.json), runs on every PR                     |
| Svelte compiler           | Native a11y rule set                                                                        | `pnpm lint`                                                                     |
| Vitest unit tests         | ARIA attributes on Accordion, Modal, Field, Form                                            | `pnpm test:unit`                                                                |

Run locally:

```bash
pnpm test:unit        # vitest unit tests
pnpm test:smoke       # Playwright + axe (boots vite dev)
pnpm test:lhci        # Lighthouse CI (boots vite dev)
```

## Manual testing reference

Automated tooling (axe, Lighthouse CI, Svelte compiler) catches the bulk of WCAG violations on every code change. Manual passes aren't part of the standard build. If a client reports an issue or an external audit identifies a gap, these are the checks worth running to reproduce and confirm fixes:

- Keyboard-only navigation through every interactive element, including tab order, visible focus rings, and trap-free modals
- Screen reader pass with VoiceOver (macOS / iOS) and NVDA (Windows / Firefox)
- 200% browser zoom — no clipped content or horizontal scroll
- Windows High Contrast mode — borders, focus rings, and form errors remain visible
- Reduced-motion OS setting — no animation plays
- Color contrast: 4.5:1 on body text, 3:1 on UI components and large text

## Adding new accessible components

1. **Start from a native element** when one exists (`<button>`, `<dialog>`, `<details>`). Re-implementing them in `<div>`s is the #1 source of a11y bugs.
2. **Add the component to `/dev/a11y-fixtures`** so the axe gate covers it.
3. **Pair label + input** with `for`/`id` on every form control (Field handles this).
4. **Don't trap focus accidentally** — only modals/popovers should trap. Everything else should let Tab continue out.
5. **Mark errors with `role="alert"` and `aria-live="polite"`** so screen readers announce them when they appear.

## Accessibility statement

Public-sector and education clients should publish an accessibility statement at `/accessibility`. A starting template is in this repo's [docs/accessibility-statement-template.md](./accessibility-statement-template.md) once you create it (TODO).

## Reporting issues

Treat accessibility regressions as P1 bugs. They block merges to `main`.
