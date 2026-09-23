/* Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE. */
/* Startup paths: share link, missing song id, bad songs.json, and a failed fetch.
   Each case gets a fresh jsdom plus a fresh copy of app.js (cache busted by a query). */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { reporter } from './report.mjs';

const from = (name) => new URL(`../${name}`, import.meta.url);
const baseHtml = readFileSync(from('index.html'), 'utf8').replace(
  '<script type="module" src="app.js"></script>', '');
const realSongs = readFileSync(from('songs.tsv'), 'utf8');

/** Fixtures stay readable as objects, and become tab separated text here. */
const COLS = ['title', 'artist', 'key', 'bpm', 'camelot', 'tags', 'urls'];
const toTsv = (rows) => [
  COLS.join('\t'),
  ...rows.map((r) => COLS.map((c) => {
    const v = r[c];
    if (Array.isArray(v)) {
      return c === 'urls'
        ? v.map((u) => (typeof u === 'string' ? u : `${u.label}=${u.url}`)).join(';')
        : v.join(';');
    }
    return v ?? '';
  }).join('\t')),
].join('\n');

const { check, done } = reporter('startup', import.meta.url);
let nonce = 0;

async function boot({ hash = '', songs = realSongs, fetchFails = false, stored = null,
                      hintOff = false, url = 'http://localhost:8080/' } = {}) {
  const dom = new JSDOM(baseHtml, { url: `${url}${hash}`, pretendToBeVisual: true });
  const { window } = dom;
  for (const k of ['document', 'window', 'location', 'history', 'localStorage', 'navigator',
                   'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent']) {
    globalThis[k] = window[k];
  }
  globalThis.scrollBy = () => {};
  globalThis.innerHeight = 800;
  window.Element.prototype.setPointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };

  if (stored) window.localStorage.setItem('slb.state', JSON.stringify(stored));
  if (hintOff) window.localStorage.setItem('slb.hint', 'off');

  globalThis.fetch = async () => {
    if (fetchFails) throw new TypeError('Failed to fetch');
    const body = typeof songs === 'string' ? songs : toTsv(songs);
    return { ok: true, status: 200, text: async () => body };
  };

  await import(`${from('app.js')}?n=${nonce++}`);
  await new Promise((r) => setTimeout(r, 40));
  return window;
}

const t = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const urlSafe = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* ---------- 1. a share link rebuilds the set list ---------- */

let w = await boot({
  hash: '#' + urlSafe([
    ['Prelude', '#d9911a', [['yeshua-jesus-image', 0, 0], ['praise-elevation-worship', 2, 130]]],
    ['Sending', '#e0567b', [['washed-elevation-rhythm', 0, 0]]],
  ]),
});
let names = [...w.document.querySelectorAll('.group-name')].map(t);
check(names.join(',') === 'Prelude,Sending', 'share link restores the group names', names.join(','));
check(w.document.querySelectorAll('.song').length === 3, 'and all three songs');
check(t(w.document.querySelector('#status')).includes('share link'),
  'status says where it came from', t(w.document.querySelector('#status')));
check(w.location.hash === '', 'the hash is cleared from the address bar', w.location.hash);

const second = w.document.querySelectorAll('.song')[1];
check(t(second.querySelector('.song-meta')).includes('B maj'),
  'the transpose in the link is applied: A maj +2 is B maj', t(second.querySelector('.song-meta')));
check(t(second.querySelector('.song-meta')).includes('130 BPM'), 'the BPM override survives the link');
check(t(second.querySelector('.song-meta')).includes('orig A maj'), 'the original is still shown');

/* ---------- 2. a link naming a song that no longer exists ---------- */

// deliberately the older two field shape, to prove old links still open
w = await boot({ hash: '#' + urlSafe([['Old set', [['yeshua-jesus-image', 0, 0]]]]) });
check(w.document.querySelectorAll('.song').length === 1,
  'a link made before group colours existed still opens',
  String(w.document.querySelectorAll('.song').length));
check([...w.document.querySelectorAll('.group-name')].map(t).join(',') === 'Old set',
  'with its group name intact');
check(w.document.querySelector('.group').style.getPropertyValue('--gc') !== '',
  'and it is given a colour');

w = await boot({ hash: '#' + urlSafe([['Old set', '#3e5a9e', [['deleted-song-id', 0, 0]]]]) });
check(w.document.querySelectorAll('.song.missing').length === 1, 'missing song gets its own row');
check(t(w.document.querySelector('.song.missing')).includes('deleted-song-id'),
  'the row names the id that could not be found');
