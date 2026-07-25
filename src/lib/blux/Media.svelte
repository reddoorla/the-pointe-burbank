<script lang="ts">
  import type { RenderMedia } from "./presentation";

  type Props = {
    media: RenderMedia;
    class?: string;
    /** Eager for above-the-fold/LCP images; lazy everywhere else. */
    loading?: "lazy" | "eager";
  };
  let { media, class: passedClasses = "", loading = "lazy" }: Props = $props();

  // When the source carried an explicit display width, render at that width
  // (capped to the container) so in-flow images/logos/rules match the original
  // instead of stretching full-bleed. `aspect` reserves the box before load
  // (also for a foreground video, which carries an aspect but no width).
  const sizeStyle = $derived(
    media.width
      ? `width:${media.width}px;max-width:100%;height:auto` +
          (media.aspect ? `;aspect-ratio:100/${media.aspect}` : "")
      : media.aspect
        ? `aspect-ratio:100/${media.aspect}`
        : "",
  );

  // Honor a band background's `fit`/`position` by default: the source's
  // `background-size: auto` means a native-size decorative accent (→
  // object-fit:none), and `background-position` anchors it (e.g. a corner)
  // instead of centering. the-pointe deliberately DROPS both — its live site
  // hides the accent bands (live-tuned, not in the export) — and that stays a
  // the-pointe-local edit.
  const fitStyle = $derived(
    [
      media.fit
        ? `object-fit:${media.fit === "auto" ? "none" : media.fit}`
        : "",
      media.position ? `object-position:${media.position}` : "",
    ]
      .filter(Boolean)
      .join(";"),
  );

  const style = $derived(
    [sizeStyle, fitStyle].filter(Boolean).join(";") || undefined,
  );

  // Video playback: an absent `playback` = an ambient background loop (the Blux
  // default). When the source carried attributes, honor them exactly — a source
  // `<video controls playsinline>` is a user-initiated inline video, NOT a loop.
  const pb = $derived(media.playback);
  const ambient = $derived(!pb);
  const vControls = $derived(pb?.controls ?? false);
  const vAutoplay = $derived(ambient || (pb?.autoplay ?? false));
  const vLoop = $derived(ambient || (pb?.loop ?? false));
  const vMuted = $derived(ambient || (pb?.muted ?? false));
  const vPlaysinline = $derived(ambient || (pb?.playsinline ?? false));

  let videoEl: HTMLVideoElement | undefined = $state();

  // The global CSS reduce block can't stop <video autoplay loop>; gate
  // playback client-side like the repo's other motion (VimeoBanner, Slider).
  // A user-controlled video (no autoplay) is already paused, so this is a no-op
  // for it and only tames the ambient loops.
  $effect(() => {
    if (
      videoEl &&
      vAutoplay &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      videoEl.pause();
    }
  });
</script>

{#if media.kind === "video"}
  <video
    bind:this={videoEl}
    src={media.url}
    class={passedClasses}
    {style}
    controls={vControls}
    autoplay={vAutoplay}
    loop={vLoop}
    muted={vMuted}
    playsinline={vPlaysinline}
    preload="metadata"
  ></video>
{:else}
  <img
    src={media.url}
    alt={media.alt ?? ""}
    {loading}
    class={passedClasses}
    {style}
  />
{/if}
