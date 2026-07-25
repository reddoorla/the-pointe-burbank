import * as prismic from "@prismicio/client";
import {
  enableAutoPreviews,
  type CreateClientConfig,
} from "@prismicio/svelte/kit";
import config from "../../slicemachine.config.json";
import { frozenArtifacts } from "./blux-frozen/artifacts";

export const repositoryName =
  import.meta.env.VITE_PRISMIC_ENVIRONMENT || config.repositoryName;

/**
 * True when the starter has not yet been wired to a real Prismic repository.
 * Prerender entry points (sitemap, dynamic [uid]) short-circuit to empty
 * results in that case so `pnpm build` succeeds on an unconfigured clone.
 */
export const isPlaceholderRepo = repositoryName === "your-prismic-repo-name";

/**
 * True when this repo committed frozen-page artifacts (a Blux freeze site). Such
 * a repo's Prismic contains ONLY the `frozen_page` type — never native `page` or
 * `catalog_page`. Prismic's routes resolver rejects EVERY query whose `routes`
 * config names a type absent from the repo, so the native page/catalog routes
 * below would 500 on every request against a frozen repo. Frozen pages render
 * from a committed template (never `doc.url`), so they need no link-resolution
 * routes: a frozen site uses a routes-free client, which also lets
 * `getAllByType("page"|"catalog_page")` resolve to an empty list instead of
 * erroring.
 */
export const isFrozenSite = Object.keys(frozenArtifacts).length > 0;

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
    routes: isFrozenSite ? undefined : routes,
    ...config,
  });

  enableAutoPreviews({ client, cookies });

  return client;
};
