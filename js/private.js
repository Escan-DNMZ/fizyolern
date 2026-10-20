// Private Daten (Wochenplan, Fehlerliste, Notion-Links) – werden nicht veröffentlicht.
// Sie kommen aus private/fizyolern-ozel.json und werden nur im Browser des Geräts gespeichert.
import { t } from './i18n.js';
import './strings.js';

const KEY = 'fizyo.private';

// Typen prüfen (Notion-Sync, importierte Datei oder gespeicherter Stand): falsche Typen ließen sonst Seiten abstürzen
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = (x, max = 5000) => (typeof x === 'string' ? x.slice(0, max) : x == null ? '' : String(x).slice(0, max));
const strs = (x, max = 500) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string').map((v) => v.slice(0, max)).slice(0, 200) : []);
const date = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : '');
// Zeitstempel wie bei Notion („2026-10-20T08:15:00.000Z“), sonst leer
const iso = (x) => (typeof x === 'string' && x.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/.test(x) && Number.isFinite(Date.parse(x)) ? x : '');
const objs = (x, n = 5000) => (Array.isArray(x) ? x.filter(isObj).slice(0, n) : []);
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
function cleanWeek(w) {
  if (!isObj(w)) return null;
  const days = {};
  if (isObj(w.days)) for (const [k, d] of Object.entries(w.days)) if (/^[1-7]$/.test(k) && isObj(d)) days[k] = { kurse: strs(d.kurse), test: strs(d.test, 100), note: str(d.note, 1000) };
  const kw = Number(w.kw);
  return { kw: Number.isFinite(kw) ? Math.round(kw) : 0, range: str(w.range, 100), from: date(w.from), to: date(w.to), days };
}
// Notion-Links: nur echte Notion-Seiten (keine fremden Adressen aus einer manipulierten Datei)
export const NOTION_URL = /^https:\/\/(www\.)?notion\.so\/[0-9a-f]{32}$/;
export function cleanPrivate(obj) {
  if (!isObj(obj) || obj.kind !== 'fizyolern-private') throw new Error('format');
  const notion = {};
  if (isObj(obj.notion)) for (const [k, v] of Object.entries(obj.notion)) if (!BAD.has(k) && typeof v === 'string' && NOTION_URL.test(v)) notion[k] = v;
  return {
    kind: 'fizyolern-private', version: Number(obj.version) || 1, source: str(obj.source, 50), syncedAt: str(obj.syncedAt, 40),
    week: cleanWeek(obj.week),
    weeks: objs(obj.weeks, 60).map(cleanWeek).filter(Boolean),
    fehler: objs(obj.fehler, 3000).map((f) => ({
      id: str(f.id, 100), fach: str(f.fach, 100), q: str(f.q, 2000), ...(f.odev ? { odev: str(f.odev, 200) } : {}),
      ...(Array.isArray(f.seg) ? { seg: f.seg.filter(isObj).slice(0, 200).map((x) => ({ t: str(x.t, 2000), b: !!x.b })) } : {}),
      ...(f.a !== undefined ? { a: str(f.a, 2000) } : {}), ...(f.tr !== undefined ? { tr: str(f.tr, 2000) } : {}),
    })).filter((f) => f.id),
    gw: objs(obj.gw, 5000).map((w) => ({ id: str(w.id, 300), de: str(w.de, 300), tr: str(w.tr, 500), ...(w.en ? { en: str(w.en, 500) } : {}), ex: str(w.ex, 1000), cat: str(w.cat, 100), stufe: str(w.stufe, 50), next: date(w.next) })).filter((w) => w.id && w.de),
    lessonRows: objs(obj.lessonRows, 5000).filter((r) => /^[0-9a-f]{16}$/.test(r.h)).map((r) => ({ h: r.h, fach: str(r.fach, 100), lektion: str(r.lektion, 200), typ: str(r.typ, 20), frage: str(r.frage), antwort: str(r.antwort), ablenker: strs(r.ablenker, 1000).slice(0, 3), erkl: str(r.erkl), kw: strs(r.kw, 200).slice(0, 20), ...(iso(r.created) ? { created: r.created } : {}) })),
    exams: objs(obj.exams, 500).map((e) => ({ typ: e.typ === 'Sınav' ? 'Sınav' : 'Ödev', fach: str(e.fach, 100), topic: str(e.topic, 300), date: date(e.date), done: !!e.done, note: str(e.note, 500) })).filter((e) => e.date),
    // Checklisten-Lernziele (Texte der Lehrkraft – nur auf dem Gerät)
    ck: objs(obj.ck, 2000).filter((c) => typeof c.id === 'string' && /^ck:[0-9a-f]{16}$/.test(c.id)).map((c) => ({
      id: c.id, fach: str(c.fach, 100), sec: str(c.sec, 200), text: str(c.text, 600), done: !!c.done, date: date(c.date), skript: str(c.skript, 30),
      notu: (Array.isArray(c.notu) ? c.notu : []).filter((n) => Number.isInteger(n) && n > 0 && n < 1000).slice(0, 10),
      nh: strs(c.nh, 16).filter((h) => /^[0-9a-f]{16}$/.test(h)).slice(0, 10),
    })).filter((c) => c.fach && c.text),
    notion,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return cleanPrivate(JSON.parse(raw));
  } catch (e) { /* privater Modus oder kaputte Daten */ }
  return null;
}

