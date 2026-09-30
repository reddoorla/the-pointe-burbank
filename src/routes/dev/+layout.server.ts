import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Development scaffolding — axe/Lighthouse fixtures, the animation harness and
// the matching twin — must not be reachable on a deployed site (#717). A LAYOUT
// guard is the right altitude: this `load` runs for every current and future
// child of /dev, which a per-route guard does not cover.
//
// Three builds, and each direction matters:
//
//   - dev (`vite dev`): `dev === true`, the guard is inert, every fixture
//     answers 200. The fleet lighthouse audit, the shared Playwright config
//     (whose webServer readiness probe IS /dev/a11y-fixtures) and the match
//     harness (localhost:5173) all serve these routes from the dev server.
//
//   - the a11y gate's build: `reddoor-maint audit --only a11y` scans the
//     fixtures on a production build it makes itself, served by `vite preview`,
//     because under dev axe usually ran before the page hydrated
//     (reddoor-maintenance#948). It builds with VITE_REDDOOR_GATE_FIXTURES=1,
//     and only that build lets the fixtures through. Vite replaces
//     `import.meta.env.VITE_*` AT BUILD TIME, so a server built without it
//     cannot be switched on by setting the variable at runtime;
//     svelte.config.js refuses the variable on Netlify.
//
//   - production (`vite build` + `vite preview`, or Netlify): `dev === false`,
//     the flag is absent, every /dev/* route 404s through this site's own
//     +error.svelte.
//
// Keep the literal `if (!dev)` with the refusal inside its own branch:
// reddoor-maintenance's launch pre-flight recognises the guard by exactly that
// shape.
//
// `prerender = false` is load-bearing, not decoration. Without it these routes
// inherit the root layout's `prerender = "auto"`, the build-time crawler renders
// them with `dev` already false, and the guard's 404 fails the BUILD instead of
// the request.
export const prerender = false;

export function load() {
  if (!dev) {
    if (import.meta.env.VITE_REDDOOR_GATE_FIXTURES !== "1") error(404, { message: "Not found" });
  }
}
