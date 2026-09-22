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
/* Validate songs.tsv. Run by the GitHub Action before the site is deployed,
   so a bad key or Camelot value never reaches the live page.

   Usage:  node tools/validate.mjs [songs.tsv] */

import { readFileSync } from 'node:fs';
import { prepareSongs, songsFromTsv } from '../music.js';

const path = process.argv[2] ?? 'songs.tsv';

let rows;
try {
  rows = songsFromTsv(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`${path}: cannot read -> ${err.message}`);
  process.exit(1);
}

const { songs, errors } = prepareSongs(rows);

for (const song of songs) {
  const bpm = song.bpm ?? '--';
  console.log(`  ${song.id.padEnd(40)} ${(song.key || '--').padEnd(8)} ${String(bpm).padEnd(4)} ${song.camelot || '--'}`);
}

const dupes = new Set();
const titles = new Map();
for (const s of songs) {
  titles.set(s.title, (titles.get(s.title) || 0) + 1);
  if (titles.get(s.title) > 1) dupes.add(s.title);
}

console.log(`\n${songs.length} songs ok, ${errors.length} problems.`);
if (dupes.size) console.log(`Duplicate titles (allowed): ${[...dupes].join(', ')}`);

if (errors.length) {
  console.error('\nProblems:');
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
