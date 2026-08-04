import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hydrateCarousels } from "./carousel";
import template from "./frozen/home.html?raw";

// The freeze's own shape, reproduced exactly: an active slide carrying
// display:block/opacity:1 and inactive ones carrying display:none/opacity:0,
// with the arrows OUTSIDE the track and keyed to the block id.
//
// The parked `translateX(-N00%)` matters as much as the display flags — the
// track is `overflow:hidden`, so a slide shown without its transform cleared
// renders N widths to the left of it. Slide 0 sits at 0%, which is why it was
// the only one that ever looked right.
const parkedAt = (i: number) =>
  i === 0 ? "translateX(0%)" : `translateX(-${i}00%)`;

// Each caption carries the double-rule mark that `restyleCarouselCaptions`
// inserts, because redrawing it on every change is part of the contract now.
const slide = (i: number, active: boolean) =>
  `<div class="block-subcontent cagriditem top grid-1 " style="width: 100%; ` +
  `transform: ${parkedAt(i)}; ${active ? "" : "pointer-events: none; "}` +
  `opacity: ${active ? 1 : 0};display:${active ? "block" : "none"}">` +
  `<div id="page-block-8-item-${i}"><span class="rd-rule-box">` +
  `<svg class="rd-rule"><line/><line/></svg></span>` +
  `<h5>caption ${i}</h5></div></div>`;

const markup = (slides = 3) =>
  `<section id="page-block-8" class="blocks0">` +
  `<div class="block-grid-container cagrid caslider" data-columns="1">` +
  Array.from({ length: slides }, (_, i) => slide(i, i === 0)).join("") +
  `</div>` +
  `<button id="page-block-8-left" aria-label="left arrow"></button>` +
  `<button id="page-block-8-right" aria-label="right arrow"></button>` +
  `</section>`;

const FADE_MS = 600;
const AUTO_MS = 7000;

const els = () => [...document.querySelectorAll<HTMLElement>(".cagriditem")];
const visible = () => els().map((e) => e.style.display);
const shownIndex = () => visible().findIndex((d) => d === "block");
const click = (id: string) => document.getElementById(id)!.click();
const marks = (i: number) =>
  [...els()[i].querySelectorAll(".rd-rule")].map((m) =>
    m.getAttribute("class"),
  );

/** Run the cross-fade to completion: one frame to arm, then its timeout. */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(FADE_MS + 20);
};

let reducedMotion = false;
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  // jsdom has no media-query engine; the module only ever asks this one thing.
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: /prefers-reduced-motion:\s*reduce/.test(q) && reducedMotion,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  document.body.innerHTML = markup();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const hydrate = () => {
  stop = hydrateCarousels();
  return stop;
};

