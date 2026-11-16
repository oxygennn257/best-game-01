// LANTERNFALL entry program (Node 22, standard library only).
//
// The game is the static files under game/ plus the screenshots/ the maker
// took of it. This program hands them in: it copies both folders into the
// grader's /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the kit's buildDossier library, which the sealed
// scorer rebuilds and compares byte for byte.
//
// Run it locally to check the entry:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice into two directories and diff them: both runs must write the
// same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps for this bounty (reference/gate.json): game/ holds
// at most 993 files and directories and 48 MiB in all, index.html at most
// 1 MiB, and screenshots/ holds 3 or 4 images of at most 256 KiB each.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  console.error(`LANTERNFALL main.ts: ${message}`);
  process.exit(1);
}

if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  fail('game/index.html is missing — the game was not built.');
}
if (!existsSync(join(repoRoot, 'screenshots'))) {
  fail('screenshots/ is missing — take 3 or 4 screenshots of the game first.');
}

// Fail fast with a clear message when the screenshot count is wrong,
// instead of letting buildDossier refuse the entry cryptically.
const shotFiles = readdirSync(join(repoRoot, 'screenshots'))
  .filter((f) => !f.startsWith('.') && /\.(png|jpe?g)$/i.test(f));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  fail(`screenshots/ holds ${shotFiles.length} images — the gate wants 3 or 4.`);
}

mkdirSync(outputDir, { recursive: true });
rmSync(join(outputDir, 'game'), { recursive: true, force: true });
rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, DOSSIER_OPTIONS);

// Sanity-check what we just wrote: the dossier must be real JSON and
// non-empty, or the entry would score 0 with no useful error from the gate.
// (buildDossier returns a Uint8Array, so decode it before parsing.)
let dossierBytes = 0;
try {
  const dossierText = Buffer.from(dossier).toString('utf8');
  const parsed = JSON.parse(dossierText);
  dossierBytes = Buffer.byteLength(dossierText, 'utf8');
  if (!parsed || typeof parsed !== 'object' || dossierBytes < 1024) {
    fail('dossier.json came out empty or unparsable — the build is broken.');
  }
} catch (e) {
  fail(`dossier.json is not valid JSON: ${e.message}`);
}
writeFileSync(
  join(outputDir, 'dossier.json'),
  dossier,
);

const gameFiles = readdirSync(join(outputDir, 'game'), { recursive: true }).length;
console.log(`LANTERNFALL: wrote ${outputDir}/dossier.json (${dossierBytes} bytes, ${gameFiles} game files)`);
