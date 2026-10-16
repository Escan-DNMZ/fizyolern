// „Günün kelimeleri“: 5 Grundwortschatz-Wörter pro Tag – morgens und auf dem Rückweg mit anderem Fragetyp.
// Eigene Leitner-Wiederholung (store.get().words), ergänzt um Stufe/„Nächste Wiederholung“ aus Notion.
import * as store from './store.js';
import { GRUNDWORTSCHATZ } from './data/vocab.js';
import { getPrivate, todayPlan } from './private.js';
import { shuffle } from './quizgen.js';

export const WORDS_PER_DAY = 5;
const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60]; // Leitner-Fächer → Tage bis zur nächsten Wiederholung

// Partizip II der trennbaren Verben aus dem Grundwortschatz (unregelmäßige Formen von Hand)
const PARTIZIP = {
  'ab|spreizen': 'abgespreizt', 'an|spannen': 'angespannt', 'heran|führen': 'herangeführt', 'an|stecken': 'angesteckt',
  'an|schwellen': 'angeschwollen', 'auf|treten': 'aufgetreten', 'ab|tasten': 'abgetastet', 'vor|beugen': 'vorgebeugt',
  'ein|reißen': 'eingerissen', 'aus|dünnen': 'ausgedünnt', 'ab|bauen': 'abgebaut', 'auf|bauen': 'aufgebaut', 'um|bauen': 'umgebaut',
  'ab|lagern': 'abgelagert', 'ab|nehmen': 'abgenommen', 'ab|nutzen': 'abgenutzt', 'ein|schränken': 'eingeschränkt',
  'zurück|bilden': 'zurückgebildet', 'zu|nehmen': 'zugenommen',
};

// Kategorie(n) des Grundwortschatzes, die zu einem Fach passen
const FACH_CAT = {
  Hygiene: ['Hygiene'], Anatomie: ['Körper'], Physiologie: ['Körper'], 'PT Befund': ['Untersuchung', 'Symptome'],
  'O/C': ['Veränderung', 'Verletzungen'], Trainingslehre: ['Bewegung'], 'PT Grundlagen': ['Bewegung', 'Untersuchung'],
  KMT: ['Symptome', 'Körper'], Atemtherapie: ['Symptome', 'Körper'],
};

export const allWords = () => {
  const p = getPrivate();
  return p && p.gw && p.gw.length ? p.gw : GRUNDWORTSCHATZ;
};

const state = () => {
  const s = store.get();
  if (!s.words) s.words = {};
  return s.words;
};

// Varianten eines Eintrags: „die Schwellung / an|schwellen“ → ['die Schwellung', 'an|schwellen']
export const variants = (de) => de.split(/\s*\/\s*/).map((v) => v.trim()).filter(Boolean);
const verbOf = (de) => variants(de).map((v) => v.replace(/^sich\s+/, '')).find((v) => v.includes('|'));

function todayCats() {
  const plan = todayPlan();
  const faecher = plan ? [...(plan.test || []), ...((plan.kurse || []).join(' ').match(/Hygiene|Anatomie|ANA|Physiologie|Befund|O\/C|Trainingslehre|Grundlagen|KMT|Atemtherapie/g) || [])] : [];
  const norm = (f) => ({ ANA: 'Anatomie', Befund: 'PT Befund', Grundlagen: 'PT Grundlagen' }[f] || f);
  return new Set(faecher.map(norm).flatMap((f) => FACH_CAT[f] || []).map((c) => 'GW · ' + c));
}

// Priorität: in der App fällig → laut Notion fällig → „Lerne“ → „Neu“ → Rest; passende Kategorie zuerst
function candidates(exclude = new Set()) {
  const st = state();
  const today = store.today();
  const cats = todayCats();
  const tier = (w) => {
    const s = st[w.id];
    if (s && s.box > 0) return s.due <= today ? 0 : 9; // bereits gelernt: nur wenn fällig
    if (w.next && w.next <= today) return 1;
    if (w.stufe === 'Lerne') return 2;
    if (!w.stufe || w.stufe === 'Neu') return 3;
    return 4; // „Kann ich“ / „Sicher“
  };
  return shuffle(allWords())
    .filter((w) => !exclude.has(w.id))
    .map((w) => ({ w, t: tier(w), c: cats.has(w.cat) ? 0 : 1 }))
    .filter((x) => x.t < 9)
    .sort((a, b) => a.t - b.t || a.c - b.c)
    .map((x) => x.w);
}

// Die 5 Wörter des Tages (einmal pro Tag festgelegt)
export function todaysWords() {
  const d = store.day();
  const words = allWords();
  if (!d.words || !d.words.length) {
    d.words = candidates().slice(0, WORDS_PER_DAY).map((w) => w.id);
    store.save();
  }
  return d.words.map((id) => words.find((w) => w.id === id)).filter(Boolean);
}

