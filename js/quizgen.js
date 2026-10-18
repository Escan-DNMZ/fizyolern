// Erzeugt Multiple-Choice-Fragen automatisch aus den Anatomie- und Vokabeldaten
import { MUSCLES, BONES, JOINTS } from './data/anatomy.js';
import { VOCAB } from './data/vocab.js';
import { MCQ } from './data/questions.js';
import { UEBUNGEN } from './data/uebungen.js';
import { LESSONS, FAECHER } from './lessons.js';
import * as store from './store.js';
import { week, examFaecher } from './private.js';
import { t, tx, lang } from './i18n.js';
import './strings.js';

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (arr, n) => shuffle(arr).slice(0, n);

// Übersetzung eines Worts in der Hilfssprache. Notion-Wörter haben nur Türkisch:
// im Englisch-Modus dann das Englische des mitgelieferten Eintrags mit demselben deutschen Wort, sonst Türkisch.
let enByDe = null;
export function vocabTr(v) {
  if (!v) return '';
  if (lang() !== 'en') return v.tr || '';
  if (v.en) return v.en;
  if (!enByDe) { enByDe = new Map(); for (const x of VOCAB) if (x.en) enByDe.set(x.de, x.en); }
  return enByDe.get(v.de) || v.tr || '';
}

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

// Muskel-Fragen: Ablenker zuerst aus derselben Körperregion (sonst sind sie zu leicht auszuschließen),
// in der Erklärung steht, zu welchem Muskel jede falsche Antwort gehört
const short = (s, n = 55) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// Kern einer Angabe für den Vergleich: „Fossa trochanterica (gemeinsam …)“ → „fossa trochanterica“
const core = (v) => String(v).toLowerCase().replace(/\s*\(.*?\)/g, '').split(/[;,]/)[0].trim();
// Zwei Angaben überschneiden sich, wenn ihr Kern gleich ist oder einer im anderen steckt –
// dann wären zwei Optionen richtig (z. B. „Tuber ischiadicum“ / „Lateraler Rand des Tuber ischiadicum“)
const overlap = (a, b) => { const x = core(a), y = core(b); return x === y || (x.length > 5 && y.includes(x)) || (y.length > 5 && x.includes(y)); };
function mkMuscle(id, q, m, field, xBase, key = (v) => v) {
  const others = MUSCLES.filter((o) => o.id !== m.id);
  // gleiche Region zuerst; innerhalb davon Antworten ähnlicher Länge (sonst verrät die längste Option die Lösung)
  const len = (o) => Math.abs(Math.log((String(o[field]).length + 10) / (String(m[field]).length + 10)));
  const byLen = (list) => shuffle(list).sort((a, b) => len(a) - len(b) + (Math.random() - 0.5) * 0.3);
  const ordered = [...byLen(others.filter((o) => o.region === m.region)), ...byLen(others.filter((o) => o.region !== m.region))];
  const picks = [];
  for (const o of ordered) {
    if (key(o[field]) === key(m[field]) || overlap(o[field], m[field]) || picks.some((p) => key(p[field]) === key(o[field]) || overlap(p[field], o[field]))) continue;
    picks.push(o);
    if (picks.length === 3) break;
  }
  if (picks.length < 3) return null;
  const why = field === 'la'
    ? picks.map((p) => `${p.la} → ${short(p.i, 40)}`).join(' · ')
    : picks.map((p) => `${short(p[field], 40)} → ${p.la}`).join(' · ');
  return { id, cat: 'Muskeln', q, o: [m[field], ...picks.map((p) => p[field])], a: 0, x: `${xBase} ${t('qg.others')} ${why}`, gen: true };
}

