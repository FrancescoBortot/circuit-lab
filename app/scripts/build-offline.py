#!/usr/bin/env python3
"""Build a deterministic, self-contained app. No network or third-party packages."""
from pathlib import Path
import base64
import hashlib
import json
import re
import zipfile
import build_solver

ROOT = Path(__file__).resolve().parents[1]

def build():
    build_solver.build()
    html = (ROOT / 'index.html').read_text()
    license_text = (ROOT.parent / 'LICENSE').read_text().strip()
    if not license_text.startswith('MIT License'):
        raise ValueError('The distribution requires the project MIT license.')
    html, notices = re.subn(r'<!doctype html>',
                           lambda m: m[0] + '\n<!--\n' + license_text + '\n-->',
                           html, count=1, flags=re.I)
    if notices != 1:
        raise ValueError('Could not include the license notice in the portable HTML.')
    if re.search(r'''(?:href|src)=["']assets/[^"']+\.pdf(?:[?#][^"']*)?["']''', html, re.I):
        raise ValueError('La distribuzione non deve includere collegamenti ai PDF locali del corso.')
    scripts = []
    def script(match):
        path = match[1].split('?')[0]
        source = (ROOT / path).read_text()
        if re.search(r'</script', source, re.I):
            raise ValueError(f'Unsafe inline script terminator in {path}')
        scripts.append(source)
        return ''
    html = re.sub(r'<script defer src="([^"]+)"></script>', script, html)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>' + (ROOT / m[1].split('?')[0]).read_text() + '</style>', html)
    html = re.sub(r'[ \t]+$', '', html, flags=re.M)
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() + "'" for s in scripts]
    html = html.replace("script-src 'self' file:", 'script-src ' + ' '.join(hashes))
    html = html.replace('</body>', ''.join('<script>' + s + '</script>\n' for s in scripts) + '</body>')
    if re.search(r'data:application/pdf|JVBERi0', html, re.I):
        raise ValueError('La distribuzione non deve incorporare documenti PDF.')
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    destination = output / 'Circuit Lab.html'
    destination.write_text(html)
    manifest = {'application': 'Circuit Lab', 'format': 'offline-single-html', 'file': destination.name,
                'bytes': destination.stat().st_size, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
                'scripts': len(scripts), 'network': 'connect-src none', 'course_materials': False,
                'license': 'MIT'}
    (output / 'integrita.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'LICENSE.txt').write_text(license_text + '\n')
    # The student download contains only the app, its instructions and integrity data.
    with zipfile.ZipFile(output / 'Circuit-Lab-offline.zip', 'w') as archive:
        for name in ['Circuit Lab.html', 'LEGGIMI.txt', 'LICENSE.txt', 'integrita.json']:
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, (output / name).read_bytes())
    return destination, manifest

if __name__ == '__main__':
    destination, manifest = build()
    print(f'{destination}\n{manifest["bytes"]} bytes · SHA-256 {manifest["sha256"]}')
