// Lantern Lane — local static server for play-testing only.
// Serves game/ at http://localhost:8080 (or PORT from argv).
// Node standard library only; never used by the grader.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(join(here, 'game'));
const port = Number(process.argv[2] || '8080') || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

function mimeOf(file) {
  const dot = file.lastIndexOf('.');
  return MIME[file.slice(dot)] || 'application/octet-stream';
}

const server = createServer((req, res) => {
  let pathname = '/index.html';
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('bad url\n');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': mimeOf(file) });
  res.end(readFileSync(file));
});

server.listen(port, () => {
  console.log('Lantern Lane serving game/ at http://localhost:' + port);
});
