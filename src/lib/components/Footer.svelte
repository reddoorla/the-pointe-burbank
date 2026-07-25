<script lang="ts">
  import BrandIcon from "./BrandIcon.svelte";
  import type {
    FooterSocial,
    FooterItem,
    FooterImage,
    FooterColumn,
  } from "$lib/blux/site-config";

  interface Props {
    /** Leasing-contact columns (a migrated Blux site supplies these). When
     * present they take precedence over the site-config socials/text chrome. */
    columns?: FooterColumn[];
    /** Social links from the site config (empty → none rendered). */
    socials?: FooterSocial[];
    /** The copyright / rights line; falls back to a generic notice. */
    text?: string;
  }

  // Placeholder styling — restyle per project. `columns` (the shape the Blux
  // catalog pipeline emits in site-config.json) wins when a migrated site
  // supplies it; otherwise the site-config socials + rights line render (the
  // fleet default chrome).
  let { columns, socials = [], text }: Props = $props();

  const isImage = (i: FooterItem): i is FooterImage => "image" in i;

  // Only http(s) links open in a new tab; tel:/mailto: stay same-tab (repo
  // idiom, ProductDetail.svelte). Consistent shape — Svelte drops undefined
  // attributes — so target/rel can't drift between the text- and image-link
  // branches.
  const isExternal = (href: string) => /^https?:\/\//i.test(href);
  const linkAttrs = (href: string) => ({
    href,
    target: isExternal(href) ? "_blank" : undefined,
    rel: isExternal(href) ? "noopener noreferrer" : undefined,
  });

  // Blux network id → the BrandIcon glyph + an accessible label. Networks
  // BrandIcon can't draw are dropped rather than rendered as an empty link.
  const NETWORK: Record<string, { platform: string; label: string }> = {
    facebook: { platform: "facebook", label: "Facebook" },
    twitter: { platform: "twitter", label: "Twitter" }, // BrandIcon aliases → X
    x: { platform: "x", label: "X" },
    instagram: { platform: "instagram", label: "Instagram" },
    linkedin: { platform: "linkedin", label: "LinkedIn" },
    "linkedin-company": { platform: "linkedin", label: "LinkedIn" },
    pinterest: { platform: "pinterest", label: "Pinterest" },
    youtube: { platform: "youtube", label: "YouTube" },
    reddit: { platform: "reddit", label: "Reddit" },
  };

  const known = $derived(
    socials
      // `Object.hasOwn` guard: a network literally named "toString" or
      // "constructor" would otherwise resolve to an inherited Object.prototype
      // member (truthy) and slip past the filter, then crash on `.platform`.
      .map((s) => ({
        ...s,
        meta: Object.hasOwn(NETWORK, s.network)
          ? NETWORK[s.network]
          : undefined,
      }))
      .filter(
        (s): s is typeof s & { meta: { platform: string; label: string } } =>
          !!s.meta,
      ),
  );
</script>

{#snippet logo(img: FooterImage["image"])}
  <img
    src={img.url}
    alt={img.alt ?? ""}
    style={img.maxWidth ? `max-width:${img.maxWidth}` : undefined}
  />
{/snippet}

<footer class="mt-auto w-full px-8 py-12">
  {#if columns?.length}
    <div class="flex flex-col sm:flex-row justify-between gap-8">
      {#each columns as col, colIndex (colIndex)}
        <div class="flex flex-col gap-2">
          {#each col.items as item, itemIndex (itemIndex)}
            {#if isImage(item)}
              {#if item.href}
                <a {...linkAttrs(item.href)}>{@render logo(item.image)}</a>
              {:else}
                {@render logo(item.image)}
              {/if}
            {:else if item.href}
              <a {...linkAttrs(item.href)}>{item.text}</a>
            {:else}
              <p>{item.text}</p>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <div
      class="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row"
    >
      {#if known.length > 0}
        <ul class="flex items-center gap-4">
          <!-- Keyed by index: a network can repeat across footer blocks, and a
               duplicate key throws each_key_duplicate at hydration. -->
          {#each known as social, i (i)}
            <li>
              {#if social.href}
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.meta.label}
                  class="inline-flex min-h-11 min-w-11 items-center justify-center hover:opacity-70"
                >
                  <BrandIcon platform={social.meta.platform} class="h-5 w-5" />
                </a>
              {:else}
                <!-- No recovered url — render the glyph, but not as a dead link. -->
                <span
                  class="inline-flex min-h-11 min-w-11 items-center justify-center"
                  aria-label={social.meta.label}
                  role="img"
                >
                  <BrandIcon platform={social.meta.platform} class="h-5 w-5" />
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
      <p class="text-sm text-secondary">
        {text ?? `© ${new Date().getFullYear()} Company Name`}
      </p>
    </div>
  {/if}
</footer>
