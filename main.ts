// Lantern Lane — Spot the Difference: hand-in program.
// Copies game/ and screenshots/ from this repository to the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Node 22 standard library only; run twice,
// both runs must write the same bytes.
//
// Guards: the output subdirectories are wiped before copying so a
// second run never inherits stale files from the first, and the
// result is checked against the gate's size limits before we report
// success (dossier at most 1.5 MiB, 3-4 screenshots at most 256 KiB
// each, game/index.html at most 1 MiB).

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const MAX_DOSSIER_BYTES = 1572864; // 1.5 MiB
const MAX_SCREENSHOT_BYTES = 262144; // 256 KiB
const MAX_INDEX_BYTES = 1048576; // 1 MiB

function fail(message) {
  throw new Error('Lantern Lane hand-in refused: ' + message);
}

function checkDir(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) fail(label + ' is missing: ' + path);
}

function checkFileWithin(path, maxBytes, label) {
  if (!existsSync(path) || !statSync(path).isFile()) fail(label + ' is missing: ' + path);
  const size = statSync(path).size;
  if (size > maxBytes) fail(label + ' is ' + size + ' bytes, over the ' + maxBytes + ' byte limit');
  return size;
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
checkDir(gameDir, 'game/');
checkDir(shotsDir, 'screenshots/');
checkFileWithin(join(gameDir, 'index.html'), MAX_INDEX_BYTES, 'game/index.html');

const shotNames = readdirSync(shotsDir)
  .filter((name) => !name.startsWith('.'))
  .sort();
if (shotNames.length < 3 || shotNames.length > 4) {
  fail('screenshots/ holds ' + shotNames.length + ' images, need 3 or 4');
}
for (const name of shotNames) {
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith('-')) fail('bad screenshot name: ' + name);
  if (!/\.(png|jpe?g)$/i.test(name)) fail('screenshot is not PNG or JPEG: ' + name);
  checkFileWithin(join(shotsDir, name), MAX_SCREENSHOT_BYTES, 'screenshot ' + name);
}

// Wipe the destination first: a stale file from an earlier run would
// make the two grader runs differ.
mkdirSync(outDir, { recursive: true });
for (const sub of ['game', 'screenshots']) {
  rmSync(join(outDir, sub), { recursive: true, force: true });
  mkdirSync(join(outDir, sub), { recursive: true });
}
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 });
if (!dossier || dossier.length === 0) fail('buildDossier returned an empty dossier');
if (dossier.length > MAX_DOSSIER_BYTES) {
  fail('dossier.json is over the 1.5 MiB limit');
}
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(
  'Lantern Lane handed in to ' + outDir +
  ' (' + shotNames.length + ' screenshots, dossier ' +
  dossier.length + ' bytes)'
);
