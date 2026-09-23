/* A page for tools/lookup.mjs, served from your own machine.
   Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE.

   The lookup cannot happen in the published page. A browser will not let one
   site read another site's pages unless that site allows it, and PraiseCharts
   does not. So the fetching stays in Node, and this serves a small page that
   asks Node to do it. Nothing here is part of the site: it runs only while you
   run it, and only on this machine.

   Start it with:  npm run lookup */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { lookup } from './lookup.mjs';

const PORT = Number(process.env.PORT) || 8081;
const GAP_MS = 700; // the least time between two requests to someone else's site

let lastFetch = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One at a time, with a gap, however fast the page asks. */
async function politely(query) {
  const wait = lastFetch + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  return lookup(query);
}

const send = (res, status, type, body) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/lookup') {
    const query = (url.searchParams.get('q') || '').trim();
    if (!query) return send(res, 400, 'application/json', '{"error":"no song asked for"}');
    try {
      const result = await politely(query);
      return send(res, 200, 'application/json', JSON.stringify(result));
    } catch (err) {
      // A failure here is almost always their site, not this code, so say which
      return send(res, 200, 'application/json',
        JSON.stringify({ query, found: false, notes: [`PraiseCharts said: ${err.message}`] }));
    }
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const page = await readFile(new URL('lookup.html', import.meta.url), 'utf8');
    return send(res, 200, 'text/html; charset=utf-8', page);
  }

  send(res, 404, 'text/plain', 'Only / and /api/lookup live here.');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Song lookup is running at  http://localhost:${PORT}\n`);
  console.log('  Paste song names into the box, one per line, and it gives you');
  console.log('  rows to append to songs.tsv.\n');
  console.log('  Stop it with Ctrl+C.\n');
});
