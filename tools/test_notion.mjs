// Tests für das Lesen der Notion-Seiten (ohne Netz): Wochenplan, Fehler-/Ödevkarten, Prüfungen, Fragen-Datenbank.
// Aufruf: node tools/test_notion.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const N = await imp('js/notion.js');
const { cardFront, cleanText } = await imp('js/private.js');
const { mergeLessons } = await imp('js/lessons.js');

let fail = 0, n = 0;
const eq = (name, got, want) => {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`✗ ${name}\n   erwartet: ${JSON.stringify(want)}\n   bekommen: ${JSON.stringify(got)}`); }
};
const rt = (t, b = false) => ({ plain_text: t, annotations: { bold: b } });
const blk = (type, parts) => ({ type, [type]: { rich_text: parts } });
const table = (rows) => async () => rows.map((r) => ({ type: 'table_row', table_row: { cells: r.map((c) => [rt(c)]) } }));
const F = ['Anatomie', 'Physiologie', 'PT Befund', 'Hygiene'];

// Wochentage
eq('Wochentage TR/EN/DE', ['Pzt 12.10', 'Salı', 'Çar', 'Cmt', 'Paz', 'Mon', 'Thu 22.10', 'Sun', 'Mo', 'Mi', 'Sa', 'So', 'Notiz', ''].map(N.weekdayOf), [1, 2, 3, 6, 7, 1, 4, 7, 1, 3, 6, 7, 0, 0]);

// Wochenplan auf Türkisch und Englisch
for (const [lang, head, cols, day, test] of [
  ['TR', 'Bu hafta – KW 42 (12.–16.10.2026)', ['Gün', 'Ders 1', 'Ders 2', 'Tekrar', 'Not'], 'Pzt 12.10', 'Sabah testi: Anatomie + Hygiene'],
  ['EN', 'Week 42 (12.–16.10.2026)', ['Day', 'Class 1', 'Class 2', 'Review', 'Notes'], 'Mon 12.10', 'Morning test: Anatomie + Hygiene'],
]) {
  const blocks = [blk('heading_2', [rt(head)]), { id: 't', type: 'table', table: { has_column_header: true } },
    blk('heading_3', [rt('Anatomie')]), blk('paragraph', [rt('✗ Test 12.10:')]),
    blk('bulleted_list_item', [rt('✗ Fossa = '), rt('Grube', true), rt(' (2. Tur ✅)')]),
    blk('bulleted_list_item', [rt('½ Bestandteile: '), rt('Gelenkspalt', true), rt(' '), rt('(15.10 wieder ½ → 3. Tur)', true)]),
    blk('paragraph', [rt(lang === 'TR' ? '✗ Ezber kartları – Becken (Cumartesi):' : '✗ Homework – Pelvis:')]),
    blk('bulleted_list_item', [rt('✗ SIAS = '), rt('Spina iliaca anterior superior', true)]),
    blk('heading_3', [rt('Hygiene')]), blk('bulleted_list_item', [rt('✗ kein Fehler, weil vor dem ✗-Absatz')])];
  const r = await N.parsePlanPage(blocks, F, table([cols, [day, 'Anatomie', 'Hygiene', test, 'Notiz'], ['Di 13.10', '—', '—', '', '']]));
  r.week = r.weeks[0]; // unabhängig vom heutigen Datum
  eq(`${lang}: Woche`, [r.week.kw, r.week.from, r.week.to], [42, '2026-10-12', '2026-10-18']);
  eq(`${lang}: Montag`, r.week.days[1], { kurse: ['Anatomie', 'Hygiene'], test: ['Anatomie', 'Hygiene'], note: 'Notiz' });
  eq(`${lang}: Karten`, r.fehler.map((f) => [f.fach, f.odev || null, f.q]), [
    ['Anatomie', null, 'Fossa = ＿＿＿'], ['Anatomie', null, 'Bestandteile: ＿＿＿'], ['Anatomie', lang === 'TR' ? 'Becken' : 'Pelvis', 'SIAS = ＿＿＿'],
  ]);
}

// Kartenvorderseite ohne Fettdruck: Antwort nie vorne
eq('cardFront ohne Fett', cardFront([{ t: '10 Körpersysteme: Bewegungsapparat · Herz-Kreislauf', b: false }]), '10 Körpersysteme: ?');
eq('cardFront Meta entfernt', cardFront([{ t: '(FizyoLern 17.10) ', b: false }, { t: 'Zentriol', b: true }, { t: ' → Zellteilung', b: false }]), '＿＿＿ → Zellteilung');
eq('cleanText Tur-Notiz', cleanText('Bänder (15.10 wieder ½ → 3. Tur) ✅'), 'Bänder');

// Prüfungen: Tabelle (EN-Spalten) und To-do
const ex = await N.parseExamPage([{ id: 'e', type: 'table', table: { has_column_header: true } }, { type: 'to_do', to_do: { rich_text: [rt('Hygiene Klausur 03.11.')], checked: false } }], F,
  table([['Type', 'Subject', 'Topic', 'Date', 'Status', 'Note'], ['Exam', 'PT Befund', 'Hüfte', '28.10.2026', '', ''], ['Homework', 'Anatomie', 'Muskeln', '22.10.2026', 'done', '']]), new Date('2026-10-18'));
