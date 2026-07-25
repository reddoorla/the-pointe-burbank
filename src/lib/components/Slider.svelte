<script lang="ts">
  import { useSwipe, type SwipeCustomEvent } from "svelte-gestures";
  import { onMount, type Snippet } from "svelte";
  import { viewport } from "$stores/viewport.svelte";

  interface Props {
    itemCount: number;
    /** Accessible name for the carousel region — say what's inside
     *  ("Customer testimonials"), not "Slider". */
    label: string;
    children: Snippet<[{ index: number }]>;
    /** Slides visible at once from 768px up; mobile is always 1. */
    cardsPerView?: number;
    gap?: string;
    mobileGap?: string;
    /** "slide" translates a track; "fade" cross-dissolves in place
     *  (one slide at a time — cardsPerView is ignored). */
    mode?: "slide" | "fade";
    /** Wrap past the ends. When false, arrows disable at the bounds and
     *  autoplay parks on the last position. */
    loop?: boolean;
    /** Auto-advance every N ms. Off by default. Pauses on hover and hidden
     *  tab; focus entering the carousel stops rotation until the user hits
     *  play again (APG); never runs under prefers-reduced-motion. */
    autoplay?: number;
    /** When arrows are hidden, dots render regardless of showDots so the
     *  carousel always keeps a non-swipe control. */
    showDots?: boolean;
    showArrows?: boolean;
    /** Tailwind duration/easing utilities for the slide/fade movement. */
    transitionClass?: string;
    navigationClass?: string;
    arrowClass?: string;
    pauseClass?: string;
    /** Style the dot visuals (the button hit areas stay 24px+). */
    dotClass?: string;
    activeDotClass?: string;
    class?: string;
  }

  let {
    itemCount,
    label,
    children,
    cardsPerView = 1,
    gap = "14px",
    mobileGap = "6px",
    mode = "slide",
    loop = true,
    autoplay = 0,
    showDots = true,
    showArrows = true,
    transitionClass = "duration-500 ease-in-out",
    navigationClass = "",
    arrowClass = "",
    pauseClass = "",
    dotClass = "bg-gray-500 group-hover:bg-gray-600 group-active:bg-gray-700",
    activeDotClass = "bg-gray-800",
    class: passedClasses = "",
  }: Props = $props();

  let currentSlide = $state(0);
  let hovered = $state(false);
  let pageHidden = $state(false);
  let reducedMotion = $state(false);
  let userPaused = $state(false);

  onMount(() => viewport.subscribe());

  onMount(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mql.matches;
    const onChange = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  });

  onMount(() => {
    pageHidden = document.visibilityState === "hidden";
    const onVisibility = () =>
      (pageHidden = document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  });

  const responsiveCardsPerView = $derived(
    mode === "fade" ? 1 : viewport.width >= 768 ? cardsPerView : 1,
  );

  const maxSlide = $derived(Math.max(0, itemCount - responsiveCardsPerView));
  const currentGap = $derived(viewport.width >= 768 ? gap : mobileGap);

  // Each step advances one slide width plus one gap. With n cards per view
  // a slide is (100% - (n-1)*gap)/n wide, so the step is (100% + gap)/n —
  // the gap term is divided by n too. (Shifting a full gap per step, the
  // fleet formula, overshoots by gap*(n-1)/n per index and clips slides.)
  const translateValue = $derived.by(() => {
    const n = responsiveCardsPerView;
    return `translateX(calc(${currentSlide} * (-100% - ${currentGap}) / ${n}))`;
  });

  // Clamp when a resize (or fade mode) shrinks the reachable range out from
  // under the current index — otherwise the track points at empty space.
  $effect(() => {
    if (currentSlide > maxSlide) currentSlide = maxSlide;
  });

  // Autoplay wants a pause/play control (WCAG 2.2.2) — but only when rotation
  // can actually happen. Under reduced motion it never starts, so the control
  // would be a dead button.
  const autoplayEligible = $derived(
    autoplay > 0 && maxSlide > 0 && !reducedMotion,
  );
  const autoRotating = $derived(
    autoplayEligible && !userPaused && !hovered && !pageHidden,
  );

  // Re-key the interval on swipe navigation so a gesture restarts the full
  // delay instead of racing the in-flight tick. (Click/keyboard nav focuses
  // a control, which stops rotation outright — see onFocusIn.)
  let autoplayEpoch = $state(0);

  $effect(() => {
    if (!autoRotating) return;
    void autoplayEpoch;
    const id = setInterval(() => {
      if (currentSlide < maxSlide) {
        currentSlide++;
      } else if (loop) {
        currentSlide = 0;
      }
    }, autoplay);
    return () => clearInterval(id);
  });

  const nextSlide = () => {
    if (currentSlide < maxSlide) {
      currentSlide++;
    } else if (loop) {
      currentSlide = 0;
    }
    autoplayEpoch++;
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      currentSlide--;
    } else if (loop) {
      currentSlide = maxSlide;
    }
    autoplayEpoch++;
  };

  const goToSlide = (index: number) => {
    currentSlide = Math.min(index, maxSlide);
    autoplayEpoch++;
  };

  const handleSwipe = (e: SwipeCustomEvent) => {
    if (e.detail.direction === "left") nextSlide();
    if (e.detail.direction === "right") prevSlide();
  };

  // Arrow-key nav when one of the carousel's own controls has focus — avoids
  // needing a tabindex on a non-interactive wrapper.
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextSlide();
    }
  };

  // APG: rotation stopped by focus does not resume when focus leaves — only
  // an explicit play press restarts it. Sticky state also can't strand a
  // paused carousel the way a tracked focus-within flag can (no focusout
  // fires when the focused control unmounts).
  const onFocusIn = () => {
    if (autoplayEligible) userPaused = true;
  };

  const arrowsShown = $derived(showArrows && maxSlide > 0);
  const dotsShown = $derived(showDots || !arrowsShown);
  const atStart = $derived(!loop && currentSlide === 0);
  const atEnd = $derived(!loop && currentSlide === maxSlide);

  const slideVisible = (i: number) =>
    i >= currentSlide && i < currentSlide + responsiveCardsPerView;
