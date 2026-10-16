"""Baut js/data/lessons.js aus den JSON-Dateien, die aus den Notion-Ders-Notları erzeugt wurden.
Aufruf: python tools/build_lessons.py <ordner-mit-batch*.json>
"""
import glob
import json
import os
import sys

src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'js', 'data', 'lessons.js')

ORDER = ['Anatomie', 'Physiologie', 'PT Grundlagen', 'PT Befund', 'O/C', 'Trainingslehre', 'KMT', 'Hygiene', 'PPS']

lessons = []
for f in sorted(glob.glob(os.path.join(src, 'batch*.json'))):
    with open(f, encoding='utf-8') as fh:
        lessons += json.load(fh)

# Im Notion-Wochenplan steht „Zelle“ unter Physiologie
FACH_FIX = {'zelle-organellen': 'Physiologie'}

# Zwei Agenten haben beide „anatomie-1“ vergeben: Allg. Anatomie vs. Anatomie I
for l in lessons:
    if l['id'] == 'anatomie-1':
        if 'Lernmodell' in l['title']:
            l['id'], l['title'] = 'allg-anatomie-1', 'Allg. Anatomie 1 – ' + l['title']
        else:
            l['id'], l['title'] = 'anatomie-i-1', 'Anatomie I 1 – ' + l['title']

seen = set()
for l in lessons:
    l['fach'] = FACH_FIX.get(l['id'], l['fach'])
    assert l['id'] not in seen, 'doppelte id ' + l['id']
    seen.add(l['id'])
    for q in l.get('mcq', []):
        assert len(q['o']) == 4 and len(set(q['o'])) == 4, (l['id'], q['q'])
    for q in l.get('open', []):
        assert q['kw'], (l['id'], q['q'])

# Öffentlich: keine Notion-Links und keine Lehrernamen (die Links landen in private/notion-links.json)
# Die Namensliste liegt in private/teachers.json (nicht veröffentlicht)
import re
PRIV = os.path.join(os.path.dirname(__file__), '..', 'private')
TEACHERS = json.load(open(os.path.join(PRIV, 'teachers.json'), encoding='utf-8')) if os.path.exists(os.path.join(PRIV, 'teachers.json')) else []
import hashlib
links = {}
for l in lessons:
    url = l.pop('notionUrl', None)
    links[l['id']] = url
    # Nur ein Hash der Seiten-ID ist öffentlich – damit findet die App beim Notion-Sync den passenden Link
    if url:
        l['nh'] = hashlib.sha256(url.rstrip('/').split('/')[-1].split('?')[0].replace('-', '').encode()).hexdigest()[:16]
text = json.dumps(lessons, ensure_ascii=False)
text = re.sub(r'Bei (Herrn|Frau) [A-ZÄÖÜ][\wäöüß-]+ gilt', 'Im Unterricht gilt', text)
for t in TEACHERS:
    # typische Formulierungen neutralisieren, danach darf der Name nirgends mehr vorkommen
    text = re.sub(rf"nach (Herrn |Frau )?{t}", 'laut Unterricht', text)
    text = re.sub(rf"{t}['’]?(e|a|ye|ya) göre", 'derste anlatılana göre', text)
    assert t not in text, 'Lehrername im öffentlichen Inhalt: ' + t
lessons = json.loads(text)
os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'private'), exist_ok=True)
with open(os.path.join(os.path.dirname(__file__), '..', 'private', 'notion-links.json'), 'w', encoding='utf-8') as fh:
    json.dump(links, fh, ensure_ascii=False, indent=1)

lessons.sort(key=lambda l: (ORDER.index(l['fach']) if l['fach'] in ORDER else 99, l['id']))

with open(out, 'w', encoding='utf-8') as fh:
    fh.write('// Automatisch erzeugt aus den Notion-Ders-Notları (tools/build_lessons.py) – nicht von Hand bearbeiten.\n')
    fh.write('export const LESSONS = ')
    json.dump(lessons, fh, ensure_ascii=False, indent=1)
    fh.write(';\n')

print(len(lessons), 'Lektionen ->', os.path.abspath(out))
for l in lessons:
    print(f"  {l['fach']:15} {l['id']:28} kern={len(l['kern'])} mcq={len(l['mcq'])} open={len(l['open'])} vocab={len(l['vocab'])}")
