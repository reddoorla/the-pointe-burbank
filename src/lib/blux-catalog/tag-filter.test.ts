import { describe, expect, it } from "vitest";
import { tagFilter } from "./tag-filter";

describe("tagFilter", () => {
  it("&& = AND: all terms must be present", () => {
    const f = tagFilter("projects&&interior");
    expect(f(["projects", "interior", "extra"])).toBe(true);
    expect(f(["projects"])).toBe(false);
    expect(f(["interior"])).toBe(false);
  });

  it("|| = OR of AND-groups; ignores empty/leading terms; case-insensitive", () => {
    const f = tagFilter("case||&&metal&&sofa");
    expect(f(["case"])).toBe(true); // first group (single term)
    expect(f(["Metal", "Sofa"])).toBe(true); // second group, leading && ignored, case-insensitive
    expect(f(["metal"])).toBe(false); // second group needs BOTH
    expect(f(["chair"])).toBe(false);
  });

  it("matches singular/plural (Blux stems a trailing s): projects ↔ project", () => {
    const f = tagFilter("projects&&interior");
    expect(f(["project", "interior"])).toBe(true); // singular tag, plural filter
    expect(f(["projects", "interior"])).toBe(true); // plural
    // Conservative: only ONE trailing s, so no unrelated over-match.
    expect(f(["projector", "interior"])).toBe(false);
    expect(f(["project"])).toBe(false); // still needs interior
  });

  it("empty/absent expression matches everything", () => {
    expect(tagFilter(undefined)(["x"])).toBe(true);
    expect(tagFilter("")([])).toBe(true);
  });
});
