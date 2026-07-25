<script lang="ts">
  import { animateIn } from "$lib/actions/animateIn";
  import ContentWidth from "$lib/components/ContentWidth.svelte";

  let triggered = $state(false);
</script>

<div class="min-h-screen flex flex-col items-center justify-center gap-4 px-8">
  <h1 class="text-4xl font-bold">use:animateIn demo</h1>
  <p class="text-secondary">Scroll down to see reveal animations.</p>
  <p class="text-secondary text-sm">↓</p>
</div>

<section class="max-w-4xl mx-auto px-8 pb-32 space-y-16">
  <div>
    <h2 class="text-xl font-semibold mb-3">Default viewport reveal</h2>
    <div use:animateIn class="p-8 bg-light rounded text-center">
      <code>use:animateIn</code> — 2400ms fade + 50% slide-up, first-intersection,
      position-staggered
    </div>
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">
      Position-based stagger (three columns)
    </h2>
    <div class="grid grid-cols-3 gap-4">
      <div use:animateIn class="p-6 bg-light rounded text-center text-sm">
        Left (small delay)
      </div>
      <div use:animateIn class="p-6 bg-light rounded text-center text-sm">
        Center
      </div>
      <div use:animateIn class="p-6 bg-light rounded text-center text-sm">
        Right (max delay)
      </div>
    </div>
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">Custom duration (800ms)</h2>
    <div
      use:animateIn={{ duration: 800 }}
      class="p-8 bg-light rounded text-center"
    >
      <code>{`use:animateIn={{ duration: 800 }}`}</code> — snappier reveal
    </div>
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">Custom translateY (24px)</h2>
    <div
      use:animateIn={{ translateY: "24px" }}
      class="p-8 bg-light rounded text-center"
    >
      <code>{`use:animateIn={{ translateY: "24px" }}`}</code> — small slide instead
      of half-height
    </div>
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">
      No stagger (<code>delayMax: 0</code>)
    </h2>
    <div class="grid grid-cols-3 gap-4">
      <div
        use:animateIn={{ delayMax: 0 }}
        class="p-6 bg-light rounded text-center text-sm"
      >
        All
      </div>
      <div
        use:animateIn={{ delayMax: 0 }}
        class="p-6 bg-light rounded text-center text-sm"
      >
        Reveal
      </div>
      <div
        use:animateIn={{ delayMax: 0 }}
        class="p-6 bg-light rounded text-center text-sm"
      >
        Together
      </div>
    </div>
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">
      Index-based stagger (<code>stagger</code> + <code>index</code>)
    </h2>
    <p class="text-secondary text-sm mb-3">
      A clean sequential reveal for grids/columns, where the horizontal-position
      heuristic doesn't sequence rows.
    </p>
    <div class="grid grid-cols-2 gap-4">
      {#each ["First", "Second", "Third", "Fourth"] as cell, i (cell)}
        <div
          use:animateIn={{ stagger: 120, index: i }}
          class="p-6 bg-light rounded text-center text-sm"
        >
          {cell} (index {i} → {i * 120}ms)
        </div>
      {/each}
    </div>
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">
      Through <code>&lt;ContentWidth animateInOnScroll&gt;</code>
    </h2>
    <ContentWidth animateInOnScroll>
      <div class="p-8 bg-light rounded text-center w-full">
        The <code>animateInOnScroll</code> prop applies
        <code>use:animateIn</code>
        to the inner wrapper.
      </div>
    </ContentWidth>
  </div>

  <div class="h-[40vh] flex items-center justify-center text-secondary">
    (scroll gap so the next section starts off-screen)
  </div>

  <div>
    <h2 class="text-xl font-semibold mb-3">
      Triggered mode (boolean shorthand)
    </h2>
    <div class="flex flex-col items-start gap-4">
      <button
        type="button"
        onclick={() => (triggered = !triggered)}
        class="px-4 py-2 border border-primary rounded bump"
      >
        Toggle trigger — currently <strong>{triggered}</strong>
      </button>
      <div
        use:animateIn={triggered}
        class="p-8 bg-light rounded text-center w-full"
      >
        <code>{`use:animateIn={triggered}`}</code> — flips on button press, no viewport
        observer
      </div>
    </div>
  </div>
</section>