export function muscleQuestions(m) {
  return [
    mkMuscle(`g:inn:${m.id}`, `Welcher Nerv innerviert den ${m.la}?`, m, 'inn', `${m.la} → ${m.inn}.`, nerve),
    mkMuscle(`g:ans:${m.id}`, `Wo setzt der ${m.la} an?`, m, 'i', `${tx(m)}: ${m.i}.`),
    mkMuscle(`g:urs:${m.id}`, `Wo entspringt der ${m.la}?`, m, 'o', `${tx(m)}: ${m.o}.`),
    mkMuscle(`g:fkt:${m.id}`, `Welche Funktion hat der ${m.la}?`, m, 'f', tx(m, 'ftr')),
    mkMuscle(`g:rev:${m.id}`, `Welcher Muskel: Ursprung „${m.o}“, Ansatz „${m.i}“?`, m, 'la', `${m.la} (${m.de}) – ${tx(m)}. ${t('qg.dontConfuse')}`),
  ].filter(Boolean);
}

export function boneQuestions(b) {
  const others = BONES.filter((o) => o.id !== b.id);
  return [
    mk(`g:bla:${b.id}`, 'Knochen', `Wie lautet der lateinische Name für „${b.de}“?`, b.la, others.map((o) => o.la), `${b.de} = ${b.la} (${tx(b)})`),
    mk(`g:btr:${b.id}`, 'Knochen', `Welcher Knochen ist auf ${t('qg.boneLang')} „${tx(b)}“?`, b.de, others.map((o) => o.de), `${tx(b)} = ${b.de} / ${b.la}`),
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
    ? mk(`g:vde:${v.id}`, 'Vokabeln', `Was bedeutet „${v.de}“?`, vocabTr(v), others.map(vocabTr), v.ex || `${v.de} = ${vocabTr(v)}`)
    : mk(`g:vtr:${v.id}`, 'Vokabeln', `Wie sagt man auf Deutsch: „${vocabTr(v)}“?`, v.de, others.map((o) => o.de), v.ex || `${vocabTr(v)} = ${v.de}`);
}

// ───── Studio-Übungen ↔ Muskel ↔ Bewegung ─────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-');
export function exerciseQuestions() {
  const byEx = {};
  for (const [mid, list] of Object.entries(UEBUNGEN)) {
    for (const u of list) (byEx[u.n] = byEx[u.n] || { ...u, muscles: [] }).muscles.push(mid);
  }
  const mName = (id) => ((MUSCLES.find((m) => m.id === id) || {}).la || id).replace(/\s*\(.*\)$/, '');
  const moves = (id) => (UEBUNGEN[id] || []).map((u) => u.b);
  const qs = [];
  for (const ex of Object.values(byEx)) {
    // Übung → Muskel: Ablenker nur Muskeln, die bei dieser Bewegung nicht mitarbeiten
    const exMoves = new Set(ex.muscles.flatMap(moves).filter((b) => b === ex.b));
    const right = pick(ex.muscles, 1)[0];
    // gleiche Körperregion, aber anderes Gelenk (z. B. Hip Thrust → Kniestrecker/Wade statt Bizeps); nie ein Mitspieler im selben Gelenk
    const joint = (b) => b.slice(0, 4);
    const region = (id) => (MUSCLES.find((m) => m.id === id) || {}).region;
    const regs = new Set(ex.muscles.map(region));
    const cand = Object.keys(UEBUNGEN).filter((id) => !ex.muscles.includes(id) && !moves(id).some((b) => exMoves.has(b) || joint(b) === joint(ex.b)));
    const wrong = [...pick(cand.filter((id) => regs.has(region(id)) || (regs.has('Hüfte') && region(id) === 'Bein') || (regs.has('Bein') && region(id) === 'Hüfte')), 3), ...pick(cand, 6)]
      .filter((id, i, arr) => arr.indexOf(id) === i).slice(0, 3);
    if (wrong.length === 3) {
      qs.push({ id: `g:ub:${slug(ex.n)}`, cat: 'Muskeln', gen: true, q: `Beim „${ex.n}“ arbeitet hauptsächlich …?`, o: [mName(right), ...wrong.map(mName)], a: 0,
        x: `${ex.n} (${tx(ex)}) = ${ex.b} → ${ex.muscles.map(mName).join(', ')}. ${t('qg.others')} ${wrong.map((id) => `${mName(id)} → ${moves(id)[0]}`).join(' · ')}.` });
    }
    // Bewegung → Übung
    const others = Object.values(byEx).filter((o) => o.b.split(' ')[0] !== ex.b.split(' ')[0]);
    const wrongEx = pick(others, 3);
    if (wrongEx.length === 3) {
      qs.push({ id: `g:ubb:${slug(ex.n)}`, cat: 'Muskeln', gen: true, q: `Welche Übung trainiert vor allem die ${ex.b}?`, o: [ex.n, ...wrongEx.map((o) => o.n)], a: 0,
        x: `${ex.n} (${tx(ex)}) → ${ex.b} (${ex.muscles.map(mName).join(', ')}). ${t('qg.others')} ${wrongEx.map((o) => `${o.n} → ${o.b}`).join(' · ')}.` });
    }
  }
  return qs;
}

// ───── Gelenk-Details: Neutral-Null (Folie), ADL, Achsen, Muskelgruppen ─────
// Funktioniert für jedes Gelenk mit den Feldern rom / adl / muskelGruppen (zurzeit nur die Hüfte)
// Bewegungsrichtung in der Hilfssprache (fleksiyon / flexion …)
const groupTr = (g) => { const s = t('grp.' + g); return s === 'grp.' + g ? g : s; };
const near = (v, steps = [5, 10, 15, 20, -5, -10, -15, -20]) => shuffle(steps).map((d) => v + d).filter((x) => x > 0 && x !== v).slice(0, 3);
const joinG = (list) => list.join(', ');

export function jointDetailQuestions(j) {
  const qs = [];
  const id = (k) => `g:jx:${j.id}:${k}`;
  const base = { cat: 'Gelenke', fach: j.fach || 'Gelenke', gen: true };
  const name = j.de.replace(/gelenk$/, 'gelenk');
  // Neutral-Null: einzelne Zahl und vollständige Schreibweise
  for (const [n, r] of (j.rom || []).entries()) {
    const [b1, b2] = r.bew.split(' / ');
    const q1 = near(r.a);
    qs.push({ ...base, id: id('rom-a' + n), q: `Wie viel Grad ${b1} hat das ${name} (Neutral-Null, ${j.romQuelle || 'Folie'})?`, o: [`${r.a}°`, ...q1.map((x) => `${x}°`)], a: 0,
      x: t('qg.romA', { bew: r.bew, a: r.a, b: r.b, nums: q1.map((x) => x + '°').join(', ') }) });
    const q2 = near(r.b, [5, 10, -5, 15]);
    qs.push({ ...base, id: id('rom-b' + n), q: `Wie viel Grad ${b2} hat das ${name} (Neutral-Null)?`, o: [`${r.b}°`, ...q2.map((x) => `${x}°`)], a: 0,
      x: `${b2} = ${r.b}° (${r.bew}: ${r.a}° – 0° – ${r.b}°). ${t('qg.romB')}` });
    const wrong = [[r.a, 0, r.b + 10], [r.a - 10, 0, r.b], [r.b, 0, r.a]].map(([x, y, z]) => `${x}° – ${y}° – ${z}°`);
    qs.push({ ...base, id: id('rom-nn' + n), q: `Welche Neutral-Null-Werte gelten für ${r.bew} im ${name}?`, o: [`${r.a}° – 0° – ${r.b}°`, ...wrong], a: 0,
      x: t('qg.romNn', { b1, b2, rev: `${r.b}° – 0° – ${r.a}°` }) });
    // Achse der Bewegung
    const axes = ['Transversalachse', 'Sagittalachse', 'Longitudinalachse', 'Diagonalachse'];
    qs.push({ ...base, id: id('achse' + n), q: `Um welche Achse findet ${r.bew} im ${name} statt?`, o: [r.achse, ...axes.filter((a) => a !== r.achse).slice(0, 3)], a: 0,
      x: `${r.bew} → ${r.achse} (${r.ebene}). Flexion/Extension = transversal, Abd/Add = sagittal, Rotation = longitudinal.` });
  }
  // ADL-Werte (gleiche Kategorie als Ablenker: die anderen Alltagsaktivitäten)
  const adl = j.adl || [];
  for (const [n, a] of adl.entries()) {
    const others = [...new Set(adl.filter((x) => x.flex !== a.flex).map((x) => x.flex))];
    const pad = near(a.flex, [10, -10, 20, 25]).filter((x) => !others.includes(x));
    const opts = [...others, ...pad].slice(0, 3);
    if (opts.length < 3) continue;
    qs.push({ ...base, id: id('adl' + n), q: `Wie viel Hüftflexion braucht man für „${a.akt}“ (${j.adlQuelle || 'ADL'})?`, o: [`${a.flex}°`, ...opts.map((x) => `${x}°`)], a: 0,
      x: `${a.akt}: ${a.w}. ${t('qg.adl', { list: adl.filter((x) => x !== a).map((x) => `${x.akt} ${x.flex}°`).join(', ') })}` });
  }
  // Muskelgruppen nach Bewegungsrichtung
  const G = j.muskelGruppen || {};
  const groups = Object.keys(G);
  const all = (g) => [...G[g].haupt, ...G[g].weitere];
  const allMuscles = [...new Set(groups.flatMap(all))];
  // Sichere Ablenker: zuerst aus der Gegenspieler-Gruppe, nie ein Muskel mit demselben Stammnamen wie ein Gruppenmitglied
  const ANTAG = { Flexion: 'Extension', Extension: 'Flexion', Abduktion: 'Adduktion', Adduktion: 'Abduktion', Außenrotation: 'Innenrotation', Innenrotation: 'Außenrotation' };
  const stem = (m) => (m.replace(/^Mm?\.\s*/, '').replace(/^glutaei/i, 'gluteus').split(/\s+/)[0] || '').toLowerCase().slice(0, 5);
  // Muskeln mit umstrittener/zusätzlicher Wirkung in dieser Richtung – nie als „falsche“ Antwort verwenden
  const AMBIG = {
    Flexion: ['M. pectineus', 'M. adductor longus', 'M. adductor brevis', 'M. gracilis'],
    Extension: ['M. adductor magnus'],
    Abduktion: ['M. gluteus maximus', 'M. sartorius', 'M. piriformis'],
    Adduktion: ['M. gluteus maximus', 'Mm. ischiocrurales', 'M. iliopsoas', 'M. quadratus femoris'],
    Außenrotation: ['M. adductor longus', 'M. adductor magnus', 'M. pectineus', 'M. sartorius', 'M. iliopsoas'],
    Innenrotation: ['M. pectineus', 'M. piriformis'],
  };
  // Reihenfolge: Hauptmuskeln des Gegenspielers, dann seine weiteren, dann Hauptmuskeln anderer Gruppen
  const safeOutside = (g, onlyAntagonist = false) => {
    const members = all(g);
    const stems = new Set(members.map(stem));
    const ag = ANTAG[g] && G[ANTAG[g]];
    const antag = ag ? (ag.haupt.length ? ag.haupt : ag.weitere) : [];
    const rest = onlyAntagonist ? [] : [...(ag ? ag.weitere : []), ...groups.filter((x) => x !== g && x !== ANTAG[g]).flatMap((x) => G[x].haupt)];
    return [...new Set([...antag, ...rest])].filter((m) => !members.includes(m) && !stems.has(stem(m)) && !(AMBIG[g] || []).includes(m) && m !== 'Mm. adductores');
  };
  for (const g of groups) {
    const members = all(g);
    const outside = safeOutside(g);
    const antagOnly = safeOutside(g, true);
    // Hauptmuskel – Ablenker: die weiteren Muskeln derselben Gruppe (typische Verwechslung)
    if (G[g].haupt.length === 1 && G[g].weitere.length >= 3) {
      qs.push({ ...base, id: id('haupt-' + g), q: `Welcher Muskel ist der Hauptmuskel der ${g} im ${name}?`, o: [G[g].haupt[0], ...pick(G[g].weitere, 3)], a: 0,
        x: t('qg.hauptOne', { src: j.gruppenQuelle || 'Folie', g, m: G[g].haupt[0], others: joinG(G[g].weitere), gtr: groupTr(g) }) });
    } else if (G[g].haupt.length) {
      const h = pick(G[g].haupt, 1)[0];
      const opts = outside.slice(0, 3);
      if (opts.length === 3) qs.push({ ...base, id: id('haupt-' + g + '-' + G[g].haupt.indexOf(h)), q: `Welcher Muskel gehört zu den Hauptmuskeln der ${g} im ${name}?`, o: [h, ...opts], a: 0,
        x: t('qg.hauptMany', { g, list: joinG(G[g].haupt), opts: joinG(opts), rest: ANTAG[g] ? t('qg.antag', { a: ANTAG[g] }) : t('qg.notMain') }) });
    }
    // „Welcher gehört NICHT dazu?“ – richtige Antwort aus der Gegenspieler-Gruppe
    if (members.length >= 3 && antagOnly.length) {
      const wrong = pick(antagOnly, 1)[0];
      qs.push({ ...base, id: id('nicht-' + g), q: `Welcher Muskel gehört NICHT zur Gruppe „${g}“ im ${name}?`, o: [wrong, ...pick(members, 3)], a: 0,
        x: t('qg.notInGroup', { w: wrong, extra: ANTAG[g] ? t('qg.rather', { a: ANTAG[g] }) : '', g, list: joinG(members) }) });
    }
  }
  // Allrounder: Muskel in ≥ 3 Gruppen → „Welche Bewegung macht er NICHT?“
  for (const m of allMuscles) {
    const does = groups.filter((g) => all(g).includes(m));
    const not = groups.filter((g) => !does.includes(g));
    if (does.length >= 3 && not.length) {
      qs.push({ ...base, id: id('nicht-bew-' + m.replace(/\W+/g, '')), q: `Welche Bewegung macht der ${m} im ${name} NICHT?`, o: [pick(not, 1)[0], ...pick(does, 3)], a: 0,
        x: t('qg.notMove', { m, does: does.join(' + ') }) });
    }
  }
  // Kapselmuster
  if (j.kapsel) {
    qs.push({ ...base, id: id('kapsel'), q: `Wie lautet das Kapselmuster des ${name}s?`, o: [j.kapsel, 'IR > Extension > Abduktion', 'AR > Abduktion > IR', 'Flexion > Abduktion > IR'], a: 0,
      x: `${j.kapsel}${j.kapselNote ? ' – ' + tx(j, 'kapselNote') : ''}. ${t('qg.kapsel')}` });
  }
  return qs;
}
export const ALL_JOINT_DETAIL = () => JOINTS.flatMap(jointDetailQuestions);

// Fragen aus den Notion-Ders-Notları
export const lessonMcq = (l) => l.mcq.map((q, i) => ({ id: q.id || `L:${l.id}:${i}`, cat: l.fach, lesson: l.id, q: q.q, o: q.o, a: 0, x: q.x, xEn: q.xEn }));
export const ALL_LESSON_MCQ = () => LESSONS.flatMap(lessonMcq);
export { FAECHER };

// Funktion, weil neue Fächer aus Notion dazukommen können
export const quizCategories = () => ['Gemischt', ...FAECHER.map((f) => 'Ders: ' + f), 'Muskeln', 'Knochen', 'Gelenke', 'Anatomie', 'Neuro', 'Klinik', 'Vokabeln'];

// ───── Adaptive Auswahl ─────
// Schwierigkeitsstufen: Muskeln zuerst nur Nerv/Ansatz, dann Ursprung/Funktion,
// ab >80 % Trefferquote auch die umgekehrten Fragen und die ROM-Werte der Gelenke
const MUSCLE_LEVEL = { inn: 1, ans: 1, urs: 2, fkt: 2, rev: 3 };
const GEN_TOPIC = { inn: 'Muskeln', ans: 'Muskeln', urs: 'Muskeln', fkt: 'Muskeln', rev: 'Muskeln', bla: 'Knochen', btr: 'Knochen', jtyp: 'Gelenke', jnn: 'Gelenke', jx: 'Gelenke', ub: 'Muskeln', ubb: 'Muskeln', vde: 'Vokabeln', vtr: 'Vokabeln' };
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
  if (qid.startsWith('lm:')) return 'Knochenpunkte'; // 3D-Quiz „Noktayı bul“
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

// Fächer der Morgentests dieser Woche (aus dem privaten Wochenplan) + Fächer mit Prüfung in ≤ 7 Tagen
export function weekTestFaecher() {
  const w = week();
  const tests = !w || !w.days || store.today() > w.to ? [] : Object.values(w.days).flatMap((d) => (d && d.test) || []);
  return new Set([...tests, ...examFaecher(7)]);
}

// weight() läuft für tausende Fragen – Prüfungsfächer nur einmal pro Minute neu bestimmen
let examMemo = { t: 0, set: new Set() };
const soonExam = () => {
  if (Date.now() - examMemo.t > 6e4) examMemo = { t: Date.now(), set: new Set(examFaecher(7)) };
  return examMemo.set;
};

const daysSince = (iso) => (Date.now() - new Date(iso + 'T12:00:00')) / 864e5;

// Gewicht einer Frage: falsch beantwortete und lange nicht gesehene öfter,
// 3+ mal in Folge richtige seltener – aber nie 0
// Wichtigkeit der Fächer für diesen Ausbildungsabschnitt
const FACH_WEIGHT = { Anatomie: 1.6, Physiologie: 1.6, 'PT Befund': 1.2, 'PT Grundlagen': 1.1, PPS: 0.6, Hygiene: 0.6 };
const fachOf = (qid) => lessonFach(qid) || (/^g:(inn|ans|urs|fkt|rev|bla|btr|jtyp|jnn|jx)/.test(qid) ? 'Anatomie' : null);
const fachWeight = (qid) => FACH_WEIGHT[fachOf(qid)] || 1;

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
  const f = fachOf(qid);
  if (soonExam().has(f)) w *= 6;                // Prüfung in ≤ 7 Tagen → deutlich öfter
  else if (prio.size && prio.has(f)) w *= 2.5;  // Fach eines Morgentests dieser Woche
  // Gestern richtig beantwortet → heute kaum wieder (falsche kommen weiter über die Wiederholung)
  if (s && s.last === store.today(-1) && (s.st || 0) >= 1) w *= 0.1;
  if (s && s.last === store.today() && (s.st || 0) >= 1) w *= 0.05;
  w *= fachWeight(qid);
  return Math.max(w, 0.02);
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

// Alle Fragen mit fester ID (für Wiederholung falsch beantworteter Fragen)
export function questionsByIds(ids) {
  const want = new Set(ids);
  const all = [
    ...ALL_LESSON_MCQ(), ...MCQ, ...MUSCLES.flatMap(muscleQuestions), ...BONES.flatMap(boneQuestions),
    ...JOINTS.flatMap(jointQuestions), ...ALL_JOINT_DETAIL(), ...exerciseQuestions(),
  ];
  const seen = new Set();
  return all.filter((q) => want.has(q.id) && !seen.has(q.id) && seen.add(q.id));
}

export function buildQuiz(category = 'Gemischt', n = 10, extraVocab = []) {
  if (category.startsWith('Hatalar: ')) {
    // Heute (Rückweg) bzw. diese Woche (Samstag) falsch beantwortete Fragen
    const ids = category === 'Hatalar: hafta' ? store.wrongSince(7) : (store.day().wrong || []);
    return shuffle(questionsByIds(ids)).slice(0, n).map(prepare);
  }
  if (category.startsWith('Dönüş: ')) category = 'Ders: ' + category.slice(7);
  const vocabPool = [...VOCAB, ...extraVocab];
  const prio = weekTestFaecher();
  const wq = (q) => weight(q.id, prio);
  const wpickQ = (arr, k) => wpick(arr, k, wq);
  // Vokabeln: Gewicht aus beiden Richtungen zusammen
  const wv = (v) => Math.max(weight(`g:vde:${v.id}`), weight(`g:vtr:${v.id}`));
  const pools = {
    Muskeln: () => [...MUSCLES.flatMap(muscleQuestions).filter(levelFilter), ...exerciseQuestions()],
    Knochen: () => BONES.flatMap(boneQuestions),
    Gelenke: () => [...JOINTS.flatMap(jointQuestions).filter(levelFilter), ...ALL_JOINT_DETAIL(), ...MCQ.filter((q) => q.cat === 'Gelenke')],
    Anatomie: () => MCQ.filter((q) => q.cat === 'Anatomie'),
    Neuro: () => MCQ.filter((q) => q.cat === 'Neuro'),
    Klinik: () => MCQ.filter((q) => q.cat === 'Klinik'),
    Vokabeln: () => wpick(vocabPool, n * 2, wv).map((v) => vocabQuestion(v, vocabPool)).filter(Boolean),
  };
  let qs;
  if (category.startsWith('Ders: ') || category.startsWith('Lektion: ')) {
    // Ein Fach („Ders: Hygiene“) oder eine einzelne Lektion („Lektion: hygiene-1“)
    const keys = category.split(': ')[1].split(',');
    qs = [
      ...ALL_LESSON_MCQ().filter((q) => keys.includes(q.cat) || keys.includes(q.lesson)),
      // z. B. Hüft-ROM/Muskelgruppen gehören zum Morgentest „PT Befund“
      ...ALL_JOINT_DETAIL().filter((q) => keys.includes(q.fach)),
      // An Anatomie-Tagen auch die generierten Muskel-, Knochen- und Gelenkfragen (Ablenker aus derselben Region)
      ...(keys.includes('Anatomie') ? [...pools.Muskeln(), ...pools.Knochen(), ...JOINTS.flatMap(jointQuestions).filter(levelFilter)] : []),
    ];
  } else if (category === 'Gemischt') {
    // Ausgewogene Mischung: Unterrichtsfragen aus Notion + handgeschriebene + generierte
    const lessonQs = ALL_LESSON_MCQ();
    qs = [
      ...wpickQ(lessonQs, lessonQs.length ? Math.ceil(n * 0.4) : 0),
      ...wpickQ(MCQ, Math.ceil(n * (lessonQs.length ? 0.2 : 0.4))),
      ...wpickQ(pools.Muskeln(), Math.ceil(n * 0.3)),
      ...wpickQ([...pools.Knochen(), ...JOINTS.flatMap(jointQuestions).filter(levelFilter), ...ALL_JOINT_DETAIL()], Math.ceil(n * 0.15)),
      ...wpickQ(pools.Vokabeln(), Math.ceil(n * 0.15)),
    ];
  } else {
    qs = Object.hasOwn(pools, category) ? pools[category]() : []; // unbekannte Kategorie aus einem Link
  }
  return shuffle(wpickQ(qs, n)).map(prepare);
}

// Fragenpool für den Deneme sınavı eines Fachs – ungewichtet, alle Schwierigkeitsstufen
export function examPool(fach) {
  return [
    ...ALL_LESSON_MCQ().filter((q) => q.cat === fach),
    ...ALL_JOINT_DETAIL().filter((q) => q.fach === fach),
    ...(fach === 'Anatomie' ? [
      ...MUSCLES.flatMap(muscleQuestions), ...BONES.flatMap(boneQuestions), ...JOINTS.flatMap(jointQuestions),
      ...MCQ.filter((q) => q.cat === 'Anatomie' || q.cat === 'Gelenke'),
    ] : []),
  ];
}

// Lektionen, deren Fragen „sitzen“ (jede beantwortete Frage ≥ 2× in Folge richtig, mind. 3 beantwortet)
export function masteredLessons() {
  const st = store.get().quiz;
  return LESSONS.filter((l) => {
    const qs = lessonMcq(l).map((q) => st[q.id]).filter(Boolean);
    return qs.length >= 3 && qs.every((s) => (s.st || 0) >= 2) && (l.open || []).length;
  });
}

// Antwortoptionen mischen und richtigen Index merken
export function prepare(q) {
  const order = shuffle(q.o.map((text, i) => ({ text, ok: i === q.a })));
  return { ...q, opts: order.map((o) => o.text), ans: order.findIndex((o) => o.ok) };
}
