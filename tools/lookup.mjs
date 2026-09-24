/* Look up a song on PraiseCharts and turn it into a songs.tsv row.
   Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE.

   A PraiseCharts song page carries a JSON payload in <script id="ng-state">,
   holding the key, the BPM, the artists, the themes and a YouTube link. That is
   read instead of the rendered text, because a label and its value are next to
   each other in the data but not in the markup.

   The Camelot value is not fetched. music.js works it out from the key, which
   is the same code the page itself uses, so the two can never disagree.

   Usage:
     node tools/lookup.mjs "Washed" "Elevation Rhythm"
     node tools/lookup.mjs https://www.praisecharts.com/songs/details/71880/worthy-sheet-music
     node tools/lookup.mjs < list.txt        # one song per line, names or addresses
     npm run lookup                          # the same thing with a page

   Nothing is written to songs.tsv. The row is printed for you to check and
   paste, because the first search result is a guess and sometimes a wrong one. */

import { pathToFileURL } from 'node:url';
import { camelotForKey } from '../music.js';

const SITE = 'https://www.praisecharts.com';
const UA = 'SetListBuilder-lookup/1.0 (+https://github.com/VinceSanJuan/SetListBuilder)';

/**
 * Themes are plentiful and PraiseCharts lists them alphabetically, so the first
 * few are not the most useful few. This many are ticked to begin with, and the
 * page lets you change which ones.
 */
export const TAG_LIMIT = 3;

/** The columns of songs.tsv, in order. */
export const COLUMNS = ['title', 'artist', 'key', 'bpm', 'camelot', 'tags', 'urls'];

/** Where the tags sit in a row. The page rewrites that one cell as you pick. */
export const TAG_CELL = COLUMNS.indexOf('tags');

/* ---------- pulling the data out of a page ---------- */

/** The first song in a set of search results, as a site relative path. */
export function firstSongLink(html) {
  const m = /href="([^"]*\/songs\/details\/[^"]+)"/.exec(html);
  return m ? m[1] : null;
}

/**
 * A pasted PraiseCharts address, as a site relative path, or null when the text
 * is not one. Anything after the song name is ignored, so a link copied from any
 * of the product tabs works, and so does one with no tab on the end at all.
 */
export function songLinkFromInput(text) {
  const m = /^(?:https?:\/\/)?(?:www\.)?praisecharts\.com(\/songs\/details\/\d+\/[^\s?#]*)/i
    .exec(String(text).trim());
  return m ? m[1] : null;
}

/**
 * Any product page will do, but only the chords page carries the full payload.
 * The address is rebuilt from the song number and name rather than having its
 * last part swapped, because a pasted link may have no last part to swap.
 */
export function chordsUrl(link) {
  const abs = link.startsWith('http') ? link : SITE + link;
  const m = /^(https?:\/\/[^/]+\/songs\/details\/\d+\/[^/?#]+)/.exec(abs);
  return m ? `${m[1]}/chords` : abs;
}

/**
 * The fields worth having, or null when the page holds no song.
 * Everything is optional except the title, because pages do vary.
 */
export function parseSong(html) {
  const m = /<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;

  let state;
  try {
    state = JSON.parse(m[1]);
  } catch {
    return null; // the payload is theirs to change, and one day they will
  }

  // The payload is keyed by request hashes, so the song is found by shape.
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.catalog_item_title && node.item && typeof node.item === 'object') found.push(node);
    for (const v of Object.values(node)) walk(v);
  };
  walk(state);

  const hit = found.find((f) => f.item.original_key) ?? found[0];
  if (!hit) return null;

  const item = hit.item;
  return {
    title: String(hit.catalog_item_title).trim(),
    artist: calm((item.artists ?? []).map((a) => a.name).join(', ').trim()),
    key: item.original_key ? String(item.original_key).trim() : '',
    // PraiseCharts writes 0 when it has no BPM rather than leaving the field
    // out. As a string that is truthy, so it has to be tested as a number or a
    // zero ends up in the file and the validator rejects it there.
    bpm: Number(item.bpm) > 0 ? String(item.bpm).trim() : '',
    themes: (item.themes ?? []).map((t) => t.theme).filter(Boolean),
    youtube: item.youtube_url ?? '',
    ccli: item.copyright?.ccli ?? '',
  };
}

/* ---------- turning it into a row ---------- */

/** A tab or a newline in a cell would break the file, so they become spaces. */
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();

/**
 * PraiseCharts shouts some artist names, such as ELEVATION RHYTHM. A name in
 * capitals that has a space in it is almost always shouting, so it is toned
 * down. A single word is left alone, because UPPERROOM really is spelt that way.
 */
const calm = (name) => name
  .split(', ')
  .map((one) => (one.includes(' ') && one === one.toUpperCase() && /[A-Z]/.test(one)
    ? one.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, edge, c) => edge + c.toUpperCase())
    : one))
  .join(', ');

