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

## 2026-10-27 — Fleet test audit, batch B: 43 unreachable or design-value unit pins go, the arrow scrim's contrast floor stays (#54)

Why: the fleet test audit (`reddoorla/reddoor-workspace`
`audits/2026-10-26-fleet-test-audit/report.md`) mutated every candidate pin on
this site and asked, for each mutant, what a visitor would lose. The answer here
is mostly nothing. Production renders one `frozen_page` document through
`src/lib/blux-frozen/`, `blux-presentation.json` is empty and there are no
`page` or `catalog_page` documents, so the Blux slices and `src/lib/blux/`
components those tests pin (Grid, BandContent, LocationMap, SplitFeature,
Gallery, BluxGrid, BluxSection, ScreenWidthMedia's Vimeo caps, BrandIcon's
default class) render only on `/dev` routes. 36 of the classed losses in this
PR are that kind: unreachable. 7 are design values on the frozen page itself:
the caption's decorative rule mark and the rule mark's own viewBox and line
count, a fourth scrim gradient, the side ramp's px-versus-% unit, the 600ms
cross-fade, and the body underline's `1.137em + 4px` row. None changes what a
visitor can read or operate. The carousel's cross-fade test now imports the
real `FADE_MS` (one `export` added to `carousel.ts`) instead of a copy of 600.

One loss was real. Lightening the left-arrow scrim from .45 to .2 at the edge
leaves .238 where the arrow's ink begins. Over a background as bright as slide
1's right (1.17:1 unscrimmed at p90, the brightest in `carousel-caption.ts`'s
table) that models about 2.1:1, under WCAG 1.4.11's 3:1 for a control. The old
guard caught it only as an exact string (`rgba(0,0,0,.45) 0`, both sides
identical). It is replaced in `carousel-caption.test.ts` by a floor: both side
ramps are parsed and their alpha, interpolated between stops, must clear a floor
over the arrow's ink (11.9-28.1px from the edge, the chevron path's extent at
its 1.1 hover scale, plus a pixel of adjacent background either side, so
10.9-29.1px). The floor, 0.372, is computed in the test from that table: the
alpha that takes slide 1 right's p90 background to 3:1 when black is composited
in encoded sRGB. Round 4 of review caught the first version of this, a flat .34
written as "slide 3 is the binding case": slide 3 needs only 0.188, and a flat
.34 ramp passed while modelling 2.73:1 on slide 1. The reviewer's suggested .38
over the 4-36px icon box would have failed the shipped ramp itself, which is
.380 at 28.1px and .36 at 36px. Proved with the reviewer's mutant
(`caption-side-scrim-too-light`) through `mutate.mjs`: red, 1 of 9.

What surprised me: the first version of that floor survived the mutant. Its
stop parser wanted a `px` unit, and the edge stop is written as a bare `0`, so
the parser skipped it and read the 44px stop's .34 as the value at the edge.
Running the mutant by hand before trusting the table found it; the parser now
accepts a unitless stop and fails on a `%` stop over the ink rather than
guessing its position.

`tests/gate/frozen-fidelity.spec.ts` keeps every pin the audit's branch had
deleted (the ~14820px height band, the 1440 width guard, the availability
panel's box, the rule-mark count and dash widths, the Incentives hover colours,
the footer spacer heights, the exact nav list). This site has no scaffold tier
yet; batch A adds one in its own PR and moves those there, so deleting them here
would lose them before they had somewhere to go. Only the first carousel test
changed: its two fixed sleeps became a poll until exactly one slide is up, which
under the config's `reducedMotion: "reduce"` is immediate. The spec passes 3 of
3 against a production build (`VITE_REDDOOR_GATE_FIXTURES=1 vite build`, then
`vite preview`), the only build where `/dev/blux-frozen` answers outside
`vite dev`. `animateIn.test.ts` is left alone: its inherited-copy fix is handled
with the template's.

