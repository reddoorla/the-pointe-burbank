import { describe, it, expect, beforeEach } from "vitest";
import { hydrateCarousels } from "./carousel";
import template from "./frozen/home.html?raw";

// The freeze's own shape, reproduced exactly: an active slide carrying
// display:block/opacity:1 and inactive ones carrying display:none/opacity:0,
// with the arrows OUTSIDE the track and keyed to the block id.
const slide = (i: number, active: boolean) =>
  `<div class="block-subcontent cagriditem top grid-1 " style="width: 100%; ` +
  `transform: translateX(-${i}00%); ${active ? "" : "pointer-events: none; "}` +
  `opacity: ${active ? 1 : 0};display:${active ? "block" : "none"}">` +
  `<div id="page-block-8-item-${i}"><h5>caption ${i}</h5></div></div>`;

const markup = (slides = 3) =>
  `<section id="page-block-8" class="blocks0">` +
  `<div class="block-grid-container cagrid caslider" data-columns="1">` +
  Array.from({ length: slides }, (_, i) => slide(i, i === 0)).join("") +
  `</div>` +
  `<button id="page-block-8-left" aria-label="left arrow"></button>` +
  `<button id="page-block-8-right" aria-label="right arrow"></button>` +
  `</section>`;

const visible = () =>
  [...document.querySelectorAll<HTMLElement>(".cagriditem")].map(
    (e) => e.style.display,
  );
const shownIndex = () => visible().findIndex((d) => d === "block");
const click = (id: string) => document.getElementById(id)!.click();

describe("hydrateCarousels", () => {
  beforeEach(() => {
    document.body.innerHTML = markup();
  });

  it("leaves the freeze's visible slide showing on load", () => {
    hydrateCarousels();
    expect(shownIndex()).toBe(0);
    expect(visible()).toEqual(["block", "none", "none"]);
  });

  it("starts from whichever slide the freeze left visible, not slide 0", () => {
    // A re-freeze settling on a different frame must not make the page jump.
    document.body.innerHTML = markup();
    const slides = [...document.querySelectorAll<HTMLElement>(".cagriditem")];
    slides[0].style.display = "none";
    slides[2].style.display = "block";
    hydrateCarousels();
    expect(shownIndex()).toBe(2);
  });

  it("advances and goes back one slide at a time", () => {
    hydrateCarousels();
    click("page-block-8-right");
    expect(shownIndex()).toBe(1);
    click("page-block-8-right");
    expect(shownIndex()).toBe(2);
    click("page-block-8-left");
    expect(shownIndex()).toBe(1);
  });

  it("wraps around in both directions", () => {
    hydrateCarousels();
    click("page-block-8-left");
    expect(shownIndex()).toBe(2); // 0 -> back -> last
    click("page-block-8-right");
    expect(shownIndex()).toBe(0); // last -> forward -> first
  });

  it("shows exactly one slide at every step of a full cycle", () => {
    hydrateCarousels();
    for (let i = 0; i < 7; i++) {
      expect(visible().filter((d) => d === "block")).toHaveLength(1);
      click("page-block-8-right");
    }
  });

  it("keeps hidden slides out of the a11y tree and off the tab order", () => {
    hydrateCarousels();
    click("page-block-8-right");
    const els = [...document.querySelectorAll<HTMLElement>(".cagriditem")];
    expect(els.map((e) => e.getAttribute("aria-hidden"))).toEqual([
      "true",
      "false",
      "true",
    ]);
    // display:none is what actually removes them; aria-hidden states it too.
    expect(els[0].style.display).toBe("none");
    expect(els[0].style.pointerEvents).toBe("none");
  });

  it("names the track as a carousel for screen readers", () => {
    hydrateCarousels();
    const track = document.querySelector(".caslider")!;
    expect(track.getAttribute("aria-roledescription")).toBe("carousel");
    expect(track.getAttribute("aria-label")).toBeTruthy();
  });

  it("cleanup unbinds the arrows", () => {
    const stop = hydrateCarousels();
    click("page-block-8-right");
    expect(shownIndex()).toBe(1);
    stop();
    click("page-block-8-right");
    expect(shownIndex()).toBe(1);
  });

  it("ignores a slider the export never filled", () => {
    // The artifact carries a second .caslider with no slides; giving it working
    // arrows that cycle one frame would be worse than leaving it inert.
    document.body.innerHTML =
      `<section id="page-block-99"><div class="cagrid caslider">` +
      slide(0, true) +
      `</div><button id="page-block-99-right"></button></section>`;
    hydrateCarousels();
    expect(
      document.querySelector(".caslider")!.getAttribute("aria-roledescription"),
    ).toBeNull();
  });

  it("counts only direct children as slides, not nested grids", () => {
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
    hydrateCarousels();
    click("page-block-8-right");
    const top = [
      ...document.querySelector(".caslider")!.children,
    ] as HTMLElement[];
    expect(top.filter((e) => e.style.display === "block")).toHaveLength(1);
    expect(top[1].style.display).toBe("block");
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
});
