#!/usr/bin/env python3
"""Компактный архив исходников без зависимостей, браузеров и локальных секретов."""
from pathlib import Path
import os
import zipfile

root = Path(__file__).resolve().parents[1]
output = root.parent / 'lab12chickengun-source.zip'
skip = {'node_modules', '.playwright-browsers', '.git', '.vercel', 'dist', 'coverage',
        'test-results', 'playwright-report', 'lab10-evidence', 'lab12-evidence', '__pycache__'}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip)
        for name in sorted(files):
            if name == '.DS_Store' or name.startswith('._') or name.endswith(('.log', '.zip')):
                continue
            if name.startswith('.env') and not name.endswith('.example'):
                continue
            path = Path(base) / name
            if not path.is_symlink():
                archive.write(path, Path('lab12chickengun-main') / path.relative_to(root))
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise RuntimeError('Архив повреждён')
    print(f'{output}: {len(archive.infolist())} файлов, {output.stat().st_size / 1024:.1f} КБ')
