import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the vi.mock factories (also hoisted) can close over the same
// mutable objects. `isPlaceholderRepo` is exposed as a getter so the endpoint's
// live ES binding re-reads it each call; the env objects are mutated in place
// (never reassigned) so the module keeps the reference the factory captured.
const mocks = vi.hoisted(() => ({
  isPlaceholderRepo: false,
  getRepository: vi.fn<() => Promise<unknown>>(),
  privateEnv: {} as Record<string, string | undefined>,
  publicEnv: {} as Record<string, string | undefined>,
}));

vi.mock("$lib/prismicio", () => ({
  createClient: () => ({ getRepository: mocks.getRepository }),
  get isPlaceholderRepo() {
    return mocks.isPlaceholderRepo;
  },
}));
vi.mock("$env/dynamic/private", () => ({ env: mocks.privateEnv }));
vi.mock("$env/dynamic/public", () => ({ env: mocks.publicEnv }));

import { GET } from "./+server";

type HealthBody = {
  ok: boolean;
  prismic: "ok" | "error" | "skipped";
  forms: {
    ingestUrl: boolean;
    ingestToken: boolean;
    turnstile: boolean;
    testMode: boolean;
  };
};

// Spy fetch handed to the handler. The endpoint passes it to createClient (which
// is mocked and ignores it), so a clean run leaves this untouched — that is how
// we prove /health never POSTs to the ingest.
const fetchSpy = vi.fn();

async function callHealth(): Promise<{ status: number; body: HealthBody }> {
  const res = await GET({
    fetch: fetchSpy,
  } as unknown as Parameters<typeof GET>[0]);
  return { status: res.status, body: (await res.json()) as HealthBody };
}

beforeEach(() => {
  mocks.isPlaceholderRepo = false;
  mocks.getRepository.mockReset();
  delete mocks.privateEnv.FORMS_INGEST_URL;
  delete mocks.privateEnv.FORMS_INGEST_TOKEN;
  delete mocks.publicEnv.PUBLIC_TURNSTILE_SITE_KEY;
  fetchSpy.mockReset();
});

describe("/health GET", () => {
  it("reports prismic 'ok' and ok:true when getRepository resolves", async () => {
    mocks.getRepository.mockResolvedValue({ id: "repo" });
    const { status, body } = await callHealth();
    expect(status).toBe(200);
    expect(body.prismic).toBe("ok");
    expect(body.ok).toBe(true);
  });

  it("reports prismic 'error' and ok:false when getRepository rejects", async () => {
    mocks.getRepository.mockRejectedValue(new Error("network down"));
    const { body } = await callHealth();
    expect(body.prismic).toBe("error");
    expect(body.ok).toBe(false);
  });

  it("reports prismic 'skipped' (ok:true) and never calls Prismic on the placeholder repo", async () => {
    mocks.isPlaceholderRepo = true;
    const { body } = await callHealth();
    expect(body.prismic).toBe("skipped");
    expect(body.ok).toBe(true);
    expect(mocks.getRepository).not.toHaveBeenCalled();
  });

  it("maps forms env presence to booleans and always declares testMode forwarding", async () => {
    mocks.getRepository.mockResolvedValue({});
    mocks.privateEnv.FORMS_INGEST_URL = "https://ingest.example/submit";
    // FORMS_INGEST_TOKEN intentionally left unset.
    mocks.publicEnv.PUBLIC_TURNSTILE_SITE_KEY = "0x_site_key";
    const { body } = await callHealth();
    expect(body.forms).toEqual({
      ingestUrl: true,
      ingestToken: false,
      turnstile: true,
      // Not env-derived: this deploy's contact buildPayload forwards the
      // marker, so the declaration is unconditional. The fleet form-e2e probe
      // refuses to submit to any site whose /health omits it.
      testMode: true,
    });
  });

  it("never POSTs to the ingest (public, unauthenticated endpoint)", async () => {
    mocks.getRepository.mockResolvedValue({});
    mocks.privateEnv.FORMS_INGEST_URL = "https://ingest.example/submit";
    mocks.privateEnv.FORMS_INGEST_TOKEN = "secret";
    await callHealth();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
