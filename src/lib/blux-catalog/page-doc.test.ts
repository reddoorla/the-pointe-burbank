import { describe, expect, it } from "vitest";
import type { PageDocument } from "../../prismicio-types";
import {
  getAllPageDocs,
  getPageDoc,
  PAGE_DOC_TYPES,
  pageMeta,
  toPrerenderEntries,
} from "./page-doc";

/** A getByUID mock backed by a {type -> {uid -> doc}} table: throws (like the
 * real client) when the type has no such uid. getAllByType returns the type's
 * docs, or [] when the type has none — the real client's behaviour for a
 * document-type value with zero matches. */
function uidClient(table: Record<string, Record<string, unknown>>) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      getByUID(type: string, uid: string) {
        calls.push(`${type}:${uid}`);
        const doc = table[type]?.[uid];
        if (doc === undefined) {
          return Promise.reject(new Error(`no ${type} with uid ${uid}`));
        }
        return Promise.resolve(doc);
      },
      getAllByType(type: string) {
        return Promise.resolve(Object.values(table[type] ?? {}));
      },
    },
  };
}

describe("PAGE_DOC_TYPES", () => {
  it("queries native `page` before the Blux `catalog_page`", () => {
    expect(PAGE_DOC_TYPES).toEqual(["page", "catalog_page"]);
  });
});

describe("getPageDoc", () => {
  it("returns the native `page` doc and never queries catalog_page when it exists", async () => {
    const { client, calls } = uidClient({
      page: { home: { uid: "home", data: { slices: [{ n: 1 }] } } },
    });
    const doc = await getPageDoc(client, "home");
    expect(doc).toEqual({ uid: "home", data: { slices: [{ n: 1 }] } });
    expect(calls).toEqual(["page:home"]); // catalog_page never touched
  });

  it("falls back to catalog_page when the native page type has no such uid", async () => {
    const { client, calls } = uidClient({
      catalog_page: { about: { uid: "about", data: { slices: [] } } },
    });
    const doc = await getPageDoc(client, "about");
    expect(doc.uid).toBe("about");
    expect(calls).toEqual(["page:about", "catalog_page:about"]); // order: page first
  });

  it("attempts EVERY page type before rejecting (loader turns this into a 404)", async () => {
    const { client, calls } = uidClient({});
    await expect(getPageDoc(client, "ghost")).rejects.toThrow();
    // Both types probed — a mutation that stopped after `page` would fail here.
    expect(calls).toEqual(["page:ghost", "catalog_page:ghost"]);
  });
});

describe("getAllPageDocs", () => {
  it("concatenates docs across every page type (page + catalog_page)", async () => {
    const { client } = uidClient({
      page: { home: { uid: "home", data: { slices: [] } } },
      catalog_page: {
        about: { uid: "about", data: { slices: [] } },
        contact: { uid: "contact", data: { slices: [] } },
      },
    });
    const docs = await getAllPageDocs(client);
    expect(docs.map((d) => d.uid)).toEqual(["home", "about", "contact"]);
  });

  it("returns only the populated type's docs — a repo with no catalog_page docs yields the page docs (empty list, not a throw)", async () => {
    const { client } = uidClient({
      page: {
        home: { uid: "home", data: { slices: [] } },
        about: { uid: "about", data: { slices: [] } },
      },
    });
    const docs = await getAllPageDocs(client);
    expect(docs.map((d) => d.uid)).toEqual(["home", "about"]);
  });

  it("propagates a genuine query failure (fail-loud build, no silent swallow)", async () => {
    // A transient/real getAllByType error must reject — NOT be caught and
    // turned into [], which would ship a prerender missing every /[uid] page.
    const failingClient = {
      getByUID: () => Promise.reject(new Error("unused")),
      getAllByType(type: string) {
        if (type === "page") return Promise.reject(new Error("Prismic 403"));
        return Promise.resolve([]);
      },
    };
    await expect(getAllPageDocs(failingClient)).rejects.toThrow("Prismic 403");
  });

  it("returns an empty list when no page docs exist anywhere", async () => {
    const { client } = uidClient({});
    expect(await getAllPageDocs(client)).toEqual([]);
  });
});

describe("toPrerenderEntries", () => {
  it("emits one entry per doc, excluding home (which renders at the root route)", () => {
    const docs = [
      { uid: "home" },
      { uid: "about" },
      { uid: "contact" },
    ] as PageDocument[];
    expect(toPrerenderEntries(docs)).toEqual([
      { uid: "about" },
      { uid: "contact" },
    ]);
  });

  it("never emits {uid:'home'} — that would prerender /home as a 308 dup of /", () => {
    const docs = [{ uid: "home" }] as PageDocument[];
    expect(toPrerenderEntries(docs)).toEqual([]);
  });
});

describe("pageMeta", () => {
  it("reads the SEO tab undefined-safely for a catalog_page doc that has none", () => {
    // catalog_page = `page` MINUS the SEO tab: title present (Main tab), all
    // meta_* fields absent. A `.url`/`.alt` read that wasn't optional-chained
    // would throw here — this pins the change's core invariant (invariant 3).
    const catalogDoc = {
      uid: "home",
      data: {
        title: [{ type: "heading1", text: "The Pointe", spans: [] }],
        slices: [],
      },
    } as unknown as PageDocument;

    expect(pageMeta(catalogDoc)).toEqual({
      title: "The Pointe",
      meta_description: undefined,
      meta_title: undefined,
      meta_image: undefined,
      meta_image_alt: undefined,
    });
  });

  it("passes native `page` SEO fields through", () => {
    const pageDoc = {
      uid: "home",
      data: {
        title: [{ type: "heading1", text: "Home", spans: [] }],
        slices: [],
        meta_title: "Meta Home",
        meta_description: "A description",
        meta_image: { url: "https://img.example/og.png", alt: "OG alt" },
      },
    } as unknown as PageDocument;

    expect(pageMeta(pageDoc)).toEqual({
      title: "Home",
      meta_description: "A description",
      meta_title: "Meta Home",
      meta_image: "https://img.example/og.png",
      meta_image_alt: "OG alt",
    });
  });
});