let data = load(); // nach den Prüffunktionen (sonst Zugriff vor der Definition)

export function getPrivate() { return data; }

// gibt false zurück, wenn der Speicher voll ist (die Daten gelten dann nur bis zum Neuladen)
export function setPrivate(obj) {
  data = cleanPrivate(obj);
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

export function clearPrivate() {
  data = null;
  try { localStorage.removeItem(KEY); } catch (e) { /* ignorieren */ }
}

// Beim Entwickeln auf dem eigenen Rechner die Datei automatisch laden
export async function loadLocalDevFile() {
  if (data || !['localhost', '127.0.0.1'].includes(location.hostname)) return false;
  try {
    const res = await fetch('private/fizyolern-ozel.json', { cache: 'no-store' });
    if (!res.ok) return false;
    setPrivate(await res.json());
    return true;
  } catch { return false; }
}

// Notion-interne Notizen aus Fehlerkarten entfernen: „(2. Tur ✅)“, „(3. Tur ✅ 15.10)“, Status-Emojis.
// Funktioniert auch, wenn eine Notiz über mehrere fett/normal formatierte Segmente verteilt ist.
// auch „(15.10 wieder ½ → 3. Tur)“ – jede Klammer, in der „Tur“ (Wiederholungsrunde) steht
const NOTE_RE = /\s*\([^()]*\bTur\b[^()]*\)|\s*\((?:\s*[✅❌✓]\s*)+\)|[✅❌]/g;
// Meta-Hinweis am Kartenanfang: „(FizyoLern 17.10)“, „(14.10 Heimweg)“, „(2×)“, „(Ek bilgi)“
const META_RE = /^\s*\((?:[^()]*\b\d{1,2}\.\d{1,2}\b[^()]*|\d+\s*×|Bonus|Ek bilgi)\)\s*/i;
export const cleanText = (s) => String(s || '').replace(NOTE_RE, '').replace(/\s{2,}/g, ' ').trim();
export function cleanSegments(seg) {
  if (!seg || !seg.length) return seg;
  const full = seg.map((x) => x.t).join('');
  const drop = new Uint8Array(full.length);
  for (const m of full.matchAll(NOTE_RE)) drop.fill(1, m.index, m.index + m[0].length);
  let pos = 0;
  const out = seg.map((x) => {
    let t = '';
    for (let i = 0; i < x.t.length; i++) if (!drop[pos + i]) t += x.t[i];
    pos += x.t.length;
    return { ...x, t: t.replace(/\s{2,}/g, ' ') };
  }).filter((x) => x.t.length);
  if (out.length) { out[0].t = out[0].t.replace(META_RE, '').replace(/^\s+/, ''); out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, ''); }
  return out.filter((x) => x.t.length);
}

