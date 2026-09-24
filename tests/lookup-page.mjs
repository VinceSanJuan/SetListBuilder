/* Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE. */
/* The lookup page, driven against a stubbed server.

   The point of these checks is the tag picker: pressing a chip must rewrite the
   tags cell and leave every other cell alone, the Camelot value above all,
   since that one is worked out by music.js and must not be rebuilt in the page.

   No network here either. window.fetch is replaced with a fixed reply. */

import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { reporter } from './report.mjs';

const { check, done } = reporter('lookup page', import.meta.url);

const html = readFileSync(new URL('../tools/lookup.html', import.meta.url), 'utf8');

const quiet = new VirtualConsole();
quiet.on('jsdomError', () => {});

/* A song with far more themes than fit, which is the case that matters. The
   order is PraiseCharts's own: alphabetical, so the first three are arbitrary. */
const REPLY = {
  query: 'o praise the name',
  found: true,
  url: 'https://www.praisecharts.com/songs/details/1/x/chords',
  row: 'O Praise The Name (Anastasis)\tHillsong Worship\tC\t72\t8B\tcalvary;cross;crucifixion\tYoutube=https://y/1',
  tagCell: 5,
  notes: [],
  song: {
    title: 'O Praise The Name (Anastasis)',
    artist: 'Hillsong Worship',
    themes: ['Calvary', 'Cross', 'Crucifixion', 'Easter', 'Good Friday', 'Jesus', 'King',
      'Lent', 'Messiah', 'Praise', 'Resurrection', 'Second Coming', 'Worship'],
  },
};

const dom = new JSDOM(html, {
  url: 'http://localhost:8081/', runScripts: 'dangerously', virtualConsole: quiet,
});
const { window } = dom;
window.fetch = async () => ({ json: async () => structuredClone(REPLY) });

const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const press = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const cells = () => $('#out').value.split('\t');
const tags = () => cells()[5];

await wait(60);

$('#q').value = 'o praise the name';
press($('#go'));
await wait(120);

const chips = $$('.chip');
check(chips.length === REPLY.song.themes.length,
  'every theme is offered, not only the three that were taken', String(chips.length));
check(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').length === 3,
  'three are ticked to begin with, so a row is ready without touching anything');
check(tags() === 'calvary;cross;crucifixion', 'and those three are the tags', tags());

const chip = (name) => chips.find((c) => c.dataset.theme === name);

// Praise is tenth alphabetically, so the old rule could never have reached it.
press(chip('Praise'));
check(chip('Praise').getAttribute('aria-pressed') === 'true', 'pressing a chip ticks it');
check(tags() === 'calvary;cross;crucifixion;praise', 'and it joins the tags', tags());

for (const name of ['Calvary', 'Cross', 'Crucifixion']) press(chip(name));
check(tags() === 'praise', 'pressing a ticked chip takes it out again', tags());
check(chip('Calvary').getAttribute('aria-pressed') === 'false', 'and the chip shows it');

press(chip('Easter'));
check(tags() === 'easter;praise',
  'tags follow the order of the theme list, not the order they were pressed', tags());

// Everything the tool worked out has to survive being picked over.
check(cells()[0] === 'O Praise The Name (Anastasis)', 'the title is untouched', cells()[0]);
check(cells()[2] === 'C' && cells()[3] === '72', 'the key and BPM are untouched');
check(cells()[4] === '8B',
  'the Camelot value is untouched, still the one music.js worked out', cells()[4]);
check(cells()[6] === 'Youtube=https://y/1', 'and the urls cell too', cells()[6]);
check(cells().length === 7, 'the row still has seven cells');

press(chip('Easter'));
press(chip('Praise'));
check(tags() === '', 'no tags at all leaves the cell empty', JSON.stringify(tags()));
check(cells().length === 7, 'and the row keeps its seven cells even then');

done();
