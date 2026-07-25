# Reddoor Starter and Site Scaffold

## Purpose

A forkable starting point for all SvelteKit, Tailwind + Prismic sites developed at Reddoor.

## Stack

- **[SvelteKit](https://kit.svelte.dev/)** — Frontend framework with excellent DX and component-driven design
- **[Tailwind CSS v4](https://tailwindcss.com/)** — Utility-first CSS
- **[Prismic CMS](https://prismic.io/)** — Headless CMS with Slice Machine for flexible content modeling
- **[Netlify](https://www.netlify.com/)** — Deployment and hosting
- **[Vitest](https://vitest.dev/)** — Unit testing

## Components

A library of responsive, reusable components designed to be used within Prismic Slices or standalone:

- **Animation** — `AnimateInTriggered`, `AnimateOutTriggered`, `Slider`, `TriggerTransitionOnMount`
- **Layout** — `ContentWidth`, `PreNavTransition` (opt-in fade-to-black _before_ navigation; alternative to `TransitionOverlay`), `ScreenWidthMedia`, `TransitionOverlay`
- **Layout** — `ContentWidth`, `ScreenWidthMedia`, `TransitionOverlay`
- **UI** — `Accordion`, `BrandIcon`, `DefaultButton`, `DelayedLink`, `LandscapeModal`, `Nav`, `Footer`, `ScaleTextToContainer`
- **Forms** — `TurnstileWidget` (optional Cloudflare Turnstile challenge; dark until `PUBLIC_TURNSTILE_SITE_KEY` is set), plus `Field`/`Form` primitives used by the contact form

`BrandIcon` renders CC0 [simple-icons](https://simpleicons.org/) social glyphs (`facebook`, `x`/`twitter`, `reddit`, `instagram`, `linkedin`) in `currentColor`; it is decorative, so put the accessible name on the wrapping link.

- **Layout** — `ContentWidth`, `ScreenWidthMedia` (poster-first background video: idle-deferred iframe, quality-ramp reveal, reduced-motion poster only), `TransitionOverlay`
- **Media** — `HeroBackgroundImage` (LCP-preloaded, imgix-srcset hero image), `Img` (progressive blur-up wrapper for `?as=run` imports), `VimeoBanner` (interaction-gated background video with playback heartbeat)
- **UI** — `Accordion`, `DefaultButton`, `DelayedLink`, `LandscapeModal`, `Nav`, `Footer`, `ScaleTextToContainer`
- **Utils** — `$lib/utils/image` (`imgix()` / `srcset()` responsive Prismic image helpers), `$lib/utils/vimeo` (`checkVimeoVideo()` server-side oEmbed existence check)
- **Utils (from `@reddoorla/maintenance/client`)** — `whenPageReady()` (readiness floor/ceiling around eager-image settlement) and `prefersReducedMotion()` for load-aware splash/intro gating; the starter ships no splash, but the MSOT, espada, and reddoor-website layouts show the pattern
- **Content** — `RichTextBody` (drop-in `PrismicRichText` replacement that rank-compresses editor-authored heading levels into a gap-free `aria-level` outline without changing visuals)

This library grows as new interactive functions or layouts are needed, allowing work from different projects to carry over rather than rebuilding from scratch.

### Animation action — `use:animateIn`

A Svelte action that attaches fade-up reveal behavior to any element. Defaults to viewport-triggered (via `IntersectionObserver` — reveals on first scroll into view); pass a boolean or `{ trigger }` option to drive it from state instead. Applies inline styles only, so it composes with whatever `class` / `style` the host already has. Respects `prefers-reduced-motion`.

```svelte
<script>
  import { animateIn } from "$lib/actions/animateIn";
  let isOpen = $state(false);
</script>

<!-- Viewport-triggered -->
<div use:animateIn>…</div>

<!-- State-triggered -->
<div use:animateIn={isOpen}>…</div>

<!-- With overrides -->
<div use:animateIn={{ duration: 1200, delayMax: 0 }}>…</div>
```

**Options:** `trigger?: boolean` · `duration?: number` (ms, default `2400`) · `delayMax?: number` (ms, default `400`; viewport mode only — position-based stagger) · `translateY?: string` (default `"50%"`).

## Recipes

Opt-in patterns that need an extra dependency live in [`docs/recipes/`](docs/recipes/) — currently the [flatpickr datepicker action](docs/recipes/datepicker.md) (`pnpm add flatpickr` to activate).

## SEO routes

`robots.txt` and `sitemap.xml` are prerendered server routes (not static files) so both can emit absolute URLs on the deploy origin — Netlify's `URL` build env feeds `kit.prerender.origin` in `svelte.config.js`.

### Focus trap action — `use:trapFocus`

Apply to an overlay gated by an `{#if}` block: moves focus in on open (or to `[data-autofocus]`), cycles Tab/Shift+Tab within the overlay, and restores focus on close. **Options:** `onEscape?: () => void` · `enabled?: boolean` · `restoreFocus?: () => HTMLElement | null | undefined` (for triggers that unmount while the overlay is open). Not for `<dialog>` + `showModal()`, which traps natively.

### Motion-aware transitions — `$lib/transitions`

Import `fade`/`fly`/`slide` from `$lib/transitions` instead of `svelte/transition` — identical API, but durations collapse to 0 under `prefers-reduced-motion` (the CSS reset in `app.css` can't reach Svelte's JS-driven transitions).

### Micro-interaction utilities

`bump` / `negative-bump` (press feedback), `bob-on-hover` / `bob-always` (vertical wiggle), `pulse-always` (scale breathing), `boop` (one-shot rotate wiggle) — Tailwind `@utility` entries in `app.css`, all inert under `prefers-reduced-motion`.

## Getting Started

1. Fork/clone this repo and init a new project
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a new Prismic repository
4. Update `slicemachine.config.json` with your new Prismic repo name
5. Start the dev server (runs Vite + Slice Machine concurrently):

   ```bash
   pnpm dev
   ```

6. Push your custom types/slices to Prismic
7. Build your site using slices for complex CMS needs, or custom types for simpler setups

## Scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `pnpm dev`          | Start dev server + Slice Machine |
| `pnpm build`        | Production build                 |
| `pnpm preview`      | Preview production build         |
| `pnpm check`        | Svelte type checking             |
| `pnpm lint`         | Lint with ESLint + Prettier      |
| `pnpm format`       | Auto-format with Prettier        |
| `pnpm test:unit`    | Run unit tests with Vitest       |
| `pnpm test:smoke`   | Run Playwright + axe a11y checks |
| `pnpm slicemachine` | Start Slice Machine UI           |

## Project Structure

```text
src/
├── lib/
│   ├── assets/          # Icons, images, placeholders
│   ├── components/      # Reusable Svelte components
│   ├── utils/           # Utility functions
│   └── prismicio.js     # Prismic client config
├── routes/              # SvelteKit routes + Prismic preview
├── params/              # Route param matchers
└── app.css              # Global styles (Tailwind)
customtypes/             # Prismic custom type definitions
docs/recipes/            # Opt-in patterns needing extra dependencies
static/                  # Static assets (favicon; robots.txt is a prerendered route)
```
