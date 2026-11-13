#!/usr/bin/env python3
"""Compile detailed reports from JUnit, JaCoCo, ESLint, Vitest and Git into one CI artifact.

No third-party Python dependencies. Missing measurements are marked N/A, never invented.
"""
import argparse
import csv
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def git(*args):
    result = subprocess.run(['git', *args], text=True, capture_output=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else ''


def percent(covered, missed):
    total = covered + missed
    return round(100 * covered / total, 2) if total else None


def jacoco(path):
    if not path.is_file():
        return {}
    root = ET.parse(path).getroot()
    result = {}
    for item in root.findall('counter'):
        kind = item.attrib['type'].lower()
        covered, missed = int(item.attrib['covered']), int(item.attrib['missed'])
        result[kind] = {'pct': percent(covered, missed), 'covered': covered, 'missed': missed}
    return result


def junit_files(paths, kind):
    result = {'total': 0, 'passed': 0, 'failed': 0, 'skipped': 0, 'seconds': 0.0, 'cases': []}
    for path in paths:
        if not path.is_file():
            continue
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            continue
        for case in root.findall('.//testcase'):
            failure = case.find('failure') is not None or case.find('error') is not None
            skip = case.find('skipped') is not None
            status = 'FAILED' if failure else ('SKIPPED' if skip else 'PASSED')
            seconds = float(case.get('time') or 0)
            result['cases'].append({'scope': kind, 'test': (case.get('classname') or '') + '.' +
                                    (case.get('name') or ''), 'status': status,
                                    'seconds': round(seconds, 4)})
            result['total'] += 1
            result['seconds'] += seconds
            result['failed'] += int(failure)
            result['skipped'] += int(skip)
            result['passed'] += int(not failure and not skip)
    result['seconds'] = round(result['seconds'], 3)
    return result


def eslint(path):
    if not path.is_file():
        return {}, []
    try:
        files = json.loads(path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}, []
    issues = []
    for item in files:
        for message in item.get('messages', []):
            issues.append({'scope': 'ESLint', 'file': item.get('filePath', ''),
                           'line': message.get('line', ''),
                           'severity': 'error' if message.get('severity') == 2 else 'warning',
                           'rule': message.get('ruleId') or '',
                           'message': message.get('message', '')})
    return {'errors': sum(x.get('errorCount', 0) for x in files),
            'warnings': sum(x.get('warningCount', 0) for x in files),
            'files': len(files)}, issues


def checkstyle(paths):
    issues = []
    for path in paths:
        if not path.is_file():
            continue
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            continue
        for file in root.findall('file'):
            for error in file.findall('error'):
                issues.append({'scope': 'Checkstyle', 'file': file.get('name', ''),
                               'line': error.get('line', ''),
                               'severity': error.get('severity', 'error'),
                               'rule': error.get('source', '').rsplit('.', 1)[-1],
                               'message': error.get('message', '')})
    return {'errors': sum(x['severity'] == 'error' for x in issues),
            'warnings': sum(x['severity'] == 'warning' for x in issues)}, issues


def vitest_coverage(path):
    if not path.is_file():
        return {}
    try:
        obj = json.loads(path.read_text(encoding='utf-8'))['total']
        return {key: {'pct': obj[key]['pct'], 'covered': obj[key].get('covered'),
                      'total': obj[key].get('total')}
                for key in ('lines', 'statements', 'functions', 'branches')}
    except (KeyError, ValueError, TypeError):
        return {}


def git_metrics():
    recent = git('log', '-n', '10', '--format=%h|%ad|%s', '--date=short').splitlines()
    commits = []
    for line in recent:
        parts = line.split('|', 2)
        if len(parts) != 3:
            continue
        added, deleted = 0, 0
        numstat = git('show', '--format=', '--numstat', parts[0])
        for row in numstat.splitlines():
            nums = row.split('\t')
            if len(nums) >= 2:
                added += int(nums[0]) if nums[0].isdigit() else 0
                deleted += int(nums[1]) if nums[1].isdigit() else 0
        commits.append({'sha': parts[0], 'date': parts[1], 'subject': parts[2],
                        'added': added, 'deleted': deleted, 'size': added + deleted})
    def count(since):
        raw = git('rev-list', '--count', '--since=' + since, 'HEAD')
        return int(raw) if raw.isdigit() else None
    return {'head': git('rev-parse', '--short', 'HEAD'),
            'branch': git('branch', '--show-current') or os.getenv('GITHUB_REF_NAME', ''),
            'last_7d': count('7 days ago'), 'last_30d': count('30 days ago'),
            'avg_commit_size_last_10': round(sum(x['size'] for x in commits) / len(commits), 2)
            if commits else None, 'commits': commits}


def github_metrics():
    repo = os.getenv('GITHUB_REPOSITORY')
    token = os.getenv('GH_TOKEN') or os.getenv('GITHUB_TOKEN')
    if not repo or not token:
        return {'note': 'GitHub API недоступен (нет GITHUB_REPOSITORY / токена)'}

    def api(path):
        request = urllib.request.Request(
            'https://api.github.com/repos/' + repo + path,
            headers={'Accept': 'application/vnd.github+json',
                     'Authorization': 'Bearer ' + token,
                     'X-GitHub-Api-Version': '2022-11-28',
                     'User-Agent': 'culinary-craft-lab5-metrics'})
        with urllib.request.urlopen(request, timeout=12) as response:
            return json.load(response)

    try:
        runs = api('/actions/runs?per_page=100')['workflow_runs']
        completed = [run for run in runs if run['status'] == 'completed'
                     and run.get('name') == 'Quality CI'][:20]
        succeeded = sum(run.get('conclusion') == 'success' for run in completed)
        durations = []
        for run in completed:
            start, finish = run.get('run_started_at'), run.get('updated_at')
            if start and finish:
                parse = lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))
                durations.append(round((parse(finish) - parse(start)).total_seconds(), 1))
        pulls_open = api('/pulls?state=open&per_page=100')
        pulls_closed = api('/pulls?state=closed&per_page=100')
        return {'completed_runs_sample': len(completed), 'successful_runs': succeeded,
                'success_pct': percent(succeeded, len(completed) - succeeded),
                'avg_duration_seconds_approx': round(sum(durations) / len(durations), 1)
                if durations else None, 'open_pr_sample': len(pulls_open),
                'closed_pr_sample': len(pulls_closed),
                'note': 'Выборка до 20 последних завершённых Quality CI; время приблизительное '
                        '(run_started_at → updated_at), PR до 100 на категорию'}
    except (urllib.error.URLError, OSError, KeyError, ValueError) as error:
        return {'note': 'Данные GitHub API недоступны: ' + str(error)}


