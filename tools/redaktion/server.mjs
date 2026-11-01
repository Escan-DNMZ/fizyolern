// „FizyoLern Redaktion“: lokale Prüfseite für KI-Entwürfe (nur auf dem Rechner der Redaktion, nie auf Schülergeräten).
// Aufruf:  node tools/redaktion/server.mjs [--daten <ordner>] [--port 8790] [--beispiel]
//   --daten     Arbeitsordner (Standard: private/redaktion – nicht im Repo)
//   --beispiel  erfundene Beispieldaten in den (leeren) Arbeitsordner kopieren
// Dann im Browser http://127.0.0.1:8790 öffnen. Ordner im Arbeitsordner:
//   folien/<Fach>/*.pdf   neue Foliensätze (später: aus Teams über Microsoft Graph)
//   entwuerfe/*.json      Entwürfe (KI oder Import) mit Prüfstatus
//   klassen/*.json        Klassenteil: Name, Jahr, Wochenplan, Checkliste, Termine
//   ausgabe/              fertige Kurspakete (eins pro Klasse)
import http from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync, cpSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha16, deHash, bankRow, buildPack } from './paket.mjs';
import { provider, MODELL, draftFromPdf, translateRows } from './ki.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const DATEN = path.resolve(arg('daten', path.join(root, 'private', 'redaktion')));
const PORT = Number(arg('port', 8790));
const DIR = { folien: path.join(DATEN, 'folien'), entwuerfe: path.join(DATEN, 'entwuerfe'), klassen: path.join(DATEN, 'klassen'), ausgabe: path.join(DATEN, 'ausgabe') };
for (const d of Object.values(DIR)) mkdirSync(d, { recursive: true });
if (args.includes('--beispiel') && !readdirSync(DIR.entwuerfe).length && !readdirSync(DIR.klassen).length) {
  cpSync(path.join(here, 'beispiel'), DATEN, { recursive: true });
  console.log('Beispieldaten kopiert nach', DATEN);
}

const FAECHER = ['Anatomie', 'Physiologie', 'PT Grundlagen', 'PT Befund', 'O/C', 'Trainingslehre', 'KMT', 'Hygiene', 'PPS'];
const readJson = (f) => JSON.parse(readFileSync(f, 'utf-8'));
// erst in eine Hilfsdatei schreiben, dann umbenennen – kein halber Entwurf bei einem Absturz
const writeJson = (f, x) => { writeFileSync(f + '.tmp', JSON.stringify(x, null, 1) + '\n'); renameSync(f + '.tmp', f); };
const jsonFiles = (d) => readdirSync(d).filter((f) => f.endsWith('.json'));
const SAFE_ID = /^[a-z0-9-]{1,80}$/;
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const klassen = () => jsonFiles(DIR.klassen).map((f) => readJson(path.join(DIR.klassen, f))).filter((k) => SAFE_ID.test(k.id || ''));
const deckFile = (id) => { if (!SAFE_ID.test(id)) throw new Error('Ungültige id'); return path.join(DIR.entwuerfe, id + '.json'); };
const loadDeck = (id) => readJson(deckFile(id));
const saveDeck = (d) => writeJson(deckFile(d.deck.id), d);

// PDFs in folien/<Fach>/ (eine Ebene tief)
function pdfs() {
  const out = [];
  for (const fach of readdirSync(DIR.folien)) {
    const dir = path.join(DIR.folien, fach);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (f.toLowerCase().endsWith('.pdf')) out.push({ datei: fach + '/' + f, fach, lektion: f.replace(/\.pdf$/i, ''), zeit: statSync(path.join(dir, f)).mtime.toISOString() });
  }
  return out;
}

const counts = (rows) => ({ n: rows.length, ok: rows.filter((r) => r.status === 'ok').length, neu: rows.filter((r) => r.status === 'neu').length, geloescht: rows.filter((r) => r.status === 'geloescht').length });

function stand() {
  const decks = jsonFiles(DIR.entwuerfe).map((f) => { const d = readJson(path.join(DIR.entwuerfe, f)); return { ...d.deck, klassen: d.klassen, ...counts(d.rows) }; });
  const known = new Set(decks.map((d) => d.datei).filter(Boolean));
  return {
    ki: provider(), modell: provider() === 'anthropic' ? MODELL : '', faecher: FAECHER,
    klassen: klassen().map(({ id, name, year }) => ({ id, name, year })),
    decks: decks.sort((a, b) => (b.erstellt || '').localeCompare(a.erstellt || '')),
    neueFolien: pdfs().filter((p) => !known.has(p.datei)),
  };
}

// Lehrkräfte sehen nur Deutsch: TR/EN-Felder werden nie an die Seite geschickt
function germanView(r) {
  const { erklEn, antwortEn, ...rest } = r;
  return r.typ === 'Wort'
    ? { id: r.id, typ: r.typ, frage: r.frage, beispiel: r.erkl || '', ck: r.ck, quelle: r.quelle, hinweis: r.hinweis, status: r.status, uebersetzung: r.uebersetzung }
    : { ...rest, erkl: undefined };
}

