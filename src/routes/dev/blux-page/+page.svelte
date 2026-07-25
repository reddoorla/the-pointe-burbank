<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
  import { presentation, slices } from "./fixtures";
</script>

<!-- Hermetic Blux band fixture: the same SliceZone wiring a converted site's
     routes use, fed by the checked-in fixture manifest instead of Prismic +
     `blux convert` output. Feeds the CI axe audit (tests/a11y). -->
<SliceZone slices={slices as never} {components} context={{ presentation }} />
