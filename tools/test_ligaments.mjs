// Tests für die Bänder zum Knochen/Gelenk des Tages (js/data/ligaments.js). Aufruf: node tools/test_ligaments.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const { LIGAMENTS, ligamentsFor, ligamentQuestion } = await imp('js/data/ligaments.js');
const { BONES, JOINTS } = await imp('js/data/anatomy.js');

let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('✗', msg); } };

const boneIds = new Set(BONES.map((b) => b.id));
const jointIds = new Set(JOINTS.map((j) => j.id));
// Daten gültig: IDs eindeutig, alle Knochen/Gelenke existieren
ok(new Set(LIGAMENTS.map((l) => l.id)).size === LIGAMENTS.length, 'Band-IDs eindeutig');
for (const l of LIGAMENTS) {
  ok(jointIds.has(l.gelenk), `${l.id}: Gelenk ${l.gelenk} existiert`);
  for (const k of l.knochen) ok(boneIds.has(k), `${l.id}: Knochen ${k} existiert`);
  ok(l.la && l.fn && l.tr, `${l.id}: la/fn/tr gefüllt`);
}
// Zuordnung Knochen und Gelenk
const ids = (s) => ligamentsFor(s).map((l) => l.id);
ok(ids({ id: 'art_coxae', kind: 'joint' }).includes('lig_iliofemorale'), 'Hüftgelenk → Lig. iliofemorale');
ok(ids({ id: 'fibula', kind: 'bone' }).includes('lig_talofibulare_anterius'), 'Fibula → Lig. talofibulare anterius');
ok(ids({ id: 'fibula', kind: 'bone' }).includes('lig_collaterale_fibulare'), 'Fibula → Lig. collaterale fibulare');
ok(!ids({ id: 'art_genus', kind: 'joint' }).includes('lig_iliofemorale'), 'Knie ohne Hüftbänder');
ok(ligamentsFor({ id: 'cranium', kind: 'bone' }).length === 0, 'Schädel: keine Bänder → kein Block');
// Jedes Bein-/Hüftgelenk aus der Folie hat Bänder
for (const j of ['art_coxae', 'art_genus', 'art_talocruralis', 'art_subtalaris']) ok(ligamentsFor({ id: j, kind: 'joint' }).length >= 2, `${j} hat Bänder`);
// Frage: 4 verschiedene Antworten, richtige an ans, deterministisch pro Tag
for (const s of [...BONES.map((b) => ({ ...b, kind: 'bone' })), ...JOINTS.map((j) => ({ ...j, kind: 'joint' }))]) {
  const q = ligamentQuestion(s, '2026-11-04');
  if (!ligamentsFor(s).length) { ok(q === null, `${s.id}: keine Frage ohne Bänder`); continue; }
  ok(q.opts.length === 4 && new Set(q.opts).size === 4, `${s.id}: 4 verschiedene Optionen`);
  ok(q.opts[q.ans] === q.lig.la, `${s.id}: richtige Antwort an ans`);
  ok(q.q.includes(q.lig.fn), `${s.id}: Frage nennt die Funktion`);
  ok(JSON.stringify(q) === JSON.stringify(ligamentQuestion(s, '2026-11-04')), `${s.id}: gleiche Frage am gleichen Tag`);
}
console.log(fail ? `${fail} Fehler` : 'Alle Bänder-Tests ok');
process.exit(fail ? 1 : 0);
