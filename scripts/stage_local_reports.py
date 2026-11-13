#!/usr/bin/env python3
"""Collect local Gradle reports into the same layout as the CI artifact."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'backend' / 'build'
DEST = ROOT / 'reports' / 'backend'


def copy(source, destination):
    if not source.exists():
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, destination, dirs_exist_ok=True)
    else:
        shutil.copy2(source, destination)


for path in (BUILD / 'reports' / 'checkstyle').glob('*'):
    copy(path, DEST / 'static' / 'checkstyle' / path.name)
for path in (BUILD / 'test-results' / 'test').glob('TEST-*.xml'):
    copy(path, DEST / 'tests' / path.name)
copy(BUILD / 'reports' / 'tests' / 'test', DEST / 'tests' / 'html')
for path in (BUILD / 'reports' / 'jacoco' / 'test').glob('jacocoTestReport.*'):
    copy(path, DEST / 'coverage' / path.name)
copy(BUILD / 'reports' / 'jacoco' / 'test' / 'html', DEST / 'coverage' / 'html')
for path in (BUILD / 'libs').glob('*.jar'):
    copy(path, DEST / 'build' / path.name)

print(f'Java reports staged in {DEST}')
print('Frontend reports are already stored in frontend/reports/frontend after npm run test:ci.')
