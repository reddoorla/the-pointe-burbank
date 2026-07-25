import { render, cleanup } from "@testing-library/svelte";
import { describe, it, expect, afterEach } from "vitest";
import type { Content } from "@prismicio/client";
import BluxTable from "./index.svelte";

const rt = (level: string, text: string) => [{ type: level, text, spans: [] }];
afterEach(() => cleanup());

describe("BluxTable slice", () => {
  it("renders the caption heading and the raw table HTML", () => {
    const slice = {
      slice_type: "blux_table",
      variation: "default",
      primary: {
        caption: rt("heading3", "Rates"),
        table_html: "<table><tr><td class='c'>A</td></tr></table>",
      },
    } as unknown as Content.BluxTableSlice;
    const { container, getByText } = render(BluxTable, { props: { slice } });
    expect(getByText("Rates")).not.toBeNull();
    expect(container.querySelector("td.c")).not.toBeNull();
  });
});
