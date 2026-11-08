// Tests für den Sınav-Tab (js/pruefung.js): Themen → Lektionen, Lernplan bis zur Prüfung, Thema des Tages, Vortag = Wiederholung.
// Fall wie So 08.11.2026: Physiologie-Prüfung am 27.11. mit 6 Themen; Lektionen 5–14 kommen aus Notion.
// Aufruf: node tools/test_pruefung.mjs   (erfundene Fragen, nur die Themen-Titel sind realistisch)
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

let FIXED = new Date(2026, 10, 8, 13, 0).getTime(); // So 08.11.2026
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(FIXED); }
  static now() { return FIXED; }
};

const row = (h, lektion, i) => ({ h, fach: 'Physiologie', lektion, typ: 'MCQ', frage: `${lektion} Frage ${i}?`, antwort: `R${i}`, ablenker: [`A${i}`, `B${i}`, `C${i}`], erkl: '', kw: [] });
const hex = (k, i) => (k + String(i).padStart(15, '0')).slice(0, 16);
const NOTION_LEKTIONEN = ['Physiologie 5 – Muskelkontraktion', 'Physiologie 6 – Energiegewinnung', 'Physiologie 7 – Wundheilung', 'Physiologie 8 – Blut', 'Physiologie 13 – Thermoregulation'];
const PRIVATE = {
  kind: 'fizyolern-private', version: 2,
  lessonRows: NOTION_LEKTIONEN.flatMap((l, k) => [...Array(6)].map((_, i) => row(hex('abcde'[k], i), l, i))),
  exams: [
    { typ: 'Sınav', fach: 'Physiologie', topic: 'Grundlagen der Physiologie, Zellphysiologie, Erregungsphysiologie, Muskelphysiologie, Energiebereitstellungssysteme, Wundheilung', date: '2026-11-27', done: false, note: '' },
  ],
};
const mem = { 'fizyo.private': JSON.stringify(PRIVATE) };
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const store = await imp('js/store.js');
const L = await imp('js/lessons.js');
const P = await imp('js/pruefung.js');
const Q = await imp('js/quizgen.js');

let fail = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fail++; console.log('✗ ' + msg); } };
const titles = (ids) => ids.map((id) => L.LESSONS.find((l) => l.id === id).title);

// ───── Themen → Lektionen ─────
ok(P.topicStems('Grundlagen der Physiologie') === null, 'Grundlagen der Physiologie = nur allgemeine Wörter');
ok(P.topicStems('Muskelphysiologie').join() === 'muske', 'Muskelphysiologie → muske');
ok(P.topicStems('Energiebereitstellungssysteme').join() === 'energ', 'Energiebereitstellungssysteme → energ');

const ex = P.activeExam();
ok(ex && ex.fach === 'Physiologie' && ex.topics.length === 6, 'Prüfung mit 6 Themen erkannt');
const by = Object.fromEntries(ex.topics.map((x) => [x.name, titles(x.lessons)]));
ok(by['Grundlagen der Physiologie'].some((t) => /Homöostase/.test(t)), 'Grundlagen → Lektion Homöostase/Regelkreis: ' + by['Grundlagen der Physiologie']);
ok(by.Zellphysiologie.some((t) => /Zellphysiologie/.test(t)) && by.Zellphysiologie.some((t) => /Zellorganellen/.test(t)), 'Zellphysiologie → Zellphysiologie + Zellorganellen: ' + by.Zellphysiologie);
ok(by.Erregungsphysiologie.every((t) => /Erregung/.test(t)) && by.Erregungsphysiologie.length >= 1, 'Erregungsphysiologie → Erregung: ' + by.Erregungsphysiologie);
ok(by.Muskelphysiologie.some((t) => /Muskelkontraktion/.test(t)) && by.Muskelphysiologie.some((t) => /Muskeltypen/.test(t)), 'Muskelphysiologie → Modul 4 + Muskelkontraktion: ' + by.Muskelphysiologie);
ok(by.Energiebereitstellungssysteme.join() === 'Physiologie 6 – Energiegewinnung', 'Energie → Energiegewinnung: ' + by.Energiebereitstellungssysteme);
ok(by.Wundheilung.join() === 'Physiologie 7 – Wundheilung', 'Wundheilung → Wundheilung');
const allTitles = titles([...new Set(ex.topics.flatMap((x) => x.lessons))]).join(' | ');
ok(!/Blut|Thermoregulation/.test(allTitles), 'nicht abgefragte Lektionen (Blut, Thermoregulation) bleiben draußen: ' + allTitles);

