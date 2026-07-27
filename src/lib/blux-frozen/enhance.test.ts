import { describe, it, expect } from "vitest";
import {
  rewriteHashlinks,
  decodeCfEmail,
  rewriteCfEmails,
  enhanceFrozenHtml,
  FROZEN_ENHANCE_CSS,
} from "./enhance";

describe("rewriteHashlinks", () => {
  it("maps Blux digit hashlinks to their page-block ids", () => {
    const html =
      '<a class="navigation0ullia data-hashlink" href="/#1">A</a>' +
      '<a class="navigation0ullia data-hashlink" href="/#5">B</a>';
    const out = rewriteHashlinks(html);
    expect(out).toContain('href="#page-block-1"');
    expect(out).toContain('href="#page-block-5"');
    expect(out).not.toContain('href="/#');
  });

  it("applies site-verified overrides — Contact Us (#11) targets the footer, matching the original runtime", () => {
    const html = '<a class="navigation0ullia data-hashlink" href="/#11">C</a>';
    expect(rewriteHashlinks(html)).toContain('href="#footer0"');
  });

  it("leaves named anchors, plain roots, and external urls alone", () => {
    const html =
      '<a href="#site-icon-left">x</a><a href="/">y</a>' +
      '<a href="https://example.com/#5">z</a><a href="/#about">w</a>';
    expect(rewriteHashlinks(html)).toBe(html);
  });
});

describe("decodeCfEmail", () => {
  it("decodes a real payload from the-pointe's footer", () => {
    expect(decodeCfEmail("7e2a111a1a503a11101b073e1d1c0c1b501d1113")).toBe(
      "Todd.Doney@cbre.com",
    );
  });
});

describe("rewriteCfEmails", () => {
  it("turns email-protection hrefs into mailto: and fills placeholder text", () => {
    const html =
      '<a class="footer0ullia" href="/cdn-cgi/l/email-protection#7e2a111a1a503a11101b073e1d1c0c1b501d1113">' +
      '<span class="__cf_email__" data-cfemail="7e2a111a1a503a11101b073e1d1c0c1b501d1113">[email&#160;protected]</span></a>';
    const out = rewriteCfEmails(html);
    expect(out).toContain('href="mailto:Todd.Doney@cbre.com"');
    expect(out).toContain(">Todd.Doney@cbre.com<");
    expect(out).not.toContain("email&#160;protected");
    expect(out).not.toContain("cdn-cgi");
  });
});

describe("enhanceFrozenHtml + css", () => {
  it("applies both repairs", () => {
    const html =
      '<a class="data-hashlink" href="/#5">Nav</a>' +
      '<a href="/cdn-cgi/l/email-protection#7e2a111a1a503a11101b073e1d1c0c1b501d1113">mail</a>';
    const out = enhanceFrozenHtml(html);
    expect(out).toContain('href="#page-block-5"');
    expect(out).toContain('href="mailto:Todd.Doney@cbre.com"');
  });

  it("ships the reveal + anchor css", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(".rd-fx-wait");
    expect(FROZEN_ENHANCE_CSS).toContain(".rd-fx-run");
    expect(FROZEN_ENHANCE_CSS).toContain("scroll-margin-top");
    expect(FROZEN_ENHANCE_CSS).toContain("prefers-reduced-motion");
  });

  it("re-centers the map plus/minus glyph relatively (both states)", () => {
    expect(FROZEN_ENHANCE_CSS).toContain(
      ".map_icon_plusm:before{top:calc(50% - 7px)",
    );
    expect(FROZEN_ENHANCE_CSS).toContain(
      '.map_icon[data-clicked="1"] .map_icon_plusm:before{top:50%;height:0}',
    );
  });
});
