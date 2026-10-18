// Liest den Lernplan direkt aus dem eigenen Notion – nur lesend.
// Sicherheit:
//  • Der Integration-Token wird NUR im Browser dieses Geräts gespeichert (localStorage),
//    nie im Code, nie auf GitHub. Er wird ausschließlich an api.notion.com gesendet.
//  • Keine Seiten-IDs im öffentlichen Code: Seiten werden per Suche gefunden – die Integration
//    sieht nur, was in Notion ausdrücklich mit ihr geteilt wurde.
//  • Die Content-Security-Policy in index.html erlaubt Verbindungen nur zu 'self' und api.notion.com.
import { setPrivate, getPrivate, cleanSegments, cleanText, cardFront } from './private.js';
import { t } from './i18n.js';
import './strings.js';

const API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const TOKEN_KEY = 'fizyo.notionToken';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t.trim()); } catch { /* ignorieren */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignorieren */ }
}
// Notion-Tokens beginnen mit „ntn_“ (neu) oder „secret_“ (alt)
export const looksLikeToken = (t) => /^(ntn_|secret_)[A-Za-z0-9]{20,}$/.test(t.trim());

async function call(path, { method = 'GET', body } = {}) {
  const token = getToken();
  if (!token) throw new Error(t('nt.noKey'));
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 401 ? t('nt.401') : res.status === 404 ? t('nt.404') : (json.message || 'HTTP ' + res.status);
    throw new Error(msg);
  }
  return json;
}

const plain = (rt) => (rt || []).map((t) => t.plain_text).join('');

function titleOf(obj) {
  if (obj.object === 'database') return plain(obj.title);
  const p = Object.values(obj.properties || {}).find((x) => x.type === 'title');
  return p ? plain(p.title) : '';
}

// Titel-Varianten (Türkisch / Englisch / Deutsch): der Seitentitel muss einen davon enthalten (Groß-/Kleinschreibung egal)
export const TITLES = {
  plan: ['Haftalık Plan', 'Weekly Plan', 'Wochenplan'],
  words: ['Grundwortschatz', 'Vocabulary', 'Wortschatz'],
  lessons: ['Dersler', 'Lessons', 'Unterricht'],
  questions: ['FizyoLern Sorular', 'FizyoLern Questions', 'FizyoLern Fragen'],
  exams: ['Sınav & Ödev Takibi', 'Exams & Homework', 'Prüfungen & Hausaufgaben'],
};
async function findByTitle(names, type) {
  for (const query of [].concat(names)) {
    const r = await call('/search', { method: 'POST', body: { query, filter: { property: 'object', value: type }, page_size: 20 } });
    const hit = r.results.find((x) => lower(titleOf(x)).includes(lower(query)));
    if (hit) return hit;
  }
  return null;
}

