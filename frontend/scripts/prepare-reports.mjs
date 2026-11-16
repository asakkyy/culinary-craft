import { mkdirSync } from 'node:fs';
for (const path of ['reports/frontend/static', 'reports/frontend/tests', 'reports/frontend/coverage', 'reports/frontend/build']) {
  mkdirSync(path, { recursive: true });
}
