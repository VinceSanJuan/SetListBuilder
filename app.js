/*
 * Set List Builder - build a song set list with Camelot key matching.
 * Copyright (C) 2026 Vince San Juan
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version. See the LICENSE file, or <https://www.gnu.org/licenses/>.
 *
 * This program is distributed WITHOUT ANY WARRANTY, without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
/* Set List Builder. Reads songs.tsv, keeps the set list in the browser only. */

import {
  prepareSongs, parseCamelot, camelotStr, shift, compatible,
  bestShift, keyForCamelot, camelotForKey, resolveKey, keyToPicker, TONICS,
  songsFromTsv,
} from './music.js';

/* ---------- small helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const uid = () => Math.random().toString(36).slice(2, 9);

const STATE_KEY = 'slb.state';
const THEME_KEY = 'slb.theme';
const HINT_KEY = 'slb.hint';
const DEFAULT_GROUPS = ['Opening', 'Joyful', 'Solemn'];
const GROUP_IDEAS = ['Offering', 'Communion', 'Closing', 'Prayer'];
const PALETTE = ['#d9911a', '#e0567b', '#3e5a9e', '#1f8a7a', '#8a4fb0', '#c2563a', '#5b7f2a'];
const MAX_HISTORY = 50;
const TAGS_SHOWN = 3;
const HOLD_MS = 380; // hold this long on a row to pick it up

/* Where a reader can get the source, which is the whole point of the GPL.
   Change this if the repository ever moves or is renamed. */
const SOURCE_URL = 'https://github.com/VinceSanJuan/SetListBuilder';

/* ---------- icons ---------- */

