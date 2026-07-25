import { describe, it, expect } from "vitest";
import { load } from "./+page";

// The gate's load wires the committed the-pointe fixtures into the shape the
// route + app layout consume. If a fixture field or the chrome mapping drifts,
// the gate renders wrong and this fails first.
describe("blux-pointe fidelity-gate load", () => {
  const data = load();

  it("returns the home document's slices", () => {
    expect(Array.isArray(data.slices)).toBe(true);
    expect(data.slices.length).toBe(16); // the-pointe: 16 bands
  });

  it("maps site-config nav items to Nav's {text, href} shape", () => {
    expect(data.navLinks.length).toBe(4);
    for (const l of data.navLinks) {
      expect(typeof l.text).toBe("string");
      expect(typeof l.href).toBe("string");
    }
    // Pin the mapping direction (text←label, href←href) so a swapped mapping
    // (e.g. text: i.href) can't pass green.
    expect(data.navLinks[0]).toEqual({ text: "Vision", href: "/#1" });
  });

  it("passes the footer columns through for the layout Footer", () => {
    expect(Array.isArray(data.footerColumns)).toBe(true);
    expect(data.footerColumns.length).toBe(2);
  });

  it("provides a collections context (empty for single-page the-pointe)", () => {
    expect(data.collections).toBeDefined();
    expect(Object.keys(data.collections)).toHaveLength(0);
  });
});