const strArr = (x, n) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean).slice(0, n) : []);
function newRow(x, i) {
  const typ = ['Kern', 'MCQ', 'Offen', 'Wort'].includes(x.typ) ? x.typ : null;
  if (!typ || !String(x.frage || '').trim()) return null;
  const r = {
    id: sha16(JSON.stringify([typ, x.frage, i, Date.now()])), typ, frage: String(x.frage).trim(),
    antwort: String(x.antwort || '').trim(), ablenker: typ === 'MCQ' ? strArr(x.ablenker, 3) : [], kw: typ === 'Offen' ? strArr(x.kw, 7) : [],
    erkl: String(x.erkl || '').trim(), quelle: String(x.quelle || '').trim(), hinweis: String(x.hinweis || '').trim(),
    ck: /^ck:[0-9a-f]{16}$/.test(x.ck || '') ? x.ck : '', status: 'neu', auto: true, uebersetzung: 'offen',
  };
  r.deHash = deHash(r);
  return r;
}

// CSV im Format aus docs/ai-setup.md (Frage,Typ,Fach,Lektion,Antwort,Ablenker 1–3,Erklärung TR,Schlüsselbegriffe,Gizle)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().replace(/^﻿/, ''));
  const col = (r, name) => (r[head.indexOf(name)] || '').trim();
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => ({
    typ: col(r, 'Typ'), frage: col(r, 'Frage'), antwort: col(r, 'Antwort'), fach: col(r, 'Fach'), lektion: col(r, 'Lektion'),
    ablenker: [col(r, 'Ablenker 1'), col(r, 'Ablenker 2'), col(r, 'Ablenker 3')], erkl: col(r, 'Erklärung TR'),
    kw: col(r, 'Schlüsselbegriffe').split(/[,;]/).map((k) => k.trim()).filter(Boolean),
  }));
}

function createDeck({ fach, lektion, datei = '', rows }) {
  if (!FAECHER.includes(fach)) throw new Error('Unbekanntes Fach');
  const id = slug((datei || fach + ' ' + lektion).replace(/\.pdf$/i, '')) + '-' + sha16(datei || lektion + Date.now()).slice(0, 6);
  const clean = rows.map(newRow).filter(Boolean);
  if (!clean.length) throw new Error('Keine gültigen Zeilen gefunden');
  const d = { deck: { id, datei, fach, lektion: String(lektion).trim().slice(0, 200), erstellt: new Date().toISOString() }, klassen: klassen().map((k) => k.id), rows: clean };
  saveDeck(d);
  return d;
}

const EDIT = ['frage', 'antwort', 'ablenker', 'kw', 'beispiel', 'quelle'];
async function changeRow({ deck, id, aktion, felder = {} }) {
  const d = loadDeck(deck);
  const r = d.rows.find((x) => x.id === id);
  if (!r) throw new Error('Zeile nicht gefunden');
  if (aktion === 'freigeben') r.status = 'ok';
  else if (aktion === 'loeschen') r.status = 'geloescht';
  else if (aktion === 'zuruecksetzen') r.status = 'neu';
  else if (aktion === 'bearbeiten') {
    for (const k of EDIT) {
      if (!(k in felder)) continue;
      if (k === 'ablenker') r.ablenker = strArr(felder.ablenker, 3);
      else if (k === 'kw') r.kw = strArr(felder.kw, 7);
      else if (k === 'beispiel') { if (r.typ === 'Wort') r.erkl = String(felder.beispiel).trim(); }
      else if (k === 'antwort' && r.typ === 'Wort') continue; // Übersetzung, nicht Deutsch
      else r[k] = String(felder[k]).trim();
    }
    r.hinweis = ''; // von der Lehrkraft geprüft
    // Deutsch geändert → Übersetzungen sofort automatisch neu
    if (r.deHash !== deHash(r)) { r.uebersetzung = 'offen'; await translateRows([r]).catch((e) => { console.warn('Übersetzung später:', e.message); }); }
  } else throw new Error('Unbekannte Aktion');
  saveDeck(d);
  return germanView(r);
}

async function publish() {
  const decks = jsonFiles(DIR.entwuerfe).map((f) => readJson(path.join(DIR.entwuerfe, f)));
  // fehlende/veraltete Übersetzungen nachholen (ohne KI bleiben sie offen)
  let uebersetzt = 0;
  for (const d of decks) { const t = await translateRows(d.rows.filter((r) => r.status === 'ok')); uebersetzt += t.n; saveDeck(d); }
  const built = new Date().toISOString();
  const pakete = [], fehler = [];
  for (const k of klassen()) {
    const rows = [];
    for (const d of decks) {
      if (!d.klassen.includes(k.id)) continue;
      for (const r of d.rows.filter((x) => x.status === 'ok')) {
        const b = bankRow(r, { fach: d.deck.fach, lektion: d.deck.lektion, created: d.deck.erstellt });
        if (b) rows.push(b); else fehler.push(`${d.deck.lektion}: ${r.typ} „${r.frage.slice(0, 60)}“${r.typ === 'Wort' && !r.antwort ? ' (Übersetzung fehlt)' : ''}`);
      }
    }
    const { pack, meta } = buildPack({ klasse: k, bankId: 'jahr' + (k.year || 0), rows, built });
    writeJson(path.join(DIR.ausgabe, `kurs-${meta.id}.json`), pack);
    pakete.push({ id: meta.id, name: meta.class.name, n: meta.bank.n });
  }
  const offen = decks.reduce((n, d) => n + d.rows.filter((r) => r.status === 'ok' && r.uebersetzung !== 'ok').length, 0);
  return { pakete, uebersprungen: [...new Set(fehler)], uebersetzt, offenUebersetzung: offen, ordner: DIR.ausgabe };
}

