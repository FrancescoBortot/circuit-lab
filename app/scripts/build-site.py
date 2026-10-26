#!/usr/bin/env python3
"""Prepare only the public app and offline download for static hosting."""
from pathlib import Path
import importlib.util
import re
import zipfile

APP = Path(__file__).resolve().parents[1]
SITE = APP.parent / '_site'
SPEC = importlib.util.spec_from_file_location('build_offline', APP / 'scripts/build-offline.py')
OFFLINE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OFFLINE)

def build():
    destination, manifest = OFFLINE.build()
    html = destination.read_text()
    marker = '<span class="offline-note">'
    if html.count(marker) != 1:
        raise ValueError('Expected exactly one sidebar download insertion point.')
    links = ('<a class="sheet-link" href="./Circuit-Lab-offline.zip" download="Circuit-Lab-offline.zip">'
             '<svg><use href="#i-download"/></svg><span>Scarica per usarlo offline</span></a>\n'
             '<a class="sheet-link" href="https://github.com/FrancescoBortot/circuit-lab#readme" '
             'target="_blank" rel="noopener"><svg><use href="#i-book"/></svg>'
             '<span>Guida all’uso</span></a>\n')
    html = html.replace(marker, links + marker)
    if re.search(r'data:application/pdf|JVBERi0|assets/[^"\s]+\.pdf', html, re.I):
        raise ValueError('Course documents must never be included in the public site.')
    SITE.mkdir(exist_ok=True)
    expected = {'index.html', 'Circuit-Lab-offline.zip'}
    unexpected = {p.name for p in SITE.iterdir()} - expected
    if unexpected:
        raise ValueError('Unexpected content in site output: ' + ', '.join(sorted(unexpected)))
    (SITE / 'index.html').write_text(html)
    bundle = APP / 'dist/Circuit-Lab-offline.zip'
    with zipfile.ZipFile(bundle) as archive:
        if sorted(archive.namelist()) != ['Circuit Lab.html', 'LEGGIMI.txt', 'LICENSE.txt', 'integrita.json']:
            raise ValueError('Unexpected contents in the offline download.')
        for name in archive.namelist():
            payload = archive.read(name)
            if b'%PDF-' in payload or b'JVBERi0' in payload:
                raise ValueError('Course document found in offline download.')
    (SITE / bundle.name).write_bytes(bundle.read_bytes())
    return SITE, manifest

if __name__ == '__main__':
    site, manifest = build()
    print(f'{site}\nApp and offline download only; course materials: {manifest["course_materials"]}')
