import { describe, expect, it } from "vitest";
import {
  bandFor,
  cellWidth,
  GRID_GUTTER,
  loadPresentation,
  rowCellBases,
  selectPresentation,
} from "./presentation";
import type { Presentation, RenderCell } from "./presentation";

// A row cell carrying only a grid token — the node is irrelevant to width math.
const cell = (token: RenderCell["token"]): RenderCell => ({
  token,
  node: { kind: "subtitle", text: "" },
});

describe("presentation", () => {
  it("loadPresentation returns the checked-in manifest (empty until `blux convert`)", () => {
    const p = loadPresentation();
    // The starter ships the empty stub; a converted site's emit output has one
    // entry per band, keyed by string index.
    expect(p.bands).toEqual({});
    // A flat single-page manifest ignores the uid — every page sees it.
    expect(loadPresentation("about").bands).toEqual({});
  });

  it("selectPresentation namespaces by page uid on a multi-page manifest", () => {
    // Band indices are page-local (page-block-N restarts at 0 per page), so a
    // multi-page manifest keys per uid; unknown uids degrade to empty.
    const multi = {
      pages: {
        home: { bands: { "0": { style: { "text-align": "center" } } } },
        about: { bands: { "0": { style: { "text-align": "left" } } } },
      },
    };
    expect(
      selectPresentation(multi, "home").bands["0"]?.style?.["text-align"],
    ).toBe("center");
    expect(
      selectPresentation(multi, "about").bands["0"]?.style?.["text-align"],
    ).toBe("left");
    expect(selectPresentation(multi).bands["0"]?.style?.["text-align"]).toBe(
      "center",
    );
    expect(selectPresentation(multi, "ghost").bands).toEqual({});
    // The flat form passes through regardless of uid.
    const flat = { bands: { "3": { style: { "background-color": "#eef" } } } };
    expect(selectPresentation(flat, "anything").bands["3"]).toBeDefined();
  });

  it("bandFor looks up by band index and returns null when absent", () => {
    const p: Presentation = {
      bands: { "3": { style: { "background-color": "#eef" } } },
    };
    expect(bandFor(p, 3)?.style?.["background-color"]).toBe("#eef");
    expect(bandFor(p, 4)).toBeNull();
    expect(bandFor(undefined, 3)).toBeNull();
  });

  it("bandFor tolerates a manifest missing the bands key", () => {
    expect(bandFor({} as Presentation, 1)).toBeNull();
  });

  it("bandFor stamps the band index onto the entry (section anchor id)", () => {
    const p: Presentation = { bands: { "5": { style: {} } } };
    expect(bandFor(p, 5)?.index).toBe(5);
  });

  it("cellWidth: ratio → %, spacing ignored, numeric cols → 100/cols, any → null", () => {
    expect(cellWidth({ cols: 2, ratio: 60 })).toBe("60%");
    // spacing is a gap, not a width: a 1-col grid stacks full-width.
    expect(cellWidth({ cols: 1, spacing: 40 })).toBe("100%");
    expect(cellWidth({ cols: 4 })).toBe("25%");
    expect(cellWidth({ cols: 3 })).toBe("33.3333%");
    expect(cellWidth({ cols: "any", spacing: 20 })).toBeNull();
  });

  it("cellWidth guards non-positive cols instead of yielding Infinity%", () => {
    expect(cellWidth({ cols: 0 })).toBeNull();
  });

  describe("rowCellBases (horizontal gutter reservation)", () => {
    it("reserves an even share of the gutter from each cell of a 2-up row", () => {
      // 70/30 media|text (bands 6/12) — two cells share one line (k=2), so each
      // gives up half the 4% gutter (2%) and the pair still fits: 68+28+4=100.
      expect(
        rowCellBases([
          cell({ cols: 2, ratio: 70 }),
          cell({ cols: 2, ratio: 30 }),
        ]),
      ).toEqual(["calc(70% - 2%)", "calc(30% - 2%)"]);
      // 20/80 icon|heading (band 3) reserves the same even 2% per cell.
      expect(
        rowCellBases([
          cell({ cols: 2, ratio: 20 }),
          cell({ cols: 2, ratio: 80 }),
        ]),
      ).toEqual(["calc(20% - 2%)", "calc(80% - 2%)"]);
    });

    it("keys the reservation off cells-per-LINE (cols), not cell count", () => {
      // Band 14: 7 cells at cols=4 → 4 per line (25% each), NOT 7. Reserving
      // gutter/2 would wrap the 4th cell; the correct share is 4*(4-1)/4=3%.
      const cells = Array.from({ length: 7 }, () => cell({ cols: 4 }));
      expect(rowCellBases(cells)).toEqual(
        Array.from({ length: 7 }, () => "calc(25% - 3%)"),
      );
    });

    it("leaves single-per-line rows (100% cells) untouched — no horizontal gutter", () => {
      // cols=1 stat stack (band 3): each cell is 100%, one per line, so there is
      // no adjacent cell to gutter against — bases pass through unchanged.
      expect(
        rowCellBases([
          cell({ cols: 1, spacing: 40 }),
          cell({ cols: 1, spacing: 40 }),
        ]),
      ).toEqual(["100%", "100%"]);
    });

    it("passes auto-width rows through as 'auto' with no reservation", () => {
      // Band 10 presenter logos: cols 'any' → content-width cells that flex
      // around the gap; there is no percentage basis to reserve from.
      expect(
        rowCellBases([
          cell({ cols: "any", spacing: 20 }),
          cell({ cols: "any", spacing: 20 }),
        ]),
      ).toEqual(["auto", "auto"]);
    });

    it("does not reserve when a row mixes a percentage cell with an auto cell", () => {
      // Can't safely split a gutter across a fixed % and a content-width cell;
      // fall back to no reservation — the % cell keeps its basis, the auto cell
      // stays content-width and absorbs the gap.
      expect(rowCellBases([cell({ cols: 2 }), cell({ cols: "any" })])).toEqual([
        "50%",
        "auto",
      ]);
    });

    it("honors a custom gutter and keeps calc precision for thirds", () => {
      // cols=3 → 33.3333% each, k=3, reserve = 6*(3-1)/3 = 4% at a 6% gutter.
      expect(
        rowCellBases(
          [cell({ cols: 3 }), cell({ cols: 3 }), cell({ cols: 3 })],
          6,
        ),
      ).toEqual([
        "calc(33.3333% - 4%)",
        "calc(33.3333% - 4%)",
        "calc(33.3333% - 4%)",
      ]);
    });

    it("rounds the reserve UP so k cells + gutters never exceed the row (cols=6)", () => {
      // 16.6667% × 6, k=6 → reserve = 4*5/6 = 3.33333…%. Rounding UP to 3.3334%
      // keeps the line at 6*13.3333 + 5*4 = 99.9998% (rounding down to 3.3333%
      // would leave it at 100.0004% — marginally wide).
      const cells = Array.from({ length: 6 }, () => cell({ cols: 6 }));
      expect(rowCellBases(cells)).toEqual(
        Array.from({ length: 6 }, () => "calc(16.6667% - 3.3334%)"),
      );
    });

    it("exports the default gutter as a single source of truth (kept in sync with the md:gap-x class)", () => {
      expect(GRID_GUTTER).toBe(4);
    });
  });

  it("carries the map payload on a band (render contract)", () => {
    const p: Presentation = {
      bands: {
        "14": {
          map: {
            mid: "M",
            layers: [
              {
                name: "A",
                lid: "L",
                initiallyVisible: true,
                preserveViewport: false,
              },
            ],
            toggles: [{ label: "All", layers: ["A"] }],
            styles: [],
          },
        },
      },
    };
    expect(bandFor(p, 14)?.map?.mid).toBe("M");
  });

  it("carries text-role metadata on a band (Hero/TitleBand contract)", () => {
    const p: Presentation = {
      bands: {
        "2": {
          text: {
            headingRole: "text5",
            headingLevel: 2,
            subtitleRole: "text12",
          },
        },
      },
    };
    expect(bandFor(p, 2)?.text?.subtitleRole).toBe("text12");
  });
});
