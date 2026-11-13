import { mkdirSync } from 'node:fs';

for (const part of ['static', 'tests', 'coverage', 'build']) {
  mkdirSync(`reports/frontend/${part}`, { recursive: true });
}
