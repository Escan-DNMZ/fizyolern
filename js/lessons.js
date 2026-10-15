// Ders-Notları = mitgelieferte Lektionen (js/data/lessons.js) + Zeilen aus der Notion-Datenbank „FizyoLern Sorular“.
// Die Notion-Zeilen liegen nur im Browser (getPrivate().lessonRows) und gewinnen bei gleicher Frage.
// LESSONS und FAECHER werden an Ort und Stelle aktualisiert, damit alle Importe die neuen Daten sehen.
import { LESSONS as BUILTIN } from './data/lessons.js';
import { getPrivate } from './private.js';

export const LESSONS = [];
export const FAECHER = [];

const key = (s) => String(s || '').toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
const slug = (s) => key(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// „Lektion“ aus Notion einer mitgelieferten Lektion zuordnen: über id, Titel oder Titelanfang („Allg. Anatomie 1“)
function findLesson(list, fach, lektion) {
  const k = key(lektion);
  if (!k) return list.find((l) => l.fach === fach && l.notionOnly && !l.lektion) || null;
  return list.find((l) => key(l.id) === k || key(l.title) === k || key(l.lektion) === k)
    || list.find((l) => l.fach === fach && key(l.title).startsWith(k + ' '))
    || null;
}

// Eine Notion-Zeile in einen Lektionseintrag umwandeln (null = unvollständig)
export function rowToItem(r) {
  switch (r.typ) {
    case 'Kern':
      return r.frage ? { de: r.frage, tr: r.erkl || r.antwort || '' } : null;
    case 'MCQ': {
      const o = [r.antwort, ...r.ablenker].map((s) => (s || '').trim()).filter(Boolean);
      if (o.length !== 4 || new Set(o).size !== 4 || !r.frage) return null;
      return { id: 'N:' + r.h, q: r.frage, o, x: r.erkl || '' };
    }
    case 'Offen':
      return r.frage && r.kw.length ? { id: 'NO:' + r.h, q: r.frage, a: r.antwort || '', kw: r.kw } : null;
    case 'Wort':
      return r.frage && r.antwort ? { de: r.frage, tr: r.antwort, ex: r.erkl || '' } : null;
    default:
      return null;
  }
}

const FIELD = { Kern: ['kern', 'de'], MCQ: ['mcq', 'q'], Offen: ['open', 'q'], Wort: ['vocab', 'de'] };

export function mergeLessons(builtin, rows = []) {
  const list = builtin.map((l) => ({ ...l, kern: [...l.kern], mcq: [...l.mcq], open: [...l.open], vocab: [...l.vocab] }));
  let skipped = 0;
  for (const r of rows) {
    const item = rowToItem(r);
    if (!item || !r.fach) { skipped++; continue; }
    let l = findLesson(list, r.fach, r.lektion);
    if (!l) {
      const title = r.lektion || r.fach + ' – Notion';
      l = { id: 'n-' + (slug(r.fach + ' ' + (r.lektion || 'notion')) || r.h), fach: r.fach, title, lektion: r.lektion, notionOnly: true, kern: [], mcq: [], open: [], vocab: [] };
      list.push(l);
    }
    const [arr, f] = FIELD[r.typ];
    // Gleiche Frage/gleicher Begriff wie mitgeliefert → Notion gewinnt; die alte id bleibt, damit der Lernstand erhalten bleibt
    const i = l[arr].findIndex((x) => key(x[f]) === key(item[f]));
    // (mitgelieferte Fragen haben keine eigene id, sondern „L:<lektion>:<index>“ – daher die Notion-id dann weglassen)
    if (i >= 0) {
      const { id, ...rest } = item;
      l[arr][i] = l[arr][i].id ? { ...rest, id: l[arr][i].id } : rest;
    } else l[arr].push(item);
  }
  return { lessons: list, skipped };
}

export function refreshLessons() {
  const p = getPrivate();
  const { lessons, skipped } = mergeLessons(BUILTIN, (p && p.lessonRows) || []);
  LESSONS.splice(0, LESSONS.length, ...lessons);
  FAECHER.splice(0, FAECHER.length, ...new Set(LESSONS.map((l) => l.fach)));
  return skipped;
}

refreshLessons();
