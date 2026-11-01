// Regressionstest „nichts kaputt machen“: Ergebnisse der bestehenden Abläufe (Notion-Sync, Morgentest/Mischung,
// Fehlerlogik, Sicherung, Ters kartlar, Checkliste) werden mit einem festen Stand verglichen,
// der VOR dem Kurs-Modus mit dem alten Code erzeugt wurde (tools/fixtures/unchanged.json).
// Danach wird ein Kurspaket installiert und wieder entfernt – alles muss wieder genau gleich sein,
// und der Notion-Sync darf mit installiertem Paket keine Kursdaten in fizyo.private schreiben.
// Aufruf: node tools/test_unchanged.mjs            (vergleichen)
//         node tools/test_unchanged.mjs --write    (Stand neu schreiben – nur bewusst!)
import path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

// ───── feste Uhrzeit (Mi 28.10.2026, 10:00) und fester Zufall ─────
const FIXED = new Date(2026, 9, 28, 10, 0, 0).getTime();
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(FIXED); }
  static now() { return FIXED; }
};
let seed = 12345;
const reseed = (s) => { seed = s; };
Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// ───── erfundene Testdaten (keine echten Schulinhalte) ─────
const hex = (k, i) => (k + String(i).padStart(15, '0')).slice(0, 16);
const row = (h, typ, fach, lektion, frage, extra = {}) => ({ h, fach, lektion, typ, frage, antwort: '', ablenker: ['', '', ''], erkl: '', kw: [], ...extra });
const PRIVATE = {
  kind: 'fizyolern-private', version: 2, source: 'notion', syncedAt: '2026-10-27T18:00:00.000Z',
  weeks: [
    { kw: 44, range: '26.–30.10.2026', from: '2026-10-26', to: '2026-11-01', days: {
      1: { kurse: ['Anatomie'], test: ['Anatomie'], note: '' },
      2: { kurse: ['Hygiene', 'Physiologie'], test: ['Hygiene'], note: '' },
      3: { kurse: ['Physiologie'], test: ['Physiologie', 'Hygiene'], note: 'Beispiel', end: '13:30' },
      4: { kurse: [], test: [], note: '' },
    } },
  ],
  fehler: [
    { id: 'f:1', fach: 'Anatomie', q: 'Ursprung des M. biceps brachii?', a: 'Tuberculum supraglenoidale', tr: 'örnek' },
    { id: 'f:2', fach: 'Hygiene', q: 'Händedesinfektion: Einwirkzeit?', seg: [{ t: 'Einwirkzeit: ', b: false }, { t: '30 Sekunden', b: true }] },
    { id: 'o:1', fach: 'Anatomie', q: 'Spina iliaca anterior superior', a: 'SIAS', odev: 'Becken' },
  ],
  exams: [
    { typ: 'Sınav', fach: 'Anatomie', topic: 'Becken', date: '2026-11-03', done: false, note: '' },
    { typ: 'Ödev', fach: 'Hygiene', topic: 'Plakat', date: '2026-10-30', done: false, note: '' },
  ],
  ck: [
    { id: 'ck:' + hex('e', 1), fach: 'Physiologie', sec: 'Energie', text: 'ATP als Energieträger erklären', done: true, date: '2026-10-27', skript: '', notu: [], nh: [] },
    { id: 'ck:' + hex('e', 2), fach: 'Physiologie', sec: 'Energie', text: 'Laktat und anaerobe Glykolyse beschreiben', done: false, date: '', skript: '', notu: [], nh: [] },
  ],
  lessonRows: [
    row(hex('a', 1), 'MCQ', 'Physiologie', 'Energiegewinnung', 'Welches Molekül ist der direkte Energieträger der Zelle?', { antwort: 'ATP', ablenker: ['ADP', 'Glukose', 'Laktat'], erkl: 'ATP', created: '2026-10-27T08:00:00.000Z' }),
    row(hex('a', 2), 'MCQ', 'Physiologie', 'Energiegewinnung', 'Was entsteht bei der anaeroben Glykolyse?', { antwort: 'Laktat', ablenker: ['Harnstoff', 'Glykogen', 'Kreatin'], created: '2026-10-20T08:00:00.000Z' }),
    row(hex('a', 3), 'Kern', 'Physiologie', 'Energiegewinnung', 'ATP liefert die Energie für die Muskelkontraktion.', { erkl: 'ATP kas kasılmasına enerji verir.' }),
    row(hex('a', 4), 'Offen', 'Physiologie', 'Energiegewinnung', 'Erklären Sie die Rolle von ATP.', { antwort: 'ATP ist der Energieträger der Zelle.', kw: ['ATP', 'Energieträger'] }),
    row(hex('a', 5), 'Wort', 'Physiologie', 'Energiegewinnung', 'der Energieträger', { antwort: 'enerji taşıyıcısı', erkl: 'ATP ist ein Energieträger.' }),
    row(hex('a', 6), 'MCQ', 'Hygiene', 'Händehygiene', 'Wie lange dauert die hygienische Händedesinfektion mindestens?', { antwort: '30 Sekunden', ablenker: ['5 Sekunden', '10 Minuten', '2 Stunden'], created: '2026-10-27T08:00:00.000Z' }),
  ],
  gw: [{ id: 'gw:der Tisch', de: 'der Tisch', tr: 'masa', ex: 'Der Tisch ist groß.', cat: 'GW · Wohnen', stufe: 'Neu', next: '' }],
  notion: {},
};
const STORE = {
  start: '2026-10-15',
  srs: { 'f:1': { int: 1, due: '2026-10-28', reps: 1, lapses: 1 } },
  quiz: {
    ['N:' + hex('a', 2)]: { r: 1, w: 1, last: '2026-10-26', lastWrong: '2026-10-26', okDays: [] },
    'L:allg-anatomie-1:0': { r: 2, w: 1, last: '2026-10-27', lastWrong: '2026-10-20', okDays: ['2026-10-21', '2026-10-27'] },
  },
  days: { '2026-10-27': { cards: 3, quiz: 10, quizRight: 8, open: 1, lesson: true, lesson2: false, wrong: ['N:' + hex('a', 2)] } },
  ck: { ['ck:' + hex('e', 1)]: { lv: 1, last: '2026-10-27' } },
  settings: { cardsGoal: 15, quizGoal: 10, newPerDay: 10, reverse: true, lang: 'tr', classEnd: '15:00', donusAfter: 30 },
};

