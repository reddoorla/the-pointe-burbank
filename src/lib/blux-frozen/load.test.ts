import { describe, it, expect } from "vitest";
import { buildFrozenData, resolveFrozen, frozenUids } from "./load";
import type { FrozenArtifact } from "./artifacts";
import type { FrozenPageDoc } from "./frozen-page-doc";

const art: FrozenArtifact = {
  template:
    "<div>⟦t:s0.t0⟧<i style='background-image:url(⟦i:s0.i0⟧)'></i></div>",
  styleCss: ".x{color:red}",
  fontLinks: ["https://fonts.googleapis.com/css2?family=X"],
};

const doc: FrozenPageDoc = {
  uid: "home",
  data: {
    title: "The Pointe",
    meta_title: "The Pointe | Home",
    meta_description: "desc",
    meta_image: { url: "https://images.prismic.io/og.jpg", alt: "Storefront" },
    slots: [
      {
        key: "s0.i0",
        kind: "image",
        image: { url: "https://images.prismic.io/x.jpg" },
      },
      {
        key: "s0.t0",
        kind: "text",
        text: [{ type: "paragraph", text: "Hi", spans: [] }] as never,
      },
    ],
  },
};

describe("buildFrozenData", () => {
  it("composes artifact + doc into the <FrozenPage> render shape", () => {
    const d = buildFrozenData(art, doc);
    expect(d.frozen).toBe(true);
    expect(d.template).toBe(art.template);
    expect(d.styleCss).toBe(art.styleCss);
    expect(d.fontLinks).toEqual(art.fontLinks);
    expect(d.title).toBe("The Pointe");
    // snake_case keys — the shape the layout <Seo> reads (matches pageMeta()).
    expect(d.meta_title).toBe("The Pointe | Home");
    expect(d.meta_description).toBe("desc");
    expect(d.meta_image).toBe("https://images.prismic.io/og.jpg");
    expect(d.meta_image_alt).toBe("Storefront");
    expect(d.slots.find((s) => s.key === "s0.i0")?.url).toBe(
      "https://images.prismic.io/x.jpg",
    );
    expect(d.slots.find((s) => s.key === "s0.t0")?.text).toBe("Hi");
  });
});

describe("resolveFrozen — the Blux-only fall-through guarantee", () => {
  const client = { getByUID: async () => doc };

  it("returns null when the repo has NO committed artifact for the uid (native/catalog site)", async () => {
    // Empty artifact map = the starter template / any non-frozen repo.
    expect(await resolveFrozen(client, "home", {})).toBeNull();
  });

  it("returns null with NO query for prototype-member uids on a non-frozen repo", async () => {
    // A plain-object map inherits Object.prototype names; the own-key guard must
    // still treat these as "no artifact" (no spurious frozen_page query).
    for (const uid of [
      "toString",
      "constructor",
      "__proto__",
      "hasOwnProperty",
      "valueOf",
    ]) {
      let queried = false;
      const spy = {
        getByUID: async () => {
          queried = true;
          return doc;
        },
      };
      expect(await resolveFrozen(spy, uid, {})).toBeNull();
      expect(queried, `uid "${uid}" must not query`).toBe(false);
    }
  });

  it("returns null (falls through) when the artifact exists but no frozen_page doc is published", async () => {
    const missClient = {
      getByUID: async () => {
        throw new Error("No documents were returned");
      },
    };
    expect(await resolveFrozen(missClient, "home", { home: art })).toBeNull();
  });

  it("returns frozen render data only when BOTH artifact and doc are present", async () => {
    const d = await resolveFrozen(client, "home", { home: art });
    expect(d?.frozen).toBe(true);
    expect(d?.slots).toHaveLength(2);
  });

  it("does not query Prismic at all when there is no artifact (no extra request on native sites)", async () => {
    let queried = false;
    const spyClient = {
      getByUID: async () => {
        queried = true;
        return doc;
      },
    };
    await resolveFrozen(spyClient, "home", {});
    expect(queried).toBe(false);
  });
});

describe("frozenUids", () => {
  it("lists the uids that have a committed artifact", () => {
    expect(frozenUids({ home: art, about: art }).sort()).toEqual([
      "about",
      "home",
    ]);
  });
});