// ───── HTTP: nur 127.0.0.1, nur eigene Seite (Host-/Header-Prüfung gegen DNS-Rebinding und fremde Seiten) ─────
const STATIC = { '/': ['index.html', 'text/html; charset=utf-8'], '/redaktion.js': ['redaktion.js', 'text/javascript; charset=utf-8'], '/redaktion.css': ['redaktion.css', 'text/css; charset=utf-8'] };
const FONTS = ['atkinson-hyperlegible-latin-400-normal.woff2', 'atkinson-hyperlegible-latin-700-normal.woff2', 'atkinson-hyperlegible-latin-ext-400-normal.woff2', 'atkinson-hyperlegible-latin-ext-700-normal.woff2'];
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok, bad) => {
  let size = 0; const parts = [];
  req.on('data', (c) => { size += c.length; if (size > 20e6) { bad(new Error('Zu groß')); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf-8') || '{}')); } catch { bad(new Error('Ungültige Anfrage')); } });
});

const API = {
  'GET /api/stand': () => stand(),
  'GET /api/entwurf': (q) => { const d = loadDeck(q.get('id') || ''); return { deck: d.deck, klassen: d.klassen, rows: d.rows.map(germanView), ziele: klassen().flatMap((k) => k.ck || []).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i).map(({ id, text }) => ({ id, text })) }; },
  'POST /api/entwurf/ki': async (b) => {
    const p = pdfs().find((x) => x.datei === b.datei);
    if (!p) throw new Error('PDF nicht gefunden');
    const ziele = klassen().flatMap((k) => k.ck || []).filter((c) => c.fach === p.fach);
    const rows = await draftFromPdf(path.join(DIR.folien, ...p.datei.split('/')), { fach: p.fach, lektion: b.lektion || p.lektion, ziele });
    const d = createDeck({ fach: FAECHER.includes(p.fach) ? p.fach : b.fach, lektion: b.lektion || p.lektion, datei: p.datei, rows });
    await translateRows(d.rows).catch((e) => console.warn('Übersetzung später:', e.message));
    saveDeck(d);
    return { id: d.deck.id };
  },
  'POST /api/entwurf/import': async (b) => {
    const text = String(b.text || '').trim();
    const rows = text.startsWith('[') || text.startsWith('{') ? [].concat(JSON.parse(text).rows || JSON.parse(text)) : parseCsv(text);
    const d = createDeck({ fach: b.fach, lektion: b.lektion || rows[0]?.lektion || 'Import', rows });
    await translateRows(d.rows).catch((e) => console.warn('Übersetzung später:', e.message));
    saveDeck(d);
    return { id: d.deck.id, n: d.rows.length };
  },
  'POST /api/zeile': (b) => changeRow(b),
  'POST /api/klassen': (b) => { const d = loadDeck(b.deck); const ids = new Set(klassen().map((k) => k.id)); d.klassen = strArr(b.klassen, 100).filter((k) => ids.has(k)); saveDeck(d); return { klassen: d.klassen }; },
  'POST /api/veroeffentlichen': () => publish(),
};

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '';
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return send(res, 403, { fehler: 'Nur lokal' });
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && STATIC[url.pathname]) { const [f, t] = STATIC[url.pathname]; return send(res, 200, readFileSync(path.join(here, f)), t); }
  if (req.method === 'GET' && url.pathname.startsWith('/fonts/') && FONTS.includes(url.pathname.slice(7))) return send(res, 200, readFileSync(path.join(root, 'fonts', url.pathname.slice(7))), 'font/woff2');
  const fn = API[req.method + ' ' + url.pathname];
  if (!fn) return send(res, 404, { fehler: 'Nicht gefunden' });
  // Schreibende Anfragen nur von der eigenen Seite (eigener Header → Browser schickt ihn nicht von fremden Seiten ohne Erlaubnis)
  if (req.method === 'POST' && (req.headers['x-redaktion'] !== '1' || !String(req.headers['content-type']).startsWith('application/json'))) return send(res, 403, { fehler: 'Nicht erlaubt' });
  try {
    const out = await fn(req.method === 'POST' ? await readBody(req) : url.searchParams);
    send(res, 200, out);
  } catch (e) {
    send(res, 400, { fehler: e.message });
  }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`FizyoLern Redaktion: http://127.0.0.1:${PORT}  (Daten: ${DATEN})`);
  console.log(provider() === 'anthropic' ? `KI: ${MODELL}` : 'KI: nicht eingerichtet – Entwürfe per JSON/CSV importieren, Übersetzungen bleiben offen');
});
