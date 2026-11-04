// Tests für Bänder im 3D-Modell (lig3d.js) und Einzelknochen-Namen (boneparts.js).
// Aufruf: node tools/test_lig3d.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const { LIGAMENTS } = await imp('js/data/ligaments.js');
const { LIG3D } = await imp('js/data/lig3d.js');
const { partLatin } = await imp('js/data/boneparts.js');

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const pt = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Jedes Band der Lernliste hat eine 3D-Form, keine 3D-Form ohne Band
for (const l of LIGAMENTS) ok(LIG3D[l.id], `3D-Form fehlt: ${l.id}`);
for (const id of Object.keys(LIG3D)) ok(LIGAMENTS.some((l) => l.id === id), `3D-Form ohne Band: ${id}`);

for (const [id, g] of Object.entries(LIG3D)) {
  ok((g.bands && g.bands.length) || g.ring, `${id}: weder Züge noch Ring`);
  for (const b of g.bands || []) {
    ok(b.length === 2 && pt(b[0]) && pt(b[1]), `${id}: Zug braucht zwei Punkte [x,y,z]`);
    const d = dist(b[0], b[1]);
    ok(d >= 0.005 && d <= 0.15, `${id}: Länge ${Math.round(d * 1000)} mm unplausibel`);
    ok(b.every((p) => p[0] >= 0), `${id}: Punkte müssen auf der linken Körperseite liegen (x ≥ 0)`);
  }
  if (g.ring) ok(pt(g.ring.c) && pt(g.ring.axis) && g.ring.r > 0.003 && g.ring.r < 0.03, `${id}: Ring ungültig`);
  ok(!g.w || (g.w > 0.0005 && g.w < 0.01), `${id}: Dicke w unplausibel`);
}

// Einzelknochen-Namen
const eq = (part, la) => { const r = partLatin(part); ok(r && r.la === la, `${part} → ${la} (bekommen ${r && r.la})`); };
eq('Navicular bone of left foot', 'Os naviculare');
eq('Left cuboid bone', 'Os cuboideum');
eq('Left intermediate cuneiform bone', 'Os cuneiforme intermedium');
eq('Left first metatarsal bone', 'Os metatarsi I');
eq('Right fifth metatarsal bone', 'Os metatarsi V');
eq('Proximal phalanx of left big toe', 'Phalanx proximalis hallucis');
eq('Middle phalanx of left second toe', 'Phalanx media digiti II pedis');
eq('Distal phalanx of right thumb', 'Phalanx distalis pollicis');
eq('Left hamate', 'Os hamatum');
eq('Twelfth thoracic vertebra', 'Vertebra thoracica XII');
eq('Axis', 'Axis (C2)');
eq('Left first costal cartilage', 'Cartilago costalis I');
eq('Body of sternum', 'Corpus sterni');
ok(partLatin('Left femur') === null, 'einzelne Knochen (Femur) brauchen keinen Zusatznamen');
// gleiche Art → gleicher typ (wird in der Fokusansicht nur einmal beschriftet)
ok(partLatin('Left second metatarsal bone').typ === partLatin('Left fourth metatarsal bone').typ, 'Mittelfußknochen: ein typ');
ok(partLatin('Distal phalanx of left big toe').typ === partLatin('Distal phalanx of left little toe').typ, 'Endglieder der Zehen: ein typ');
ok(partLatin('Distal phalanx of left thumb').typ !== partLatin('Distal phalanx of left big toe').typ, 'Hand und Fuß getrennt');

console.log(fail ? `${fail} von ${n} Bänder-3D-Tests fehlgeschlagen` : `Alle ${n} Bänder-3D-Tests bestanden`);
process.exit(fail ? 1 : 0);
