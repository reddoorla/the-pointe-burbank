<script lang="ts">
  // Progressive-loading wrapper around @zerodevx/svelte-img: the image renders
  // blurred (`.progressive-img` in app.css) and sharpens once the underlying
  // <img> finishes — or fails — loading. `src` must be a vite-imagetools
  // `?as=run` import; SvelteImg renders nothing for plain string URLs.
  import SvelteImg from "@zerodevx/svelte-img";

  type Props = {
    src: unknown; // ?as=run import
    class?: string;
    [key: string]: unknown;
  };

  let { src, class: passedClasses = "", ...rest }: Props = $props();

  let imgEl: HTMLImageElement | undefined = $state();
  let loaded = $state(false);

  // An image can be `complete` before this effect attaches listeners (cache
  // hit, or a pre-hydration failure). `complete` is terminal either way: the
  // load OR error event already fired and will never refire, so listening now
  // would leave the blur stuck forever. naturalWidth doesn't matter — a
  // failed image (complete, naturalWidth === 0) is just as done as a decoded
  // one, and we unblur on error anyway (see the error listener below).
  $effect(() => {
    const el = imgEl;
    if (!el) return;
    if (el.complete) {
      loaded = true;
      return;
    }
    const onDone = () => (loaded = true);
    el.addEventListener("load", onDone);
    el.addEventListener("error", onDone);
    return () => {
      el.removeEventListener("load", onDone);
      el.removeEventListener("error", onDone);
    };
  });
</script>

<SvelteImg
  {src}
  {...rest}
  bind:ref={imgEl}
  class={`progressive-img${loaded ? " progressive-img--loaded" : ""}${passedClasses ? " " + passedClasses : ""}`}
/>
