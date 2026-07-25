import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxSection from "./index.svelte";

/**
 * Emit → render proof (offline). The reddoor-maintenance catalog emit
 * (`buildCatalogPlan` in src/blux/catalog/emit.ts) produces a `blux_section`
 * page-doc slice whose text/media are `{__richtext_html}` / `{__asset_id}`
 * markers. At migrate time `resolveDocData` (src/blux/emit/resolve-doc.ts)
 * recursively turns those markers into rich-text nodes / `{ id }` — including
 * inside the nested `cells` group. This test mirrors that RESOLVED shape and
 * feeds it through the real BluxSection slice, proving the emit's field names
 * (`heading`, `cells`, `kind`, `title`, `body_html`) line up exactly with what
 * the component reads — WITHOUT a live Prismic round-trip. If a field name drifts,
 * the render goes empty and this fails: fix the emit, not the test.
 */
const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];

afterEach(() => cleanup());

describe("BluxSection renders an emit-shaped (resolved) document", () => {
  it("shows the section heading and every resolved cell", () => {
    const slice = {
      slice_type: "blux_section",
      variation: "default",
      primary: {
        background_color: "#f4f4f4",
        heading: rt("heading2", "Amenities"),
        cells: [
          {
            kind: "text",
            title: rt("heading3", "Pool"),
            body_html: '<div class="txt-role-text1"><p>Heated</p></div>',
            subgrid: [],
          },
          { kind: "text", title: rt("heading3", "Gym"), subgrid: [] },
        ],
      },
    } as unknown as Content.BluxSectionSlice;

    const { container, getByText } = render(BluxSection, { props: { slice } });
    expect(getByText("Amenities")).not.toBeNull();
    expect(getByText("Pool")).not.toBeNull();
    expect(getByText("Heated")).not.toBeNull();
    expect(getByText("Gym")).not.toBeNull();
    expect(
      container.querySelectorAll(".blux-section__cells > .blux-cell"),
    ).toHaveLength(2);
  });
});
