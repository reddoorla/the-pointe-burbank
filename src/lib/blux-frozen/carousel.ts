// Bring the Lush Haven slider back to life.
//
// "don't forget to make this a carousel please :)" — Nicole, Figma node 51:27
// (2026-08-03). The export IS a carousel; the freeze strips Blux's runtime, so
// what ships is the settled first frame with two dead arrow buttons. Everything
// needed is already in the markup — three slides and both controls — so this
// rebinds them rather than building a slider.
//
// The freeze's own settled state defines the contract, and the resting state
// reproduces it exactly rather than inventing one:
//
//   active   style="width:100%;transform:translateX(0%);opacity:1;display:block"
//   inactive style="width:100%;transform:translateX(-N00%);pointer-events:none;
//                   opacity:0;display:none"
//
// TRANSFORM IS PART OF THE CONTRACT. An earlier version of this file toggled
// only `display`/`opacity` and called the baked `translateX(-N00%)` inert track
// geometry. It is not: the track is `overflow:hidden`, so an activated slide
// that keeps its parked transform renders one or two full widths to the LEFT of
// the track and the arrows appear to do nothing. Slide 0 alone looked right,
// because its baked transform is already `translateX(0%)`. Both states are
// therefore written on every change — `translateX(0%)` to bring a slide in, its
// own parked value to put it back.
//
// `display:none` on the inactive slides is load-bearing for accessibility, not
// just paint: it takes their headings and images out of the accessibility tree
// and the tab order, so a screen reader announces one caption rather than all
// three, and nothing off-screen can be tabbed into.
//
// Verified against a DEPLOYED page. Under `vite dev` the committed slot
// defaults point at Blux CloudFront, which `img-src` blocks, so every slide is
// a blank box — a slide parked off-screen and a slide with no image look
// exactly the same. That is how the transform bug shipped. The gate spec now
// asserts each activated slide's box lands inside the track, which is geometry
// and so holds with or without the photographs.
//
// — Motion (2026-08-03, Tucker) —
//
// Three behaviours sit on top of that resting contract:
//
//   1. Slides CROSS-FADE rather than cut. The swap used to be instant: the
//      freeze's `transition` computes to `all 0s`, so setting opacity did
//      nothing over time. Fading the incoming slide up while the outgoing one
//      fades down needs both on screen at once, which the freeze's row layout
//      cannot do — a second in-flow slide doubles the track width. The outgoing
//      slide is therefore lifted to `position:absolute` for the length of the
//      fade only, so it overlays instead of displacing, and every property it
//      borrowed is handed back when the fade ends.
//   2. The caption's rule mark REDRAWS on each change, once the fade has
//      finished, using the same wait/run classes and the same easing as every
//      other mark on the page (see RULE_MARK_CSS). Marks inside a hidden slide
//      were never observed by FrozenPage's IntersectionObserver — a
//      `display:none` element reports a zero rect, so it never counted as
//      below-the-fold — which left slides 2 and 3 showing a finished mark that
//      had never animated.
//   3. The slider AUTO-ADVANCES every 7s, in whichever direction the last
//      arrow click went, and the countdown restarts from zero on every click so
//      a reader is never interrupted mid-look.
//
// All three are motion, so all three are gated on `prefers-reduced-motion`:
// under it the swap is the instant cut it always was, the mark is left finished
// rather than redrawn, and the slider does not advance on its own at all.
//
// WCAG 2.2.2 (Pause, Stop, Hide) applies to the auto-advance, since it moves on
// its own for longer than five seconds. It pauses while the pointer is over the
// section, while focus is anywhere inside it, and while the tab is hidden —
// which covers reading the caption, tabbing to the arrows, and leaving the page
// open in a background tab. A visible pause control would be the belt-and-
// braces version; it is not in the design, so it is not invented here.

/** Arrow button ids are the slider's block id plus these suffixes. */
const ARROWS = { prev: "-left", next: "-right" } as const;

/**
 * Cross-fade duration, ms.
 *
 * Shorter than the .7s rule-mark draw: the fade is the transition between two
 * photographs and wants to be over quickly, while the mark is an accent that
 * reads as deliberate. The mark starts when the fade ends, so the two run
 * back-to-back rather than on top of each other.
 */
const FADE_MS = 450;

/** Auto-advance interval, ms. Nicole's brief: "slow", every 7 seconds. */
const AUTO_MS = 7000;

type Direction = 1 | -1;

