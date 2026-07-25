import {
  fade as svelteFade,
  fly as svelteFly,
  slide as svelteSlide,
} from "svelte/transition";
import type {
  FadeParams,
  FlyParams,
  SlideParams,
  TransitionConfig,
} from "svelte/transition";

// Svelte's JS-driven transitions (Web Animations API) do NOT honor the CSS
// `prefers-reduced-motion` reset in app.css. These thin wrappers do: when the
// user asks for reduced motion we collapse duration + delay to 0 so the element
// still appears/disappears, just without the animation. Components import
// fade/fly/slide from here instead of "svelte/transition".
//
// Checked per transition run (not at module load), so an OS-level toggle takes
// effect on the next open/close. `matchMedia` is guarded for SSR and jsdom.
/** Live reduced-motion query, exported for components whose BEHAVIOR (not just
 *  animation) changes under reduced motion — e.g. PreNavTransition skips its
 *  artificial pre-navigation delay entirely. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function fade(node: Element, params: FadeParams = {}): TransitionConfig {
  return svelteFade(
    node,
    prefersReducedMotion() ? { ...params, duration: 0, delay: 0 } : params,
  );
}

export function fly(node: Element, params: FlyParams = {}): TransitionConfig {
  return svelteFly(
    node,
    prefersReducedMotion() ? { ...params, duration: 0, delay: 0 } : params,
  );
}

export function slide(
  node: Element,
  params: SlideParams = {},
): TransitionConfig {
  return svelteSlide(
    node,
    prefersReducedMotion() ? { ...params, duration: 0, delay: 0 } : params,
  );
}
