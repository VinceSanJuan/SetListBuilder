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
/* Camelot wheel maths and song-record preparation.
   Shared by app.js (browser) and tools/validate.mjs (Node, run by the Action).

   The wheel has numbers 1-12 and a letter: A = minor, B = major.
   Moving +1 number is +7 semitones (a perfect fifth), so a shift of s
   semitones moves the number by (7 * s) mod 12 and leaves the letter alone. */

export const WHEEL = [
  [1, 'G#', 'B'], [2, 'Eb', 'F#'], [3, 'Bb', 'Db'], [4, 'F', 'Ab'],
  [5, 'C', 'Eb'], [6, 'G', 'Bb'], [7, 'D', 'F'], [8, 'A', 'C'],
  [9, 'E', 'G'], [10, 'B', 'D'], [11, 'F#', 'A'], [12, 'C#', 'E'],
];

const CAMELOT_KEY = {}; // '8B' -> 'C maj'
const KEY_CAMELOT = {}; // '0:maj' -> '8B'
const PITCH = {};       // 'Bb' -> 10

for (const [i, names] of [
  ['C', 'B#'], ['C#', 'Db'], ['D'], ['D#', 'Eb'], ['E', 'Fb'], ['F', 'E#'],
  ['F#', 'Gb'], ['G'], ['G#', 'Ab'], ['A'], ['A#', 'Bb'], ['B', 'Cb'],
].entries()) {
  for (const n of names) PITCH[n] = i;
}

for (const [n, minor, major] of WHEEL) {
  CAMELOT_KEY[n + 'A'] = minor + ' min';
  CAMELOT_KEY[n + 'B'] = major + ' maj';
  KEY_CAMELOT[PITCH[minor] + ':min'] = n + 'A';
  KEY_CAMELOT[PITCH[major] + ':maj'] = n + 'B';
}

/** One spelling per pitch class, for a key picker. Every one maps to a Camelot cell,
    in both major and minor. Enharmonics are normalised on the way in, so picking
    Ab minor stores the canonical G# min. */
export const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/* ---------- keys ---------- */

