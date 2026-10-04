import { describe, expect, it } from "vitest";
import { handle } from "./hooks.server";
import {
  CMS_FRAME_ANCESTORS,
  isCmsFramedRoute,
  widenFrameAncestors,
} from "$lib/security/cms-framing";
import * as simulatorPage from "./routes/slice-simulator/+page";

const POLICY =
  "default-src 'self'; frame-src 'self' https://repo.prismic.io; frame-ancestors 'self'; base-uri 'self'";

async function headersFor(
  pathname: string,
  policy: string | null = POLICY,
  upstream: Record<string, string> = {},
) {
  const response = await handle({
    event: { url: new URL(`https://the-pointe-burbank-rd.netlify.app${pathname}`) } as never,
    resolve: async () =>
      new Response("<html></html>", {
        headers: {
          "content-type": "text/html",
          ...upstream,
          ...(policy ? { "Content-Security-Policy": policy } : {}),
        },
      }),
  });
  return response.headers;
}

describe("CMS framing", () => {
  it("keeps every ordinary page SAMEORIGIN with frame-ancestors 'self'", async () => {
    const headers = await headersFor("/contact");
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.get("Content-Security-Policy")).toBe(POLICY);
  });

  it("lets Prismic frame /slice-simulator: no X-Frame-Options, widened frame-ancestors", async () => {
    const headers = await headersFor("/slice-simulator");
    expect(headers.get("X-Frame-Options")).toBeNull();
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain(CMS_FRAME_ANCESTORS);
    expect(csp.match(/frame-ancestors/g)).toHaveLength(1);
    expect(csp).toContain("frame-src 'self' https://repo.prismic.io");
    expect(csp).toContain("base-uri 'self'");
  });

  it("removes an X-Frame-Options the response already carried on /slice-simulator", async () => {
    const headers = await headersFor("/slice-simulator", POLICY, { "X-Frame-Options": "DENY" });
    expect(headers.get("X-Frame-Options")).toBeNull();
  });

  it("treats a trailing slash as the same route, and nothing else", () => {
    expect(isCmsFramedRoute("/slice-simulator/")).toBe(true);
    expect(isCmsFramedRoute("/slice-simulator-x")).toBe(false);
    expect(isCmsFramedRoute("/slice-simulator/x")).toBe(false);
    expect(isCmsFramedRoute("/")).toBe(false);
  });

  it("adds frame-ancestors when the policy has none", () => {
    expect(widenFrameAncestors("default-src 'self'")).toBe(
      `default-src 'self'; ${CMS_FRAME_ANCESTORS}`,
    );
  });

  it("leaves a response without a CSP without one", async () => {
    const headers = await headersFor("/slice-simulator", null);
    expect(headers.get("Content-Security-Policy")).toBeNull();
    expect(headers.get("X-Frame-Options")).toBeNull();
  });

  // Prerendered, the page would be a static file: netlify.toml's `/*`
  // X-Frame-Options: SAMEORIGIN reaches it and the hook never runs.
  it("keeps /slice-simulator server-rendered so the hook decides its headers", () => {
    expect(simulatorPage.prerender).toBe(false);
  });
});
