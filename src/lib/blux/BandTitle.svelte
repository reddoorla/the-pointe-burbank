<script lang="ts">
  import type { BandPresentation } from "./presentation";

  // Title/hero band heading, faithful to the Blux two-line title pattern: a
  // small eyebrow label sitting above a large display line. The `heading`
  // field carries the eyebrow and `subtitle` the display line — the export
  // models it that way, so the visually-dominant display line becomes the
  // semantic <h2>. A band with only a heading (a closing CTA) renders as a
  // lone display line at the source heading's own level.
  //
  // Type roles come from the manifest's text metadata (`band.text`, emitted
  // since reddoor-maintenance#394): heading → `headingRole`/`headingLevel`,
  // subtitle → `subtitleRole`. No role → no `txt-role-*` class, so the element
  // keeps the site's base type. the-pointe hard-codes its text5/text12/text11
  // roles instead (it predates the metadata) — that stays a the-pointe edit.
  type Props = {
    heading?: string | null;
    subtitle?: string | null;
    text?: BandPresentation["text"];
  };
  let { heading, subtitle, text }: Props = $props();

  const roleClass = (role?: string) => (role ? `txt-role-${role}` : "");
  // Heading-only mode renders at the source heading's level (clamped h1–h6).
  const level = $derived(Math.min(Math.max(text?.headingLevel ?? 2, 1), 6));
</script>

{#if subtitle}
  {#if heading}<p class="{roleClass(text?.headingRole)} mb-4">
      {heading}
    </p>{/if}
  <!-- Honor the source's hard line breaks (Blux `<br>` in the display title),
       carried as newlines. HTML-escaped interpolation keeps this safe. -->
  <h2 class={roleClass(text?.subtitleRole)}>
    {#each subtitle.split("\n") as line, i (i)}{#if i}<br />{/if}{line}{/each}
  </h2>
{:else if heading}
  <svelte:element this={`h${level}`} class={roleClass(text?.headingRole)}>
    {heading}
  </svelte:element>
{/if}
