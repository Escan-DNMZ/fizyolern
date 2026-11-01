// Tests für den Kurs-Modus (js/kurs.js): Paketformat, Prüfung, Installation, zweite Ebene, „Ödev ekle“, Update.
// Aufruf: node tools/test_kurs.mjs
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (p) => pathToFileURL(path.join(root, p)).href;
const K = await import(url('js/kurs.js'));
const P = await import(url('js/private.js'));
const L = await import(url('js/lessons.js'));
const Q = await import(url('js/quizgen.js'));

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const throwsCode = (fn, code) => { try { fn(); return false; } catch (e) { return e.message === code; } };
const PACK = JSON.parse(readFileSync(path.join(root, 'examples', 'kurs-beispiel.json'), 'utf-8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

// ───── Format prüfen ─────
ok(throwsCode(() => K.cleanKurs(null), 'kurs.badFormat'), 'null → badFormat');
ok(throwsCode(() => K.cleanKurs({ ...PACK, kind: 'fizyolern-private' }), 'kurs.badFormat'), 'falsche Art → badFormat');
ok(throwsCode(() => K.cleanKurs({ ...PACK, version: 2 }), 'kurs.badVersion'), 'neuere Version → badVersion');
ok(throwsCode(() => K.cleanKurs({ ...PACK, version: '1' }), 'kurs.badVersion'), 'Version als Text → badVersion');
ok(throwsCode(() => K.cleanKurs({ ...PACK, id: '../x' }), 'kurs.badFormat'), 'id mit Sonderzeichen → badFormat');
const c = K.cleanKurs(PACK);
ok(c.meta.class.name === 'Klasse 1A (Beispiel)' && c.meta.class.year === 1 && c.meta.bank.n === 8 && c.skipped === 0, 'Beispielpaket: 8 Zeilen, Klasse, Jahr');
ok(c.layer.kind === 'fizyolern-private' && c.layer.source === 'kurs' && c.layer.weeks.length === 1, 'Klassenteil im fizyo.private-Format');
ok(c.layer.exams.map((e) => e.typ).join() === 'Sınav,Ödev', 'Prüfung → Sınav, Hausaufgabe → Ödev');
ok(c.layer.lessonRows.every((r) => r.erklEn || r.typ === 'Offen' || r.typ === 'Wort') && c.layer.lessonRows.some((r) => r.antwortEn), 'englische Hilfstexte bleiben');

// Zeilen: kaputte fallen weg, gute bleiben
const good = { h: 'abcdef0123456789', typ: 'MCQ', fach: 'Hygiene', frage: 'F?', antwort: 'A', ablenker: ['B', 'C', 'D'] };
ok(K.cleanRow(good), 'gute MCQ-Zeile');
ok(!K.cleanRow({ ...good, h: 'xyz' }), 'h kein Hex → weg');
ok(!K.cleanRow({ ...good, typ: 'Quiz' }), 'unbekannter Typ → weg');
ok(!K.cleanRow({ ...good, ablenker: ['B', 'B', 'D'] }), 'doppelte Ablenker → weg');
ok(!K.cleanRow({ ...good, ablenker: ['B', 'C'] }), 'nur 2 Ablenker → weg');
ok(!K.cleanRow({ ...good, ablenker: ['A', 'C', 'D'] }), 'Ablenker = Antwort → weg');
ok(!K.cleanRow({ ...good, fach: '' }), 'ohne Fach → weg');
ok(!K.cleanRow({ ...good, typ: 'Offen', kw: [] }), 'Offen ohne Schlüsselbegriffe → weg');
ok(!K.cleanRow({ ...good, typ: 'Wort', antwort: '' }), 'Wort ohne Übersetzung → weg');
ok(!K.cleanRow({ ...good, frage: { toString: () => 'x' } }), 'Frage kein Text → weg');
const odd = K.cleanRow({ ...good, ck: 'ck:nope', created: 'gestern', extra: '<script>', erklEn: 5 });
ok(odd && !odd.ck && !odd.created && !('extra' in odd) && !('erklEn' in odd), 'ungültige Zusatzfelder fallen weg');
ok(K.cleanRow({ ...good, frage: 'x'.repeat(9000) }).frage.length === 5000, 'lange Texte werden gekürzt');
const mixed = K.cleanKurs({ ...PACK, bank: { id: 'b', rows: [good, good, { ...good, h: 'zz' }, 'text', null] } });
ok(mixed.meta.bank.n === 1 && mixed.skipped === 4, 'doppelte und kaputte Zeilen gezählt');
const evil = JSON.parse('{"kind":"fizyolern-kurs","version":1,"id":"x","__proto__":{"polluted":1},"class":{"__proto__":{"polluted":1}},"bank":{"rows":[]}}');
K.cleanKurs(evil);
ok(({}).polluted === undefined, 'kein Prototype-Pollution');
ok(K.cleanKurs({ kind: 'fizyolern-kurs', version: 1, id: 'leer' }).meta.bank.n === 0, 'Paket ohne Bank geht (leer)');

// Update-Adresse
for (const u of ['https://schule.example/kurs/1a.json', 'kurs/1a.json', 'examples/kurs-beispiel.json']) ok(K.UPDATE_URL.test(u), 'gültige Adresse: ' + u);
for (const u of ['http://x.de/a.json', 'javascript:alert(1)', '//evil.example/a.json', '../private/x.json', 'data:application/json,{}', 'kurs/1a.txt', 'https://a b']) ok(!K.UPDATE_URL.test(u), 'ungültige Adresse: ' + u);
ok(!('update' in K.cleanKurs({ ...PACK, update: 'javascript:alert(1)' }).meta), 'böse Update-Adresse fällt weg');
ok(K.resolveUrl('kurs/1a.json', 'https://app.example/fizyolern/') === 'https://app.example/fizyolern/kurs/1a.json', 'relativer Pfad → gleiche Herkunft');
ok(K.resolveUrl('http://x.de/a.json') === null, 'http wird abgelehnt');

// ───── Installation und zweite Ebene (Schüler ohne Notion) ─────
ok(!K.kursActive() && P.getPrivate() === null, 'vorher: nichts installiert');
const before = L.LESSONS.length;
ok(!K.installKurs({ ...PACK, version: 9 }).ok && !K.kursActive(), 'kaputtes Paket wird nicht installiert');
const r = K.installKurs(clone(PACK), { src: 'examples/kurs-beispiel.json' });
ok(r.ok && r.stored && K.kursActive() && 'fizyo.kurs' in mem, 'Paket installiert und gespeichert');
ok(!('fizyo.private' in mem) && P.ownPrivate() === null, 'fizyo.private bleibt unberührt');
ok(L.LESSONS.length === before + 2 && L.FAECHER.includes('Trainingslehre'), 'zwei Kurslektionen sichtbar');
const kraft = L.LESSONS.find((l) => l.title === 'Kraft – Beispiel');
ok(kraft && kraft.mcq.length === 2 && kraft.open.length === 1 && kraft.vocab.length === 2 && kraft.kern.length === 1, 'Lektion mit MCQ/Offen/Wort/Kern');
ok(kraft.mcq[0].xEn && kraft.kern[0].en && kraft.vocab[0].en === 'strength endurance', 'englische Hilfstexte kommen in der App an');
ok(P.weekFor(new Date(2026, 10, 4)).kw === 45 && P.todayPlan(new Date(2026, 10, 4)).kurse[0] === 'Trainingslehre', 'Wochenplan aus dem Paket');
ok(P.ckList().length === 3, 'Checkliste aus dem Paket');
ok(P.upcoming('Sınav', Infinity, new Date(2026, 10, 1)).length === 1 && P.upcoming('Ödev', Infinity, new Date(2026, 10, 1)).length === 1, 'Prüfung und Hausaufgabe aus dem Paket');
ok(Q.quizCategories().includes('Ders: Trainingslehre'), 'Fach im Test wählbar');

// beim nächsten Start (neues Modul) wird die Ebene wieder geladen
const P2 = await import(url('js/private.js') + '?neustart');
ok(P2.getPrivate() && P2.getPrivate().lessonRows.length === 8 && P2.ownPrivate() === null, 'nach Neustart: Kursebene wieder da');

// ───── „Ödev ekle“ ─────
ok(!K.addOdev({ fach: 'Hygiene', odev: '', q: 'x', a: 'y' }), 'Ödev ohne Titel → nein');
ok(K.addOdev({ fach: 'Hygiene', odev: 'Plakat', q: 'Einwirkzeit Händedesinfektion', a: '30 Sekunden', tr: '30 saniye' }), 'Ödev-Karte gespeichert');
ok(P.odevList().length === 1 && P.odevList()[0].odev === 'Plakat' && P.odevList()[0].id.startsWith('ko:'), 'Karte im Deck „Ödev“');
ok(P.fehlerList().length === 0, 'Ödev-Karten sind keine Fehler');
// Aktualisierung des Pakets: eigene Karten bleiben
K.installKurs({ ...clone(PACK), built: '2026-11-02T09:00:00Z' });
ok(P.odevList().length === 1, 'Paket-Update behält eigene Ödev-Karten');
K.removeOdev(P.odevList()[0].id);
ok(P.odevList().length === 0, 'Ödev-Karte gelöscht');

// ───── Mit eigenen Notion-Daten (wie bei Escan) ─────
const own = { kind: 'fizyolern-private', syncedAt: '2026-10-30T10:00:00.000Z', weeks: [{ kw: 45, from: '2026-11-02', to: '2026-11-08', days: { 1: { kurse: ['Anatomie'], test: [], note: '' } } }],
  fehler: [{ id: 'f:1', fach: 'Anatomie', q: 'Q', a: 'A' }], exams: [{ typ: 'Sınav', fach: 'Trainingslehre', topic: 'Kraft (Beispiel)', date: '2026-11-20' }],
  lessonRows: [{ h: 'ffff000000000001', typ: 'MCQ', fach: 'Trainingslehre', lektion: 'Kraft – Beispiel', frage: 'Welche Kraftfähigkeit gilt als Basis für die anderen Kraftfähigkeiten?', antwort: 'Maximalkraft', ablenker: ['X', 'Y', 'Z'], erkl: 'eigene', kw: [] }] };
P.setPrivate(own);
L.refreshLessons();
ok(P.todayPlan(new Date(2026, 10, 2)).kurse[0] === 'Anatomie', 'eigener Wochenplan hat Vorrang');
ok(P.fehlerList().length === 1 && P.upcoming('Sınav', Infinity, new Date(2026, 10, 1)).length === 1, 'gleiche Prüfung nur einmal');
const k2 = L.LESSONS.find((l) => l.title === 'Kraft – Beispiel');
ok(k2.mcq.length === 2 && k2.mcq.some((q) => q.x === 'eigene'), 'gleiche Frage: eigene Zeile gewinnt');
ok(JSON.parse(mem['fizyo.private']).lessonRows.length === 1, 'fizyo.private enthält nur die eigenen Zeilen');
P.clearPrivate();

// ───── Update über das Netz (ohne Netz simuliert) ─────
let served = { ...clone(PACK), built: '2026-11-03T09:00:00Z', update: 'kurs/1a.json' };
let fetched = 0;
globalThis.fetch = async (u) => { fetched++; return { ok: true, status: 200, text: async () => JSON.stringify(served) }; };
globalThis.location = { href: 'https://app.example/fizyolern/', origin: 'https://app.example' };
ok(await K.autoUpdateKurs() === false && fetched === 0, 'kurz nach der Installation: keine Abfrage');
ok(await K.autoUpdateKurs({ force: true }) === true && K.kursMeta().built === '2026-11-03T09:00:00Z', 'neueres Paket übernommen');
ok(await K.autoUpdateKurs({ force: false }) === false, 'gleich danach: nichts');
const m = JSON.parse(mem['fizyo.kurs']); m.checkedAt = 0; mem['fizyo.kurs'] = JSON.stringify(m);
served = { ...served, id: 'andere-klasse', built: '2026-11-09T09:00:00Z' };
let err = '';
try { await K.autoUpdateKurs({ force: true }); } catch (e) { err = e.message; }
ok(err === 'kurs.otherClass' && K.kursMeta().id === 'beispielschule-1a', 'anderes Klassenpaket wird nicht still übernommen');
globalThis.fetch = async () => { throw new TypeError('CSP'); };
err = '';
try { await K.fetchKurs('https://fremd.example/a.json'); } catch (e) { err = e.message; }
ok(err === 'kurs.network', 'blockierte Adresse → verständlicher Fehler');
globalThis.fetch = async () => ({ ok: true, text: async () => 'x'.repeat(K.MAX_BYTES + 1) });
err = '';
try { await K.fetchKurs('kurs/1a.json'); } catch (e) { err = e.message; }
ok(err === 'kurs.tooBig', 'zu große Datei abgelehnt');

// ───── Entfernen ─────
K.removeKurs();
ok(!K.kursActive() && !('fizyo.kurs' in mem) && P.getPrivate() === null && L.LESSONS.length === before, 'entfernt: alles wie vorher');

console.log(fail ? `${fail} von ${n} Kurs-Tests fehlgeschlagen` : `Alle ${n} Kurs-Tests bestanden`);
process.exit(fail ? 1 : 0);