const svg = (body, size = 18, cls = '') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${body}</svg>`;

const ic = {
  // four arrows: the usual "move this" sign, clearer than grip dots
  move: svg('<path d="M12 4v16M4 12h16"/><path d="m9 7 3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chev: svg('<path d="m6 9 6 6 6-6"/>', 16, 'chev'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 10 18.7l1-1"/>', 15),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  wheel: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>'),
  undo: svg('<path d="M9 5 5 9l4 4"/><path d="M5 9h9a5 5 0 0 1 0 10h-4"/>'),
  redo: svg('<path d="m15 5 4 4-4 4"/><path d="M19 9h-9a5 5 0 0 0 0 10h4"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  share: svg('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  sun: svg('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>'),
  warn: svg('<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17h.01"/>', 16),
  // the official mark from primer/octicons: a filled shape on a 16 box, not a stroked one
  github: `<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"
    aria-hidden="true" focusable="false"><path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/></svg>`,
};

/* ---------- elements ---------- */

const appEl = $('.app');
const groupsEl = $('#groups');
const groupAddEl = $('#group-add');
const summaryEl = $('#summary');
const statusEl = $('#status');
const errorsEl = $('#data-errors');
const btnUndo = $('#btn-undo');
const btnRedo = $('#btn-redo');
const btnTheme = $('#btn-theme');
const btnBrowse = $('#btn-browse');
const browseEl = $('#browse');
const toastEl = $('#toast');
const hintEl = $('#hint');
const confirmDialog = $('#confirm');
const confirmText = $('#confirm-text');
const textoutDialog = $('#textout');
const textoutArea = $('#textout-area');

let toastTimer = null;

/** Show a passing message in the floating bar. It clears itself after a while. */
function say(msg) {
  statusEl.textContent = msg;
  clearTimeout(toastTimer);
  if (!msg) {
    toastEl.classList.remove('show');
    return;
  }
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 5000);
}

const hideToast = () => {
  clearTimeout(toastTimer);
  toastEl.classList.remove('show');
};

/* ---------- where to get the source ---------- */

function showSourceLink() {
  $('#source-link').innerHTML =
    `<a class="ghlink" href="${esc(SOURCE_URL)}" target="_blank" rel="noopener">${
      ic.github}Get the source on GitHub</a>.`;
}

/* ---------- song store ---------- */

let songs = [];
let songById = new Map();

const getSong = (id) => songById.get(id) ?? null;

/**
 * The song an entry stands for. Most come from songs.tsv, but a set list may
 * also hold a one off typed by hand, which lives in the entry itself because
 * songs.tsv cannot be written from the browser.
 */
function songFor(entry) {
  if (!entry.custom) return getSong(entry.songId);
  return { ...entry.custom, tags: entry.custom.tags ?? [], urls: entry.custom.urls ?? [], byHand: true };
}

/**
 * Tags that explain why a song matched, for words the title and artist do not
 * contain. Searching "praise" finds 10,000 Reasons through its tag, and without
 * this the row gives no hint why it is in the list.
 */
function matchedTags(song, query) {
  const words = String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || !song.tags.length) return [];
  const plain = `${song.title} ${song.artist}`.toLowerCase();
  const hits = new Set();
  for (const word of words) {
    if (plain.includes(word)) continue; // the row already shows why
    for (const tag of song.tags) {
      if (tag.toLowerCase().includes(word)) hits.add(tag);
    }
  }
  return [...hits];
}

function searchSongs(text) {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return songs;
  return songs.filter((s) => {
    const hay = [s.title, s.artist, s.key, s.camelot, ...s.tags].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/* ---------- state ---------- */

let state = { groups: [] };
let undoStack = [];
let undoAt = -1;

const ui = {
  search: null,      // { gid } while the add panel is open
  swap: null,        // entry uid while the replace panel is open
  editor: null,      // entry uid while the editor is open
  renaming: null,    // group id while its name is being edited
  adding: false,     // the new group form is open
  collapsed: new Set(),
  expanded: new Set(),
  newSong: null,     // { gid, title, artist, tonic, mode, bpm } while typing a one off
  browse: false,     // the read only library panel is open
  browseQ: '',
  expandedLib: new Set(),
  fresh: null,       // entry uid to flash once
  searchState: { q: '', compat: false, semi: 0 },
  focusSel: null,
};

const newState = () => ({
  groups: DEFAULT_GROUPS.map((name, i) => ({ id: uid(), name, color: PALETTE[i], entries: [] })),
});

function commit() {
  undoStack = undoStack.slice(0, undoAt + 1);
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  undoAt = undoStack.length - 1;
  persist();
  render();
}

function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* private browsing, or storage full: the set list just will not survive a reload */
  }
}

/* The share link carries a compact form: [[name, colour, [[songId, transpose, bpm], ...]], ...] */

function packState(st) {
  return st.groups.map((g) => [
    g.name,
    g.color ?? '',
    // A hand typed song has no library id, so an empty id marks one and its
    // own details follow. Older readers see three fields and ignore the rest.
    g.entries.map((e) => (e.custom
      ? ['', e.transpose || 0, e.bpm ?? 0,
         e.custom.title, e.custom.artist, e.custom.key ?? '', e.custom.bpm ?? 0]
      : [e.songId, e.transpose || 0, e.bpm ?? 0])),
  ]);
}

function unpackState(packed) {
  return {
    groups: packed.map(([name, second, third], i) => {
      // Links made before group colours existed hold [name, entries].
      const entries = Array.isArray(second) ? second : third;
      const color = Array.isArray(second) ? '' : second;
      return {
        id: uid(),
        name: String(name),
        color: color || PALETTE[i % PALETTE.length],
        entries: (entries || []).map(([songId, transpose, bpm, title, artist, key, ownBpm]) => {
          const base = {
            uid: uid(),
            transpose: Number(transpose) || 0,
            bpm: bpm ? Number(bpm) : null,
          };
          if (!songId && title) {
            const resolved = resolveKey(String(key ?? ''), '');
            return {
              ...base,
              custom: {
                title: String(title),
                artist: String(artist ?? ''),
                key: resolved.key ?? '',
                camelot: resolved.camelot ?? '',
                bpm: ownBpm ? Number(ownBpm) : null,
                tags: [],
                urls: [],
              },
            };
          }
          return { ...base, songId: String(songId) };
        }),
      };
    }),
  };
}

function toHash(st) {
  const bytes = new TextEncoder().encode(JSON.stringify(packState(st)));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromHash(hash) {
  const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return unpackState(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Take the set list out of the address, then tidy the address up. */
function takeStateFromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return null;
  try {
    const st = fromHash(hash);
    history.replaceState(null, '', location.pathname + location.search);
    return st;
  } catch {
    history.replaceState(null, '', location.pathname + location.search);
    return 'bad';
  }
}

function loadState() {
  const fromLink = takeStateFromHash();
  if (fromLink === 'bad') {
    say('That share link could not be read. Starting a new set list.');
  } else if (fromLink) {
    say('Set list loaded from the share link.');
    return fromLink;
  }
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      if (Array.isArray(st?.groups)) return st;
    }
  } catch {
    /* fall through to a fresh set list */
  }
  return newState();
}

/* ---------- derived values ---------- */

/** Key, Camelot and BPM after the entry overrides are applied. */
function effective(entry, song) {
  if (!song) return { cam: null, camText: '', key: '', bpm: null };
  const base = parseCamelot(song.camelot);
  const semi = entry.transpose || 0;
  const cam = base ? shift(base, semi) : null;
  return {
    cam,
    camText: camelotStr(cam),
    key: cam ? keyForCamelot(camelotStr(cam)) : song.key,
    bpm: entry.bpm ?? song.bpm,
  };
}

const findGroup = (gid) => state.groups.find((g) => g.id === gid) ?? null;

function findEntry(entryUid) {
  for (const g of state.groups) {
    const e = g.entries.find((x) => x.uid === entryUid);
    if (e) return { group: g, entry: e };
  }
  return null;
}

/** One shared rule, so the row warning and the header path never disagree. */
function clashAt(group, i) {
  if (i === 0) return null;
  const prev = group.entries[i - 1];
  const before = effective(prev, songFor(prev));
  const here = effective(group.entries[i], songFor(group.entries[i]));
  if (!before.cam || !here.cam || compatible(here.cam, before.cam)) return null;
  return { from: before.camText, to: here.camText };
}

/** The song a new or replaced entry has to follow, or null at the top of a group. */
function anchorFor(group, { replaceUid = null, at = null } = {}) {
  const i = replaceUid
    ? group.entries.findIndex((e) => e.uid === replaceUid) - 1
    : (at ?? group.entries.length) - 1;
  const entry = i >= 0 ? group.entries[i] : null;
  const song = entry ? songFor(entry) : null;
  return song ? { entry, song, eff: effective(entry, song) } : null;
}

const groupColor = (g, i) => g.color || PALETTE[i % PALETTE.length];

/** The four Camelot codes that sit well after this one. */
function fitCodes(camText) {
  const c = parseCamelot(camText);
  if (!c) return '';
  const up = (c.n % 12) + 1;
  const down = c.n === 1 ? 12 : c.n - 1;
  return [`${c.n}${c.l}`, `${up}${c.l}`, `${down}${c.l}`, `${c.n}${c.l === 'A' ? 'B' : 'A'}`].join(', ');
}

/* ---------- rendering ---------- */

/* Sits behind a swipeable row. One trash mark at each end, so whichever side
   the row uncovers shows one, whichever way it is swiped. */
const swipeBack = `<div class="swipe-back" aria-hidden="true">
    <span class="sb">${ic.trash}Delete</span><span class="sb">Delete${ic.trash}</span>
  </div>`;

/** Camelot badge, tinted by its place on the wheel so neighbours look alike. */
function camBadge(camText, extra = '') {
  const c = parseCamelot(camText);
  if (!c) return `<span class="cam none ${extra}">&ndash;&ndash;</span>`;
  return `<span class="cam ${c.l} ${extra}" style="--h:${(c.n - 1) * 30}">${c.n}${c.l}</span>`;
}

function render() {
  groupsEl.innerHTML =
    state.groups.map(renderGroup).join('') ||
    '<p class="note">No groups yet. Add one below.</p>';
  groupAddEl.innerHTML = renderAddGroup();
  summaryEl.innerHTML = renderSummary();
  browseEl.innerHTML = renderBrowse();
  btnBrowse.setAttribute('aria-pressed', String(ui.browse));
  refreshResults(); // the panel is drawn empty, so always fill it here

  btnUndo.disabled = undoAt <= 0;
  btnRedo.disabled = undoAt >= undoStack.length - 1;

  if (ui.focusSel) {
    const el = appEl.querySelector(ui.focusSel);
    ui.focusSel = null;
    if (el) {
      el.focus({ preventScroll: true });
      if (el.select) el.select();
    }
  }
  ui.fresh = null;
}

function renderSummary() {
  const badges = [];
  for (const g of state.groups) {
    g.entries.forEach((e, i) => {
      const eff = effective(e, songFor(e));
      badges.push(camBadge(eff.camText, clashAt(g, i) ? 'clashed' : ''));
    });
  }
  const n = badges.length;
  if (!n) return '<span class="n">No songs yet</span>';
  return `<span class="n">${n} ${n === 1 ? 'song' : 'songs'}</span>
    <div class="path" aria-label="Key order across the whole set">${badges.join('')}</div>`;
}

function renderGroup(g, gi) {
  const label = esc(g.name);
  const n = g.entries.length;
  const searchOpen = ui.search?.gid === g.id;
  const collapsed = ui.collapsed.has(g.id);

  // a song may be deleted while a panel is open further down the group
  const clamp = (v) => Math.max(0, Math.min(v ?? n, n));
  if (ui.search?.gid === g.id) ui.search.at = clamp(ui.search.at);
  if (ui.newSong?.gid === g.id) ui.newSong.at = clamp(ui.newSong.at);
  const addingHere = ui.newSong?.gid === g.id;

  const slots = [];
  g.entries.forEach((e, i) => {
    slots.push(renderSlot(g, i));
    slots.push(renderSong(g, e, i));
  });
  slots.push(renderSlot(g, n, true));

  const name = ui.renaming === g.id
    ? `<input class="rename" type="text" value="${esc(g.name)}" data-act="rename-input"
              aria-label="Group name" autocomplete="off" maxlength="24">`
    : `<h2 class="group-name" data-act="tap-group" tabindex="0" role="button"
           aria-label="Group ${label}. Activate to rename.">${label}</h2>`;

  return `
<section class="group${collapsed ? ' collapsed' : ''}" data-gid="${g.id}" style="--gc:${esc(groupColor(g, gi))}">
  <div class="swipe-wrap">
  ${swipeBack}
  <div class="ghead swipe">
    ${name}
    <span class="gcount">${n} ${n === 1 ? 'song' : 'songs'}</span>
    <button type="button" class="icon-btn" data-act="collapse"
            aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand' : 'Collapse'} group ${label}">${ic.chev}</button>
    <button type="button" class="icon-btn handle" data-drag="group"
            aria-label="Move group ${label}. Drag, or press the up and down arrow keys.">${ic.move}</button>
    <button type="button" class="icon-btn" data-act="rename-group"
            aria-label="Rename group ${label}">${ic.edit}</button>
    <button type="button" class="icon-btn danger" data-act="del-group"
            aria-label="Delete group ${label}">${ic.trash}</button>
  </div>
  </div>
  <div class="gbody">
    <ul class="songs">${slots.join('')}</ul>
    ${n === 0 && !searchOpen && !addingHere
      ? `<p class="empty-row">No songs yet.</p>` : ''}
  </div>
