// Inhaltsprüfung aller Fragen, Karten und Wörter (ohne Browser).
// Aufruf: node tools/audit_content.mjs [pfad/zu/fizyolern-ozel.json]
// Mit Datei werden Notion-Wörter, Fehlerkarten und „FizyoLern Sorular“-Zeilen mitgeprüft (bleibt lokal).
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const privFile = process.argv[2];
if (privFile) mem['fizyo.private'] = fs.readFileSync(privFile, 'utf8');

const imp = (p) => import(pathToFileURL(path.join(root, p)));
const { MUSCLES, BONES, JOINTS } = await imp('js/data/anatomy.js');
const { MCQ, OPEN } = await imp('js/data/questions.js');
const { MUSCLE3D } = await imp('js/data/muscle3d.js');
const { UEBUNGEN } = await imp('js/data/uebungen.js');
const { LANDMARKS } = await imp('js/data/landmarks.js');
const { LESSONS } = await imp('js/lessons.js');
const Q = await imp('js/quizgen.js');
const { allWords, checkTyped, questionFor, variants } = await imp('js/words.js');
const { containsFuzzy } = await imp('js/fuzzy.js');
const { fehlerList, odevList, cleanText } = await imp('js/private.js');

const issues = [];
const add = (kind, where, msg) => issues.push({ kind, where, msg });
const k = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

// ── Multiple Choice ──
function checkMcq(q, src) {
  const where = `${src} ${q.id}`;
  if (!q.q || !q.q.trim()) add('mcq', where, 'Fragetext leer');
  if (!Array.isArray(q.o) || q.o.length !== 4) { add('mcq', where, `${q.o ? q.o.length : 0} Optionen statt 4`); return; }
  if (q.o.some((o) => !String(o ?? '').trim() || /undefined|null/.test(String(o)))) add('mcq', where, 'leere/undefined Option: ' + JSON.stringify(q.o));
  if (new Set(q.o.map(k)).size !== 4) add('mcq', where, 'doppelte Option: ' + JSON.stringify(q.o));
  const a = q.a ?? 0, right = String(q.o[a]);
  const others = q.o.filter((_, i) => i !== a).map(String);
  // Antwort fast wörtlich in der Frage
  if (right.length > 6 && k(q.q).includes(k(right))) add('mcq-giveaway', where, `Antwort steht in der Frage: „${right}“`);
  // richtige Antwort deutlich länger als alle Ablenker (leicht zu erraten)
  const maxO = Math.max(...others.map((o) => o.length));
  if (right.length > 40 && right.length > 1.8 * maxO) add('mcq-length', where, `richtige Antwort ${right.length} Zeichen, Ablenker max ${maxO}: ${q.q}`);
  // Ablenker, der die richtige Antwort enthält (oder umgekehrt) → mehrdeutig
  for (const o of others) if (o.length > 5 && (k(right).includes(k(o)) || k(o).includes(k(right)))) add('mcq-ambig', where, `„${o}“ ⊂⊃ „${right}“`);
  if (q.x !== undefined && !String(q.x).trim()) add('mcq-noexpl', where, 'keine Erklärung');
}

const ids = new Map();
const pools = {
  lesson: Q.ALL_LESSON_MCQ(), mcq: MCQ, muscle: MUSCLES.flatMap(Q.muscleQuestions), bone: BONES.flatMap(Q.boneQuestions),
  joint: JOINTS.flatMap(Q.jointQuestions), jointDetail: Q.ALL_JOINT_DETAIL(), exercise: Q.exerciseQuestions(),
};
for (const [src, list] of Object.entries(pools)) {
  for (const q of list) {
    if (!q) { add('gen', src, 'Generator lieferte null (zu wenige Ablenker)'); continue; }
    checkMcq(q, src);
    if (ids.has(q.id) && k(ids.get(q.id)) !== k(q.q)) add('id', q.id, `gleiche ID, anderer Text: „${ids.get(q.id)}“ / „${q.q}“`);
    ids.set(q.id, q.q);
  }
}
// gleiche Frage in mehreren Lektionen
const byText = {};
for (const q of pools.lesson) (byText[k(q.q)] = byText[k(q.q)] || []).push(q.id);
for (const [t, l] of Object.entries(byText)) if (l.length > 1) add('dup', l.join(', '), 'gleiche Frage mehrfach: ' + t.slice(0, 80));

// Quiz-Kategorien: liefert jede etwas?
for (const c of Q.quizCategories()) {
  try {
    const qs = Q.buildQuiz(c, 10);
    if (!qs.length) add('quiz', c, 'keine Fragen');
    for (const q of qs) if (q.opts[q.ans] !== q.o[q.a ?? 0]) add('quiz', c, 'prepare: richtige Antwort verrutscht ' + q.id);
  } catch (e) { add('quiz', c, 'Fehler: ' + e.message); }
}

