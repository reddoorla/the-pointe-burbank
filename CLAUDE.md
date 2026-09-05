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
covering `tests/smoke/`, `tests/a11y/` and the two offline fidelity gates in
`tests/gate/`, which render the frozen and catalog artifacts and assert text
coverage against the Blux export.

**`README.md` is still the starter's.** It documents the template's component
library, not this site. Do not read it as a description of what is here.

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

If a session produced nothing worth an entry, that is itself worth one line.
