// Tests für die Ters kartlar (js/reverse.js) und ihre ✗-Liste im Speicher. Aufruf: node tools/test_reverse.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = new URL('../', import.meta.url).href;
const { buildReverseCards, POINTS, NERVES, matchSegment, partsRating } = await import(root + 'js/reverse.js');
const store = await import(root + 'js/store.js');

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('✗', msg); } };
const cards = buildReverseCards();
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
const ids = (id) => (byId[id] ? byId[id].parts.map((p) => p.id).sort().join(',') : '(fehlt)');

ok(cards.length >= 40, `nur ${cards.length} Karten`);
ok(new Set(cards.map((c) => c.id)).size === cards.length, 'doppelte Karten-IDs');
ok(cards.every((c) => c.parts.length >= 2), 'Karte mit weniger als 2 Muskeln');
ok(cards.every((c) => /^Welche Muskeln (entspringen|setzen|innerviert|innervieren) .+\?$/.test(c.q)), 'Frage nicht im erwarteten Format');
ok(cards.every((c) => new Set(c.parts.map((p) => p.id)).size === c.parts.length), 'Muskel doppelt auf einer Karte');
// jeder Eintrag der Tabelle muss eine Karte ergeben (sonst stimmt eine Schreibweise nicht mehr mit den Muskeldaten überein)
const used = new Set(cards.map((c) => c.key));
for (const p of [...POINTS, ...NERVES]) ok(used.has(p.key), `Eintrag ohne Karte: ${p.key}`);

// bekannte Gruppen (Lehrbuch)
const expect = {
  'rv:i:pes_anserinus_superficialis': 'gracilis,sartorius,semitendinosus',
  'rv:o:sias': 'sartorius,tensor_fasciae_latae',
  'rv:i:tuberculum_majus': 'infraspinatus,supraspinatus,teres_minor',
  'rv:i:tuberositas_tibiae': 'rectus_femoris,vastus_intermedius,vastus_lateralis,vastus_medialis', // nicht der Sartorius („medial der Tuberositas tibiae“)
  'rv:i:fossa_trochanterica': 'gemellus_inferior,gemellus_superior,obturatorius_externus,obturatorius_internus',
  'rv:n:n_gluteus_superior': 'gluteus_medius,gluteus_minimus,tensor_fasciae_latae',
  'rv:i:os_cuneiforme_mediale': 'fibularis_longus,tibialis_anterior',
};
for (const [id, want] of Object.entries(expect)) ok(ids(id) === want, `${id}: erwartet ${want}, bekommen ${ids(id)}`);
const tub = ids('rv:o:tuber_ischiadicum');
for (const m of ['biceps_femoris', 'semitendinosus', 'semimembranosus', 'adductor_magnus']) ok(tub.includes(m), `Tuber ischiadicum ohne ${m}`);
ok(!ids('rv:n:n_radialis').includes('brachialis'), 'N. radialis: „kleiner Anteil“ beim M. brachialis zählt nicht');

// Normalisierung: Abkürzung und volle Form treffen denselben Punkt
const sias = POINTS.find((p) => p.key === 'sias');
ok(matchSegment('SIAS', sias) && matchSegment('Spina iliaca anterior superior', sias), 'SIAS ≠ Spina iliaca anterior superior');
ok(!matchSegment('Spina iliaca posterior superior (SIPS)', sias), 'SIPS als SIAS erkannt');
ok(matchSegment('Caput longum: Tuber ischiadicum; Caput breve: Labium laterale der Linea aspera', POINTS.find((p) => p.key === 'tuber_ischiadicum')) === 'Caput longum: Tuber ischiadicum', 'Abschnitt mit Kopf-Bezeichnung');
ok(matchSegment('Proc. spinosi T7–L5 (über Fascia thoracolumbalis), Os sacrum, Crista iliaca', POINTS.find((p) => p.key === 'crista_iliaca')) === 'Crista iliaca', 'Teil nach Komma');

// Bewertung aus „k von n gewusst“
ok(partsRating(3, 3) === 2 && partsRating(2, 3) === 1 && partsRating(1, 3) === 0 && partsRating(0, 2) === 0 && partsRating(1, 2) === 1, 'partsRating');

// ✗-Liste: nicht ganz gewusst → hinein, später alles gewusst → heraus; SRS wie bei normalen Karten
const id = 'rv:o:tuber_ischiadicum';
store.markIntroduced(id);
store.rateParts(id, 2, 6, partsRating(2, 6));
ok(store.get().revx[id] && store.get().revx[id].k === 2 && store.get().revx[id].n === 6, 'nicht ganz gewusst → ✗-Liste');
ok(store.get().srs[id] && store.get().srs[id].reps === 1, 'SRS-Eintrag fehlt');
store.rateParts(id, 6, 6, 2);
ok(!store.get().revx[id], 'alles gewusst → aus der ✗-Liste');
ok(store.get().srs[id].int >= 1, 'alles gewusst → Intervall ≥ 1 Tag');

// sanitize: gültige Einträge bleiben, kaputte/fremde fallen weg; alter Stand ohne revx lädt
const s = store.sanitize({ srs: {}, days: {}, revx: { 'rv:o:sias': { k: 1, n: 2, last: '2026-10-19' }, 'rv:x': 'kaputt', evil: { k: 1, n: 2 }, __proto__: { k: 1 } } });
ok(JSON.stringify(s.revx) === JSON.stringify({ 'rv:o:sias': { k: 1, n: 2, last: '2026-10-19' } }), 'sanitize revx: ' + JSON.stringify(s.revx));
ok(JSON.stringify(store.sanitize({ srs: { a: { int: 1, due: '2026-01-01', reps: 1, lapses: 0 } }, days: {} }).revx) === '{}', 'alter Stand ohne revx');

console.log(fail ? `${fail} Fehler` : `Alle Tests ok (${cards.length} Ters kartlar)`);
process.exit(fail ? 1 : 0);