That poll was wrong on its first CI run, and the defect is worth naming.
"Exactly one slide is up" is also true of the old slide in the instant after a
click, before the swap starts. So the loop recorded slide 0 twice (`[0, 0, 1,
2]`) and the wrap assertion failed. It passed 3 of 3 locally only because the
local machine was slower to poll. The poll now also waits for the index to move
off the frame recorded last. Before the first click, the test waits for the
track's `aria-roledescription="carousel"`, which only hydration sets: a click
landing before the arrows are wired is lost. Review also tightened the scrim
floor. It sampled only 0px and 44px, and an almost clear `.05` dip between 1%
and 3% passed it, though main's exact-string test caught that. It now checks
every stop over the arrow's ink (10.9-29.1px) and fails on any stop there that
is not black at a px position, a `%` stop included (round 2 caught `transparent`
and white stops slipping through a looser parser). The second carousel test
("the cross-fade overlaps without disturbing the layout") keeps its fixed sleeps
and its mid-fade window. They are timing in the gate, and they wait, like the
restored pins, for batch A's tiers to give them a nightly home.

## 2026-10-27 — Inherit the starters' test-pin fixes (#55)

Batch C of the fleet test audit (`reddoorla/reddoor-workspace` `audits/2026-10-26-fleet-test-audit/report.md`) fixed design-value and exact-count pins in the starters, and this site carries the starters' copies of those tests, so the same fixes are ported here. The hunks applied cleanly; the intent is the starters' own, with no design value, no source read as text and no exact list.

`src/lib/actions/animateIn.test.ts` "honors a custom delayMax" pinned `transitionDelay` to exactly `400ms` at `delayMax: 800`, a duration, which the fleet test audit's rule keeps out of the gate: design values never enter it (the rule is `reddoor-starter`'s CLAUDE.md "Tests build; they don't freeze", which this repo's CLAUDE.md does not carry). It now takes the starter's three relations: `delayMax: 0` reveals with no delay, `delayMax: 100` keeps the delay at or under 100 even at the right edge (`left: 999` of 1000, where the delay is largest), and an element at `left: 800` reveals later than one at `left: 200`. The last relation is the one that still notices a stagger that ignores position or reads the wrong edge; without it the first two hold even when every delay is 0. From reddoor-starter-blux#53 come two more. `src/lib/components/ProductListing.test.ts` counted every link on the listing (`toHaveLength(3)`), an exact list a designer may add to; it now asserts exactly one `/products/<slug>` link per product, so an added back link passes and a product shown twice fails. `src/lib/slices/BluxCollection/BluxCollection.test.ts` scopes its anchor count to `.blux-collection__cards`, so a heading or "View all" link outside the card list no longer reads as a card link.

Review 1 found the hunk's "no design value" true of the hunk but not of the file: this site's copy of `animateIn.test.ts` is older than the starter's and still pinned the defaults the starter had already dropped, `translateY(50%)` in three tests, `2400ms` on the `--transition-fast-slow` curve, and "sets transition-delay based on horizontal position", which read `100ms` off the default `delayMax` of 400. Those pins go here as they went in the starter, and "update is a no-op in viewport mode" now compares the transition with the one the element mounted with instead of reading `2400ms`. The 100ms pin had been the only thing catching a delay of twice `delayMax` (`2 * cfg.delayMax *`), which passed `<= 100` with the bounded element at the midpoint; moving it to the right edge makes that mutant red on the relation itself (199.8ms), so dropping the pin opened nothing.

Every kept assertion was proved by mutation, with the starter PRs' mutants plus one per new relation and a negative control: 13 mutants, 8 red as expected and 5 surviving as expected. The survivors are the ones the starters already named: a `delayMax` clamped to 400ms only shortens a stagger (design value), an added sub-category heading link and a "View all" link are what the rewrites mean to allow, and the negative control, the delay's position ratio written as `left * (1 / innerWidth)`, stays green as it must. The fifth is review 1's: a changed default travel (`50%` to `20%`) is a design value once its pins are gone.

Review 2 found the no-op test still checked only `transition`, so an update that re-hid a viewport element (`applyHidden` before the early return) passed 0 of 21, and since the observer has already disconnected the content would stay invisible. No current caller reaches it, and the old `2400ms` read missed it too. The test now reveals the element first and checks that its opacity and transform are what they were before the update, which makes that mutant red without pinning a value.

