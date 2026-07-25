<script lang="ts">
  import {
    substitute,
    styleTag,
    type SlotValue,
  } from "$lib/blux-frozen/substitute";

  // A frozen page = the Blux export's own settled markup (byte-faithful layout,
  // 316 inline styles) with editable leaves tokenized. We inject the extracted
  // <style> + font links and substitute the tokens with current content, so the
  // render matches the live site exactly while copy/images stay CMS-editable.

  interface FrozenSlot {
    key: string;
    kind: "text" | "image";
    text?: string;
    url?: string;
  }

  let {
    template,
    styleCss,
    fontLinks = [],
    slots,
  }: {
    /** Tokenized `<body>` inner HTML from the freeze (repo build artifact). */
    template: string;
    /** Extracted `<style>` block + reveal-force override. */
    styleCss: string;
    /** External stylesheet hrefs (Google Fonts) — load-bearing for metrics. */
    fontLinks?: string[];
    /** Content slots: image → resolved url, text → HTML-safe string. */
    slots: FrozenSlot[];
  } = $props();

  const values = $derived(
    new Map<string, SlotValue>(
      slots.map((s) => [
        s.key,
        s.kind === "image" ? { url: s.url } : { text: s.text },
      ]),
    ),
  );
  const html = $derived(substitute(template, values));
</script>

<svelte:head>
  {#each fontLinks as href (href)}
    <link rel="stylesheet" {href} />
  {/each}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted freeze-emitted style block (build-time, no user input) -->
  {@html styleTag(styleCss)}
</svelte:head>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted freeze template; tokens substituted for CMS content -->
{@html html}
