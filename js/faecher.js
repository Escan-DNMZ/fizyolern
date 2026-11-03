// Fachnamen vereinheitlichen: „PT-Befund“, „ANA 1“, „All ANA“, „Allg. Anatomie“ … → die festen Namen der App.
// Unbekannte Namen bleiben, wie sie sind (z. B. „Atemtherapie“, „AM“ oder ein Fach einer anderen Schule).
export const FAECHER_FEST = ['Anatomie', 'Physiologie', 'PT Grundlagen', 'PT Befund', 'O/C', 'Trainingslehre', 'KMT', 'Hygiene', 'PPS'];

// Vergleichsform: klein, Bindestrich/Unterstrich/Punkt = Leerzeichen, „O/C“ bleibt, Nummern und „×2“ am Ende weg
export const fachKey = (s) => String(s || '').toLocaleLowerCase('de')
  .replace(/×\s*\d+/g, ' ').replace(/\([^)]*\)/g, ' ')
  .replace(/[-–—_.]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/(\s+(\d+|[ivx]+))+$/, '').trim();

const ALIAS = {
  Anatomie: ['anatomie', 'ana', 'all ana', 'allg ana', 'allg anatomie', 'allgemeine anatomie', 'anatomy'],
  Physiologie: ['physiologie', 'physio logie', 'physiology'],
  'PT Grundlagen': ['pt grundlagen', 'ptgrundlagen', 'grundlagen pt', 'grundlagen der pt', 'grundlagen der physiotherapie', 'ptg'],
  'PT Befund': ['pt befund', 'ptbefund', 'befund', 'befundung', 'pt befundung', 'ptb'],
  'O/C': ['o/c', 'o / c', 'oc', 'o c', 'orthopädie/chirurgie', 'orthopädie chirurgie', 'orthopädie und chirurgie'],
  Trainingslehre: ['trainingslehre', 'training', 'tl'],
  KMT: ['kmt', 'klassische massage', 'klassische massagetherapie', 'massage'],
  Hygiene: ['hygiene'],
  PPS: ['pps', 'psychologie pädagogik soziologie', 'psychologie/pädagogik/soziologie'],
};
const BY_KEY = new Map();
for (const [f, list] of Object.entries(ALIAS)) for (const a of list) BY_KEY.set(fachKey(a), f);

// Ein Fachname → fester Name (oder unverändert, getrimmt)
export function canonFach(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  return BY_KEY.get(fachKey(s)) || BY_KEY.get(fachKey(s).replace(/\s+/g, '')) || s;
}

// Fächer in einem Freitext, z. B. Kursname „ANA 1 + O/C (Hr. X, R6)“ oder „Sabah testi: Physiologie + Hygiene“:
// Teile an „+“, „,“, „&“, „und“/„ve“/„and“ trennen und jeden Teil vereinheitlichen
export function faecherInText(text, known = FAECHER_FEST) {
  const parts = String(text || '').replace(/\([^)]*\)/g, ' ').split(/\s*(?:\+|,|&|·|\bund\b|\bve\b|\band\b)\s*/i);
  return [...new Set(parts.map(canonFach).filter((f) => known.includes(f)))];
}
