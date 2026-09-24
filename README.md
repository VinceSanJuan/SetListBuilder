# Set List Builder

A one page tool to build a song set list, with Camelot key matching so songs flow.
Static site, no backend, no build step. It runs on GitHub Pages.

| File | What it does |
| --- | --- |
| `songs.tsv` | Your song library, a spreadsheet. The only file you edit by hand. |
| `music.js` | Camelot wheel maths and song checking. Used by the page and by the checker. |
| `app.js` | The page behaviour. |
| `index.html`, `styles.css` | The page and its styling. |
| `tools/validate.mjs` | Checks `songs.tsv`. Run by the Action before every deploy. |
| `.github/workflows/deploy.yml` | Checks the data, then publishes to Pages. |
| `.devcontainer/` | Sets up a Codespace with a spreadsheet editor. |
| `LICENSE` | The GNU General Public License, version 3. |

## Run it on your machine

A browser blocks `fetch` when a page is opened as `file://`, so the page must be served
over http:

    npm run serve

...then open `http://localhost:8080/`. In VS Code there is a task for it: **Run Task**,
then *Serve the page*.

It is a few lines of Node rather than `py -m http.server`, so the same command works on
Windows and in a Codespace, and the modules are served as `text/javascript` rather than as
plain text, which is the difference between the page running and not.

Edit `songs.tsv`, save, refresh the page. There is nothing to rebuild and nothing is
cached.

To check the data the same way the Action does:

    node tools/validate.mjs

## Edit songs.tsv

The library is a tab separated file, so any spreadsheet opens it and any spreadsheet can
paste straight into it. The first row names the columns:

```
title	artist	key	bpm	camelot	tags	urls
10,000 Reasons (Bless The Lord)	Matt Redman	G	145		praise	WT=https://example.com/x
Araw Araw	MJ Flores	D	130
Yeshua	Jesus Image	A	92		quiet;slow
```

| Column | Required | Notes |
| --- | --- | --- |
| `title` | yes | Duplicates are allowed. `Build My Life` appears twice. |
| `artist` | no | Tells duplicate titles apart. Leave it out when unknown. |
| `key` | no | See the key formats below. |
| `bpm` | no | A number from 20 to 400, or leave the cell empty. |
| `camelot` | no | Leave it empty and it is worked out from the key. |
| `tags` | no | Several tags in one cell, separated by `;`. Searchable. |
| `urls` | no | Several in one cell, separated by `;`. Either `Label=address` or a bare address. |
| `id` | no | An extra column, only if you want to fix the id yourself. See *Ids*. |

**Why tabs and not commas.** A spreadsheet cell cannot hold a tab, so there is nothing to
quote and nothing to get wrong. Commas would need quoting: one of your own titles is
`10,000 Reasons (Bless The Lord)`.

**Columns are found by name**, so their order does not matter and any extra column you add
for your own use is ignored. Short rows are fine: the three data rows above are all valid,
even though two of them stop early.

**Key formats.** All of these are understood: `G`, `Am`, `Eb`, `F#m`, `Bb`, `G major`,
`a minor`. Use a lowercase `b` for a flat. The page then shows the tidy form, `G maj`
or `A min`.

**Key and Camelot.** Give either one and the other is filled in, because the two say the
same thing. Give both and they must agree, or the check fails. This is on purpose: a wrong
key is worse than a failed build. Give neither and the song still works, but it takes no
part in Camelot matching.

**Ids.** Each song gets a stable id from its title and artist, such as
`build-my-life-passion`, or from the title alone when there is no artist. A second song with
the same id gets `-2` on the end. Because the id does not depend on row order, you can sort
or rearrange `songs.tsv` freely without breaking a saved set list or a share link.

## Edit it in a browser, from anywhere

You do not need anything installed. Two ways, both signed in as you, with no extra service
holding your data and no token to leak:

**github.dev**, for a quick change. Open the repository and press `.` — full VS Code in the
browser. Edit, then commit from the Source Control panel. Free, instant, no terminal.

**Codespaces**, when you want a grid and a terminal. Open the repository, press the **Code**
button and start a Codespace. The `.devcontainer/` folder in this repository asks for two
extensions, so they are ready when it opens:

