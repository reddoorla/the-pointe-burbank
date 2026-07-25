import type { AfterNavigate, BeforeNavigate } from "@sveltejs/kit";

/**
 * Make SvelteKit's own post-navigation scroll INSTANT instead of a visible
 * glide. app.css sets `html { scroll-behavior: smooth }`, which the browser
 * applies to programmatic scrolls too — including kit's scroll-to-top on link
 * navs, its `scrollIntoView` for cross-page `#hash` deep links, and its
 * position restore on back/forward.
 *
 * We never call `scrollTo` ourselves: kit already picks the correct target for
 * every navigation type (top for links, the anchor for hash URLs, the saved
 * position for popstate, unchanged for `data-sveltekit-noscroll`). Scrolling
 * on our own would fight those semantics — an earlier version of this util did
 * exactly that and broke cross-page anchors and noscroll links. Instead:
 * `beforeNavigate` flips scroll-behavior to `auto`, kit performs its scroll
 * un-animated, and `afterNavigate` restores the inline style one frame later.
 *
 * A cancelled navigation leaves `auto` in place until the next completed one —
 * harmless (smooth applies again after it) and self-healing.
 */
export function disableSmoothScroll(_nav: BeforeNavigate): void {
  document.documentElement.style.scrollBehavior = "auto";
}

export function restoreSmoothScroll({ type }: AfterNavigate): void {
  if (type === "enter") return; // first render: browser owns scroll; nothing was disabled
  requestAnimationFrame(() => {
    document.documentElement.style.scrollBehavior = "";
  });
}
