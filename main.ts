// EMBERLINE v5 — the entry program for the threejs-fps-02 bounty (Node 22, stdlib only).
// v5 adds the Kilnyard formula on top of v4's bright day yard, Beacon lighthouse,
// Molotov grenades and spray pattern: a halftime side switch (Ember attacks
// rounds 1-4, defends rounds 5-9 and the player defuses with E), a buy menu
// with weapon stats and a per-round economy line, a victory screen with match
// stats and MVP, and radio callouts for the plan, planting, defusing and backup.
// It hands the game in: copies game/ and screenshots/ from beside this file into
// the output directory and writes dossier.json with the vendored make.fun library,
// using the scorer's own caps from reference/gate.json. Screenshots are ordered
// in shots.json with the action shot first — the dossier's cover is image 0.
// Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps (reference/gate.json): only text_max_bytes shapes the bytes; the
// rest refuse an entry the scorer would refuse — more than 4 screenshots or one
// over 256 KiB, more than 993 files in game/ or 48 MiB of game files in all, because
// game/ counts beside /output's own 1000-entry cap with screenshots/ and dossier.json.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function countEntries(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += 1;
    if (entry.isDirectory()) total += countEntries(join(dir, entry.name));
  }
  return total;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Pre-flight: the judge needs 3-4 real renders, each under the byte cap. Fail here
// with a readable message instead of deep inside the dossier builder.
const shotFiles = existsSync(join(out, 'screenshots'))
  ? readdirSync(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
  : [];
if (shotFiles.length < 3) throw new Error(`need at least 3 screenshots in screenshots/, found ${shotFiles.length}`);
if (shotFiles.length > GATE.screenshots.max) throw new Error(`at most ${GATE.screenshots.max} screenshots, found ${shotFiles.length}`);
for (const shot of shotFiles) {
  const bytes = statSync(join(out, 'screenshots', shot)).size;
  if (bytes > GATE.screenshots.max_bytes) throw new Error(`screenshot ${shot} is ${bytes} bytes, over the ${GATE.screenshots.max_bytes} cap`);
}

const dossier = buildDossier(out, GATE);
writeFileSync(join(out, 'dossier.json'), dossier);

// Report what was handed in, so a human can see at a glance that it worked.
const shots = shotFiles.map((f) => `${f} (${statSync(join(out, 'screenshots', f)).size} B)`);
console.log(`EMBERLINE v5 handed in to ${out}`);
console.log(`  game entries: ${countEntries(join(out, 'game'))}`);
console.log(`  screenshots: ${shots.join(', ')}`);
console.log(`  dossier.json: ${statSync(join(out, 'dossier.json')).size} bytes`);
