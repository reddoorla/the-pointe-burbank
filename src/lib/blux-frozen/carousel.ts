// Bring the Lush Haven slider back to life.
//
// "don't forget to make this a carousel please :)" — Nicole, Figma node 51:27
// (2026-08-03). The export IS a carousel; the freeze strips Blux's runtime, so
// what ships is the settled first frame with two dead arrow buttons. Everything
// needed is already in the markup — three slides and both controls — so this
// rebinds them rather than building a slider.
//
// The freeze's own settled state defines the contract, and this reproduces it
// exactly rather than inventing one:
//
//   active   style="width:100%;transform:translateX(0%);opacity:1;display:block"
//   inactive style="width:100%;transform:translateX(-N00%);pointer-events:none;
//                   opacity:0;display:none"
//
// So the slides do not slide. Blux lays them out as inline-blocks in a
// `white-space:nowrap;overflow:hidden` track and then shows exactly one with
// `display`, which makes the baked `translateX(-N00%)` on the hidden ones inert
// — a leftover of the track geometry, not a position this reads or writes.
// Cross-fading `opacity` is what the settled markup actually describes, and
// touching the transforms would be inventing behaviour the freeze never had.
//
// `display:none` on the inactive slides is load-bearing for accessibility, not
// just paint: it takes their headings and images out of the accessibility tree
// and the tab order, so a screen reader announces one caption rather than all
// three, and nothing off-screen can be tabbed into.

/** Arrow button ids are the slider's block id plus these suffixes. */
const ARROWS = { prev: "-left", next: "-right" } as const;

interface Slider {
  track: HTMLElement;
  slides: HTMLElement[];
  prev: HTMLElement | null;
  next: HTMLElement | null;
}

/**
 * Apply the freeze's own active/inactive styling to each slide.
 *
 * Written as inline styles because that is where the freeze put them: the
 * artifact's inline `display`/`opacity` beat any stylesheet rule, so a CSS-only
 * approach would need `!important` on both states and would still be fighting
 * the markup. Setting the same properties in the same place keeps one source of
 * truth for which slide is showing.
 */
function show(s: Slider, index: number): void {
  s.slides.forEach((slide, i) => {
    const on = i === index;
    slide.style.display = on ? "block" : "none";
    slide.style.opacity = on ? "1" : "0";
    slide.style.pointerEvents = on ? "" : "none";
    slide.setAttribute("aria-hidden", on ? "false" : "true");
  });
}

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
      slides,
      prev: document.getElementById(id + ARROWS.prev),
      next: document.getElementById(id + ARROWS.next),
    };
    if (!s.prev && !s.next) continue;

    // Start from whichever slide the freeze left visible rather than assuming
    // the first, so hydration never jumps the page on load.
    let at = Math.max(
      0,
      slides.findIndex((el) => el.style.display !== "none"),
    );
    const go = (step: number) => () => {
      at = (at + step + slides.length) % slides.length;
      show(s, at);
    };

    for (const [el, step] of [
      [s.prev, -1],
      [s.next, 1],
    ] as const) {
      if (!el) continue;
      const handler = go(step);
      el.addEventListener("click", handler);
      cleanups.push(() => el.removeEventListener("click", handler));
    }

    // The controls are real <button>s carrying aria-labels already, so keyboard
    // activation comes free and no roles are added. What the markup does NOT
    // say is that the three slides are one region whose content swaps, which is
    // the part a screen reader needs to make sense of the buttons.
    track.setAttribute("aria-roledescription", "carousel");
    track.setAttribute("aria-label", "Gallery");
    show(s, at);
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}
