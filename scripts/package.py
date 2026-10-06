#!/usr/bin/env python3
"""Deterministic root-manifest store ZIP and separately documented source ZIP."""
from pathlib import Path
import hashlib, zipfile, json
ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / 'extension'
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
VERSION = json.loads((EXT/'manifest.json').read_text())['version']
LOCALES = {'ja','en','ko','zh_CN','es','de','fr','pt_BR','ru','ar','id'}
TOP = {'manifest.json','i18n.js','core.js','gear-menu.js','ui.js','content.js','content.css','help.html','help.js','help.css','onboarding.html','onboarding.js','onboarding.css','background.js'}
ALLOWED = TOP | {f'icons/icon{size}.png' for size in [16,32,48,128]} | {f'_locales/{locale}/messages.json' for locale in LOCALES}
RUNTIME = sorted(p for p in EXT.rglob('*') if p.is_file())
assert {p.relative_to(EXT).as_posix() for p in RUNTIME} == ALLOWED, 'Unexpected/missing runtime file'
assert not any(p.is_symlink() for p in ROOT.rglob('*')), 'Symlinks are not packaged'
DOCS = [ROOT/'README.md', ROOT/'PRIVACY.md'] + sorted((ROOT/'docs').rglob('*.md')) + [ROOT/'docs/assets/icon.svg']
SOURCE = RUNTIME + DOCS + [ROOT/'package.json'] + sorted((ROOT/'tests').rglob('*.cjs')) + sorted((ROOT/'scripts').glob('*.cjs')) + [ROOT/'scripts/package.py']
for name, files, runtime in [(f'popchat-for-twitch-{VERSION}.zip',RUNTIME,True),(f'popchat-for-twitch-{VERSION}-source.zip',SOURCE,False)]:
    output = OUT/name
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(set(files)):
            relative = path.relative_to(EXT) if runtime else Path('popchat-for-twitch')/path.relative_to(ROOT)
            info = zipfile.ZipInfo(relative.as_posix(),(2026,10,6,0,0,0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info,path.read_bytes())
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert all('..' not in Path(n).parts and not n.startswith('/') for n in archive.namelist())
        assert ('manifest.json' if runtime else 'popchat-for-twitch/extension/manifest.json') in archive.namelist()
        if runtime: assert set(archive.namelist()) == ALLOWED
    print(f'{output.name}  {output.stat().st_size} bytes  sha256={hashlib.sha256(output.read_bytes()).hexdigest()}')
