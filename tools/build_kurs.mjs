// Baut ein Kurspaket (docs/kurs-modus.md) aus einem privaten Datenpaket (fizyolern-private: Notion-Fragen, Plan, Checkliste, Termine).
// Fehlerlisten, Wortschatz und Notion-Links kommen NICHT ins Paket – nur, was die ganze Klasse braucht.
// Ausgabe nach private/kurs/ (nicht veröffentlicht). Checklisten-Texte sind Material der Lehrkräfte: nur in der Klasse teilen.
// Aufruf: node tools/build_kurs.mjs [--ein private/fizyolern-ozel.json] --id klasse-1a --name "Klasse 1A" [--jahr 1] [--update kurs/1a.json] [--ohne-plan] [--ohne-ck]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from './redaktion/paket.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, dflt = '') => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt; };
const flag = (name) => args.includes('--' + name);

const ein = arg('ein', path.join(root, 'private', 'fizyolern-ozel.json'));
const id = arg('id');
if (!/^[a-z0-9-]{1,60}$/.test(id)) {
  console.error('Bitte --id angeben (nur a–z, 0–9, „-“), z. B. --id klasse-1a');
  process.exit(1);
}
const src = JSON.parse(readFileSync(ein, 'utf-8'));
if (src.kind !== 'fizyolern-private') { console.error(`${ein}: kein fizyolern-private-Paket`); process.exit(1); }

const rows = (src.lessonRows || []).map(({ h, typ, fach, lektion, frage, antwort, ablenker, kw, erkl, created }) => ({ h, typ, fach, lektion, frage, antwort, ablenker, kw, erkl, ...(created ? { created } : {}) }));
const klasse = {
  id, name: arg('name', id), ...(arg('jahr') ? { year: Number(arg('jahr')) } : {}), ...(arg('update') ? { update: arg('update') } : {}),
  plan: { weeks: flag('ohne-plan') ? [] : src.weeks?.length ? src.weeks : src.week ? [src.week] : [] },
  ck: flag('ohne-ck') ? [] : (src.ck || []).map(({ id, fach, sec, text, done, date }) => ({ id, fach, sec, text, done, date })),
  exams: (src.exams || []).filter((e) => !e.done).map(({ typ, fach, topic, date }) => ({ typ, fach, topic, date })),
};

let out;
try {
  out = buildPack({ klasse, bankId: arg('bank', id + '-bank'), rows });
} catch (e) {
  // ungültige Zeilen nennen, damit man sie in Notion korrigieren kann
  const { cleanRow } = await import('./redaktion/paket.mjs');
  const bad = rows.filter((r) => !cleanRow(r));
  console.error(e.message);
  for (const r of bad.slice(0, 20)) console.error(`  ✗ ${r.typ} · ${r.fach} · ${String(r.frage).slice(0, 70)}`);
  process.exit(1);
}
const dir = path.join(root, 'private', 'kurs');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `kurs-${id}.json`);
writeFileSync(file, JSON.stringify(out.pack, null, 1) + '\n');
const m = out.meta;
console.log(`${path.relative(root, file)}: ${m.class.name} · ${m.bank.n} Zeilen · ${klasse.plan.weeks.length} Wochen · ${klasse.ck.length} Checklisten-Ziele · ${klasse.exams.length} Termine`);
console.log('Ohne Fehlerlisten, Wortschatz und Notion-Links. Checklisten-Texte nur in der Klasse teilen, nie öffentlich.');
