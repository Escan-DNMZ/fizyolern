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
  mocks: [],        // Deneme sınavı-Ergebnisse: { date, fach, pct, mcq: {r, n}, open: {score, n}, topics, min }
  mockRun: null,    // laufender Deneme sınavı (übersteht Neuladen der App)
  cases: {},        // Vaka çalışması: fallId -> { score, best, n, last, missed }
  caseRun: null,    // laufender Fall: { id, step, seen: [examId], f: { feld: text }, stadium, indik }
  ck: {},           // Checkliste-Selbsteinschätzung: lernzielId -> { lv: 0 😵 … 3 😊, last, auto: durch falsche Antwort gesenkt }
  mig: [],          // bereits ausgeführte Migrationen (Namen, siehe MIGRATIONS)
  revx: {},         // Ters kartlar nicht ganz gewusst (✗-Liste): kartId -> { k: gewusst, n: Muskeln, last }
  quizRun: null,    // laufender Test (übersteht 3D-Ansicht/Neuladen, nur für heute): { date, cat, donus, qs, i, right, wrong: [index], answers, finished, endAt }
  // lang = Hilfssprache (tr | en); classEnd = Unterrichtsende, wenn der Wochenplan keine Zeit hat; donusAfter = Rückweg so viele Minuten danach
  settings: { cardsGoal: 15, quizGoal: 10, newPerDay: 10, reverse: false, lang: 'tr', classEnd: '15:00', donusAfter: 0 },
});

