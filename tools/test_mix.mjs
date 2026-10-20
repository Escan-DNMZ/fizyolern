// Tests für die Testmischung: neue Themen (letzte 7 Tage) ≥ 60 %, ungestellte zuerst, Vortags-Themen im Morgentest.
// Aufruf: node tools/test_mix.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const pad = (x) => String(x).padStart(2, '0');
const dayIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ago = (k) => { const d = new Date(); d.setDate(d.getDate() - k); d.setHours(12, 0, 0, 0); return d.toISOString(); };
// letzter Schultag (wie quizgen.prevSchoolDay), mittags
const prev = new Date(); do prev.setDate(prev.getDate() - 1); while (prev.getDay() === 0 || prev.getDay() === 6);
prev.setHours(12, 0, 0, 0);

const row = (h, fach, lektion, created, i) => ({ h, fach, lektion, typ: 'MCQ', frage: `${lektion} Frage ${i}?`, antwort: `R${i}`, ablenker: [`A${i}`, `B${i}`, `C${i}`], erkl: '', kw: [], ...(created ? { created } : {}) });
const hex = (k, i) => (k + String(i).padStart(15, '0')).slice(0, 16);
const rows = [
  ...[...Array(12)].map((_, i) => row(hex('a', i), 'Physiologie', 'Energiegewinnung', ago(4), i)), // diese Woche
  ...[...Array(6)].map((_, i) => row(hex('b', i), 'Hygiene', 'Neu Hygiene', prev.toISOString(), i)), // Vortag, anderes Fach
  ...[...Array(10)].map((_, i) => row(hex('c', i), 'Physiologie', 'Alt Physio', ago(30), i)), // alt
  row(hex('d', 0), 'Physiologie', 'Alt Physio', 'gestern', 99), // ungültiges Datum → fällt weg
];
const mem = { 'fizyo.private': JSON.stringify({ kind: 'fizyolern-private', lessonRows: rows }) };
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const store = await imp('js/store.js');
const { getPrivate, cleanPrivate } = await imp('js/private.js');
const { LESSONS } = await imp('js/lessons.js');
const Q = await imp('js/quizgen.js');
const N = await imp('js/notion.js');

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const RUNS = 200;

// created wird geprüft und gespeichert
const priv = getPrivate();
ok(priv.lessonRows.length === 29 && priv.lessonRows.filter((r) => r.created).length === 28, 'cleanPrivate: gültige created bleiben, „gestern“ fällt weg');
ok(!cleanPrivate({ kind: 'fizyolern-private', lessonRows: [{ ...rows[0], created: { x: 1 } }] }).lessonRows[0].created, 'cleanPrivate: created kein String → weg');
const fromNotion = await N.rowsFromPages([{ id: 'abc', created_time: '2026-10-20T08:15:00.000Z', properties: { Frage: { type: 'title', title: [{ plain_text: 'X?' }] }, Typ: { type: 'select', select: { name: 'Kern' } }, Fach: { type: 'select', select: { name: 'Hygiene' } } } }]);
ok(fromNotion[0].created === '2026-10-20T08:15:00.000Z', 'rowsFromPages: created_time wird mitgespeichert');

const energie = LESSONS.find((l) => l.title === 'Energiegewinnung');
ok(energie && energie.notionOnly && energie.created === ago(4), 'Notion-Lektion bekommt created der ältesten Zeile');
const ids = (title) => Q.lessonMcq(LESSONS.find((l) => l.title === title)).map((q) => q.id);
const NEW = new Set(ids('Energiegewinnung')), HYG = new Set(ids('Neu Hygiene')), OLD = new Set(ids('Alt Physio'));
ok(NEW.size === 12 && HYG.size === 6 && OLD.size === 11, 'Fragen-ids der Testlektionen');
ok(Q.recentQuestions().length === 18, `recentQuestions: 18 neue Fragen (bekommen ${Q.recentQuestions().length})`);

// Viele ✗ in alten Fragen – trotzdem ≥ 60 % neue Themen
const quiz = store.get().quiz;
for (const q of Q.ALL_LESSON_MCQ()) if (q.cat === 'Physiologie' && !NEW.has(q.id)) quiz[q.id] = { r: 1, w: 4, st: 0, last: store.today(-2) };
let minNew = 99, maxOld = 0, sizes = new Set(), hyg = 0;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz('Ders: Physiologie', 10);
  sizes.add(qs.length);
  const nn = qs.filter((q) => NEW.has(q.id)).length;
  minNew = Math.min(minNew, nn); maxOld = Math.max(maxOld, qs.length - nn);
  hyg += qs.filter((q) => HYG.has(q.id)).length;
}
ok(sizes.size === 1 && sizes.has(10), 'Test hat immer 10 Fragen');
ok(minNew >= 6, `mind. 60 % neue Themen (min. ${minNew}/10)`);
ok(maxOld <= 4, `höchstens 40 % Wiederholung (max. ${maxOld}/10)`);
ok(hyg === 0, 'ohne Morgentest keine fremden Fächer');