/**
 * A songs.tsv row, plus anything about it worth saying out loud.
 * The key is re spelled the way music.js stores it, so the file stays consistent.
 */
export function toRow(song, { tagLimit = TAG_LIMIT } = {}) {
  const notes = [];

  const key = clean(song.key);
  let camelot = '';
  if (key) {
    camelot = camelotForKey(key) ?? '';
    if (!camelot) {
      notes.push(`the key "${key}" is not one this project understands, so check it by hand`);
    }
  } else {
    notes.push('no key found, so no Camelot value either');
  }

  if (!song.bpm) notes.push('no BPM found');
  if (!song.artist) notes.push('no artist found');

  const tags = song.themes.slice(0, tagLimit).map((t) => clean(t).toLowerCase());
  const urls = song.youtube ? `Youtube=${clean(song.youtube)}` : '';

  const row = [clean(song.title), clean(song.artist), key, clean(song.bpm), camelot,
    tags.join(';'), urls].join('\t');

  return { row, notes };
}

/* ---------- fetching ---------- */

const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.text();
};

/**
 * Search, then read the first result. Returns the row and anything worth saying,
 * or a plain "nothing found" when the search comes back empty.
 */
export async function lookup(query) {
  const notes = [];

  // A pasted song address says exactly which song is wanted, so the search is
  // skipped and there is no first result to have guessed wrong.
  let link = songLinkFromInput(query);
  if (link) {
    notes.push('used the address you gave, so no searching was needed');
  } else if (/praisecharts\.com/i.test(query)) {
    return { query, found: false, notes: ['that is a PraiseCharts address but not a song '
      + 'page. A song page looks like /songs/details/71880/worthy-sheet-music/chords'] };
  } else if (/^https?:\/\//i.test(query)) {
    return { query, found: false, notes: ['only PraiseCharts addresses can be pasted here. '
      + 'For anything else, give the song name and the artist'] };
  } else {
    const results = await get(`${SITE}/search?q=${encodeURIComponent(query)}`);
    link = firstSongLink(results);
    if (!link) return { query, found: false, notes: ['no song of that name on PraiseCharts'] };
  }

  const url = chordsUrl(link);
  const song = parseSong(await get(url));
  if (!song) {
    return { query, found: false, notes: [...notes, `the page at ${url} held no song data`] };
  }

  const built = toRow(song);
  return {
    query,
    found: true,
    song,
    url,
    row: built.row,
    tagCell: TAG_CELL, // so the page need not know the column order itself
    notes: [...notes, ...built.notes],
  };
}

/* ---------- command line ---------- */

const PAUSE_MS = 700; // one at a time, with a gap, because this is someone else's site
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function main() {
  const args = process.argv.slice(2);
  const queries = args.length
    ? [args.join(' ')]
    : (await readStdin()).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (!queries.length) {
    console.error('Usage: node tools/lookup.mjs "<title>" "<artist>"');
    console.error('   or: node tools/lookup.mjs < list.txt      (one song per line)');
    process.exit(1);
  }

  const rows = [];
  for (const [i, q] of queries.entries()) {
    if (i) await sleep(PAUSE_MS);
    try {
      const r = await lookup(q);
      if (!r.found) {
        console.error(`-- ${q}: ${r.notes.join('; ')}`);
        continue;
      }
      console.error(`-- ${q}\n--   matched "${r.song.title}" by ${r.song.artist || 'nobody named'}`);
      for (const n of r.notes) console.error(`--   ${n}`);
      rows.push(r.row);
    } catch (err) {
      console.error(`-- ${q}: ${err.message}`);
    }
  }

  // The rows go to stdout and the commentary to stderr, so this can be piped
  // straight onto the end of songs.tsv without the notes coming too.
  for (const row of rows) console.log(row);
  if (!rows.length) process.exit(1);
}

// Only run when this file is the program, so the tests can import it quietly.
// pathToFileURL rather than building the address by hand, which went wrong on a
// path holding a space, and on any import that has no program path at all.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
