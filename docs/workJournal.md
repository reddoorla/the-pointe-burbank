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

## 2026-10-04 — Off Slice Machine, onto the Prismic CLI (reddoor-maintenance#1090, `claude/prismic-cli`, not pushed)

Phase 4 of the fleet migration, following espada's and beachfront-dentistry's
ports of reddoor-starter#166. Slice Machine is deprecated by Prismic since
2026-09-18; models are edited in the Type Builder and the two generated files
now come from `pnpm prismic:gen`, checked by a new `prismic-codegen` job.
`prismic.config.json` replaces `slicemachine.config.json` for every reader
(`prismicio.ts`, `svelte.config.js`, the smoke manifest), and
`scratchpad/regen-types.mjs`, which resolved `@slicemachine/manager` out of the
pnpm store to regenerate types without the UI, goes with the package it needed.

**Regenerating found two models nobody had generated.** The old
`src/prismicio-types.d.ts` exported 111 names; the new root file exports 114.
The additions are `CatalogPageDocument`, `FrozenPageDocument` and
`FrozenPageDocumentDataSlotsItem` (plus their `…Data` and slice-zone types):
`customtypes/catalog_page` and `customtypes/frozen_page` were committed without
the generator being re-run, so the type production actually renders,
`frozen_page`, was never in the generated file. Nothing else changed; the slice
index maps the same 26 slices to the same components, differing only in
indentation. svelte-check reported 0 errors before (4779 files, at `dc97447`)
and after (4765). Its augmentation reaches the program through
`blux-catalog/page-doc.ts`'s relative import, so `app.d.ts` was left alone; a
probe assigning `"nope"` to `Content.FrozenPageDocument["type"]` went red with
1 error, so the 0 is not an empty check.

**`/slice-simulator` was unframeable in production.** The root layout's
`prerender = "auto"` made it `build/slice-simulator.html`, a static file, so
Netlify gave it netlify.toml's `/*` `X-Frame-Options: SAMEORIGIN` and its CSP
only as a `<meta>` tag, which cannot carry frame-ancestors. Measured on
`the-pointe-burbank-rd.netlify.app` at about 22:37 UTC: `/slice-simulator` and `/`
both `X-Frame-Options: SAMEORIGIN`; `/contact` (server-rendered) SAMEORIGIN plus
`frame-ancestors 'self'`. The route is now `prerender = false`, and the hook
(ported from the starter's `cms-framing.ts`) deletes X-Frame-Options and widens
frame-ancestors to `'self' http://localhost:* https://*.prismic.io
https://prismic.io` on that route only. From `vite preview` after the change:
`/slice-simulator` carries no X-Frame-Options and the widened directive; `/`
(no headers under preview), `/health` (SAMEORIGIN) and `/contact` (SAMEORIGIN,
`frame-ancestors 'self'`) are as they were. The starter's test came with it, plus
two cases it lacked: a response that already carries X-Frame-Options, and a
guard that the route stays `prerender = false`. Six mutations, each turned one
test red (or the codegen gate red), each restored.

**An instrument error on the way, recorded because it nearly shipped as a
finding.** The first post-change preview measurement still showed
`X-Frame-Options: SAMEORIGIN` on `/slice-simulator`. It was the baseline
preview server, still bound to the port: killing the `pnpm preview` wrapper's
PID left its `vite preview` child alive, and the new server failed with "Port
4719 is already in use" into a log nobody read. Killing the child by PID and
re-measuring gave the result above.

**Not proven: that the local models match Prismic.** This site is not in the
nightly drift log (it is a proof of concept the sweep skips), and the Prismic
connector answered `Prismic MCP is not activated for repository
"the-pointe-burbank"`. So the branch is committed and not pushed; it waits on
an administrator activating MCP for the repository, or another sync check.
