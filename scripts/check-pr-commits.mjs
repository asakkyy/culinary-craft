import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export function newCommits(cwd, base, head, main, target = base) {
  // Resolve all inputs first: missing refs must fail, never silently skip linting.
  const sha = (ref) => git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
  const refs = [head, base, main, target].map(sha);
  return git(cwd, ['rev-list', '--reverse', refs[0], '--not', ...refs.slice(1), '--'])
    .split('\n').filter(Boolean);
}

export function checkCommits(cwd, commits) {
  let valid = true;
  for (const commit of commits) {
    console.log(`Checking ${commit}`);
    const result = spawnSync(process.execPath, [
      resolve(root, 'node_modules/@commitlint/cli/cli.js'),
      '--config', resolve(root, 'commitlint.config.js'), '--verbose',
    ], {
      cwd: root,
      input: git(cwd, ['show', '-s', '--format=%B', commit]),
      encoding: 'utf8',
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) throw result.error;
    if (result.status !== 0) valid = false;
  }
  return valid;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [base, head, main, target = base] = process.argv.slice(2);
  if (!base || !head || !main) throw new Error('Usage: check-pr-commits.mjs BASE HEAD MAIN [TARGET]');
  const commits = newCommits(process.cwd(), base, head, main, target);
  console.log(`${commits.length} new commit(s); accepted base/main history excluded`);
  if (!checkCommits(process.cwd(), commits)) process.exitCode = 1;
}
