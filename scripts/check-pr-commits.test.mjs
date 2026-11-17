import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { newCommits, checkCommits } from './check-pr-commits.mjs';

test('PR selection and linting for main/dev, including new merges', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'culinary-commit-check-'));
  t.after(() => {
    assert.equal(dirname(directory), tmpdir());
    assert.ok(basename(directory).startsWith('culinary-commit-check-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  const git = (args, input) => execFileSync('git', args, {
    cwd: directory, env, input, encoding: 'utf8',
  }).trim();
  git(['init', '--quiet']);
  const tree = git(['mktree'], '');
  const commit = (message, parents = []) => git([
    'commit-tree', tree, ...parents.flatMap(p => ['-p', p]),
  ], message + '\n');
  const base = commit('old accepted base message');
  const main = commit('old accepted main message', [base]);
  const dev = commit('another accepted base message', [base]);
  const merge = commit('chore: sync main into dev', [dev, main]);
  assert.deepEqual(newCommits(directory, dev, merge, main), [merge]);
  assert.equal(checkCommits(directory, [merge]), true);

  const fix = commit('fix: validate new messages', [main]);
  assert.deepEqual(newCommits(directory, main, fix, main), [fix]);
  assert.equal(checkCommits(directory, [fix]), true);

  const invalid = commit('some random message', [merge]);
  assert.deepEqual(newCommits(directory, dev, invalid, main), [merge, invalid]);
  assert.equal(checkCommits(directory, [invalid]), false);
  const cli = (head) => spawnSync(process.execPath, [
    fileURLToPath(new URL('./check-pr-commits.mjs', import.meta.url)), base, head, main, dev,
  ], { cwd: directory, encoding: 'utf8' });
  assert.equal(cli(fix).status, 0);
  assert.equal(cli(invalid).status, 1);

  // Commitlint normally ignores this message; our strict config must reject it.
  const invalidMerge = commit("Merge branch 'main' into dev", [dev, main]);
  assert.deepEqual(newCommits(directory, dev, invalidMerge, main), [invalidMerge]);
  assert.equal(checkCommits(directory, [invalidMerge]), false);
  assert.deepEqual(newCommits(directory, base, merge, main, dev), [merge]);
  assert.throws(() => newCommits(directory, 'missing-ref', merge, main));
});