async function children(id) {
  const out = [];
  let cursor;
  do {
    const r = await call(`/blocks/${id}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return out;
}

async function sha16(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const lower = (s) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '');
const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// Fachnamen aus Freitext erkennen („ANA 1“, „All ANA“, „PT-Befund“ …)
// Fächer ohne (bisherige) Notizen, die trotzdem im Stundenplan stehen
export const EXTRA_FAECHER = ['AM', 'AKL', 'Atemtherapie', 'KI'];

function faecherIn(text, faecher) {
  const t = ' ' + lower(text).replace(/[-–]/g, ' ') + ' ';
  const alias = { Anatomie: ['anatomie', 'ana '], 'PT Befund': ['pt befund'], 'PT Grundlagen': ['pt grundlagen'] };
  const all = [...new Set([...faecher, ...EXTRA_FAECHER])];
  return all.filter((f) => {
    if (f.length <= 3 && !alias[f]) return new RegExp(`[^a-zäöüß]${lower(f)}[^a-zäöüß]`).test(t); // AM, AKL, KI, PPS, O/C
    return (alias[f] || [lower(f)]).some((a) => t.includes(a));
  });
}

const DAY_NAMES = {
  1: ['pzt', 'pazartesi', 'mon', 'monday', 'mo', 'montag'],
  2: ['sal', 'sali', 'tue', 'tues', 'tuesday', 'di', 'dienstag'],
  3: ['car', 'carsamba', 'wed', 'wednesday', 'mi', 'mittwoch'],
  4: ['per', 'persembe', 'thu', 'thur', 'thursday', 'do', 'donnerstag'],
  5: ['cum', 'cuma', 'fri', 'friday', 'fr', 'freitag'],
  6: ['cmt', 'cumartesi', 'sat', 'saturday', 'sa', 'samstag'],
  7: ['paz', 'pazar', 'sun', 'sunday', 'so', 'sonntag'],
};
// erstes Wort der Zelle (ohne Punkt/Zahlen) → Wochentag 1–7, sonst 0
export function weekdayOf(cell) {
  const w = (lower(cell || '').replace(/ı/g, 'i').match(/^[a-z]+/) || [''])[0];
  for (const [d, names] of Object.entries(DAY_NAMES)) if (names.includes(w)) return +d;
  return 0;
}
const DASH = /^[\s—–-]*$|^\s*—/;

// ───── Wochenplan + Fehlerliste aus der Seite „Haftalık Plan“ ─────
export async function parsePlanPage(blocks, faecher, loadChildren) {
  // Alle Wochen der Seite lesen („## … KW 42 (…)“, „## KW 43 (…)“ unter „Gelecek haftalar“ usw.)
  const weeks = [];
  let week = null; // Woche, zu der die nächste Tabelle gehört
  const fehler = [];
  let fach = null;
  let inMistakes = false;
  let odev = null; // „✗ Ezber kartları – …“ = Hausaufgabe zum Auswendiglernen, keine Fehler

  for (const b of blocks) {
    const type = b.type;
    const rt = b[type] && b[type].rich_text;
    const text = plain(rt);

    // „KW 43“, „Week 43“, „Woche 43“, „Hafta 43“
    if (type === 'heading_2' && /(?:KW|Week|Woche|Hafta)\s*\d+/i.test(text)) {
      const kw = +text.match(/(?:KW|Week|Woche|Hafta)\s*(\d+)/i)[1];
      const m = text.match(/(\d{1,2})\.?\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      week = { kw, range: (text.match(/\(([^)]*)\)/) || [, ''])[1], days: {} };
      if (m) {
        const mon = new Date(+m[4], +m[3] - 1, +m[1]);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        week.from = fmt(mon); week.to = fmt(sun);
      }
      weeks.push(week);
    }
    if (type === 'table' && week && !Object.keys(week.days).length) {
      const rows = await loadChildren(b.id);
      for (const row of rows.slice(b.table.has_column_header ? 1 : 0)) {
        const cells = row.table_row.cells.map(plain);
        const wd = weekdayOf(cells[0]);
        if (!wd) continue;
        const kurse = [cells[1], cells[2]].filter((c) => c && !DASH.test(c));
        const tekrar = cells[3] || '';
        // „Sabah testi: …“ / „Morning test: …“ / „Morgentest: …“
        const sabah = tekrar.match(/(?:Sabah testi|Morning test|Morgen-?test):\s*([^·]+)/i);
        const rest = tekrar.replace(/(?:Sabah testi|Morning test|Morgen-?test):\s*[^·]+·?\s*/i, '').trim();
        week.days[wd] = {
          kurse,
          test: sabah ? faecherIn(sabah[1], faecher) : [],
          note: [rest, cells[4]].filter((c) => c && !DASH.test(c)).join(' · '),
        };
      }
    }
    if (type.startsWith('heading')) {
      inMistakes = false;
      odev = null;
      if (type === 'heading_3') fach = faecherIn(text, faecher)[0] || text.split(/[(·]/)[0].trim();
    }
    if (type === 'paragraph' && /^\s*✗/.test(text)) {
      inMistakes = true;
      odev = /ezber|ödev|hausaufgabe|auswendig|homework|memori[sz]/i.test(text) ? odevTitle(text) : null;
    }
    if (type === 'bulleted_list_item' && inMistakes && /^\s*(✗|½)/.test(text)) {
      const card = await mistakeCard(rt, fach);
      fehler.push(odev ? { ...card, odev } : card);
    }
  }
  return { week: pickWeek(weeks), weeks: weeks.filter((w) => w.from && Object.keys(w.days).length), fehler };
}

// „✗ Ezber kartları – Becken & Hüft-ROM (Cumartesi 17.10 odak, …): · @Seite“ → „Becken & Hüft-ROM“
export function odevTitle(text) {
  const t = text.replace(/^\s*✗\s*/, '').replace(/\s*[(:].*$/s, '').replace(/^(ezber\s*kartları|ödev(ler)?|hausaufgaben?|homework|memori[sz]ation(\s*cards)?)\s*[–—-]?\s*/i, '').trim();
  return t || 'Ödev';
}

// Woche, die das Datum enthält; sonst die nächste zukünftige; sonst die letzte
export function pickWeek(weeks, date = new Date()) {
  const iso = fmt(date);
  const valid = (weeks || []).filter((w) => w.from && w.to && Object.keys(w.days || {}).length);
  return valid.find((w) => w.from <= iso && iso <= w.to)
    || valid.filter((w) => w.from > iso).sort((a, b) => a.from.localeCompare(b.from))[0]
    || valid.sort((a, b) => b.from.localeCompare(a.from))[0]
    || null;
}

// Fehler als Lückentext: fett gedruckte Teile sind die Antwort
async function mistakeCard(rt, fach) {
  const seg = rt.map((t) => ({ t: t.plain_text, b: !!(t.annotations && t.annotations.bold) }));
  seg[0] = { ...seg[0], t: seg[0].t.replace(/^\s*(✗|½)\s*/, '') };
  const clean = (s) => s.replace(/\(\s*\d+\.\s*Tur[^)]*\)/gi, '').replace(/\s+/g, ' ').trim();
  const full = clean(seg.map((s) => s.t).join(''));
  // ID wie bisher aus „full“ (nur ohne „(n. Tur …)“) – so bleibt der Lernfortschritt alter Karten erhalten
  return { id: 'fx:' + (await sha16(full)), fach: fach || '', q: cardFront(seg), seg: cleanSegments(seg) };
}

// ───── Seite „Sınav & Ödev Takibi“: Prüfungen und Hausaufgaben ─────
// Tabelle „Liste“ (Tür | Ders | Konu/Başlık | Tarih | Durum | Not) und offene To-dos unter „Yaklaşan“.
// Datum: Notion-Datumserwähnung (@24.10.2026) oder Text „24.10.“, „24.10.2026“, „2026-10-24“.
export function dateIn(rt, now = new Date()) {
  const m = (rt || []).find((t) => t.type === 'mention' && t.mention && t.mention.date);
  if (m) return m.mention.date.start.slice(0, 10);
  const text = plain(rt);
  let x = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (x) return `${x[1]}-${x[2]}-${x[3]}`;
  x = text.match(/(?:^|[^\d.])(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
  if (!x || +x[2] < 1 || +x[2] > 12 || +x[1] < 1 || +x[1] > 31) return '';
  let y = x[3] ? +x[3] : now.getFullYear();
  if (y < 100) y += 2000;
  let d = new Date(y, +x[2] - 1, +x[1]);
  // ohne Jahr: liegt das Datum mehr als ein halbes Jahr zurück, ist das nächste Jahr gemeint
  if (!x[3] && now - d > 182 * 864e5) d = new Date(y + 1, +x[2] - 1, +x[1]);
  return fmt(d);
}

const DONE_RE = /✓|✅|☑|bitti|tamam|yap[ıi]ld[ıi]|teslim edildi|erledigt|geschrieben|abgegeben|\bdone\b/i;
const EXAM_RE = /s[ıi]nav|klausur|pr[üu]fung|test|exam|quiz/i;

export async function parseExamPage(blocks, faecher, loadChildren, now = new Date()) {
  const out = [];
  const fachOf = (text) => faecherIn(text, faecher)[0] || '';
  for (const b of blocks) {
    if (b.type === 'table') {
      const rows = await loadChildren(b.id);
      const cells0 = rows.length ? rows[0].table_row.cells.map((c) => lower(plain(c))) : [];
      const col = (re, dflt) => { const i = cells0.findIndex((c) => re.test(c)); return b.table.has_column_header && i >= 0 ? i : dflt; };
      const C = { typ: col(/tur|tür|typ|type|^art/, 0), ders: col(/ders|fach|subject/, 1), konu: col(/konu|baslik|thema|topic|title/, 2), tarih: col(/tarih|datum|date|due/, 3), durum: col(/durum|status/, 4), not: col(/^not|notiz|note/, 5) };
      for (const row of rows.slice(b.table.has_column_header ? 1 : 0)) {
        const cells = row.table_row.cells;
        const get = (k) => plain(cells[C[k]]).trim();
        const date = dateIn(cells[C.tarih], now);
        if (!date) continue; // leere Vorlagenzeile
        const ders = get('ders');
        out.push({
          typ: EXAM_RE.test(get('typ')) ? 'Sınav' : 'Ödev',
          fach: fachOf(ders) || ders,
          topic: get('konu'),
          date,
          done: DONE_RE.test(get('durum')),
          note: get('not'),
        });
      }
    }
    if (b.type === 'to_do') {
      const rt = b.to_do.rich_text;
      const text = plain(rt).trim();
      const date = dateIn(rt, now);
      if (!text || !date) continue;
      const fach = fachOf(text);
      const topic = text.replace(/\(?\s*\d{1,2}\.\d{1,2}\.(\d{2,4})?\s*\)?|\d{4}-\d{2}-\d{2}/g, '').replace(/\s*[–—:-]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
      out.push({ typ: EXAM_RE.test(text) ? 'Sınav' : 'Ödev', fach, topic, date, done: !!b.to_do.checked, note: '' });
    }
  }
  // gleiche Prüfung aus Liste und „Yaklaşan“ nur einmal
  const seen = new Set();
  return out.filter((e) => { const k = e.typ + e.fach + e.date; return !seen.has(k) && seen.add(k); })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ───── Grundwortschatz-Datenbank ─────
async function loadWords(db) {
  const words = [];
  let cursor;
  do {
    const r = await call(`/databases/${db.id}/query`, { method: 'POST', body: { page_size: 100, start_cursor: cursor } });
    for (const p of r.results) {
      const pr = p.properties;
      const get = (name) => {
        const x = pr[name];
        if (!x) return '';
        if (x.type === 'title') return plain(x.title);
        if (x.type === 'rich_text') return plain(x.rich_text);
        if (x.type === 'select') return x.select ? x.select.name : '';
        if (x.type === 'date') return x.date ? x.date.start.slice(0, 10) : '';
        return '';
      };
      const any = (...names) => names.map(get).find(Boolean) || '';
      const de = any('Wort', 'Word');
      const en = any('English', 'Englisch');
      if (de) words.push({ id: 'gw:' + de, de, tr: any('Türkçe', 'Turkish') || en, ...(en ? { en } : {}), ex: any('Beispiel', 'Example'), cat: 'GW · ' + (any('Kategorie', 'Category') || 'Diğer'), stufe: any('Stufe', 'Level'), next: any('Nächste Wiederholung', 'Next review') });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return words;
}

// ───── Datenbank „FizyoLern Sorular“: neue Lektionsinhalte ohne GitHub-Update ─────
// Eine Zeile = ein Eintrag (Typ Kern / MCQ / Offen / Wort). Die Seiten-ID wird nur gehasht gespeichert (stabile Fragen-ids).
const TYPEN = ['Kern', 'MCQ', 'Offen', 'Wort'];
export async function rowsFromPages(pages) {
  const rows = [];
  for (const p of pages) {
    const pr = p.properties || {};
    const get = (name) => {
      const x = pr[name];
      if (!x) return '';
      if (x.type === 'title') return plain(x.title).trim();
      if (x.type === 'rich_text') return plain(x.rich_text).trim();
      if (x.type === 'select') return x.select ? x.select.name : '';
      if (x.type === 'checkbox') return x.checkbox;
      return '';
    };
    if (get('Gizle') === true || p.archived || p.in_trash) continue;
    const typ = TYPEN.find((t) => lower(t) === lower(get('Typ') || ''));
    if (!typ) continue;
    rows.push({
      h: await sha16(p.id.replace(/-/g, '')),
      fach: get('Fach'),
      lektion: get('Lektion'),
      typ,
      frage: get('Frage'),
      antwort: get('Antwort'),
      ablenker: [get('Ablenker 1'), get('Ablenker 2'), get('Ablenker 3')],
      erkl: get('Erklärung TR'),
      // Komma oder Zeilenumbruch trennt Begriffe, „|“ trennt gleichwertige Alternativen
      kw: get('Schlüsselbegriffe').split(/[,;\n]/).map((k) => k.trim()).filter(Boolean),
    });
  }
  return rows;
}

async function loadLessonRows(db) {
  const pages = [];
  let cursor;
  do {
    const r = await call(`/databases/${db.id}/query`, {
      method: 'POST',
      body: { page_size: 100, start_cursor: cursor, sorts: [{ timestamp: 'created_time', direction: 'ascending' }] },
    });
    pages.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return rowsFromPages(pages);
}

// ───── Notion-Links zu den Ders-Notları (Zuordnung über gehashte Seiten-IDs) ─────
async function loadLessonLinks(dersler, lessons) {
  const map = {};
  const pages = (await children(dersler.id)).filter((b) => b.type === 'child_page');
  for (const p of pages) {
    const raw = p.id.replace(/-/g, '');
    const h = await sha16(raw);
    const l = lessons.find((x) => x.nh === h);
    if (l) map[l.id] = 'https://www.notion.so/' + raw;
  }
  return map;
}

export async function syncFromNotion({ faecher, lessons }) {
  const [planPage, db, dersler, sorular, sinav] = await Promise.all([
    findByTitle(TITLES.plan, 'page'),
    findByTitle(TITLES.words, 'database'),
    findByTitle(TITLES.lessons, 'page'),
    findByTitle(TITLES.questions, 'database'),
    findByTitle(TITLES.exams, 'page'),
  ]);
  if (!planPage && !db && !dersler && !sorular && !sinav) throw new Error(t('nt.nothing'));

  const old = getPrivate() || {};
  const result = { kind: 'fizyolern-private', version: 2, source: 'notion', syncedAt: new Date().toISOString() };
  const report = [];

  // Fragen-Datenbank zuerst: neue Fächer daraus (z. B. „Neurologie“) sollen im Wochenplan schon erkannt werden
  if (sorular) {
    result.lessonRows = await loadLessonRows(sorular);
    report.push(t('nt.lessonQ', { n: result.lessonRows.length }));
  } else result.lessonRows = old.lessonRows || [];
  faecher = [...new Set([...faecher, ...result.lessonRows.map((r) => r.fach).filter(Boolean)])];

  if (planPage) {
    const { week, weeks, fehler } = await parsePlanPage(await children(planPage.id), faecher, children);
    result.week = week || old.week;
    result.weeks = weeks.length ? weeks : old.weeks || [];
    result.fehler = fehler.length ? fehler : old.fehler || [];
    report.push(week ? t('nt.weeks', { list: weeks.map((w) => w.kw).join('/'), kw: week.kw }) : t('nt.noPlan'), t('nt.fehler', { n: fehler.length }));
  } else report.push(t('nt.noPlanPage'));

  if (db) {
    result.gw = await loadWords(db);
    report.push(t('n.words', { n: result.gw.length }));
  } else report.push(t('nt.noGw'));

  if (sinav) {
    result.exams = await parseExamPage(await children(sinav.id), faecher, children);
    const n = result.exams.filter((e) => e.typ === 'Sınav' && !e.done).length;
    report.push(t('nt.exams', { n, m: result.exams.length - n }));
  } else result.exams = old.exams || [];

  result.notion = dersler ? await loadLessonLinks(dersler, lessons) : old.notion || {};
  setPrivate(result);
  return report.join(' · ');
}
