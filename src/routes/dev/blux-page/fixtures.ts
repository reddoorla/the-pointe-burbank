import type { Presentation } from "$lib/blux/presentation";

// Inline SVG rects keep the fixture hermetic — the axe run must not depend on
// external hosts (Prismic CDN). Same data-URI approach as dev/a11y-fixtures.
const rect = (fill: string, w = 1200, h = 600) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/></svg>`,
  )}`;

/** Four-band manifest exercising the Blux render surface end to end: a hero
 * with background media + text-role metadata, a grid_band with a real
 * RenderNode tree (row/stack/heading/media), a two-slide captioned carousel
 * reserving its source min-height, and a closing title band. */
export const presentation: Presentation = {
  bands: {
    "0": {
      style: {
        "min-height": "60vh",
        "vertical-align": "middle",
        "text-align": "center",
        _contentPadding: "80px 4% 80px 4%",
        // Exercises BandContent's `.band-pad` mobile-override path (≤700px).
        _contentPaddingMobile: "40px 4%",
      },
      background: { kind: "image", url: rect("#e8e4dc"), fit: "cover" },
      text: { headingRole: "text5", headingLevel: 2, subtitleRole: "text12" },
    },
    "1": {
      // Dark band so the export-carried white text below stays a11y-legible.
      style: { "background-color": "#111827", "text-align": "left" },
      tree: {
        kind: "stack",
        children: [
          {
            kind: "heading",
            level: 2,
            html: "The <em>space</em>",
            role: "text11",
            // Export-carried inline color deviation (exercises Grid's textStyle).
            style: { color: "rgb(255, 255, 255)" },
          },
          {
            kind: "row",
            cells: [
              {
                token: { cols: 2, ratio: 60 },
                node: {
                  kind: "body",
                  html: "<p>Generous floor plans pair with considered finishes; every corner of the fixture is measured against the original.</p>",
                  role: "text1",
                  // Light copy keeps AA contrast on the dark band.
                  style: { color: "rgb(229, 231, 235)" },
                },
              },
              {
                token: { cols: 2, ratio: 40 },
                node: {
                  kind: "media",
                  media: {
                    kind: "image",
                    url: rect("#c9d2dd", 800, 600),
                    alt: "Interior rendering",
                    width: 480,
                    aspect: 75,
                  },
                },
              },
            ],
          },
        ],
      },
    },
    "2": {
      carousel: {
        slides: [
          {
            media: {
              kind: "image",
              url: rect("#dfe6ee"),
              alt: "Courtyard",
              minHeight: "40vh",
            },
            caption: { level: 5, role: "text5" },
          },
          {
            media: {
              kind: "image",
              url: rect("#e6ded2"),
              alt: "Rooftop",
              minHeight: "40vh",
            },
            caption: { level: 5, role: "text5" },
          },
        ],
        columns: 1,
      },
    },
    "3": {
      style: {
        "background-color": "#f4f1ea",
        "text-align": "center",
        _contentPadding: "80px 4% 80px 4%",
      },
      text: { headingRole: "text11", headingLevel: 2 },
    },
  },
};

/** The matching page-doc slice list, shaped like SliceZone's `slices`. */
export const slices = [
  {
    slice_type: "hero",
    variation: "band",
    primary: {
      band: 0,
      heading: "the fixture",
      subtitle: "a faithful\nband render",
    },
    items: [],
  },
  {
    slice_type: "grid_band",
    variation: "default",
    primary: { band: 1 },
    items: [],
  },
  {
    slice_type: "carousel",
    variation: "default",
    primary: { band: 2, label: "Fixture slideshow" },
    items: [
      { caption: "a quiet courtyard" },
      { caption: "sunset from the roof" },
    ],
  },
  {
    slice_type: "title_band",
    variation: "default",
    primary: { band: 3, heading: "Come see it in person." },
    items: [],
  },
];