</section>`;
}

/**
 * A place a song can go: between two rows, above the first, or at the end.
 *
 * The end keeps the loud button, because adding to the end is the common act.
 * The in between ones stay quiet: a faint line with a plus, which grows and
 * names itself on hover or keyboard focus. They are always drawn rather than
 * appearing on hover, because a touch screen has no hover to reveal them with.
 */
function renderSlot(g, at, last = false) {
  if (ui.newSong?.gid === g.id && ui.newSong.at === at) {
    return `<li class="slot">${renderNewSong(g)}</li>`;
  }
  if (ui.search?.gid === g.id && ui.search.at === at) {
    return `<li class="slot">${renderSearch(g, { at })}</li>`;
  }
  if (last) {
    return `<li class="slot">
      <button type="button" class="plus" data-act="open-search" data-at="${at}"
              aria-label="Add a song to the end of ${esc(g.name)}">
        <span class="ico">${ic.plus}</span>Add song</button>
    </li>`;
  }
  const above = at === 0 ? null : songFor(g.entries[at - 1]);
  const where = above ? `after ${esc(above.title)}` : `at the top of ${esc(g.name)}`;
  return `<li class="gap">
    <button type="button" class="gap-btn" data-act="open-search" data-at="${at}"
            aria-label="Add a song ${where}">
      <span class="gap-label">${ic.plus}<span class="txt">Add song here</span></span>
    </button>
  </li>`;
}

function renderSong(g, e, i) {
  const song = songFor(e);

  if (!song) {
    return `
<li class="song missing" data-uid="${e.uid}">
  <div class="song-main">
    <div class="l1"><span class="song-title">Song not found</span></div>
    <div class="artist">${esc(e.songId)} is no longer in songs.tsv.</div>
    <div class="song-meta">
      <span class="grow"></span>
      <button type="button" class="icon-btn danger" data-act="del-song"
              aria-label="Remove missing song">${ic.trash}</button>
    </div>
  </div>
</li>`;
  }

  const eff = effective(e, song);
  const moved = (e.transpose || 0) !== 0;
  const bpmChanged = e.bpm != null && e.bpm !== song.bpm;
  const title = esc(song.title);
  const clash = clashAt(g, i);
  const linksOpen = ui.expanded.has(e.uid);

  const shownTags = song.tags.slice(0, TAGS_SHOWN);
  const moreTags = song.tags.length - shownTags.length;

  return `
<li class="song${ui.fresh === e.uid ? ' fresh' : ''}" data-uid="${e.uid}">
  <div class="swipe-wrap">
  ${swipeBack}
  <div class="song-main swipe">
    <div class="l1">
      <span class="song-title" data-act="tap-song" tabindex="0" role="button"
            aria-label="${title}. Activate to edit key, BPM or replace the song.">${title}</span>
      ${camBadge(eff.camText, moved ? 'changed' : '')}
    </div>
    ${song.artist ? `<div class="artist">${esc(song.artist)}</div>` : ''}
    <div class="song-meta">
      <span class="chip${moved ? ' changed' : ''}">${esc(eff.key || '--')}</span>
      <span class="chip${bpmChanged ? ' changed' : ''}">${eff.bpm ?? '--'} BPM</span>
      ${moved || bpmChanged
        ? `<span class="chip orig">- orig ${esc(song.key || '--')}${song.camelot ? `, ${esc(song.camelot)}` : ''}${song.bpm != null ? `, ${song.bpm} BPM` : ''}</span>`
        : ''}
      ${song.byHand ? '<span class="chip byhand">not in library</span>' : ''}
      <span class="grow"></span>
      ${song.urls.length
        ? `<button type="button" class="linkbtn" data-act="links" aria-expanded="${linksOpen}"
                   aria-label="Links for ${title}">${ic.link}<span>${song.urls.length}</span>${ic.chev}</button>`
        : ''}
      <button type="button" class="icon-btn handle" data-drag="song"
              aria-label="Move ${title}. Drag, or press the up and down arrow keys.">${ic.move}</button>
      <button type="button" class="icon-btn" data-act="edit-song" aria-label="Edit ${title}">${ic.edit}</button>
      <button type="button" class="icon-btn danger" data-act="del-song" aria-label="Delete ${title}">${ic.trash}</button>
    </div>
    ${shownTags.length
      ? `<div class="tags">${shownTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${
          moreTags > 0 ? `<span class="tag more">+${moreTags}</span>` : ''}</div>`
      : ''}
    ${linksOpen
      ? `<div class="urls"><ul>${song.urls
          .map((u) => `<li><a href="${esc(u.url)}" target="_blank" rel="noopener">${ic.link}<span>${esc(u.label)}</span></a></li>`)
          .join('')}</ul></div>`
      : ''}
    ${clash
      ? `<p class="clash">${ic.warn}<span>Key clash: ${esc(clash.from)} above, ${esc(clash.to)} here.
           Transpose one of them, or pick another song.</span></p>`
      : ''}
  </div>
  </div>
  ${ui.editor === e.uid ? renderEditor(g, e, song, eff) : ''}
</li>`;
}

function renderEditor(g, e, song, eff) {
  const semi = e.transpose || 0;
  const canMove = !!parseCamelot(song.camelot);
  const untouched = semi === 0 && e.bpm == null;

  return `
<div class="editor" data-uid="${e.uid}">
  <div class="ed-row">
    <span class="ed-label" id="ed-t-${e.uid}">Transpose</span>
    <button type="button" class="ed-step" data-act="t-down" ${!canMove || semi <= -6 ? 'disabled' : ''}
            aria-label="Transpose down one semitone">${ic.minus}</button>
    <output class="ed-val" aria-labelledby="ed-t-${e.uid}">${semi > 0 ? '+' : ''}${semi}</output>
    <button type="button" class="ed-step" data-act="t-up" ${!canMove || semi >= 6 ? 'disabled' : ''}
            aria-label="Transpose up one semitone">${ic.plus}</button>
    <span class="chip">${esc(eff.key || '--')}</span>
    ${camBadge(eff.camText)}
    ${semi ? `<span class="chip orig">- orig ${esc(song.key || '--')}, ${esc(song.camelot || '--')}</span>` : ''}
    ${canMove ? '' : '<span class="chip orig">- no key on this song</span>'}
  </div>
  ${song.byHand ? renderKeyRow(e, song) : ''}
  <div class="ed-row">
    <label class="ed-label" for="ed-bpm-${e.uid}">BPM</label>
    <input type="number" class="ed-bpm" id="ed-bpm-${e.uid}" data-act="set-bpm"
           min="20" max="400" step="1" value="${e.bpm ?? ''}" placeholder="${song.bpm ?? '--'}">
    ${e.bpm != null ? `<span class="chip orig">- orig ${song.bpm ?? '--'} BPM</span>` : ''}
  </div>
  <div class="ed-row ed-buttons">
    <button type="button" class="btn outline" data-act="ed-reset" ${untouched ? 'disabled' : ''}>Reset</button>
    <button type="button" class="btn outline" data-act="ed-swap" aria-expanded="${ui.swap === e.uid}">Replace song</button>
    <span class="grow"></span>
    <button type="button" class="btn" data-act="ed-done">Done</button>
  </div>
  ${ui.swap === e.uid ? renderSearch(g, { replaceUid: e.uid }) : ''}