// „Biliyorum“: Wort wandert in ein spätes Fach (kommt selten wieder) und wird heute ersetzt
export function markKnown(id) {
  const st = state();
  const s = st[id] || { box: 0 };
  s.box = Math.max(s.box, 4);
  s.due = store.today(BOX_DAYS[s.box]);
  s.known = (s.known || 0) + 1;
  st[id] = s;
  const d = store.day();
  const next = candidates(new Set(d.words)).find(Boolean);
  d.words = d.words.map((w) => (w === id && next ? next.id : w));
  store.save();
  return next || null;
}

export function recordWord(id, ok) {
  const st = state();
  const s = st[id] || { box: 0, r: 0, w: 0 };
  s.box = ok ? Math.min(s.box + 1, BOX_DAYS.length - 1) : 1;
  s.due = store.today(BOX_DAYS[s.box]);
  if (ok) s.r = (s.r || 0) + 1; else s.w = (s.w || 0) + 1;
  s.last = store.today();
  st[id] = s;
  store.save();
}

// ───── Fragetypen ─────
const stripArt = (v) => v.replace(/^(der|die|das)\s+/i, '');
const normAns = (s) => s.toLowerCase().replace(/[|.,!?„“"()]/g, '').replace(/\s+/g, ' ').trim();

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

// Getippte Antwort prüfen: Artikel muss bei Nomen stimmen, ein Tippfehler wird toleriert
export function checkTyped(word, input) {
  const ans = normAns(input);
  if (!ans) return { ok: false, close: false };
  for (const v of variants(word.de)) {
    const target = normAns(v);
    if (ans === target) return { ok: true, exact: true };
    const hasArt = /^(der|die|das)\s/i.test(v);
    if (hasArt && normAns(stripArt(v)) === ans) return { ok: false, close: true, hint: 'Artikel fehlt' };
    if (levenshtein(ans, target) <= 1 && target.length > 4) return { ok: true, exact: false };
  }
  return { ok: false, close: false };
}

function lueckentext(word) {
  if (!word.ex) return null;
  for (const v of variants(word.de)) {
    const core = stripArt(v).replace(/^sich\s+/, '');
    const parts = core.split('|');
    const stem = (parts[parts.length - 1] || core).slice(0, Math.max(4, Math.min(6, core.length - 2))).toLowerCase();
    const tokens = word.ex.split(/(\s+)/);
    const idx = tokens.findIndex((t) => t.trim() && t.toLowerCase().replace(/[^a-zäöüß]/g, '').includes(stem));
    if (idx >= 0) {
      const gap = tokens[idx].replace(/[.,!?]$/, '');
      return { text: tokens.map((t, i) => (i === idx ? t.replace(gap, '＿＿＿') : t)).join(''), gap };
    }
  }
  return null;
}

// Typ je Durchgang: morgens und auf dem Rückweg unterschiedlich
export function questionFor(word, pass) {
  const verb = verbOf(word.de);
  const types = ['de2tr', 'tr2de', 'cloze'];
  if (verb && PARTIZIP[verb.replace(/^sich\s+/, '')]) types.push('partizip');
  const seed = [...word.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) + (store.today().split('-')[2] | 0);
  let type = types[(seed + (pass === 'donus' ? 1 : 0)) % types.length];
  const others = shuffle(allWords().filter((w) => w.id !== word.id));
  const sameCat = others.filter((w) => w.cat === word.cat);
  const pool = [...sameCat, ...others];
  const opts3 = (f) => [...new Set(pool.map(f).filter((x) => x && x !== f(word)))].slice(0, 3);

  if (type === 'cloze') {
    const c = lueckentext(word);
    if (!c) type = 'de2tr';
    else {
      const wrong = [...new Set(pool.map((w) => lueckentext(w)).filter(Boolean).map((x) => x.gap).filter((g) => g.toLowerCase() !== c.gap.toLowerCase()))].slice(0, 3);
      if (wrong.length < 3) type = 'de2tr';
      else return { type, prompt: 'Boşluğa hangi kelime gelir?', big: c.text, opts: shuffle([c.gap, ...wrong]), answer: c.gap };
    }
  }
  if (type === 'partizip') {
    const v = verb.replace(/^sich\s+/, '');
    const [pre, base] = v.split('|');
    const right = PARTIZIP[v];
    const stemB = base.replace(/en$|n$/, '');
    const wrong = [...new Set([`ge${pre}${stemB}t`, `${pre}${stemB}t`, `${pre}ge${stemB}t`, `${pre}ge${base}`].filter((x) => x !== right))].slice(0, 3);
    return { type, prompt: 'Partizip II (Perfekt) nedir?', big: v, sub: `„Das Knie ist … “ · 🇹🇷 ${word.tr}`, opts: shuffle([right, ...wrong]), answer: right };
  }
  if (type === 'tr2de') {
    return { type, prompt: 'Almancasını yaz (isimse artikeliyle):', big: word.tr, typed: true, answer: word.de };
  }
  return { type: 'de2tr', prompt: 'Türkçesi nedir?', big: word.de, opts: shuffle([word.tr, ...opts3((w) => w.tr)]), answer: word.tr };
}

export const TYPE_LABEL = { de2tr: 'DE → TR', tr2de: 'TR → DE (yaz)', cloze: 'Lückentext', partizip: 'Partizip II' };
