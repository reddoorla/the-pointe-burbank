import { describe, it, expect, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import ProductDetail from "./ProductDetail.svelte";
import type { Product } from "$lib/blux/product-types";

// The component reads the page's absolute url for share links.
vi.mock("$app/state", () => ({
  page: { url: new URL("https://example.com/products/aria") },
}));

afterEach(() => cleanup());

const product: Product = {
  slug: "aria",
  title: "Aria",
  category: "Upholstered",
  subCategory: "Lounge",
  dimensions: '30"W x 30"D',
  tags: ["lounge"],
  disabled: false,
  image: { assetId: "main", url: "https://cdn/main.jpg" },
  gallery: [{ assetId: "g1", url: "https://cdn/g1.jpg" }],
};

describe("ProductDetail", () => {
  it("renders the title, dimensions and category back-link", () => {
    const { getByRole, getByText } = render(ProductDetail, { product });
    expect(getByRole("heading", { level: 1 }).textContent).toContain("Aria");
    expect(getByText('30"W x 30"D')).toBeTruthy();
    const back = getByText(/Upholstered Lounge/).closest("a")!;
    // Back-link → the category listing, anchored to the sub-category.
    expect(back.getAttribute("href")).toBe("/products/upholstered#lounge");
  });

  it("shows the main image and a thumbnail per image", () => {
    const { getByAltText, getAllByRole } = render(ProductDetail, { product });
    const main = getByAltText("Aria") as HTMLImageElement;
    expect(main.getAttribute("src")).toBe("https://cdn/main.jpg");
    // main + gallery = 2 thumbnail buttons.
    const thumbs = getAllByRole("button", { name: /View image/ });
    expect(thumbs).toHaveLength(2);
  });

  it("swaps the main image when a thumbnail is activated", async () => {
    const { getByAltText, getByRole } = render(ProductDetail, { product });
    await fireEvent.click(getByRole("button", { name: "View image 2 of 2" }));
    expect((getByAltText("Aria") as HTMLImageElement).getAttribute("src")).toBe(
      "https://cdn/g1.jpg",
    );
  });

  it("renders Facebook/Twitter/Pinterest share links with the encoded page url", () => {
    const { getByLabelText } = render(ProductDetail, { product });
    const enc = encodeURIComponent("https://example.com/products/aria");
    const fb = getByLabelText("Share on Facebook");
    expect(fb.getAttribute("href")).toContain(enc);
    expect(fb.getAttribute("href")).toContain("facebook.com/sharer");
    expect(fb.getAttribute("target")).toBe("_blank");
    expect(getByLabelText("Share on Twitter").getAttribute("href")).toContain(
      "twitter.com/share",
    );
    expect(getByLabelText("Share on Pinterest").getAttribute("href")).toContain(
      "pinterest.com/pin/create",
    );
  });

  it("omits the image column and thumbnails for an imageless product", () => {
    const noImage: Product = { ...product, image: undefined, gallery: [] };
    const { queryByAltText, queryAllByRole, getByRole } = render(
      ProductDetail,
      {
        product: noImage,
      },
    );
    expect(queryByAltText("Aria")).toBeNull();
    expect(queryAllByRole("button", { name: /View image/ })).toHaveLength(0);
    // Title + share row still render.
    expect(getByRole("heading", { level: 1 }).textContent).toContain("Aria");
  });

  it("drops the sub-category anchor when the product has none", () => {
    const noSub: Product = { ...product, subCategory: "" };
    const { getByText } = render(ProductDetail, { product: noSub });
    const back = getByText(/Upholstered/).closest("a")!;
    expect(back.getAttribute("href")).toBe("/products/upholstered");
  });
});
