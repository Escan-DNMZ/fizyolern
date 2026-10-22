// Tests für den Rückweg-Start: Unterrichtsende aus dem Wochenplan (Kopfzeile / Zeit im Tag), Einstellungen, Tage ohne Unterricht.
// Aufruf: node tools/test_donus.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const N = await imp('js/notion.js');
const P = await imp('js/private.js');
const store = await imp('js/store.js');

let fail = 0, n = 0;
const eq = (name, got, want) => {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log(`✗ ${name}\n   erwartet: ${JSON.stringify(want)}\n   bekommen: ${JSON.stringify(got)}`); }
};

// Zeiten in Zellen (TR / EN / DE)
eq('Zeiten', ['Ders 2 (11:30–15:00)', 'Class 1 (08:00 - 11:15)', '2. Stunde 11.30 bis 15.30', 'AKL (R2) · 13:30 boş', "13:30'dan sonra boş", 'frei ab 12.45', 'until 14:00', '13:30 free', 'Stab 13:30', 'Trainingslehre (R2)', '25:00 boş'].map(N.endTimeIn),
  ['15:00', '11:15', '15:30', '13:30', '13:30', '12:45', '14:00', '13:30', '', '', '']);

// Wochenplan-Tabelle mit Uhrzeiten in der Kopfzeile
const rt = (t) => ({ plain_text: t, annotations: { bold: false } });
const table = (rows) => async () => rows.map((r) => ({ type: 'table_row', table_row: { cells: r.map((c) => [rt(c)]) } }));
const plan = async (head, rows) => (await N.parsePlanPage([
  { type: 'heading_2', heading_2: { rich_text: [rt(head)] } },
  { type: 'table', id: 't', table: { has_column_header: true } },
], ['Anatomie', 'Physiologie'], table(rows))).weeks[0].days;

const tr = await plan('Bu hafta – KW 43 (19.–23.10.2026)', [
  ['Gün', 'Ders 1 (08:00–11:15)', 'Ders 2 (11:30–15:00)', 'Tekrar', 'Not'],
  ['Pzt 19.10', 'Anatomie', 'Physiologie', 'Sabah testi: Anatomie', ''],
  ['Sal', 'Anatomie', '—', '', ''],
  ['Per', 'Anatomie', 'AKL (R2) · 13:30 boş', '', ''],
  ['Cmt', '—', '—', '', ''],
]);
eq('TR: Ende aus der Kopfzeile', [tr[1].end, tr[2].end, tr[4].end, tr[6].end], ['15:00', '11:15', '13:30', undefined]);

const en = await plan('Week 43 (19.–23.10.2026)', [
  ['Day', 'Class 1 (8:15 - 12:00)', 'Class 2 (13:00 - 16:45)', 'Review', 'Notes'],
  ['Mon', 'Anatomie', 'Physiologie', '', ''],
  ['Fri', 'Anatomie (until 10:30)', '', '', ''],
]);
eq('EN: andere Zeiten, Zeit in der Zelle gewinnt', [en[1].end, en[5].end], ['16:45', '10:30']);
const plain = await plan('Woche 43 (19.–23.10.2026)', [['Tag', 'Stunde 1', 'Stunde 2', 'Wiederholung', 'Notiz'], ['Mo', 'Anatomie', 'Physiologie', '', '']]);
eq('ohne Zeiten: kein end', plain[1].end, undefined);

// private.js prüft end
const cp = P.cleanPrivate({ kind: 'fizyolern-private', weeks: [{ kw: 43, from: '2026-10-19', to: '2026-10-25', days: { 1: { kurse: ['A'], end: '15:00' }, 2: { kurse: ['A'], end: '9:00' }, 3: { kurse: ['A'], end: '<b>' } } }] });
eq('cleanPrivate end', [cp.weeks[0].days[1].end, cp.weeks[0].days[2].end, cp.weeks[0].days[3].end], ['15:00', undefined, undefined]);

// Startzeit des Rückwegs (Minuten seit Mitternacht)
const thu = new Date(2026, 9, 22, 12), sat = new Date(2026, 9, 24, 12);
const S = (classEnd, donusAfter) => ({ classEnd, donusAfter });
eq('Plan mit Ende 15:00', P.donusStart({ kurse: ['A'], end: '15:00' }, S('15:00', 0), thu, true), 900);
eq('„13:30 boş“ + 20 min', P.donusStart({ kurse: ['A'], end: '13:30' }, S('15:00', 20), thu, true), 830);
eq('Plan ohne Zeit → eingestellte Endzeit', P.donusStart({ kurse: ['A'] }, S('16:30', 0), thu, true), 990);
eq('Tag ohne Unterricht („—“)', P.donusStart({ kurse: [] }, S('15:00', 0), thu, true), null);
eq('ohne Notion: Werktag → Einstellung', P.donusStart(null, S('15:00', 10), thu, false), 910);
eq('ohne Notion: Wochenende → nein', P.donusStart(null, S('15:00', 0), sat, false), null);

// Einstellungen: Standard und Prüfung
const d = store.sanitize({ srs: {}, days: {} }).settings;
eq('Standard: 15:00, 0 min', [d.classEnd, d.donusAfter], ['15:00', 0]);
const bad = store.sanitize({ srs: {}, days: {}, settings: { classEnd: '7 Uhr', donusAfter: 999 } }).settings;
eq('ungültige Einstellungen', [bad.classEnd, bad.donusAfter], ['15:00', 240]);

console.log(fail ? `\n${fail} von ${n} FEHLGESCHLAGEN` : `Alle ${n} Rückweg-Tests bestanden`);
process.exit(fail ? 1 : 0);
