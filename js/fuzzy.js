// Tolerante Textvergleiche für getippte Antworten (Wörter und Schlüsselbegriffe der offenen Fragen).
// Regeln: Groß-/Kleinschreibung egal · ä=ae, ö=oe, ü=ue, ß=ss · „|“ (trennbare Verben) egal ·
// Klammerzusätze wie „(WS)“ gehören nicht zum Wort · Tippfehler-Toleranz nach Wortlänge.

export function fold(s, { keepParens = false } = {}) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, (m) => (keepParens ? m : ' '))  // Klammerzusätze entfernen (bei Wörtern), im Fließtext behalten
    .replace(/[()[\]]/g, keepParens ? ' ' : '')
    .replace(/[|.,!?;:„“”"'’]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Erlaubte Tippfehler: ≤ 4 Buchstaben → 0, 5–8 → 1, ab 9 → 2
export const tolerance = (len) => (len <= 4 ? 0 : len <= 8 ? 1 : 2);

export function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Fachbegriffe, die sich nur in wenigen Buchstaben unterscheiden, aber das Gegenteil bedeuten
const OPPOSITE = [['abduk', 'adduk'], ['hyper', 'hypo'], ['intra', 'extra'], ['inspir', 'exspir'], ['afferen', 'efferen'], ['pronat', 'supinat'], ['innen', 'aussen']];
const negated = (a, b) => ['un', 'para'].some((x) => a.startsWith(x) && !b.startsWith(x) && a.slice(x.length, x.length + 4) === b.slice(0, 4));
const opposite = (a, b) => negated(a, b) || negated(b, a) || OPPOSITE.some(([x, y]) => (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)));

// Ähnlich genug? (beide Seiten bereits gefaltet)
export const close = (a, b) => !opposite(a, b) && levenshtein(a, b) <= tolerance(Math.max(a.length, b.length));

// Wortstamm-Treffer: langer Begriff steckt (gekürzt) in einem Wort des Textes –
// „steigern“ in „gesteigert“, „Diarthrose“ in „Diarthrosen“, „Bewegung“ in „bewegt“
// Teil kommt im Text vor – aber nicht mitten im Wort nach „para“/„un“ („Parasympathikus“ ≠ „Sympathikus“, „unspezifisch“ ≠ „spezifisch“)
function hasPart(t, p) {
  for (let i = t.indexOf(p); i >= 0; i = t.indexOf(p, i + 1)) if (!/(para|un)$/.test(t.slice(Math.max(0, i - 4), i))) return true;
  return false;
}
const stemHit = (word, p) => p.length >= 7 && hasPart(word, p.slice(0, Math.max(5, p.length - 3)));
const wordHit = (word, p) => word === p || close(word, p) || stemHit(word, p);

// Kommt ein Begriff (auch mehrere Wörter) ungefähr im Text vor?
// Text: Klammerinhalt zählt mit („Echte Gelenke (Diarthrosen)“); mehrere Wörter dürfen in anderer Reihenfolge
// nah beieinander stehen („weniger Bewegung“ ≈ „bewegt sich weniger“).
export function containsFuzzy(text, phrase) {
  const t = fold(text, { keepParens: true }), p = fold(phrase);
  if (!p) return false;
  if (hasPart(t, p)) return true;
  const tw = t.split(/[\s/-]+/).filter(Boolean), pw = p.split(' ');
  for (let i = 0; i + pw.length <= tw.length; i++) {
    if (close(tw.slice(i, i + pw.length).join(' '), p)) return true;
  }
  if (pw.length === 1) return tw.some((w) => wordHit(w, p) || (p.length >= 6 && w.startsWith(p.slice(0, -1)) && !opposite(w, p)));
  // mehrere Wörter: alle innerhalb von 6 Wörtern, Reihenfolge egal
  for (let i = 0; i < tw.length; i++) {
    const win = tw.slice(i, i + 6);
    if (pw.every((x) => win.some((w) => wordHit(w, x)))) return true;
  }
  return false;
}

// Abkürzungen in Klammern („die Wirbelsäule (WS)“ → „WS“)
export const abbreviations = (s) => [...String(s || '').matchAll(/\(([A-ZÄÖÜ][A-Za-zÄÖÜäöü.]{0,6})\)/g)].map((m) => m[1]);
