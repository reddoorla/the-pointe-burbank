<script lang="ts">
  import type { RenderNode, MapRenderConfig } from "./presentation";
  import { rowCellBases } from "./presentation";
  import Media from "./Media.svelte";
  import LocationMap from "./LocationMap.svelte";
  import Grid from "./Grid.svelte";

  type Props = {
    node: RenderNode;
    map?: MapRenderConfig;
    /** Shared active-toggle state linking the LocationMap's tabs to a
     * `panels: true` row elsewhere in the same band tree. The outermost Grid
     * creates it and threads it down; LocationMap writes the selected index,
     * the panels row shows only that cell (the Blux clickMap wiring). */
    panelState?: { active: number };
  };
  let { node, map, panelState }: Props = $props();

  // Own state doubles as the shared object at the tree root (no prop passed);
  // nested Grids receive the root's instance so every level sees one index.
  const ownPanelState = $state({ active: 0 });
  const panels = $derived(panelState ?? ownPanelState);

  const roleClass = (role?: string) => (role ? `txt-role-${role}` : "");

  // A text leaf's role class plus the style deviations the export carries on it.
  // color/padding (and any other keys) apply inline at every width; margin-right
  // is desktop-only in the source (reset ≤800px), so it rides a `--node-mr`
  // custom property consumed by the md:-scoped `mr-(--node-mr)` class — never an
  // unconditional inline margin that would leak onto mobile.
  const textStyle = (role?: string, style?: Record<string, string>) => {
    const mr = style?.["margin-right"];
    const decls = style
      ? Object.entries(style)
          .filter(([k]) => k !== "margin-right")
          .map(([k, v]) => `${k}:${v}`)
      : [];
    if (mr) decls.push(`--node-mr:${mr}`);
    return {
      class: [roleClass(role), mr ? "md:mr-(--node-mr)" : ""]
        .filter(Boolean)
        .join(" "),
      style: decls.length ? decls.join(";") : undefined,
    };
  };

  // A container node (row/stack) may carry a "card" box — a peeled Blux
  // wrapper's inline background-color/padding the emit stage threaded onto the
  // node. Applied inline so the box wraps the whole node (e.g. band 3's white
  // stats card). Underscore-prefixed keys are presentation HINTS (e.g.
  // `_valign`) consumed by the layout below, never valid CSS — strip them.
  const containerStyle = (style?: Record<string, string>) => {
    const decls = style
      ? Object.entries(style)
          .filter(([k]) => !k.startsWith("_"))
          .map(([k, v]) => `${k}:${v}`)
      : [];
    return decls.length ? decls.join(";") : undefined;
  };

  // Does a cell's node carry the `_valign: middle` hint (a peeled valignmiddle
  // wrapper)? Only container/text nodes have a style slot.
  const valignMiddle = (n: RenderNode) =>
    "style" in n && n.style?.["_valign"] === "middle";

  // `_fill: column` — the node sits in a cagridFlexHeight grid cell: the
  // original stretches the cell's block to the full row height, so its paint
  // covers the whole column, not just the content box.
  const fillColumn = (n: RenderNode) =>
    "style" in n && n.style?.["_fill"] === "column";
</script>

