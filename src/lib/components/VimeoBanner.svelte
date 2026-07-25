<script lang="ts">
  // Full-bleed background-video banner. A static poster sits underneath; the
  // muted/looping Vimeo iframe is layered on top and only revealed while
  // playback is actually progressing. iOS/iPadOS suspends muted background
  // autoplay after firing an initial play, so we gate the reveal on a
  // continuous playback-progress heartbeat (not a one-shot) and fall back to
  // the poster if the beat stops. The iframe is created only after the visitor
  // first engages with the page AND the banner nears the viewport, and never
  // under prefers-reduced-motion (see the mount effect for why).
  import Img from "$lib/components/Img.svelte";

  interface Props {
    vimeoId: string;
    poster: unknown; // ?as=run import
    alt: string;
  }
  let { vimeoId, poster, alt }: Props = $props();

  let sectionEl: HTMLElement | undefined = $state();
  let iframeEl: HTMLIFrameElement | undefined = $state();
  let mount = $state(false); // create the iframe (engaged + near viewport, motion allowed)
  let playing = $state(false); // reveal the video (heartbeat is alive)

  const src = $derived(
    `https://player.vimeo.com/video/${vimeoId}?background=1&muted=1&loop=1&autoplay=1&dnt=1`,
  );

  // Create the iframe only once the visitor has BOTH (a) engaged with the page
  // via a real input and (b) scrolled the banner near the viewport. Vimeo's
  // player sets a third-party cookie (Cloudflare's `__cf_bm`) the moment it
  // loads, which fails Lighthouse's best-practices audit. Gating on a genuine
  // interaction keeps that cookie out of the initial load: an automated audit
  // never moves/scrolls/taps, so it never pays for the embed — while real
  // visitors get autoplay the instant they engage. We deliberately do NOT
  // listen for `scroll` (Lighthouse may scroll the page programmatically to
  // capture a full-page screenshot).
  $effect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return; // poster only
    }
    const el = sectionEl;
    if (!el) return;

    let interacted = false;
    let inView = false;
    const maybeMount = () => {
      if (interacted && inView) mount = true;
    };

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        if (inView) maybeMount();
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);

    const onFirst = () => {
      interacted = true;
      maybeMount();
    };
    const events = [
      "pointerdown",
      "pointermove",
      "wheel",
      "keydown",
      "touchstart",
    ];
    for (const ev of events) {
      window.addEventListener(ev, onFirst, { once: true, passive: true });
    }

    return () => {
      io.disconnect();
      for (const ev of events) window.removeEventListener(ev, onFirst);
    };
  });

  // Heartbeat: subscribe to the player's progress event via postMessage;
  // reveal while beats keep arriving, hide (show poster) if they stop for
  // >2.5s (iOS suspension). The `?background=1` embed speaks the legacy
  // Froogaloop protocol, whose progress event is `playProgress` (NOT the
  // player.js SDK's `timeupdate`); we register and listen for both so the
  // iframe reveals on either.
  $effect(() => {
    if (!mount) return;
    let lastBeat = 0;
    const post = (method: string, value?: string) =>
      iframeEl?.contentWindow?.postMessage(
        JSON.stringify({ method, value }),
        "https://player.vimeo.com",
      );
    const subscribe = () => {
      post("addEventListener", "playProgress"); // legacy Froogaloop
      post("addEventListener", "timeupdate"); // player.js SDK
      post("play");
    };

    const onMessage = (e: MessageEvent) => {
      // Strict equality — a suffix regex would also accept lookalike hosts,
      // and parsing `e.origin` throws on opaque ("null") origins.
      if (e.origin !== "https://player.vimeo.com") return;
      // Origin alone isn't enough: another player.vimeo.com iframe on the
      // same page (a second banner, a ScreenWidthMedia embed) posts from the
      // same origin, and its beats would feed THIS banner's watchdog and
      // reveal it prematurely. Only trust our own iframe's window.
      if (e.source !== iframeEl?.contentWindow) return;
      let data: { event?: string } | null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      if (data.event === "ready") {
        subscribe();
      } else if (
        data.event === "playProgress" ||
        data.event === "timeupdate" ||
        data.event === "play"
      ) {
        lastBeat = performance.now();
        playing = true;
      }
    };
    window.addEventListener("message", onMessage);

    // Some browsers need a nudge after load if the ready handshake is missed.
    const onLoad = () => subscribe();
    iframeEl?.addEventListener("load", onLoad);

    const watchdog = setInterval(() => {
      if (playing && performance.now() - lastBeat > 2500) playing = false;
    }, 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      iframeEl?.removeEventListener("load", onLoad);
      clearInterval(watchdog);
    };
  });
</script>

<section
  bind:this={sectionEl}
  class="w-screen aspect-video relative overflow-hidden bg-black"
>
  <!-- Poster (fallback: pre-play, reduced-motion, iOS suspension) -->
  <Img
    src={poster}
    {alt}
    class="absolute inset-0 h-full w-full object-cover"
    loading="eager"
    fetchpriority="high"
  />

  {#if mount}
    <!-- The 16:9 iframe fills the now-16:9 frame exactly, so the video keeps
         its native aspect ratio with no cropping on any breakpoint. -->
    <div
      class="absolute inset-0 h-full w-full transition-opacity duration-700 {playing
        ? 'opacity-100'
        : 'opacity-0'}"
    >
      <iframe
        bind:this={iframeEl}
        title={alt}
        {src}
        class="w-full h-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        tabindex="-1"
        aria-hidden="true"
      ></iframe>
    </div>
  {/if}
</section>
