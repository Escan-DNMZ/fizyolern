// Tests für den Morgentest „nur die Fächer des Tages“: Fachnamen-Aliase, Vortags-Themen, fällige Fehler, kurzer Test.
// Fall wie Di 03.11.2026: Plan „Sabah testi: Physiologie + Hygiene“, Montag war Anatomie + PT Befund + O/C.
// Aufruf: node tools/test_morning.mjs   (erfundene Testdaten, keine echten Schulinhalte)
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const FIXED = new Date(2026, 10, 3, 7, 30).getTime(); // Di 03.11.2026, 07:30
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(FIXED); }
  static now() { return FIXED; }
};
const MON = new Date(2026, 10, 2, 16, 0).toISOString(); // Montag: neue Zeilen nach dem Unterricht

const row = (h, fach, lektion, i, created) => ({ h, fach, lektion, typ: 'MCQ', frage: `${lektion} Frage ${i}?`, antwort: `R${i}`, ablenker: [`A${i}`, `B${i}`, `C${i}`], erkl: '', kw: [], ...(created ? { created } : {}) });
const hex = (k, i) => (k + String(i).padStart(15, '0')).slice(0, 16);
const PRIVATE = {
  kind: 'fizyolern-private', version: 2,
  weeks: [{ kw: 45, range: '', from: '2026-11-02', to: '2026-11-08', days: {
    1: { kurse: ['ANA 1 + O/C (R5)', 'PT-Befund ×2 (R5)'], test: ['Anatomie', 'PT Befund', 'O/C'], note: '' },
    2: { kurse: ['Hygiene ×2 (R2)', 'Physiologie + AM (R2)'], test: ['Physiologie', 'Hygiene'], note: '' },
  } }],
  lessonRows: [
    ...[...Array(8)].map((_, i) => row(hex('a', i), 'PT-Befund', 'PT Befund 5 – Knie', i, MON)), // Montag, anderes Fach, Fach mit Bindestrich
    ...[...Array(5)].map((_, i) => row(hex('b', i), 'Hygiene', 'Hygiene Neu', i, MON)),          // Montag, Fach des Tages
    ...[...Array(3)].map((_, i) => row(hex('c', i), 'Atemtherapie', 'Atmung', i, MON)),          // Fach mit wenigen Fragen
  ],
};
const mem = { 'fizyo.private': JSON.stringify(PRIVATE) };
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const F = await imp('js/faecher.js');
const store = await imp('js/store.js');
const L = await imp('js/lessons.js');
const Q = await imp('js/quizgen.js');
const N = await imp('js/notion.js');

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const RUNS = 150;

// ───── Fachnamen ─────
const canon = { 'PT-Befund': 'PT Befund', 'pt befund': 'PT Befund', PTBefund: 'PT Befund', 'ANA 1': 'Anatomie', 'All ANA ×2': 'Anatomie', 'Allg. Anatomie': 'Anatomie', 'Anatomie I': 'Anatomie', OC: 'O/C', 'O/C': 'O/C', 'PT-Grundlagen': 'PT Grundlagen', 'Trainingslehre 3': 'Trainingslehre', 'Hygiene ×2': 'Hygiene', Atemtherapie: 'Atemtherapie', AM: 'AM' };
for (const [a, b] of Object.entries(canon)) ok(F.canonFach(a) === b, `canonFach(${a}) = ${b} (bekommen ${F.canonFach(a)})`);
ok(JSON.stringify(F.faecherInText('ANA 1 + O/C (Hr. X, R6)')) === '["Anatomie","O/C"]', 'Kursname „ANA 1 + O/C“ → Anatomie, O/C');
ok(JSON.stringify(F.faecherInText('Physiologie + AM (R2)')) === '["Physiologie"]', 'Kursname „Physiologie + AM“ → Physiologie (AM ist kein Fach der App)');
ok(JSON.stringify(Q.kursFaecher(['All ANA ×2 (R2)', 'PT-Befund ×2 (R6)'])) === '["Anatomie","PT Befund"]', 'kursFaecher mit Kurzformen');
// Wochenplan: „Sabah testi: PT-Befund + Allg. Anatomie“
const rt = (t) => ({ plain_text: t, annotations: { bold: false } });
const plan = await N.parsePlanPage([
  { type: 'heading_2', heading_2: { rich_text: [rt('Week 45 (02.–06.11.2026)')] } },
  { type: 'table', id: 't', table: { has_column_header: true } },
], L.FAECHER, async () => [['Day', 'Class 1', 'Class 2', 'Review', 'Notes'], ['Mon', 'ANA 1', 'PT-Befund', 'Morning test: PT-Befund + Allg. Anatomie', '']].map((r) => ({ type: 'table_row', table_row: { cells: r.map((c) => [rt(c)]) } })));
ok(JSON.stringify([...plan.weeks[0].days[1].test].sort()) === '["Anatomie","PT Befund"]', 'Plan: „Morning test: PT-Befund + Allg. Anatomie“ → Anatomie, PT Befund');
// Notion-Zeile „PT-Befund“ landet im Fach „PT Befund“ (kein zweites Fach)
ok(L.FAECHER.includes('PT Befund') && !L.FAECHER.includes('PT-Befund'), 'Fach „PT-Befund“ aus Notion → „PT Befund“');
const knie = L.LESSONS.find((l) => l.title === 'PT Befund 5 – Knie');
ok(knie && knie.fach === 'PT Befund', 'neue Lektion „PT Befund 5 – Knie“ gehört zu PT Befund');