<!-- Render-faithful fallback: reconstructs a band's parsed node tree.
     HTML strings are baked by our own emit stage — same trust class as
     Prismic rich text. A widget:map mounts the real LocationMap when a
     map config is threaded down from the band; other widget types still
     render a mount placeholder. -->
{#if node.kind === "row" && node.panels}
  <!-- Toggle-switched map panels: exactly one cell (the active toggle's panel)
       is visible; the rest stay mounted but hidden — mirroring the original's
       display:none siblings so lazily-loaded panel images survive switching. -->
  <div
    class="w-full"
    style={containerStyle(node.style)}
    data-grid-row
    data-panels
  >
    {#each node.cells as cell, i (i)}
      <div data-grid-cell class={i === panels.active ? "" : "hidden"}>
        <Grid node={cell.node} {map} panelState={panels} />
      </div>
    {/each}
  </div>
{:else if node.kind === "row"}
  {@const bases = rowCellBases(node.cells)}
  <!-- gap-y spaces rows that wrap to their own line (stacked media/text bands
       and mobile) with Blux's inter-block rhythm. md:gap-x-[4%] is Blux's
       column gutter between side-by-side cells (md: up); it's reserved back out
       of each cell's basis by rowCellBases (calc(basis - share%)) so the columns
       still fit one flex line instead of the last cell wrapping. Keep the 4%
       here in sync with GRID_GUTTER in presentation.ts. Cells never grow: Blux
       columns are fixed percentages, so a wrapping grid's short last line keeps
       the same cell widths as the full lines above it. -->
  <!-- A row that pins its own box and centers (min-height + _valign, the
       nested block-in-cell parsed to a grid) packs its wrapped lines mid-box
       via content-center — the row analogue of the stack's flex centering. -->
  <div
    class="flex w-full flex-wrap gap-y-10 md:gap-x-[4%] {valignMiddle(node) &&
    node.style?.['min-height']
      ? 'content-center'
      : ''} {fillColumn(node) ? 'h-full' : ''}"
    style={containerStyle(node.style)}
    data-grid-row
  >
    {#each node.cells as cell, i (i)}
      <!-- A cell whose node carries the `_valign: middle` hint (a peeled
           valignmiddle wrapper) centers against its row siblings — the
           original's side captions sit centered on their photos. -->
      <div
        data-grid-cell
        class="min-w-0 basis-full md:basis-(--cell-basis) {valignMiddle(
          cell.node,
        )
          ? 'self-center'
          : ''}"
        style:--cell-basis={bases[i] ?? "auto"}
      >
        <Grid node={cell.node} {map} panelState={panels} />
      </div>
    {/each}
  </div>
{:else if node.kind === "stack"}
  <!-- Blux stacks blocks in NORMAL FLOW: the vertical rhythm is the text
       styles' own block margins (txt-role-* margin, e.g. Grid Titles' 10px 0),
       collapsing between neighbors exactly like the original — not a flex gap,
       which can't collapse and overshoots. flow-root CONTAINS the children's
       margins at the stack boundary, like the original's block-content
       clearfix — a grid cell's stack keeps its blocks' margins inside the
       cell instead of leaking them into (or collapsing with) its siblings.
       A stack may also carry a card box (a peeled wrapper's fill/inset). -->
  {#snippet stackChildren()}
    {#each node.children as child, i (i)}
      <Grid node={child} {map} panelState={panels} />
    {/each}
  {/snippet}
  {#if node.style?.["_overlay"]}
    <!-- An overlay tile (a feed grid's `layout: behind` card): the image fills
         a fixed-aspect box and the caption sits OVER it, revealed on hover — so
         a tile is only as tall as its image, not image + a caption row below.
         The first child is the media (cover fill); the rest are the caption. -->
    {@const kids = node.children}
    {@const mediaChild = kids[0]?.kind === "media" ? kids[0] : undefined}
    {@const captionChildren = mediaChild ? kids.slice(1) : kids}
    <div
      class="group relative w-full overflow-hidden"
      style="aspect-ratio: {node.style['_overlay'].replace(':', ' / ')}"
    >
      {#if mediaChild}
        <Media
          media={mediaChild.media}
          class="absolute inset-0 h-full w-full object-cover"
        />
      {/if}
      <!-- Hover-reveals on pointer devices (faithful to the source's
           layout:behind). But hover never fires on touch (the dominant traffic
           for these pages), so on hover-less devices the caption stays visible
           instead of being permanently hidden; focus-within covers keyboard. -->
      <div
        class="absolute inset-0 flex flex-col gap-1 p-2.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 {node
          .style['_overlayValign'] === 'top'
          ? 'justify-start'
          : 'justify-center'}"
        style="background: {node.style['_overlayColor'] ??
          'rgba(0,0,0,0.55)'}; color: #fff"
      >
        {#each captionChildren as child, i (i)}
          <Grid node={child} {map} panelState={panels} />
        {/each}
      </div>
    </div>
  {:else if valignMiddle(node) && node.style?.["min-height"]}
    <!-- A nested block-in-cell that pins its own box (min-height) and centers
         its content in it (a peeled valignmiddle container) — e.g. an 80vh
         gradient panel whose copy sits mid-box. The flex column does the
         centering; the inner flow-root keeps the normal-flow rhythm (flex
         items' margins don't collapse, so children can't be items directly).
         `_fill: column` (a cagridFlexHeight cell) stretches the box to the
         full row height so the paint covers the whole column. -->
    <div
      class="flex flex-col justify-center {fillColumn(node) ? 'h-full' : ''}"
      style={containerStyle(node.style)}
    >
      <div class="w-full flow-root">{@render stackChildren()}</div>
    </div>
  {:else}
    <div
      class="flow-root {fillColumn(node) ? 'h-full' : ''}"
      style={containerStyle(node.style)}
    >
      {@render stackChildren()}
    </div>
  {/if}
{:else if node.kind === "heading"}
  {@const ts = textStyle(node.role, node.style)}
  <svelte:element
    this={`h${Math.min(Math.max(node.level, 1), 6)}`}
    class={ts.class}
    style={ts.style}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html node.html}
  </svelte:element>
{:else if node.kind === "body"}
  {@const ts = textStyle(node.role, node.style)}
  <div class={ts.class} style={ts.style}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html node.html}
  </div>
{:else if node.kind === "subtitle"}
  {@const ts = textStyle(node.role, node.style)}
  <p class={ts.class} style={ts.style}>{node.text}</p>
{:else if node.kind === "media"}
  {#if node.media.cropRatio}
    <!-- A feed grid's cropped tile: the image fills a fixed-aspect box with
         object-cover, so gallery/portfolio tiles are uniform (the source's
         `mediaRatio`, e.g. 4:3) instead of flowing at their natural height. -->
    <div
      class="relative w-full"
      style="aspect-ratio: {node.media.cropRatio.replace(':', ' / ')}"
    >
      <Media
        media={node.media}
        class="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  {:else}
    <!-- Media follows inherited text-align: an `inline-block` image inside a
         full-width block wrapper, positioned by the ancestor's text-align —
         Blux `.ib{display:inline-block}` graphics are never force-centered.
         Intrinsic width still caps to the cell so rules/logos keep their true
         size. -->
    <div class="w-full">
      <Media media={node.media} class="inline-block h-auto max-w-full" />
    </div>
  {/if}
{:else if node.kind === "raw"}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html node.html}
{:else if node.kind === "widget"}
  {#if node.widget.type === "map" && map}
    <LocationMap {map} onselect={(i) => (panels.active = i)} />
  {:else}
    <div data-widget={node.widget.type} class="min-h-64 w-full"></div>
  {/if}
{/if}

<style>
  /* Switching map tabs fades the incoming panel in. The keyframes replay each
     time a cell leaves display:none (Tailwind's .hidden), so every switch —
     not just the first — animates; siblings stay mounted, so nothing reloads.
     The original clickMap snapped panels instantly (its media loader supplied
     the only fade); 250ms ease-in-out is the Blux runtime's own animate()
     default. Deliberate polish, gated off under prefers-reduced-motion.
     :global keeps Svelte from stamping its scope hash onto every
     dynamic-class element in this component (text nodes pin clean class
     lists); the data-attribute pair scopes it to panels rows regardless. */
  @media (prefers-reduced-motion: no-preference) {
    :global([data-panels] > [data-grid-cell]:not(.hidden)) {
      animation: blux-panel-fade-in 250ms ease-in-out;
    }
    @keyframes -global-blux-panel-fade-in {
      from {
        opacity: 0;
      }
    }
  }
</style>
