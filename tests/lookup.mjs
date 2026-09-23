/* Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE. */
/* tools/lookup.mjs, fed made up pages.

   No test here touches the network. That keeps the suite fast and keeps CI from
   leaning on someone else's site, but it also means these checks cannot tell you
   that PraiseCharts still serves what this expects. Only running the tool can.
   The fixtures copy the shape of a real page as it was in September 2026. */

import { firstSongLink, songLinkFromInput, chordsUrl, parseSong, toRow }
  from '../tools/lookup.mjs';
import { reporter } from './report.mjs';

const { check, eq, done } = reporter('lookup', import.meta.url);

/** Wraps a payload the way a PraiseCharts page carries it. */
const page = (state) =>
  `<html><head><title>x</title></head><body><div>markup</div>
   <script id="ng-state" type="application/json">${JSON.stringify(state)}</script>
   </body></html>`;

/** The real payload buries the song under request hashes, so this does too. */
const payload = (item, title = 'Washed') => ({
  'web-some-flag': false,
  '24bc598b4ca011b756b18a6178b8f889': {
    b: { id: 88825, catalog_item_title: title, item },
  },
});

const FULL = {
  keys: 'B, Bb, F',
  youtube_url: 'https://www.youtube.com/watch?v=JjgkhHlTROQ',
  meter: '4/4',
  original_key: 'B',
  bpm: '139',
  artists: [{ name: 'ELEVATION RHYTHM' }],
  themes: [{ theme: 'Blood' }, { theme: 'Cleansing' }, { theme: 'Forgiveness' },
    { theme: 'Redemption' }, { theme: 'Salvation' }],
  copyright: { ccli: '7263433' },
};

/* ---------- finding the song on a page of results ---------- */

check(firstSongLink('<a href="/help">no</a><a href="/songs/details/88825/washed/chords">yes</a>')
  === '/songs/details/88825/washed/chords',
  'the first song link is picked out of a page of results');
check(firstSongLink('<a href="/store">nothing here</a>') === null,
  'and no results gives nothing back rather than a wrong guess');
check(firstSongLink('<a href="/songs/details/1/a/chords">first</a><a href="/songs/details/2/b/chords">second</a>')
  === '/songs/details/1/a/chords',
  'the first is taken, not the last');

/* ---------- a pasted address instead of a name ---------- */

const PASTED = '/songs/details/71880/worthy-sheet-music';
const forms = {
  'the address as copied from the browser':
    'https://www.praisecharts.com/songs/details/71880/worthy-sheet-music/chords',
  'without the tab on the end': 'https://www.praisecharts.com/songs/details/71880/worthy-sheet-music',
  'from a different tab': 'https://www.praisecharts.com/songs/details/71880/worthy-sheet-music/stage-chart',
  'with no scheme': 'www.praisecharts.com/songs/details/71880/worthy-sheet-music/chords',
  'with no www': 'https://praisecharts.com/songs/details/71880/worthy-sheet-music/chords',
  'with something tacked on the end':
    'https://www.praisecharts.com/songs/details/71880/worthy-sheet-music/chords?key=G',
  'with space around it': '  https://www.praisecharts.com/songs/details/71880/worthy-sheet-music  ',
};
for (const [what, input] of Object.entries(forms)) {
  const got = songLinkFromInput(input);
  check(typeof got === 'string' && got.startsWith(PASTED),
    `an address is recognised ${what}`, JSON.stringify(got));
  check(chordsUrl(got) === `https://www.praisecharts.com${PASTED}/chords`,
    `and lands on the chords page ${what}`, chordsUrl(got));
}

check(songLinkFromInput('Worthy Elevation Worship') === null,
  'a plain song name is not mistaken for an address');
check(songLinkFromInput('https://www.praisecharts.com/search?q=worthy') === null,
  'and neither is a PraiseCharts address that is not a song page');
check(songLinkFromInput('https://open.spotify.com/track/123') === null,
  'nor an address on another site');

check(chordsUrl('/songs/details/1/a/stage-chart') === 'https://www.praisecharts.com/songs/details/1/a/chords',
  'any product page is turned into the chords page, which is the one with the data',
  chordsUrl('/songs/details/1/a/stage-chart'));