def save_csv(path, fieldnames, rows):
    with path.open('w', newline='', encoding='utf-8-sig') as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend-dir', type=Path, default=Path('reports/backend'))
    parser.add_argument('--frontend-dir', type=Path, default=Path('reports/frontend'))
    parser.add_argument('--output-dir', type=Path, default=Path('reports/summary'))
    parser.add_argument('--stage', default=os.getenv('STAGE_NAME') or 'regular-ci')
    parser.add_argument('--require-complete', action='store_true',
                        help='Fail CI if any mandatory test, coverage, or linter report is missing')
    args = parser.parse_args()
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    backend, frontend = args.backend_dir, args.frontend_dir

    backend_cov = jacoco(backend / 'coverage/jacocoTestReport.xml')
    frontend_cov = vitest_coverage(frontend / 'coverage/coverage-summary.json')
    java_tests = junit_files(sorted((backend / 'tests').glob('TEST-*.xml')), 'Java/JUnit')
    js_tests = junit_files([frontend / 'tests/junit.xml'], 'React/Vitest')
    java_lint, java_issues = checkstyle([
        backend / 'static/checkstyle/main.xml', backend / 'static/checkstyle/test.xml'])
    js_lint, js_issues = eslint(frontend / 'static/eslint.json')
    git_data = git_metrics()
    remote_data = github_metrics()

    result = {
        'collected_at_utc': datetime.now(timezone.utc).isoformat(),
        'stage': args.stage,
        'backend': {'coverage': backend_cov, 'tests': {k: v for k, v in java_tests.items()
                                                     if k != 'cases'}, 'checkstyle': java_lint},
        'frontend': {'coverage': frontend_cov, 'tests': {k: v for k, v in js_tests.items()
                                                       if k != 'cases'}, 'eslint': js_lint},
        'git': {k: v for k, v in git_data.items() if k != 'commits'},
        'github_ci': remote_data,
        'measurements_complete': bool(backend_cov and frontend_cov and
                                      java_tests['total'] and js_tests['total'] and
                                      java_lint and js_lint),
    }
    (out / 'metrics.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    save_csv(out / 'test-cases.csv', ['scope', 'test', 'status', 'seconds'],
             java_tests['cases'] + js_tests['cases'])
    save_csv(out / 'static-issues.csv', ['scope', 'file', 'line', 'severity', 'rule', 'message'],
             java_issues + js_issues)
    save_csv(out / 'git-commits.csv', ['sha', 'date', 'subject', 'added', 'deleted', 'size'],
             git_data['commits'])

    rows = []
    def add(name, value, unit, source):
        rows.append({'metric': name, 'value': 'N/A' if value is None else value,
                     'unit': unit, 'source': source,
                     'status': 'measured' if value is not None else 'missing'})

    for prefix, tests in [('backend', java_tests), ('frontend', js_tests)]:
        for item in ('total', 'passed', 'failed', 'skipped', 'seconds'):
            add(f'{prefix}.tests.{item}', tests[item] if tests['total'] else None,
                'seconds' if item == 'seconds' else 'tests', f'{prefix}/tests')
    for kind in ('line', 'branch', 'instruction', 'method'):
        if kind in backend_cov:
            add(f'backend.coverage.{kind}', backend_cov[kind]['pct'], '%', 'JaCoCo XML')
    for kind in ('lines', 'branches', 'functions', 'statements'):
        add(f'frontend.coverage.{kind}', frontend_cov.get(kind, {}).get('pct'), '%', 'Vitest JSON')
    for prefix, lint, source in [('backend.checkstyle', java_lint, 'Checkstyle XML'),
                                 ('frontend.eslint', js_lint, 'ESLint JSON')]:
        for kind in ('errors', 'warnings'):
            add(f'{prefix}.{kind}', lint.get(kind), 'issues', source)
    for item in ('last_7d', 'last_30d', 'avg_commit_size_last_10'):
        add('git.' + item, git_data.get(item), 'lines' if item.startswith('avg') else 'commits', 'git log')
    for item, unit in [('completed_runs_sample', 'runs'), ('success_pct', '%'),
                       ('avg_duration_seconds_approx', 'seconds'),
                       ('open_pr_sample', 'PR'), ('closed_pr_sample', 'PR')]:
        add('github.' + item, remote_data.get(item), unit, 'GitHub REST API')

    save_csv(out / 'metrics.csv', ['metric', 'value', 'unit', 'source', 'status'], rows)
    save_csv(out / 'stage-snapshot.csv',
             ['collected_at_utc', 'stage', 'sha', 'java_line_pct', 'react_line_pct',
              'java_passed', 'react_passed', 'checkstyle_errors', 'eslint_errors'], [
                  {'collected_at_utc': result['collected_at_utc'], 'stage': args.stage,
                   'sha': git_data['head'],
                   'java_line_pct': backend_cov.get('line', {}).get('pct', 'N/A'),
                   'react_line_pct': frontend_cov.get('lines', {}).get('pct', 'N/A'),
                   'java_passed': java_tests['passed'], 'react_passed': js_tests['passed'],
                   'checkstyle_errors': java_lint.get('errors', 'N/A'),
                   'eslint_errors': js_lint.get('errors', 'N/A')}
             ])

    def val(value, suffix=''):
        return (str(value) + suffix) if value is not None else 'N/A (отчёт отсутствует)'

    lines = [
        '# Culinary Craft — подробные метрики качества',
        f"**Этап:** `{args.stage}` · **Коммит:** `{git_data['head'] or 'N/A'}` · "
        f"**UTC:** {result['collected_at_utc']}", '',
        '| Метрика | Backend | Frontend |', '|---|---:|---:|',
        f"| Тестов выполнено | {java_tests['total']} | {js_tests['total']} |",
        f"| Пройдено | {java_tests['passed']} | {js_tests['passed']} |",
        f"| Ошибок | {java_tests['failed']} | {js_tests['failed']} |",
        f"| Пропущено | {java_tests['skipped']} | {js_tests['skipped']} |",
        f"| Время тестовых методов (с) | {java_tests['seconds']} | {js_tests['seconds']} |",
        f"| Покрытие строк | {val(backend_cov.get('line', {}).get('pct'), '%')} | "
        f"{val(frontend_cov.get('lines', {}).get('pct'), '%')} |",
        f"| Покрытие ветвлений | {val(backend_cov.get('branch', {}).get('pct'), '%')} | "
        f"{val(frontend_cov.get('branches', {}).get('pct'), '%')} |",
        f"| Ошибки статического анализа | {val(java_lint.get('errors'))} | {val(js_lint.get('errors'))} |",
        f"| Предупреждения | {val(java_lint.get('warnings'))} | {val(js_lint.get('warnings'))} |",
        '', '## Git-метрики',
        f"- Коммитов за 7 дней: **{val(git_data['last_7d'])}**",
        f"- Коммитов за 30 дней: **{val(git_data['last_30d'])}**",
        f"- Средний размер последних 10 коммитов (добавленные + удалённые строки): "
        f"**{val(git_data['avg_commit_size_last_10'])}**",
        '', '## CI и Pull Request (GitHub API)',
        f"- Успешность предыдущих завершённых Quality CI: "
        f"**{val(remote_data.get('success_pct'), '%')}** "
        f"(успешных: {val(remote_data.get('successful_runs'))}, "
        f"выборка: {val(remote_data.get('completed_runs_sample'))}).",
        f"- Приблизительная длительность прошлых Quality CI: "
        f"**{val(remote_data.get('avg_duration_seconds_approx'), ' с')}**.",
        f"- Открытых / закрытых PR (до 100 в каждой выборке): "
        f"**{val(remote_data.get('open_pr_sample'))} / "
        f"{val(remote_data.get('closed_pr_sample'))}**.",
        f"- Примечание: {remote_data.get('note', 'нет')}.",
        '', '## Что лежит в артефактах',
        '- `metrics.json`, `metrics.csv`: машиночитаемые показатели с источниками.',
        '- `test-cases.csv`: **каждый** тест, исход и время выполнения.',
        '- `static-issues.csv`: **каждое** замечание Checkstyle/ESLint, файл и строка.',
        '- `git-commits.csv`: последние коммиты и размер изменений.',
        '- `stage-snapshot.csv`: снимок метрик для сравнения этапов разработки.',
        '- Дополнительные артефакты содержат JaCoCo/Vitest HTML, XML, JUnit и сырые отчёты.',
        '', '**Важно:** отсутствие файла означает `N/A`, а не нулевое значение. '
        'Новый CI не может честно показать метрики предыдущих этапов, '
        'пока их прогоны не были выполнены.'
    ]
    md = '\n'.join(lines) + '\n'
    (out / 'summary.md').write_text(md, encoding='utf-8')
    print(md)
    github_summary = os.getenv('GITHUB_STEP_SUMMARY')
    if github_summary:
        with open(github_summary, 'a', encoding='utf-8') as file:
            file.write(md)
    if args.require_complete and not result['measurements_complete']:
        raise SystemExit('ERROR: missing mandatory CI reports; see metrics.json and summary.md')


if __name__ == '__main__':
    main()
