/* Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE. */
/* Drive app.js against a jsdom document, so the real render path is exercised. */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { camelotForKey, keyForCamelot, parseCamelot, camelotStr, shift } from '../music.js';
import { reporter } from './report.mjs';

const from = (name) => new URL(`../${name}`, import.meta.url);
const css = readFileSync(from('styles.css'), 'utf8');
const html = readFileSync(from('index.html'), 'utf8')
  .replace('<script type="module" src="app.js"></script>', '')
  // real stylesheet, inline, so getComputedStyle reflects what a browser would do
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`);

// jsdom cannot parse a few modern declarations. Those warnings are not failures.
const quiet = new VirtualConsole();
quiet.on('jsdomError', () => {});

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/', pretendToBeVisual: true, virtualConsole: quiet,
});
const { window } = dom;

for (const k of ['document', 'window', 'location', 'history', 'localStorage', 'navigator',
                 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'MouseEvent',
                 'KeyboardEvent', 'getComputedStyle']) {
  globalThis[k] = window[k];
}
globalThis.scrollBy = () => {};
globalThis.innerHeight = 800;
window.Element.prototype.setPointerCapture = () => {};
window.Element.prototype.releasePointerCapture = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function (v) {
  this.open = false;
  if (v !== undefined) this.returnValue = v;
  this.dispatchEvent(new window.Event('close'));
};

const songsTsv = readFileSync(from('songs.tsv'), 'utf8');
globalThis.fetch = async (url) => {
  if (String(url).includes('songs.tsv')) {
    return { ok: true, status: 200, text: async () => songsTsv };
  }
  throw new Error(`unexpected fetch: ${url}`);
};

let clipboard = null;
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async (t) => { clipboard = t; } }, configurable: true,
});

/* ---------- harness ---------- */

const { check, done } = reporter('app', import.meta.url);
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const click = (el, detail = 1) => {
  if (!el) throw new Error('click on nothing');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail, button: 0 }));
};
const type = (el, value) => {
  el.value = value;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const arrow = (el, key) =>
  el.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
const pointer = (el, kind, x, y) =>
  el.dispatchEvent(new window.MouseEvent(kind, { bubbles: true, clientX: x, clientY: y, button: 0 }));
const wait = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// the library grows; read its size rather than freezing a number into the test
const TOTAL = songsTsv.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '').length - 1;

// A tag that appears in no part of the name of the song carrying it. Taken from
// the library rather than named here, because the library is edited often and a
// test that names one song goes stale the moment that song is changed.
const tagOnly = songsTsv.split(/\r\n|\n|\r/).slice(1)
  .map((line) => line.split('\t'))
  .filter((cells) => cells[0] && cells[5])
  .flatMap((cells) => cells[5].split(';')
    .map((tag) => ({ title: cells[0], name: `${cells[0]} ${cells[1] ?? ''}`.toLowerCase(), tag: tag.trim() })))
  .find((x) => x.tag && !x.name.includes(x.tag.toLowerCase()));

const groups = () => $$('.group');
/** The loud button at the end of a group. The quiet gaps share its action. */
const addBtn = (i) => groups()[i].querySelector('.plus[data-act="open-search"]');
const gaps = (i) => [...groups()[i].querySelectorAll('.gap-btn')];
const songsIn = (i) => [...groups()[i].querySelectorAll('.song')];
const names = () => $$('.group-name').map(text);
const shiftChips = () => $$('.chip.fit').filter((c) => text(c).includes('\u2192'));

await import(from('app.js'));
await wait(50);

/* ---------- 1. first paint ---------- */

check(groups().length === 3, 'three default groups');
check(names().join(',') === 'Opening,Joyful,Solemn', 'default group names', names().join(','));
check(text($('#status')).includes(`${TOTAL} songs`), 'status reports the song count',
  `${text($('#status'))} for ${TOTAL}`);
check($('#data-errors').hidden, 'no data error banner');
check($('#btn-undo').disabled && $('#btn-redo').disabled, 'undo and redo start disabled');
check(window.document.documentElement.dataset.theme === 'dark', 'dark theme by default');
check(text($('#summary')) === 'No songs yet', 'header summary starts empty', text($('#summary')));
check(groups()[0].style.getPropertyValue('--gc') !== '', 'each group carries its own colour');
check($$('.handle svg path').length > 0, 'move handles render an icon, not a text glyph');

check([...$$('.actions .icon-btn')].map((b) => b.id).join(',')
  === 'btn-browse,btn-undo,btn-redo,btn-theme',
  'top bar order: search, undo, redo, theme',
  [...$$('.actions .icon-btn')].map((b) => b.id).join(','));
check([...$('.actions').children].map((c) => c.id).join(',')
  === 'btn-browse,btn-undo,btn-redo,btn-theme,btn-share',
  'with the one Share button at the far right',
  [...$('.actions').children].map((c) => c.id).join(','));

const style = (sel) => window.getComputedStyle($(sel));
check(!$('#btn-copy'), 'the separate copy icon is gone');
check($('#btn-share').classList.contains('btn'),
  'and Share is a highlighted button, not another quiet icon',
  $('#btn-share').className);
check(!$('#btn-share').querySelector('svg'),
  'the button is a plain label, with no arrow to animate',
  $('#btn-share').innerHTML);

// .btn carries the same one class of weight as .share-btn and asks for a taller,
// padded, differently rounded button, so the Share rules only win by sitting
// later in the file. This checks the outcome, not just that they were written.
check(style('.share-btn').minHeight === '34px',
  'the Share rules beat the shared button rules, which ask for a taller one',
  style('.share-btn').minHeight);
check(style('.share-btn').borderRadius === '11px', 'and beat its corners',
  style('.share-btn').borderRadius);
// a short button in a stretch row would hang from the top of it
check(style('.actions').alignItems === 'center',
  'the top row centres its buttons, so the short one sits level with the icons',
  style('.actions').alignItems);

/* ---------- 1a. the hint bar ---------- */

check(!$('#hint').hidden, 'the hint shows on a first visit');
check($('#hint').compareDocumentPosition($('#groups')) === 4,
  'and sits above the set list, not below it');
check(!!$('#hint').closest('.app'), 'in the page, not floating over it');
check(window.getComputedStyle($('#hint')).display === 'flex', 'laid out as a row');
click($('#btn-hint-close'));
check($('#hint').hidden, 'the cross sets it hidden');
check(window.getComputedStyle($('#hint')).display === 'none',
  'and it really disappears, an author display rule does not win over it',
  window.getComputedStyle($('#hint')).display);
check(window.localStorage.getItem('slb.hint') === 'off', 'and it is remembered for next time');

// the same trap would apply to any other element toggled with the hidden attribute
check(window.getComputedStyle($('#data-errors')).display === 'none',
  'the error banner hides properly too');

/* ---------- 1d. the licence notice ---------- */

const foot = text($('.foot'));
check(foot.includes('copyright'), 'the footer carries a copyright line', foot);
check(foot.includes('no warranty'), 'and the no warranty wording');
check(foot.includes('GNU GPL v3'), 'and names the licence');
check(foot.includes('redistribute'), 'and says it may be passed on');
check($('.foot a').getAttribute('href') === 'https://www.gnu.org/licenses/gpl-3.0.html',
  'the licence link points at the real text', $('.foot a').getAttribute('href'));
const srcA = $('#source-link a');
check(!!srcA, 'the footer offers a source link');
check(srcA.getAttribute('href') === 'https://github.com/VinceSanJuan/SetListBuilder',
  'pointing at the repository', srcA.getAttribute('href'));
check(srcA.getAttribute('target') === '_blank' && srcA.getAttribute('rel') === 'noopener',
  'opened in a new tab, safely');
check(!!srcA.querySelector('svg path'), 'with the GitHub mark beside it');
check(srcA.querySelector('svg').getAttribute('fill') === 'currentColor',
  'drawn in the surrounding text colour');
check(srcA.querySelector('svg').getAttribute('aria-hidden') === 'true',
  'and hidden from screen readers, the text already says GitHub');
check(window.getComputedStyle(srcA).display !== 'inline-flex',
  'the link stays plain inline, or the full stop after it can wrap away on its own',
  window.getComputedStyle(srcA).display);
check(window.getComputedStyle(srcA.querySelector('svg')).display === 'inline-block',
  'and the mark sits on the text line rather than becoming a block',
  window.getComputedStyle(srcA.querySelector('svg')).display);

/* ---------- 1b. the floating message ---------- */

check($('#toast').classList.contains('show'), 'the first message floats up as a toast');
check($('#toast').contains($('#status')), 'the live region lives inside it');
click($('#btn-toast-close'));
check(!$('#toast').classList.contains('show'), 'and it can be dismissed');

/* ---------- 1c. library search, read only ---------- */

click($('#btn-browse'));
check(!!$('.browse'), 'the search button opens a library panel');
check($('#btn-browse').getAttribute('aria-pressed') === 'true', 'and reports itself pressed');
check($$('.browse .libitem').length === TOTAL, 'it lists the whole library',
  `${$$('.browse .libitem').length} of ${TOTAL}`);
check(!$('.browse [data-act="pick"]'), 'no way to add a song from here');
check(!$('.browse .result-btn'), 'the rows are not add buttons at all');
check(!$('.browse [data-act="s-compat"]') && !$('.browse .s-semi'),
  'and no Camelot match or transpose control');
check(text($('.browse .rcount')).includes('nothing is added'), 'the panel says so plainly',
  text($('.browse .rcount')));
check(!!$('.browse .libitem .cam'), 'each row still shows its Camelot badge');

check(!!tagOnly, 'the library holds a song whose tag is nowhere in its name, to search for');

type($('.browse .b-q'), 'wickham');
check($$('.browse .libitem').length > 0
  && $$('.browse .libitem').every((r) => text(r).toLowerCase().includes('wickham')),
  'the library search filters, and to that artist only',
  $$('.browse .libitem').map(text).join(' | '));
type($('.browse .b-q'), 'zzzz');
check(!!$('.browse .none-found'), 'and says when nothing matches');
type($('.browse .b-q'), tagOnly.tag);
const libHit = $$('.browse .libitem').find((r) => text(r).includes(tagOnly.title));
check(!!libHit && !!libHit.querySelector('.tag.hit'),
  'the library marks the matched tag too', libHit ? text(libHit) : 'that song did not appear');

type($('.browse .b-q'), '10,000');
const libLinks = $('.browse [data-act="lib-links"]');
check(!!libLinks, 'a song with urls offers a links button');
click(libLinks);
check(!!$('.browse .urls a'), 'which opens its links');
check($('.browse .urls a').getAttribute('target') === '_blank', 'in a new tab');
click($('#btn-browse'));
check(!$('.browse'), 'the search button closes it again');
check($$('.group').length === 3, 'and the set list is untouched');

/* ---------- 2. the add panel ---------- */

click(addBtn(0));
check(!!$('.search-panel'), 'plus opens the inline search panel');
check($('.search-panel').closest('.group') === groups()[0], 'panel sits inside its own group');
check(groups().length === 3, 'the other groups stay on the page');
check(!addBtn(0), 'the Add song button is hidden while the panel is open');
check(text($('.anchor')).includes('First song in Opening'), 'no anchor for an empty group');
check($('[data-act="s-compat"]').disabled, 'Camelot match is disabled with no song above');
check(!$('.s-semi'), 'the semitone box is hidden until Camelot match is on');
check($$('.result').length === TOTAL, 'every song is listed',
  `${$$('.result').length} of ${TOTAL}`);
check($$('.result .r-title').map(text).includes('10,000 Reasons (Bless The Lord)'),
  'a title holding a comma survives the tab separated file intact',
  $$('.result .r-title').map(text).find((t) => t.includes('Reasons')));
check(text($('.rcount')).includes(String(TOTAL)), 'the count line agrees', text($('.rcount')));

/* ---------- 3. text search ---------- */

const q = $('.s-q');
type(q, 'wickham');
check($$('.result').length > 0 && $$('.result').every((r) => text(r).toLowerCase().includes('wickham')),
  'an artist search returns only that artist', $$('.result .r-artist').map(text).join(' | '));
type(q, 'clean hands');
check($$('.result').length >= 2, 'duplicate titles both appear', String($$('.result').length));
check(text($$('.result')[0]).includes('Charlie Hall') !== text($$('.result')[1]).includes('Charlie Hall'),
  'the two duplicates are told apart by artist');
type(q, 'phil good');
check($$('.result').length > 0
  && $$('.result').every((r) => {
    const t = text(r).toLowerCase();
    return t.includes('phil') && t.includes('good');
  }),
  'every word of a search must match', $$('.result .r-title').map(text).join(' | '));

type(q, tagOnly.tag);
const byTag = $$('.result').find((r) => text(r.querySelector('.r-title')) === tagOnly.title);
check(!!byTag, `a tag only match still turns up, here "${tagOnly.tag}" finding ${tagOnly.title}`,
  $$('.result .r-title').map(text).join(' | '));
check(!!byTag.querySelector('.tag.hit'), 'and the row reveals the tag that matched',
  text(byTag));
check(text(byTag.querySelector('.tag.hit')) === tagOnly.tag, 'naming the tag itself',
  text(byTag.querySelector('.tag.hit')));

/* A word can be in one song's title and only in another song's tags. The song
   named after it is what someone means, so it has to come first. Searching
   "awesome" used to put a song merely tagged awesome above What An Awesome God,
   because the results were only in alphabetical order. */
const titles = $$('.result .r-title').map((t) => text(t).toLowerCase());
const named = titles.map((t) => t.includes(tagOnly.tag.toLowerCase()));
const lastNamed = named.lastIndexOf(true);
const firstNot = named.indexOf(false);
check(firstNot === -1 || lastNamed === -1 || lastNamed < firstNot,
  'every song with the word in its name is listed before every song without it',
  $$('.result .r-title').map(text).join(' | '));

// the whole name of a song beats anything else that happens to contain it
type(q, tagOnly.title);
check(text($$('.result .r-title')[0]) === tagOnly.title,
  'searching a whole title puts that song first',
  $$('.result .r-title').map(text).slice(0, 4).join(' | '));

// and the start of a name beats a match in the middle of a longer one
const firstWord = tagOnly.title.split(' ')[0];
if (firstWord.length > 2) {
  type(q, firstWord);
  const order = $$('.result .r-title').map(text);
  const starts = order.map((t) => t.toLowerCase().startsWith(firstWord.toLowerCase()));
  const lastStart = starts.lastIndexOf(true);
  const firstOther = starts.indexOf(false);
  check(firstOther === -1 || lastStart === -1 || lastStart < firstOther,
    'a name beginning with the word comes before one that only contains it',
    order.join(' | '));
}
type(q, tagOnly.tag);

// The same search, on a song that matched by its name instead.
const byName = $$('.result').find((r) => {
  const title = text(r.querySelector('.r-title'));
  return title !== tagOnly.title && title.toLowerCase().includes(tagOnly.tag.toLowerCase());
});
if (byName) {
  check(!byName.querySelector('.tag.hit'),
    'a title match shows no tag, the title already explains it', text(byName));
} else {
  check(true, `nothing else matched "${tagOnly.tag}" by name, so there is no title case to check`);
}

/* ---------- 4. adding a song ---------- */

/* One song out of the library carries the rest of this section: it is added, it
   becomes the anchor, and everything about Camelot matching is measured against
   it. Its key and Camelot value are read from songs.tsv rather than written in
   here, because the library is edited constantly and a key that changes there
   should not look like the app breaking. */
const ANCHOR = (() => {
  const row = songsTsv.split(/\r\n|\n|\r/).slice(1)
    .map((line) => line.split('\t'))
    .filter((c) => c[0] && (c[4] || c[2]))
    .find((c) => c[0] === 'What An Awesome God')
    ?? songsTsv.split(/\r\n|\n|\r/).slice(1).map((l) => l.split('\t')).find((c) => c[0] && c[2]);
  const cam = (row[4] || '').trim() || camelotForKey(row[2]);
  const at = parseCamelot(cam);
  return {
    title: row[0],
    cam,
    key: keyForCamelot(cam),
    letter: at.l,
    hue: String((at.n - 1) * 30),
    // the cell itself, one step either way, and the relative on the other side
    neighbours: [cam, camelotStr(shift(at, 7)), camelotStr(shift(at, -7)),
      at.n + (at.l === 'A' ? 'B' : 'A')],
  };
})();
check(!!ANCHOR.cam && !!ANCHOR.key, 'the library gives a song to anchor the search on',
  `${ANCHOR.title} in ${ANCHOR.key} at ${ANCHOR.cam}`);

// Search by the title, and press the result for it. A single word is no longer
// enough: "awesome" also matches a tag on another song.
type(q, ANCHOR.title);
click($$('.result').find((r) => text(r.querySelector('.r-title')) === ANCHOR.title)
  .querySelector('.result-btn'));
check(songsIn(0).length === 1, 'song added to Opening');
check(text(songsIn(0)[0].querySelector('.song-title')) === ANCHOR.title, 'right song added',
  text(songsIn(0)[0].querySelector('.song-title')));
check(text(songsIn(0)[0].querySelector('.song-meta')).includes(ANCHOR.key), 'key shown',
  `${text(songsIn(0)[0].querySelector('.song-meta'))} should hold ${ANCHOR.key}`);
check(text(songsIn(0)[0].querySelector('.cam')) === ANCHOR.cam, 'Camelot badge shown',
  text(songsIn(0)[0].querySelector('.cam')));
check(songsIn(0)[0].querySelector('.cam').classList.contains(ANCHOR.letter),
  `a ${ANCHOR.letter === 'B' ? 'major' : 'minor'} key gets the ${ANCHOR.letter} badge`);
check(songsIn(0)[0].querySelector('.cam').style.getPropertyValue('--h') === ANCHOR.hue,
  `${ANCHOR.cam} hue is (n-1)*30`,
  songsIn(0)[0].querySelector('.cam').style.getPropertyValue('--h'));
check(!!$('.search-panel'), 'panel stays open for the next add');
check(text($('.anchor')).includes(ANCHOR.title), 'anchor now shows the song above');
check(!$('[data-act="s-compat"]').disabled, 'Camelot match is now enabled');
check(!$('#btn-undo').disabled, 'undo became available');
check(text($('#summary')).includes('1 song'), 'header summary counts it', text($('#summary')));
check($$('#summary .cam').length === 1, 'and shows its key badge');

/* ---------- 5. Camelot matching ---------- */

type(q, '');
click($('[data-act="s-compat"]'));
check(!!$('.s-semi'), 'the semitone box appears with Camelot match on');
check(text($('.match')).includes(ANCHOR.cam), 'the button lists the codes that fit',
  text($('.match')));
const camAll = $$('.result .r-title').map(text);
check(camAll.length > 0 && camAll.length < TOTAL, 'Camelot match narrows the list',
  `${camAll.length} of ${TOTAL}`);
check($$('.result .cam').every((c) => ANCHOR.neighbours.includes(text(c))),
  `only ${ANCHOR.cam} and its neighbours are offered at 0 semitones`,
  `${$$('.result .cam').map(text).join(' ')} against ${ANCHOR.neighbours.join(' ')}`);
check(shiftChips().length === 0, 'no transposed rows while the limit is 0');
check(text($('.rcount')).includes('that fit'), 'count line says these fit', text($('.rcount')));

type($('.s-semi'), '2');
check($$('.result .r-title').length > camAll.length, 'raising the limit offers more songs',
  `${camAll.length} -> ${$$('.result .r-title').length}`);
check(shiftChips().length > 0, 'transposed rows are chipped with the shift');
const shiftText = text(shiftChips()[0]);
check(/[+-]\d\s*\u2192\s*\d{1,2}[AB]/.test(shiftText), 'chip names the shift and the result', shiftText);

/* ---------- 6. a transposed add keeps the transpose ---------- */

const shiftRow = $$('.result').find((r) => text(r).includes('\u2192'));
const shiftedTitle = text(shiftRow.querySelector('.r-title'));

// the row has to say what the key becomes, and what it was
const rowChips = [...shiftRow.querySelectorAll('.chip')].map(text);
check(!!shiftRow.querySelector('.chip.changed'), 'the new key is marked as changed',
  rowChips.join(' | '));
check(!!shiftRow.querySelector('.chip.orig'), 'and the original sits beside it',
  rowChips.join(' | '));
const origChip = text(shiftRow.querySelector('.chip.orig'));
check(/^- orig [^,]+, \d{1,2}[AB], \d+ BPM$/.test(origChip),
  'the original reads the same as a set list row: - orig KEY, CAMELOT, N BPM', origChip);
const newKeyChip = text(shiftRow.querySelector('.chip.changed'));
check(newKeyChip !== origChip.replace('- orig ', '').split(',')[0],
  'and the new key is not the old one', `${newKeyChip} vs ${origChip}`);
check(shiftRow.querySelector('.cam').classList.contains('changed'),
  'the badge shows the Camelot it becomes');
check(text(shiftRow.querySelector('.cam')) !== origChip.split(', ')[1],
  'which differs from the original Camelot',
  `${text(shiftRow.querySelector('.cam'))} vs ${origChip}`);
check(origChip.split(', ').length === 3, 'three parts, split by commas', origChip);

const exactRow = $$('.result').find((r) => !text(r).includes('\u2192'));
check(exactRow && !exactRow.querySelector('.chip.orig'),
  'a song that needs no transpose shows no original', text(exactRow));
click(shiftRow.querySelector('.result-btn'));
const added = songsIn(0)[1];
check(text(added.querySelector('.song-title')) === shiftedTitle, 'transposed song added', shiftedTitle);
check(!!added.querySelector('.song-meta .changed'), 'the changed key is marked');
check(added.querySelector('.cam').classList.contains('changed'), 'and so is the Camelot badge');
check(text(added.querySelector('.chip.orig')).startsWith('- orig'),
  'the original reads with a leading hyphen', text(added.querySelector('.chip.orig')));
/* The "- orig ..." text is long, and the row it sits in used to hold the chips
   and the buttons as one wrapping list, so the buttons went to the next line
   first, being last. They are grouped now: the chips wrap among themselves and
   the buttons cannot be pushed anywhere. jsdom measures nothing, so what is
   checked is the arrangement that makes the wrapping come out that way. */
const meta = added.querySelector('.song-meta');
const chipBox = meta.querySelector('.meta-chips');
const actBox = meta.querySelector('.song-acts');
check(!!chipBox && !!actBox, 'the meta row keeps its chips and its buttons in separate groups');
check(chipBox.contains(added.querySelector('.chip.orig')),
  'the original key text sits with the chips');
check(actBox.querySelectorAll('button').length >= 3,
  'and every button sits in the other group',
  String(actBox.querySelectorAll('button').length));
check(!meta.querySelector(':scope > button'),
  'no button is left loose in the row, where it would wrap before the text does');

const chipStyle = window.getComputedStyle(chipBox);
const actStyle = window.getComputedStyle(actBox);
check(chipStyle.flexWrap === 'wrap', 'the chips are the part allowed to wrap', chipStyle.flexWrap);
check(chipStyle.flexGrow === '1' && parseInt(chipStyle.minWidth, 10) === 0,
  'they take the space left over, and may shrink to nothing',
  `grow ${chipStyle.flexGrow}, min-width ${chipStyle.minWidth}`);
check(actStyle.flexShrink === '0',
  'while the buttons never give up any width, so they stay on the first line',
  actStyle.flexShrink);

check(/^- orig [^,]+, \d{1,2}[AB](, \d+ BPM)?$/.test(text(added.querySelector('.chip.orig'))),
  'with a comma between the key and the Camelot',
  text(added.querySelector('.chip.orig')));
check(!added.querySelector('.clash'), 'a Camelot matched song raises no clash warning');

/* ---------- 7. clash warning ---------- */

click($('[data-act="s-close"]'));
click(addBtn(0));
type($('.s-q'), 'praise');
const clashRow = $$('.result').find((r) => text(r).includes('Brandon Lake'));
click(clashRow.querySelector('.result-btn'));
check(songsIn(0).length === 3, 'third song added');
check(!!songsIn(0)[2].querySelector('.clash'), 'incompatible song below shows a clash warning',
  text(songsIn(0)[2]));
check(text(songsIn(0)[2].querySelector('.clash')).includes('Key clash'), 'warning names the problem');
check($$('#summary .cam.clashed').length === 1, 'the header path flags the same clash',
  String($$('#summary .cam.clashed').length));

/* ---------- 8. editor: transpose and BPM ---------- */

click($('[data-act="s-close"]'));
click(songsIn(0)[0].querySelector('[data-act="edit-song"]'));
check(!!$('.editor'), 'pencil opens the editor');
check(text($('.ed-val')) === '0', 'transpose starts at 0');
click($('[data-act="t-up"]'));
click($('[data-act="t-up"]'));
check(text($('.ed-val')) === '+2', 'transpose stepper works', text($('.ed-val')));
check(text($('.editor')).includes('B maj'), 'A maj +2 becomes B maj', text($('.editor .ed-row')));
check(text($('.editor .cam')) === '1B', 'and Camelot follows to 1B', text($('.editor .cam')));
check(text($('.editor')).includes('- orig A maj, 11B'),
  'editor keeps the original on screen, with a comma', text($('.editor')));

const bpm = $('.ed-bpm');
bpm.value = '132';
bpm.dispatchEvent(new window.Event('change', { bubbles: true }));
check(text(songsIn(0)[0].querySelector('.song-meta')).includes('132 BPM'), 'BPM override applied',
  text(songsIn(0)[0].querySelector('.song-meta')));
check(text(songsIn(0)[0].querySelector('.chip.orig')).includes('148 BPM'), 'original BPM still shown',
  text(songsIn(0)[0].querySelector('.chip.orig')));
check(/^- orig [^,]+, \d{1,2}[AB], \d+ BPM$/.test(text(songsIn(0)[0].querySelector('.chip.orig'))),
  'reading: - orig KEY, CAMELOT, N BPM',
  text(songsIn(0)[0].querySelector('.chip.orig')));

check($('[data-act="ed-reset"]').classList.contains('outline')
  && $('[data-act="ed-swap"]').classList.contains('outline'),
  'Reset and Replace are outlined buttons, quieter than Done');
check($('[data-act="ed-done"]').classList.contains('btn')
  && !$('[data-act="ed-done"]').classList.contains('outline'),
  'and Done stays filled');
click($('[data-act="ed-reset"]'));
check(text($('.ed-val')) === '0' && $('.ed-bpm').value === '', 'reset clears both overrides');
check(!songsIn(0)[0].querySelector('.chip.orig'), 'and the original note disappears');

/* ---------- 9. taps and keyboard ---------- */

click($('[data-act="ed-done"]'));
check(!$('.editor'), 'Done closes the editor');
const title2 = songsIn(0)[0].querySelector('[data-act="tap-song"]');
click(title2, 1);
check(!$('.editor'), 'a single tap does nothing');
click(title2, 2);
check(!!$('.editor'), 'a double tap opens the editor');
click($('[data-act="ed-done"]'));

const title3 = songsIn(0)[0].querySelector('[data-act="tap-song"]');
arrow(title3, 'Enter');
check(!!$('.editor'), 'Enter on a song title opens the editor with one press');
click($('[data-act="ed-done"]'));

arrow(groups()[0].querySelector('[data-act="tap-group"]'), 'Enter');
check(!!$('.rename'), 'Enter on a group name opens the rename box with one press');
arrow($('.rename'), 'Escape');
check(!$('.rename'), 'Escape cancels the rename');

/* ---------- 10. tags and links on a set list row ---------- */

check(!songsIn(0)[0].querySelector('.linkbtn'), 'no links button when a song has no urls');

click(addBtn(2));
type($('.s-q'), '10,000');
click($('.result-btn'));
const tagged = songsIn(2)[0];
check(!!tagged.querySelector('.tags .tag'), 'a song with tags shows the tag strip',
  text(tagged.querySelector('.tags')));
check(!!tagged.querySelector('.linkbtn'), 'and a song with urls shows a links button');
check(tagged.querySelector('.linkbtn').getAttribute('aria-expanded') === 'false',
  'closed to start with');
click(tagged.querySelector('.linkbtn'));
check(!!songsIn(2)[0].querySelector('.urls a'), 'the links open on the row');
check(songsIn(2)[0].querySelector('.linkbtn').getAttribute('aria-expanded') === 'true',
  'and it reports itself open');
click(songsIn(2)[0].querySelector('.linkbtn'));
check(!songsIn(2)[0].querySelector('.urls'), 'and close again');
click($('[data-act="s-close"]'));
click(songsIn(2)[0].querySelector('[data-act="del-song"]'));
await wait();
$('#confirm').close('ok');
await wait();
check(songsIn(2).length === 0, 'tidied away again');

/* ---------- 11. replace a song ---------- */

click(songsIn(0)[0].querySelector('[data-act="edit-song"]'));
click($('[data-act="ed-swap"]'));
check(!!$('.editor .search-panel'), 'Replace opens a search panel inside the editor');
type($('.editor .s-q'), 'yeshua');
click($('.editor .result-btn'));
check(text(songsIn(0)[0].querySelector('.song-title')) === 'Yeshua', 'song replaced in place');
check(songsIn(0).length === 3, 'replacing does not change the count');

/* ---------- 12. rename a group ---------- */

click(groups()[0].querySelector('[data-act="rename-group"]'));
check(!!$('.rename'), 'pencil turns the heading into a text box');
$('.rename').value = 'Gathering';
$('.rename').dispatchEvent(new window.Event('focusout', { bubbles: true }));
check(names()[0] === 'Gathering', 'group renamed', names()[0]);

/* ---------- 13. add a group with the form ---------- */

click($('[data-act="add-group-open"]'));
check(!!$('#gname'), 'Add group opens a named form, not a blank group');
check($$('.sugg button').length > 0, 'and offers some ready made names');
click($$('.sugg button').find((b) => text(b) === 'Closing'));
check($('#gname').value === 'Closing', 'a suggestion fills the box');
click($('[data-act="add-group-create"]'));
check(names().join(',') === 'Gathering,Joyful,Solemn,Closing', 'group created at the end', names().join(','));
check(!$('#gname'), 'the form closes after creating');

click($('[data-act="add-group-open"]'));
click($('[data-act="add-group-create"]'));
check(groups().length === 4, 'an empty name creates nothing');
click($('[data-act="add-group-cancel"]'));
check(!$('#gname'), 'Cancel closes the form');

/* ---------- 14. collapse ---------- */

const shown = window.getComputedStyle(groups()[1].querySelector('.gbody')).display;
click(groups()[1].querySelector('[data-act="collapse"]'));
check(groups()[1].classList.contains('collapsed'), 'a group can be folded away');
check(window.getComputedStyle(groups()[1].querySelector('.gbody')).display === 'none',
  'and its body really is hidden by the stylesheet',
  window.getComputedStyle(groups()[1].querySelector('.gbody')).display);
check(groups()[1].querySelector('[data-act="collapse"]').getAttribute('aria-expanded') === 'false',
  'and says so to a screen reader');
click(groups()[1].querySelector('[data-act="collapse"]'));
check(!groups()[1].classList.contains('collapsed'), 'and unfolded again');
check(window.getComputedStyle(groups()[1].querySelector('.gbody')).display === shown,
  'with its body back');

/* ---------- 15. keyboard reorder ---------- */

const handle = groups()[3].querySelector('.handle');
arrow(handle, 'ArrowUp');
check(names().join(',') === 'Gathering,Joyful,Closing,Solemn', 'arrow key moves a group up',
  names().join(','));

const topTitle = text(songsIn(0)[0].querySelector('.song-title'));
arrow(songsIn(0)[0].querySelector('.handle'), 'ArrowUp');
check(songsIn(0).length === 3, 'arrow up on the very first song does nothing');

arrow(songsIn(0)[0].querySelector('.handle'), 'ArrowDown');
check(text(songsIn(0)[1].querySelector('.song-title')) === topTitle,
  'arrow down moves a song one place down inside its group');

const last = songsIn(0).at(-1);
const movedTitle = text(last.querySelector('.song-title'));
arrow(last.querySelector('.handle'), 'ArrowDown');
check(songsIn(0).length === 2, 'song left the first group');
check(songsIn(1).length === 1, 'song crossed into the next group');
check(text(songsIn(1)[0].querySelector('.song-title')) === movedTitle, 'and it is the one that moved',
  movedTitle);
arrow(songsIn(1)[0].querySelector('.song .handle') ?? songsIn(1)[0].querySelector('.handle'), 'ArrowUp');
check(songsIn(0).length === 3, 'arrow up brings it back');

/* ---------- 16. hold to drag ---------- */

const row = songsIn(0)[0].querySelector('.song-main');
pointer(row, 'pointerdown', 200, 300);
await wait(60);
check(!songsIn(0)[0].classList.contains('dragging'), 'a short hold does not pick the row up');
pointer(row, 'pointerup', 200, 300);

pointer(row, 'pointerdown', 200, 300);
await wait(450);
check(songsIn(0)[0].classList.contains('dragging'), 'holding a row picks it up for dragging');
pointer(row, 'pointerup', 200, 300);
await wait(10);
check(!$('.song.dragging'), 'and letting go puts it down');

const ghead = groups()[0].querySelector('.ghead');
pointer(ghead, 'pointerdown', 200, 120);
await wait(450);
check(groups()[0].classList.contains('dragging'), 'holding a group header picks the group up');
pointer(ghead, 'pointerup', 200, 120);
await wait(10);

/* ---------- 17. swipe sideways to delete ---------- */

const swipeRow = songsIn(0)[0].querySelector('.song-main');
const wrap = songsIn(0)[0].querySelector('.swipe-wrap');
check(!!wrap && !!wrap.querySelector('.swipe-back'), 'every row has a red bar waiting behind it');
check(wrap.querySelectorAll('.swipe-back .sb').length === 2,
  'with a delete mark at each end, for either swipe direction');
check(wrap.querySelector('.swipe-back .sb svg') !== null, 'and the mark is the bin icon');
check(!!groups()[0].querySelector('.ghead').closest('.swipe-wrap'),
  'group headers get the same bar');

pointer(swipeRow, 'pointerdown', 200, 300);
pointer(swipeRow, 'pointermove', 200, 340); // mostly vertical: treated as a page scroll
pointer(swipeRow, 'pointermove', 120, 340);
pointer(swipeRow, 'pointerup', 120, 340);
await wait();
check(!$('#confirm').open, 'a vertical drag scrolls instead of arming a delete');
check(!wrap.classList.contains('swiping'), 'and the red bar never shows');

pointer(swipeRow, 'pointerdown', 200, 300);
check(window.getComputedStyle(wrap.querySelector('.swipe-back')).opacity === '0',
  'the red bar is invisible at rest',
  window.getComputedStyle(wrap.querySelector('.swipe-back')).opacity);
pointer(swipeRow, 'pointermove', 170, 302);
check(wrap.classList.contains('swiping'), 'a sideways swipe reveals the red bar at once');
check(window.getComputedStyle(wrap.querySelector('.swipe-back')).opacity === '1',
  'and the stylesheet really shows it',
  window.getComputedStyle(wrap.querySelector('.swipe-back')).opacity);
check(!wrap.classList.contains('armed'), 'a short swipe is not armed yet');
check(swipeRow.style.transform.includes('translateX'), 'the row follows the finger');
pointer(swipeRow, 'pointermove', 100, 302);
check(wrap.classList.contains('armed'), 'past the threshold the bar goes bright');
pointer(swipeRow, 'pointerup', 100, 302);
await wait();
check($('#confirm').open, 'a full swipe asks before deleting');
check(swipeRow.style.transform === '', 'the row springs back');
check(!wrap.classList.contains('swiping') && !wrap.classList.contains('armed'),
  'and the red bar is put away');
$('#confirm').close('cancel');
await wait();

// the other direction works too
pointer(swipeRow, 'pointerdown', 100, 300);
pointer(swipeRow, 'pointermove', 200, 302);
check(wrap.classList.contains('armed'), 'a swipe to the right arms as well');
pointer(swipeRow, 'pointerup', 200, 302);
await wait();
check($('#confirm').open, 'and asks before deleting');
$('#confirm').close('cancel');
await wait();

pointer(swipeRow, 'pointerdown', 200, 300);
await wait(450);
check(!wrap.classList.contains('armed'), 'a hold does not leave the row armed for deletion');
pointer(swipeRow, 'pointerup', 200, 300);
await wait();
check(!$('#confirm').open, 'and a hold never asks to delete');

/* ---------- 17b. adding a song that is not in the library ---------- */

click(addBtn(2));
check(!!$('[data-act="ns-open"]'), 'the search panel offers a hand add');
check(text($('[data-act="ns-open"]')).includes('Not in the list'),
  'worded for the moment you notice it is missing', text($('[data-act="ns-open"]')));

type($('.s-q'), 'Zzz Not In The Library');
check($$('.result').length === 0, 'nothing in the library matches');
click($('[data-act="ns-open"]'));

check(!!$('.newsong'), 'the hand add form opens');
check(!$('.search-panel'), 'in place of the search panel, not alongside it');
check($('#ns-title').value === 'Zzz Not In The Library',
  'the search words become the title', $('#ns-title').value);
check(!$('[data-act="ed-reset"]') && !$('[data-act="ed-swap"]'),
  'no Reset and no Replace song, they make no sense for a new song');
check(!!$('[data-act="ns-cancel"]'), 'a Cancel button instead');
check(!$('[data-act="ns-add"]').disabled, 'Add is ready as soon as there is a title');
type($('#ns-title'), '');
check($('[data-act="ns-add"]').disabled, 'and off again without one');
type($('#ns-title'), 'Zzz Not In The Library');

type($('#ns-artist'), 'Hillsong Worship');
check(!$('[data-act="ns-add"]').disabled, 'the artist is optional');

check(text($('.ns-derived')).includes('no key'), 'no key chosen means no Camelot matching',
  text($('.ns-derived')));
check($('#ns-mode').disabled, 'and the major or minor choice waits for a note');

const tonic = $('#ns-tonic');
check([...tonic.options].map((o) => o.value).filter(Boolean).length === 12,
  'twelve notes to pick from', String(tonic.options.length));
tonic.value = 'D';
tonic.dispatchEvent(new window.Event('change', { bubbles: true }));
check(!$('#ns-mode').disabled, 'picking a note enables major or minor');
check(text($('.ns-derived')).includes('D maj'), 'D major reads back', text($('.ns-derived')));
check(text($('.ns-derived .cam')) === '10B', 'and its Camelot is worked out',
  text($('.ns-derived .cam')));

$('#ns-mode').value = 'minor';
$('#ns-mode').dispatchEvent(new window.Event('change', { bubbles: true }));
check(text($('.ns-derived .cam')) === '7A', 'D minor gives 7A', text($('.ns-derived .cam')));
$('#ns-mode').value = 'major';
$('#ns-mode').dispatchEvent(new window.Event('change', { bubbles: true }));

type($('#ns-bpm'), '68');
click($('[data-act="ns-add"]'));

const hand = songsIn(2)[0];
check(!!hand, 'the song joins the group');
check(text(hand.querySelector('.song-title')) === 'Zzz Not In The Library', 'with its title',
  text(hand.querySelector('.song-title')));
check(text(hand.querySelector('.artist')) === 'Hillsong Worship', 'and artist');
check(text(hand.querySelector('.song-meta')).includes('D maj'), 'and key',
  text(hand.querySelector('.song-meta')));
check(text(hand.querySelector('.song-meta')).includes('68 BPM'), 'and BPM');
check(text(hand.querySelector('.cam')) === '10B', 'and Camelot badge');
check(!!hand.querySelector('.chip.byhand'), 'marked as typed by hand',
  text(hand.querySelector('.song-meta')));
check(!$('.newsong'), 'the form closes');
check(!!$('.search-panel'), 'and the search panel comes back');
check($('.s-q').value === '', 'with an empty search box');

// it must behave like any other row from here on
click($('[data-act="s-close"]'));
check($$('.browse').length === 0, 'no library panel left open');
click($('#btn-browse'));
check(!$$('.browse .libitem').some((r) => text(r).includes('Zzz Not In')),
  'a hand typed song does not appear in the library, it is not in songs.tsv');
click($('#btn-browse'));

// re-query: every render since the add replaced the nodes
click(songsIn(2)[0].querySelector('[data-act="edit-song"]'));
check(!!$('.editor'), 'the normal editor opens on it');
click($('[data-act="t-up"]'));
check(text($('.ed-val')) === '+1', 'it can be transposed like any song');
check(text($('.editor .cam')) === '5B', 'D maj up one is Eb maj 5B', text($('.editor .cam')));
check(text($('.editor')).includes('- orig D maj, 10B'), 'with its own original kept');
click($('[data-act="ed-reset"]'));
click($('[data-act="ed-done"]'));

// and it must survive a share link
click($('[data-share="url"]'));
await wait();
const handLink = clipboard;
click($('[data-share="full"]'));
await wait();
check(clipboard.includes('Zzz Not In The Library - Hillsong Worship - D maj'),
  'it copies out like any other song', clipboard);

click(groups()[2].querySelectorAll('.song')[0].querySelector('[data-act="del-song"]'));
await wait();
$('#confirm').close('ok');
await wait();
check(songsIn(2).length === 0, 'and it can be deleted');

window.location.hash = handLink.split('#')[1];
window.dispatchEvent(new window.Event('hashchange'));
await wait(30);
const back = $$('.song').find((r) => text(r).includes('Zzz Not In The Library'));
check(!!back, 'a share link brings the hand typed song back');
check(text(back.querySelector('.song-meta')).includes('D maj'), 'with its key',
  text(back?.querySelector('.song-meta')));
check(text(back.querySelector('.cam')) === '10B', 'and its Camelot');
check(text(back.querySelector('.song-meta')).includes('68 BPM'), 'and its BPM');
check(!!back.querySelector('.chip.byhand'), 'still marked as typed by hand');
click($('#btn-undo'));

/* ---------- 17c. a hand typed song with no artist ---------- */

click(addBtn(2));
click($('[data-act="ns-open"]'));
type($('#ns-title'), 'Offertory Instrumental');
check(!$('[data-act="ns-add"]').disabled, 'a title alone is enough');
click($('[data-act="ns-add"]'));

const anon = songsIn(2).find((r) => text(r).includes('Offertory'));
check(!!anon, 'the song is added with no artist');
check(!anon.querySelector('.artist'),
  'and the row leaves the artist line out rather than showing a blank one',
  anon.outerHTML.slice(0, 200));

click($('[data-act="s-close"]'));
click($('[data-share="full"]'));
await wait();
const anonLine = clipboard.split('\n').find((l) => l.includes('Offertory'));
check(anonLine === 'Offertory Instrumental - --', 'it copies as Title - Key, with no empty middle',
  JSON.stringify(anonLine));
check(!anonLine.includes(' -  - '), 'never two separators in a row', JSON.stringify(anonLine));

click(songsIn(2).find((r) => text(r).includes('Offertory')).querySelector('[data-act="del-song"]'));
await wait();
$('#confirm').close('ok');
await wait();

/* ---------- 17d. giving a hand typed song its key later ---------- */

click(addBtn(2));
click($('[data-act="ns-open"]'));
type($('#ns-title'), 'Quiet Reflection');
click($('[data-act="ns-add"]'));
click($('[data-act="s-close"]'));

let keyless = songsIn(2).find((r) => text(r).includes('Quiet Reflection'));
check(keyless.querySelector('.cam').classList.contains('none'),
  'it starts with no key at all', keyless.querySelector('.cam').className);

click(keyless.querySelector('[data-act="edit-song"]'));
check(!!$('[data-act="ek-tonic"]'), 'its editor offers a key picker');
check($('[data-act="t-up"]').disabled,
  'and the transpose stepper is off, there is no key to step from');
check(text($('.editor')).includes('set a key'), 'the row says what is missing',
  text($('.editor')));
check($('[data-act="ek-mode"]').disabled, 'major or minor waits for a note');

const tonicSel = $('[data-act="ek-tonic"]');
tonicSel.value = 'D';
tonicSel.dispatchEvent(new window.Event('change', { bubbles: true }));

keyless = songsIn(2).find((r) => text(r).includes('Quiet Reflection'));
check(text(keyless.querySelector('.song-meta')).includes('D maj'), 'the key takes effect',
  text(keyless.querySelector('.song-meta')));
check(text(keyless.querySelector('.cam')) === '10B', 'and the Camelot follows',
  text(keyless.querySelector('.cam')));
check(!$('[data-act="t-up"]').disabled, 'now it can be transposed too');
check(text($('#status')).includes('D maj'), 'and it says so', text($('#status')));

// a transpose counted from the old key must not survive a key change
click($('[data-act="t-up"]'));
check(text($('.ed-val')) === '+1', 'transposed by one');
const modeSel = $('[data-act="ek-mode"]');
modeSel.value = 'minor';
modeSel.dispatchEvent(new window.Event('change', { bubbles: true }));
check(text($('.ed-val')) === '0', 'changing the key clears the old transpose');
keyless = songsIn(2).find((r) => text(r).includes('Quiet Reflection'));
check(text(keyless.querySelector('.cam')) === '7A', 'D minor is 7A',
  text(keyless.querySelector('.cam')));

// enharmonics must come back as the same option, not as a blank
const tonic2 = $('[data-act="ek-tonic"]');
tonic2.value = 'Ab';
tonic2.dispatchEvent(new window.Event('change', { bubbles: true }));
keyless = songsIn(2).find((r) => text(r).includes('Quiet Reflection'));
check(text(keyless.querySelector('.song-meta')).includes('G# min'),
  'Ab minor is stored in its canonical spelling, G# min',
  text(keyless.querySelector('.song-meta')));
check($('[data-act="ek-tonic"]').value === 'Ab',
  'and the picker still shows Ab, matched by pitch not by spelling',
  $('[data-act="ek-tonic"]').value);

// and the key can be taken away again
const tonic3 = $('[data-act="ek-tonic"]');
tonic3.value = '';
tonic3.dispatchEvent(new window.Event('change', { bubbles: true }));
keyless = songsIn(2).find((r) => text(r).includes('Quiet Reflection'));
check(keyless.querySelector('.cam').classList.contains('none'), 'the key can be cleared',
  keyless.querySelector('.cam').className);

click($('[data-act="ed-done"]'));
click(songsIn(2).find((r) => text(r).includes('Quiet Reflection'))
  .querySelector('[data-act="del-song"]'));
await wait();
$('#confirm').close('ok');
await wait();

// a library song keeps songs.json as its source of truth
click(songsIn(0)[0].querySelector('[data-act="edit-song"]'));
check(!$('[data-act="ek-tonic"]'),
  'a library song offers no key picker, songs.json stays the source of truth');
check(!!$('[data-act="t-up"]'), 'it is transposed instead');
click($('[data-act="ed-done"]'));

/* ---------- 17e. putting a song between others, and at the top ---------- */

// build a known run in an empty group
const G = 2;
for (const word of ['yeshua', 'washed']) {
  click(addBtn(G));
  type($('.s-q'), word);
  click($('.result-btn'));
  click($('[data-act="s-close"]'));
}
const titlesIn = (i) => songsIn(i).map((r) => text(r.querySelector('.song-title')));
check(titlesIn(G).length === 2, 'two songs to work with', titlesIn(G).join(' | '));
const [first, second] = titlesIn(G);

check(gaps(G).length === 2, 'a gap above each song, and none after the last',
  String(gaps(G).length));
check(!!addBtn(G), 'the loud Add song button is still at the end');
check(text(gaps(G)[0]).includes('Add song here'), 'the gap names itself', text(gaps(G)[0]));

// one separator between two rows, not a border and a hairline side by side
const rowBorder = window.getComputedStyle(songsIn(G)[1].querySelector('.song-main')).borderTopStyle;
check(rowBorder === 'none' || rowBorder === '', 'a song row draws no line of its own', rowBorder);
check(gaps(G)[0].getAttribute('aria-label').includes('at the top'),
  'the first gap says it goes to the top', gaps(G)[0].getAttribute('aria-label'));
check(gaps(G)[1].getAttribute('aria-label').includes(first),
  'and the next one names the song it follows', gaps(G)[1].getAttribute('aria-label'));

// between the two
click(gaps(G)[1]);
check(!!$('.search-panel'), 'the gap opens the search panel');
check($('.search-panel').closest('.group') === groups()[G], 'inside the right group');
check(text($('.anchor')).includes(first), 'Plays after names the song above the gap',
  text($('.anchor')));
type($('.s-q'), 'araw');
click($('.result-btn'));
check(titlesIn(G).length === 3, 'a third song is in');
check(titlesIn(G)[0] === first && titlesIn(G)[2] === second,
  'the two originals still bracket it', titlesIn(G).join(' | '));
const inserted = titlesIn(G)[1];
check(inserted !== first && inserted !== second, 'and the new one landed in the middle',
  titlesIn(G).join(' | '));

// a run of adds keeps going downward from where it started
type($('.s-q'), 'goodbye');
click($('.result-btn'));
check(titlesIn(G).length === 4, 'a second insert in the same run');
check(titlesIn(G)[1] === inserted, 'the first insert stays put', titlesIn(G).join(' | '));
check(titlesIn(G)[3] === second, 'and the run went in order, not in reverse',
  titlesIn(G).join(' | '));
click($('[data-act="s-close"]'));

// the top of the group
click(gaps(G)[0]);
check(text($('.anchor')).includes('top of'), 'the top gap says there is no key to match',
  text($('.anchor')));
check($('[data-act="s-compat"]').disabled, 'so Camelot match is off there');
type($('.s-q'), 'praise elevation');
click($('.result-btn'));
check(titlesIn(G).length === 5, 'a fifth song');
check(titlesIn(G)[0] === 'Praise', 'it went to the very top', titlesIn(G).join(' | '));
check(titlesIn(G)[1] === first, 'pushing the old first song down');
click($('[data-act="s-close"]'));

// a song typed by hand honours the position too
click(gaps(G)[1]);
click($('[data-act="ns-open"]'));
type($('#ns-title'), 'Zzz Inserted By Hand');
click($('[data-act="ns-add"]'));
check(titlesIn(G)[1] === 'Zzz Inserted By Hand', 'a hand typed song lands at the gap it came from',
  titlesIn(G).join(' | '));
click($('[data-act="s-close"]'));

// deleting from under an open panel must not strand it
click(gaps(G).at(-1));
check(!!$('.search-panel'), 'panel open at the last gap');
const beforeCount = songsIn(G).length;
click(songsIn(G)[0].querySelector('[data-act="del-song"]'));
await wait();
$('#confirm').close('ok');
await wait();
check(songsIn(G).length === beforeCount - 1, 'a song is removed while the panel is open');
check(!!$('.search-panel'), 'and the panel is still on the page, not lost');
click($('[data-act="s-close"]'));

// gaps get out of the way of a drag
const dragRow = songsIn(G)[0].querySelector('.song-main');
pointer(dragRow, 'pointerdown', 200, 300);
await wait(450);
check(window.getComputedStyle(groups()[G].querySelector('.gap')).display === 'none',
  'the gaps hide while a row is being dragged',
  window.getComputedStyle(groups()[G].querySelector('.gap')).display);
// the row itself follows the pointer. jsdom reports every rectangle as zero, so
// only the shape of the move can be checked here, not where it lands.
const dragged = dragRow.closest('.song');
pointer(dragRow, 'pointermove', 200, 340);
check(/^translateY\(-?\d+px\)$/.test(dragged.style.transform),
  'the held row is moved by a vertical transform, with no sideways part',
  `"${dragged.style.transform}"`);
// the outline marking the landing place is drawn by a pseudo element, which
// jsdom cannot report a style for, so what is checked is the number driving it
const slotBack = dragged.style.getPropertyValue('--slot-back');
const lifted = window.getComputedStyle(dragged.firstElementChild);
check(lifted.zIndex === '1' && lifted.position === 'relative',
  'the row content rides above the landing outline, so the words stay readable',
  `${lifted.position} ${lifted.zIndex}`);
check(slotBack === `${-parseInt(dragged.style.transform.match(/-?\d+/)[0], 10)}px`,
  'the landing outline is pushed back by exactly what the row was moved by',
  `${dragged.style.transform} against ${slotBack}`);

// carrying a row to another group takes it outside its own card
const card = dragged.closest('.group');
const cs = (el) => window.getComputedStyle(el);
check(cs(card).overflow === 'visible', 'the card stops clipping while a drag is live',
  cs(card).overflow);
check(Number(cs(dragged).zIndex) < Number(cs($('.top')).zIndex),
  'and the carried row stays under the sticky top bar',
  `${cs(dragged).zIndex} against ${cs($('.top')).zIndex}`);

// A real layout drops the row where the pointer is. Every jsdom rectangle is
// zero, so a move to the top of the page falls through to the end of a list,
// which is the case that used to leave the row below the Add song button.
pointer(dragRow, 'pointermove', 200, 0);
const holding = dragged.closest('.songs');
check(holding.lastElementChild.classList.contains('slot'),
  'a row dragged to the end goes in front of the Add song button, not after it',
  holding.lastElementChild.className);

pointer(dragRow, 'pointerup', 200, 300);
await wait();
check(dragged.style.transform === '', 'and is dropped back into the layout on release',
  `"${dragged.style.transform}"`);
check(!$('.dragging'),
  'and nothing is left marked as dragging, so neither the lift nor the outline applies');
check(dragged.style.getPropertyValue('--slot-back') === '',
  'and the landing outline is cleared with it',
  `"${dragged.style.getPropertyValue('--slot-back')}"`);
click($('#btn-undo')); // put the moved row back, so later sections see what they expect
check(window.getComputedStyle(groups()[G].querySelector('.gap')).display !== 'none',
  'and come back afterwards');
check(cs(card).overflow === 'hidden', 'and the card clips again once the drag is over',
  cs(card).overflow);

// tidy up
while (songsIn(G).length) {
  click(songsIn(G)[0].querySelector('[data-act="del-song"]'));
  await wait();
  $('#confirm').close('ok');
  await wait();
}
check(gaps(G).length === 0, 'an empty group shows no gaps at all', String(gaps(G).length));
check(!!addBtn(G), 'just the one Add song button');

/* ---------- 18. copy as text ---------- */

click($('[data-share="full"]'));
await wait();
const lines = clipboard.split('\n');
check(lines[0] === 'Gathering', 'first line is the group name', JSON.stringify(lines[0]));
check(/^.+ - .+ - .+$/.test(lines[1]), 'song line is Title - Artist - Key', JSON.stringify(lines[1]));
check(lines.includes(''), 'a blank line separates groups');
check(!clipboard.includes('Closing'), 'empty groups are skipped', clipboard);
console.log('--- copied text ---\n' + clipboard + '-------------------');

// the first choice leaves the artist out
click($('[data-share="plain"]'));
await wait();
const plain = clipboard.split('\n');
check(plain[0] === 'Gathering', 'the group name is still there', JSON.stringify(plain[0]));
check(/^[^-]+ - [^-]+$/.test(plain[1]), 'but a song line is only Title - Key',
  JSON.stringify(plain[1]));
check(lines[1].startsWith(plain[1].split(' - ')[0]) && lines[1] !== plain[1],
  'the same song, with the artist taken out',
  `${JSON.stringify(lines[1])} became ${JSON.stringify(plain[1])}`);

/* ---------- 18b. the Share menu ---------- */

const sheet = $('#share-menu');
// being a real dialog is what supplies the dimming, the focus trap, Escape and
// the top layer, so this is the check that matters most here
check(sheet.tagName === 'DIALOG', 'the choices live in a real dialog', sheet.tagName);
check(!sheet.open, 'which starts closed');
check($('#btn-share').getAttribute('aria-haspopup') === 'dialog',
  'and the button says that is what it opens',
  $('#btn-share').getAttribute('aria-haspopup'));
check(!!sheet.getAttribute('aria-labelledby'), 'the dialog is named for a screen reader');
const picks = $$('.share-picks [data-share]');
check(picks.map((p) => p.dataset.share).join(',') === 'plain,full,url',
  'three choices, plain text first and the link last',
  picks.map((p) => p.dataset.share).join(','));
check(picks.every((p) => text(p.querySelector('.sm-title')).length > 6),
  'each is named in full, none hidden behind the button',
  $$('.share-picks .sm-title').map(text).join(' | '));
check(/^copy/i.test(text(picks[0].querySelector('.sm-title')))
  && /^copy/i.test(text(picks[1].querySelector('.sm-title')))
  && /^share/i.test(text(picks[2].querySelector('.sm-title'))),
  'the two that put text on the clipboard say copy, and the link says share',
  $$('.share-picks .sm-title').map(text).join(' | '));
check($$('.share-picks .sm-note').every((n) => text(n).length > 10),
  'and each one says what it copies',
  $$('.share-picks .sm-note').map(text).join(' | '));
// the browser gives a button no border of its own, and the page reset takes the
// rest away, so each choice has to draw its own to read as a separate card
const pick = window.getComputedStyle($('.share-picks button'));
check(pick.borderTopWidth === '1px' && pick.borderTopStyle === 'solid',
  'each choice is outlined, so the three do not read as one block of text',
  `${pick.borderTopWidth} ${pick.borderTopStyle}`);
check(window.getComputedStyle($('.share-picks')).gap === '8px',
  'and they stand apart from each other',
  window.getComputedStyle($('.share-picks')).gap);

click($('#btn-share'));
check(sheet.open, 'the button opens it');

click($('[data-share-close]'));
check(!sheet.open, 'Cancel closes it');

// the dialog element itself is only the dimmed area around the card
click($('#btn-share'));
click(sheet);
check(!sheet.open, 'and so does the dimmed area around it');

click($('#btn-share'));
click($('[data-share="url"]'));
await wait();
check(!sheet.open, 'choosing an option closes it');
check(clipboard.includes('#'), 'and does what it says', clipboard.slice(0, 40));

/* ---------- 19. undo and redo ---------- */

let depth = 0;
while (!$('#btn-undo').disabled && depth < 80) { click($('#btn-undo')); depth += 1; }
check(names().join(',') === 'Opening,Joyful,Solemn', 'undoing everything returns to the defaults',
  names().join(','));
check($$('.song').length === 0, 'and to an empty set list');
check(!$('#btn-redo').disabled, 'redo is available after undoing');
while (!$('#btn-redo').disabled) click($('#btn-redo'));
check(names().join(',') === 'Gathering,Joyful,Closing,Solemn', 'redo returns to the newer state',
  names().join(','));

/* ---------- 20. share link ---------- */

click($('[data-share="url"]'));
await wait();
check(clipboard.includes('#'), 'share link has a hash', clipboard);
const hash = clipboard.split('#')[1];
check(hash.length > 10 && !/[+/=]/.test(hash), 'hash is url safe', hash);
const saved = window.localStorage.getItem('slb.state');
check(!!saved && JSON.parse(saved).groups.length === 4, 'set list saved to localStorage');

/* ---------- 20b. pasting that link back into the same tab ---------- */

const shareLink = clipboard;
const wanted = names().join(',');
const wantedSongs = $$('.song').length;
check(wantedSongs > 0, 'there is something to restore', String(wantedSongs));

// wreck the set list. Re-query each time, every delete redraws the page.
let guard = 0;
while (groups().length && guard < 10) {
  click(groups()[0].querySelector('[data-act="del-group"]'));
  await wait();
  $('#confirm').close('ok');
  await wait();
  guard += 1;
}
check($$('.song').length === 0 && groups().length === 0, 'set list emptied out');

// paste the link: only the hash changes, so the browser fires hashchange, no reload
window.location.hash = shareLink.split('#')[1];
window.dispatchEvent(new window.Event('hashchange'));
await wait(30);

check(names().join(',') === wanted, 'the pasted link brings the whole set list back', names().join(','));
check($$('.song').length === wantedSongs, 'with every song', String($$('.song').length));
check(window.location.hash === '', 'and the address is tidied up again', window.location.hash);
check(text($('#status')).includes('share link'), 'the message says where it came from',
  text($('#status')));

click($('#btn-undo'));
check(groups().length === 0, 'undo puts back the empty set list, so nothing is lost');
click($('#btn-redo'));
check(names().join(',') === wanted, 'and redo returns the shared one');

window.location.hash = 'not-a-real-link!!';
window.dispatchEvent(new window.Event('hashchange'));
await wait(30);
check(names().join(',') === wanted, 'a damaged pasted link changes nothing', names().join(','));
check(text($('#status')).includes('could not be read'), 'and says so', text($('#status')));

/* ---------- 21. delete with confirmation ---------- */

const before = $$('.song').length;
click($$('.song')[0].querySelector('[data-act="del-song"]'));
await wait();
check($('#confirm').open, 'delete asks first');
check(text($('#confirm-text')).includes('Undo can bring it back'), 'dialog explains undo');
$('#confirm').close('cancel');
await wait();
check($$('.song').length === before, 'cancel keeps the song');

click($$('.song')[0].querySelector('[data-act="del-song"]'));
await wait();
$('#confirm').close('ok');
await wait();
check($$('.song').length === before - 1, 'confirm removes the song');

/* ---------- 22. theme ---------- */

click($('#btn-theme'));
check(window.document.documentElement.dataset.theme === 'light', 'theme switches to light');
check($('#btn-theme').getAttribute('aria-label') === 'Switch to dark mode', 'label follows the theme');
click($('#btn-theme'));
check(window.document.documentElement.dataset.theme === 'dark', 'and back to dark');

done();
