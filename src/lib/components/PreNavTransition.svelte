<!--
  PreNavTransition — opt-in fade-to-black BEFORE navigation. Cancels the nav,
  fades the overlay in for `duration` ms, then re-issues the navigation, so
  the outgoing page is fully covered before it swaps (unlike TransitionOverlay,
  which only appears once navigation has already started — use one or the
  other, not both).

  Usage (root +layout.svelte):
    <PreNavTransition />
    <PreNavTransition duration={300} holdDuration={300} class="…" />

  Interception rules live in $lib/utils/preNavIntercept — back/forward,
  external URLs, hash/query-only navs and reduced-motion users all navigate
  immediately with no overlay and no delay. Rapid clicks mid-fade re-defer to
  the newest target. Scroll behavior around navigation is the root
  layout's job (see instantNavScroll), not this component's.
-->
<script lang="ts">
  import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
  import { fade, prefersReducedMotion } from "$lib/transitions";
  import { shouldIntercept } from "$lib/utils/preNavIntercept";

  interface Props {
    /** ms the overlay fades in before the deferred navigation is issued. */
    duration?: number;
    /** ms the overlay stays up after navigation so the new page paints under it. */
    holdDuration?: number;
    class?: string;
  }

  let {
    duration = 400,
    holdDuration = 400,
    class: passedClasses = "h-screen w-screen fixed z-50 bg-black top-0 left-0",
  }: Props = $props();

  let isTransitioning = $state(false);
  let pendingHref: string | undefined;
  let navTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  beforeNavigate((nav) => {
    const to = nav.to;
    if (
      !to ||
      !shouldIntercept(nav, {
        pendingHref,
        reducedMotion: prefersReducedMotion(),
      })
    ) {
      // Some OTHER navigation is proceeding natively (popstate/back, external,
      // hash, our own re-issued goto). A still-pending deferred goto must not
      // fire after it — pressing Back mid-fade would otherwise be yanked
      // forward to the stale target `duration` ms later.
      clearTimeout(navTimer);
      pendingHref = undefined;
      return;
    }

    // First navigation, or a new click mid-transition: (re-)defer to the
    // newest destination so rapid clicks land on the last one clicked.
    nav.cancel();
    isTransitioning = true;
    pendingHref = to.url.href;
    clearTimeout(navTimer);
    // A click during the post-nav hold must not let the stale cleanup hide
    // the overlay (and wipe pendingHref) mid-fade.
    clearTimeout(clearTimer);
    navTimer = setTimeout(() => {
      // If the navigation errors (afterNavigate never fires), clear the
      // overlay so it can't stick.
      goto(to.url).catch(() => {
        isTransitioning = false;
        pendingHref = undefined;
      });
    }, duration);
  });

  afterNavigate(() => {
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      isTransitioning = false;
      pendingHref = undefined;
    }, holdDuration);
  });

  $effect(() => {
    return () => {
      clearTimeout(navTimer);
      clearTimeout(clearTimer);
    };
  });
</script>

{#if isTransitioning}
  <!-- pointer-events-none so rapid clicks mid-fade still reach links and
       re-defer; decorative, so hidden from assistive tech. -->
  <div
    aria-hidden="true"
    class="pointer-events-none {passedClasses}"
    transition:fade={{ duration }}
  ></div>
{/if}
