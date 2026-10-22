// Tests für den gespeicherten laufenden Test (store.quizRun): übersteht Neuladen, nur heute, kaputte Daten fallen weg.
// Aufruf: node tools/test_quizrun.mjs
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const store = await import(new URL('../js/store.js', import.meta.url).href);

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };

const q = (k) => ({ id: 'L:x:' + k, cat: 'Physiologie', q: 'Frage ' + k, opts: ['a', 'b', 'c', 'd'], ans: k % 4, x: 'weil', lesson: 'x' });
const run = { date: store.today(), cat: 'Ders: Physiologie', donus: false, qs: [0, 1, 2, 3, 4].map(q), i: 2, right: 1, wrong: [1, 9], answers: { 0: 0, 1: 3, 7: 1, __proto__x: 1 }, finished: false, endAt: 0 };

const s1 = store.sanitize({ srs: {}, days: {}, quizRun: run });
ok(s1.quizRun && s1.quizRun.i === 2 && s1.quizRun.qs.length === 5 && s1.quizRun.cat === 'Ders: Physiologie', 'heutiger Test bleibt erhalten (Frage 3 von 5)');
ok(s1.quizRun.wrong.join() === '1' && JSON.stringify(s1.quizRun.answers) === '{"0":0,"1":3}', 'Fehler-Indizes und Antworten geprüft');
ok(store.sanitize({ srs: {}, days: {}, quizRun: { ...run, date: store.today(-1) } }).quizRun === null, 'Test von gestern wird verworfen');
ok(store.sanitize({ srs: {}, days: {}, quizRun: { ...run, qs: [...run.qs, { id: 'x', q: 'y', opts: ['a'], ans: 3 }] } }).quizRun === null, 'kaputte Frage → kein Fortsetzen');
ok(store.sanitize({ srs: {}, days: {}, quizRun: { ...run, i: 99 } }).quizRun.i === 5, 'Position auf die Fragenzahl begrenzt');
ok(store.sanitize({ srs: {}, days: {} }).quizRun === null, 'alter Stand ohne quizRun');

// Neuladen: gespeichert → nach erneutem Laden noch da
store.get().quizRun = run;
store.save();
const reloaded = store.sanitize(JSON.parse(mem['fizyo.v1']));
ok(reloaded.quizRun && reloaded.quizRun.i === 2 && reloaded.quizRun.right === 1, 'nach Neuladen an derselben Stelle');

console.log(fail ? `\n${fail} von ${n} FEHLGESCHLAGEN` : `Alle ${n} quizRun-Tests bestanden`);
process.exit(fail ? 1 : 0);
