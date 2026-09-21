# Set List Builder

A one page tool to build a song set list, with Camelot key matching so songs flow.
Static site, no backend, no build step. It runs on GitHub Pages.

| File | What it does |
| --- | --- |
| `songs.json` | Your song library. The only file you edit by hand. |
| `music.js` | Camelot wheel maths and song checking. Used by the page and by the checker. |
| `app.js` | The page behaviour. |
| `index.html`, `styles.css` | The page and its styling. |
| `tools/validate.mjs` | Checks `songs.json`. Run by the Action before every deploy. |
| `.github/workflows/deploy.yml` | Checks the data, then publishes to Pages. |
| `LICENSE` | The GNU General Public License, version 3. |

## Run it on your machine

A browser blocks `fetch` when a page is opened as `file://`, so the page must be served
over http. Either is fine:

    py -m http.server 8080

...then open `http://localhost:8080/`. Or install the **Live Server** extension in
VS Code, right click `index.html` and choose *Open with Live Server*.

Edit `songs.json`, save, refresh the page. There is nothing to rebuild.

To check the data the same way the Action does:

    node tools/validate.mjs songs.json

## Edit songs.json

A JSON array. Copy this template for a new song:

```json
  {
    "title": "Song Title",
    "artist": "Artist Name",
    "key": "G",
    "bpm": 120,
    "camelot": "",
    "tags": ["opening", "gentle"],
    "urls": [
      { "label": "YouTube", "url": "https://example.com/watch" },
      { "label": "Chords", "url": "https://example.com/chords" }
    ]
  }
```

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Duplicates are allowed. `Build My Life` appears twice in the sample data. |
| `artist` | yes | Tells duplicate titles apart. |
| `key` | no | See the key formats below. |
| `bpm` | no | A number from 20 to 400, or leave it out. |
| `camelot` | no | Leave blank and it is worked out from the key. |
| `tags` | no | Any words you like. They are searchable. |
| `urls` | no | `{ "label": ..., "url": ... }` pairs. A plain URL string also works. |
| `id` | no | Only if you want to fix the id yourself. See *Ids* below. |

**Key formats.** All of these are understood: `G`, `Am`, `Eb`, `F#m`, `Bb`, `G major`,
`a minor`. Use a lowercase `b` for a flat. The page then shows the tidy form, `G maj`
or `A min`.

**Key and Camelot.** Give either one and the other is filled in, because the two say the
same thing. Give both and they must agree, or the build fails. This is on purpose: a wrong
key is worse than a failed build. Give neither and the song still works, but it takes no
part in Camelot matching.

**Ids.** Each song gets a stable id from its title and artist, such as
`build-my-life-passion`. A second song with the same title and artist gets `-2` on the end.
Because the id does not depend on row order, you can sort or rearrange `songs.json` freely
without breaking a saved set list or a share link.

## Publish on GitHub Pages

1. Create the repository on GitHub and push this folder to the `main` branch.
2. Open **Settings > Pages**. Under **Build and deployment**, set **Source** to
   **GitHub Actions**. Do not pick a branch. There is nothing else to fill in.
3. Open the **Actions** tab. If Actions are disabled, enable them.
4. Push any change to `main`. The **Deploy to Pages** workflow runs, checks `songs.json`,
   and publishes. It takes about half a minute.
5. Your site is at `https://<your-username>.github.io/<repository-name>/`. The exact
   address also appears on the Settings > Pages screen and on the finished deploy.

Notes:

- The workflow needs no extra secrets or tokens. It asks for `pages: write` and
  `id-token: write` itself, and only reads the repository.
- Nothing is committed back to the repository, so the workflow cannot set itself off again.
- If `songs.json` has a mistake, the check fails and **the old site stays up**. Read the
  error in the Actions log.
- You can also start a deploy by hand: Actions > Deploy to Pages > Run workflow.
- A private repository needs a paid GitHub plan for Pages. A public one is free.

## Using the page

**Groups.** Starts with Opening, Joyful and Solemn, each with its own colour down the left
edge. Add more with the button at the bottom: it asks for a name first, and offers Offering,
Communion, Closing and Prayer as ready made choices. Rename a group by double tapping its
name, or with its pencil button. The chevron folds a group away when the page gets long.

**The top row.** Left to right: library search, undo, redo, copy set list, share link,
light and dark. The first one opens a read only view of the whole library, described below.

**The header strip.** Under the title you get the song count and every Camelot value in
playing order. Badges are tinted by their place on the wheel, so neighbouring keys look
alike and a jump stands out. A badge ringed in amber is a clash.