</div>`;
}

/**
 * Only a song typed by hand gets its key edited here. A library song takes its key
 * from songs.tsv, which stays the source of truth, so that one is transposed instead.
 */
function renderKeyRow(e, song) {
  const picked = keyToPicker(song.key) ?? { tonic: '', mode: 'major' };
  return `
  <div class="ed-row">
    <label class="ed-label" for="ek-tonic-${e.uid}">Key</label>
    <select class="ns-sel" id="ek-tonic-${e.uid}" data-act="ek-tonic">
      <option value=""${picked.tonic ? '' : ' selected'}>none</option>
      ${TONICS.map((t) => `<option value="${t}"${t === picked.tonic ? ' selected' : ''}>${t}</option>`).join('')}
    </select>
    <select class="ns-sel" id="ek-mode-${e.uid}" data-act="ek-mode" aria-label="Major or minor"
            ${picked.tonic ? '' : 'disabled'}>
      <option value="major"${picked.mode === 'major' ? ' selected' : ''}>major</option>
      <option value="minor"${picked.mode === 'minor' ? ' selected' : ''}>minor</option>
    </select>
    ${song.key
      ? `<span class="chip">${esc(song.key)}</span>${camBadge(song.camelot)}`
      : '<span class="chip orig">- set a key to join Camelot matching</span>'}
  </div>`;
}

function setSongKey(entryUid, tonic, mode) {
  const found = findEntry(entryUid);
  if (!found?.entry.custom) return;
  const resolved = resolveKey(tonic ? `${tonic} ${mode}` : '', '');
  found.entry.custom.key = resolved.key ?? '';
  found.entry.custom.camelot = resolved.camelot ?? '';
  // a transpose counted from the old key means nothing against the new one
  found.entry.transpose = 0;
  say(resolved.key ? `Key set to ${resolved.key}.` : 'Key cleared.');
  commit();
}

function renderSearch(g, { replaceUid = null, at = null }) {
  const anchor = anchorFor(g, { replaceUid, at });
  const st = ui.searchState;
  const canCompat = !!anchor?.eff.cam;
  const compatOn = st.compat && canCompat;

  return `
<div class="search-panel" data-gid="${g.id}"${replaceUid ? ` data-replace="${replaceUid}"` : ''}${
  at === null ? '' : ` data-at="${at}"`}
     role="region" aria-label="${replaceUid ? 'Replace song' : `Add a song to ${esc(g.name)}`}">
  <div class="pbar">
    ${ic.search}
    <input type="search" class="s-q" data-act="s-q" value="${esc(st.q)}" autocomplete="off"
           placeholder="Search title, artist or tag" aria-label="Search songs">
    <button type="button" class="icon-btn" data-act="s-close" aria-label="Close search">${ic.x}</button>
  </div>
  ${anchor
    ? `<p class="anchor">
         <span class="anchor-tag">Plays after</span>
         <span class="anchor-title">${esc(anchor.song.title)}</span>
         <span class="chip">${anchor.eff.bpm ?? '--'}</span>
         ${camBadge(anchor.eff.camText)}
       </p>`
    : `<p class="anchor none">${
        at === 0 && g.entries.length
          ? `Going to the top of ${esc(g.name)}, so there is no key to match.`
          : `First song in ${esc(g.name)}, so there is no key to match.`}</p>`}
  <button type="button" class="match" data-act="s-compat"
          aria-pressed="${compatOn}" ${canCompat ? '' : 'disabled'}>
    ${ic.wheel}
    <span class="mt">Match Camelot key<small>${
      canCompat ? `Fits ${esc(fitCodes(anchor.eff.camText))}` : 'Add a song above first'
    }</small></span>
  </button>
  ${compatOn
    ? `<div class="semi-row">
         <span>Also allow changing key by up to</span>
         <input type="number" class="s-semi" data-act="s-semi" min="0" max="6" step="1"
                value="${esc(st.semi)}" aria-label="Largest key change allowed, in semitones">
         <span>semitones</span>
       </div>`
    : ''}
  <p class="rcount"></p>
  <ul class="results"></ul>
  ${replaceUid
    ? ''
    : `<button type="button" class="btn outline ns-open" data-act="ns-open">
         Not in the list? Add it here</button>`}
</div>`;
}

function searchResults(anchor) {
  const st = ui.searchState;
  const compatOn = st.compat && !!anchor?.eff.cam;
  const maxSemi = Math.max(0, Math.min(6, Math.trunc(Number(st.semi) || 0)));

  const found = [];
  for (const song of searchSongs(st.q)) {
    if (!compatOn) {
      found.push({ song, semi: 0, fit: null });
      continue;
    }
    const cam = parseCamelot(song.camelot);
    const fit = cam ? bestShift(cam, anchor.eff.cam, maxSemi) : null;
    if (!fit) continue;
    found.push({ song, semi: fit.semi, fit });
  }

  if (compatOn) {
    found.sort((a, b) => Math.abs(a.semi) - Math.abs(b.semi) || a.song.title.localeCompare(b.song.title));
  }
  return { found, compatOn };
}

function resultsHtml(anchor) {
  const { found, compatOn } = searchResults(anchor);

  if (!found.length) {
    return `<li class="none-found">No songs match.${
      compatOn ? ' Turn off key match, allow a bigger key change, or try another word.' : ' Try another title, artist or tag.'
    }</li>`;
  }

  return found
    .map(({ song, semi, fit }) => {
      const moved = fit && semi !== 0;
      // When a transpose is needed, lead with the key it will become, not the one
      // it has now, and keep the original alongside.
      const newKey = moved ? keyForCamelot(fit.cam) : song.key;
      const chips = [
        `<span class="chip${moved ? ' changed' : ''}">${esc(newKey || '--')}</span>`,
        `<span class="chip">${song.bpm ?? '--'} BPM</span>`,
      ];
      if (fit) {
        chips.push(semi === 0
          ? `<span class="chip fit">${esc(fit.rel)}</span>`
          : `<span class="chip fit">${semi > 0 ? '+' : ''}${semi} &rarr; ${esc(fit.cam)}</span>`);
      }
      if (moved) {
        // same wording as a set list row: - orig KEY, CAMELOT, N BPM
        chips.push(`<span class="chip orig">- orig ${esc(song.key || '--')}${
          song.camelot ? `, ${esc(song.camelot)}` : ''}${
          song.bpm != null ? `, ${song.bpm} BPM` : ''}</span>`);
      }
      for (const tag of matchedTags(song, ui.searchState.q)) {
        chips.push(`<span class="tag hit">${esc(tag)}</span>`);
      }
      return `
<li class="result">
  <button type="button" class="result-btn" data-act="pick" data-song="${esc(song.id)}" data-semi="${semi}">
    <span class="rtext">
      <span class="r-title">${esc(song.title)}</span>
      ${song.artist ? `<span class="r-artist">${esc(song.artist)}</span>` : ''}
      <span class="r-meta">${chips.join('')}</span>
    </span>
    ${camBadge(moved ? fit.cam : song.camelot, moved ? 'changed' : '')}
    <span class="radd">${ic.plus}</span>
  </button>
</li>`;
    })
    .join('');
}

/** Redraw only the result list, so typing does not disturb the input focus. */
function refreshResults() {
  const panel = groupsEl.querySelector('.search-panel');
  if (!panel) return;
  const g = findGroup(panel.dataset.gid);
  if (!g) return;
  const anchor = anchorFor(g, {
    replaceUid: panel.dataset.replace ?? null,
    at: panel.dataset.at === undefined ? null : Number(panel.dataset.at),
  });
  const { found, compatOn } = searchResults(anchor);
  $('.rcount', panel).textContent =
    `${found.length} ${found.length === 1 ? 'song' : 'songs'}${compatOn ? ' that fit' : ' available'}`;
  $('.results', panel).innerHTML = resultsHtml(anchor);
}

function renderAddGroup() {
  if (!ui.adding) {
    return `<button type="button" class="addgroup" data-act="add-group-open">${ic.plus}Add group</button>`;
  }
  const taken = new Set(state.groups.map((g) => g.name.toLowerCase()));
  const ideas = GROUP_IDEAS.filter((n) => !taken.has(n.toLowerCase()));
  return `
