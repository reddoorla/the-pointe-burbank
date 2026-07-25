import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import TextColumns from "./index.svelte";

afterEach(() => cleanup());

const rt = (text: string) => [{ type: "paragraph", text, spans: [] }];

describe("TextColumns slice", () => {
  it("renders the eyebrow as h2 and each column title as h3", () => {
    const slice = {
      slice_type: "text_columns",
      variation: "default",
      primary: {
        eyebrow: "Our Solution",
        hasTopRule: true,
        desktopColumns: "3",
        columns: [
          { title: "One", body: rt("First column.") },
          { title: "Two", body: rt("Second column.") },
        ],
        band: null,
      },
      items: [],
    } as never;
    const { container } = render(TextColumns, {
      props: { slice, context: {} },
    });
    expect(container.querySelector("h2")?.textContent?.trim()).toBe(
      "Our Solution",
    );
    const h3s = [...container.querySelectorAll("h3")].map((h) =>
      h.textContent?.trim(),
    );
    expect(h3s).toEqual(["One", "Two"]);
  });

  it("promotes column titles to h2 when there is no eyebrow (no heading skip)", () => {
    const slice = {
      slice_type: "text_columns",
      variation: "default",
      primary: {
        eyebrow: "",
        hasTopRule: false,
        desktopColumns: "2",
        columns: [{ title: "Solo", body: rt("Body.") }],
        band: null,
      },
      items: [],
    } as never;
    const { container } = render(TextColumns, {
      props: { slice, context: {} },
    });
    expect(container.querySelector("h2")?.textContent?.trim()).toBe("Solo");
    expect(container.querySelector("h3")).toBeNull();
  });

  it("does not crash on duplicate/blank column titles (keyed by index)", () => {
    const slice = {
      slice_type: "text_columns",
      variation: "default",
      primary: {
        eyebrow: "Dupes",
        hasTopRule: false,
        desktopColumns: "3",
        columns: [
          { title: "Same", body: rt("a") },
          { title: "Same", body: rt("b") },
          { title: "", body: rt("c") },
        ],
        band: null,
      },
      items: [],
    } as never;
    const { getAllByText, getByText } = render(TextColumns, {
      props: { slice, context: {} },
    });
    expect(getAllByText("Same")).toHaveLength(2);
    expect(getByText("c")).toBeTruthy();
  });
});