// ── Offene Fragen: Musterlösung muss die eigenen Schlüsselbegriffe enthalten ──
const opens = [...LESSONS.flatMap((l) => l.open.map((q, i) => ({ ...q, id: q.id || `LO:${l.id}:${i}` }))), ...OPEN];
for (const q of opens) {
  if (!q.kw || !q.kw.length) { add('open', q.id, 'keine Schlüsselbegriffe'); continue; }
  if (!q.a) { add('open', q.id, 'keine Musterlösung'); continue; }
  const miss = q.kw.filter((kw) => !kw.split('|').some((alt) => containsFuzzy(q.a, alt)));
  if (miss.length) add('open-kw', q.id, `Musterlösung erfüllt eigene Begriffe nicht: ${miss.join(', ')} · Frage: ${q.q.slice(0, 70)}`);
}

// ── Lektionen ──
for (const l of LESSONS) {
  if (!l.kern.length && !l.mcq.length) add('lesson', l.id, 'Lektion ohne Inhalt');
  for (const c of l.kern) if (!c.de || !c.tr) add('lesson', l.id, 'Kernsatz ohne DE/TR: ' + JSON.stringify(c).slice(0, 80));
  for (const v of l.vocab) if (!v.de || !v.tr) add('lesson', l.id, 'Vokabel ohne DE/TR: ' + JSON.stringify(v));
}

// ── Wörter: eigene Lösung muss als richtig gelten, Fragetypen müssen funktionieren ──
const words = allWords();
const seenW = {};
for (const w of words) {
  if (!w.tr) add('word', w.id, 'keine Übersetzung');
  if (seenW[k(w.de)]) add('word', w.id, 'doppelt'); seenW[k(w.de)] = 1;
  const full = checkTyped(w, w.de);
  if (!full.ok) add('word-check', w.id, `eigene Lösung „${w.de}“ gilt als falsch`);
  for (const v of variants(w.de)) {
    const clean = v.replace(/\s*\([^)]*\)/g, '').trim();
    const r = checkTyped(w, clean);
    if (!r.ok) add('word-check', w.id, `Variante „${clean}“ gilt als falsch (${r.hint || '-'})`);
  }
  for (const pass of ['sabah', 'donus', 'hafta']) {
    try {
      const q = questionFor(w, pass);
      if (q.opts && (new Set(q.opts).size !== q.opts.length || !q.opts.includes(q.answer) || q.opts.length < 4)) add('word-q', w.id, `${q.type}: Optionen ${JSON.stringify(q.opts)} Antwort ${q.answer}`);
      if (q.type === 'cloze' && !q.big.includes('＿')) add('word-q', w.id, 'Lückentext ohne Lücke');
    } catch (e) { add('word-q', w.id, 'Fehler: ' + e.message); }
  }
}

// ── Anatomie-Daten ──
for (const m of MUSCLES) {
  for (const f of ['o', 'i', 'inn', 'f', 'ftr', 'la', 'de', 'tr', 'region']) if (!m[f]) add('anat', m.id, `Feld ${f} fehlt`);
  if (!MUSCLE3D[m.id]) add('anat', m.id, 'kein MUSCLE3D-Eintrag');
}
for (const id of Object.keys(UEBUNGEN)) if (!MUSCLES.some((m) => m.id === id)) add('anat', id, 'UEBUNGEN-Muskel unbekannt');
for (const l of LANDMARKS) for (const id of [...(l.o || []), ...(l.i || []), ...(l.via || [])]) if (!MUSCLES.some((m) => m.id === id)) add('anat', l.id, 'Landmark-Muskel unbekannt: ' + id);

// ── Notion: Fehler- und Ödevkarten ──
for (const f of [...fehlerList(), ...odevList()]) {
  const back = (f.seg || []).map((s) => s.t).join('');
  if (!f.q || !cleanText(f.q)) add('fehler', f.id, 'Karte ohne Vorderseite');
  if (f.seg && !f.seg.some((s) => s.b)) add('fehler', f.id, `keine fett gedruckte Antwort → Karte „${cleanText(f.q).slice(0, 60)}“`);
  if (/＿/.test(f.q) && f.seg && f.seg.filter((s) => s.b && s.t.trim().length > 1).length > 4) add('fehler', f.id, 'sehr viele Lücken: ' + cleanText(f.q).slice(0, 80));
  if (!f.fach) add('fehler', f.id, 'kein Fach: ' + back.slice(0, 60));
}

const by = {};
for (const i of issues) (by[i.kind] = by[i.kind] || []).push(i);
for (const [kind, list] of Object.entries(by)) {
  console.log(`\n## ${kind} (${list.length})`);
  list.slice(0, 40).forEach((i) => console.log(`- [${i.where}] ${i.msg}`));
  if (list.length > 40) console.log(`  … ${list.length - 40} weitere`);
}
console.log(`\n${issues.length} Auffälligkeiten · ${Object.values(pools).flat().length} MC-Fragen · ${opens.length} offene · ${words.length} Wörter · ${LESSONS.length} Lektionen · ${fehlerList().length} Fehler- + ${odevList().length} Ödevkarten`);