<div class="gform">
  <div class="row">
    <input type="text" id="gname" data-act="gname" placeholder="Group name" maxlength="24"
           aria-label="New group name" autocomplete="off">
    <button type="button" class="btn" data-act="add-group-create">Create</button>
    <button type="button" class="btn ghost" data-act="add-group-cancel">Cancel</button>
  </div>
  ${ideas.length
    ? `<div class="sugg">${ideas
        .map((n) => `<button type="button" data-act="sugg" data-name="${esc(n)}">${esc(n)}</button>`)
        .join('')}</div>`
    : ''}
</div>`;
}

/* ---------- a song typed by hand ---------- */

const newSongKey = (ns) => (ns.tonic ? `${ns.tonic} ${ns.mode}` : '');

function renderNewSong(g) {
  const ns = ui.newSong;
  const ready = ns.title.trim() !== '';

  return `
<div class="newsong" data-gid="${g.id}" role="region" aria-label="Add a song not in the library">
  <h3 class="ns-head">Song not in the library</h3>
  <p class="ns-note">It joins this set list only. Put it in songs.tsv to keep it for good.</p>
  <div class="ed-row">
    <label class="ed-label" for="ns-title">Title</label>
    <input type="text" class="ns-in" id="ns-title" data-act="ns-title" value="${esc(ns.title)}"
           maxlength="120" autocomplete="off" placeholder="Song title">
  </div>
  <div class="ed-row">
    <label class="ed-label" for="ns-artist">Artist</label>
    <input type="text" class="ns-in" id="ns-artist" data-act="ns-artist" value="${esc(ns.artist)}"
           maxlength="120" autocomplete="off" placeholder="optional">
  </div>
  <div class="ed-row">
    <label class="ed-label" for="ns-tonic">Key</label>
    <select class="ns-sel" id="ns-tonic" data-act="ns-tonic">
      <option value=""${ns.tonic ? '' : ' selected'}>none</option>
      ${TONICS.map((t) => `<option value="${t}"${t === ns.tonic ? ' selected' : ''}>${t}</option>`).join('')}
    </select>
    <select class="ns-sel" id="ns-mode" data-act="ns-mode" aria-label="Major or minor"
            ${ns.tonic ? '' : 'disabled'}>
      <option value="major"${ns.mode === 'major' ? ' selected' : ''}>major</option>
      <option value="minor"${ns.mode === 'minor' ? ' selected' : ''}>minor</option>
    </select>
    <span class="ns-derived">${newSongDerived(ns)}</span>
  </div>
  <div class="ed-row">
    <label class="ed-label" for="ns-bpm">BPM</label>
    <input type="number" class="ed-bpm" id="ns-bpm" data-act="ns-bpm" min="20" max="400" step="1"
           value="${esc(ns.bpm)}" placeholder="optional">
  </div>
  <div class="ed-row ed-buttons">
    <button type="button" class="btn outline" data-act="ns-cancel">Cancel</button>
    <span class="grow"></span>
    <button type="button" class="btn" data-act="ns-add" ${ready ? '' : 'disabled'}>Add song</button>
  </div>
</div>`;
}

function newSongDerived(ns) {
  const cam = newSongKey(ns) ? camelotForKey(newSongKey(ns)) : null;
  if (!cam) return '<span class="chip orig">- no key, so no Camelot matching</span>';
  return `<span class="chip">${esc(keyForCamelot(cam))}</span>${camBadge(cam)}`;
}

/** Update only the parts that follow from a change, so typing is never disturbed. */
function refreshNewSong() {
  const panel = groupsEl.querySelector('.newsong');
  if (!panel || !ui.newSong) return;
  $('.ns-derived', panel).innerHTML = newSongDerived(ui.newSong);
  $('#ns-mode', panel).disabled = !ui.newSong.tonic;
  $('[data-act="ns-add"]', panel).disabled = ui.newSong.title.trim() === '';
}

function addSongByHand() {
  const ns = ui.newSong;
  const g = findGroup(ns.gid);
  const title = ns.title.trim();
  const artist = ns.artist.trim();
  if (!g || !title) return;

  const resolved = resolveKey(newSongKey(ns), '');
  const asNumber = Number(ns.bpm);
  const bpm = ns.bpm === '' || !Number.isFinite(asNumber)
    ? null
    : Math.max(20, Math.min(400, Math.round(asNumber)));

  const entry = {
    uid: uid(),
    transpose: 0,
    bpm: null,
    custom: {
      title,
      artist,
      key: resolved.key ?? '',
      camelot: resolved.camelot ?? '',
      bpm,
      tags: [],
      urls: [],
    },
  };
  g.entries.splice(ns.at ?? g.entries.length, 0, entry);
  ui.newSong = null;
  ui.fresh = entry.uid;
  ui.searchState.q = '';
  say(`Added ${title}. It is in this set list only, not in the library.`);
  commit();
}

/* ---------- library search, read only ---------- */

/** One library row. Nothing here adds to a set list or changes a key. */
function libRow(song) {
  const open = ui.expandedLib.has(song.id);
  // a tag that explains the match comes first, so it is never the one clipped off
  const hits = matchedTags(song, ui.browseQ);
  const ordered = [...hits, ...song.tags.filter((t) => !hits.includes(t))];
  const shown = ordered.slice(0, Math.max(TAGS_SHOWN, hits.length));
  const more = song.tags.length - shown.length;
  return `
<li class="libitem">
  <div class="brow">
    <span class="rtext">
      <span class="r-title">${esc(song.title)}</span>
      ${song.artist ? `<span class="r-artist">${esc(song.artist)}</span>` : ''}
      <span class="r-meta">
        <span class="chip">${esc(song.key || '--')}</span>
        <span class="chip">${song.bpm ?? '--'} BPM</span>
        ${shown.map((t) => `<span class="tag${hits.includes(t) ? ' hit' : ''}">${esc(t)}</span>`).join('')}
        ${more > 0 ? `<span class="tag more">+${more}</span>` : ''}
      </span>
    </span>
    ${camBadge(song.camelot)}
    ${song.urls.length
      ? `<button type="button" class="icon-btn" data-act="lib-links" data-song="${esc(song.id)}"
                 aria-expanded="${open}" aria-label="Links for ${esc(song.title)}">${ic.link}</button>`
      : ''}
  </div>
  ${open
    ? `<div class="urls"><ul>${song.urls
        .map((u) => `<li><a href="${esc(u.url)}" target="_blank" rel="noopener">${ic.link}<span>${esc(u.label)}</span></a></li>`)
        .join('')}</ul></div>`
    : ''}
</li>`;
}

function libListHtml() {
  const found = searchSongs(ui.browseQ);
  if (!found.length) return '<li class="none-found">No songs match that search.</li>';
  return found.map(libRow).join('');
}

function renderBrowse() {
  if (!ui.browse) return '';
  const found = searchSongs(ui.browseQ);
  return `
<div class="browse" role="region" aria-label="Song library">
  <div class="pbar">
    ${ic.search}
    <input type="search" class="s-q b-q" data-act="b-q" value="${esc(ui.browseQ)}" autocomplete="off"
           placeholder="Search the whole library" aria-label="Search the song library">
    <button type="button" class="icon-btn" data-act="b-close" aria-label="Close the library">${ic.x}</button>
  </div>
  <p class="rcount">${found.length} of ${songs.length} songs. Looking only, nothing is added.</p>
  <ul class="results">${libListHtml()}</ul>
