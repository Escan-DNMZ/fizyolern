"""Baut models/bones.glb und models/muscles.glb aus BodyParts3D (DBCLS, CC BY 4.0).

Quelle: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
  isa_BP3D_4.0_obj_99.zip  (Muskeln + Knochen, IS-A-Baum)
  partof_BP3D_4.0_obj_99.zip  (zusätzliche Teile, PART-OF-Baum)
Aufruf:
  python tools/build_bp3d.py <isa-obj-ordner> <partof-obj-ordner> <ausgabe-ordner>
Danach mit gltf-transform komprimieren (siehe tools/compress_models.sh).

Jedes Mesh im GLB heißt „<struktur-id>|<Originalname>“; die App ordnet es darüber zu.
Koordinaten bleiben wie in BodyParts3D (mm, z oben, vorne = -y); die App rechnet um.
"""
import json
import os
import re
import struct
import sys

ISA, PARTOF, OUT = sys.argv[1:4]

SIDES = ['Right', 'Left']

def sided(*names):
    """'{s}' wird durch right/left ersetzt (am Satzanfang groß)."""
    out = []
    for n in names:
        for s in SIDES:
            out.append(n.replace('{S}', s).replace('{s}', s.lower()))
    return out

ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth']
FINGERS = ['thumb', 'index finger', 'middle finger', 'ring finger', 'little finger']
TOES = ['big toe', 'second toe', 'third toe', 'fourth toe', 'little toe']

BONES = {
    'cranium': ['Frontal bone', 'Occipital bone', 'Sphenoid bone', 'Ethmoid', 'Vomer']
               + sided('{S} parietal bone', '{S} temporal bone', '{S} maxilla', '{S} zygomatic bone', '{S} nasal bone',
                       '{S} lacrimal bone', '{S} palatine bone', '{S} inferior nasal concha'),
    'mandibula': ['Mandible'],
    'hws': ['Atlas', 'Axis'] + [f'{o} cervical vertebra' for o in ORDINALS[2:7]],
    'bws': [f'{o} thoracic vertebra' for o in ORDINALS],
    'lws': [f'{o} lumbar vertebra' for o in ORDINALS[:5]],
    'sacrum': ['Sacrum'],  # Steißbein gibt es in BodyParts3D nicht
    'sternum': ['Manubrium', 'Body of sternum', 'Xiphoid process'],
    'costae': sided(*[f'{{S}} {o.lower()} rib' for o in ORDINALS]) + sided(*[f'{{S}} {o.lower()} costal cartilage' for o in ORDINALS[:7]]),  # 8.–10. Rippenknorpel fehlen in BodyParts3D
    'clavicula': sided('{S} clavicle'),
    'scapula': sided('{S} scapula'),
    'humerus': sided('{S} humerus'),
    'radius': sided('{S} radius'),
    'ulna': sided('{S} ulna'),
    'carpus': sided('{S} scaphoid', '{S} lunate', '{S} triquetral', '{S} pisiform', '{S} trapezium', '{S} trapezoid', '{S} capitate', '{S} hamate'),
    'manus': sided(*[f'{{S}} {o} metacarpal bone' for o in ['first', 'second', 'third', 'fourth', 'fifth']])
             + sided(*[f'{p} phalanx of {{s}} {f}' for f in FINGERS for p in ['Proximal', 'Middle', 'Distal'] if not (p == 'Middle' and f == 'thumb')]),
    'os_coxae': sided('{S} hip bone'),
    'femur': sided('{S} femur'),
    'patella': sided('{S} patella'),
    'tibia': sided('{S} tibia'),
    'fibula': sided('{S} fibula'),
    'talus': sided('{S} talus'),
    'calcaneus': sided('{S} calcaneus'),
    'pes': sided('Navicular bone of {s} foot', '{S} cuboid bone', '{S} medial cuneiform bone', '{S} intermediate cuneiform bone', '{S} lateral cuneiform bone')
           + sided(*[f'{{S}} {o} metatarsal bone' for o in ['first', 'second', 'third', 'fourth', 'fifth']])
           + sided(*[f'{p} phalanx of {{s}} {t}' for t in TOES for p in ['Proximal', 'Middle', 'Distal'] if not (p == 'Middle' and t == 'big toe')]),
}