const mem = { 'fizyo.private': JSON.stringify(PRIVATE), 'fizyo.v1': JSON.stringify(STORE), 'fizyo.notionToken': 'ntn_' + 'x'.repeat(30) };
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

// ───── Notion-API ohne Netz: eine Fragen-Datenbank und eine Wochenplan-Seite ─────
const rt = (t, b = false) => ({ type: 'text', plain_text: t, annotations: { bold: b } });
const NOTION = {
  search: { 'FizyoLern Sorular|database': { object: 'database', id: 'db1', title: [rt('FizyoLern Sorular')] }, 'Haftalık Plan|page': { object: 'page', id: 'pl1', properties: { title: { type: 'title', title: [rt('Haftalık Plan')] } } } },
  'databases/db1/query': [
    { id: '11111111-2222-3333-4444-555555555555', created_time: '2026-10-26T08:00:00.000Z', properties: {
      Frage: { type: 'title', title: [rt('Welches Organell bildet ATP?')] }, Typ: { type: 'select', select: { name: 'MCQ' } }, Fach: { type: 'select', select: { name: 'Physiologie' } },
      Lektion: { type: 'rich_text', rich_text: [rt('Energiegewinnung')] }, Antwort: { type: 'rich_text', rich_text: [rt('Mitochondrium')] },
      'Ablenker 1': { type: 'rich_text', rich_text: [rt('Ribosom')] }, 'Ablenker 2': { type: 'rich_text', rich_text: [rt('Golgi-Apparat')] }, 'Ablenker 3': { type: 'rich_text', rich_text: [rt('Lysosom')] } } },
  ],
  'blocks/pl1/children': [
    { type: 'heading_2', heading_2: { rich_text: [rt('Bu hafta – KW 44 (26.–30.10.2026)')] } },
    { type: 'table', id: 'tb1', table: { has_column_header: true } },
    { type: 'paragraph', paragraph: { rich_text: [rt('✗ Hatalar')] } },
    { type: 'heading_3', heading_3: { rich_text: [rt('Anatomie')] } },
    { type: 'paragraph', paragraph: { rich_text: [rt('✗ Fehler')] } },
    { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [rt('✗ Ursprung M. deltoideus: '), rt('Clavicula, Acromion, Spina scapulae', true)] } },
  ],
  'blocks/tb1/children': [['Gün', 'Ders 1', 'Ders 2', 'Tekrar', 'Not'], ['Pzt 26.10', 'Anatomie', '—', 'Sabah testi: Anatomie', ''], ['Çar 28.10', 'Physiologie', 'Hygiene', 'Sabah testi: Physiologie + Hygiene', '']]
    .map((r) => ({ type: 'table_row', table_row: { cells: r.map((c) => [rt(c)]) } })),
};
globalThis.fetch = async (url, opts = {}) => {
  const p = url.replace('https://api.notion.com/v1/', '').split('?')[0];
  let body;
  if (p === 'search') {
    const b = JSON.parse(opts.body);
    const hit = NOTION.search[b.query + '|' + b.filter.value];
    body = { results: hit ? [hit] : [], has_more: false };
  } else body = { results: NOTION[p] || [], has_more: false };
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const store = await imp('js/store.js');
const P = await imp('js/private.js');
const L = await imp('js/lessons.js');
const Q = await imp('js/quizgen.js');
const CK = await imp('js/checkliste.js');
const R = await imp('js/reverse.js');
const N = await imp('js/notion.js');

// Alles, was die bestehenden Abläufe sehen bzw. erzeugen
function snapshot() {
  const s = {};
  s.private = P.getPrivate();
  s.lists = { fehler: P.fehlerList(), odev: P.odevList(), ck: P.ckList(), exams: P.examList(), week: P.week(), today: P.todayPlan(), tomorrow: P.tomorrowPlan(), upcoming: P.upcoming('Sınav'), upOdev: P.upcoming('Ödev'), examFaecher: P.examFaecher(), donus: P.donusStart(P.todayPlan(), store.get().settings) };
  s.lessons = { list: L.LESSONS, faecher: L.FAECHER };
  s.quiz = {};
  for (const [name, cat, opts] of [['morning', 'Ders: Physiologie,Hygiene', { morning: true }], ['mixed', 'Gemischt', {}], ['hyg', 'Ders: Hygiene', {}], ['wrong', 'Hatalar: hafta', {}]]) {
    reseed(777);
    s.quiz[name] = Q.buildQuiz(cat, 10, [], opts).map((q) => q.id);
  }
  s.categories = Q.quizCategories();
  s.mistakes = { due: store.dueMistakes(), wrong7: store.wrongSince(7), learned: Object.entries(store.get().quiz).map(([id, q]) => [id, store.mistakeLearned(q), store.learnedOn(q)]) };
  s.checkliste = { faecher: CK.ckFaecher(), items: P.ckList().map((c) => [c.id, CK.questionsOf(c.id).map((q) => q.id), CK.summary(c.fach)]), allowed: Q.ALL_LESSON_MCQ().map((q) => [q.id, CK.allowedInDaily(q.id), CK.ckWeight(q.id)]) };
  s.reverse = R.reverseCards().map((c) => c.id);
  s.backup = store.sanitize(JSON.parse(JSON.stringify(store.get())));
  return JSON.parse(JSON.stringify(s));
}

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
function diff(a, b, where = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diff(a[k], b[k], where + '.' + k); if (d) return d; }
  }
  return `${where}: ${JSON.stringify(a)?.slice(0, 200)} ≠ ${JSON.stringify(b)?.slice(0, 200)}`;
}
const same = (got, want, msg) => { const d = diff(got, want); ok(!d, `${msg} ${d || ''}`); };