describe("hydrateCarousels", () => {
  it("leaves the freeze's visible slide showing on load", () => {
    hydrate();
    expect(shownIndex()).toBe(0);
    expect(visible()).toEqual(["block", "none", "none"]);
  });

  it("starts from whichever slide the freeze left visible, not slide 0", () => {
    // A re-freeze settling on a different frame must not make the page jump.
    document.body.innerHTML = markup();
    const slides = els();
    slides[0].style.display = "none";
    slides[2].style.display = "block";
    hydrate();
    expect(shownIndex()).toBe(2);
  });

  it("advances and goes back one slide at a time", async () => {
    hydrate();
    click("page-block-8-right");
    await settle();
    expect(shownIndex()).toBe(1);
    click("page-block-8-right");
    await settle();
    expect(shownIndex()).toBe(2);
    click("page-block-8-left");
    await settle();
    expect(shownIndex()).toBe(1);
  });

  it("wraps around in both directions", async () => {
    hydrate();
    click("page-block-8-left");
    await settle();
    expect(shownIndex()).toBe(2); // 0 -> back -> last
    click("page-block-8-right");
    await settle();
    expect(shownIndex()).toBe(0); // last -> forward -> first
  });

  it("shows exactly one slide once each change has settled", async () => {
    hydrate();
    for (let i = 0; i < 7; i++) {
      expect(visible().filter((d) => d === "block")).toHaveLength(1);
      click("page-block-8-right");
      await settle();
    }
  });

  it("brings the shown slide into the track instead of leaving it parked", async () => {
    // The bug this guards: `show()` used to toggle display and opacity only, so
    // slide 1 became visible while still translated one full width left of an
    // `overflow:hidden` track. The arrows worked; the carousel looked dead.
    hydrate();
    click("page-block-8-right");
    await settle();
    expect(els()[1].style.transform).toBe("translateX(0%)");
    expect(els()[1].style.display).toBe("block");
  });

  it("parks a slide back where the freeze had it when it goes inactive", async () => {
    hydrate();
    click("page-block-8-right"); // 0 -> 1
    await settle();
    click("page-block-8-right"); // 1 -> 2
    await settle();
    expect(els().map((e) => e.style.transform)).toEqual([
      "translateX(0%)", // slide 0's own parked value happens to be 0%
      "translateX(-100%)",
      "translateX(0%)", // the active one
    ]);
  });

  it("keeps exactly one slide un-parked through a full cycle", async () => {
    hydrate();
    for (let i = 0; i < 7; i++) {
      const shown = els().filter((e) => e.style.display === "block");
      expect(shown).toHaveLength(1);
      expect(shown[0].style.transform).toBe("translateX(0%)");
      click("page-block-8-right");
      await settle();
    }
  });

  it("keeps hidden slides out of the a11y tree and off the tab order", async () => {
    hydrate();
    click("page-block-8-right");
    await settle();
    expect(els().map((e) => e.getAttribute("aria-hidden"))).toEqual([
      "true",
      "false",
      "true",
    ]);
    // display:none is what actually removes them; aria-hidden states it too.
    expect(els()[0].style.display).toBe("none");
    expect(els()[0].style.pointerEvents).toBe("none");
  });

  it("names the track as a carousel for screen readers", () => {
    hydrate();
    const track = document.querySelector(".caslider")!;
    expect(track.getAttribute("aria-roledescription")).toBe("carousel");
    expect(track.getAttribute("aria-label")).toBeTruthy();
  });

  it("cleanup unbinds the arrows and stops the auto-advance", async () => {
    const halt = hydrate();
    click("page-block-8-right");
    await settle();
    expect(shownIndex()).toBe(1);
    halt();
    stop = undefined;
    click("page-block-8-right");
    await settle();
    expect(shownIndex()).toBe(1);
    await vi.advanceTimersByTimeAsync(AUTO_MS * 2);
    expect(shownIndex()).toBe(1);
  });

  it("ignores a slider the export never filled", () => {
    // The artifact carries a second .caslider with no slides; giving it working
    // arrows that cycle one frame would be worse than leaving it inert.
    document.body.innerHTML =
      `<section id="page-block-99"><div class="cagrid caslider">` +
      slide(0, true) +
      `</div><button id="page-block-99-right"></button></section>`;
    hydrate();
    expect(
      document.querySelector(".caslider")!.getAttribute("aria-roledescription"),
    ).toBeNull();
  });

  it("counts only direct children as slides, not nested grids", async () => {
    const nested =
      `<section id="page-block-8"><div class="cagrid caslider">` +
      slide(0, true) +
      slide(1, false) +
      `</div><button id="page-block-8-right"></button></section>`;
    document.body.innerHTML = nested;
    // a slide's own content carries further .cagriditem descendants
    document
      .querySelectorAll(".cagriditem")[0]
      .insertAdjacentHTML("beforeend", '<div class="cagriditem">inner</div>');
    hydrate();
    click("page-block-8-right");
    await settle();
    const top = [
      ...document.querySelector(".caslider")!.children,
    ] as HTMLElement[];
    expect(top.filter((e) => e.style.display === "block")).toHaveLength(1);
    expect(top[1].style.display).toBe("block");
  });
});