// Ungestellte Fragen vor schon gestellten neuen Fragen
const newIds = [...NEW];
for (const id of newIds.slice(0, 6)) quiz[id] = { r: 1, w: 0, st: 1, last: store.today(-3) };
const unasked = new Set(newIds.slice(6));
let allUnasked = true;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz('Ders: Physiologie', 10);
  if (![...unasked].every((id) => qs.some((q) => q.id === id))) allUnasked = false;
}
ok(allUnasked, 'alle 6 ungestellten neuen Fragen kommen in jedem Test');

// Gemischt: neue Themen landen im Pool, auch wenn die Stichprobe sie verpasst
let mixNew = 99;
for (let k = 0; k < RUNS; k++) mixNew = Math.min(mixNew, Q.buildQuiz('Gemischt', 10).filter((q) => NEW.has(q.id) || HYG.has(q.id)).length);
ok(mixNew >= 6, `Gemischt: mind. 60 % neue Themen (min. ${mixNew}/10)`);

// Zu wenig neue Fragen → mit Wiederholung auffüllen (mixQuiz direkt)
const mk = (id, created) => ({ id, q: id, o: ['a', 'b', 'c', 'd'], a: 0, ...(created ? { created } : {}) });
const few = [mk('T:n1', ago(1)), mk('T:n2', ago(2)), ...[...Array(20)].map((_, i) => mk('T:o' + i))];
const filled = Q.mixQuiz(few, 10, () => 1);
ok(filled.length === 10 && ['T:n1', 'T:n2'].every((id) => filled.some((q) => q.id === id)), 'zu wenig neue → beide neuen + 8 Wiederholungen');
const onlyNew = Q.mixQuiz([...[...Array(20)].map((_, i) => mk('T:x' + i, ago(1)))], 10, () => 1);
ok(onlyNew.length === 10, 'nur neue Fragen → 10 neue');
const onlyOld = Q.mixQuiz([...[...Array(5)].map((_, i) => mk('T:y' + i))], 10, () => 1);
ok(onlyOld.length === 5, 'weniger Fragen als n → alle');

// Morgentest: Fach des Tages zuerst, Vortags-Themen (anderes Fach) immer dabei, am Ende
let morningOk = true, minHyg = 99, minNewM = 99;
for (let k = 0; k < RUNS; k++) {
  const qs = Q.buildQuiz('Ders: Physiologie', 10, [], { morning: true });
  const h = qs.filter((q) => HYG.has(q.id)).length;
  minHyg = Math.min(minHyg, h);
  minNewM = Math.min(minNewM, qs.filter((q) => NEW.has(q.id) || HYG.has(q.id)).length);
  if (qs.length !== 10 || !qs.slice(-h).every((q) => HYG.has(q.id)) || !qs.slice(0, 10 - h).every((q) => q.cat === 'Physiologie')) morningOk = false;
}
ok(minHyg === 3, `Morgentest: 3 Vortags-Fragen aus Hygiene (min. ${minHyg})`);
ok(morningOk, 'Morgentest: erst Physiologie, dann Vortags-Themen');
ok(minNewM >= 6, `Morgentest: mind. 60 % neue Themen (min. ${minNewM}/10)`);

// Wochenplan: neueste mitgelieferte Lektion eines Fachs gilt als am Unterrichtstag behandelt
const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
const wk = { kw: 1, range: '', from: dayIso(mon), to: dayIso(new Date(mon.getTime() + 6 * 864e5)), days: { 1: { kurse: ['Trainingslehre (R2)'], test: [], note: '' } } };
mem['fizyo.private'] = JSON.stringify({ ...priv, weeks: [wk] });
const P2 = await import(pathToFileURL(path.join(root, 'js/private.js')).href);
P2.setPrivate({ ...priv, weeks: [wk], syncedAt: 'x' });
const tl = Q.ALL_LESSON_MCQ().filter((q) => q.cat === 'Trainingslehre');
const latest = Math.max(...LESSONS.filter((l) => l.fach === 'Trainingslehre' && !l.notionOnly).map((l) => Number((l.id.match(/(\d+)$/) || [0, 0])[1])));
ok(tl.filter((q) => Q.isRecent(q)).every((q) => q.lesson === 'trainingslehre-' + latest) && tl.some((q) => Q.isRecent(q)), `Wochenplan: nur trainingslehre-${latest} ist neu`);

console.log(fail ? `\n${fail} von ${n} FEHLGESCHLAGEN` : `Alle ${n} Mischungs-Tests bestanden`);
process.exit(fail ? 1 : 0);
