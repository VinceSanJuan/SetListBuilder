# Set List Builder

A static page for building worship set lists with Camelot key matching. It runs on GitHub
Pages with no server and no backend. `README.md` explains what it does and how to use it;
this file is for working on it.

## Hard constraints

- **No build step.** `index.html` loads `app.js` and `music.js` directly as ES modules.
  Do not add a bundler, a framework, or a runtime dependency.
- **jsdom is the only dependency, and it is dev-only.** The published site loads nothing
  but its own files.
- **Mobile first.** A touch screen has no hover, so anything revealed only by `:hover` is
  invisible to most people using this. Keep tap targets at `var(--tap)`, which is 44px,
  unless there is a stated reason not to.

## The files

| File | Holds |
| --- | --- |
| `music.js` | Camelot wheel maths, key parsing, TSV parsing. Shared by the page and the validator. |
| `app.js` | Every behaviour on the page. |
| `styles.css` | All styling. Dark by default, light theme available. |
| `songs.tsv` | The song library. Edited by hand, in a spreadsheet or an editor. |
| `tools/validate.mjs` | Checks `songs.tsv`. Runs in CI before anything is published. |
| `tools/lookup.mjs` | Fetches a song from PraiseCharts, by name or by pasted address, and builds a `songs.tsv` row. |
| `tools/lookup-server.mjs`, `tools/lookup.html` | `npm run lookup`. A local page for the same thing. |
| `tests/` | Four suites. The README has a section on them. |

## Before calling a change finished

    npm test          # about 430 checks, roughly ten seconds
    npm run validate  # whenever songs.tsv was touched

**Do not write a throwaway test harness.** `tests/` already drives the real `app.js` and
the real `styles.css` against a jsdom document. Add to it instead. No test may reach the
network: `tests/lookup.mjs` feeds the lookup tool made up pages rather than fetching real
ones, so CI never leans on someone else's site.

## Traps that have already caused bugs here

**A green suite does not mean the page is right.** jsdom quietly ignores `:hover`,
`::before`, `::after`, `@media (hover: none)`, and any shorthand holding a `var()`, such
as `border: 1px solid var(--line)`. Every rectangle measures zero, so nothing can be
checked by position. Worst of all it reports **declared** values rather than used ones: a
declared `height: 34px` reads back as `34px` while a `min-height: 44px` from another rule
is what the browser actually obeys. That exact case shipped a visibly wrong button with
every check passing. The README lists the full set under "What the tests cannot see". When
a change cannot be covered, say so plainly rather than implying the suite proved it.

**Order in `styles.css` settles fights between equal weights.** `.btn` and `.share-btn`
both weigh one class, so whichever comes last wins. The Share rules must stay after
`.btn`. Getting this wrong has produced two visible bugs, and neither was caught by a
test that looked like it covered the area.

**Enharmonics are normalised by pitch class, not by string.** The spelling shown comes
from `WHEEL` in `music.js`, not from what was typed, so `C#` in `songs.tsv` displays as
`Db maj`. The same pitch class is spelt `Db` in major (3B) and `C#` in minor (12A), which
is correct by key signature but does look inconsistent. Song ids are slugs of title plus
artist, so renaming a song in `songs.tsv` changes its id and breaks share links made
before the rename.

**The lookup tool cannot move into the browser.** PraiseCharts sends no CORS headers, so
a page on the published site cannot fetch it. That is why `npm run lookup` runs a local
Node server. songdata.io, which the original script also used, now sits behind a bot
challenge and returns 403 to any script: do not try to work around it, and do not add it
back. Everything needed already comes from PraiseCharts, and the Camelot value is worked
out locally by `music.js` rather than fetched at all.

**Pointer gestures share one handler.** Hold to drag, swipe sideways to delete, and drag
vertically to scroll are told apart by what moves first. Changing one affects the others,
and `touch-action` has been silently dropped in a restyle before now.

## House style

Simplified Technical English, in comments and in anything the page shows. Comments say
*why*, not what. Match the surrounding code. Do not refactor what the change did not
touch, and only remove code the change itself orphaned.
