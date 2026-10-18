// Tests für die Antwortprüfung (js/words.js, js/fuzzy.js). Aufruf: node tools/test_check.mjs
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = new URL('../', import.meta.url).href;
const { checkTyped } = await import(root + 'js/words.js');
const { containsFuzzy } = await import(root + 'js/fuzzy.js');

const WS = 'die Wirbelsäule (WS)';
// [Eintrag, Eingabe, erwartet: 'ok' | 'close:<hint>' | 'wrong']
const cases = [
  [WS, 'Die Wirbelsäule', 'ok'],
  [WS, 'die wirbelsaule', 'ok'],
  [WS, 'die Wirbelsaeule', 'ok'],
  [WS, 'Wirbelsäule', 'close:Artikel fehlt'],
  [WS, 'der Wirbelsäule', 'close:Artikel falsch'],
  [WS, 'die Wirbelseule', 'ok'],
  [WS, 'WS', 'ok'],
  [WS, 'die Wirbel', 'wrong'],
  ['kräftigen / die Kräftigung', 'kräftigen / Die Kräftigung', 'ok'],
  ['kräftigen / die Kräftigung', 'kräftigen', 'ok'],
  ['kräftigen / die Kräftigung', 'Kräftigung', 'close:Artikel fehlt'],
  ['kräftigen / die Kräftigung', 'kräftigen / der Kräftigung', 'close:Artikel falsch'],
  ['die Schwellung / an|schwellen', 'anschwellen', 'ok'],
  ['die Rückbildung / sich zurück|bilden', 'zurückbilden', 'ok'],
  ['das Schulterblatt', 'das Schulterblat', 'ok'],
  ['das Schulterblatt', 'das Schulter', 'wrong'],
  ['der Keim / keimfrei', 'der Kein', 'wrong'],          // ≤ 4 Buchstaben: keine Toleranz
  ['der Bluterguss', 'der Bluterguß', 'ok'],              // ß = ss
  ['die Übelkeit', 'die Uebelkeit', 'ok'],
  ['das Kribbeln / kribbeln', 'der Kribbeln', 'close:Artikel falsch'],  // Verbvariante darf falschen Artikel nicht retten
];
const kw = [
  ['Der Sensor misst den Istwert, das Regelzentrum vergleicht.', 'Regelzentrum', true],
  ['das regelzentrom vergleicht', 'Regelzentrum', true],
  ['Ansatz am Trochanter major', 'Trochanter major', true],
  ['Ansatz am Trochnter majr', 'Trochanter major', true],
  ['Na-K-Pumpe hält das Ruhepotenzial', 'Ruhepotential', true],
  ['nur der Sensor', 'Regelzentrum', false],
  ['Echte Gelenke (Diarthrosen) haben einen Gelenkspalt', 'Diarthrose', true],   // Klammerinhalt zählt
  ['Die Belastbarkeit wird gesteigert', 'steigern', true],                          // Wortstamm
  ['Aus Angst bewegt sich der Mensch weniger', 'weniger Bewegung', true],           // andere Reihenfolge
  ['T-Score ab −2,5', '−2,5', true],
  ['Der Muskel macht Adduktion', 'Abduktion', false],                               // Gegenteil, nur 1 Buchstabe anders
  ['Der Parasympathikus bremst', 'Sympathikus', false],
  ['eher unspezifisch', 'spezifisch', false],
  ['Hypotonie', 'Hypertonie', false],
  ['Wirbelkörperbrüchen', 'Brüche', true],
];

let fail = 0;
const verdict = (r) => (r.ok ? 'ok' : r.close ? 'close:' + r.hint : 'wrong');
for (const [de, input, want] of cases) {
  const got = verdict(checkTyped({ de }, input));
  if (got !== want) fail++;
  console.log(`${got === want ? '✓' : '✗'} "${input}" ⇢ ${got}${got !== want ? `   (erwartet: ${want})` : ''}`);
}
for (const [text, term, want] of kw) {
  const got = containsFuzzy(text, term);
  if (got !== want) fail++;
  console.log(`${got === want ? '✓' : '✗'} Schlüsselbegriff „${term}“ in „${text}“ ⇢ ${got}`);
}
console.log(fail ? `\n${fail} FEHLER` : '\nAlle Tests bestanden');
process.exit(fail ? 1 : 0);
