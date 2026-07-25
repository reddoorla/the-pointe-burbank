import { describe, it, expect } from "vitest";
import { formatCount } from "./countup";

describe("formatCount", () => {
  it("rounds to integer with grouping by default", () => {
    expect(formatCount(1234, { locale: "en-US" })).toBe("1,234");
    expect(formatCount(1234.7, { locale: "en-US" })).toBe("1,235");
  });

  it("honors fixed decimals", () => {
    expect(formatCount(3.1, { decimals: 2, locale: "en-US" })).toBe("3.10");
    expect(formatCount(3.14159, { decimals: 2, locale: "en-US" })).toBe("3.14");
  });

  it("applies prefix and suffix around the number", () => {
    expect(formatCount(38, { suffix: "%", locale: "en-US" })).toBe("38%");
    expect(
      formatCount(1200, { prefix: "$", decimals: 0, locale: "en-US" }),
    ).toBe("$1,200");
    expect(formatCount(50, { suffix: "+", locale: "en-US" })).toBe("50+");
  });

  it("can turn grouping off", () => {
    expect(formatCount(1000000, { useGrouping: false, locale: "en-US" })).toBe(
      "1000000",
    );
  });

  it("handles zero and negatives", () => {
    expect(formatCount(0, { suffix: "%", locale: "en-US" })).toBe("0%");
    expect(formatCount(-5, { locale: "en-US" })).toBe("-5");
  });

  it("respects the locale's grouping and decimal marks", () => {
    expect(formatCount(1234.5, { decimals: 1, locale: "de-DE" })).toBe(
      "1.234,5",
    );
  });
});
