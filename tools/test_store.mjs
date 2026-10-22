// Tests für Migrationen und neue Felder in js/store.js. Aufruf: node tools/test_store.mjs
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
// alter Stand ohne „mig“: Trochanter-minor-Fehler aus dem falsch platzierten Punkt
mem['fizyo.v1'] = JSON.stringify({
  srs: {}, days: { '2026-10-18': { quiz: 3, wrong: ['lm:trochanter_minor', 'lm:sias', 'lm:i:iliopsoas'] } },
  quiz: { 'lm:trochanter_minor': { r: 2, w: 3, st: 1 }, 'lm:i:iliopsoas': { r: 0, w: 1 }, 'lm:sias': { r: 0, w: 2 }, 'lm:siai': { r: 1, w: 2 }, 'lm:o:rectus_femoris': { r: 0, w: 1 } },
});
const root = new URL('../', import.meta.url).href;
const store = await import(root + 'js/store.js');

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('✗', msg); } };

const s = store.get();
ok(s.quiz['lm:trochanter_minor'] && s.quiz['lm:trochanter_minor'].w === 0 && s.quiz['lm:trochanter_minor'].r === 2, 'Trochanter-minor-Fehler gelöscht, Richtige bleiben');
ok(!s.quiz['lm:i:iliopsoas'], 'Iliopsoas-Ansatz nur mit Fehlern → Eintrag weg');
ok(s.quiz['lm:sias'].w === 2, 'andere Punkte unverändert');
ok(s.days['2026-10-18'].wrong.join() === 'lm:sias', 'Fehlerliste des Tages bereinigt');
ok(s.mig.includes('lmTrochMinor2026'), 'Migration gemerkt');
ok(s.quiz['lm:siai'].w === 0 && s.quiz['lm:siai'].r === 1 && !s.quiz['lm:o:rectus_femoris'], 'SIAI-Fehler (falsche Position) gelöscht');
ok(JSON.parse(mem['fizyo.v1']).mig.includes('lmTrochMinor2026'), 'migrierter Stand gespeichert');

// zweiter Lauf: neue Fehler bleiben (Migration läuft nur einmal)
s.quiz['lm:trochanter_minor'].w = 1;
ok(!store.migrate(s) && s.quiz['lm:trochanter_minor'].w === 1, 'Migration läuft nicht zweimal');

// ältere Sicherung einspielen → Migration läuft auch dort
store.replace({ srs: {}, days: {}, quiz: { 'lm:trochanter_minor': { r: 0, w: 4 } } });
ok(!store.get().quiz['lm:trochanter_minor'], 'Migration auch beim Einspielen einer Sicherung');

// Checkliste-Selbsteinschätzung: nur gültige ids/Stufen; Sicherung übernimmt sie
const cs = store.sanitize({ srs: {}, days: {}, ck: { 'ck:0123456789abcdef': { lv: 7, last: '2026-10-19', auto: 1 }, 'ck:kaputt': { lv: 1 }, 'x': { lv: 2 } } });
ok(JSON.stringify(cs.ck) === JSON.stringify({ 'ck:0123456789abcdef': { lv: 3, last: '2026-10-19', auto: true } }), 'ck bereinigt: ' + JSON.stringify(cs.ck));
store.rateCk('ck:0123456789abcdef', 0);
ok(store.get().ck['ck:0123456789abcdef'].lv === 0 && !store.get().ck['ck:0123456789abcdef'].auto, 'rateCk setzt Stufe');
store.rateCk('ck:0123456789abcdef', null);
ok(!store.get().ck['ck:0123456789abcdef'], 'rateCk(null) nimmt zurück');

console.log(fails ? `${fails} Fehler` : 'Alle Store-Tests bestanden.');
process.exit(fails ? 1 : 0);
