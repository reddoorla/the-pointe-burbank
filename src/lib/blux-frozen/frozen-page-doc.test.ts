import { describe, it, expect } from "vitest";
import { getFrozenPageDoc, FROZEN_PAGE_TYPE } from "./frozen-page-doc";

describe("getFrozenPageDoc", () => {
  it("returns the frozen_page doc queried by type + uid", async () => {
    const doc = { uid: "home", data: { title: "T", slots: [] } };
    let sawType = "";
    let sawUid = "";
    const client = {
      getByUID: async (type: string, uid: string) => {
        sawType = type;
        sawUid = uid;
        return doc;
      },
    };
    expect(await getFrozenPageDoc(client, "home")).toBe(doc);
    expect(sawType).toBe(FROZEN_PAGE_TYPE);
    expect(sawUid).toBe("home");
  });

  it("returns null when the doc — or the frozen_page type — is absent", async () => {
    const client = {
      getByUID: async () => {
        throw new Error("No documents were returned");
      },
    };
    expect(await getFrozenPageDoc(client, "home")).toBeNull();
  });
});
