<script lang="ts">
  import type { Snippet } from "svelte";
  import type { BandPresentation } from "./presentation";

  // The Blux content column: a max-width box, centered, carrying the band's own
  // side gutters + vertical rhythm (`_contentPadding`, e.g. "100px 4% 100px 4%")
  // and text alignment. Replaces the ad-hoc `max-w-screen-xl px-6 py-N
  // text-center` wrappers so margins/positions match the export's
  // blockcontainer (max-width 1280, 4% gutters) at every viewport. Defaults
  // apply when a band omits a hint.
  type Props = {
    band: BandPresentation | null;
    children: Snippet;
    /** Extra classes on the content box (e.g. z-index for over-background heroes). */
    class?: string;
  };
  let { band, children, class: extra = "" }: Props = $props();

  const maxW = $derived(band?.style?.["_max-content-width"]);
  const pad = $derived(band?.style?.["_contentPadding"]);
  const align = $derived(band?.style?.["text-align"]);
  // The export's mobile override (≤700px in source). When present, padding moves
  // off the inline style onto the `.band-pad` class (app.css) so it can respond.
  const padMobile = $derived(band?.style?.["_contentPaddingMobile"]);
  const padValue = $derived(pad && pad !== "0px" ? pad : "0 4%");
  const style = $derived(
    [
      `max-width:${maxW && maxW !== "none" ? maxW : "1280px"}`,
      "margin-inline:auto",
      // With a mobile override the padding rides `--band-pad`/`--band-pad-m` for
      // the `.band-pad` class to consume; otherwise it stays a fixed inline value.
      padMobile
        ? `--band-pad:${padValue};--band-pad-m:${padMobile}`
        : `padding:${padValue}`,
      align ? `text-align:${align}` : "",
    ]
      .filter(Boolean)
      .join(";"),
  );

  // Some bands set their copy in a narrow column over the background, positioned
  // to one side (left/right) independently of the text alignment inside it. When
  // `_column-width` is present, wrap the content in that column and hug it to the
  // `_column-side` edge of the content box (default left).
  const colW = $derived(band?.style?.["_column-width"]);
  const colSide = $derived(band?.style?.["_column-side"]);
  const colStyle = $derived(
    colW
      ? `max-width:${colW};` +
          (colSide === "right"
            ? "margin-inline-start:auto"
            : colSide === "center"
              ? "margin-inline:auto"
              : "margin-inline-end:auto")
      : "",
  );
</script>

<div class="w-full{padMobile ? ' band-pad' : ''} {extra}" {style}>
  {#if colW}
    <div style={colStyle}>{@render children()}</div>
  {:else}
    {@render children()}
  {/if}
</div>
