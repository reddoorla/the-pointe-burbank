import type { RequestHandler } from "./$types";

/**
 * CSP violation reports land here. Browsers POST either the legacy
 * `application/csp-report` body or the modern `application/reports+json`
 * batched body when `report-uri` / `report-to` directives are set.
 *
 * In production, forward to a real sink (Sentry, Datadog, Logflare).
 */
export const POST: RequestHandler = async ({ request }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = await request.text();
  }
  console.warn("[csp-report]", JSON.stringify(payload));
  return new Response(null, { status: 204 });
};