// ───── Morgentest Di 03.11.: nur Physiologie + Hygiene ─────
const KAT = 'Ders: Physiologie,Hygiene';
const TODAY = ['Physiologie', 'Hygiene'];
const KNIE = new Set(Q.lessonMcq(knie).map((q) => q.id));
const HYGNEU = new Set(Q.lessonMcq(L.LESSONS.find((l) => l.title === 'Hygiene Neu')).map((q) => q.id));
let offTopic = 0, knieSeen = 0, minHygNeu = 99;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz(KAT, 10, [], { morning: true });
  offTopic += qs.filter((q) => !TODAY.includes(q.cat)).length;
  knieSeen += qs.filter((q) => KNIE.has(q.id)).length;
  minHygNeu = Math.min(minHygNeu, qs.filter((q) => HYGNEU.has(q.id)).length);
}
ok(offTopic === 0, `ohne fällige Fehler: keine fachfremden Fragen (bekommen ${offTopic})`);
ok(knieSeen === 0, 'neue Montags-Lektion eines anderen Fachs (PT Befund 5 – Knie) kommt nicht');
ok(minHygNeu >= 3, `neue Montags-Themen aus Hygiene kommen (min. ${minHygNeu})`);
// Im PT-Befund-Morgentest kommt die neue Knie-Lektion dagegen sicher (neue Themen nicht vernachlässigen)
let minKnie = 99;
for (let k = 0; k < RUNS; k++) minKnie = Math.min(minKnie, Q.buildQuiz('Ders: PT Befund', 10, [], { morning: true }).filter((q) => KNIE.has(q.id)).length);
ok(minKnie >= 6, `PT-Befund-Tag: neue Lektion „Knie“ mind. 60 % (min. ${minKnie})`);

// ───── fällige Fehler: Tagesfächer zuerst, andere höchstens 2 Plätze, mit „Tekrar · Fach“ ─────
const s = store.get();
const all = Q.ALL_LESSON_MCQ();
const pick = (f, i = 0) => all.filter((q) => q.cat === f)[i];
const wrongYesterday = (q) => { s.quiz[q.id] = { r: 0, w: 1, st: 0, last: store.today(-1), lastWrong: store.today(-1), okDays: [] }; };
const physioDue = pick('Physiologie');
const otherDue = [pick('Anatomie'), pick('Anatomie', 1), pick('Trainingslehre'), pick('O/C')];
[physioDue, ...otherDue].forEach(wrongYesterday);
let slotsOk = true, labelOk = true, maxOther = 0;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz(KAT, 10, [], { morning: true });
  const head = qs.slice(0, 3);
  if (qs.length !== 10 || head[0].id !== physioDue.id && head[1].id !== physioDue.id && head[2].id !== physioDue.id) slotsOk = false;
  const other = qs.filter((q) => !TODAY.includes(q.cat));
  maxOther = Math.max(maxOther, other.length);
  if (!other.every((q) => /^Tekrar · (Anatomie|Trainingslehre|O\/C)$/.test(q.badge))) labelOk = false;
  if (!head.every((q) => q.badge && q.badge.startsWith('Tekrar · '))) labelOk = false;
}
ok(slotsOk, 'fälliger Physiologie-Fehler hat einen festen Platz vorne');
ok(maxOther === 2, `andere Fächer höchstens 2 Plätze (max. ${maxOther})`);
ok(labelOk, 'fällige Fehler zeigen „Tekrar · <Fach>“');
const short = Q.buildQuiz(KAT, 5, [], { morning: true });
ok(short.filter((q) => !TODAY.includes(q.cat)).length <= 1, 'kurzer Test (n=5): andere Fächer höchstens 1 Platz');

// ───── zu wenig Fragen im Fach → kürzerer Test, nicht fachfremd auffüllen ─────
for (const q of otherDue) delete s.quiz[q.id];
// fälliger Fehler eines anderen Fachs darf (beschriftet) einen Platz nehmen, sonst nichts Fachfremdes
const atem1 = Q.buildQuiz('Ders: Atemtherapie', 10, [], { morning: true });
ok(atem1.length === 4 && atem1.filter((q) => q.cat !== 'Atemtherapie').every((q) => q.badge === 'Tekrar · Physiologie'), `Fach mit 3 Fragen + 1 fälliger Fehler → 4 Fragen (bekommen ${atem1.length})`);
delete s.quiz[physioDue.id];
const atem = Q.buildQuiz('Ders: Atemtherapie', 10, [], { morning: true });
ok(atem.length === 3 && atem.every((q) => q.cat === 'Atemtherapie'), `Fach mit 3 Fragen → Test mit 3 Fragen, nichts aufgefüllt (bekommen ${atem.length})`);

console.log(fail ? `\n${fail} von ${n} FEHLGESCHLAGEN` : `Alle ${n} Morgentest-Tests bestanden`);
process.exit(fail ? 1 : 0);