**Adding songs.** The Add song button inside a group opens a search panel, and hides itself
while the panel is open. The song directly above is shown right under the search box, as
**Plays after**, so you can see what the next song has to follow. The result list scrolls
inside its own box, so the other groups stay on screen. Type several words and all of them
must match.

**Camelot match.** Once a group has a song, the *Camelot match* button becomes active, and
names the four codes that fit. It keeps only the songs that sit well after the one above:
the same key, one step around the wheel, or the relative major or minor.

**Allow changing key by up to N semitones.** This box appears once Camelot match is on.
Raise the number and the search also offers songs that would fit *if* you changed their key.
Those results carry a chip such as `-1 -> 10B`. Add one and the change is applied for you.

**Look without touching.** The magnifying glass in the top row opens the whole library as a
plain list: title, artist, key, BPM, Camelot and tags, plus a links button where a song has
links. It has no add button, no Camelot match and no transpose, so nothing you do there can
change your set list. Press Escape or the same button again to close it.

**Editing a song in the set.** Double tap its title, or use its pencil. You get a transpose
stepper, a BPM box, and *Reset* and *Replace song*, both outlined buttons, quieter than the
filled *Done*. The original key and BPM stay on screen next to the new ones, after a hyphen,
so `- orig A maj 11B`. *Reset* clears both overrides.

The transpose stepper moves in semitones and works out the key and the Camelot value
together, so the two can never disagree.

**Key clash warning.** If a song does not sit well after the one above it in the same group,
an amber line appears on the lower song and names both Camelot values. Group boundaries are
treated as a deliberate change of mood, so no warning is raised across them.

**Copy Set List** gives you plain text:

    Opening
    Yeshua - Jesus Image - A maj

    Joyful
    Praise - Elevation Worship - A maj
    Washed - Elevation Rhythm - B maj

Empty groups are left out. Changed keys are used, not the original ones.

**Share link** copies a link that carries the whole set list in the address. Nothing is
stored on a server. Open it in a new tab, paste it into the address bar of the tab you are
already in, or send it to someone: all three work. Pasting it over your current set list
replaces it, and **Undo** puts back what you had.

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

0. **Two web fonts load from Google Fonts** (Bricolage Grotesque and Instrument Sans). If
   that is blocked or you are offline, the page falls back to your system font and still
   works. To remove the dependency, delete the three `fonts.` lines from `index.html`.

1. **A local server is needed.** Opening `index.html` straight from disk shows a red banner
   explaining this. It is a browser rule, not a bug in the page.
2. **Drag is not covered by the automated tests.** They cover the keyboard reorder, which
   changes the set list in exactly the same way, and the sideways swipe. Dragging itself
   needs positions from a real layout, so please try it in a browser on a phone and on a
   desktop.
3. **Tags show the first three, then a count.** A row lists three tags and adds a `+2` chip
   for the rest. The strip is also clipped with a fading right edge (the `.tags` rule in
   `styles.css`) in case a single tag is very long. Note that the sample `songs.json` has no
   tags yet, so nothing appears until you add some.
4. **Share links grow with the set.** A thirty song set makes a link a few hundred
   characters long. It works, but it is not tidy.
5. **Undo history is not saved.** The set list survives a reload; the undo steps do not.
6. **Renaming a song in songs.json changes its id.** A share link made before the rename
   will show that row as *Song not found*, with a button to remove it. Set an explicit
   `"id"` on a song if you expect to rename it.
7. **Enharmonic spelling is normalised.** Write `Gb` and the page shows `F# maj`. Same
   sound, one spelling.

## Licence

Copyright (C) 2026 Vince San Juan.

This program is free software: you can redistribute it and modify it under the terms of the
**GNU General Public License, version 3 or later**. The full text is in `LICENSE`, or at
<https://www.gnu.org/licenses/>.

In plain words: you may use it, change it and even sell it, but if you give out a changed
copy you must also give out its source under the same licence. There is no warranty of any
kind.

### What the licence does not cover

- **The songs.** `songs.json` lists real songs by real artists. Titles, artists, keys and
  BPM values are plain facts and not covered by this licence, and neither are the songs
  themselves. Every song stays the property of whoever holds its rights. Nothing here gives
  you any right to the music, the lyrics or the recordings.
- **The linked pages.** A `url` entry only points at someone else's website. Those pages
  belong to their owners and have their own terms.
- **The fonts.** Bricolage Grotesque and Instrument Sans are loaded from Google Fonts at
  the time the page opens. No font file is copied into this repository, so their own licence,
  the SIL Open Font License, is not affected either way. Remove the three `fonts.` lines in
  `index.html` to drop them.