eq('Prüfungen', ex.map((e) => [e.typ, e.fach, e.date, e.done]), [['Ödev', 'Anatomie', '2026-10-22', true], ['Sınav', 'PT Befund', '2026-10-28', false], ['Sınav', 'Hygiene', '2026-11-03', false]]);

// Fragen-Datenbank → neue Lektion; ungültige Zeilen werden übersprungen
const P = (v) => ({ type: 'rich_text', rich_text: [{ plain_text: v }] });
const page = (id, o) => ({ id, properties: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'Frage' ? { type: 'title', title: [{ plain_text: v }] } : k === 'Gizle' ? { type: 'checkbox', checkbox: v } : P(v)])) });
const rows = await N.rowsFromPages([
  page('a', { Frage: 'Das Knie ist ein Drehwinkelgelenk.', Typ: 'Kern', Fach: 'Neurologie', Lektion: 'Knie', 'Erklärung TR': 'The knee is a pivot-hinge joint.' }),
  page('b', { Frage: 'Welches Band verhindert die vordere Schublade?', Typ: 'MCQ', Fach: 'Neurologie', Lektion: 'Knie', Antwort: 'VKB', 'Ablenker 1': 'HKB', 'Ablenker 2': 'Innenband', 'Ablenker 3': 'Außenband' }),
  page('c', { Frage: 'Kaputt', Typ: 'MCQ', Fach: 'Neurologie', Antwort: 'A', 'Ablenker 1': 'A', 'Ablenker 2': 'B', 'Ablenker 3': 'C' }),
  page('d', { Frage: 'Versteckt', Typ: 'Kern', Fach: 'Neurologie', Gizle: true }),
]);
const { lessons, skipped } = mergeLessons([], rows);
eq('Fragen-DB', [rows.length, skipped, lessons.map((l) => [l.fach, l.title, l.kern.length, l.mcq.length])], [3, 1, [['Neurologie', 'Knie', 1, 1]]]);

// Checkliste: Fach-Zeile, ## Abschnitte, To-dos mit „✅ TT.MM“, „→ Skript x.y“, „→ Notu N“
const todo = (text, checked) => ({ type: 'to_do', to_do: { rich_text: [rt(text)], checked } });
const ckBlocks = [
  blk('paragraph', [rt('Fach: Trainingslehre · Quelle: Beispiel')]),
  blk('paragraph', [rt('Format für FizyoLern: ## = Abschnitt · To-do = Lernziel')]),
  todo('Ohne Abschnitt → Skript 0', false),
  blk('heading_2', [rt('Abschnitt A')]),
  todo('Drei Beispiele nennen → Skript 4.2 → Notu 4 ✅ 19.10', true),
  todo('Begriff definieren → Skript 2.1.1 → Notu 2, Notu 3 ✅ 05.10.2026', true),
  todo('Methoden vergleichen → Skript 4.4.1', false),
];
const ck = await N.parseChecklist(ckBlocks, ['Anatomie', 'Trainingslehre'], new Date('2026-10-19'));
eq('Checkliste Fach', ck.fach, 'Trainingslehre');
eq('Checkliste Ziele', ck.items.map((x) => [x.sec, x.text, x.done, x.date, x.skript, x.notu]), [
  ['', 'Ohne Abschnitt', false, '', '0', []],
  ['Abschnitt A', 'Drei Beispiele nennen', true, '2026-10-19', '4.2', [4]],
  ['Abschnitt A', 'Begriff definieren', true, '2026-10-05', '2.1.1', [2, 3]],
  ['Abschnitt A', 'Methoden vergleichen', false, '', '4.4.1', []],
]);
// id = Fach + Abschnitt + Text: Haken/Datum/Verweise ändern sie nicht, ein anderer Abschnitt schon
const ck2 = await N.parseChecklist([ckBlocks[0], ckBlocks[3], todo('Drei Beispiele nennen', false)], ['Trainingslehre']);
const ck3 = await N.parseChecklist([ckBlocks[0], blk('heading_2', [rt('Andere')]), todo('Drei Beispiele nennen', false)], ['Trainingslehre']);
eq('Checkliste id stabil', [ck2.items[0].id === ck.items[1].id, ck3.items[0].id === ck.items[1].id, /^ck:[0-9a-f]{16}$/.test(ck.items[1].id)], [true, false, true]);
eq('Checkliste unbekanntes Fach', await N.parseChecklist([blk('paragraph', [rt('Fach: Astrologie')]), todo('x', true)], ['Anatomie']), { fach: '', unknown: 'Astrologie', items: [] });
eq('Checkliste ohne Fach-Zeile', (await N.parseChecklist([todo('x', true)], ['Anatomie'])).items, []);
// private.js prüft die Felder (falsche Typen / fremde ids fallen weg)
const { cleanPrivate } = await imp('js/private.js');
const cp = cleanPrivate({ kind: 'fizyolern-private', ck: [...ck.items, { id: 'evil', fach: 'X', text: 'y' }, { ...ck.items[1], id: 'ck:zz' + ck.items[1].id.slice(5), notu: ['4', 4] }] });
eq('Checkliste cleanPrivate', [cp.ck.length, cp.ck[1].notu, cp.ck[1].date], [4, [4], '2026-10-19']);

console.log(fail ? `\n${fail} von ${n} FEHLGESCHLAGEN` : `Alle ${n} Notion-Tests bestanden`);
process.exit(fail ? 1 : 0);
