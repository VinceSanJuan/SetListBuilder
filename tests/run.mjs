/* Runs every harness and reports which ones passed.
   Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE.

   Each harness runs in its own process, because each one takes over globals
   such as document and window to stand in for a browser. */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUITES = [
  ['data', 'tsv.mjs', 'reading songs.tsv, including what a spreadsheet does to it'],
  ['startup', 'startup.mjs', 'share links, damaged data, and a failed fetch'],
  ['app', 'app.mjs', 'the page itself: searching, editing, dragging, sharing'],
];

const results = [];
for (const [name, file, what] of SUITES) {
  console.log(`\n=== ${name}: ${what}`);
  const path = fileURLToPath(new URL(file, import.meta.url));
  const run = spawnSync(process.execPath, [path], { stdio: 'inherit' });
  results.push({ name, file, code: run.status ?? 1 });
  if (run.status !== 0 && run.status !== 2) {
    console.log(`\nThe ${name} suite stopped before it finished. The error is just above,`);
    console.log('and it is a fault in the test file or the app, not a failing check.');
  }
}

const failed = results.filter((r) => r.code !== 0);

console.log('\n---------------------------------------------');
for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name}`);
console.log('---------------------------------------------');

if (!failed.length) {
  console.log('\nAll suites passed.\n');
  console.log('What these tests cannot see, so a pass is not the whole story:');
  console.log('  - anything drawn by :hover, ::before or ::after');
  console.log('  - anything inside @media (hover: none), which jsdom ignores');
  console.log('  - where things actually sit, because every rectangle measures zero');
  console.log('  - a shorthand holding a var(), such as border: 1px solid var(--line)');
  console.log('  - used values. A declared height of 34px is reported even when a');
  console.log('    min-height of 44px is the one winning.');
  console.log('Look at the page in a browser as well.\n');
  process.exit(0);
}

console.log(`\n${failed.length} suite(s) failed: ${failed.map((r) => r.name).join(', ')}`);
for (const r of failed) {
  console.log(r.code === 2
    ? `  ${r.name}: checks failed. Each one is listed above with the file and line to open.`
    : `  ${r.name}: the suite stopped with an error before finishing.`);
}
console.log(`\nTo work on one suite alone:  node tests/${failed[0].file}\n`);
if (process.env.GITHUB_ACTIONS) {
  console.log(`::error title=Tests failed::${failed.map((r) => r.name).join(', ')}`);
}
process.exit(1);