interface Slider {
  track: HTMLElement;
  /** The block the arrows and the track both live in — the hover/focus target. */
  section: HTMLElement;
  slides: HTMLElement[];
  /**
   * Each slide's baked `transform`, read once before the first `show()`.
   *
   * Read rather than derived from the index: `-N00%` happens to describe this
   * artifact, but the parked value belongs to the freeze, and restoring exactly
   * what was there cannot drift from it.
   */
  parked: string[];
  prev: HTMLElement | null;
  next: HTMLElement | null;
  /** Which slide is showing. */
  at: number;
  /** Which way the auto-advance goes: the last direction a click asked for. */
  dir: Direction;
  /** Pending fade/draw timeouts, so a fast click cannot land a stale one. */
  timers: number[];
  /** The auto-advance interval, or null while paused or motion-suppressed. */
  auto: number | null;
  /** True while the pointer is over the section or focus is inside it. */
  held: boolean;
  reduced: boolean;
}

/** Put a slide in its resting active or inactive state, with no animation. */
function settle(s: Slider, slide: HTMLElement, i: number, on: boolean): void {
  slide.style.display = on ? "block" : "none";
  slide.style.opacity = on ? "1" : "0";
  // Without this the slide stays parked outside an `overflow:hidden` track
  // and the arrow reads as broken. See the note at the top of the file.
  slide.style.transform = on ? "translateX(0%)" : s.parked[i];
  slide.style.pointerEvents = on ? "" : "none";
  slide.style.transition = "";
  slide.style.position = "";
  slide.style.inset = "";
  slide.style.zIndex = "";
  slide.setAttribute("aria-hidden", on ? "false" : "true");
}

/**
 * Re-arm the caption's rule mark and draw it in.
 *
 * The mark rides the same two classes the scroll reveal uses, so the animation
 * is defined in exactly one place (RULE_MARK_CSS) and a change to the site's
 * draw easing reaches the carousel for free. `rd-fx-wait` carries
 * `transition:none`, so the reset to a hidden mark is instant and only the
 * run back to zero is animated.
 */
function drawMarks(s: Slider, slide: HTMLElement, delay: number): void {
  const marks = [...slide.querySelectorAll<SVGElement>(".rd-rule")];
  if (!marks.length) return;
  for (const m of marks) {
    m.classList.remove("rd-fx-run");
    m.classList.add("rd-fx-wait");
  }
  s.timers.push(
    window.setTimeout(() => {
      for (const m of marks) {
        m.classList.remove("rd-fx-wait");
        m.classList.add("rd-fx-run");
      }
    }, delay),
  );
}

/**
 * Move to `index`, cross-fading from whatever is showing.
 *
 * Written as inline styles because that is where the freeze put them: the
 * artifact's inline `display`/`opacity` beat any stylesheet rule, so a CSS-only
 * approach would need `!important` on both states and would still be fighting
 * the markup. Setting the same properties in the same place keeps one source of
 * truth for which slide is showing.
 */
function show(s: Slider, index: number, animate = false): void {
  const from = s.at;
  s.at = index;

  // Any fade already running is abandoned rather than left to fire late over
  // the slide that replaced it.
  for (const t of s.timers) clearTimeout(t);
  s.timers = [];

  if (!animate || s.reduced || from === index) {
    s.slides.forEach((slide, i) => settle(s, slide, i, i === index));
    return;
  }

  const outgoing = s.slides[from];
  const incoming = s.slides[index];

  // Everything that is neither leaving nor arriving goes straight to rest.
  s.slides.forEach((slide, i) => {
    if (i !== from && i !== index) settle(s, slide, i, false);
  });

  // The outgoing slide leaves the flow so the two can overlap without the
  // track growing to hold both. It keeps translateX(0%) until the fade ends —
  // parking it now would teleport it out of view instead of fading it.
  outgoing.style.position = "absolute";
  outgoing.style.inset = "0";
  outgoing.style.zIndex = "1";
  outgoing.style.pointerEvents = "none";
  outgoing.setAttribute("aria-hidden", "true");

  incoming.style.display = "block";
  incoming.style.transform = "translateX(0%)";
  incoming.style.opacity = "0";
  incoming.style.pointerEvents = "";
  incoming.setAttribute("aria-hidden", "false");

  // A frame between "displayed at 0" and "told to be 1", because a transition
  // has nothing to interpolate from if both happen in the same style recalc.
  requestAnimationFrame(() => {
    outgoing.style.transition = `opacity ${FADE_MS}ms ease`;
    outgoing.style.opacity = "0";
    incoming.style.transition = `opacity ${FADE_MS}ms ease`;
    incoming.style.opacity = "1";
  });

  s.timers.push(
    window.setTimeout(() => {
      settle(s, outgoing, from, false);
      incoming.style.transition = "";
    }, FADE_MS),
  );

  drawMarks(s, incoming, FADE_MS);
}