MUSCLES = {
    'deltoideus': sided('Acromial part of {s} deltoid', 'Clavicular part of {s} deltoid', 'Spinal part of {s} deltoid'),
    'biceps_brachii': sided('Long head of {s} biceps brachii', 'Short head of {s} biceps brachii'),
    'brachialis': sided('{S} brachialis'),
    'triceps_brachii': sided('Lateral head of {s} triceps brachii', 'Long head of {s} triceps brachii', 'Medial head of {s} triceps brachii'),
    'brachioradialis': sided('{S} brachioradialis'),
    'flexor_carpi_radialis': sided('{S} flexor carpi radialis'),
    'extensor_carpi_radialis_longus': sided('{S} extensor carpi radialis longus'),
    'extensor_digitorum': sided('{S} extensor digitorum'),
    'flexor_digitorum_superficialis': sided('{S} flexor digitorum superficialis'),
    'flexor_digitorum_profundus': sided('{S} flexor digitorum profundus'),
    'pectoralis_major': sided('Abdominal part of {s} pectoralis major', 'Clavicular part of {s} pectoralis major', 'Sternocostal part of {s} pectoralis major'),
    'serratus_anterior': sided('{S} serratus anterior'),
    'trapezius': sided('Ascending part of {s} trapezius', 'Descending part of {s} trapezius', 'Transverse part of {s} trapezius'),
    'rhomboidei': sided('{S} rhomboid major', '{S} rhomboid minor'),
    'supraspinatus': sided('{S} supraspinatus'),
    'infraspinatus': sided('{S} infraspinatus muscle'),
    'teres_minor': sided('{S} teres minor'),
    'teres_major': sided('{S} teres major'),
    'subscapularis': sided('{S} subscapularis'),
    'sternocleidomastoideus': sided('{S} sternocleidomastoid'),
    'obliquus_externus': sided('{S} external oblique'),
    'erector_spinae': sided('{S} iliocostalis lumborum', '{S} iliocostalis thoracis', '{S} longissimus thoracis', '{S} spinalis thoracis'),
    'diaphragma': ['Diaphragm'],
    'iliopsoas': sided('{S} psoas major', '{S} iliacus'),
    'gluteus_maximus': sided('{S} gluteus maximus'),
    'gluteus_medius': sided('{S} gluteus medius'),
    'tensor_fasciae_latae': sided('{S} tensor fasciae latae', '{S} iliotibial tract'),
    'piriformis': sided('{S} piriformis'),
    'gluteus_minimus': sided('{S} gluteus minimus'),
    'gemellus_superior': sided('{S} gemellus superior'),
    'obturatorius_internus': sided('{S} obturator internus'),
    'gemellus_inferior': sided('{S} gemellus inferior'),
    'obturatorius_externus': sided('{S} obturator externus'),
    'quadratus_femoris': sided('{S} quadratus femoris'),
    'pectineus': sided('{S} pectineus'),
    'adductor_brevis': sided('{S} adductor brevis'),
    'rectus_femoris': sided('{S} rectus femoris'),
    'vastus_lateralis': sided('{S} vastus lateralis'),
    'vastus_medialis': sided('{S} vastus medialis'),
    'vastus_intermedius': sided('{S} vastus intermedius'),
    'sartorius': sided('{S} sartorius'),
    'gracilis': sided('{S} gracilis'),
    'adductor_longus': sided('{S} adductor longus'),
    'adductor_magnus': sided('{S} adductor magnus'),
    'biceps_femoris': sided('Long head of {s} biceps femoris', 'Short head of {s} biceps femoris'),
    'semitendinosus': sided('{S} semitendinosus'),
    'semimembranosus': sided('{S} semimembranosus'),
    'tibialis_anterior': sided('{S} tibialis anterior'),
    'fibularis_longus': sided('{S} fibularis longus'),
    'gastrocnemius': sided('Lateral head of {s} gastrocnemius', 'Medial head of {s} gastrocnemius', '{S} calcaneal tendon'),
    'soleus': sided('{S} soleus'),
    'tibialis_posterior': sided('{S} tibialis posterior'),
}


