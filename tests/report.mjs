/* Shared reporting for the test harnesses.
   Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE.

   Every check carries a sentence saying what should be true. When one fails,
   that sentence is searched for in the harness source, so the report can name
   the file and line to open. On GitHub the same thing is emitted as a workflow
   annotation, which puts the message on the job summary and against the line
   in the diff, rather than leaving it buried in the log. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';

const CI = Boolean(process.env.GITHUB_ACTIONS);

/** Workflow commands take one line, so real newlines have to be escaped. */
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/**
 * @param {string} name  short name for the suite, used in the summary
 * @param {string} url   the harness's own import.meta.url, so failures can be located
 */
export function reporter(name, url) {
  const path = fileURLToPath(url);
  const shown = relative(process.cwd(), path).replace(/\\/g, '/');
  const lines = readFileSync(path, 'utf8').split('\n');
  const failures = [];
  let passed = 0;

  // GitHub folds a group, so the hundreds of passing lines stop burying the
  // summary. Every failure is repeated below the group, outside the fold.
  if (CI) console.log(`::group::${name}: every check`);

  /** The message is written as a literal in the harness, so it can be found again. */
  const lineOf = (what) => {
    const i = lines.findIndex((l) => l.includes(what));
    return i === -1 ? null : i + 1;
  };

  const record = (what, detail) => {
    const line = lineOf(what);
    failures.push({ what, detail, line });
    console.log(`FAIL ${what}`);
    if (detail) console.log(`     got: ${detail}`);
  };

  const check = (ok, what, detail = '') => {
    if (ok) {
      passed += 1;
      console.log(`ok   ${what}`);
      return;
    }
    record(what, detail);
  };

  /** Deep compare, reporting both sides. Used by the data tests. */
  const eq = (got, want, what) => {
    const a = JSON.stringify(got);
    const b = JSON.stringify(want);
    if (a === b) {
      passed += 1;
      console.log(`ok   ${what}`);
      return;
    }
    record(what, `${a}\n     want: ${b}`);
  };

  /** Prints the summary and ends the process. Never returns. */
  const done = () => {
    if (CI) console.log('::endgroup::');
    const total = passed + failures.length;
    if (!failures.length) {
      console.log(`\n${name}: all ${total} checks passed`);
      process.exit(0);
    }

    console.log(`\n${name}: ${failures.length} of ${total} checks FAILED\n`);
    failures.forEach((f, i) => {
      const at = f.line ? `${shown}:${f.line}` : shown;
      console.log(`  ${i + 1}) ${f.what}`);
      console.log(`     expected this to be true, but it was not`);
      if (f.detail) console.log(`     got:   ${f.detail}`);
      console.log(`     check: ${at}`);
      console.log('');
    });
    console.log(`  Run this suite alone with:  node ${shown}`);
    console.log('  A check can fail because the app broke, or because the app changed');
    console.log('  on purpose and the check still describes the old behaviour. Read the');
    console.log('  sentence first: it says what was meant to be true.\n');

    if (CI) {
      for (const f of failures) {
        const where = f.line ? `,line=${f.line}` : '';
        const body = f.detail ? `${f.what}\ngot: ${f.detail}` : f.what;
        console.log(`::error file=${shown}${where},title=${esc(name)} check failed::${esc(body)}`);
      }
    }
    process.exit(2); // 2 means checks failed; anything else means the suite broke
  };

  return { check, eq, done };
}
