"""Prüft sw.js: alle gecachten Dateien existieren, und jedes importierte Modul ist im Offline-Cache.
Aufruf: python tools/check_sw.py"""
import os
import re
import sys

root = os.path.join(os.path.dirname(__file__), '..')
os.chdir(root)
sw = open('sw.js', encoding='utf-8').read()
files = re.findall(r"'\./([^']*)'", sw)
cached = {f for f in files if f}
missing = [f for f in cached if not os.path.exists(f)]

imports = set()
for folder in ['js', 'js/data']:
    for name in os.listdir(folder):
        if not name.endswith('.js'):
            continue
        src = open(os.path.join(folder, name), encoding='utf-8').read()
        for m in re.findall(r"""(?:from\s*|import\s*\(\s*)['"](\.{1,2}/[^'"]+)['"]""", src):
            imports.add(os.path.normpath(os.path.join(folder, m)).replace(os.sep, '/'))
        for m in re.findall(r"""new URL\(\s*['"](\.{1,2}/[^'"]+)['"]""", src):
            imports.add(os.path.normpath(os.path.join(folder, m)).replace(os.sep, '/') + ' (URL)')
not_cached = sorted(p for p in imports if p.split(' ')[0] not in cached and not p.endswith('/ (URL)'))

print(f'{len(cached)} Dateien im Cache')
print('fehlen auf der Platte:', missing or 'keine')
print('importiert, aber nicht gecacht:', not_cached or 'keine')
sys.exit(1 if missing or not_cached else 0)