check(chordsUrl('/songs/details/1/a/chords') === 'https://www.praisecharts.com/songs/details/1/a/chords',
  'a chords page is left as it is');
check(chordsUrl('https://www.praisecharts.com/songs/details/1/a/chords')
  === 'https://www.praisecharts.com/songs/details/1/a/chords',
  'and a full address is not given the site name twice');

/* ---------- reading the payload ---------- */

const song = parseSong(page(payload(FULL)));
check(!!song, 'a song is found inside the payload');
eq(song.title, 'Washed', 'the title is read');
eq(song.key, 'B', 'the key is read');
eq(song.bpm, '139', 'the BPM is read, which the rendered page never shows');
eq(song.themes.length, 5, 'every theme is kept at this stage');
eq(song.youtube, 'https://www.youtube.com/watch?v=JjgkhHlTROQ', 'and the YouTube link');

eq(song.artist, 'Elevation Rhythm',
  'a shouted artist name is toned down, because the file is not written in capitals');
eq(parseSong(page(payload({ ...FULL, artists: [{ name: 'UPPERROOM' }] }))).artist, 'UPPERROOM',
  'but a single word is left alone, since some names really are spelt that way');
eq(parseSong(page(payload({ ...FULL, artists: [{ name: 'CeCe Winans' }, { name: 'Kari Jobe' }] }))).artist,
  'CeCe Winans, Kari Jobe', 'and ordinary names are untouched, however many there are');

check(parseSong('<html><body>no payload at all</body></html>') === null,
  'a page with no payload gives nothing back');
check(parseSong('<script id="ng-state" type="application/json">{not json</script>') === null,
  'and so does a payload that will not parse, rather than throwing');
check(parseSong(page({ 'web-flag': false })) === null,
  'a payload holding no song gives nothing back');

/* ---------- building the row ---------- */

const { row, notes } = toRow(song);
const cells = row.split('\t');
eq(cells.length, 7, 'a row has one cell for every column in songs.tsv');
eq(cells, ['Washed', 'Elevation Rhythm', 'B', '139', '1B', 'blood;cleansing;forgiveness',
  'Youtube=https://www.youtube.com/watch?v=JjgkhHlTROQ'], 'and each one holds what it should');
eq(notes, [], 'a complete song has nothing to warn about');

check(cells[4] === '1B', 'the Camelot value is worked out from the key, not fetched', cells[4]);
check(cells[5].split(';').length === 3, 'only the first three themes become tags',
  cells[5]);
check(cells[5] === cells[5].toLowerCase(), 'and tags are lower case, like the rest of the file');

const minor = toRow({ ...song, key: 'Am', themes: [] });
eq(minor.row.split('\t')[4], '8A', 'a minor key gets the minor side of the wheel');
eq(minor.row.split('\t')[5], '', 'no themes leaves the tags cell empty, not the word undefined');

const noKey = toRow({ ...song, key: '' });
eq(noKey.row.split('\t')[4], '', 'no key means no Camelot value');
check(noKey.notes.some((n) => n.includes('no key')), 'and it says so', noKey.notes.join(' | '));

const oddKey = toRow({ ...song, key: 'H sharp' });
eq(oddKey.row.split('\t')[2], 'H sharp', 'an unreadable key is passed through rather than dropped');
check(oddKey.notes.some((n) => n.includes('check it by hand')),
  'but it is flagged, because the validator will reject it later',
  oddKey.notes.join(' | '));

const noBpm = toRow({ ...song, bpm: '' });
check(noBpm.notes.some((n) => n.includes('BPM')), 'a missing BPM is called out',
  noBpm.notes.join(' | '));

// A tab inside a cell would silently add a column and shift every later value.
const nasty = toRow({ ...song, title: 'Odd\tTitle', artist: 'Some\nBand' });
eq(nasty.row.split('\t').length, 7, 'a tab inside a value cannot add a column');
eq(nasty.row.split('\t')[0], 'Odd Title', 'it becomes a space instead');
eq(nasty.row.split('\t')[1], 'Some Band', 'and so does a newline');

check(!toRow({ ...song, youtube: '' }).row.endsWith('Youtube='),
  'no video link leaves the urls cell empty rather than a label with nothing after it',
  toRow({ ...song, youtube: '' }).row);

done();
