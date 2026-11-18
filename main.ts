import { cpSync, mkdirSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The browser game is already built: packaging uses only the Node standard library.
const repository = fileURLToPath(new URL('.', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
if (destination === resolve(repository)) throw new Error('Output must be separate from the source repository.');

function copyPlainTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source).sort()) {
    const from = join(source, entry);
    const to = join(target, entry);
    const stat = lstatSync(from);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not game files: ${entry}`);
    if (stat.isDirectory()) copyPlainTree(from, to);
    else if (stat.isFile()) cpSync(from, to);
    else throw new Error(`Unsupported game file: ${entry}`);
  }
}

copyPlainTree(join(repository, 'game'), join(destination, 'game'));
copyPlainTree(join(repository, 'screenshots'), join(destination, 'screenshots'));
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
if (dossier.byteLength > 1572864) throw new Error('Dossier exceeds the competition limit.');
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log(`Packaged Gilded Coast: ${dossier.byteLength} dossier bytes.`);