// Notion-Sync (ohne Netz) → was in fizyo.private gespeichert wird (ohne Zeitstempel)
async function syncSnapshot() {
  const report = await N.syncFromNotion({ faecher: L.FAECHER, lessons: L.LESSONS });
  const stored = JSON.parse(mem['fizyo.private']);
  delete stored.syncedAt;
  return { report, stored };
}

const FILE = path.join(root, 'tools', 'fixtures', 'unchanged.json');
const before = snapshot();
const kursOn = existsSync(path.join(root, 'js', 'kurs.js'));

if (process.argv.includes('--write')) {
  const golden = { before };
  // Sync verändert den Speicher → zuletzt, danach Stand neu laden
  golden.sync = await syncSnapshot();
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(golden, null, 1));
  console.log('Stand geschrieben:', path.relative(root, FILE));
  process.exit(0);
}

const golden = JSON.parse(readFileSync(FILE, 'utf-8'));
same(before, golden.before, 'ohne Kurspaket: alles wie vorher');

if (kursOn) {
  const K = await imp('js/kurs.js');
  ok(P.getPrivate() === P.ownPrivate(), 'ohne Kurspaket: getPrivate() ist genau das eigene Objekt');
  const pack = JSON.parse(readFileSync(path.join(root, 'examples', 'kurs-beispiel.json'), 'utf-8'));
  const res = K.installKurs(pack);
  ok(res.ok, 'Beispielpaket installiert');
  L.refreshLessons();
  ok(P.getPrivate() !== P.ownPrivate(), 'mit Kurspaket: zweite Ebene aktiv');
  same(P.ownPrivate(), golden.before.private, 'mit Kurspaket: eigene Notion-Daten unverändert');
  ok(P.fehlerList().length === golden.before.lists.fehler.length, 'mit Kurspaket: Fehlerkarten unverändert');
  same(P.week(), golden.before.lists.week, 'mit Kurspaket: eigener Wochenplan hat Vorrang');
  ok(L.LESSONS.length > golden.before.lessons.list.length, 'mit Kurspaket: Kurslektionen dazu');
  same(R.reverseCards().map((c) => c.id), golden.before.reverse, 'mit Kurspaket: Ters kartlar gleich');
  // Notion-Sync mit installiertem Paket: gespeichert wird nur die eigene Ebene
  const synced = await syncSnapshot();
  same(synced.stored, golden.sync.stored, 'Notion-Sync mit Kurspaket speichert genau dasselbe');
  same(synced.report, golden.sync.report, 'Notion-Sync-Bericht gleich');
  // wieder entfernen → alter Stand (ohne Sync-Änderung) muss zurückkommen
  mem['fizyo.private'] = JSON.stringify(PRIVATE);
  P.setPrivate(PRIVATE);
  K.removeKurs();
  L.refreshLessons();
  ok(P.getPrivate() === P.ownPrivate(), 'nach Entfernen: keine zweite Ebene');
  same(snapshot(), golden.before, 'nach Entfernen: alles wie vorher');
  ok(!('fizyo.kurs' in mem), 'nach Entfernen: fizyo.kurs gelöscht');
} else {
  same(await syncSnapshot(), golden.sync, 'Notion-Sync speichert dasselbe');
}

console.log(fail ? `${fail} von ${n} Regressionstests fehlgeschlagen` : `Alle ${n} Regressionstests bestanden (nichts verändert)`);
process.exit(fail ? 1 : 0);
