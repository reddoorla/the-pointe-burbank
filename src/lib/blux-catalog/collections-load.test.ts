import { describe, expect, it } from "vitest";
import { collectionTypesOf, loadCollections } from "./collections-load";

describe("collectionTypesOf", () => {
  it("collects the unique collection types blux_collection slices query, in order", () => {
    const slices = [
      {
        slice_type: "blux_collection",
        primary: { collection_type: "product" },
      },
      { slice_type: "blux_section", primary: {} },
      { slice_type: "blux_collection", primary: { collection_type: "person" } },
      {
        slice_type: "blux_collection",
        primary: { collection_type: "product" },
      },
    ];
    expect(collectionTypesOf(slices)).toEqual(["product", "person"]);
  });

  it("ignores non-collection slices and empty/absent collection_type", () => {
    const slices = [
      { slice_type: "blux_text", primary: { collection_type: "ghost" } },
      { slice_type: "blux_collection", primary: { collection_type: "" } },
      { slice_type: "blux_collection", primary: { collection_type: null } },
      { slice_type: "blux_collection", primary: {} },
      { slice_type: "blux_collection" },
    ];
    expect(collectionTypesOf(slices as never)).toEqual([]);
  });
});

describe("loadCollections", () => {
  it("fetches each type once and keys the result by type", async () => {
    const calls: string[] = [];
    const client = {
      getAllByType: (type: string) => {
        calls.push(type);
        return Promise.resolve([{ uid: `${type}-1` }, { uid: `${type}-2` }]);
      },
    };
    const collections = await loadCollections(client, ["product", "person"]);
    expect(calls).toEqual(["product", "person"]);
    expect(Object.keys(collections)).toEqual(["product", "person"]);
    expect(collections["product"]).toEqual([
      { uid: "product-1" },
      { uid: "product-2" },
    ]);
  });

  it("tolerates a rejecting getAllByType: unknown types yield [] not a 500", async () => {
    const client = {
      getAllByType: (type: string) =>
        type === "product"
          ? Promise.resolve([{ uid: "p" }])
          : Promise.reject(new Error("No documents of type ghost")),
    };
    const collections = await loadCollections(client, ["product", "ghost"]);
    expect(collections["product"]).toEqual([{ uid: "p" }]);
    expect(collections["ghost"]).toEqual([]);
  });

  it("returns an empty record for no types", async () => {
    const client = {
      getAllByType: () => Promise.reject(new Error("must not be called")),
    };
    expect(await loadCollections(client, [])).toEqual({});
  });
});
