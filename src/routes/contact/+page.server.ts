import { env } from "$env/dynamic/private";
import { createIngestAction } from "@reddoorla/maintenance/forms";
import type { Actions, PageServerLoad } from "./$types";

// The root layout sets `prerender = "auto"`; a form `action` cannot run on a
// prerendered route ("Cannot prerender pages with actions"). Opt out — this
// route is genuinely dynamic.
export const prerender = false;

// Plant a per-request timestamp for the bot timing screen. `title` flows to
// the root layout's <Seo> (static routes set head via data, not their own tags).
export const load: PageServerLoad = () => ({
  formTs: Date.now(),
  title: "Contact",
});

export const actions: Actions = {
  default: createIngestAction({
    formType: "contact",
    getConfig: () => ({
      url: env.FORMS_INGEST_URL,
      token: env.FORMS_INGEST_TOKEN,
    }),
    buildPayload: (form, event) => ({
      name: form.get("name")?.toString(),
      email: form.get("email")?.toString(),
      phone: form.get("phone")?.toString(),
      message: form.get("message")?.toString(),
      // Full URL incl. query string so UTM/campaign params (?utm_source=…) are captured.
      sourceUrl: event.url.href,
      // Synthetic end-to-end probe marker (the fleet `form-e2e` audit). Forwarded
      // ONLY when the submitted form carries testMode=true — a real visitor never
      // sets it. Rides through as an extraField (no schema change); central ingest
      // recognizes it and routes the submission away from every real sink.
      testMode: form.get("testMode")?.toString() === "true" || undefined,
    }),
  }),
};
