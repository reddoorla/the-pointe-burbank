import { describe, it, expect } from "vitest";
import { GET } from "./+server";

function get(origin: string) {
  return GET({
    url: new URL(`${origin}/robots.txt`),
  } as Parameters<typeof GET>[0]);
}

describe("GET /robots.txt", () => {
  it("targets all agents", async () => {
    const body = await (await get("https://example.com")).text();
    expect(body).toContain("User-agent: *");
  });

  it("fences off the dev/tooling and preview routes, nothing else", async () => {
    const body = await (await get("https://example.com")).text();
    const disallowed = [...body.matchAll(/Disallow: (\S+)/g)].map((m) => m[1]);
    expect(disallowed).toEqual(["/dev/", "/slice-simulator", "/preview/"]);
  });

  it("points at the sitemap with an absolute URL on the request origin", async () => {
    const body = await (await get("https://example.com")).text();
    expect(body).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("serves text/plain", async () => {
    const response = await get("https://example.com");
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });
});
