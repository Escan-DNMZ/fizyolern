"""Zeigt Knoten, Meshes und Bounding-Boxen einer GLB-Datei.
Aufruf: python tools/inspect_glb.py models/bones.glb
"""
import json
import struct
import sys

with open(sys.argv[1], 'rb') as f:
    data = f.read()
length = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + length])

print('extensionsUsed:', gltf.get('extensionsUsed'))
print('scenes:', [s.get('name') for s in gltf.get('scenes', [])])
print('nodes:', len(gltf.get('nodes', [])), 'meshes:', len(gltf.get('meshes', [])), 'materials:', [m.get('name') for m in gltf.get('materials', [])])
acc = gltf.get('accessors', [])
for i, n in enumerate(gltf.get('nodes', [])):
    line = f"{i:3} {n.get('name')!s:45}"
    if 'children' in n:
        line += f" children={n['children'][:8]}{'…' if len(n['children']) > 8 else ''}"
    for k in ('translation', 'rotation', 'scale'):
        if k in n:
            line += f" {k}={[round(v, 3) for v in n[k]]}"
    if 'mesh' in n:
        m = gltf['meshes'][n['mesh']]
        for p in m['primitives']:
            a = acc[p['attributes']['POSITION']]
            line += f" min={[round(v, 3) for v in a.get('min', [])]} max={[round(v, 3) for v in a.get('max', [])]} verts={a['count']}"
    if 'extras' in n:
        line += f" extras={n['extras']}"
    print(line)
