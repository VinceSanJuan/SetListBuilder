/* Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE. */
/* The awkward cases a spreadsheet actually produces. */
import { parseTsv, songsFromTsv, prepareSongs } from '../music.js';
import { reporter } from './report.mjs';

const { eq, done } = reporter('data', import.meta.url);

eq(parseTsv('a\tb\nc\td'), [['a','b'],['c','d']], 'plain rows');
eq(parseTsv('a\tb\r\nc\td\r\n'), [['a','b'],['c','d']], 'CRLF from Excel, trailing newline dropped');
eq(parseTsv('a\tb\rc\td'), [['a','b'],['c','d']], 'bare CR from an old Mac export');
eq(parseTsv('\ufefftitle\tartist'), [['title','artist']], 'byte order mark stripped');
eq(parseTsv('a\tb\n\n\nc\td'), [['a','b'],['c','d']], 'blank lines ignored');
eq(parseTsv('a\t\tb'), [['a','','b']], 'an empty cell in the middle is kept');
eq(parseTsv(' a \t b '), [['a','b']], 'cells are trimmed');
eq(parseTsv('"say ""hi"""\tb'), [['say "hi"','b']], 'Excel style quoting is unwrapped');
eq(parseTsv('10,000 Reasons\tMatt Redman'), [['10,000 Reasons','Matt Redman']],
  'a comma is just a character, which is the whole point of tabs');

const tsv = [
  'title\tartist\tkey\tbpm\tcamelot\ttags\turls',
  '10,000 Reasons (Bless The Lord)\tMatt Redman\tG\t145\t\tpraise;slow\tWT=https://a.example/x',
  'No Artist Song\t\tAm\t\t\t\t',
  'Bare Url\tX\tC\t90\t\t\thttps://b.example/y',
].join('\n');

const rows = songsFromTsv(tsv);
eq(rows.length, 3, 'three data rows');
eq(rows[0].title, '10,000 Reasons (Bless The Lord)', 'title with a comma');
eq(rows[0].tags, ['praise','slow'], 'tags split on a semicolon');
eq(rows[0].urls, [{ label: 'WT', url: 'https://a.example/x' }], 'a labelled url');
eq(rows[2].urls, ['https://b.example/y'], 'a bare url passes through for prepareSongs to label');
eq(rows[1].artist, '', 'a missing artist is empty, not undefined');
eq(rows[1].bpm, '', 'a missing bpm is empty, which prepareSongs treats as absent');

const { songs, errors } = prepareSongs(rows);
eq(errors, [], 'no problems');
eq(songs.length, 3, 'three songs');
eq(songs[1].artist, '', 'artist stays empty');
eq(songs[1].camelot, '8A', 'Am became 8A');
eq(songs[2].urls, [{ label: 'Link 1', url: 'https://b.example/y' }], 'a bare url gets a label');

// column order must not matter, and extra columns must be ignored
const shuffled = songsFromTsv('bpm\tnotes\ttitle\tkey\n120\tignore me\tShuffled\tD');
eq(shuffled[0], { title: 'Shuffled', artist: '', key: 'D', bpm: '120', camelot: '', tags: [], urls: [] },
  'columns found by name, unknown ones dropped');

// an explicit id overrides the slug
const withId = prepareSongs(songsFromTsv('id\ttitle\nfixed-id\tRenamed Later'));
eq(withId.songs[0].id, 'fixed-id', 'an id column is honoured');

// a header with no title column is a clear single error, not one per row
try {
  songsFromTsv('artist\tkey\nX\tG');
  eq('no error', 'an error', 'a header with no title column is refused');
} catch (err) {
  eq(err.message.includes('title'), true, 'a header with no title column is refused clearly');
}

eq(parseTsv(''), [], 'empty text gives no rows');
eq(songsFromTsv(''), [], 'and no songs');

done();
