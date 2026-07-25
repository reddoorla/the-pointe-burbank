import { asText } from "@prismicio/client";

// Map a Prismic `frozen_page` document's slots into the shape <FrozenPage> wants.
// The migrate (reddoor-maintenance `blux migrate-frozen`) writes each slot as
// { key, kind, text? (Rich Text), image? (Image), media_url? (Text) }. Image
// slots carry a Prismic Image; non-image media (video/pdf) carry a url in
// media_url instead (an Image field rejects them). Text is decoded by Prismic,
// so re-encode it for the template's {@html} substitution — matching the frozen
// template's raw (entity-encoded) form.

export interface FrozenDocSlot {
  key: string;
  kind: string;
  text?: unknown;
  image?: { url?: string | null } | null;
  media_url?: string | null;
}

export interface FrozenRenderSlot {
  key: string;
  kind: "text" | "image";
  text?: string;
  url?: string;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function frozenSlotsFromDoc(slots: FrozenDocSlot[]): FrozenRenderSlot[] {
  return slots.map((s) => {
    if (s.kind === "image") {
      const url = s.image?.url || s.media_url || undefined;
      return { key: s.key, kind: "image", url };
    }
    return {
      key: s.key,
      kind: "text",
      text: escapeHtml(asText(s.text as never) ?? ""),
    };
  });
}
