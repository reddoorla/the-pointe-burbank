<script lang="ts">
  import {
    SITE_NAME,
    SITE_LOCALE,
    DEFAULT_DESCRIPTION,
    canonicalUrl,
    resolveOgImage,
    jsonLdScript,
  } from "$lib/seo";

  interface Props {
    /** The page title — used verbatim for <title> and og/twitter:title.
     *  Compose any "| Site" suffix before passing it in. */
    title: string;
    description?: string;
    /** og:image source: a Prismic URL (cropped to the card canvas), an
     *  absolute URL, or a root-relative static asset (/og-default.png). */
    image?: string;
    imageAlt?: string;
    /** The live page URL (page.url). Canonical + og:url are derived from it
     *  with the query string and /preview segment stripped. */
    url: URL | string;
    /** og:type — "website" (default) for most pages, "article" for posts. */
    type?: string;
    siteName?: string;
    locale?: string;
    noindex?: boolean;
    /** Structured data object(s); serialized safely into JSON-LD scripts. */
    jsonLd?: object | object[];
  }

  let {
    title,
    description = DEFAULT_DESCRIPTION,
    image,
    imageAlt,
    url,
    type = "website",
    siteName = SITE_NAME,
    locale = SITE_LOCALE,
    noindex = false,
    jsonLd,
  }: Props = $props();

  const canonical = $derived(canonicalUrl(url));
  const origin = $derived(
    typeof url === "string" ? new URL(url).origin : url.origin,
  );
  const og = $derived(resolveOgImage(image, origin));
  const jsonLdNodes = $derived(
    jsonLd == null ? [] : Array.isArray(jsonLd) ? jsonLd : [jsonLd],
  );
</script>

<svelte:head>
  <title>{title}</title>
  {#if description}
    <meta name="description" content={description} />
  {/if}
  <link rel="canonical" href={canonical} />
  {#if noindex}
    <meta name="robots" content="noindex" />
  {/if}

  <meta property="og:type" content={type} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:locale" content={locale} />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={title} />
  {#if description}
    <meta property="og:description" content={description} />
  {/if}
  {#if og}
    <meta property="og:image" content={og.url} />
    <meta property="og:image:alt" content={imageAlt ?? title} />
    {#if og.width}
      <meta property="og:image:width" content={String(og.width)} />
    {/if}
    {#if og.height}
      <meta property="og:image:height" content={String(og.height)} />
    {/if}
  {/if}

  <meta name="twitter:card" content={og ? "summary_large_image" : "summary"} />
  <meta name="twitter:title" content={title} />
  {#if description}
    <meta name="twitter:description" content={description} />
  {/if}
  {#if og}
    <meta name="twitter:image" content={og.url} />
    <meta name="twitter:image:alt" content={imageAlt ?? title} />
  {/if}

  {#each jsonLdNodes as node, i (i)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html jsonLdScript(node)}
  {/each}
</svelte:head>
