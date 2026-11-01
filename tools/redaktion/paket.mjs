// Kurspakete bauen (gemeinsam für tools/build_kurs.mjs und die Redaktion).
// Geprüft wird mit derselben Funktion wie in der App (js/kurs.js → cleanKurs), damit nie ein Paket entsteht,
// das die iPads ablehnen würden.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// js/kurs.js lädt beim Import den Gerätespeicher – hier gibt es keinen
if (!globalThis.localStorage) globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { cleanKurs, cleanRow, KURS_KIND, KURS_VERSION } = await import(pathToFileURL(path.join(root, 'js', 'kurs.js')).href);
export { cleanKurs, cleanRow };

export const sha16 = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

// Hash der deutschen Felder einer Zeile: ändert er sich, müssen die Übersetzungen neu erzeugt werden.
// Bei „Wort“ ist „antwort“ die Übersetzung (TR) und „erkl“ der deutsche Beispielsatz – historisches Notion-Format.
export const deHash = (r) => sha16(JSON.stringify(r.typ === 'Wort' ? [r.typ, r.frage] : [r.typ, r.frage, r.antwort, ...(r.ablenker || []), ...(r.kw || [])]));

// Entwurfszeile → Zeile der Fragenbank (nur Felder des Paketformats, docs/kurs-modus.md)
export function bankRow(r, { fach, lektion, created }) {
  return cleanRow({
    h: r.h || sha16('entwurf:' + r.id), typ: r.typ, fach: r.fach || fach, lektion: r.lektion || lektion,
    frage: r.frage, antwort: r.antwort, ablenker: r.ablenker, kw: r.kw,
    erkl: r.erkl, erklEn: r.erklEn, antwortEn: r.antwortEn, ck: r.ck, created: r.created || created,
  });
}

// Paket einer Klasse = gemeinsame Bank + Klassenteil; wirft, wenn die App es ablehnen würde
export function buildPack({ klasse, bankId, rows, built = new Date().toISOString() }) {
  const pack = {
    kind: KURS_KIND, version: KURS_VERSION, id: klasse.paketId || klasse.id, built,
    class: { id: klasse.id, name: klasse.name, ...(klasse.year ? { year: klasse.year } : {}) },
    ...(klasse.update ? { update: klasse.update } : {}),
    bank: { id: bankId, rows: rows.map((r) => ({ ...r, auto: r.auto !== false })) },
    plan: { weeks: klasse.plan?.weeks || [] },
    ck: klasse.ck || [],
    exams: klasse.exams || [],
  };
  const c = cleanKurs(pack);
  if (c.skipped) throw new Error(`${c.skipped} Zeile(n) ungültig – Paket nicht gebaut`);
  return { pack, meta: c.meta };
}
