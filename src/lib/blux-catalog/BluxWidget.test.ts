import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import BluxWidget from "./BluxWidget.svelte";

afterEach(() => cleanup());

// The real emitted map widget shape (the-pointe): a .blux-map[data-map-config]
// wrapper around the #<mountId> mount and a .map_icon legend. Tests run in
// jsdom with no VITE_GOOGLE_MAPS_KEY, so hydration is skipped and only the
// static render + placeholder marker are asserted (never a real google.maps).
const mapHtml =
  `<div class="blux-map" data-map-config='{"mountId":"burbank_map","mid":"M1","zoom":8,"center":{"lat":-34.397,"lng":150.644},"defaultToggle":0,"styles":[],"layers":[{"name":"The_Burbank_Portfolio","lid":"l8","initiallyVisible":true}],"toggles":[{"label":"The Burbank Portfolio","layers":["The_Burbank_Portfolio"],"panelIndex":0}]}'>` +
  `<div id="custom-element0" data-exec="custom_x"><div id="burbank_map" style="height:600px">map loading...</div>` +
  `<div><span class="map_icon"><span class="map_icon_text">The Burbank Portfolio</span></span></div></div></div>`;

describe("BluxWidget", () => {
  it("non-map widget renders its html verbatim in the .blux-widget wrapper", () => {
    const { container } = render(BluxWidget, {
      props: { kind: "divider", html: "<hr class='x'>" },
    });
    expect(
      container.querySelector(".blux-widget[data-widget='divider'] hr.x"),
    ).not.toBeNull();
    // a non-map widget never gets the map placeholder marker
    expect(container.querySelector("[data-map-placeholder]")).toBeNull();
  });

  it("renders nothing when html is empty", () => {
    const { container } = render(BluxWidget, {
      props: { kind: "map", html: "" },
    });
    expect(container.querySelector(".blux-widget")).toBeNull();
  });

  it("map without a maps key: static html + mount + legend + placeholder marker (no crash)", () => {
    const { container, getByText } = render(BluxWidget, {
      props: { kind: "map", html: mapHtml },
    });
    expect(
      container.querySelector(".blux-widget[data-widget='map']"),
    ).not.toBeNull();
    // the emitted mount and legend render statically
    expect(container.querySelector("#burbank_map")).not.toBeNull();
    expect(getByText("The Burbank Portfolio")).not.toBeNull();
    // keyless env → placeholder marker, no live map
    expect(container.querySelector("[data-map-placeholder]")).not.toBeNull();
  });
});