- **Edit csv** (`janisdd.vscode-edit-csv`) — right click `songs.tsv` and choose *Edit as csv*
  to get a real spreadsheet grid: add rows, delete rows, drag columns. Set the delimiter to
  tab if it does not guess it. This is the one to use for entering songs in bulk.
- **Rainbow CSV** (`mechatroner.rainbow-csv`) — colours each column and lines them up while
  you read the plain text, and warns when a row has the wrong number of columns.

In a Codespace you also get a terminal, so `npm run validate` and `npm run serve` both
work. Port 8080 is forwarded for you, so the preview opens in a browser tab.

Free allowances change, so check the current Codespaces figure on your GitHub billing page.
`github.dev` is free and unmetered.

**Pasting from a spreadsheet.** Select the cells in Excel or Google Sheets and copy. The
clipboard is already tab separated, so it pastes straight into `songs.tsv` with nothing to
convert. Keep the header row at the top.

## Publish on GitHub Pages

1. Create the repository on GitHub and push this folder to the `main` branch.
2. Open **Settings > Pages**. Under **Build and deployment**, set **Source** to
   **GitHub Actions**. Do not pick a branch. There is nothing else to fill in.
3. Open the **Actions** tab. If Actions are disabled, enable them.
4. Push any change to `main`. The **Deploy to Pages** workflow runs, checks `songs.tsv`,
   runs the tests, and publishes. It takes about a minute.
5. Your site is at `https://<your-username>.github.io/<repository-name>/`. The exact
   address also appears on the Settings > Pages screen and on the finished deploy.

Notes:

- The workflow needs no extra secrets or tokens. It asks for `pages: write` and
  `id-token: write` itself, and only reads the repository.
- Nothing is committed back to the repository, so the workflow cannot set itself off again.
- If `songs.tsv` has a mistake, or a test fails, nothing is published and **the old site
  stays up**. Read the error in the Actions log, or on the job summary page.
- You can also start a deploy by hand: Actions > Deploy to Pages > Run workflow.
- A private repository needs a paid GitHub plan for Pages. A public one is free.

## Look a song up instead of typing it

    npm run lookup      # then open http://localhost:8081

Paste song names into the box, one per line, press **Look up**, and you get rows ready to
paste onto the end of `songs.tsv`. There is a command line version too:

    node tools/lookup.mjs "Washed" "Elevation Rhythm"
    node tools/lookup.mjs < list.txt            # one song per line
    node tools/lookup.mjs < list.txt >> songs.tsv   # rows only, notes go to the screen

**A PraiseCharts address works in place of a name**, on the command line or on any line of
the box:

    node tools/lookup.mjs https://www.praisecharts.com/songs/details/71880/worthy-sheet-music/chords

That skips the search, so nothing is guessed. It is the cure for a wrong match: searching
for `Worthy Elevation Worship` returns `God I'm Just Grateful`, while the address returns
`Worthy`. Copy the address from the browser; any of the tabs will do, and the scheme and
the `www.` are both optional.

