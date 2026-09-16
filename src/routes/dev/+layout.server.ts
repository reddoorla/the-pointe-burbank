import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// Development scaffolding — axe/Lighthouse fixtures, the animation harness and
// the matching twin — must not be reachable on a deployed site (#717). A LAYOUT
// guard is the right altitude: this `load` runs for every current and future
// child of /dev, which a per-route guard does not cover.
//
// Both directions matter, and breaking the second one is the real risk here:
//
//   - dev (`vite dev`): `dev === true`, the guard is inert, every fixture still
//     answers 200. Every gate that touches these routes serves them from the dev
//     server — the a11y audit and the fleet lighthouse audit (both
//     `npm run vite:dev`), the shared Playwright config (whose webServer
//     readiness probe IS /dev/a11y-fixtures), and the match harness
//     (localhost:5173). A guard that simply refused everywhere would trade this
//     exposure for broken a11y and matching gates across the fleet.
//
//   - production (`vite build` + `vite preview`): `dev === false`, every /dev/*
//     route 404s through this site's own +error.svelte.
//
// `prerender = false` is load-bearing, not decoration. Without it these routes
// inherit the root layout's `prerender = "auto"`, the build-time crawler renders
// them with `dev` already false, and the guard's 404 fails the BUILD instead of
// the request.
export const prerender = false;

export function load() {
  if (!dev) error(404, { message: "Not found" });
}