describe("the cross-fade", () => {
  it("shows both slides at once WHILE fading, then only the new one", async () => {
    hydrate();
    click("page-block-8-right");
    // Mid-fade: the outgoing slide is still painted, which is what makes it a
    // cross-fade rather than a cut through the page background.
    await vi.advanceTimersByTimeAsync(FADE_MS / 2);
    expect(visible().filter((d) => d === "block")).toHaveLength(2);
    await settle();
    expect(visible()).toEqual(["none", "block", "none"]);
  });

  it("dissolves over an OPAQUE incoming slide, so nothing shows through", async () => {
    // Both slides fading at once looks equivalent and is not: two opacities
    // meeting at .5 composite to .75, letting a quarter of the page's light
    // background through the middle of every transition. Only the outgoing
    // slide may animate.
    hydrate();
    click("page-block-8-right");
    await vi.advanceTimersByTimeAsync(FADE_MS / 2);
    expect(els()[1].style.opacity).toBe("1");
    expect(els()[1].style.transition).toBe("");
    expect(els()[0].style.transition).toContain("opacity");
  });

  it("fades on the site's own curve, not the CSS default", async () => {
    hydrate();
    click("page-block-8-right");
    await vi.advanceTimersByTimeAsync(FADE_MS / 2);
    // The same curve the rule marks and the body-link underlines draw on.
    expect(els()[0].style.transition).toContain("cubic-bezier(.2,.55,.88,.95)");
  });

  it("lifts the outgoing slide out of flow so the track cannot grow", async () => {
    // Two in-flow slides would double the track's width and shove the layout;
    // absolute positioning is what lets them overlap instead.
    hydrate();
    click("page-block-8-right");
    await vi.advanceTimersByTimeAsync(FADE_MS / 2);
    expect(els()[0].style.position).toBe("absolute");
    // …and it stays in view for the whole fade rather than teleporting to its
    // parked position the instant the change starts.
    expect(els()[0].style.transform).toBe("translateX(0%)");
    await settle();
    expect(els()[0].style.position).toBe("");
    expect(els()[0].style.transform).toBe("translateX(0%)");
  });

  it("hands back every property it borrowed", async () => {
    hydrate();
    click("page-block-8-right");
    await settle();
    const gone = els()[0];
    expect(gone.style.position).toBe("");
    expect(gone.style.inset).toBe("");
    expect(gone.style.zIndex).toBe("");
    expect(gone.style.transition).toBe("");
  });

  it("abandons a fade that a second click interrupts", async () => {
    hydrate();
    click("page-block-8-right");
    await vi.advanceTimersByTimeAsync(FADE_MS / 3);
    click("page-block-8-right");
    await settle();
    // The first fade's cleanup must not fire over the second one's result.
    expect(visible()).toEqual(["none", "none", "block"]);
    expect(els()[2].style.transform).toBe("translateX(0%)");
  });
});

describe("preloading the offscreen photographs", () => {
  // A `display:none` element never fetches its background-image, so without a
  // preload the request for the next slide starts INSIDE the cross-fade meant
  // to reveal it — measured on the preview, the response landed 20ms after the
  // fade began, so the fade ran against an empty box and the photo popped in
  // afterwards. That reads as a cut with a flash, not a cross-fade.
  const bg = (i: number) => `https://images.prismic.io/slide-${i}.jpg`;

  const withPhotos = () => {
    document.body.innerHTML = markup();
    els().forEach((slide, i) => {
      slide.querySelector<HTMLElement>("div")!.style.backgroundImage =
        `url("${bg(i)}")`;
    });
  };

  let requested: string[];
  /** Images stay un-loaded until `arrive()` is called, so the wait is testable. */
  let inFlight: Array<() => void>;

  beforeEach(() => {
    requested = [];
    inFlight = [];
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(v: string) {
        requested.push(v);
        inFlight.push(() => this.onload?.());
      }
      // Real browsers resolve this once the bitmap exists; here `onload` is the
      // only channel, so this never settles and cannot short-circuit the test.
      decode() {
        return new Promise<void>(() => {});
      }
    }
    vi.stubGlobal("Image", FakeImage);
    withPhotos();
  });

  const arrive = async () => {
    for (const fire of inFlight.splice(0)) fire();
    await vi.advanceTimersByTimeAsync(FADE_MS + 40);
  };

  it("requests every slide's photograph, not just the visible one", async () => {
    hydrate();
    await vi.advanceTimersByTimeAsync(10);
    expect(requested).toEqual([bg(0), bg(1), bg(2)]);
  });

  it("has them in flight long before the first auto-advance", async () => {
    hydrate();
    await vi.advanceTimersByTimeAsync(10);
    const early = requested.length;
    await vi.advanceTimersByTimeAsync(AUTO_MS);
    // Nothing new was needed at the moment the slide actually changed.
    expect(early).toBe(3);
    expect(requested).toHaveLength(3);
  });

  it("does not fire if the cleanup runs first", async () => {
    const halt = hydrate();
    halt();
    stop = undefined;
    await vi.advanceTimersByTimeAsync(50);
    expect(requested).toEqual([]);
  });

  it("skips a slider with no background images at all", async () => {
    document.body.innerHTML = markup();
    hydrate();
    await vi.advanceTimersByTimeAsync(10);
    expect(requested).toEqual([]);
  });

  // Preloading only WARMS the cache; it gates nothing. Under 1.6Mbps throttling
  // the fade still ran its full 600ms with every image reporting
  // `complete === false`, dissolving the old photo away to reveal an opaque but
  // empty box — i.e. the page's own light background. The white flash.
  describe("and holding the change until the picture exists", () => {
    it("does not touch the slides while the photograph is still coming", async () => {
      hydrate();
      await vi.advanceTimersByTimeAsync(10);
      click("page-block-8-right");
      await vi.advanceTimersByTimeAsync(FADE_MS * 2);
      // Still showing what it was showing: nothing has faded to an empty box.
      expect(visible()).toEqual(["block", "none", "none"]);
      expect(els()[0].style.position).toBe("");
    });

    it("runs the dissolve the moment the photograph lands", async () => {
      hydrate();
      await vi.advanceTimersByTimeAsync(10);
      click("page-block-8-right");
      await vi.advanceTimersByTimeAsync(200);
      expect(shownIndex()).toBe(0);
      await arrive();
      expect(visible()).toEqual(["none", "block", "none"]);
    });

    it("gives up after the cap so a broken image cannot freeze it", async () => {
      hydrate();
      await vi.advanceTimersByTimeAsync(10);
      click("page-block-8-right");
      // The image never arrives.
      await vi.advanceTimersByTimeAsync(4000 + FADE_MS + 40);
      expect(visible()).toEqual(["none", "block", "none"]);
    });

    it("re-targets from the slide the reader can SEE, not a pending one", async () => {
      // Two clicks while nothing has moved should not race two slides ahead of
      // what is on screen — the second supersedes the first.
      hydrate();
      await vi.advanceTimersByTimeAsync(10);
      click("page-block-8-right");
      await vi.advanceTimersByTimeAsync(100);
      click("page-block-8-right");
      await arrive();
      expect(shownIndex()).toBe(1);
    });

    it("abandons a pending change that a newer one superseded", async () => {
      hydrate();
      await vi.advanceTimersByTimeAsync(10);
      click("page-block-8-right"); // waiting on slide 1
      await vi.advanceTimersByTimeAsync(100);
      click("page-block-8-left"); // supersedes: now waiting on slide 2
      await arrive();
      expect(shownIndex()).toBe(2);
      expect(visible().filter((d) => d === "block")).toHaveLength(1);
    });
  });
});

