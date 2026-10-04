import type { Handle } from "@sveltejs/kit";
import { isCmsFramedRoute, widenFrameAncestors } from "$lib/security/cms-framing";

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  const cmsFramed = isCmsFramedRoute(event.url.pathname);

  response.headers.set("X-Content-Type-Options", "nosniff");
  if (cmsFramed) {
    response.headers.delete("X-Frame-Options");
    const policy = response.headers.get("Content-Security-Policy");
    if (policy) response.headers.set("Content-Security-Policy", widenFrameAncestors(policy));
  } else {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
};
