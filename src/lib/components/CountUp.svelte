<script lang="ts">
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { prefersReducedMotion } from "$lib/transitions";
  import { formatCount, type CountFormat } from "$lib/utils/countup";

  interface Props extends CountFormat {
    /** The number to count up to. */
    value: number;
    /** Where the count starts (default 0). */
    startValue?: number;
    /** Tween length in ms (default 2000); ignored under reduced motion. Keep
     *  it ≤5000: a longer auto-animation with no pause control risks WCAG
     *  2.2.2 (dev builds warn past that). */
    duration?: number;
    /** Start when scrolled into view (default). false = start on mount. */
    startOnVisible?: boolean;
    /** Animate only the first time it enters view (default true) — the fix
     *  for the fleet bug where re-scrolling restarted the count. */
    once?: boolean;
    /** Accessible text; defaults to the formatted final value. */
    label?: string;
    class?: string;
  }

  let {
    value,
    startValue = 0,
    duration = 2000,
    decimals = 0,
    prefix = "",
    suffix = "",
    useGrouping = true,
    locale,
    startOnVisible = true,
    once = true,
    label,
    class: passedClasses = "",
  }: Props = $props();

  const fmt = $derived<CountFormat>({
    decimals,
    prefix,
    suffix,
    useGrouping,
    locale,
  });
  const finalText = $derived(formatCount(value, fmt));

  // Starts at startValue, so SSR/no-JS render the start value in the visible
  // (aria-hidden) layer while the sr-only layer always carries the real
  // number for assistive tech and crawlers. startValue/value are config read
  // once at init/trigger — a stat counter's endpoints don't change mid-count.
  // svelte-ignore state_referenced_locally
  const displayed = tweened(startValue, { duration: 0, easing: cubicOut });
  const liveText = $derived(formatCount($displayed, fmt));

  let el: HTMLElement | undefined = $state();

  // A count that auto-animates past 5s with no pause control risks WCAG 2.2.2.
  // Warn in dev rather than clamp (clamping would silently override intent).
  // svelte-ignore state_referenced_locally
  const initialDuration = duration;
  if (import.meta.env.DEV && initialDuration > 5000) {
    console.warn(
      `<CountUp> duration ${initialDuration}ms exceeds 5s — a long auto-animation with no pause control risks WCAG 2.2.2 (Pause, Stop, Hide). Consider ≤5000ms.`,
    );
  }

  // Checked live at call time so an OS reduced-motion toggle is honored:
  // jump straight to the final value with no animation.
  function run() {
    displayed.set(value, { duration: prefersReducedMotion() ? 0 : duration });
  }

  onMount(() => {
    if (prefersReducedMotion() || !startOnVisible) {
      run();
      return;
    }
    if (typeof IntersectionObserver !== "function") {
      run();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            if (once) io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    if (el) io.observe(el);
    return () => io.disconnect();
  });
</script>

<span bind:this={el} class={passedClasses}>
  <span aria-hidden="true">{liveText}</span>
  <!-- select-none so copying the visible number doesn't also pull this
       screen-reader duplicate ("1,234+1,234+"). -->
  <span class="sr-only select-none">{label ?? finalText}</span>
</span>