## 2026-11-01 — "distinguished" fits a 320px phone (P1-90, `fix/p1-90-mobile-overflow`)

P1-90's census (reddoorla/reddoor-maintenance#1876) found the home page 335px wide on a 320px phone. The source is the Distinguished Design heading (`#page-block-2`, `.text12`, 48px at ≤700px): "distinguished" is 6.99em, 335px, and its block has no side padding, so the word ran from 0 to 335 in a 305px column. From 300 to 334px the page was 335px wide.

**Belief corrected:** my first look at the original Blux site (thepointeburbank.com) found it clean at 320, and I took that as a fidelity gap the migration had opened. Measured again after Blux's own script had rendered the text, it overflows the same way, 335px. The first probe ran before that script finished.

The fix is a render-time rule in `FROZEN_ENHANCE_CSS`, below the round-2 `.text12` type scale: at ≤700px the block's `.block-content` becomes an inline-size container, and the heading is `min(48px, 14cqi)`. That gives 42.7px at 320, and 48px wherever the column is 343px or wider (a 358px screen and up). The block holds only the eyebrow and this heading, and its `.block-content` is an inline-block at `width: 100%`, so the container does not collapse it. The 80px desktop size is untouched. Sized for "distinguished": a longer single word in that Prismic slot would need a smaller factor.

`tests/smoke/mobile-overflow.spec.ts` checks `/` and `/contact` at 320, 390, 768, 820 and 1024. Reverting the rule turns it red at 320 (336px) on both runs. Review round 1 (Opus) was clean; its minors (pin reduced motion in the spec, cover `/contact`, note the CMS-word dependency, drop a redundant `:has`) are folded in.

**P1-90d: the shared `measure()` moved on.** Rounds 3 and 4 of the Williamson review (reddoorla/williamson-construction-co#46) found more holes in `seen()`, each reproduced on a blank-page fixture against a paint test. The fixes:

- backdrop-filter, preserve-3d and content-visibility now form containing blocks;
- clip-path and mask-image clip, on every ancestor;
- a text-overflow ellipsis ends the line, but only on the line's own block container;
- plain inline boxes no longer clip;
- clipping uses the padding box;
- a line must be on screen at both edges;
- open shadow roots and slots are walked;
- text inside an `inert` subtree (a carousel's peeking slide) is skipped.

The spec here takes the same function. None of those patterns is on this site's routes. This PR's mutation still behaves as recorded: the heading rule reverted is red at 320 (335px), run twice. The branch passes 10 of 10.

## 2026-11-09 — `@types/node` declared at `^24.19.2`, so Node's types stop hanging on slice-machine (reddoor-workspace P1-106)

Nothing here declared `@types/node`. svelte-check gets Node's types (`node:fs`, `process`) only because the lockfile resolves `@types/node` as the optional peer of vite, vitest and sharp, and pnpm resolves an optional peer only while some package in the graph depends on it outright. Here that is one package: `@types/http-proxy`, reached through slice-machine-ui → start-slicemachine → `http-proxy-middleware@2`. So a clean relock keeps it today, at 26.6.6: Node 26's types against the Node 24 this site runs (`.nvmrc`), and Node 26 is held fleet-wide. When that chain stops pulling `@types/http-proxy`, the next lock-file maintenance drops `@types/node`, and svelte-check fails. That happened on roalson-interests on 11-09 (its #344, 146 errors in 46 files; fixed by its #346) and on reddoor-starter-blux, where nothing held the peer and lock-file maintenance has been red since 11-03 (36 errors).

The fix is Roalson's: `pnpm add -D @types/node@^24.19.2`. In the lockfile, the peer resolutions under vite, vitest and sharp move from 26.6.6 to 24.19.2, and the direct entry joins them; no other package moves. `@types/node@26.6.6` stays in the lockfile as `@types/http-proxy`'s own dependency, where svelte-check no longer reads it. Belief corrected on the way: a relock does not reproduce the failure while `node_modules` is in place, because pnpm reuses the old resolution; the census had to move `node_modules` aside to see what Renovate sees.
