// IRONHAVEN — entrypoint (agent-fun/program/v1).
// Copies game/ and screenshots/ from this repository to the output directory
// and writes /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22, standard library only; runs with no network, /bot read-only,
// /output writable. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function fail(message: string): never {
  console.error(`ironhaven: ${message}`);
  process.exit(1);
}

if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  fail('game/index.html is missing from the repository');
}
if (!existsSync(join(repoRoot, 'screenshots'))) {
  fail('screenshots/ is missing from the repository');
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`ironhaven: wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
