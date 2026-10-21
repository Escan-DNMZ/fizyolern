// Tests für die Fehler-Logik: gelernt = an 2 verschiedenen Tagen richtig, fällige Fehler im Morgentest, Bericht.
// Aufruf: node tools/test_mistakes.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Uhr zum Vorstellen (Tage simulieren)
const RealDate = Date;
let OFF = 0;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + OFF); }
  static now() { return RealDate.now() + OFF; }
};
const nextDay = (k = 1) => { OFF += k * 864e5; };

const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const store = await imp('js/store.js');
const Q = await imp('js/quizgen.js');
const { buildReport } = await imp('js/report.js');

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const st = (id) => store.get().quiz[id];

// ───── Regel 1: gelernt = nach dem letzten Fehler an 2 verschiedenen Tagen richtig ─────
const A = 'T:a';
store.recordQuiz(A, false);
ok(st(A).lastWrong === store.today() && st(A).okDays.length === 0, 'falsch → lastWrong heute, okDays leer');
ok(!store.mistakeDue(st(A)), 'heute falsch → heute noch nicht fällig');
store.recordQuiz(A, true); store.recordQuiz(A, true);
ok(st(A).okDays.length === 1 && !store.mistakeLearned(st(A)), 'zweimal richtig am selben Tag zählt einmal');
nextDay();
store.recordQuiz(A, true);
ok(store.mistakeLearned(st(A)) && store.learnedOn(st(A)) === store.today(), 'richtig an einem zweiten Tag → gelernt');
ok(!store.mistakeDue(st(A)), 'gelernter Fehler ist nicht fällig');
store.recordQuiz(A, false);
ok(!store.mistakeLearned(st(A)) && st(A).okDays.length === 0 && st(A).lastWrong === store.today(), 'neue falsche Antwort setzt zurück');

// ───── Fälligkeit: gestern falsch → heute; danach richtig → 2 Tage später ─────
const B = 'T:b';
store.recordQuiz(B, false);
nextDay();
ok(store.mistakeDue(st(B)), 'gestern falsch → heute fällig');
store.recordQuiz(B, true);
ok(!store.mistakeDue(st(B)), 'heute richtig → nicht mehr fällig');
nextDay();
ok(!store.mistakeDue(st(B)), 'nach 1 Tag noch nicht fällig');
nextDay();
ok(store.mistakeDue(st(B)), 'nach 2 Tagen wieder fällig');
OFF = 0;

// ───── sanitize + Ableitung für alte Stände ─────
const today = store.today(), y = store.today(-1), y3 = store.today(-3);
const legacy = store.sanitize({
  srs: {}, days: { [y3]: { wrong: ['L:x:1'] } },
  quiz: {
    'L:x:1': { r: 2, w: 1, st: 1, last: y },       // Fehler vor 3 Tagen, danach richtig → 1 Tag
    'L:x:2': { r: 0, w: 2, st: 0, last: y },       // zuletzt falsch, nicht in days → lastWrong = last
    'L:x:3': { r: 5, w: 0, st: 5, last: y },       // nie falsch → bleibt ohne Felder
    'L:x:4': { r: 1, w: 1, st: 0, last: y, lastWrong: 'kaputt', okDays: ['2026-13-99x', 7, y3, y3] },
  },
});
ok(!legacy.quiz['L:x:4'].lastWrong && legacy.quiz['L:x:4'].okDays.join() === y3, 'sanitize: ungültige Daten fallen weg, okDays ohne Doppelte');
store.migrate(legacy);
ok(legacy.quiz['L:x:1'].lastWrong === y3 && legacy.quiz['L:x:1'].okDays.join() === y, 'Ableitung: Fehltag aus days[].wrong, letzter richtiger Tag zählt');
ok(legacy.quiz['L:x:2'].lastWrong === y && legacy.quiz['L:x:2'].okDays.length === 0, 'Ableitung: Serie 0 → lastWrong = last');
ok(legacy.quiz['L:x:3'].lastWrong === undefined && legacy.quiz['L:x:3'].r === 5, 'Ableitung: nie falsch → unverändert');
ok(Object.keys(legacy.quiz).length === 4, 'Ableitung löscht nichts');

// ───── Morgentest: 2–3 feste Plätze für fällige Fehler ─────
const s = store.get();
for (const k of Object.keys(s.quiz)) delete s.quiz[k];
const physio = Q.ALL_LESSON_MCQ().filter((q) => q.cat === 'Physiologie');
const hyg = Q.ALL_LESSON_MCQ().filter((q) => q.cat === 'Hygiene');
const dueIds = [physio[0].id, physio[1].id, hyg[0].id, hyg[1].id];
for (const id of dueIds) s.quiz[id] = { r: 0, w: 1, st: 0, last: y, lastWrong: y, okDays: [] };
s.quiz[physio[2].id] = { r: 2, w: 1, st: 2, last: y, lastWrong: y3, okDays: [store.today(-2), y] }; // gelernt
let firstOk = true, learnedSeen = false;
for (let k = 0; k < 100; k++) {
  const qs = Q.buildQuiz('Ders: Physiologie', 10, [], { morning: true });
  const head = qs.slice(0, 3).map((q) => q.id);
  // Fach des Tages zuerst: beide fälligen Physiologie-Fehler + einer aus Hygiene
  if (qs.length !== 10 || !head.includes(physio[0].id) || !head.includes(physio[1].id) || !head.some((id) => id === hyg[0].id || id === hyg[1].id)) firstOk = false;
  if (qs.some((q) => q.id === physio[2].id) && head.includes(physio[2].id)) learnedSeen = true;
}
ok(firstOk, 'Morgentest: 3 fällige Fehler vorne (Fach des Tages zuerst)');
ok(!learnedSeen, 'gelernter Fehler belegt keinen festen Platz');
const five = Q.buildQuiz('Ders: Physiologie', 5, [], { morning: true });
ok(five.slice(0, 2).every((q) => dueIds.includes(q.id)) && five.length === 5, 'kurzer Test (n=5): 2 feste Plätze');
for (const id of dueIds) s.quiz[id].lastWrong = today; // heute falsch → nicht fällig
const none = Q.buildQuiz('Ders: Physiologie', 10, [], { morning: true });
ok(none.length === 10 && Q.dueQuestions(['Physiologie']).length === 0, 'keine fälligen Fehler → alle Plätze für den Rest');

// ───── Bericht ─────
s.days[today] = { ...store.day(), wrong: [physio[0].id] };
const rep = buildReport();
ok(/❌ Henüz öğrenilmemiş hatalar \(4\)/.test(rep), 'Bericht: Überschrift mit Anzahl nicht gelernter Fehler');
ok(rep.includes('Bugün yanlış: 1 soru'), 'Bericht: Hinweis mit heute falsch');
ok(/toplam 1× yanlış · son yanlış: \d\d\.\d\d · son soruluş: \d\d\.\d\d · sonra doğru: 0\/2 gün/.test(rep), 'Bericht: Details pro Zeile');
ok(!rep.includes(physio[2].q), 'Bericht: gelernter Fehler nicht in der Liste');
ok(rep.includes('✅ Bu hafta öğrenilen hatalar (hata → 2 farklı gün doğru): 1'), 'Bericht: diese Woche gelernt');

console.log(fail ? `\n${fail} von ${n} FEHLGESCHLAGEN` : `Alle ${n} Fehler-Tests bestanden`);
process.exit(fail ? 1 : 0);