// ───── Lernplan ─────
let s = P.pruefState();
ok(s.start === '2026-11-08' && s.total === 19 && s.study === 18, `Plan: Start heute, 19 Tage, 18 Lerntage (${s.start}, ${s.total}, ${s.study})`);
ok(s.plan[0].from === 0 && s.plan.at(-1).to === s.study - 1, 'Themen füllen alle Lerntage');
ok(s.plan.every((x, i) => !i || x.from === s.plan[i - 1].to + 1), 'Themen lückenlos nacheinander, ohne Überschneidung');
ok(s.plan.every((x) => x.to >= x.from), 'jedes Thema mind. 1 Tag');
ok(s.today.length === 1 && s.today[0].name === 'Grundlagen der Physiologie', 'heute: erstes Thema');
ok(s.todayKat.startsWith('Lektion: '), 'Thementest-Kategorie');
const qs = Q.buildQuiz(s.todayKat, 15);
ok(qs.length > 0 && qs.every((q) => s.todayIds.includes(q.lesson)), 'Thementest nur aus den Lektionen des Themas');
const big = s.plan.find((x) => x.name === 'Erregungsphysiologie');
const small = s.plan.find((x) => x.name === 'Wundheilung');
ok(big.to - big.from >= small.to - small.from, 'mehr Fragen → mindestens so viele Tage');

// Plan wandert nicht: eine Woche später gleicher Start, anderes Thema
FIXED = new Date(2026, 10, 15, 8, 0).getTime();
s = P.pruefState();
ok(s.start === '2026-11-08' && s.dayIdx === 7, 'eine Woche später: Start bleibt 08.11., Tag 7');
ok(s.today.length >= 1 && s.today[0].from <= 7 && 7 <= s.today[0].to, 'Thema des Tages passt zu Tag 7: ' + s.today.map((x) => x.name));

// Vortag = Wiederholung, Prüfungstag
FIXED = new Date(2026, 10, 26, 8, 0).getTime();
s = P.pruefState();
ok(s.review && !s.today.length, 'Vortag: Gesamtwiederholung, kein Einzelthema');
FIXED = new Date(2026, 10, 27, 8, 0).getTime();
s = P.pruefState();
ok(s.examDay, 'Prüfungstag erkannt');
FIXED = new Date(2026, 10, 28, 8, 0).getTime();
ok(P.pruefState() === null, 'nach der Prüfung kein Sınav-Tab mehr');

// Mastery
FIXED = new Date(2026, 10, 8, 13, 0).getTime();
s = P.pruefState();
const m0 = P.mastery(s.todayIds);
ok(m0.n > 0 && m0.ok === 0, 'ohne Antworten: 0 % oturan');

// Backup ohne Plan-Feld bleibt unverändert, mit Plan-Feld bleibt es erhalten
const clean = store.sanitize(JSON.parse(JSON.stringify(store.get())));
ok(clean.pruef && clean.pruef['Physiologie|2026-11-27'] === '2026-11-08', 'Planstart übersteht Backup/Neuladen');
ok(!('pruef' in store.sanitize({})), 'ohne Sınav-Plan kein neues Feld im Backup');

console.log(fail ? `${fail} von ${n} Sınav-Tests fehlgeschlagen` : `Alle ${n} Sınav-Tests bestanden`);
process.exit(fail ? 1 : 0);
