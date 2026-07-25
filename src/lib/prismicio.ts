import * as prismic from "@prismicio/client";
import {
  enableAutoPreviews,
  type CreateClientConfig,
} from "@prismicio/svelte/kit";
import config from "../../slicemachine.config.json";

export const repositoryName =
  import.meta.env.VITE_PRISMIC_ENVIRONMENT || config.repositoryName;

/**
 * True when the starter has not yet been wired to a real Prismic repository.
 * Prerender entry points (sitemap, dynamic [uid]) short-circuit to empty
 * results in that case so `pnpm build` succeeds on an unconfigured clone.
 */
export const isPlaceholderRepo = repositoryName === "your-prismic-repo-name";

// Both the native `page` type and the Blux-migration `catalog_page` type
// resolve to the same routes: a cloned repo populates only one, so a migrated
// site's documents link-resolve at "/" and "/:uid" just like a native one.
const routes: prismic.ClientConfig["routes"] = [
  {
    type: "page",
    uid: "home",
    path: "/",
  },
  {
    type: "page",
    path: "/:uid",
  },
  {
    type: "catalog_page",
    uid: "home",
    path: "/",
  },
  {
    type: "catalog_page",
    path: "/:uid",
  },
];

export const createClient = ({
  cookies,
  ...config
}: CreateClientConfig = {}) => {
  const client = prismic.createClient(repositoryName, {
    routes,
    ...config,
  });

  enableAutoPreviews({ client, cookies });

  return client;
};
