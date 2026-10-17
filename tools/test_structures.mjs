// Test für structuresInText (js/app.js): findet alle Strukturen in einem Text. Aufruf: node tools/test_structures.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const code = src.slice(src.indexOf('// Sammelbegriffe'), src.indexOf('// „🦴 3D'));
const { ALL_STRUCTURES, findStructure } = await import(pathToFileURL(path.join(root, 'js/data/anatomy.js')));
const { LANDMARKS, findLandmark } = await import(pathToFileURL(path.join(root, 'js/data/landmarks.js')));
const findAny = (id) => findStructure(id) || (findLandmark(id) ? { ...findLandmark(id), kind: 'landmark' } : null);
const structuresInText = new Function('ALL_STRUCTURES', 'LANDMARKS', 'findAny', code + '; return structuresInText;')(ALL_STRUCTURES, LANDMARKS, findAny);

const cases = [
  ['Die Mm. gemelli entspringen an der Spina ischiadica und am Tuber ischiadicum', 'gemellus_superior,gemellus_inferior,spina_ischiadica,tuber_ischiadicum'],
  ['die Wirbelsäule (WS)', 'hws,bws,lws,sacrum'],
  ['Der M. sartorius entspringt an der SIAS, der M. rectus femoris an der SIAI.', 'sartorius,sias,rectus_femoris,siai'],
  ['M. tibialis anterior setzt am Os cuneiforme mediale an', 'tibialis_anterior'],           // nicht „Tibia“
  ['Das Hüftgelenk hat 3 Freiheitsgrade', 'art_coxae'],
  ['M. rectus femoris (M. quadriceps femoris)', 'rectus_femoris'],                             // Klammerzusatz zählt nicht
  ['Die ischiocrurale Muskulatur', 'biceps_femoris,semitendinosus,semimembranosus'],
  ['Kräftigung der Rotatorenmanschette', 'supraspinatus,infraspinatus,teres_minor,subscapularis'],
  ['Ansatz am Trochanter major und Trochanter minor', 'trochanter_major,trochanter_minor'],
  ['Heute lernen wir Vokabeln', ''],
];
let fail = 0;
for (const [t, want] of cases) {
  const got = structuresInText(t).map((s) => s.id).join(',');
  if (got !== want) { fail++; console.log('✗', t, '\n   erwartet:', want, '\n   bekommen:', got); }
}
console.log(fail ? `${fail} Fehler` : `Alle ${cases.length} Fälle ok`);
process.exit(fail ? 1 : 0);
