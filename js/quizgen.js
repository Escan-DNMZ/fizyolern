// Erzeugt Multiple-Choice-Fragen automatisch aus den Anatomie- und Vokabeldaten
import { MUSCLES, BONES, JOINTS } from './data/anatomy.js';
import { VOCAB } from './data/vocab.js';
import { MCQ } from './data/questions.js';
import { LESSONS } from './data/lessons.js';

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
export const lessonMcq = (l) => l.mcq.map((q, i) => ({ id: `L:${l.id}:${i}`, cat: l.fach, lesson: l.id, q: q.q, o: q.o, a: 0, x: q.x }));
export const ALL_LESSON_MCQ = () => LESSONS.flatMap(lessonMcq);
export const FAECHER = [...new Set(LESSONS.map((l) => l.fach))];

export const QUIZ_CATEGORIES = ['Gemischt', ...FAECHER.map((f) => 'Ders: ' + f), 'Muskeln', 'Knochen', 'Gelenke', 'Anatomie', 'Neuro', 'Klinik', 'Vokabeln'];

export function buildQuiz(category = 'Gemischt', n = 10, extraVocab = []) {
  const vocabPool = [...VOCAB, ...extraVocab];
  const pools = {
    Muskeln: () => MUSCLES.flatMap(muscleQuestions),
    Knochen: () => BONES.flatMap(boneQuestions),
    Gelenke: () => [...JOINTS.flatMap(jointQuestions), ...MCQ.filter((q) => q.cat === 'Gelenke')],
    Anatomie: () => MCQ.filter((q) => q.cat === 'Anatomie'),
    Neuro: () => MCQ.filter((q) => q.cat === 'Neuro'),
    Klinik: () => MCQ.filter((q) => q.cat === 'Klinik'),
    Vokabeln: () => pick(vocabPool, n * 2).map((v) => vocabQuestion(v, vocabPool)).filter(Boolean),
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
      ...pick(lessonQs, lessonQs.length ? Math.ceil(n * 0.4) : 0),
      ...pick(MCQ, Math.ceil(n * (lessonQs.length ? 0.2 : 0.4))),
      ...pick(pools.Muskeln(), Math.ceil(n * 0.3)),
      ...pick([...pools.Knochen(), ...JOINTS.flatMap(jointQuestions)], Math.ceil(n * 0.15)),
      ...pick(pools.Vokabeln(), Math.ceil(n * 0.15)),
    ];
  } else {
    qs = pools[category]();
  }
  return pick(qs, n).map(prepare);
}

// Antwortoptionen mischen und richtigen Index merken
export function prepare(q) {
  const order = shuffle(q.o.map((text, i) => ({ text, ok: i === q.a })));
  return { ...q, opts: order.map((o) => o.text), ans: order.findIndex((o) => o.ok) };
}