// ───── Daten prüfen: gespeicherter Stand und importierte Sicherungen werden auf die erwarteten Typen gebracht ─────
// (schützt vor kaputten oder manipulierten Dateien: falsche Typen würden sonst Seiten abstürzen lassen oder HTML einschleusen)
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = (x, min = 0, max = 1e9, dflt = 0) => { const n = Number(x); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
const int = (x, min, max, dflt) => Math.round(num(x, min, max, dflt));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (x) => (typeof x === 'string' && DATE.test(x) ? x : undefined);
const str = (x, max = 2000) => (typeof x === 'string' ? x.slice(0, max) : x == null ? '' : String(x).slice(0, max));
const strArr = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string').slice(0, 5000) : []);
const rn = (x) => (isObj(x) ? { r: num(x.r), n: num(x.n) } : undefined);
// Wörterbuch: nur sichere Schlüssel, jeder Eintrag durch fn geprüft
function dict(x, fn) {
  const out = {};
  if (!isObj(x)) return out;
  for (const [k, v] of Object.entries(x)) {
    if (BAD_KEYS.has(k) || k.length > 300) continue;
    const r = fn(v, k);
    if (r !== undefined) out[k] = r;
  }
  return out;
}
const DAY_NUM = ['cards', 'quiz', 'quizRight', 'open', 'cases', 'oral'];
const DAY_RN = ['wordsMorning', 'wordsReturn', 'wordsWeek', 'lmQuiz'];
const DAY_ARR = ['wrong', 'words', 'fehlerSeen']; // müssen Listen sein
const DAY_OBJ = ['donus', 'wordRes'];          // müssen Objekte sein
function cleanDay(v) {
  if (!isObj(v)) return undefined;
  const d = { cards: 0, quiz: 0, quizRight: 0, open: 0, lesson: false, lesson2: false };
  for (const [k, x] of Object.entries(v)) {
    if (BAD_KEYS.has(k)) continue;
    if (DAY_NUM.includes(k)) d[k] = num(x);
    else if (DAY_RN.includes(k)) { const o = rn(x); if (o) d[k] = o; }
    else if (k === 'lesson' || k === 'lesson2' || k === 'morning') d[k] = !!x;
    else if (DAY_ARR.includes(k)) d[k] = strArr(x);
    else if (DAY_OBJ.includes(k)) d[k] = dict(x, (y) => (typeof y === 'boolean' || typeof y === 'string' ? (typeof y === 'string' ? str(y, 100) : y) : undefined));
    else if (Array.isArray(x)) d[k] = strArr(x);
    else if (isObj(x)) d[k] = dict(x, (y) => (typeof y === 'number' || typeof y === 'boolean' || typeof y === 'string' ? (typeof y === 'string' ? str(y, 300) : y) : undefined));
    else if (typeof x === 'number' || typeof x === 'boolean') d[k] = x;
    else if (typeof x === 'string') d[k] = str(x, 300);
  }
  return d;
}
// Laufender Test: nur vom heutigen Tag und nur, wenn jede Frage vollständig ist (sonst neu starten)
function cleanQuizRun(r) {
  if (!isObj(r) || date(r.date) !== today() || !Array.isArray(r.qs) || !r.qs.length || r.qs.length > 60) return null;
  const qs = [];
  for (const q of r.qs) {
    if (!isObj(q) || typeof q.id !== 'string' || typeof q.q !== 'string') return null;
    const opts = strArr(q.opts).map((o) => o.slice(0, 2000));
    if (opts.length < 2 || opts.length > 8 || !Number.isInteger(q.ans) || q.ans < 0 || q.ans >= opts.length) return null;
    qs.push({
      id: str(q.id, 300), cat: str(q.cat, 100), q: str(q.q, 3000), opts, ans: q.ans, x: str(q.x, 3000),
      ...(q.xEn ? { xEn: str(q.xEn, 3000) } : {}), ...(q.lesson ? { lesson: str(q.lesson, 200) } : {}), ...(q.fach ? { fach: str(q.fach, 100) } : {}),
    });
  }
  const n = qs.length;
  return {
    date: r.date, cat: str(r.cat, 300), donus: !!r.donus, qs, i: int(r.i, 0, n, 0), right: int(r.right, 0, n, 0),
    wrong: (Array.isArray(r.wrong) ? r.wrong : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n),
    answers: dict(r.answers, (v, k) => (/^\d{1,2}$/.test(k) && +k < n && Number.isInteger(v) && v >= 0 && v < qs[+k].opts.length ? v : undefined)),
    finished: !!r.finished, endAt: num(r.endAt, 0, 1e15),
  };
}
export function sanitize(raw) {
  const s = isObj(raw) ? raw : {};
  const d = DEFAULT();
  const set = isObj(s.settings) ? s.settings : {};
  return {
    ...d,
    srs: dict(s.srs, (v) => (isObj(v) ? { int: num(v.int, 0, 3650), due: date(v.due) || today(), reps: num(v.reps), lapses: num(v.lapses), ...(date(v.first) ? { first: v.first } : {}) } : undefined)),
    quiz: dict(s.quiz, (v) => (isObj(v) ? {
      r: num(v.r), w: num(v.w), st: num(v.st), ...(date(v.last) ? { last: v.last } : {}),
      // Fehler-Logik: letzter Fehltag + Tage mit richtiger Antwort danach (siehe mistakeLearned)
      ...(date(v.lastWrong) ? { lastWrong: v.lastWrong } : {}), ...(Array.isArray(v.okDays) ? { okDays: [...new Set(strArr(v.okDays).filter((x) => DATE.test(x)))].sort().slice(-5) } : {}),
    } : undefined)),
    open: dict(s.open, (v) => (isObj(v) ? { score: num(v.score, 0, 1), ...(date(v.last) ? { last: v.last } : {}) } : undefined)),
    days: dict(s.days, (v, k) => (DATE.test(k) ? cleanDay(v) : undefined)),
    start: date(s.start) || null,
    learned: dict(s.learned, (v) => date(v)),
    customVocab: (Array.isArray(s.customVocab) ? s.customVocab : []).filter(isObj).slice(0, 2000)
      .map((v) => ({ id: str(v.id, 300) || 'v:' + str(v.de, 200), de: str(v.de, 200), tr: str(v.tr, 300), ex: str(v.ex, 500), cat: str(v.cat, 100) || 'Eigene' }))
      .filter((v) => v.de && v.tr),
    words: dict(s.words, (v) => (isObj(v) ? { box: int(v.box, 0, 6, 0), due: date(v.due) || today(), r: num(v.r), w: num(v.w), c: num(v.c), known: num(v.known), ...(date(v.last) ? { last: v.last } : {}) } : undefined)),
    mocks: (Array.isArray(s.mocks) ? s.mocks : []).filter(isObj).slice(-50).map((m) => ({
      date: date(m.date) || today(), fach: str(m.fach, 100), pct: num(m.pct, 0, 100), min: num(m.min, 0, 600),
      mcq: rn(m.mcq) || { r: 0, n: 0 }, open: isObj(m.open) ? { score: num(m.open.score), n: num(m.open.n) } : { score: 0, n: 0 },
      topics: dict(m.topics, (v) => rn(v)),
      // Ergebnisdetails (werden beim Anzeigen escaped)
      wrong: (Array.isArray(m.wrong) ? m.wrong : []).filter(isObj).slice(0, 100).map((w) => ({ q: str(w.q), pick: w.pick == null ? null : str(w.pick), a: str(w.a), x: str(w.x), xEn: str(w.xEn), topic: str(w.topic, 100) })),
      openRes: (Array.isArray(m.openRes) ? m.openRes : []).filter(isObj).slice(0, 20).map((o) => ({ q: str(o.q), text: str(o.text, 5000), a: str(o.a, 5000), score: num(o.score, 0, 1),
        hits: (Array.isArray(o.hits) ? o.hits : []).filter(isObj).slice(0, 20).map((h) => ({ k: str(h.k, 200), hit: !!h.hit })) })),
    })),
    // laufender Deneme sınavı / Fall: nur übernehmen, wenn die Struktur stimmt (sonst neu starten)
    mockRun: isObj(s.mockRun) && Array.isArray(s.mockRun.mcq) && Array.isArray(s.mockRun.open) && s.mockRun.mcq.length + s.mockRun.open.length > 0
      && Number.isFinite(s.mockRun.start) && Number.isFinite(s.mockRun.end) && s.mockRun.mcq.every((q) => isObj(q) && Array.isArray(q.opts) && Number.isInteger(q.ans)) && s.mockRun.open.every((q) => isObj(q) && Array.isArray(q.kw))
      ? { ...s.mockRun, i: int(s.mockRun.i, 0, 200, 0), fach: str(s.mockRun.fach, 100), pick: isObj(s.mockRun.pick) ? s.mockRun.pick : {}, text: isObj(s.mockRun.text) ? s.mockRun.text : {} } : null,
    cases: dict(s.cases, (v) => (isObj(v) ? { n: num(v.n), best: num(v.best, 0, 100), score: num(v.score, 0, 100), missed: strArr(v.missed), ...(date(v.last) ? { last: v.last } : {}) } : undefined)),
    caseRun: isObj(s.caseRun) && typeof s.caseRun.id === 'string' && Array.isArray(s.caseRun.seen || []) && isObj(s.caseRun.f || {}) ? { ...s.caseRun, seen: strArr(s.caseRun.seen), f: dict(s.caseRun.f, (v) => (typeof v === 'string' ? v.slice(0, 5000) : undefined)) } : null,
    ck: dict(s.ck, (v, k) => (isObj(v) && /^ck:[0-9a-f]{16}$/.test(k) ? { lv: int(v.lv, 0, 3, 1), ...(date(v.last) ? { last: v.last } : {}), ...(v.auto ? { auto: true } : {}) } : undefined)),
    mig: strArr(s.mig).slice(0, 100),
    quizRun: cleanQuizRun(s.quizRun),
    revx: dict(s.revx, (v, k) => (isObj(v) && k.startsWith('rv:') ? { k: int(v.k, 0, 50, 0), n: int(v.n, 1, 50, 1), ...(date(v.last) ? { last: v.last } : {}) } : undefined)),
    settings: {
      cardsGoal: int(set.cardsGoal, 1, 200, d.settings.cardsGoal),
      quizGoal: int(set.quizGoal, 1, 50, d.settings.quizGoal),
      newPerDay: int(set.newPerDay, 0, 100, d.settings.newPerDay),
      reverse: !!set.reverse,
      lang: set.lang === 'en' ? 'en' : 'tr',
      classEnd: typeof set.classEnd === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(set.classEnd) ? set.classEnd : d.settings.classEnd,
      donusAfter: int(set.donusAfter, 0, 240, d.settings.donusAfter),
      ...(typeof set.oralText === 'boolean' ? { oralText: set.oralText } : {}),
    },
  };
}
// Sieht die Datei überhaupt wie eine FizyoLern-Sicherung aus?
export const looksLikeBackup = (x) => isObj(x) && isObj(x.srs) && isObj(x.days) && (x.settings === undefined || isObj(x.settings));

// ───── Migrationen: laufen einmal pro Stand (auch nach dem Einspielen einer älteren Sicherung) ─────
// Antworten zu Knochenpunkten, die falsch im Modell lagen: Fehler zählen nicht (Richtige bleiben)
function clearLmWrong(s, ids) {
  for (const id of ids) {
    const q = s.quiz[id];
    if (q && q.r) { const { lastWrong, okDays, ...rest } = q; s.quiz[id] = { ...rest, w: 0 }; } // kein Eintrag in der Fehlerliste mehr
    else delete s.quiz[id];
    for (const d of Object.values(s.days)) if (d.wrong) d.wrong = d.wrong.filter((x) => x !== id);
  }
}
const MIGRATIONS = {
  // „Noktayı bul“: Trochanter minor lag im Modell auf Höhe des Trochanter major. Wer die richtige Stelle angetippt hat,
  // bekam einen Fehler – diese Fehler zählen nicht (auch Iliopsoas-Ansatz, dessen einzige Antwort der Trochanter minor ist).
  lmTrochMinor2026(s) { clearLmWrong(s, ['lm:trochanter_minor', 'lm:i:iliopsoas']); },
  // SIAI lag im Einschnitt direkt unter der SIAS (Ursprung des M. rectus femoris), Incisura ischiadica major am oberen Rand
  lmSiai2026(s) { clearLmWrong(s, ['lm:siai', 'lm:o:rectus_femoris', 'lm:incisura_ischiadica_major']); },
  // Geprüfte „TODO: prüfen“-Punkte verschoben (Linea m. solei, Tubercula supra-/infraglenoidale, Cavitas glenoidalis,
  // Tuberositas radii, Basis MC II dorsal/palmar getrennt, Proc. costales L1–L4)
  lmTodo2026(s) {
    clearLmWrong(s, ['lm:linea_musculi_solei', 'lm:o:soleus', 'lm:tuberculum_supraglenoidale', 'lm:o:biceps_brachii', 'lm:tuberculum_infraglenoidale',
      'lm:o:triceps_brachii', 'lm:cavitas_glenoidalis', 'lm:tuberositas_radii', 'lm:i:biceps_brachii', 'lm:basis_ossis_metacarpalis_ii',
      'lm:i:flexor_carpi_radialis', 'lm:i:extensor_carpi_radialis_longus', 'lm:i:quadratus_lumborum']);
  },
  // Linea aspera in Labium mediale/laterale geteilt (Muskeln dorthin), Tuberculum pubicum nach lateral;
  // die alte Regel „anderer Punkt näher = falsch“ hat Treffer neben der Symphyse als Fehler gezählt
  lmLabia2026(s) {
    clearLmWrong(s, ['lm:tuberculum_pubicum', 'lm:symphysis_pubica', 'lm:o:adductor_longus', 'lm:o:gracilis', 'lm:o:rectus_abdominis', 'lm:linea_aspera', 'lm:o:vastus_medialis',
      'lm:o:vastus_lateralis', 'lm:o:biceps_femoris', 'lm:i:adductor_longus', 'lm:i:adductor_brevis', 'lm:i:adductor_magnus']);
  },
  // Fehler-Logik mit lastWrong/okDays: ältere Stände ableiten (nichts löschen).
  // lastWrong = letzter Tag, an dem die Frage in days[].wrong steht, sonst last (wenn die Serie 0 ist);
  // war die letzte Antwort richtig und später als der Fehltag, zählt dieser Tag als ein richtiger Tag.
  mistakeDays2026(s) {
    const wrongDay = {};
    for (const [d, v] of Object.entries(s.days)) for (const id of v.wrong || []) if (!wrongDay[id] || wrongDay[id] < d) wrongDay[id] = d;
    for (const [id, q] of Object.entries(s.quiz)) {
      if (!q.w || q.lastWrong) continue;
      const st = q.st ?? (q.w ? 0 : q.r);
      const lw = wrongDay[id] || (st === 0 ? q.last : undefined);
      if (lw) q.lastWrong = lw;
      q.okDays = st >= 1 && q.last && (!lw || q.last > lw) ? [q.last] : [];
    }
  },
};
export function migrate(s) {
  let changed = false;
  for (const [name, fn] of Object.entries(MIGRATIONS)) {
    if (s.mig.includes(name)) continue;
    fn(s);
    s.mig.push(name);
    changed = true;
  }
  return changed;
}

let state = load();
let saveError = null;
export const onSaveError = (fn) => { saveError = fn; };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = sanitize(JSON.parse(raw));
      if (migrate(s)) try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* beim nächsten Speichern */ }
      return s;
    }
  } catch (e) { /* privater Modus oder kaputte Daten */ }
  const s = DEFAULT();
  migrate(s); // neuer Stand: nichts zu reparieren, nur als erledigt merken
  return s;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { if (saveError) saveError(e); } // z. B. Speicher voll
}

