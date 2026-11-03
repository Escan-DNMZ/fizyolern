// Tests für den Rückweg-Test: heute in Notion angelegte Fragen zuerst (neueste zuerst, ungestellte vor gestellten),
// höchstens 10, zu wenige → mit Fragen der gelesenen Lektion auffüllen; Morgentest und andere Tests unverändert.
// Aufruf: node tools/test_donusquiz.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ago = (k, h = 12) => { const d = new Date(); d.setDate(d.getDate() - k); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const row = (h, fach, lektion, created, i) => ({ h, fach, lektion, typ: 'MCQ', frage: `${lektion} Frage ${i}?`, antwort: `R${i}`, ablenker: [`A${i}`, `B${i}`, `C${i}`], erkl: '', kw: [], ...(created ? { created } : {}) });
const kern = (h, fach, lektion) => ({ h, fach, lektion, typ: 'Kern', frage: `${lektion} Kernsatz`, antwort: 'Satz', ablenker: [], erkl: '', kw: [] });
const hex = (k, i) => (k + String(i).padStart(15, '0')).slice(0, 16);
const few = [
  kern(hex('k', 0), 'Physiologie', 'Heute Physio'),
  // heute angelegt, zu unterschiedlichen Uhrzeiten (0:00 – 2:00 Uhr, damit es auch kurz nach Mitternacht „heute“ bleibt)
  ...[0, 1, 2].map((i) => row(hex('a', i), 'Physiologie', 'Heute Physio', ago(0, i), i)),
  kern(hex('k', 1), 'Physiologie', 'Alt Physio'),
  ...[...Array(10)].map((_, i) => row(hex('c', i), 'Physiologie', 'Alt Physio', ago(30), i)),
];
const mem = { 'fizyo.private': JSON.stringify({ kind: 'fizyolern-private', lessonRows: few }) };
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const store = await imp('js/store.js');
const P = await imp('js/private.js');
const { LESSONS, refreshLessons } = await imp('js/lessons.js');
const Q = await imp('js/quizgen.js');

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const lesson = (title) => LESSONS.find((l) => l.title === title);
const ids = (title) => new Set(Q.lessonMcq(lesson(title)).map((q) => q.id));
const RUNS = 100;

// 1) Wenige neue Fragen: alle 3 kommen, Rest aus der gelesenen (alten) Lektion
const TODAY = ids('Heute Physio'), OLD = ids('Alt Physio');
ok(Q.createdToday().length === 3, `createdToday: 3 (bekommen ${Q.createdToday().length})`);
ok(Q.createdToday()[0].q.endsWith('Frage 2?'), 'createdToday: neueste zuerst');
const altKat = 'Lektion: ' + lesson('Alt Physio').id;
let allToday = true, sizes = new Set(), onlyKnown = true;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz(altKat, 5, [], { donus: true });
  sizes.add(qs.length);
  if ([...TODAY].some((id) => !qs.some((q) => q.id === id))) allToday = false;
  if (qs.some((q) => !TODAY.has(q.id) && !OLD.has(q.id))) onlyKnown = false;
}
ok(sizes.size === 1 && sizes.has(5), `Rückweg-Test hat 5 Fragen (${[...sizes]})`);
ok(allToday, 'alle 3 heute angelegten Fragen kommen, auch wenn eine andere Lektion gelesen wurde');
ok(onlyKnown, 'Rest nur aus der gelesenen Lektion');

// ohne donus (z. B. normaler Lektionstest) bleibt alles wie vorher: nur die Lektion selbst
let leak = false;
for (let k = 0; k < RUNS; k++) if (Q.buildQuiz(altKat, 5).some((q) => TODAY.has(q.id))) leak = true;
ok(!leak, 'normaler Lektionstest ohne donus: keine fremden heutigen Fragen');

// 2) Viele neue Fragen (14, zwei Fächer): höchstens 10, ungestellte vor gestellten
const many = [
  ...few,
  kern(hex('k', 2), 'Hygiene', 'Heute Hygiene'),
  ...[...Array(11)].map((_, i) => row(hex('b', i), 'Hygiene', 'Heute Hygiene', ago(0, 0), i)),
];
P.setPrivate({ kind: 'fizyolern-private', lessonRows: many }); refreshLessons();
ok(Q.createdToday().length === 14, `createdToday: 14 (bekommen ${Q.createdToday().length})`);
const quiz = store.get().quiz;
const all = Q.createdToday().map((q) => q.id);
const asked = new Set(all.slice(0, 6));
for (const id of asked) quiz[id] = { r: 1, w: 0, st: 1, last: store.today(-1) };
let max = 0, unaskedIn = true;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz(altKat, 5, [], { donus: true });
  max = Math.max(max, qs.length);
  if (all.filter((id) => !asked.has(id)).some((id) => !qs.some((q) => q.id === id))) unaskedIn = false;
}
ok(max === Q.DONUS_MAX, `höchstens ${Q.DONUS_MAX} Fragen (max. ${max})`);
ok(unaskedIn, 'alle 8 noch nie gestellten neuen Fragen sind dabei');

// 3) Gestern angelegte Fragen zählen nicht als „heute“
P.setPrivate({ kind: 'fizyolern-private', lessonRows: [kern(hex('k', 0), 'Physiologie', 'X'), row(hex('e', 0), 'Physiologie', 'X', ago(1), 0)] }); refreshLessons();
ok(Q.createdToday().length === 0, 'gestern angelegte Frage ist nicht „heute“');

console.log(fail ? `${fail} von ${n} Rückweg-Test-Tests fehlgeschlagen` : `Alle ${n} Rückweg-Test-Tests bestanden`);
process.exit(fail ? 1 : 0);
