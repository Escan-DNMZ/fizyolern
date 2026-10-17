// Liest den Lernplan direkt aus dem eigenen Notion – nur lesend.
// Sicherheit:
//  • Der Integration-Token wird NUR im Browser dieses Geräts gespeichert (localStorage),
//    nie im Code, nie auf GitHub. Er wird ausschließlich an api.notion.com gesendet.
//  • Keine Seiten-IDs im öffentlichen Code: Seiten werden per Suche gefunden – die Integration
//    sieht nur, was in Notion ausdrücklich mit ihr geteilt wurde.
//  • Die Content-Security-Policy in index.html erlaubt Verbindungen nur zu 'self' und api.notion.com.
import { setPrivate, getPrivate, cleanSegments, cleanText } from './private.js';

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
  if (!token) throw new Error('Notion anahtarı yok');
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
    const msg = res.status === 401 ? 'Anahtar geçersiz (401)' : res.status === 404 ? 'Sayfa bulunamadı – Notion\'da bağlantıyı (Connections) eklediğinden emin ol' : (json.message || 'HTTP ' + res.status);
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

async function findByTitle(query, type) {
  const r = await call('/search', { method: 'POST', body: { query, filter: { property: 'object', value: type }, page_size: 20 } });
  return r.results.find((x) => titleOf(x).includes(query)) || null;
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

const WD = { pzt: 1, sal: 2, car: 3, per: 4, cum: 5, cmt: 6, paz: 7 };
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

    if (type === 'heading_2' && /KW\s*\d+/.test(text)) {
      const kw = +text.match(/KW\s*(\d+)/)[1];
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
        const wd = WD[lower(cells[0] || '').slice(0, 3)];
        if (!wd) continue;
        const kurse = [cells[1], cells[2]].filter((c) => c && !DASH.test(c));
        const tekrar = cells[3] || '';
        const sabah = tekrar.match(/Sabah testi:\s*([^·]+)/i);
        const rest = tekrar.replace(/Sabah testi:\s*[^·]+·?\s*/i, '').trim();
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
      odev = /ezber|ödev|hausaufgabe|auswendig/i.test(text) ? odevTitle(text) : null;
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
  const t = text.replace(/^\s*✗\s*/, '').replace(/\s*[(:].*$/s, '').replace(/^(ezber\s*kartları|ödev(ler)?|hausaufgabe)\s*[–—-]?\s*/i, '').trim();
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
  let q;
  if (seg.some((s) => s.b && s.t.trim().length > 1)) {
    q = clean(seg.map((s) => (s.b && s.t.trim().length > 1 ? ' ＿＿＿ ' : s.t)).join(''));
  } else {
    const parts = full.split(/\s(?:=|→)\s/);
    q = parts.length > 1 ? parts[0] + ' = ?' : 'Hatırla: ' + full.slice(0, 60) + (full.length > 60 ? '…' : '');
  }
  // ID wie bisher aus „full“ (nur ohne „(n. Tur …)“) – so bleibt der Lernfortschritt alter Karten erhalten
  return { id: 'fx:' + (await sha16(full)), fach: fach || '', q: cleanText(q), seg: cleanSegments(seg) };
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
      const de = get('Wort');
      if (de) words.push({ id: 'gw:' + de, de, tr: get('Türkçe'), ex: get('Beispiel'), cat: 'GW · ' + (get('Kategorie') || 'Diğer'), stufe: get('Stufe'), next: get('Nächste Wiederholung') });
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
  const [planPage, db, dersler, sorular] = await Promise.all([
    findByTitle('Haftalık Plan', 'page'),
    findByTitle('Grundwortschatz', 'database'),
    findByTitle('Dersler', 'page'),
    findByTitle('FizyoLern Sorular', 'database'),
  ]);
  if (!planPage && !db && !dersler && !sorular) throw new Error('Hiçbir sayfa görünmüyor – Notion\'da Dashboard sayfasına bu bağlantıyı (Connections) ekle');

  const old = getPrivate() || {};
  const result = { kind: 'fizyolern-private', version: 2, source: 'notion', syncedAt: new Date().toISOString() };
  const report = [];

  if (planPage) {
    const { week, weeks, fehler } = await parsePlanPage(await children(planPage.id), faecher, children);
    result.week = week || old.week;
    result.weeks = weeks.length ? weeks : old.weeks || [];
    result.fehler = fehler.length ? fehler : old.fehler || [];
    report.push(week ? `KW ${weeks.map((w) => w.kw).join('/')} (bugün: KW ${week.kw})` : 'program bulunamadı', `${fehler.length} hata kartı`);
  } else report.push('Haftalık Plan görünmüyor');

  if (db) {
    result.gw = await loadWords(db);
    report.push(`${result.gw.length} kelime`);
  } else report.push('Grundwortschatz görünmüyor');

  if (sorular) {
    result.lessonRows = await loadLessonRows(sorular);
    report.push(`${result.lessonRows.length} ders sorusu`);
  } else result.lessonRows = old.lessonRows || [];

  result.notion = dersler ? await loadLessonLinks(dersler, lessons) : old.notion || {};
  setPrivate(result);
  return report.join(' · ');
}