describe("the caption's rule mark", () => {
  it("re-arms on the arriving slide and draws once the fade is done", async () => {
    hydrate();
    click("page-block-8-right");
    // Armed immediately, so the mark is hidden for the whole fade rather than
    // sitting there finished while the photograph arrives.
    expect(marks(1)).toEqual(["rd-rule rd-fx-wait"]);
    await settle();
    expect(marks(1)).toEqual(["rd-rule rd-fx-run"]);
  });

  it("redraws every time, not just the first visit to a slide", async () => {
    hydrate();
    for (const _ of [0, 1, 2]) {
      click("page-block-8-right");
      await settle();
    }
    click("page-block-8-right"); // back to slide 1, seen before
    expect(marks(1)).toEqual(["rd-rule rd-fx-wait"]);
    await settle();
    expect(marks(1)).toEqual(["rd-rule rd-fx-run"]);
  });

  it("leaves the first slide's mark to the page's own scroll reveal", () => {
    // Hydration must not draw anything: the carousel may be far below the fold,
    // and FrozenPage's IntersectionObserver owns that first reveal.
    hydrate();
    expect(marks(0)).toEqual(["rd-rule"]);
  });
});

describe("the auto-advance", () => {
  it("moves on by itself every 7 seconds", async () => {
    hydrate();
    await vi.advanceTimersByTimeAsync(AUTO_MS - 100);
    expect(shownIndex()).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    await settle();
    expect(shownIndex()).toBe(1);
    await vi.advanceTimersByTimeAsync(AUTO_MS);
    await settle();
    expect(shownIndex()).toBe(2);
  });

  it("inherits the direction of the last click", async () => {
    hydrate();
    click("page-block-8-left"); // 0 -> 2, and the drift is now backwards
    await settle();
    expect(shownIndex()).toBe(2);
    await vi.advanceTimersByTimeAsync(AUTO_MS);
    await settle();
    expect(shownIndex()).toBe(1);
    await vi.advanceTimersByTimeAsync(AUTO_MS);
    await settle();
    expect(shownIndex()).toBe(0);
  });

  it("restarts the countdown from zero on a click", async () => {
    hydrate();
    await vi.advanceTimersByTimeAsync(AUTO_MS - 500);
    click("page-block-8-right"); // 0 -> 1, countdown resets here
    await settle();
    expect(shownIndex()).toBe(1);
    // The 500ms left of the original interval must not still fire.
    await vi.advanceTimersByTimeAsync(AUTO_MS - 1000);
    expect(shownIndex()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(shownIndex()).toBe(2);
  });

  it("holds while the pointer is over the section", async () => {
    hydrate();
    const section = document.getElementById("page-block-8")!;
    section.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(AUTO_MS * 2);
    expect(shownIndex()).toBe(0);
    section.dispatchEvent(new Event("mouseleave"));
    await vi.advanceTimersByTimeAsync(AUTO_MS);
    await settle();
    expect(shownIndex()).toBe(1);
  });

  it("holds while focus is inside the section", async () => {
    hydrate();
    const section = document.getElementById("page-block-8")!;
    section.dispatchEvent(new Event("focusin"));
    await vi.advanceTimersByTimeAsync(AUTO_MS * 2);
    expect(shownIndex()).toBe(0);
    section.dispatchEvent(new Event("focusout"));
    await vi.advanceTimersByTimeAsync(AUTO_MS);
    await settle();
    expect(shownIndex()).toBe(1);
  });
});

describe("under prefers-reduced-motion", () => {
  beforeEach(() => {
    reducedMotion = true;
  });

  it("cuts between slides with no overlap", async () => {
    hydrate();
    click("page-block-8-right");
    // No frame where two slides are painted, and no pending timeout.
    expect(visible()).toEqual(["none", "block", "none"]);
    expect(els()[0].style.position).toBe("");
    expect(els()[0].style.transform).toBe("translateX(0%)");
  });

  it("leaves the rule mark finished rather than redrawing it", async () => {
    hydrate();
    click("page-block-8-right");
    await settle();
    expect(marks(1)).toEqual(["rd-rule"]);
  });

  it("never advances on its own", async () => {
    hydrate();
    await vi.advanceTimersByTimeAsync(AUTO_MS * 3);
    expect(shownIndex()).toBe(0);
  });

  it("still lets the arrows work", async () => {
    hydrate();
    click("page-block-8-right");
    expect(shownIndex()).toBe(1);
    click("page-block-8-left");
    expect(shownIndex()).toBe(0);
  });
});

describe("the artifact the hydration depends on", () => {
  it("ships three Lush Haven slides and both arrow buttons", () => {
    // If a re-freeze renames these, hydrateCarousels silently binds nothing —
    // so the shape is asserted against the real committed template.
    const section = template.slice(
      template.indexOf('<section id="page-block-8"'),
    );
    const region = section.slice(0, section.indexOf("</section>"));
    expect(region).toContain("caslider");
    expect([
      ...region.matchAll(/class="block-subcontent cagriditem/g),
    ]).toHaveLength(3);
    expect(template).toContain('id="page-block-8-left"');
    expect(template).toContain('id="page-block-8-right"');
  });

  it("settles exactly one slide visible, the rest display:none", () => {
    const section = template.slice(
      template.indexOf('<section id="page-block-8"'),
    );
    const region = section.slice(0, section.indexOf("</section>"));
    const styles = [
      ...region.matchAll(
        /<div class="block-subcontent cagriditem[^"]*"([^>]*)>/g,
      ),
    ].map((m) => m[1]);
    expect(styles.filter((s) => /display:block/.test(s))).toHaveLength(1);
    expect(styles.filter((s) => /display:none/.test(s))).toHaveLength(2);
  });

  it("parks its hidden slides off to the left, which is why they must be moved", () => {
    // The premise of `show()`'s transform handling. If a re-freeze ever settles
    // with every slide at 0%, restoring the parked value becomes a no-op and
    // this test says so before anyone concludes the transform code is dead.
    const section = template.slice(
      template.indexOf('<section id="page-block-8"'),
    );
    const region = section.slice(0, section.indexOf("</section>"));
    const transforms = [
      ...region.matchAll(
        /<div class="block-subcontent cagriditem[^"]*"[^>]*?transform:\s*(translateX\([^)]*\))/g,
      ),
    ].map((m) => m[1].replace(/\s/g, ""));
    expect(transforms).toEqual([
      "translateX(0%)",
      "translateX(-100%)",
      "translateX(-200%)",
    ]);
  });
});
