import { render } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import type { Content } from "@prismicio/client";
import CollectionList from "./index.svelte";

const slice = {
  slice_type: "collection_list",
  variation: "grid",
  primary: {
    heading: [{ type: "heading2", text: "Products", spans: [] }],
    collection_type: "product",
    max_items: 12,
  },
  items: [],
} as unknown as Content.CollectionListSlice;

const context = {
  collections: {
    product: [
      {
        uid: "aero-sofa",
        data: {
          title: [{ type: "heading3", text: "Aero Sofa", spans: [] }],
          media: {
            url: "https://img.example/sofa.jpg",
            alt: "Aero Sofa",
            dimensions: { width: 800, height: 600 },
          },
        },
      },
      {
        uid: "loft-chair",
        data: {
          title: [{ type: "heading3", text: "Loft Chair", spans: [] }],
          media: {
            url: "https://img.example/chair.jpg",
            alt: "Loft Chair",
            dimensions: { width: 800, height: 600 },
          },
        },
      },
    ],
  },
};

describe("CollectionList slice", () => {
  it("renders one entry per linked collection document", () => {
    const { getByRole, getAllByRole } = render(CollectionList, {
      props: { slice, context },
    });
    expect(getByRole("heading", { level: 2 }).textContent).toContain(
      "Products",
    );
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("renders nothing but the heading when the collection is absent from context", () => {
    const { container } = render(CollectionList, {
      props: { slice, context: { collections: {} } },
    });
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(container.querySelectorAll("h3")).toHaveLength(0);
  });
});
