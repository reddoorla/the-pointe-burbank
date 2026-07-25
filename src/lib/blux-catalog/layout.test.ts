import { describe, it, expect } from "vitest";
import { GRID_GUTTER, cellWidth, gridCellBasis } from "./layout";

describe("blux-catalog layout math", () => {
  it("exposes the 4% Blux gutter", () => {
    expect(GRID_GUTTER).toBe(4);
  });

  it("cellWidth: explicit width wins, else equal split by column count", () => {
    expect(cellWidth("70%", 2)).toBe("70%");
    expect(cellWidth(undefined, 2)).toBe("50%");
    expect(cellWidth(undefined, 3)).toBe("33.3333%");
    expect(cellWidth(undefined, 1)).toBe("100%");
  });

  it("gridCellBasis: reserves the gutter for a row of k columns", () => {
    expect(gridCellBasis(undefined, 2)).toBe("calc(50% - 2%)");
    expect(gridCellBasis("70%", 2)).toBe("calc(70% - 2%)");
    expect(gridCellBasis("30%", 2)).toBe("calc(30% - 2%)");
    expect(gridCellBasis(undefined, 3)).toBe("calc(33.3333% - 2.6667%)");
    expect(gridCellBasis(undefined, 1)).toBe("100%");
  });
});
