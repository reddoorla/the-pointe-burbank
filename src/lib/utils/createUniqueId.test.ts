import { describe, it, expect } from "vitest";
import { createUniqueId } from "./createUniqueId";

describe("createUniqueId", () => {
  it("returns a string in UUID-like format", () => {
    const id = createUniqueId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createUniqueId()));
    expect(ids.size).toBe(50);
  });
});
