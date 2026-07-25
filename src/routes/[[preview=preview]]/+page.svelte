<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
  import { loadPresentation } from "$lib/blux/presentation";
  import FrozenPage from "$lib/blux-frozen/FrozenPage.svelte";

  let { data } = $props();
</script>

{#if data.frozen}
  <!-- Frozen Blux homepage: the export's own settled markup rendered through
       <FrozenPage> (the root layout renders bare for a frozen page). -->
  <FrozenPage
    template={data.template}
    styleCss={data.styleCss}
    fontLinks={data.fontLinks}
    slots={data.slots}
  />
{:else}
  <!-- Per-band Blux presentation (block styles, backgrounds, grid trees) from
       the faithful-grid manifest. Empty until the site is converted with
       `blux convert`; SliceZone hands it to every slice as `context`. -->
  <SliceZone
    slices={data.page.data.slices}
    {components}
    context={{
      presentation: loadPresentation(),
      collections: data.collections,
    }}
  />
{/if}
