#!/usr/bin/env python3
"""Build both installable packages with Python's standard library."""
import json
import shutil
import zipfile
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'dist')
args = parser.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
extension = out / 'script-finder-firefox'
if extension.exists():
    shutil.rmtree(extension)
shutil.copytree(ROOT / 'extension', extension)
shutil.copytree(ROOT / 'shared', extension / 'shared')
for name in ['LICENSE', 'THIRD-PARTY-NOTICES.md']:
    if (ROOT / name).exists(): shutil.copyfile(ROOT / name, extension / name)
with zipfile.ZipFile(out / 'script-finder-firefox.xpi', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(extension.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(extension))
parts = [(ROOT / 'userscript/header.txt').read_text(), '\n(() => {\n\"use strict\";\n']
parts += [(ROOT / 'shared' / file).read_text() for file in ['suffix-rules.js', 'core.js', 'ui.js']]
parts += ['\nglobalThis.SF_STYLE = ' + json.dumps((ROOT / 'shared/ui.css').read_text()) + ';\n', (ROOT / 'userscript/entry.js').read_text(), '\n})();\n']
(out / 'script-finder.user.js').write_text('\n'.join(parts))
for name in ['README.md', 'PRIVACY.md', 'DIAGNOSIS.md', 'TEST-RESULTS.md']:
    if (ROOT / name).exists(): shutil.copyfile(ROOT / name, out / name)
with zipfile.ZipFile(out / 'script-finder-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(ROOT.rglob('*')):
        if path.is_file() and not any(p in {'.git', 'dist', '__pycache__'} for p in path.relative_to(ROOT).parts) and out not in path.parents:
            archive.write(path, Path('script-finder') / path.relative_to(ROOT))
print('Built:', out / 'script-finder.user.js')
print('Built:', out / 'script-finder-firefox.xpi')
print('Built:', out / 'script-finder-source.zip')
