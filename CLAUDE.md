# CLAUDE.md

The website for **The Pointe**, an office campus in Burbank — built on the
Reddoor SvelteKit 2 / Svelte 5 / Tailwind v4 / Prismic starter and deployed to
Netlify as `the-pointe-burbank-rd`. `docs/workJournal.md` carries the history.

What makes this repo unlike a plain starter site: it is a **Blux migration**,
and both halves of that machinery live here.

- `src/lib/blux-frozen/` is what production renders. The old Blux export's own
  HTML and CSS are committed as artifacts under
  `src/lib/blux-frozen/frozen/<uid>.{html,style.css,fonts.json,…}` and
  re-rendered with Prismic-editable slots punched into them. `resolveFrozen()`
  runs FIRST in `src/routes/[[preview=preview]]/+page.server.ts`; a repo counts
  as frozen only when it has BOTH a committed artifact and a published
  `frozen_page` document, which is why the empty artifact directory in the
  starter template is the scoping gate.
- `src/lib/blux-catalog/` is the other route — the export parsed into typed
  Prismic slices (the eleven `Blux*` entries in `src/lib/slices/`). It is built
  and exercised offline at `/dev/blux-pointe`, but the homepage does not take
  it.

**There is no `pnpm verify` here**, unlike the current starter. The gates are
`pnpm lint`, `pnpm check`, `pnpm test:unit` and `pnpm test:smoke` — the last
runs only the Playwright specs tagged `@smoke`, drawn from `tests/smoke/`,
`tests/a11y/` and `tests/gate/` (the frozen page's structure, carousel and CMS
agreement; the catalog fidelity specs there render the Blux export offline and
stay out of the gate). See "Tests build; they don't freeze" below.

**`README.md` is still the starter's.** It documents the template's component
library, not this site. Do not read it as a description of what is here.

## Tests build; they don't freeze

Tests are how an agent builds against a comp without a human watching: a
geometry spec that measures a band against the Figma frame is exactly the
instrument that gets the band right. Once the slice ships, the same spec
becomes a fence around a design decision a human is entitled to change, and it
turns a one-line tweak into a CI round trip. This site took the tiers
`reddoor-starter` ships (reddoorla/reddoor-starter#180) in the fleet test
audit's batch A. The suite is tiered by what a red _means_:

| Tier                | Command                                     | Runs                                    | Holds                                                                                                                                                |
| ------------------- | ------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gate** (contract) | `pnpm test` (vitest + Playwright `@smoke`)  | every PR, inside the required `ci / ci` | what a client would call a bug: no horizontal overflow, the page's landmarks and nav targets, the carousel, AA contrast and names, the CMS agreement |
| **Nightly**         | `pnpm test:nightly`                         | `nightly.yml`, never blocks a merge     | the carousel cross-fade layout: real behaviour, but its assertion is a race against a 600ms clock                                                    |
| **Scaffold**        | `pnpm test:scaffold` (`pnpm test:e2e`: all) | on demand, while building               | comp geometry, pixel and computed-style pins, the numbers the frozen page and the catalog were built to                                              |

- **A human's design change wins.** When a size, spacing, colour that still
  passes AA, duration, border, or an added button or link turns a test red,
  the test is what is wrong: update it or delete it in the same PR.
- **Design values never enter the gate.** A gate test asserts what a user
  observes, never a class list, a px, a ms, an opacity, or an exact count a
  designer or editor may change ("exactly three slides"): assert the item that
  matters is _in_ the list, or read the count off the page.
- **`@smoke` is earned.** A test tagged `{ tag: "@smoke" }` has no fixed
  sleeps, no frame counting, no animation windows, no rect read that asserts a
  position or size, no computed-style colour or size, and no element count a
  new button would change. Comparing two of the page's own boxes (a slide
  against its track, text against the viewport edge) reads a relation, not a
  design value, so it is a contract and may be tagged.
- **A `@smoke` test that interacts, or reads what script builds, waits on
  `html[data-hydrated]`** (written by the root layout's `onMount`) or on the
  carousel's own hydration marker, never on a server-rendered element: CI's
  smoke step runs on `vite dev`, where `load` fires about 2s before hydration.
- **A flaky timing test leaves the gate; its window does not widen.** Tag it
  `@nightly`, or delete it if it guards nothing a client would notice.
- **A new Playwright spec that is a contract needs its tag.** An untagged one
  silently lands in scaffold, outside CI.

## The work journal

**Every working session appends a dated entry to `docs/workJournal.md`** — what
was done and **why**, newest at the bottom, never corrected in place. Write it
as the last act of the session, not the first act of the next one.

The journal is the history of executing the build. Code says what the system
does now; the journal says what it used to do, what it cost to change, and
which beliefs turned out to be wrong. Nearly everything expensive to rediscover
lives there and nowhere else.

An entry is headed with the date, a short title, and where it landed:

```markdown
## 2026-09-04 — Both runway stages render their final frame without JS (#51, `ce46ae0`)
```

Then prose — not a bullet list of file names, which the diff already tells you.
What to put in, in rough order of value:

- **Why, over what.** The reason a thing was done survives; the diff does not
  need restating.
- **Measured numbers, exactly.** "The comp's open mask is 2696×2352 on an 860px
  band — 2.735× the band's height, so a 390×664 phone needs ~534%" is worth
  keeping. "Fixed the hero on mobile" is not.
- **Defects, named.** What broke, what it looked like, and what made it
  invisible until it wasn't.
- **What was tried and abandoned**, and what it would take to revive it. A dead
  end nobody wrote down gets walked twice.
- **Beliefs corrected on contact.** The design assumption that turned out false
  is usually the most valuable line in the entry.
- **Honest accounting.** If a win came from somewhere other than the change
  that claimed it, say so — that is exactly what someone will otherwise
  over-invest in next.

**History is never edited to be right.** An entry that stops being true is not
rewritten; a later entry corrects it, and says which one it corrects. The
journal is a record of what was believed at the time, and that record is most
useful precisely where it was wrong. Fixing the past in place destroys the only
evidence of how the mistake was made.

The one edit an old entry may take is a **forward pointer**: one line directly
under its heading naming the entry that overturned it — `> Superseded in part by
2026-10-14 — <that entry's title>.` It asserts nothing new and retracts nothing,
so the record of what was believed survives whole; it only stops a reader who
lands on the old paragraph from leaving with the old answer. Without it the rule
above is half a mechanism: the correction exists at the bottom of the file, and
nothing points to it from where a reader actually arrives.

If a session produced nothing worth an entry, that is itself worth one line.