check(!!w.document.querySelector('.song.missing [data-act="del-song"]'),
  'and it can still be removed');

/* ---------- 3. a damaged share link falls back instead of breaking ---------- */

w = await boot({ hash: '#not-valid-base64-!!!' });
check([...w.document.querySelectorAll('.group-name')].map(t).join(',') === 'Opening,Joyful,Solemn',
  'a damaged link falls back to the default groups');
check(t(w.document.querySelector('#status')).includes('could not be read'),
  'and says so plainly', t(w.document.querySelector('#status')));

/* ---------- 4. bad rows are reported, good rows still load ---------- */

w = await boot({
  songs: [
    { title: 'Fine Song', artist: 'Someone', key: 'G', bpm: 120 },
    { title: 'No Artist', key: 'C' },
    { artist: 'No Title', key: 'C' },
    { title: 'Bad Key', artist: 'X', key: 'Q sharp' },
    { title: 'Key Fights Camelot', artist: 'X', key: 'C', camelot: '9B' },
    { title: 'Silly BPM', artist: 'X', key: 'C', bpm: 9000 },
    { title: 'No Key At All', artist: 'Y' },
  ],
});
const banner = w.document.querySelector('#data-errors');
check(!banner.hidden, 'the error banner is shown');
check(t(banner).includes('4 problems'), 'it counts the bad rows', t(banner));
check(!t(banner).includes('artist is required'), 'a missing artist is not a problem any more');
check(t(banner).includes('title is required'), 'but a missing title still is');
check(t(banner).includes('unrecognized key'), 'bad key reported');
check(t(banner).includes('but file says'), 'key and Camelot disagreement reported', t(banner));
check(t(banner).includes('bpm must be'), 'bad BPM reported');

w.document.querySelector('.plus[data-act="open-search"]').dispatchEvent(
  new w.MouseEvent('click', { bubbles: true, detail: 1, button: 0 }));
const titles = [...w.document.querySelectorAll('.r-title')].map(t);
check(titles.join(',') === 'Fine Song,No Artist,No Key At All',
  'the usable songs are offered, an unknown artist included', titles.join(','));

const noArtist = [...w.document.querySelectorAll('.result')].find((r) => t(r).includes('No Artist'));
check(!noArtist.querySelector('.r-artist'),
  'and its row leaves out the artist line rather than showing an empty one');

const noKey = [...w.document.querySelectorAll('.result')].find((r) => t(r).includes('No Key At All'));
check(t(noKey).includes('--'), 'a song with no key shows dashes, not a guessed key', t(noKey));

/* ---------- 5. songs.json cannot be read at all ---------- */

w = await boot({ fetchFails: true });
const fatal = w.document.querySelector('#data-errors');
check(!fatal.hidden && fatal.classList.contains('fatal'), 'a load failure shows the fatal banner');
check(t(fatal).includes('file://'), 'the message explains the file protocol trap', t(fatal));
check(t(fatal).includes('http.server'), 'and gives a command that fixes it');
check(w.document.querySelectorAll('.group').length === 0, 'no set list is drawn without songs');

/* ---------- 6. a saved set list is reloaded ---------- */

w = await boot({
  stored: {
    groups: [{
      id: 'g1', name: 'Saved',
      entries: [{ uid: 'e1', songId: 'yeshua-jesus-image', transpose: 0, bpm: null }],
    }],
  },
});
check([...w.document.querySelectorAll('.group-name')].map(t).join(',') === 'Saved',
  'localStorage set list is restored');
check(w.document.querySelectorAll('.song').length === 1, 'with its song');
check(w.document.querySelector('#btn-undo').disabled,
  'undo starts disabled, a restored set list is not an edit to undo');

/* ---------- 7. a dismissed hint stays dismissed ---------- */

w = await boot({ hintOff: true });
check(w.document.querySelector('#hint').hidden, 'a hint dismissed earlier does not come back');

w = await boot();
check(!w.document.querySelector('#hint').hidden, 'but a fresh visitor still sees it');

/* ---------- 8. the source link, wherever the page is served from ---------- */

const REPO = 'https://github.com/VinceSanJuan/SetListBuilder';
const src = async (pageUrl) => {
  const win = await boot({ url: pageUrl });
  return win.document.querySelector('#source-link a')?.getAttribute('href') ?? '';
};

for (const where of ['http://localhost:8080/', 'https://vsanjuan.github.io/SetListBuilder/',
                     'https://setlists.example.com/']) {
  check(await src(where) === REPO, `the source link holds on ${where}`, await src(where));
}

done();