</div>`;
}

/** Redraw only the library list, so typing does not disturb the input focus. */
function refreshBrowse() {
  const panel = browseEl.querySelector('.browse');
  if (!panel) return;
  const found = searchSongs(ui.browseQ);
  $('.rcount', panel).textContent =
    `${found.length} of ${songs.length} songs. Looking only, nothing is added.`;
  $('.results', panel).innerHTML = libListHtml();
}

/* ---------- actions ---------- */

function openSearch(gid, at) {
  ui.search = { gid, at: at === undefined ? undefined : Number(at) };
  ui.swap = null;
  ui.editor = null;
  ui.newSong = null;
  ui.collapsed.delete(gid);
  ui.searchState = { q: '', compat: false, semi: 0 };
  ui.focusSel = '.search-panel .s-q';
  render();
  groupsEl.querySelector('.search-panel')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function closeSearch() {
  ui.search = null;
  ui.swap = null;
  ui.newSong = null;
  render();
}

function pickSong(btn) {
  const panel = btn.closest('.search-panel');
  const g = findGroup(panel.dataset.gid);
  if (!g) return;

  const songId = btn.dataset.song;
  const semi = Number(btn.dataset.semi) || 0;
  const replaceUid = panel.dataset.replace ?? null;

  if (replaceUid) {
    const found = findEntry(replaceUid);
    if (!found) return;
    delete found.entry.custom; // it becomes a library song now
    Object.assign(found.entry, { songId, transpose: semi, bpm: null });
    ui.swap = null;
    ui.fresh = replaceUid;
    say(`Replaced with ${getSong(songId)?.title ?? songId}.`);
  } else {
    const entry = { uid: uid(), songId, transpose: semi, bpm: null };
    const at = panel.dataset.at === undefined ? g.entries.length : Number(panel.dataset.at);
    g.entries.splice(at, 0, entry);
    ui.fresh = entry.uid;
    ui.searchState.q = '';
    ui.focusSel = '.search-panel .s-q';
    // the panel stays open just below the song it added, so a run of adds keeps its order
    if (ui.search) ui.search.at = at + 1;
    say(`Added ${getSong(songId)?.title ?? songId} to ${g.name}.`);
  }
  commit();
}

function setTranspose(entryUid, delta) {
  const found = findEntry(entryUid);
  if (!found) return;
  const next = Math.max(-6, Math.min(6, (found.entry.transpose || 0) + delta));
  if (next === (found.entry.transpose || 0)) return;
  found.entry.transpose = next;
  commit();
}

function setBpm(entryUid, raw) {
  const found = findEntry(entryUid);
  if (!found) return;
  const song = songFor(found.entry);
  const n = Number(raw);
  const value = raw === '' || !Number.isFinite(n) ? null : Math.max(20, Math.min(400, Math.round(n)));
  found.entry.bpm = value === song?.bpm ? null : value;
  commit();
}

function resetEntry(entryUid) {
  const found = findEntry(entryUid);
  if (!found) return;
  found.entry.transpose = 0;
  found.entry.bpm = null;
  commit();
}

function createGroup(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    ui.focusSel = '#gname';
    render();
    return;
  }
  state.groups.push({
    id: uid(),
    name: trimmed,
    color: PALETTE[state.groups.length % PALETTE.length],
    entries: [],
  });
  ui.adding = false;
  say(`Group ${trimmed} added.`);
  commit();
}

function renameGroup(gid, name) {
  const g = findGroup(gid);
  ui.renaming = null;
  const trimmed = name.trim();
  if (!g || !trimmed || trimmed === g.name) {
    render();
    return;
  }
  g.name = trimmed;
  commit();
}

function moveGroup(gid, dir) {
  const i = state.groups.findIndex((g) => g.id === gid);
  const to = i + dir;
  if (i < 0 || to < 0 || to >= state.groups.length) return;
  state.groups.splice(to, 0, state.groups.splice(i, 1)[0]);
  ui.focusSel = `[data-gid="${gid}"] .handle`;
  commit();
}

function moveSong(entryUid, dir) {
  const gi = state.groups.findIndex((g) => g.entries.some((e) => e.uid === entryUid));
  if (gi < 0) return;
  const g = state.groups[gi];
  const i = g.entries.findIndex((e) => e.uid === entryUid);
  const to = i + dir;

  if (to >= 0 && to < g.entries.length) {
    g.entries.splice(to, 0, g.entries.splice(i, 1)[0]);
  } else {
    const gj = gi + dir;
    if (gj < 0 || gj >= state.groups.length) return;
    const [entry] = g.entries.splice(i, 1);
    if (dir < 0) state.groups[gj].entries.push(entry);
    else state.groups[gj].entries.unshift(entry);
    ui.collapsed.delete(state.groups[gj].id);
  }
  ui.focusSel = `[data-uid="${entryUid}"] .handle`;
  commit();
}

/* ---------- confirm dialog ---------- */

let confirmResolve = null;

confirmDialog.addEventListener('close', () => {
  const resolve = confirmResolve;
  confirmResolve = null;
  resolve?.(confirmDialog.returnValue === 'ok');
});

function ask(text) {
  confirmText.textContent = text;
  confirmDialog.returnValue = 'cancel';
  confirmDialog.showModal();
  return new Promise((resolve) => { confirmResolve = resolve; });
}

async function deleteGroup(gid) {
  const g = findGroup(gid);
  if (!g) return;
  const n = g.entries.length;
  const ok = await ask(
    `Delete the group "${g.name}"${n ? ` and its ${n} song${n === 1 ? '' : 's'}` : ''}? Undo can bring it back.`,
  );
  if (!ok) return;
  state.groups = state.groups.filter((x) => x.id !== gid);
  if (ui.search?.gid === gid) ui.search = null;
  say(`Deleted ${g.name}.`);
  commit();
}

async function deleteSong(entryUid) {
  const found = findEntry(entryUid);
  if (!found) return;
  const song = songFor(found.entry);
  const name = song ? [song.title, song.artist].filter(Boolean).join(' - ') : 'this song';
  const ok = await ask(`Remove ${name} from ${found.group.name}? Undo can bring it back.`);
  if (!ok) return;
  found.group.entries = found.group.entries.filter((e) => e.uid !== entryUid);
  if (ui.editor === entryUid) ui.editor = null;
  if (ui.swap === entryUid) ui.swap = null;
  say('Song removed.');
  commit();
}

/* ---------- undo, redo, copy, share, theme ---------- */

function restore(step, message) {
  undoAt += step;
  state = JSON.parse(undoStack[undoAt]);
  ui.editor = null;
  ui.swap = null;
  ui.renaming = null;
  persist();
  render();
  say(message);
}

const undo = () => { if (undoAt > 0) restore(-1, 'Undone.'); };
const redo = () => { if (undoAt < undoStack.length - 1) restore(1, 'Redone.'); };

function setListText() {
  const blocks = [];
  for (const g of state.groups) {
    if (!g.entries.length) continue;
    const lines = g.entries.map((e) => {
      const song = songFor(e);
      if (!song) return `Song not found: ${e.songId}`;
      // an unknown artist is left out, rather than leaving an empty middle part
      return [song.title, song.artist, effective(e, song).key || '--']
        .filter(Boolean).join(' - ');
    });
    blocks.push(`${g.name}\n${lines.join('\n')}`);
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

async function copyText(text, okMessage) {
  if (!text) {
    say('Nothing to copy yet.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    say(okMessage);
  } catch {
    // No clipboard permission, or the page is not on https. Show the text instead.
    textoutArea.value = text;
    textoutDialog.showModal();
    textoutArea.select();
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  btnTheme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  btnTheme.innerHTML = dark ? ic.sun : ic.moon;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* the choice just will not be remembered */
  }
}

/* ---------- double tap ---------- */

let lastTap = { el: null, at: 0 };

function isSecondTap(el) {
  const now = performance.now();
  if (lastTap.el === el && now - lastTap.at < 450) {
    lastTap = { el: null, at: 0 };
    return true;
  }
  lastTap = { el, at: now };
  return false;
}

/* ---------- gestures ----------
   A row can be picked up by holding it, or from its move button.
   A sideways drag deletes. A mostly vertical drag is left to the page as a scroll. */

let drag = null;
let swipe = null;
let press = null;

function cancelPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
}

function beginDrag(kind, el, pointerId, captureEl) {
  if (!el) return;
  drag = { kind, el, panned: captureEl };
  el.classList.add('dragging');
  // A row normally allows a vertical pan. While it is being dragged it must not,
  // or the browser starts scrolling and takes the gesture away from us.
  captureEl.classList.add('no-pan');
  document.body.classList.add('dragging-active');
  try {
    captureEl.setPointerCapture(pointerId);
  } catch {
    /* capture is a convenience, the listeners still work without it */
  }
  navigator.vibrate?.(12);
}

function autoScroll(y) {
  const margin = 70;
  if (y < margin) scrollBy(0, -14);
  else if (y > innerHeight - margin) scrollBy(0, 14);
}

function moveDrag(event) {
  event.preventDefault();
  autoScroll(event.clientY);
  const y = event.clientY;

  if (drag.kind === 'group') {
    for (const g of groupsEl.querySelectorAll('.group')) {
      if (g === drag.el) continue;
      const box = g.getBoundingClientRect();
      if (y < box.top + box.height / 2) {
        groupsEl.insertBefore(drag.el, g);
        return;
      }
    }
    groupsEl.append(drag.el);
    return;
  }

  let list = null;
  for (const ul of groupsEl.querySelectorAll('.songs')) {
    const box = ul.getBoundingClientRect();
    if (y >= box.top - 24 && y <= box.bottom + 24) {
      list = ul;
      break;
    }
  }
  if (!list) return;

  for (const row of list.querySelectorAll('.song')) {
    if (row === drag.el) continue;
    const box = row.getBoundingClientRect();
    if (y < box.top + box.height / 2) {
      list.insertBefore(drag.el, row);
      return;
    }
  }
  list.append(drag.el);
}

/** Read the order back out of the DOM, so no index arithmetic is needed. */
function endDrag() {
  drag.el.classList.remove('dragging');
  drag.panned?.classList.remove('no-pan');
  document.body.classList.remove('dragging-active');
  drag = null;

  const groupById = new Map(state.groups.map((g) => [g.id, g]));
  const entryByUid = new Map();
  for (const g of state.groups) for (const e of g.entries) entryByUid.set(e.uid, e);

  const groups = [];
  for (const section of groupsEl.querySelectorAll('.group')) {
    const g = groupById.get(section.dataset.gid);
    if (!g) continue;
    const entries = [...section.querySelectorAll('.song')]
      .map((row) => entryByUid.get(row.dataset.uid))
      .filter(Boolean);
    groups.push({ ...g, entries });
  }

  const next = { groups };
  if (JSON.stringify(next) === JSON.stringify(state)) {
    render(); // nothing actually moved, so do not add an undo step
    return;
  }
  state = next;
  say('Moved.');
  commit();
}

function moveSwipe(event) {
  const dx = event.clientX - swipe.x0;
  const dy = event.clientY - swipe.y0;

  if (!swipe.active) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
      cancelPress();
      swipe = null; // the reader is scrolling the page
      return;
    }
    if (Math.abs(dx) < 10) return;
    cancelPress();
    swipe.active = true;
    swipe.wrap?.classList.add('swiping');
    try {
      swipe.el.setPointerCapture(event.pointerId);
    } catch { /* not essential */ }
  }

  swipe.dx = dx;
  swipe.el.style.transform = `translateX(${Math.max(-140, Math.min(140, dx))}px)`;
  swipe.wrap?.classList.toggle('armed', Math.abs(dx) > 60);
  event.preventDefault();
}

function endSwipe() {
  const { el, wrap, dx, active } = swipe;
  swipe = null;
  el.style.transform = '';
  wrap?.classList.remove('swiping', 'armed');
  if (!active || Math.abs(dx) <= 60) return;

  const row = el.closest('.song');
  if (row) deleteSong(row.dataset.uid);
  else deleteGroup(el.closest('.group').dataset.gid);
}

/* ---------- wiring ---------- */

function wire() {
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);
  btnTheme.addEventListener('click', () =>
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#btn-copy').innerHTML = ic.copy;
  $('#btn-copy').addEventListener('click', () => copyText(setListText(), 'Set list copied.'));
  $('#btn-share').innerHTML = ic.share;
  $('#btn-share').addEventListener('click', () =>
    copyText(`${location.origin}${location.pathname}#${toHash(state)}`, 'Share link copied.'));
  btnUndo.innerHTML = ic.undo;
  btnRedo.innerHTML = ic.redo;
  btnBrowse.innerHTML = ic.search;
  btnBrowse.addEventListener('click', () => {
    ui.browse = !ui.browse;
    ui.browseQ = '';
    if (ui.browse) ui.focusSel = '.browse .b-q';
    render();
    if (ui.browse) browseEl.querySelector('.browse')?.scrollIntoView({ block: 'nearest' });
  });
  $('#btn-toast-close').innerHTML = ic.x;
  $('#btn-toast-close').addEventListener('click', hideToast);
  $('#btn-hint-close').innerHTML = ic.x;
  $('#btn-hint-close').addEventListener('click', () => {
    hintEl.hidden = true;
    try {
      localStorage.setItem(HINT_KEY, 'off');
    } catch {
      /* it will simply come back next time */
    }
  });

  appEl.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el || el.disabled) return;

    const gid = el.closest('[data-gid]')?.dataset.gid;
    const entryUid = el.closest('[data-uid]')?.dataset.uid;

    switch (el.dataset.act) {
      case 'open-search': openSearch(gid, el.dataset.at); break;

      case 'b-close': ui.browse = false; render(); break;

      case 'ns-open':
        ui.newSong = {
          gid: el.closest('.search-panel').dataset.gid,
          at: el.closest('.search-panel').dataset.at === undefined
            ? undefined
            : Number(el.closest('.search-panel').dataset.at),
          title: ui.searchState.q.trim(),
          artist: '',
          tonic: '',
          mode: 'major',
          bpm: '',
        };
        ui.focusSel = '#ns-title';
        render();
        break;

      case 'ns-cancel':
        ui.newSong = null;
        ui.focusSel = '.search-panel .s-q';
        render();
        break;

      case 'ns-add': addSongByHand(); break;


      case 'lib-links': {
        const id = el.dataset.song;
        if (ui.expandedLib.has(id)) ui.expandedLib.delete(id);
        else ui.expandedLib.add(id);
        refreshBrowse();
        break;
      }

      case 's-close': closeSearch(); break;
      case 'pick': pickSong(el); break;

      case 's-compat':
        ui.searchState.compat = el.getAttribute('aria-pressed') !== 'true';
        render();
        break;

      case 'collapse':
        if (ui.collapsed.has(gid)) ui.collapsed.delete(gid);
        else {
          ui.collapsed.add(gid);
          if (ui.search?.gid === gid) ui.search = null;
        }
        render();
        break;

      case 'rename-group':
      case 'tap-group':
        if (el.dataset.act === 'tap-group' && event.detail && !isSecondTap(el)) break;
        ui.renaming = gid;
        ui.focusSel = `[data-gid="${gid}"] .rename`;
        render();
        break;

      case 'del-group': deleteGroup(gid); break;

      case 'links':
        if (ui.expanded.has(entryUid)) ui.expanded.delete(entryUid);
        else ui.expanded.add(entryUid);
        render();
        break;

      case 'edit-song':
      case 'tap-song':
        if (el.dataset.act === 'tap-song' && event.detail && !isSecondTap(el)) break;
        ui.editor = ui.editor === entryUid ? null : entryUid;
        ui.swap = null;
        ui.search = null;
        render();
        break;

      case 'del-song': deleteSong(entryUid); break;
      case 't-up': setTranspose(entryUid, 1); break;
      case 't-down': setTranspose(entryUid, -1); break;
      case 'ed-reset': resetEntry(entryUid); break;
      case 'ed-done': ui.editor = null; ui.swap = null; render(); break;

      case 'ed-swap':
        ui.swap = ui.swap === entryUid ? null : entryUid;
        ui.searchState = { q: '', compat: false, semi: 0 };
        if (ui.swap) ui.focusSel = '.search-panel .s-q';
        render();
        break;

      case 'add-group-open':
        ui.adding = true;
        ui.focusSel = '#gname';
        render();
        break;

      case 'add-group-cancel': ui.adding = false; render(); break;
      case 'add-group-create': createGroup($('#gname').value); break;

      case 'sugg': {
        const input = $('#gname');
        input.value = el.dataset.name;
        input.focus();
        break;
      }
    }
  });

  appEl.addEventListener('input', (event) => {
    const act = event.target.dataset.act;
    if (act === 'b-q') {
      ui.browseQ = event.target.value;
      refreshBrowse();
    } else if (act === 'ns-title' || act === 'ns-artist' || act === 'ns-bpm') {
      ui.newSong[act.slice(3)] = event.target.value;
      refreshNewSong();
    } else if (act === 's-q') {
      ui.searchState.q = event.target.value;
      refreshResults();
    } else if (act === 's-semi') {
      ui.searchState.semi = event.target.value;
      refreshResults();
    }
  });

  appEl.addEventListener('change', (event) => {
    const act = event.target.dataset.act;
    if (act === 'set-bpm') {
      setBpm(event.target.closest('[data-uid]').dataset.uid, event.target.value);
    } else if (act === 'ns-tonic' || act === 'ns-mode') {
      ui.newSong[act.slice(3)] = event.target.value;
      refreshNewSong();
    } else if (act === 'ek-tonic' || act === 'ek-mode') {
      const editor = event.target.closest('.editor');
      setSongKey(
        editor.dataset.uid,
        $('[data-act="ek-tonic"]', editor).value,
        $('[data-act="ek-mode"]', editor).value,
      );
    }
  });

  appEl.addEventListener('keydown', (event) => {
    const el = event.target;

    if (el.dataset.act === 'rename-input') {
      if (event.key === 'Enter') { event.preventDefault(); el.blur(); }
      else if (event.key === 'Escape') { ui.renaming = null; render(); }
      return;
    }

    if (el.dataset.act === 'gname') {
      if (event.key === 'Enter') { event.preventDefault(); createGroup(el.value); }
      else if (event.key === 'Escape') { ui.adding = false; render(); }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      const act = el.dataset.act;
      if (act === 'tap-group' || act === 'tap-song') {
        event.preventDefault();
        el.click(); // a scripted click has detail 0, which skips the double tap check
      }
      return;
    }

    if (event.key === 'Escape' && ui.browse && el.dataset.act === 'b-q') {
      ui.browse = false;
      render();
      return;
    }
    if (event.key === 'Escape' && ui.newSong) {
      ui.newSong = null;
      render();
      return;
    }
    if (event.key === 'Escape' && ui.search) { closeSearch(); return; }

    const handle = el.closest('.handle');
    if (!handle || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const dir = event.key === 'ArrowUp' ? -1 : 1;
    if (handle.dataset.drag === 'group') moveGroup(handle.closest('.group').dataset.gid, dir);
    else moveSong(handle.closest('.song').dataset.uid, dir);
  });

  appEl.addEventListener('focusout', (event) => {
    if (event.target.dataset.act === 'rename-input') {
      renameGroup(event.target.closest('[data-gid]').dataset.gid, event.target.value);
    }
  });

  appEl.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;

    const handle = event.target.closest('.handle');
    if (handle) {
      const kind = handle.dataset.drag;
      beginDrag(kind, handle.closest(kind === 'group' ? '.group' : '.song'), event.pointerId, handle);
      event.preventDefault();
      return;
    }

    const row = event.target.closest('.swipe');
    if (!row || event.target.closest('button, a, input, .editor, .search-panel')) return;

    const pointerId = event.pointerId;
    swipe = {
      el: row,
      wrap: row.closest('.swipe-wrap'),
      x0: event.clientX,
      y0: event.clientY,
      dx: 0,
      active: false,
    };
    press = {
      timer: setTimeout(() => {
        press = null;
        swipe = null;
        row.style.transform = '';
        row.closest('.swipe-wrap')?.classList.remove('swiping', 'armed');
        const inSong = row.closest('.song');
        beginDrag(inSong ? 'song' : 'group', inSong ?? row.closest('.group'), pointerId, row);
      }, HOLD_MS),
    };
  });

  appEl.addEventListener('pointermove', (event) => {
    if (drag) moveDrag(event);
    else if (swipe) moveSwipe(event);
  });

  // Belt and braces for touch: stop the page scrolling while a row is held.
  appEl.addEventListener('touchmove', (event) => {
    if (drag) event.preventDefault();
  }, { passive: false });

  for (const type of ['pointerup', 'pointercancel']) {
    appEl.addEventListener(type, () => {
      cancelPress();
      if (drag) endDrag();
      else if (swipe) endSwipe();
    });
  }
}