def index(folder):
    idx = {}
    for f in sorted(os.listdir(folder)):
        if not f.endswith('.obj'):
            continue
        with open(os.path.join(folder, f), encoding='utf-8', errors='replace') as fh:
            for i, line in enumerate(fh):
                if line.startswith('# English name'):
                    name = line.split(':', 1)[1].strip().lower()
                    idx.setdefault(name, []).append(os.path.join(folder, f))
                    break
                if i > 20:
                    break
    return idx


def read_obj(path):
    vs, fs = [], []
    with open(path, encoding='utf-8', errors='replace') as fh:
        for line in fh:
            if line.startswith('v '):
                vs.append(tuple(float(x) for x in line.split()[1:4]))
            elif line.startswith('f '):
                idx = [int(p.split('/')[0]) for p in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    fs.append((idx[0] - 1, idx[k] - 1, idx[k + 1] - 1))
    return vs, fs


def write_glb(meshes, path):
    """meshes: [(name, vertices, faces)] → GLB mit POSITION + Indizes."""
    bin_parts, buffer_views, accessors, gl_meshes, nodes = [], [], [], [], []
    offset = 0

    def add_view(data, target):
        nonlocal offset
        pad = (-len(data)) % 4
        bin_parts.append(data + b'\x00' * pad)
        buffer_views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data), 'target': target})
        offset += len(data) + pad
        return len(buffer_views) - 1

    for name, vs, fs in meshes:
        pos = b''.join(struct.pack('<3f', *v) for v in vs)
        ind = b''.join(struct.pack('<3I', *f) for f in fs)
        mins = [min(v[i] for v in vs) for i in range(3)]
        maxs = [max(v[i] for v in vs) for i in range(3)]
        pv = add_view(pos, 34962)
        accessors.append({'bufferView': pv, 'componentType': 5126, 'count': len(vs), 'type': 'VEC3', 'min': mins, 'max': maxs})
        pa = len(accessors) - 1
        iv = add_view(ind, 34963)
        accessors.append({'bufferView': iv, 'componentType': 5125, 'count': len(fs) * 3, 'type': 'SCALAR'})
        ia = len(accessors) - 1
        gl_meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': pa}, 'indices': ia}]})
        nodes.append({'name': name, 'mesh': len(gl_meshes) - 1})

    bin_data = b''.join(bin_parts)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'FizyoLern build_bp3d.py',
                  'copyright': 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International'},
        'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gl_meshes,
        'accessors': accessors, 'bufferViews': buffer_views, 'buffers': [{'byteLength': len(bin_data)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    with open(path, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_data)))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        fh.write(struct.pack('<II', len(bin_data), 0x004E4942) + bin_data)


def build(groups, idx, out_path):
    meshes, missing = [], []
    for sid, names in groups.items():
        for n in names:
            files = idx.get(n.lower())
            if not files:
                missing.append(f'{sid}: {n}')
                continue
            for k, f in enumerate(files[:2]):  # gleiche Namen können mehrere Teile haben
                vs, fs = read_obj(f)
                if vs and fs:
                    meshes.append((f'{sid}|{n}' + (f'#{k}' if k else ''), vs, fs))
    write_glb(meshes, out_path)
    return meshes, missing


if __name__ == '__main__':
    idx = index(PARTOF)
    for k, v in index(ISA).items():  # IS-A hat Vorrang (vollständiger)
        idx[k] = v
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for label, groups in (('bones', BONES), ('muscles', MUSCLES)):
        meshes, missing = build(groups, idx, os.path.join(OUT, f'{label}_raw.glb'))
        covered = sorted({m[0].split('|')[0] for m in meshes})
        report[label] = {'meshes': len(meshes), 'verts': sum(len(m[1]) for m in meshes), 'covered': covered,
                         'uncovered': sorted(set(groups) - set(covered)), 'missing_parts': missing}
        print(f"{label}: {len(meshes)} meshes, {report[label]['verts']} vertices, ohne Mesh: {report[label]['uncovered']}")
        for m in missing:
            print('   fehlt:', m)
    json.dump(report, open(os.path.join(OUT, 'report.json'), 'w', encoding='utf-8'), indent=1)
