// Erzeugt Multiple-Choice-Fragen automatisch aus den Anatomie- und Vokabeldaten
import { MUSCLES, BONES, JOINTS } from './data/anatomy.js';
import { VOCAB } from './data/vocab.js';
import { MCQ } from './data/questions.js';
import { LESSONS, FAECHER } from './lessons.js';
import * as store from './store.js';
import { week } from './private.js';

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (arr, n) => shuffle(arr).slice(0, n);

// Hauptnerv eines Innervations-Texts, z. B. "N. femoralis (L2–L4)" -> "N. femoralis"
const nerve = (s) => s.split(/[(,;]| und /)[0].trim();

// Baut eine Frage mit 3 Ablenkern, deren Text sich von der richtigen Antwort unterscheidet
function mk(id, cat, q, correct, pool, x, key = (v) => v) {
  const distract = pick(pool.filter((p) => key(p) !== key(correct)), 12);
  const uniq = [];
  for (const d of distract) {
    if (!uniq.some((u) => key(u) === key(d))) uniq.push(d);
    if (uniq.length === 3) break;
  }
  if (uniq.length < 3) return null;
  return { id, cat, q, o: [correct, ...uniq], a: 0, x, gen: true };
}

export function muscleQuestions(m) {
  const others = MUSCLES.filter((o) => o.id !== m.id);
  const qs = [
    mk(`g:inn:${m.id}`, 'Muskeln', `Welcher Nerv innerviert den ${m.la}?`, m.inn, others.map((o) => o.inn),
      `${m.la} → ${m.inn}`, nerve),
    mk(`g:ans:${m.id}`, 'Muskeln', `Wo setzt der ${m.la} an?`, m.i, others.map((o) => o.i), `${m.tr}: ${m.i}`),
    mk(`g:urs:${m.id}`, 'Muskeln', `Wo entspringt der ${m.la}?`, m.o, others.map((o) => o.o), `${m.tr}: ${m.o}`),
    mk(`g:fkt:${m.id}`, 'Muskeln', `Welche Funktion hat der ${m.la}?`, m.f, others.map((o) => o.f), m.ftr),
    mk(`g:rev:${m.id}`, 'Muskeln', `Welcher Muskel: Ursprung „${m.o}“, Ansatz „${m.i}“?`, m.la, others.map((o) => o.la),
      `${m.la} (${m.de}) – ${m.tr}`),
  ];
  return qs.filter(Boolean);
}

export function boneQuestions(b) {
  const others = BONES.filter((o) => o.id !== b.id);
  return [
    mk(`g:bla:${b.id}`, 'Knochen', `Wie lautet der lateinische Name für „${b.de}“?`, b.la, others.map((o) => o.la), `${b.de} = ${b.la} (${b.tr})`),
    mk(`g:btr:${b.id}`, 'Knochen', `Welcher Knochen ist auf Türkisch „${b.tr}“?`, b.de, others.map((o) => o.de), `${b.tr} = ${b.de} / ${b.la}`),
  ].filter(Boolean);
}

export function jointQuestions(j) {
  const others = JOINTS.filter((o) => o.id !== j.id);
  return [
    mk(`g:jtyp:${j.id}`, 'Gelenke', `Welcher Gelenktyp ist das ${j.de}?`, j.typ, others.map((o) => o.typ), `${j.de}: ${j.typ}`),
    mk(`g:jnn:${j.id}`, 'Gelenke', `Welches Bewegungsausmaß (Neutral-Null) gehört zum ${j.de}?`, j.nn, others.map((o) => o.nn), `${j.de}: ${j.nn}`),
  ].filter(Boolean);
}

export function vocabQuestion(v, pool = VOCAB) {
  const others = pool.filter((o) => o.id !== v.id);
  return Math.random() < 0.5
    ? mk(`g:vde:${v.id}`, 'Vokabeln', `Was bedeutet „${v.de}“?`, v.tr, others.map((o) => o.tr), v.ex || `${v.de} = ${v.tr}`)
    : mk(`g:vtr:${v.id}`, 'Vokabeln', `Wie sagt man auf Deutsch: „${v.tr}“?`, v.de, others.map((o) => o.de), v.ex || `${v.tr} = ${v.de}`);
}

// Fragen aus den Notion-Ders-Notları
export const lessonMcq = (l) => l.mcq.map((q, i) => ({ id: q.id || `L:${l.id}:${i}`, cat: l.fach, lesson: l.id, q: q.q, o: q.o, a: 0, x: q.x }));
export const ALL_LESSON_MCQ = () => LESSONS.flatMap(lessonMcq);
export { FAECHER };

// Funktion, weil neue Fächer aus Notion dazukommen können
export const quizCategories = () => ['Gemischt', ...FAECHER.map((f) => 'Ders: ' + f), 'Muskeln', 'Knochen', 'Gelenke', 'Anatomie', 'Neuro', 'Klinik', 'Vokabeln'];

// ───── Adaptive Auswahl ─────
// Schwierigkeitsstufen: Muskeln zuerst nur Nerv/Ansatz, dann Ursprung/Funktion,
// ab >80 % Trefferquote auch die umgekehrten Fragen und die ROM-Werte der Gelenke
const MUSCLE_LEVEL = { inn: 1, ans: 1, urs: 2, fkt: 2, rev: 3 };
const GEN_TOPIC = { inn: 'Muskeln', ans: 'Muskeln', urs: 'Muskeln', fkt: 'Muskeln', rev: 'Muskeln', bla: 'Knochen', btr: 'Knochen', jtyp: 'Gelenke', jnn: 'Gelenke', vde: 'Vokabeln', vtr: 'Vokabeln' };
const MIN_ANSWERS = 15; // erst ab so vielen Antworten wird eine Stufe freigeschaltet

// Frage-id -> Fach; neu aufgebaut, sobald sich die Lektionen ändern
let fachCache = {}, fachKey = '';
function lessonFach(qid) {
  const k = LESSONS.map((l) => l.id + l.mcq.length).join();
  if (k !== fachKey) { fachCache = Object.fromEntries(ALL_LESSON_MCQ().map((q) => [q.id, q.cat])); fachKey = k; }
  return fachCache[qid];
}
const MCQ_CAT = Object.fromEntries(MCQ.map((q) => [q.id, q.cat]));

// Themen-Schlüssel einer Frage = Kategorie, mit der buildQuiz genau dieses Thema startet
export function topicOf(qid) {
  const fach = lessonFach(qid);
  if (fach) return 'Ders: ' + fach;
  if (qid.startsWith('g:')) return GEN_TOPIC[qid.split(':')[1]] || null;
  return MCQ_CAT[qid] || null;
}

export function topicStats() {
  const out = {};
  for (const [id, s] of Object.entries(store.get().quiz)) {
    const t = topicOf(id);
    if (!t) continue;
    const o = out[t] || (out[t] = { r: 0, w: 0 });
    o.r += s.r; o.w += s.w;
  }
  return out;
}

// Die schwächsten Themen (mind. 5 Antworten), schlechteste Trefferquote zuerst
export function weakTopics(n = 3) {
  return Object.entries(topicStats())
    .filter(([, s]) => s.r + s.w >= 5)
    .map(([topic, s]) => ({ topic, acc: s.r / (s.r + s.w), total: s.r + s.w }))
    .sort((a, b) => a.acc - b.acc || b.total - a.total)
    .slice(0, n);
}

function accuracy(filter) {
  let r = 0, w = 0;
  for (const [id, s] of Object.entries(store.get().quiz)) if (filter(id)) { r += s.r; w += s.w; }
  return r + w >= MIN_ANSWERS ? r / (r + w) : null;
}

// 1 = Nerv/Ansatz, 2 = + Ursprung/Funktion (ab 60 %), 3 = + umgekehrte Fragen (ab 80 %)
export function muscleLevel() {
  const acc = accuracy((id) => topicOf(id) === 'Muskeln');
  return acc === null || acc < 0.6 ? 1 : acc <= 0.8 ? 2 : 3;
}

// ROM-Fragen erst, wenn die übrigen Gelenkfragen sitzen
export const romUnlocked = () => (accuracy((id) => topicOf(id) === 'Gelenke' && !id.startsWith('g:jnn:')) ?? 0) > 0.8;

// Fächer der Morgentests dieser Woche (aus dem privaten Wochenplan)
export function weekTestFaecher() {
  const w = week();
  if (!w || !w.days || store.today() > w.to) return new Set();
  return new Set(Object.values(w.days).flatMap((d) => (d && d.test) || []));
}

const daysSince = (iso) => (Date.now() - new Date(iso + 'T12:00:00')) / 864e5;

// Gewicht einer Frage: falsch beantwortete und lange nicht gesehene öfter,
// 3+ mal in Folge richtige seltener – aber nie 0
export function weight(qid, prio = new Set()) {
  const s = store.get().quiz[qid];
  let w;
  if (!s) w = 1.5;
  else {
    const st = s.st ?? (s.w ? 0 : s.r); // ältere Daten ohne Serie
    w = 1 + 3 * (s.w / (s.r + s.w));
    if (st === 0 && s.w) w += 2;                         // zuletzt falsch
    if (s.last) w += Math.min(daysSince(s.last) / 7, 2); // lange nicht gesehen
    if (st >= 3) w *= st >= 6 ? 0.1 : 0.25;
  }
  if (prio.size && prio.has(lessonFach(qid))) w *= 2.5;
  return Math.max(w, 0.05);
}

// Gewichtete Stichprobe ohne Zurücklegen (Efraimidis–Spirakis)
export function wpick(arr, n, wf) {
  return arr
    .map((x) => ({ x, k: Math.pow(Math.random(), 1 / wf(x)) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((e) => e.x);
}

function levelFilter(q) {
  const [g, kind] = q.id.split(':');
  if (g !== 'g') return true;
  if (MUSCLE_LEVEL[kind]) return MUSCLE_LEVEL[kind] <= muscleLevel();
  if (kind === 'jnn') return romUnlocked();
  return true;
}

export function buildQuiz(category = 'Gemischt', n = 10, extraVocab = []) {
  const vocabPool = [...VOCAB, ...extraVocab];
  const prio = weekTestFaecher();
  const wq = (q) => weight(q.id, prio);
  const wpickQ = (arr, k) => wpick(arr, k, wq);
  // Vokabeln: Gewicht aus beiden Richtungen zusammen
  const wv = (v) => Math.max(weight(`g:vde:${v.id}`), weight(`g:vtr:${v.id}`));
  const pools = {
    Muskeln: () => MUSCLES.flatMap(muscleQuestions).filter(levelFilter),
    Knochen: () => BONES.flatMap(boneQuestions),
    Gelenke: () => [...JOINTS.flatMap(jointQuestions).filter(levelFilter), ...MCQ.filter((q) => q.cat === 'Gelenke')],
    Anatomie: () => MCQ.filter((q) => q.cat === 'Anatomie'),
    Neuro: () => MCQ.filter((q) => q.cat === 'Neuro'),
    Klinik: () => MCQ.filter((q) => q.cat === 'Klinik'),
    Vokabeln: () => wpick(vocabPool, n * 2, wv).map((v) => vocabQuestion(v, vocabPool)).filter(Boolean),
  };
  let qs;
  if (category.startsWith('Ders: ') || category.startsWith('Lektion: ')) {
    // Ein Fach („Ders: Hygiene“) oder eine einzelne Lektion („Lektion: hygiene-1“)
    const keys = category.split(': ')[1].split(',');
    qs = ALL_LESSON_MCQ().filter((q) => keys.includes(q.cat) || keys.includes(q.lesson));
  } else if (category === 'Gemischt') {
    // Ausgewogene Mischung: Unterrichtsfragen aus Notion + handgeschriebene + generierte
    const lessonQs = ALL_LESSON_MCQ();
    qs = [
      ...wpickQ(lessonQs, lessonQs.length ? Math.ceil(n * 0.4) : 0),
      ...wpickQ(MCQ, Math.ceil(n * (lessonQs.length ? 0.2 : 0.4))),
      ...wpickQ(pools.Muskeln(), Math.ceil(n * 0.3)),
      ...wpickQ([...pools.Knochen(), ...JOINTS.flatMap(jointQuestions).filter(levelFilter)], Math.ceil(n * 0.15)),
      ...wpickQ(pools.Vokabeln(), Math.ceil(n * 0.15)),
    ];
  } else {
    qs = pools[category]();
  }
  return shuffle(wpickQ(qs, n)).map(prepare);
}

// Antwortoptionen mischen und richtigen Index merken
export function prepare(q) {
  const order = shuffle(q.o.map((text, i) => ({ text, ok: i === q.a })));
  return { ...q, opts: order.map((o) => o.text), ans: order.findIndex((o) => o.ok) };
}