// Vorderseite einer Notion-Fehlerkarte: fett gedruckte Teile werden zu Lücken.
// Ohne Fettdruck: Frage bis zur ersten Trennstelle außerhalb von Klammern/Anführungszeichen („10 Körpersysteme: ?“),
// damit die Antwort nie schon vorne steht.
export function cardFront(seg) {
  const s = cleanSegments(seg) || [];
  const gap = (x) => x.b && x.t.trim().length > 1;
  if (s.some(gap)) return cleanText(s.map((x) => (gap(x) ? ' ＿＿＿ ' : x.t)).join(''));
  const full = cleanText(s.map((x) => x.t).join(''));
  let depth = 0;
  for (let i = 0; i < full.length; i++) {
    const c = full[i];
    if (c === '(' || c === '„') depth++;
    else if (c === ')' || c === '“') depth = Math.max(0, depth - 1);
    else if (!depth) {
      for (const sep of [' = ', ' → ', ': ']) if (full.startsWith(sep, i) && i > 3) return full.slice(0, i) + (sep === ': ' ? ': ?' : ' = ?');
    }
  }
  return t('remember') + (full.length > 60 ? full.slice(0, 60) + '…' : full);
}

// Notion-✗-Liste: echte Fehler und Hausaufgaben („Ezber kartları“) getrennt
export const fehlerList = () => ((data && data.fehler) || []).filter((f) => !f.odev);
export const odevList = () => ((data && data.fehler) || []).filter((f) => f.odev);
export const ckList = () => ((data && data.ck) || []);
export const notionLink = (lessonId) => data && data.notion && data.notion[lessonId];
const isoDate = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// Alle bekannten Wochen (neue Notion-Synchronisierung: data.weeks; ältere Daten: nur data.week)
const allWeeks = () => (data ? (data.weeks && data.weeks.length ? data.weeks : data.week ? [data.week] : []) : []);

// Woche für ein Datum: die Woche, die das Datum enthält; sonst die nächste zukünftige; sonst die letzte
export function weekFor(date = new Date()) {
  const iso = isoDate(date);
  const ws = allWeeks().filter((w) => w.from && w.to);
  return ws.find((w) => w.from <= iso && iso <= w.to)
    || ws.filter((w) => w.from > iso).sort((a, b) => a.from.localeCompare(b.from))[0]
    || ws.slice().sort((a, b) => b.from.localeCompare(a.from))[0]
    || (data && data.week) || null;
}
export const week = () => weekFor(new Date());

export function todayPlan(date = new Date()) {
  const iso = isoDate(date);
  const w = allWeeks().find((x) => x.from <= iso && iso <= x.to);
  if (!w) return null;
  const wd = ((date.getDay() + 6) % 7) + 1;
  return w.days[wd] || null;
}

// Plan für morgen (für die Zeile „Yarın: …“), auch über die Wochengrenze hinweg
export function tomorrowPlan(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return todayPlan(d);
}

// ───── Prüfungen & Hausaufgaben (Notion-Seite „Sınav & Ödev Takibi“) ─────
// { typ: 'Sınav' | 'Ödev', fach, topic, date: 'YYYY-MM-DD', done, note }
export const examList = () => ((data && data.exams) || []);
// Tage bis zu einem Datum (heute = 0)
export function daysUntil(iso, now = new Date()) {
  const t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - t) / 864e5);
}
// Kommende, noch nicht erledigte Einträge (heute eingeschlossen), nächster zuerst
export function upcoming(typ = 'Sınav', days = Infinity, now = new Date()) {
  return examList()
    .filter((e) => e.typ === typ && !e.done && e.date)
    .map((e) => ({ ...e, days: daysUntil(e.date, now) }))
    .filter((e) => e.days >= 0 && e.days <= days)
    .sort((a, b) => a.days - b.days);
}
// Fächer mit einer Prüfung in den nächsten 7 Tagen – haben Vorrang in Morgentest, Karten und Rückweg
export const examFaecher = (days = 7, now = new Date()) => [...new Set(upcoming('Sınav', days, now).map((e) => e.fach).filter(Boolean))];
