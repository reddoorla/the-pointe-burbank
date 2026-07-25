import { describe, it, expect } from "vitest";
import type { RichTextField } from "@prismicio/client";
import { buildHeadingLevelMap, defaultLevel } from "./richTextHeadings";

function field(...types: string[]): RichTextField {
  return types.map((type) => ({
    type,
    text: "x",
    spans: [],
  })) as unknown as RichTextField;
}

describe("buildHeadingLevelMap", () => {
  it("compresses a gap the editor left (h2 → h4) into consecutive levels", () => {
    const map = buildHeadingLevelMap(
      field("heading2", "paragraph", "heading4"),
    );
    expect(map.get(2)).toBe(2);
    expect(map.get(4)).toBe(3);
  });

  it("re-bases deep headings so the shallowest becomes level 2", () => {
    const map = buildHeadingLevelMap(field("heading3", "heading5"));
    expect(map.get(3)).toBe(2);
    expect(map.get(5)).toBe(3);
  });

  it("keeps an already-valid single h2 untouched", () => {
    const map = buildHeadingLevelMap(field("heading2"));
    expect(map.get(2)).toBe(2);
    expect(map.size).toBe(1);
  });

  it("maps duplicate uses of a level identically (distinct levels only)", () => {
    const map = buildHeadingLevelMap(
      field("heading3", "heading3", "heading6", "heading3"),
    );
    expect(map.get(3)).toBe(2);
    expect(map.get(6)).toBe(3);
    expect(map.size).toBe(2);
  });

  it("handles all six levels, capping at 6", () => {
    const map = buildHeadingLevelMap(
      field(
        "heading1",
        "heading2",
        "heading3",
        "heading4",
        "heading5",
        "heading6",
      ),
    );
    // 1→2, 2→3, 3→4, 4→5, 5→6, and 6 clamps at 6.
    expect([...map.entries()]).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 6],
    ]);
  });

  it("orders levels numerically regardless of document order", () => {
    const map = buildHeadingLevelMap(field("heading5", "heading2"));
    expect(map.get(2)).toBe(2);
    expect(map.get(5)).toBe(3);
  });

  it("returns an empty map for fields without headings", () => {
    expect(buildHeadingLevelMap(field("paragraph")).size).toBe(0);
    expect(buildHeadingLevelMap([] as unknown as RichTextField).size).toBe(0);
  });

  it("tolerates null/undefined fields", () => {
    expect(buildHeadingLevelMap(null).size).toBe(0);
    expect(buildHeadingLevelMap(undefined).size).toBe(0);
  });
});

describe("defaultLevel", () => {
  it("clamps into the 2–6 sub-outline range", () => {
    expect(defaultLevel(1)).toBe(2);
    expect(defaultLevel(2)).toBe(2);
    expect(defaultLevel(4)).toBe(4);
    expect(defaultLevel(6)).toBe(6);
    expect(defaultLevel(9)).toBe(6);
  });
});
