// Tolerante Textvergleiche für getippte Antworten (Wörter und Schlüsselbegriffe der offenen Fragen).
// Regeln: Groß-/Kleinschreibung egal · ä=ae, ö=oe, ü=ue, ß=ss · „|“ (trennbare Verben) egal ·
// Klammerzusätze wie „(WS)“ gehören nicht zum Wort · Tippfehler-Toleranz nach Wortlänge.

export function fold(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')          // Klammerzusätze entfernen
    .replace(/[|.,!?;:„“”"'’()\[\]]/g, '')
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

// Ähnlich genug? (beide Seiten bereits gefaltet)
export const close = (a, b) => levenshtein(a, b) <= tolerance(Math.max(a.length, b.length));

// Kommt ein Begriff (auch mehrere Wörter) ungefähr im Text vor?
export function containsFuzzy(text, phrase) {
  const t = fold(text), p = fold(phrase);
  if (!p) return false;
  if (t.includes(p)) return true;
  const tw = t.split(' '), pw = p.split(' ');
  for (let i = 0; i + pw.length <= tw.length; i++) {
    const win = tw.slice(i, i + pw.length).join(' ');
    if (close(win, p)) return true;
    // Wortanfang reicht bei langen Begriffen (z. B. „Trochanter“ in „Trochanters“)
    if (pw.length === 1 && p.length >= 6 && tw[i].startsWith(p.slice(0, -1))) return true;
  }
  return false;
}

// Abkürzungen in Klammern („die Wirbelsäule (WS)“ → „WS“)
export const abbreviations = (s) => [...String(s || '').matchAll(/\(([A-ZÄÖÜ][A-Za-zÄÖÜäöü.]{0,6})\)/g)].map((m) => m[1]);
