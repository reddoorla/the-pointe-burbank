# The Pointe Burbank — Work Journal

Running log of build work: what was done, why, and where it landed.
Chronological — newest entry at the bottom. [CLAUDE.md](../CLAUDE.md) says what
the repo is; this is the history of getting it there.

The convention is in [CLAUDE.md](../CLAUDE.md) under "The work journal". In
short: every working session appends a dated entry, prose over bullets, why
over what, and history is never edited to be right — a later entry corrects an
earlier one and says so.

---

## 2026-09-05 — Journal opened, and 53 commits of history summarised rather than reconstructed (`chore/work-journal`)

The journal starts today, so this first entry is a **backfill**: a deliberately
coarse summary written from the commit log and the merged PR list, not from
memory. Detail below this line is trustworthy; detail above it is not, and
nothing here should be cited as though someone wrote it down at the time. The
commit log and PRs #1–#31 remain the record for anything before 2026-09-05.

**What this repo is.** The website for The Pointe, an office campus in Burbank
— 13 buildings, 3,100,000 SF, per the site's own copy — built on the Reddoor
SvelteKit 2 / Svelte 5 / Tailwind v4 / Prismic starter and deployed to Netlify
as `the-pointe-burbank-rd`. It is not an ordinary starter site: it is the
fleet's Blux migration proving ground, and it carries both halves of that
machinery. `src/lib/blux-catalog/` parses the old Blux export into typed
Prismic slices (the eleven `Blux*` entries in `src/lib/slices/`, plus
product/person/event/news/project entity types). `src/lib/blux-frozen/` takes
the other route entirely — the export's own HTML and CSS committed as artifacts
and re-rendered with Prismic-editable slots punched into them. Production takes
the frozen path: `resolveFrozen(client, "home")` runs first in the
`[[preview]]` loader and only falls through to the catalog/native `page` path
when there is no committed artifact.

**The eras, roughly.** 53 commits, `2f75535` on 2026-07-24 to `ac15db5` on
2026-09-01, and they are lumpy. Late July (18 commits) is the bootstrap and the
frozen render coming to life: working nav anchors, real mailto links, a live
KML location map replacing the export's dead Google-Map DOM, then design-review
round 2 on 07-31 and a re-freeze against `@reddoorla/maintenance` 0.76.0.
**2026-08-03 alone carries 25 commits** — nearly half the repo — and it is all
one client review round, shipped as six small `frozen/*` branches rather than
one: nav items restored and then their underlines reverted (#14, #15), the hero
carousel given cross-fade, side scrims, 7s auto-advance and offscreen
preloading (#17–#19), the LEED badge sized to the building icons' height rather
than their width (#16), and every frozen image sized to the box it is painted
into (#20). After that the repo goes quiet and the commits are upkeep: Renovate
dependency PRs, the reusable CI workflow to v1.4.1 (#28), remote-only custom
types pulled down (#24), and a Prismic srcset cap with a real `sizes` on every
image (#29).

**State as of this entry.** Local `main` at `ac15db5`, tree clean, nothing in
flight. `origin/main` is one commit ahead at `c0bdef9` (Renovate's pnpm
11.11.0 security bump, #31); this branch is cut from the local commit, which
costs nothing here because the two files are new. Seven `frozen/*` and `ci/*`
branches survive on the remote — all merged, history rather than work. 97 unit
test files, plus the offline fidelity gates in `tests/gate/`.

**What changed today.** `CLAUDE.md` did not exist in this repo, so it does now,
carrying the journal convention and the few things about the Blux split that a
session genuinely needs. Note what it also had to say: `README.md` is still the
**starter's** README, describing the template's component library rather than
this site. That has been true since the initial commit and nobody wrote it
down, which is the shape of gap this journal is for.

## 2026-10-27 — Inherit the starters' test-pin fixes (#55)

Batch C of the fleet test audit (`reddoorla/reddoor-workspace` `audits/2026-10-26-fleet-test-audit/report.md`) fixed design-value and exact-count pins in the starters, and this site carries the starters' copies of those tests, so the same fixes are ported here. The hunks applied cleanly; the intent is the starters' own, with no design value, no source read as text and no exact list.

`src/lib/actions/animateIn.test.ts` "honors a custom delayMax" pinned `transitionDelay` to exactly `400ms` at `delayMax: 800`, a duration, which this repo's "Tests build; they don't freeze" keeps out of the gate. It now takes the starter's three relations: `delayMax: 0` reveals with no delay, `delayMax: 100` keeps the delay at or under 100, and an element at `left: 800` reveals later than one at `left: 200`. The last relation is the one that still notices a stagger that ignores position or reads the wrong edge; without it the first two hold even when every delay is 0. From reddoor-starter-blux#53 come two more. `src/lib/components/ProductListing.test.ts` counted every link on the listing (`toHaveLength(3)`), an exact list a designer may add to; it now asserts exactly one `/products/<slug>` link per product, so an added back link passes and a product shown twice fails. `src/lib/slices/BluxCollection/BluxCollection.test.ts` scopes its anchor count to `.blux-collection__cards`, so a heading or "View all" link outside the card list no longer reads as a card link.

Every kept assertion was proved by mutation, with the starter PRs' mutants plus one per new relation and a negative control: 9 mutants, 5 red as expected and 4 surviving as expected. The survivors are the ones the starters already named: a `delayMax` clamped to 400ms only shortens a stagger (design value), an added sub-category heading link and a "View all" link are what the rewrites mean to allow, and the negative control, the delay's position ratio written as `left * (1 / innerWidth)`, stays green as it must.