</script>

<div
  class="relative w-full {passedClasses}"
  role="region"
  aria-roledescription="carousel"
  aria-label={label}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
  onfocusin={onFocusIn}
>
  <div
    class="relative overflow-hidden w-full"
    {...useSwipe(handleSwipe, () => ({
      timeframe: 300,
      minSwipeDistance: 60,
      touchAction: "pan-y",
    }))}
  >
    {#if mode === "slide"}
      <div
        class="flex transition-transform {transitionClass}"
        style="transform: {translateValue}; gap: {currentGap};"
      >
        {#each Array(itemCount) as _, i (i)}
          <div
            class="w-full shrink-0"
            role="group"
            aria-roledescription="slide"
            aria-label="{i + 1} of {itemCount}"
            aria-hidden={slideVisible(i) ? undefined : "true"}
            inert={!slideVisible(i)}
            style={viewport.width >= 768
              ? `width: calc((100% - ${cardsPerView - 1} * ${gap}) / ${cardsPerView});`
              : ""}
          >
            {@render children({ index: i })}
          </div>
        {/each}
      </div>
    {:else}
      <div class="grid">
        {#each Array(itemCount) as _, i (i)}
          <div
            class="col-start-1 row-start-1 transition-opacity {transitionClass} {currentSlide ===
            i
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none'}"
            role="group"
            aria-roledescription="slide"
            aria-label="{i + 1} of {itemCount}"
            aria-hidden={currentSlide === i ? undefined : "true"}
            inert={currentSlide !== i}
          >
            {@render children({ index: i })}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Announce position to screen readers only when the user is driving;
       a rotating carousel announcing every few seconds is noise (APG). -->
  <div
    class="sr-only"
    aria-live={autoRotating ? "off" : "polite"}
    aria-atomic="true"
  >
    {#if responsiveCardsPerView > 1}
      Slides {currentSlide + 1} through {currentSlide + responsiveCardsPerView} of
      {itemCount}
    {:else}
      Slide {currentSlide + 1} of {itemCount}
    {/if}
  </div>

  {#if maxSlide > 0}
    <div class="flex justify-center items-center gap-4 mt-8 {navigationClass}">
      {#if autoplayEligible}
        <!-- First control in the carousel's tab order (APG). -->
        <button
          type="button"
          onclick={() => (userPaused = !userPaused)}
          class="w-8 h-8 rounded-full text-gray-700 hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center {pauseClass}"
          aria-label={userPaused ? "Play slides" : "Pause slides"}
        >
          {#if userPaused}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          {:else}
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          {/if}
        </button>
      {/if}

      {#if arrowsShown}
        <!-- aria-disabled (not disabled) so the bound arrow keeps focus
             instead of dumping the keyboard user back to <body>. -->
        <button
          type="button"
          onclick={prevSlide}
          onkeydown={handleKeydown}
          aria-disabled={atStart ? "true" : undefined}
          class="w-8 h-8 rounded-full text-gray-700 hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:cursor-default {arrowClass}"
          aria-label="Previous slide"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      {/if}

      {#if dotsShown}
        <div class="flex gap-2">
          {#each Array(maxSlide + 1) as _, i (i)}
            <!-- 24px hit target (WCAG 2.5.8); the visual dot is the span. -->
            <button
              type="button"
              onclick={() => goToSlide(i)}
              onkeydown={handleKeydown}
              class="group h-6 min-w-6 flex items-center justify-center {currentSlide ===
              i
                ? 'cursor-default'
                : ''}"
              aria-label="Go to slide {i + 1}"
              aria-current={currentSlide === i ? "true" : undefined}
            >
              <span
                class="h-3 rounded-full group-active:-translate-y-1 transition-all duration-200 {currentSlide ===
                i
                  ? `w-8 ${activeDotClass}`
                  : `w-3 ${dotClass}`}"
              ></span>
            </button>
          {/each}
        </div>
      {/if}

      {#if arrowsShown}
        <button
          type="button"
          onclick={nextSlide}
          onkeydown={handleKeydown}
          aria-disabled={atEnd ? "true" : undefined}
          class="w-8 h-8 rounded-full text-gray-700 hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:cursor-default {arrowClass}"
          aria-label="Next slide"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      {/if}
    </div>
  {/if}
</div>
