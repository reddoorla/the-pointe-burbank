// Render-time enhancements for frozen Blux markup. The freeze strips Blux's
// runtime JS, which leaves two kinds of dead links in the settled DOM; both are
// deterministically repairable from the markup itself, so we fix them at render
// (the committed artifact stays byte-faithful to the freeze output).

/**
 * Blux nav anchors are JS-driven: `<a class="… data-hashlink" href="/#N">`
 * scrolled to the band with id `page-block-N`. Without that JS, `#N` matches
 * nothing. Rewrite to the real ids so native anchor navigation works.
 * (Digit-only fragments — real named anchors like `#site-icon-left` untouched.)
 */
export function rewriteHashlinks(html: string): string {
  return html.replace(/href="\/#(\d+)"/g, 'href="#page-block-$1"');
}

/**
 * Decode one Cloudflare email-protection payload: first hex byte is the XOR
 * key, the rest are the address's chars.
 */
export function decodeCfEmail(hex: string): string {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

/**
 * The original site sat behind Cloudflare, whose email obfuscation rewrote
 * mailto links to `/cdn-cgi/l/email-protection#<hex>` hrefs and `[email
 * protected]` placeholder spans carrying `data-cfemail="<hex>"`. The decoding
 * script is gone with the CDN, so restore both from the baked payloads:
 * hrefs become real `mailto:`, placeholder text becomes the address.
 */
export function rewriteCfEmails(html: string): string {
  return html
    .replace(
      /href="\/cdn-cgi\/l\/email-protection#([0-9a-fA-F]+)"/g,
      (_, hex: string) => `href="mailto:${decodeCfEmail(hex)}"`,
    )
    .replace(
      /(<[^>]*data-cfemail="([0-9a-fA-F]+)"[^>]*>)[^<]*(<)/g,
      (_, open: string, hex: string, close: string) =>
        `${open}${decodeCfEmail(hex)}${close}`,
    );
}

/** All render-time markup repairs, applied after token substitution. */
export function enhanceFrozenHtml(html: string): string {
  return rewriteCfEmails(rewriteHashlinks(html));
}

/**
 * Appended AFTER the artifact CSS (same injected <style>), so these win over
 * the freeze's reveal-force block by both order and specificity:
 * - `.rd-fx-wait/.rd-fx-run`: scroll-reveal for below-fold `.block-effects`
 *   elements — FrozenPage's hydration adds `wait` only to elements below the
 *   viewport (above-fold content never flashes) and swaps to `run` on
 *   intersection. No-JS and reduced-motion users keep the force-visible page.
 * - `scroll-margin-top`: anchor targets clear the (~100px) fixed Blux nav.
 * - `scroll-behavior`: smooth native anchor scrolling, motion-gated.
 */
export const FROZEN_ENHANCE_CSS = [
  ".block-effects.rd-fx-wait{opacity:0!important;transform:translateY(18px)!important;transition:none!important}",
  ".block-effects.rd-fx-run{opacity:1!important;transform:none!important;transition:opacity .65s cubic-bezier(.2,.55,.88,.95),transform .65s cubic-bezier(.2,.55,.88,.95)!important}",
  '[id^="page-block-"]{scroll-margin-top:110px}',
  "@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}",
].join("");
