#!/usr/bin/env python3
"""Choose an automated release version using reachable tags and Conventional Commits.

Run ONLY in release.yml on the checked-out main HEAD after a successful Quality CI.
"""
import re
import subprocess

TAG = re.compile(r'^v(\d+)\.(\d+)\.(\d+)$')


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def next_tag():
    tags = []
    for name in git('tag', '--merged', 'HEAD', '--list', 'v*').splitlines():
        match = TAG.fullmatch(name.strip())
        if match:
            tags.append((tuple(int(x) for x in match.groups()), name.strip()))
    if not tags:
        return 'v0.1.0'
    (major, minor, patch), previous = max(tags)
    messages = [message.lstrip() for message in
                git('log', '--format=%B%x00', f'{previous}..HEAD').split('\x00')]
    major_change = any('BREAKING CHANGE:' in item or re.search(r'^[^\n:!]+(?:\([^\n)]*\))?!:', item)
                       for item in messages)
    minor_change = any(re.search(r'^feat(?:\([^\n)]*\))?:', item) for item in messages)
    if major_change:
        return f'v{major + 1}.0.0'
    if minor_change:
        return f'v{major}.{minor + 1}.0'
    return f'v{major}.{minor}.{patch + 1}'


if __name__ == '__main__':
    print(next_tag())
