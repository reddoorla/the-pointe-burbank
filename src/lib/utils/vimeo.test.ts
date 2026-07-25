import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkVimeoVideo } from "./vimeo";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkVimeoVideo", () => {
  it("returns false for an empty ID without hitting the network", async () => {
    expect(await checkVimeoVideo("")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns true when oEmbed responds ok", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect(await checkVimeoVideo("76979871")).toBe(true);
  });

  it("returns false when oEmbed responds non-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    expect(await checkVimeoVideo("76979871")).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await checkVimeoVideo("76979871")).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("URL-encodes the video ID inside the oEmbed url param", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await checkVimeoVideo("123/unlisted&hash");
    const requested = fetchMock.mock.calls[0][0] as string;
    const url = new URL(requested);
    // The decoded param must round-trip the full inner URL — an unencoded
    // "&" would have split it into a second query param.
    expect(url.searchParams.get("url")).toBe(
      "https://vimeo.com/123/unlisted&hash",
    );
  });
});
