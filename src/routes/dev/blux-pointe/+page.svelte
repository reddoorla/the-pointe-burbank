<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
  import themeCss from "./theme.css?raw";

  // Fidelity-gate harness: renders the real the-pointe catalog page through the
  // exact production SliceZone wiring (same `components`, same
  // `context.collections` contract as the [uid] routes), fed by the committed
  // fixture. Chrome (nav links + footer columns) is NOT rendered here — it
  // rides page data into the app layout's Nav/Footer, so it appears exactly
  // once. The emitted theme.css is injected so the visual pass sees the roles/
  // buttons CSS (the @theme custom-property block is a Tailwind build-time
  // directive the browser ignores at runtime — full palette fidelity is a
  // deployment step: drop theme.css into src/blux-theme.css and rebuild).
  let { data } = $props();
</script>

<svelte:head>
  <title>the-pointe catalog fidelity gate</title>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted emitted theme.css fixture (build-time, no user input) -->
  {@html `<style>${themeCss}</style>`}
</svelte:head>

<SliceZone
  slices={data.slices as never}
  {components}
  context={{ collections: data.collections }}
/>
