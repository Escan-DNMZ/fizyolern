// Baut private/fizyolern-ozel.json (Wochenplan, Fehlerliste, Notion-Links).
// Diese Datei wird NICHT veröffentlicht: in der App unter Ayarlar → „Özel verileri yükle“ importieren.
// Aufruf: node tools/build_private.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { WEEK } from '../private/plan.js';
import { FEHLER } from '../private/fehler.js';

const notion = JSON.parse(readFileSync(new URL('../private/notion-links.json', import.meta.url), 'utf-8'));
const out = { kind: 'fizyolern-private', version: 1, week: WEEK, fehler: FEHLER, notion };
writeFileSync(new URL('../private/fizyolern-ozel.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`private/fizyolern-ozel.json: KW ${WEEK.kw}, ${FEHLER.length} Fehlerkarten, ${Object.keys(notion).length} Notion-Links`);