/** Start (or restart) the auto-advance countdown from zero. */
function resume(s: Slider): void {
  pause(s);
  if (s.reduced || s.held || typeof document === "undefined") return;
  if (document.visibilityState === "hidden") return;
  s.auto = window.setInterval(() => show(s, wrap(s, s.dir), true), AUTO_MS);
}

function pause(s: Slider): void {
  if (s.auto !== null) clearInterval(s.auto);
  s.auto = null;
}

const wrap = (s: Slider, step: number): number =>
  (s.at + step + s.slides.length) % s.slides.length;

/**
 * Find every slider in the page and wire its controls.
 *
 * Returns a cleanup that removes the listeners. Sliders with fewer than two
 * slides are skipped — the artifact carries a second `.caslider` that the
 * export never filled, and giving it working arrows that cycle one frame would
 * be worse than leaving it inert.
 */
export function hydrateCarousels(root: ParentNode = document): () => void {
  const cleanups: (() => void)[] = [];
  const reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const track of root.querySelectorAll<HTMLElement>(".caslider")) {
    // Direct children only: a slide's own content can contain nested grids, and
    // `querySelectorAll` would pull those in as extra "slides".
    const slides = [...track.children].filter((el): el is HTMLElement =>
      el.classList.contains("cagriditem"),
    );
    if (slides.length < 2) continue;

    // The arrows live outside the track (they overlay the section), so they are
    // found from the enclosing block rather than from the track itself.
    const block = track.closest<HTMLElement>("[id^='page-block-']");
    const id = block?.id ?? "";
    const s: Slider = {
      track,
      section: block ?? track,
      slides,
      // Captured before the first `show()`, which overwrites the active one.
      parked: slides.map((el) => el.style.transform),
      prev: document.getElementById(id + ARROWS.prev),
      next: document.getElementById(id + ARROWS.next),
      // Start from whichever slide the freeze left visible rather than assuming
      // the first, so hydration never jumps the page on load.
      at: Math.max(
        0,
        slides.findIndex((el) => el.style.display !== "none"),
      ),
      dir: 1,
      timers: [],
      auto: null,
      held: false,
      reduced,
    };
    if (!s.prev && !s.next) continue;

    // The outgoing slide is absolutely positioned mid-fade, so the track has to
    // be its containing block. Set here rather than in CSS because it is this
    // file's requirement, not the design's.
    track.style.position = "relative";

    for (const [el, step] of [
      [s.prev, -1],
      [s.next, 1],
    ] as const) {
      if (!el) continue;
      const handler = () => {
        // The auto-advance inherits the direction the reader last asked for.
        s.dir = step;
        show(s, wrap(s, step), true);
        // Restart the countdown so a click always buys a full interval.
        resume(s);
      };
      el.addEventListener("click", handler);
      cleanups.push(() => el.removeEventListener("click", handler));
    }

    // WCAG 2.2.2: reading the caption or tabbing to the arrows holds the slide.
    const hold = (held: boolean) => () => {
      s.held = held;
      if (held) pause(s);
      else resume(s);
    };
    for (const [type, held] of [
      ["mouseenter", true],
      ["mouseleave", false],
      ["focusin", true],
      ["focusout", false],
    ] as const) {
      const handler = hold(held);
      s.section.addEventListener(type, handler);
      cleanups.push(() => s.section.removeEventListener(type, handler));
    }

    // A background tab should not burn through the slides unseen.
    const onVisibility = () => (document.hidden ? pause(s) : resume(s));
    document.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() =>
      document.removeEventListener("visibilitychange", onVisibility),
    );

    // The controls are real <button>s carrying aria-labels already, so keyboard
    // activation comes free and no roles are added. What the markup does NOT
    // say is that the three slides are one region whose content swaps, which is
    // the part a screen reader needs to make sense of the buttons.
    track.setAttribute("aria-roledescription", "carousel");
    track.setAttribute("aria-label", "Gallery");
    show(s, s.at);
    resume(s);

    cleanups.push(() => {
      pause(s);
      for (const t of s.timers) clearTimeout(t);
      s.timers = [];
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}
