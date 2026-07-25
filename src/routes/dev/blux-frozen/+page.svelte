<script lang="ts">
  import FrozenPage from "$lib/blux-frozen/FrozenPage.svelte";
  let { data } = $props();
</script>

<FrozenPage
  template={data.template}
  styleCss={data.styleCss}
  fontLinks={data.fontLinks}
  slots={data.slots}
/>
