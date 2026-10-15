// Lokaler Speicher (localStorage) + Spaced-Repetition-Logik
const KEY = 'fizyo.v1';

const DEFAULT = () => ({
  srs: {},          // kartId -> { int, due, reps, lapses }
  quiz: {},         // frageId -> { r, w, last }
  open: {},         // frageId -> { score, last }
  days: {},         // 'YYYY-MM-DD' -> { cards, quiz, quizRight, open, lesson, lesson2, muscleId, boneId }
  learned: {},      // strukturId -> datum
  customVocab: [],  // eigene Vokabeln
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

export function streak() {
  // Ein Tag zählt, wenn irgendeine Aktivität stattgefunden hat
  const active = (d) => d && (d.cards > 0 || d.quiz > 0 || d.open > 0 || d.lesson || d.lesson2);
  let n = 0;
  let off = active(state.days[today()]) ? 0 : -1;
  while (active(state.days[today(off)])) { n++; off--; }
  return n;
}

// ───── Spaced Repetition (vereinfachtes SM-2) ─────
// rating: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht
export function rate(cardId, rating) {
  const c = state.srs[cardId] || { int: 0, due: today(), reps: 0, lapses: 0 };
  if (rating === 0) {
    c.int = 0; c.lapses++; c.due = today();
  } else {
    if (rating === 1) c.int = Math.max(1, Math.round(c.int * 1.2));
    else if (rating === 2) c.int = c.int < 1 ? 1 : Math.round(c.int * 2.5);
    else c.int = c.int < 1 ? 4 : Math.round(c.int * 3.5);
    c.int = Math.min(c.int, 365);
    c.due = today(c.int);
  }
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
export function buildSession(cards) {
  const due = cards.filter((c) => isDue(c.id)).sort((a, b) => state.srs[a.id].due.localeCompare(state.srs[b.id].due));
  const introducedToday = Object.keys(state.srs).filter((id) => state.srs[id].first === today()).length;
  const newLimit = Math.max(0, state.settings.newPerDay - introducedToday);
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
  s.last = today();
  state.quiz[qid] = s;
  const d = day();
  d.quiz++;
  if (correct) d.quizRight++;
  save();
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
