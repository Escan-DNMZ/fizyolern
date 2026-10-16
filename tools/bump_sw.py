"""Erhöht VERSION in sw.js, damit Handys die neue Version laden. Aufruf: python tools/bump_sw.py"""
import os
import re

p = os.path.join(os.path.dirname(__file__), '..', 'sw.js')
s = open(p, encoding='utf-8').read()
m = re.search(r"fizyolern-v(\d+)", s)
s = s.replace(m.group(0), f"fizyolern-v{int(m.group(1)) + 1}")
open(p, 'w', encoding='utf-8').write(s)
print(f"fizyolern-v{int(m.group(1)) + 1}")