export function get() { return state; }

export function replace(newState) {
  state = sanitize(newState);
  migrate(state);
  save();
}

export function reset() { state = DEFAULT(); migrate(state); save(); }

// ───── Datum ─────
export function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function day(date = today()) {
  const blank = { cards: 0, quiz: 0, quizRight: 0, open: 0, lesson: false, lesson2: false };
  // ältere Einträge können Felder fehlen → ergänzen (sonst „undefined/15“)
  state.days[date] = { ...blank, ...(state.days[date] || {}) };
  return state.days[date];
}

// Ein Tag zählt als aktiv, wenn irgendeine Aktivität stattgefunden hat
export const isActive = (d) => !!(d && (d.cards > 0 || d.quiz > 0 || d.open > 0 || d.lesson || d.lesson2 || d.wordsMorning || d.wordsReturn || d.cases));

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
  // einheitliche Einheiten: Tage bis 2 Monate, dann Monate, ab 1 Jahr Jahre
  return { days, label: days < 60 ? days + 'g' : days < 365 ? (days / 30).toFixed(1).replace('.', ',') + 'ay' : '1yıl' };
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

// Ters kart mit mehreren Muskeln: known von total gewusst. Nicht alles gewusst → ✗-Liste, alles gewusst → wieder heraus.
// rating wie bei rate() (aus partsRating() bzw. Gut/Leicht gewählt)
export function rateParts(cardId, known, total, rating) {
  if (known < total) state.revx[cardId] = { k: known, n: total, last: today() };
  else delete state.revx[cardId];
  return rate(cardId, rating); // speichert
}

