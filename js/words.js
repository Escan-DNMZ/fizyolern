// „Günün kelimeleri“: 5 Grundwortschatz-Wörter pro Tag – morgens und auf dem Rückweg mit anderem Fragetyp.
// Eigene Leitner-Wiederholung (store.get().words), ergänzt um Stufe/„Nächste Wiederholung“ aus Notion.
import * as store from './store.js';
import { GRUNDWORTSCHATZ } from './data/vocab.js';
import { getPrivate, todayPlan } from './private.js';
import { shuffle } from './quizgen.js';
import { fold, close, abbreviations } from './fuzzy.js';

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

// Alle Wörter der letzten 7 Tage (für die Samstagswiederholung)
export function weekWords() {
  const ids = new Set();
  for (let k = 0; k < 7; k++) ((store.get().days[store.today(-k)] || {}).words || []).forEach((id) => ids.add(id));
  const words = allWords();
  return [...ids].map((id) => words.find((w) => w.id === id)).filter(Boolean);
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

export function recordWord(id, ok, near = false) {
  const st = state();
  const s = st[id] || { box: 0, r: 0, w: 0 };
  if (near) {
    // fast richtig (z. B. Artikel falsch): Fach bleibt, morgen wiederholen
    s.due = store.today(1);
    s.c = (s.c || 0) + 1;
  } else {
    s.box = ok ? Math.min(s.box + 1, BOX_DAYS.length - 1) : 1;
    s.due = store.today(BOX_DAYS[s.box]);
  }
  if (ok) s.r = (s.r || 0) + 1; else if (!near) s.w = (s.w || 0) + 1;
  s.last = store.today();
  st[id] = s;
  store.save();
}

// ───── Fragetypen ─────
const stripArt = (v) => v.replace(/^(der|die|das)\s+/i, '');


// Ein einzelner Teil der Antwort gegen alle Varianten des Eintrags.
// Ergebnis: { ok, exact, close, hint, abbr, art, target }
const ART = /^(der|die|das)\s+/;
function matchPart(word, part) {
  const ans = fold(part).replace(/^sich\s+/, '');
  if (!ans) return null;
  let best = { ok: false, close: false };
  // 1. Durchgang: Wort genau getroffen (bei allen Varianten), erst 2. Durchgang mit Tippfehler-Toleranz –
  //    sonst würde „Kräftigung“ (Artikel fehlt) als Tippfehler von „kräftigen“ durchgehen
  for (const fuzzy of [false, true]) {
    for (const v of variants(word.de)) {
      const target = fold(v).replace(/^sich\s+/, '');
      const shown = v.replace(/\s*\([^)]*\)/g, '').trim();
      if (ans === target) return { ok: true, exact: true, target: shown };
      const tArt = (target.match(ART) || [])[1], aArt = (ans.match(ART) || [])[1];
      const tNoun = target.replace(ART, ''), aNoun = ans.replace(ART, '');
      if (!(fuzzy ? close(aNoun, tNoun) : tNoun === aNoun)) continue;
      if (tArt && !aArt) best = { ok: false, close: true, hint: 'Artikel fehlt', art: tArt, target: shown };
      else if (tArt && aArt && tArt !== aArt) best = { ok: false, close: true, hint: 'Artikel falsch', art: tArt, target: shown };
      else return { ok: true, exact: !fuzzy, target: shown };
    }
    if (best.close) return best;
  }
  // Abkürzung aus der Klammer („WS“) ist auch richtig
  if (!best.close && abbreviations(word.de).some((a) => fold(a) === ans)) {
    return { ok: true, exact: true, abbr: true, target: variants(word.de)[0].replace(/\s*\([^)]*\)/g, '').trim() };
  }
  return best;
}

// Getippte Antwort prüfen: eine Variante („kräftigen“) oder mehrere zusammen („kräftigen / die Kräftigung“)
// sind richtig; Artikel muss bei Nomen stimmen (falsch/fehlend = „close“), Tippfehler nach Wortlänge toleriert
export function checkTyped(word, input) {
  const parts = input.split(/\s*(?:\/|,|;|\bund\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { ok: false, close: false };
  const results = parts.map((p) => matchPart(word, p)).filter(Boolean);
  if (results.every((r) => r.ok)) {
    return { ok: true, exact: results.every((r) => r.exact), abbr: results.some((r) => r.abbr), target: results.map((r) => r.target).join(' / ') };
  }
  const near = results.find((r) => r.close);
  return near ? { ok: false, close: true, hint: near.hint, art: near.art, target: near.target } : { ok: false, close: false };
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
  let type = pass === 'hafta' ? (seed % 3 ? 'tr2de' : types[seed % types.length]) : types[(seed + (pass === 'donus' ? 1 : 0)) % types.length];
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
