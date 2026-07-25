import { describe, it, expect } from "vitest";
import { frozenArtifacts } from "./artifacts";

describe("frozenArtifacts (Blux-only scoping gate)", () => {
  it("is empty in the starter template — no artifact ships, so non-frozen repos are unaffected", () => {
    expect(Object.keys(frozenArtifacts)).toHaveLength(0);
  });
});
