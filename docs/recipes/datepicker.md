# Recipe: flatpickr datepicker action

An opt-in Svelte action wrapping [flatpickr](https://flatpickr.js.org/). The
starter deliberately does **not** ship flatpickr — most sites never need a
datepicker, and it carries its own CSS. To activate:

```bash
pnpm add flatpickr
```

Harvested from `alamo-anatomy` (`src/lib/utils/datepicker.ts`, used on the
reserve-a-lab form) with a lazy-load variant from `gallerysonder`.

## Base action

Create `src/lib/actions/datepicker.ts` (verbatim from alamo-anatomy):

```ts
import flatpickr from "flatpickr";
import type { Options } from "flatpickr/dist/types/options";

export function datepicker(node: HTMLInputElement, options: Options = {}) {
  const twoYearsOut = new Date();
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);

  const fp = flatpickr(node, {
    dateFormat: "Y-m-d",
    minDate: "today",
    maxDate: twoYearsOut,
    altInput: true,
    altFormat: "F j, Y",
    ...options,
  });

  // Mirror placeholder + aria-label from original input to flatpickr's visible alt input
  if (fp.altInput) {
    if (node.placeholder) fp.altInput.placeholder = node.placeholder;
    const aria = node.getAttribute("aria-label");
    if (aria) fp.altInput.setAttribute("aria-label", aria);
  }

  return {
    update(newOptions: Options = {}) {
      Object.entries(newOptions).forEach(([key, value]) => {
        fp.set(key as keyof Options, value);
      });
    },
    destroy() {
      fp.destroy();
    },
  };
}
```

And import the stylesheet at the top of `src/app.css`, **before** any theme
overrides so your selectors win the cascade:

```css
@import "flatpickr/dist/flatpickr.min.css";
```

Usage:

```svelte
<script lang="ts">
  import { datepicker } from "$lib/actions/datepicker";
</script>

<input
  type="text"
  name="event_date"
  placeholder="Event Date*"
  aria-label="Event Date"
  required
  use:datepicker
/>
```

Notes:

- `altInput: true` makes flatpickr hide the real input and render a
  human-readable clone; the action mirrors `placeholder` and `aria-label`
  onto it because flatpickr does not, and the visible input is otherwise
  unlabeled for assistive tech.
- The submitted value keeps `dateFormat` (`Y-m-d`); the visible alt input
  shows `altFormat` (`F j, Y`).
- `update()` pushes changed keys into the live instance via `fp.set` — keys
  you stop passing are _not_ reset to their defaults.

## Linked range (start date constrains end date)

From alamo-anatomy's reserve form: bind the start input's value and feed it to
the end input's `minDate`. The action's `update()` applies the new bound as
soon as a start date is picked.

```svelte
<script lang="ts">
  import { datepicker } from "$lib/actions/datepicker";
  let startDate = $state("");
  let endDate = $state("");
</script>

<input
  bind:value={startDate}
  placeholder="Preferred Start Date*"
  aria-label="Preferred Start Date"
  use:datepicker
/>
<input
  bind:value={endDate}
  placeholder="Preferred End Date*"
  aria-label="Preferred End Date"
  use:datepicker={{ minDate: startDate || "today" }}
/>
```

Caveat: picking a start date _after_ the chosen end date does not clear the
end value — flatpickr only constrains the calendar UI. Validate the range
server-side too.

## Lazy-load variant (gallerysonder)

gallerysonder's `src/lib/utils/datepicker.ts` defers flatpickr's JS with a
dynamic `import("flatpickr")` inside the action, so the library only
downloads on pages that actually render a date field (the CSS still lives in
`app.css`). The action returns synchronously, as Svelte requires; a
`destroyed` flag guards against the node being unmounted before the import
resolves, and `update()` calls that arrive pre-load are stashed and applied
once flatpickr initializes.

If you adopt that variant, stash pending options with a merge — the source
overwrites, so two `update()` calls before the import resolves lose the first
call's keys:

```ts
// gallerysonder source: pending = newOptions;  ← drops earlier pending keys
pending = { ...pending, ...newOptions };
```
