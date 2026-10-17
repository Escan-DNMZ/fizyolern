// Lokaler Speicher (localStorage) + Spaced-Repetition-Logik
const KEY = 'fizyo.v1';

const DEFAULT = () => ({
  srs: {},          // kartId -> { int, due, reps, lapses }
  quiz: {},         // frageId -> { r, w, last }
  open: {},         // frageId -> { score, last }
  days: {},         // 'YYYY-MM-DD' -> { cards, quiz, quizRight, open, lesson, lesson2, muscleId, boneId }
  start: null,      // erster Nutzungstag 'YYYY-MM-DD' (für den Bericht)
  learned: {},      // strukturId -> datum
  customVocab: [],  // eigene Vokabeln
  words: {},        // Grundwortschatz-Leitner: wortId -> { box, due, r, w, last, known }
  settings: { cardsGoal: 15, quizGoal: 10, newPerDay: 10, reverse: false },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const d = DEFAULT();
      return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
    }
  } catch (e) { /* privater Modus o. Ä. */ }
  return DEFAULT();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ }
}

export function get() { return state; }

export function replace(newState) {
  const d = DEFAULT();
  state = { ...d, ...newState, settings: { ...d.settings, ...(newState.settings || {}) } };
  save();
}

export function reset() { state = DEFAULT(); save(); }

// ───── Datum ─────
export function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function day(date = today()) {
  if (!state.days[date]) state.days[date] = { cards: 0, quiz: 0, quizRight: 0, open: 0, lesson: false, lesson2: false };
  return state.days[date];
}

// Ein Tag zählt als aktiv, wenn irgendeine Aktivität stattgefunden hat
export const isActive = (d) => !!(d && (d.cards > 0 || d.quiz > 0 || d.open > 0 || d.lesson || d.lesson2 || d.wordsMorning || d.wordsReturn));

// Erster Nutzungstag (YYYY-MM-DD). Ältere Daten: frühester Tag mit Aktivität; danach fest gespeichert.
export function startDate() {
  if (!state.start) {
    const used = Object.keys(state.days).filter((k) => isActive(state.days[k])).sort();
    if (!used[0]) return today(); // noch nichts gelernt → erst der erste aktive Tag wird gespeichert
    state.start = used[0];
    save();
  }
  return state.start;
}

// Wievielter Tag seit dem ersten Nutzungstag (erster Tag = 1)
export function dayNumber(date = today()) {
  const [a, b] = [startDate(), date].map((x) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10)));
  return Math.round((b - a) / 86400000) + 1;
}

export function streak() {
  const active = isActive;
  let n = 0;
  let off = active(state.days[today()]) ? 0 : -1;
  while (active(state.days[today(off)])) { n++; off--; }
  return n;
}

// ───── Spaced Repetition (vereinfachtes SM-2) ─────
// rating: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht
// Nächstes Intervall für eine Bewertung – EINE Funktion für Speichern und Button-Beschriftung.
// Neue/vergessene Karten (int < 1) haben Lernschritte: Tekrar = gleich nochmal (1 dk), Zor = heute am Ende (10 dk),
// İyi = 1 Tag, Kolay = 4 Tage. Gelernte Karten: Zor ×1,2 · İyi ×2,5 · Kolay ×3,5, immer Zor < İyi < Kolay.
export function nextInterval(c, rating) {
  const int = (c && c.int) || 0;
  if (int < 1) {
    return [
      { days: 0, label: '1dk', requeue: 'soon' },
      { days: 0, label: '10dk', requeue: 'end' },
      { days: 1, label: '1g' },
      { days: 4, label: '4g' },
    ][rating];
  }
  if (rating === 0) return { days: 0, label: '1dk', requeue: 'soon' };
  // Obergrenze 1 Jahr – gestaffelt, damit die Reihenfolge auch dort erhalten bleibt
  const hard = Math.min(363, Math.max(1, Math.round(int * 1.2)));
  const good = Math.min(364, Math.max(hard + 1, Math.round(int * 2.5)));
  const easy = Math.min(365, Math.max(good + 1, Math.round(int * 3.5)));
  const days = [0, hard, good, easy][rating];
  return { days, label: days < 100 || days >= 300 ? days + 'g' : (days / 30).toFixed(1).replace('.', ',') + 'ay' };
}

export function rate(cardId, rating) {
  const c = state.srs[cardId] || { int: 0, due: today(), reps: 0, lapses: 0 };
  const next = nextInterval(c, rating);
  if (rating === 0 && c.int >= 1) c.lapses++;
  c.int = next.days;
  c.due = today(next.days);
  c.reps++;
  state.srs[cardId] = c;
  day().cards++;
  save();
  return c;
}

export function isDue(cardId) {
  const c = state.srs[cardId];
  return c && c.due <= today();
}

export function isNew(cardId) { return !state.srs[cardId]; }

// Karten für eine Sitzung: fällige zuerst, dann neue bis zum Tageslimit
export function buildSession(cards, { noNewLimit = false } = {}) {
  const due = cards.filter((c) => isDue(c.id)).sort((a, b) => state.srs[a.id].due.localeCompare(state.srs[b.id].due));
  const introducedToday = Object.keys(state.srs).filter((id) => state.srs[id].first === today()).length;
  const newLimit = noNewLimit ? Infinity : Math.max(0, state.settings.newPerDay - introducedToday);
  const fresh = cards.filter((c) => isNew(c.id)).slice(0, newLimit);
  return [...due, ...fresh];
}

export function markIntroduced(cardId) {
  if (!state.srs[cardId]) {
    state.srs[cardId] = { int: 0, due: today(), reps: 0, lapses: 0, first: today() };
  }
}

export function dueCount(cards) {
  return cards.filter((c) => isDue(c.id)).length;
}

// ───── Quiz-Statistik ─────
export function recordQuiz(qid, correct) {
  const s = state.quiz[qid] || { r: 0, w: 0 };
  if (correct) s.r++; else s.w++;
  s.st = correct ? (s.st || 0) + 1 : 0; // richtige Antworten in Folge
  s.last = today();
  state.quiz[qid] = s;
  const d = day();
  d.quiz++;
  if (correct) d.quizRight++;
  else d.wrong = [...new Set([...(d.wrong || []), qid])]; // für „Dönüş yolu“ und Samstag
  save();
}

// Falsch beantwortete Fragen der letzten n Tage (ohne Duplikate)
export function wrongSince(n = 7) {
  const ids = new Set();
  for (let k = 0; k < n; k++) ((state.days[today(-k)] || {}).wrong || []).forEach((id) => ids.add(id));
  return [...ids];
}

export function recordOpen(qid, score) {
  state.open[qid] = { score, last: today() };
  day().open++;
  save();
}

export function markLearned(id, slot) {
  state.learned[id] = today();
  day()[slot] = true;
  save();
}
