import { describe, expect, it } from "vitest";
import {
  substitute,
  styleTag,
  ANY_TOKEN_RE,
  type SlotValue,
} from "./substitute";

const vals = (o: Record<string, SlotValue>) => new Map(Object.entries(o));

describe("substitute", () => {
  it("replaces text tokens", () => {
    const out = substitute(
      "<h1>⟦t:s0.t0⟧</h1>",
      vals({ "s0.t0": { text: "Hello" } }),
    );
    expect(out).toBe("<h1>Hello</h1>");
  });

  it("replaces background-image tokens with a quoted url (comma-safe)", () => {
    const out = substitute(
      `<div style="background-image:url(⟦i:s0.i0⟧)"></div>`,
      vals({ "s0.i0": { url: "https://img/x.jpg?auto=format,compress" } }),
    );
    expect(out).toContain(`url('https://img/x.jpg?auto=format,compress')`);
  });

  it("replaces bare image tokens in src/href", () => {
    const out = substitute(
      `<video src="⟦i:s1.i0⟧"></video>`,
      vals({ "s1.i0": { url: "https://cdn/v.mp4" } }),
    );
    expect(out).toBe(`<video src="https://cdn/v.mp4"></video>`);
  });

  it("resolves a missing key to empty and never leaves a raw token", () => {
    const out = substitute(
      "<p>⟦t:missing⟧</p><i style='background-image:url(⟦i:gone⟧)'></i>",
      vals({}),
    );
    expect(ANY_TOKEN_RE.test(out)).toBe(false);
  });
});

describe("styleTag", () => {
  it("wraps css in a style element", () => {
    expect(styleTag(".x{color:red}")).toBe("<style>.x{color:red}</style>");
  });
});
