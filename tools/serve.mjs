/* Serve the site from this folder, for looking at it before you upload it.
   Copyright (C) 2026 Vince San Juan. GNU GPL v3 or later, see LICENSE.

   The page has to come from a web address rather than from a file, because a
   module and a fetch both refuse to work over file://. Opening index.html
   directly shows a red banner saying so.

   Node rather than Python, because "py" is a Windows spelling, "python3" is the
   Linux one, and this has to work the same in a Codespace as it does here.

   Start it with:  npm run serve */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, normalize, extname, sep } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

/* A module served as text/plain will not run, so these matter. Anything not
   named here is sent as a download, which is safe and obvious when wrong. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const asked = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const path = join(ROOT, normalize(asked === '/' ? '/index.html' : asked));

  // normalize collapses any ".." so a request cannot climb out of the folder.
  if (!path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Outside the project folder.');
  }

  try {
    const info = await stat(path);
    const file = info.isDirectory() ? join(path, 'index.html') : path;
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      // the point of this is seeing an edit, so nothing may be held in a cache
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Not here: ${asked}`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Set List Builder is at  http://localhost:${PORT}\n`);
  console.log('  Edit songs.tsv or any other file, then reload the page.');
  console.log('  Stop it with Ctrl+C.\n');
});
