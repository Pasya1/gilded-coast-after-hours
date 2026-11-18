import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { htmlFacts, sourceImports, resolveGamePath, readGameTree } from '../vendor/makefun-game.ts';

const repository = fileURLToPath(new URL('../', import.meta.url)), game = join(repository, 'game');
test('game tree fits the exact published file, byte and path limits', () => {
  const tree = readGameTree(game, { game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 });
  assert.ok(tree.files.length > 10);
  assert.ok(lstatSync(join(game, 'index.html')).size < 1048576);
});

test('every HTML reference and every reachable module import is local and exists', () => {
  const facts = htmlFacts(readFileSync(join(game, 'index.html'), 'utf8')), visited = new Set();
  function localFile(reference, from) {
    if (reference.startsWith('data:')) return null;
    assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(reference), `External reference ${reference}`);
    const path = resolveGamePath(reference, from);
    assert.ok(path, `Escaping reference ${reference} in ${from}`);
    assert.equal(lstatSync(join(game, path)).isFile(), true, `${path} must be a file`);
    return path;
  }
  function visit(path) {
    if (!path || visited.has(path)) return; visited.add(path);
    for (const reference of sourceImports(readFileSync(join(game, path), 'utf8'))) visit(localFile(reference, path));
  }
  for (const link of facts.links) localFile(link.href, 'index.html');
  for (const resource of facts.resources) localFile(resource.src, 'index.html');
  for (const script of facts.scripts) if (script.src) visit(localFile(script.src, 'index.html'));
  assert.equal(facts.importMaps.length, 0); assert.ok(visited.has('game.js')); assert.ok(visited.has('vendor/three.min.js')); assert.ok(visited.size >= 9);
});

test('all authored browser scripts and the preview server parse on the actual Node runtime', () => {
  for (const file of readdirSync(game).filter(name => name.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', join(game, file)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || file);
  }
  const server = spawnSync(process.execPath, ['--check', join(repository, 'serve.mjs')], { encoding: 'utf8' });
  assert.equal(server.status, 0, server.stderr);
});