/* ---------- a share link pasted into the address bar ---------- */

/* Pasting a link that differs only after the # does not reload the page.
   The browser fires hashchange instead, so the set list has to be picked up here. */
function onHashChange() {
  const fromLink = takeStateFromHash();
  if (!fromLink) return;
  if (fromLink === 'bad') {
    say('That share link could not be read.');
    return;
  }
  state = fromLink;
  ui.search = null;
  ui.swap = null;
  ui.editor = null;
  ui.renaming = null;
  ui.adding = false;
  // commit, not replace, so Undo can take you back to what you had before
  commit();
  say('Set list loaded from the share link. Undo puts back what you had.');
}

/* ---------- start ---------- */

function showDataErrors(errors) {
  errorsEl.hidden = false;
  errorsEl.innerHTML = `<b>${errors.length} problem${errors.length === 1 ? '' : 's'} in songs.tsv.</b>
    Those songs were left out.<ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
}

function showFatal(err) {
  errorsEl.hidden = false;
  errorsEl.classList.add('fatal');
  errorsEl.innerHTML = `<b>Could not load songs.tsv.</b>
    <p>${esc(err.message)}</p>
    <p>If the address bar starts with <code>file://</code>, the browser blocks the read.
    Serve the folder over http instead, for example <code>py -m http.server 8080</code>,
    then open <code>http://localhost:8080/</code>.</p>`;
}

async function init() {
  try {
    setTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
  } catch {
    setTheme('dark');
  }

  try {
    hintEl.hidden = localStorage.getItem(HINT_KEY) === 'off';
  } catch {
    /* leave the hint showing */
  }

  try {
    const res = await fetch('songs.tsv', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`songs.tsv returned HTTP ${res.status}`);
    const prepared = prepareSongs(songsFromTsv(await res.text()));
    songs = prepared.songs.sort(
      (a, b) => a.title.localeCompare(b.title) || (a.artist || '').localeCompare(b.artist || ''),
    );
    songById = new Map(songs.map((s) => [s.id, s]));
    if (prepared.errors.length) showDataErrors(prepared.errors);
  } catch (err) {
    showFatal(err);
    return;
  }

  state = loadState();
  undoStack = [JSON.stringify(state)];
  undoAt = 0;

  wire();
  showSourceLink();
  window.addEventListener('hashchange', onHashChange);
  render();
  if (!statusEl.textContent) say(`${songs.length} songs available.`);
}

init();