const KEY_RE = /^([A-G])([#b]?)\s*(.*)$/;

/** 'G' | 'Am' | 'Eb' | 'F#m' | 'G major' | 'a minor' -> {pc, mode} or null */
export function parseKey(text) {
  if (typeof text !== 'string') return null;
  let t = text.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  // Accept a leading lowercase note letter, and 'B'/'b' as the flat sign.
  t = t.charAt(0).toUpperCase() + t.slice(1);
  t = t.replace(/^([A-G])B/, '$1b');
  const m = KEY_RE.exec(t);
  if (!m) return null;
  const pc = PITCH[m[1] + m[2]];
  if (pc === undefined) return null;
  const rest = m[3].trim().toLowerCase();
  let mode;
  if (rest === '' || rest === 'maj' || rest === 'major') mode = 'maj';
  else if (rest === 'm' || rest === 'min' || rest === 'minor') mode = 'min';
  else return null;
  return { pc, mode };
}

/**
 * Turn a stored key back into a picker choice. Matching is by pitch class, not by
 * spelling, because the canonical form may differ from the spelling in TONICS:
 * picking Ab minor stores G# min, and both must come back as the same option.
 */
export function keyToPicker(text) {
  const parsed = parseKey(text);
  if (!parsed) return null;
  return {
    tonic: TONICS.find((t) => parseKey(t).pc === parsed.pc) ?? '',
    mode: parsed.mode === 'min' ? 'minor' : 'major',
  };
}

export function camelotForKey(text) {
  const k = parseKey(text);
  return k ? KEY_CAMELOT[k.pc + ':' + k.mode] : null;
}

export function keyForCamelot(camelot) {
  return CAMELOT_KEY[camelot] || null;
}

/* ---------- wheel positions ---------- */

/** '8B' -> {n: 8, l: 'B'}, anything invalid -> null */
export function parseCamelot(text) {
  const m = /^(\d{1,2})\s*([ABab])$/.exec(String(text ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? { n, l: m[2].toUpperCase() } : null;
}

export const camelotStr = (c) => (c ? c.n + c.l : '');

/** Move a wheel position by a number of semitones. */
export function shift(c, semitones) {
  if (!c) return null;
  const n = ((((c.n - 1 + 7 * semitones) % 12) + 12) % 12) + 1;
  return { n, l: c.l };
}

/** How `cand` relates to `anchor`, or null when the two clash. */
export function relation(cand, anchor) {
  if (!cand || !anchor) return null;
  if (cand.n === anchor.n && cand.l === anchor.l) return 'same key';
  const d = (((cand.n - anchor.n) % 12) + 12) % 12;
  if (cand.l === anchor.l && d === 1) return 'one step up';
  if (cand.l === anchor.l && d === 11) return 'one step down';
  if (cand.n === anchor.n) return cand.l === 'A' ? 'relative minor' : 'relative major';
  return null;
}

export const compatible = (a, b) => relation(a, b) !== null;

/** Smallest transpose within +/- maxSemi that makes `cand` fit `anchor`. */
export function bestShift(cand, anchor, maxSemi) {
  if (!cand || !anchor) return null;
  const limit = Math.max(0, Math.min(11, maxSemi | 0));
  for (let d = 0; d <= limit; d++) {
    for (const semi of d === 0 ? [0] : [d, -d]) {
      const moved = shift(cand, semi);
      const rel = relation(moved, anchor);
      if (rel) return { semi, rel, cam: camelotStr(moved) };
    }
  }
  return null;
}

/* ---------- reading the library from a spreadsheet ---------- */

const unquote = (cell) => {
  const value = cell.trim();
  // Excel quotes a field that holds a quote when it saves tab delimited text
  return value.length > 1 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replace(/""/g, '"')
    : value;
};

/**
 * Split tab separated text into rows of cells.
 *
 * Tabs are the separator on purpose: a spreadsheet cell cannot hold one, so there
 * is no quoting to get wrong. A comma separated file would need a real parser,
 * because a title such as "10,000 Reasons (Bless The Lord)" holds a comma.
 * Copes with CRLF from Excel and with the byte order mark it writes.
 */
export function parseTsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return src
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '')
    .map((line) => line.split('\t').map(unquote));
}

const splitList = (value) => (value ? value.split(';').map((v) => v.trim()).filter(Boolean) : []);

/**
 * Turn songs.tsv into the same shape prepareSongs takes.
 * Columns are found by name, so their order does not matter and any extra column
 * is ignored. `tags` and `urls` hold several values separated by a semicolon, a
 * url being either a plain address or `Label=address`.
 */
export function songsFromTsv(text) {
  const rows = parseTsv(text);
  if (!rows.length) return [];

  const head = rows[0].map((h) => h.trim().toLowerCase());
  if (!head.includes('title')) {
    throw new Error('the first row must name the columns, and must include title');
  }

  return rows.slice(1).map((cells) => {
    const get = (name) => {
      const at = head.indexOf(name);
      return at < 0 ? '' : (cells[at] ?? '').trim();
    };
    const id = get('id');
    return {
      ...(id ? { id } : {}),
      title: get('title'),
      artist: get('artist'),
      key: get('key'),
      bpm: get('bpm'),
      camelot: get('camelot'),
      tags: splitList(get('tags')),
      urls: splitList(get('urls')).map((entry) => {
        const at = entry.indexOf('=');
        return at < 0
          ? entry
          : { label: entry.slice(0, at).trim(), url: entry.slice(at + 1).trim() };
      }),
    };
  });
}

/* ---------- song records ---------- */

/** Fill in whichever of key/camelot is blank; report a disagreement. */
export function resolveKey(keyText, camelotText) {
  const hasKey = typeof keyText === 'string' && keyText.trim() !== '';
  const hasCam = typeof camelotText === 'string' && camelotText.trim() !== '';

  if (!hasKey && !hasCam) return { key: '', camelot: '' };

  const fromKey = hasKey ? camelotForKey(keyText) : null;
  if (hasKey && !fromKey) return { error: `unrecognized key "${keyText}"` };

  const fromCam = hasCam ? parseCamelot(camelotText) : null;
  if (hasCam && !fromCam) return { error: `unrecognized camelot "${camelotText}"` };

  if (hasKey && hasCam && fromKey !== camelotStr(fromCam)) {
    return { error: `key "${keyText}" is camelot ${fromKey}, but file says ${camelotStr(fromCam)}` };
  }

  const camelot = fromKey || camelotStr(fromCam);
  return { key: keyForCamelot(camelot), camelot };
}

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'song';

function normalizeUrls(raw, where, errors) {
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) {
    errors.push(`${where}: urls must be a list`);
    return [];
  }
  const out = [];
  raw.forEach((u, i) => {
    const url = (typeof u === 'string' ? u : u?.url ?? '').trim();
    const label = (typeof u === 'string' ? '' : u?.label ?? '').trim();
    if (!url) {
      errors.push(`${where}: url ${i + 1} has no address`);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      errors.push(`${where}: url ${i + 1} must start with http:// or https://`);
      return;
    }
    out.push({ label: label || `Link ${out.length + 1}`, url });
  });
  return out;
}

/**
 * Validate and normalize the rows read from songs.tsv.
 * Returns { songs, errors }. Bad songs are dropped, not silently fixed.
 * Ids are stable slugs of title + artist, so reordering songs.tsv is safe.
 * Only the title is required. An unknown artist may be left out.
 */
export function prepareSongs(raw) {
  const songs = [];
  const errors = [];

  if (!Array.isArray(raw)) return { songs, errors: ['the song rows could not be read'] };

  const seen = new Map();

  raw.forEach((s, i) => {
    const title = typeof s?.title === 'string' ? s.title.trim() : '';
    const artist = typeof s?.artist === 'string' ? s.artist.trim() : '';
    const where = `song ${i + 1}${title ? ` ("${title}")` : ''}`;

    if (!title) {
      errors.push(`song ${i + 1}: title is required`);
      return;
    }
    const resolved = resolveKey(s.key, s.camelot);
    if (resolved.error) {
      errors.push(`${where}: ${resolved.error}`);
      return;
    }

    let bpm = null;
    if (s.bpm !== undefined && s.bpm !== null && s.bpm !== '') {
      const n = Number(s.bpm);
      if (!Number.isFinite(n) || n < 20 || n > 400) {
        errors.push(`${where}: bpm must be a number 20-400, got ${JSON.stringify(s.bpm)}`);
        return;
      }
      bpm = Math.round(n);
    }

    let id = typeof s.id === 'string' && s.id.trim()
      ? s.id.trim()
      : slugify(artist ? `${title} ${artist}` : title);
    const count = (seen.get(id) || 0) + 1;
    seen.set(id, count);
    if (count > 1) id = `${id}-${count}`;

    const tags = Array.isArray(s.tags)
      ? s.tags.map((t) => String(t).trim()).filter(Boolean)
      : [];

    songs.push({
      id,
      title,
      artist,
      key: resolved.key || '',
      bpm,
      camelot: resolved.camelot || '',
      tags,
      urls: normalizeUrls(s.urls, where, errors),
    });
  });

  return { songs, errors };
}