export function isDue(cardId) {
  const c = state.srs[cardId];
  return c && c.due <= today();
}

export function isNew(cardId) { return !state.srs[cardId]; }

// Karten für eine Sitzung: fällige zuerst, dann neue bis zum Tageslimit
export function buildSession(cards, { noNewLimit = false } = {}) {
  const due = cards.filter((c) => isDue(c.id)).sort((a, b) => state.srs[a.id].due.localeCompare(state.srs[b.id].due));
  // Tageslimit für neue Karten pro Deck (sonst wären nach dem ersten Deck alle anderen „fertig“)
  const ids = new Set(cards.map((c) => c.id));
  const introducedToday = Object.keys(state.srs).filter((id) => ids.has(id) && state.srs[id].first === today()).length;
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

// ───── Deneme sınavı ─────
export function recordMock(result) {
  state.mocks = [...(state.mocks || []), result].slice(-50);
  state.mockRun = null;
  save();
}

// ───── Vaka çalışması (Befund-Trainer) ─────
export function recordCase(id, score, missed = []) {
  const c = state.cases[id] || { n: 0, best: 0 };
  state.cases[id] = { n: c.n + 1, best: Math.max(c.best, score), score, missed, last: today() };
  const d = day();
  d.cases = (d.cases || 0) + 1;
  save();
}

// ───── Quiz-Statistik ─────
// Andere Module können auf Antworten reagieren (z. B. Checkliste: falsche Antwort senkt die Selbsteinschätzung)
const quizListeners = [];
export const onQuizRecorded = (fn) => { quizListeners.push(fn); };
export function recordQuiz(qid, correct) {
  const s = state.quiz[qid] || { r: 0, w: 0 };
  if (correct) s.r++; else s.w++;
  s.st = correct ? (s.st || 0) + 1 : 0; // richtige Antworten in Folge
  // Fehler-Logik: falsch → Tage zurücksetzen; richtig nach einem Fehler → Tag merken (mehrmals am selben Tag zählt einmal)
  if (!correct) { s.lastWrong = today(); s.okDays = []; }
  else if (s.w) s.okDays = [...new Set([...(s.okDays || []), today()])].slice(-5);
  s.last = today();
  state.quiz[qid] = s;
  const d = day();
  d.quiz++;
  if (correct) {
    d.quizRight++;
    if (d.wrong) d.wrong = d.wrong.filter((id) => id !== qid); // später richtig beantwortet → nicht mehr unter „Bugünün hataları“
  } else d.wrong = [...new Set([...(d.wrong || []), qid])]; // für „Dönüş yolu“ und Samstag
  for (const fn of quizListeners) try { fn(qid, correct); } catch (e) { /* ein Zusatzmodul darf das Speichern nicht verhindern */ }
  save();
}

// ───── Checkliste: Selbsteinschätzung eines Lernziels (0 = kann ich nicht … 3 = kann ich) ─────
export function rateCk(id, lv, { auto = false } = {}) {
  if (lv === null) delete state.ck[id];
  else state.ck[id] = { lv: Math.max(0, Math.min(3, lv)), last: today(), ...(auto ? { auto: true } : {}) };
  save();
}

// Falsch beantwortete Fragen der letzten n Tage (ohne Duplikate)
// ───── Fehler: gelernt / fällig ─────
// Gelernt = nach dem letzten Fehler an zwei verschiedenen Tagen richtig (mit Fehler dazwischen beginnt es neu)
export const LEARN_DAYS = 2;
export const okDaysOf = (q) => (q && q.okDays) || [];
export const mistakeLearned = (q) => !!q && q.w > 0 && okDaysOf(q).length >= LEARN_DAYS;
// Tag, an dem der Fehler als gelernt gilt (zweiter richtiger Tag) – '' wenn noch nicht
export const learnedOn = (q) => (mistakeLearned(q) ? okDaysOf(q)[LEARN_DAYS - 1] : '');
// Fällig: gestern (oder früher) falsch → heute; danach einmal richtig → wieder 2 Tage später
export function mistakeDue(q, date = today()) {
  if (!q || !q.w || mistakeLearned(q)) return false;
  const ok = okDaysOf(q);
  if (!ok.length) return !!q.lastWrong && q.lastWrong < date;
  return ok[ok.length - 1] <= addDays(date, -2);
}
const addDays = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const dueMistakes = (date = today()) => Object.entries(state.quiz).filter(([, q]) => mistakeDue(q, date)).map(([id]) => id);

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
