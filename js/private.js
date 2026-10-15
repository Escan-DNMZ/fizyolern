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
export const week = () => data && data.week;

export function todayPlan(date = new Date()) {
  const w = week();
  if (!w) return null;
  const iso = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  if (iso < w.from || iso > w.to) return null;
  const wd = ((date.getDay() + 6) % 7) + 1;
  return w.days[wd] || null;
}