It reads [PraiseCharts](https://www.praisecharts.com). One search, then one song page, with
a gap between songs. The song page carries a JSON payload holding the key, the BPM, the
artists, the themes and a YouTube link, which is read instead of the rendered text.

| Column | Where it comes from |
| --- | --- |
| `title`, `artist` | the matched song. Shouted names such as `ELEVATION RHYTHM` are toned down |
| `key` | the published chart key |
| `bpm` | the song page |
| `camelot` | **not fetched.** `music.js` works it out from the key, so the two cannot disagree |
| `tags` | whichever themes you tick. PraiseCharts lists them alphabetically, so the three ticked to begin with are arbitrary. Press the chips to change them |
| `urls` | `Youtube=` when the page has a video |

**Check every row before you keep it.** Three things go wrong often enough to matter:

1. The first search result is a guess, and sometimes a poor one. The page shows you which
   song it matched. When it is wrong, paste the address instead of the name.
2. The key is the key the chart is published in, which is not always the key on the
   recording. `Praise` by Elevation Worship comes back as `Ab`, not `A`.
3. The BPM is sometimes counted at half speed. `10,000 Reasons` comes back as `70` rather
   than `145`. Both are defensible; only one matches the rest of your file. When
   PraiseCharts has no BPM at all it says `0`, which is read as nothing and leaves the cell
   empty rather than writing a zero the validator would reject.

Nothing is written to `songs.tsv`. The rows are yours to paste, so a wrong match costs you
nothing.

### Why it needs a server

The published page cannot do this. A browser refuses to let one site read another site's
pages unless that site allows it, and PraiseCharts does not. So the fetching stays in Node
and `npm run lookup` serves a small page that asks Node to do it. It runs only while you
run it, and only on your own machine. Opened any other way, the page says so rather than
failing quietly.

## Tests

    npm ci      # once, to fetch jsdom
    npm test

Three suites, about 400 checks, roughly ten seconds:

| Suite | File | What it covers |
| --- | --- | --- |
| data | `tests/tsv.mjs` | Reading `songs.tsv`, including what a spreadsheet does to it |
| startup | `tests/startup.mjs` | Share links, unknown song ids, damaged data, a failed fetch |
| app | `tests/app.mjs` | The page itself: searching, editing, dragging, sharing |

The last two build a document with [jsdom](https://github.com/jsdom/jsdom) and run the
real `app.js` and the real `styles.css` against it. Nothing is mocked out, so a check that
passes describes the shipped code.

`jsdom` is the only dependency in this project, and it is a development one. The published
site still has no build step and loads nothing but its own files.

**When a check fails**, the report names the sentence it was testing, the value it actually
got, and the file and line to open:

    app: 1 of 336 checks FAILED

      1) the Share rules beat the shared button rules, which ask for a taller one
         expected this to be true, but it was not
         got:   44px
         check: tests/app.mjs:122

A failure means one of two things. Either the app broke, or the app changed on purpose and
the check still describes the old behaviour. Read the sentence first: it says what was
meant to be true. On GitHub the same message appears as an annotation on the job summary.

### What the tests cannot see

jsdom is not a browser, and it fails quietly rather than loudly. It ignores:

- `:hover`, `::before` and `::after`, so anything drawn by those is invisible to a test
- `@media (hover: none)`, so the whole touch appearance is untested
- `border` and `border-radius` shorthands holding a `var()`, which it discards entirely
- layout. Every rectangle measures zero, so nothing can be checked by position

It also reports **declared** values rather than used ones. A declared `height: 34px` is
reported as `34px` even while a `min-height: 44px` from another rule is the one the browser
obeys. That exact case shipped a visibly wrong button while the suite stayed green.

So a pass is worth something, but it is not proof that the page looks right. Open it in a
browser too, and on a phone for anything to do with touch.

## Using the page

**Groups.** Starts with Opening, Joyful and Solemn, each with its own colour down the left
edge. Add more with the button at the bottom: it asks for a name first, and offers Offering,
Communion, Closing and Prayer as ready made choices. Rename a group by double tapping its
name, or with its pencil button. The chevron folds a group away when the page gets long.

**The top row.** Left to right: library search, undo, redo, **Share**, light and dark. The
first one opens a read only view of the whole library, described below.

**The header strip.** Under the title you get the song count and every Camelot value in
playing order. Badges are tinted by their place on the wheel, so neighbouring keys look
alike and a jump stands out. A badge ringed in amber is a clash.

**Adding songs.** The Add song button at the foot of a group opens a search panel, and hides
itself while the panel is open. The song directly above is shown right under the search box,
as **Plays after**, so you can see what the next song has to follow. The result list scrolls
inside its own box, so the other groups stay on screen. Type several words and all of them
must match.

A search looks at the title, the artist, the key, the Camelot value and the tags, but the
results are ordered by where the words were found. The whole title comes first, then a
title that begins with what you typed, then a title that holds all of it, then title and
artist together, and last a song that matched only on a tag, a key or a Camelot value.
Songs that answer equally well stay in alphabetical order. So searching `great` gives
*Great Are You Lord* before *How Great Is Our God*, and both before a song merely tagged
`greatness`. A song that matched on a tag shows which tag it was.

**Adding one part way down.** Between every pair of songs, and above the first one, there is a
thin line with a small plus. Point at it, or give it keyboard focus, and it grows into
**+ Add song here**. Tap or click it and the search panel opens right there, with **Plays
after** showing the song above that spot, so Camelot matching works from the right place. The
line above the first song puts the new one at the top of the group.

These lines are always drawn rather than appearing only when pointed at, because a touch
screen has no pointer to reveal them with. They stay quiet so the loud button at the foot,
which is the common action, keeps standing out. They step out of the way while a song is
being dragged.

Adding several in a row works the way you would expect: the panel stays open just below each
song it adds, so a run of songs goes in the order you pick them, not in reverse.

**Camelot match.** Once a group has a song, the *Camelot match* button becomes active, and
names the four codes that fit. It keeps only the songs that sit well after the one above:
the same key, one step around the wheel, or the relative major or minor.

**Allow changing key by up to N semitones.** This box appears once Camelot match is on.
Raise the number and the search also offers songs that would fit *if* you changed their key.
Those results carry a chip such as `-1 -> 10B`. Add one and the change is applied for you.

**A song that is not in the library.** At the foot of the search panel there is
*Not in the list? Add it here*. It asks for a title, an artist, a key picked from
twelve notes plus major or minor, and an optional BPM, then *Cancel* or *Add song*. Whatever
you had typed in the search box becomes the title, so nothing is retyped.

From the moment it is added the song behaves like any other: it takes part in Camelot
matching, it can be transposed, dragged, copied and shared. A dashed **not in library** mark on
the row tells you where it came from.

**Its key can be changed later.** Open such a song in the editor and it gets a **Key** row of
its own, the same two pickers as the form, so a key left out at the start can be filled in and
a wrong one corrected. Changing the key resets the transpose, because a transpose counted from
the old key means nothing against the new one. A library song has no Key row: `songs.tsv`
stays the source of truth for those, so they are transposed instead.

Two things to keep in mind. A hand typed song lives **in the set list, not in the library**,
because a web page cannot write to `songs.tsv`. So it does not show up in searches or in the
library view, and it is carried only by this browser and by share links. To keep it for good,
add it to `songs.tsv` in the normal way. Only a title is required, the same rule `songs.tsv`
follows, so *Add song* turns on as soon as you have typed one.

**Look without touching.** The magnifying glass in the top row opens the whole library as a
plain list: title, artist, key, BPM, Camelot and tags, plus a links button where a song has
links. It has no add button, no Camelot match and no transpose, so nothing you do there can
change your set list. Press Escape or the same button again to close it.

**Editing a song in the set.** Double tap its title, or use its pencil. You get a transpose
stepper, a BPM box, and *Reset* and *Replace song*, both outlined buttons, quieter than the
filled *Done*. The original key and BPM stay on screen next to the new ones, after a hyphen,
so `- orig A maj, 11B`. *Reset* clears both overrides.

The transpose stepper moves in semitones and works out the key and the Camelot value
together, so the two can never disagree.

**Key clash warning.** If a song does not sit well after the one above it in the same group,
an amber line appears on the lower song and names both Camelot values. Group boundaries are
treated as a deliberate change of mood, so no warning is raised across them.

**Share** dims the page and brings up the three choices near the top of the screen. Every
choice is named and explained, so nothing is hidden behind the button. Cancel, Escape, or a
tap on the dimmed area closes it without copying anything.

**Copy Songs and Keys** gives you the group, title and key of every song:

    Opening
    Yeshua - A maj

    Joyful
    Praise - A maj
    Washed - B maj

**Copy Songs, Artists and Keys** adds the artist to the middle:

    Opening
    Yeshua - Jesus Image - A maj

In both text forms, empty groups are left out and changed keys are used, not the original
ones. A song with no artist prints as `Title - Key`, with no empty gap in the middle.

**Share this Set List** copies a link that carries the whole set list in the address.
Nothing is stored on a server. Open it in a new tab, paste it into the address bar of the
tab you are already in, or send it to someone: all three work. Pasting it over your current
set list replaces it, and **Undo** puts back what you had.

Your set list is also saved in the browser as you work, so a reload does not lose it.

**Messages** such as "Added Yeshua to Opening" appear in a small floating bar at the bottom
of the screen. It fades after five seconds, and the cross dismisses it at once.

**The hint** above the set list explains the gestures. Its cross hides it for good, and the
page remembers. To bring it back, clear the site data for the page in your browser.

### Moving things and deleting them

| | Mouse or touch | Keyboard |
| --- | --- | --- |
| Rearrange | **Hold the row** for a moment, then drag. Or drag the four arrow button. | Focus the four arrow button, press up or down arrow |
| Rename group | Double tap the name, or the pencil | Focus the name, press Enter |
| Edit song | Double tap the title, or the pencil | Focus the title, press Enter |
| Delete | Swipe the row sideways, or the bin | Focus the bin, press Enter |
| Fold a group away | The chevron in its header | Focus the chevron, press Enter |

How the three touch gestures are kept apart:

- **Hold still** for about a third of a second and the row is picked up for dragging.
- **Move sideways** first and it becomes a delete swipe instead. The row slides away and a
  red bar with a bin mark appears in the gap it leaves, either side, so you can see what the
  swipe is about to do. Past about 60 pixels the bar brightens and the bin grows: let go now
  and it asks to delete. Let go earlier and the row springs back.
- **Move up or down** first and it is left alone, so the page scrolls as normal.
- A quick tap is far shorter than the hold, so double tap to rename still works.

Every delete asks first, and **Undo** can bring back anything.

Arrow keys move a song past the end of its group into the next one. Nothing wraps around
from the last group back to the first.

### Reading comfort

- Dark grey by default. The sun button switches to light. Your choice is remembered.
- Text starts from your own browser text size, so browser zoom and a larger default both work.
- Buttons are at least 44 pixels, with clear focus outlines.
- Warnings use words and an icon, never colour alone.

## Known limits

1. **Two web fonts load from Google Fonts** (Bricolage Grotesque and Instrument Sans). If
   that is blocked or you are offline, the page falls back to your system font and still
   works. To remove the dependency, delete the three `fonts.` lines from `index.html`.

2. **A local server is needed.** Opening `index.html` straight from disk shows a red banner
   explaining this. It is a browser rule, not a bug in the page.
3. **Drag is not covered by the automated tests.** They cover the keyboard reorder, which
   changes the set list in exactly the same way, and the sideways swipe. Dragging itself
   needs positions from a real layout, so please try it in a browser on a phone and on a
   desktop.
4. **Tags show the first three, then a count.** A row lists three tags and adds a `+2` chip
   for the rest. The strip is also clipped with a fading right edge (the `.tags` rule in
   `styles.css`) in case a single tag is very long.
5. **Share links grow with the set.** A thirty song set makes a link a few hundred
   characters long. It works, but it is not tidy.
6. **Undo history is not saved.** The set list survives a reload; the undo steps do not.
7. **A hand typed song never reaches `songs.tsv`.** It is held in the set list itself, so
   it travels in share links and in this browser only, and it does not appear in searches
   or in the library view. Add it to `songs.tsv` to make it part of the library.
8. **Renaming a song in songs.tsv changes its id.** A share link made before the rename
   will show that row as *Song not found*, with a button to remove it. Set an explicit
   `"id"` on a song if you expect to rename it.
9. **Enharmonic spelling is normalised.** Write `Gb` and the page shows `F# maj`. Same
   sound, one spelling.

## Licence

Copyright (C) 2026 Vince San Juan.

This program is free software: you can redistribute it and modify it under the terms of the
**GNU General Public License, version 3 or later**. The full text is in `LICENSE`, or at
<https://www.gnu.org/licenses/>.

The page itself carries the notice in a footer, with a link to the licence and a GitHub link
to the source, because that is how a reader of the running page learns the terms and can get
the code. **If the repository is ever renamed or moved, change `SOURCE_URL` near the top of
`app.js`.** It is the only place that address appears.

In plain words: you may use it, change it and even sell it, but if you give out a changed
copy you must also give out its source under the same licence. There is no warranty of any
kind.

### What the licence does not cover

- **The songs.** `songs.tsv` lists real songs by real artists. Titles, artists, keys and
  BPM values are plain facts and not covered by this licence, and neither are the songs
  themselves. Every song stays the property of whoever holds its rights. Nothing here gives
  you any right to the music, the lyrics or the recordings.
- **The linked pages.** A `url` entry only points at someone else's website. Those pages
  belong to their owners and have their own terms.
- **The fonts.** Bricolage Grotesque and Instrument Sans are loaded from Google Fonts at
  the time the page opens. No font file is copied into this repository, so their own licence,
  the SIL Open Font License, is not affected either way. Remove the three `fonts.` lines in
  `index.html` to drop them.
