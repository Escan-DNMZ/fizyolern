// Private Daten (Wochenplan, Fehlerliste, Notion-Links) – werden nicht veröffentlicht.
// Sie kommen aus private/fizyolern-ozel.json und werden nur im Browser des Geräts gespeichert.
const KEY = 'fizyo.private';

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* privater Modus o. Ä. */ }
  return null;
}

export function getPrivate() { return data; }

export function setPrivate(obj) {
  if (!obj || obj.kind !== 'fizyolern-private') throw new Error('format');
  data = obj;
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) { /* ignorieren */ }
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

export const fehlerList = () => (data && data.fehler) || [];
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
