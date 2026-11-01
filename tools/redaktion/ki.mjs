// KI-Schnittstelle der Redaktion: Entwürfe aus Folien (PDF) und automatische TR/EN-Hilfstexte.
// Läuft NUR auf dem Rechner der Redaktion, nie auf Schülergeräten. Kein Schlüssel im Repo:
//   FIZYO_KI=anthropic  ANTHROPIC_API_KEY=…  [FIZYO_KI_MODELL=claude-opus-5-5]
// Ohne diese Variablen gilt „manuell“: Entwürfe kommen aus JSON/CSV, Hilfstexte bleiben leer und als offen markiert.
// Raw HTTP (fetch) statt SDK, weil das Projekt bewusst ohne npm-Abhängigkeiten auskommt.
import { readFileSync } from 'node:fs';
import { deHash } from './paket.mjs';

const API = 'https://api.anthropic.com/v1/messages';
export const MODELL = process.env.FIZYO_KI_MODELL || 'claude-opus-5-5';
export const provider = () => (process.env.FIZYO_KI === 'anthropic' && process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'manuell');

const FAECHER = 'Anatomie, Physiologie, PT Grundlagen, PT Befund, O/C, Trainingslehre, KMT, Hygiene, PPS';

async function call({ system, content, schema, maxTokens = 16000 }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2026-10-21',
      // bei einer Ablehnung durch Sicherheitsfilter serverseitig auf das empfohlene Ersatzmodell ausweichen
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODELL, max_tokens: maxTokens, system, fallbacks: 'default',
      output_config: { effort: 'high', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`KI-Fehler ${res.status}: ${json.error?.message || 'unbekannt'}`);
  if (json.stop_reason === 'refusal') throw new Error('KI hat die Anfrage abgelehnt');
  if (json.stop_reason === 'max_tokens') throw new Error('KI-Antwort abgeschnitten (zu lang) – Foliensatz teilen');
  const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

const str = { type: 'string' };
const ROW = {
  type: 'object', additionalProperties: false,
  required: ['typ', 'frage', 'antwort', 'ablenker', 'kw', 'quelle', 'hinweis', 'ck'],
  properties: {
    typ: { type: 'string', enum: ['Kern', 'MCQ', 'Offen', 'Wort'] }, frage: str, antwort: str,
    ablenker: { type: 'array', items: str }, kw: { type: 'array', items: str },
    quelle: str, hinweis: str, ck: str,
  },
};

// Folien → deutsche Entwürfe (Übersetzungen macht translateRows danach, getrennt und wiederholbar)
export async function draftFromPdf(pdfPath, { fach, lektion, ziele = [] }) {
  if (provider() !== 'anthropic') throw new Error('Keine KI eingerichtet (FIZYO_KI=anthropic und ANTHROPIC_API_KEY setzen) – Entwürfe als JSON/CSV importieren');
  const data = readFileSync(pdfPath).toString('base64');
  const system = `Du erstellst Lernfragen für FizyoLern, eine Lern-App für die Physiotherapie-Ausbildung in Deutschland.
Alle Inhalte auf Deutsch (Fachbegriffe Deutsch/Latein). Trennbare Verben als „auf|richten“, Nomen mit Artikel.
Fächer: ${FAECHER}.
Regeln:
- Nur, was auf den Folien steht. Widerspricht eine Folie einem deutschen Standardlehrbuch (z. B. Prometheus, Schünke),
  nimm die lehrbuchrichtige Aussage und schreibe in „hinweis“ kurz, was auf der Folie steht und was Lehrbücher sagen. Sonst „hinweis“ leer.
- Kern (8–12): ein wichtiger Satz. MCQ (10–15): „antwort“ richtig, genau 3 plausible, falsche, ähnlich lange „ablenker“.
  Offen (3–5): Musterlösung in 2–5 Sätzen in „antwort“, 3–7 Schlüsselbegriffe in „kw“ (Alternativen „a|b“), die wörtlich in der Musterlösung stehen.
  Wort (10–20): „frage“ = deutscher Begriff, „antwort“ = leer (Übersetzung macht ein anderer Schritt).
- „quelle“ = „Folie <Nummer>“. „ck“ = id des passenden Lernziels aus der Liste oder leer. Bei Nicht-MCQ „ablenker“ = [].
- Keine Patientennamen, keine Namen von Lehrkräften.`;
  const content = [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
    { type: 'text', text: `Fach: ${fach}\nLektion: ${lektion}\nLernziele der Checkliste:\n${ziele.map((z) => `${z.id}: ${z.text}`).join('\n') || '(keine)'}\n\nErstelle die Zeilen.` },
  ];
  const out = await call({ system, content, schema: { type: 'object', additionalProperties: false, required: ['rows'], properties: { rows: { type: 'array', items: ROW } } } });
  return out.rows;
}

// Deutsche Zeilen → TR/EN-Hilfstexte. Lehrkräfte sehen diese Felder nie; sie werden bei jeder Änderung am Deutschen neu erzeugt.
export async function translateRows(rows) {
  const todo = rows.filter((r) => r.status !== 'geloescht' && (r.deHash !== deHash(r) || r.uebersetzung !== 'ok'));
  if (!todo.length) return { n: 0 };
  if (provider() !== 'anthropic') {
    for (const r of todo) { r.uebersetzung = 'offen'; r.deHash = deHash(r); r.auto = true; }
    return { n: 0, offen: todo.length };
  }
  const system = `Du schreibst Hilfstexte für deutschsprachige Lernfragen (Physiotherapie-Ausbildung), für Lernende mit Türkisch oder Englisch als Hilfssprache.
Der deutsche Lerninhalt bleibt unverändert; du übersetzt oder erklärst nur.
- Kern: erkl = türkische Übersetzung des Satzes, erklEn = englische.
- MCQ: erkl = kurze türkische Erklärung, warum die Antwort stimmt und die anderen nicht; erklEn = dasselbe auf Englisch.
- Offen: erkl/erklEn = kurze Zusammenfassung der Musterlösung.
- Wort: antwort = türkische Übersetzung des Begriffs, antwortEn = englische, beispiel = kurzer deutscher Beispielsatz.
Lateinische/deutsche Fachbegriffe in Klammern stehen lassen.`;
  const schema = {
    type: 'object', additionalProperties: false, required: ['rows'],
    properties: { rows: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'erkl', 'erklEn', 'antwort', 'antwortEn', 'beispiel'], properties: { id: str, erkl: str, erklEn: str, antwort: str, antwortEn: str, beispiel: str } } } },
  };
  let n = 0;
  for (let i = 0; i < todo.length; i += 40) {
    const part = todo.slice(i, i + 40);
    const input = part.map((r) => ({ id: r.id, typ: r.typ, frage: r.frage, ...(r.typ === 'Wort' ? {} : { antwort: r.antwort }), ...(r.typ === 'MCQ' ? { ablenker: r.ablenker } : {}) }));
    const out = await call({ system, content: [{ type: 'text', text: JSON.stringify(input) }], schema });
    for (const t of out.rows) {
      const r = part.find((x) => x.id === t.id);
      if (!r) continue;
      if (r.typ === 'Wort') { r.antwort = t.antwort; r.antwortEn = t.antwortEn; if (!r.erkl) r.erkl = t.beispiel; } else { r.erkl = t.erkl; r.erklEn = t.erklEn; }
      r.auto = true;
      r.uebersetzung = 'ok';
      r.deHash = deHash(r);
      n++;
    }
  }
  return { n };
}
