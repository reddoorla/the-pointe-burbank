<script lang="ts">
  import {
    PrismicImage,
    PrismicLink,
    PrismicRichText,
  } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import type { BluxCellData } from "$lib/blux-catalog/cell";
  import { gridCellBasis } from "$lib/blux-catalog/layout";
  import Self from "./BluxCell.svelte";

  let { cell, basis }: { cell: BluxCellData; basis?: string } = $props();
  let sub = $derived(cell.subgrid ?? []);
  let subBases = $derived(
    sub.map((s) => gridCellBasis(s.width || undefined, sub.length || 1)),
  );

  // "H:W"/"W:H" ratio string → a CSS aspect-ratio; used only by cover media.
  let mediaRatio = $derived(
    cell.media_ratio ? cell.media_ratio.replace(":", " / ") : undefined,
  );

  let style = $derived(
    [
      basis ? `--cell-basis:${basis}` : "",
      mediaRatio ? `--media-ratio:${mediaRatio}` : "",
      cell.background_color ? `background-color:${cell.background_color}` : "",
      cell.content_padding ? `padding:${cell.content_padding}` : "",
    ]
      .filter(Boolean)
      .join(";"),
  );
</script>

<div
  class="blux-cell"
  data-kind={cell.kind}
  data-valign={cell.valign || undefined}
  {style}
>
  {#if isFilled.image(cell.media)}
    <div
      class="blux-cell__media"
      data-ratio={cell.media_ratio}
      data-cover={cell.cover || undefined}
    >
      <PrismicImage field={cell.media} />
    </div>
  {/if}
  {#if isFilled.keyText(cell.image_embed)}
    <div
      class="blux-cell__media"
      data-ratio={cell.media_ratio}
      data-cover={cell.cover || undefined}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration <img>, sanitized at Emit; src rewritten to the Prismic-hosted url at migrate. Doubly-nested subgrid media ride a Text field because the Migration API can't resolve depth-2 Image-field refs. -->
      {@html cell.image_embed}
    </div>
  {/if}
  {#if isFilled.richText(cell.title)}
    {#if cell.title_role}
      <div class="txt-role-{cell.title_role}">
        <PrismicRichText field={cell.title} />
      </div>
    {:else}<PrismicRichText field={cell.title} />{/if}
  {/if}
  {#if isFilled.keyText(cell.body_html)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage like embed_html (the scalpel sanitizer strips active content but keeps the txt-role-* class the role sizing needs) -->
    <div class="blux-cell__body">{@html cell.body_html}</div>
  {/if}
  {#if isFilled.keyText(cell.embed_html)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted Blux migration HTML, sanitized at the Emit stage (spec §6) -->
    {@html cell.embed_html}
  {/if}
  {#if isFilled.link(cell.link)}<PrismicLink field={cell.link}
      >{cell.link_label || "Read more"}</PrismicLink
    >{/if}
  {#if sub.length}
    <div class="blux-subgrid" data-cells={sub.length}>
      {#each sub as s, i (s)}<Self cell={s} basis={subBases[i]} />{/each}
    </div>
  {/if}
</div>
