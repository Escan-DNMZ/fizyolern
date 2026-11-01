// Tests für die Redaktion (tools/redaktion/server.mjs) mit den erfundenen Beispieldaten, ohne KI und ohne Netz.
// Prüft: nur Deutsch an die Seite, Bearbeiten → Übersetzung neu fällig, Freigeben/Löschen, CSV-Import, Veröffentlichen, Schutz.
// Aufruf: node tools/test_redaktion.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { cleanKurs } = await import(pathToFileURL(path.join(root, 'js', 'kurs.js')).href);
const daten = mkdtempSync(path.join(tmpdir(), 'fizyo-redaktion-'));
const PORT = 8790 + Math.floor(Math.random() * 500);
const env = { ...process.env, FIZYO_KI: '', ANTHROPIC_API_KEY: '' }; // nie die echte KI im Test
const srv = spawn(process.execPath, [path.join(root, 'tools', 'redaktion', 'server.mjs'), '--daten', daten, '--port', String(PORT), '--beispiel'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => srv.stdout.on('data', (d) => { if (String(d).includes('http://127.0.0.1')) ok(); }));

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
function req(method, p, body, headers = {}) {
  return new Promise((done, bad) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: { host: `127.0.0.1:${PORT}`, ...(data ? { 'content-type': 'application/json', 'x-redaktion': '1' } : {}), ...headers } }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch { /* HTML */ } done({ status: res.statusCode, json: j, text: s, headers: res.headers }); });
    });
    r.on('error', bad);
    if (data) r.write(data);
    r.end();
  });
}

try {
  const page = await req('GET', '/');
  ok(page.status === 200 && page.text.includes('FizyoLern Redaktion') && /default-src 'none'/.test(page.headers['content-security-policy']), 'Seite mit strenger CSP');
  ok((await req('GET', '/', undefined, { host: 'evil.example' })).status === 403, 'fremder Host → 403 (DNS-Rebinding)');
  ok((await req('GET', '/../private/x.json')).status === 404 && (await req('GET', '/fonts/../server.mjs')).status === 404, 'keine fremden Dateien');

  const st = (await req('GET', '/api/stand')).json;
  ok(st.ki === 'manuell' && st.klassen.length === 3 && st.decks.length === 1, 'Stand: manuell, 3 Klassen, 1 Entwurf');
  const id = st.decks[0].id;
  const e = (await req('GET', '/api/entwurf?id=' + id)).json;
  const raw = JSON.stringify(e.rows);
  ok(e.rows.length === 6 && !/erklEn|antwortEn|"erkl"/.test(raw) && !raw.includes('kuvvet') && !raw.includes('Maksimal'), 'nur Deutsch an die Seite (keine TR/EN-Felder)');
  ok(e.rows.find((r) => r.typ === 'Wort').beispiel.startsWith('Für das'), 'Wort: deutscher Beispielsatz sichtbar');
  ok((await req('GET', '/api/entwurf?id=../../x')).status === 400, 'ungültige Entwurfs-id abgelehnt');

  // schreiben ohne eigenen Header (fremde Seite) → abgelehnt
  const forged = await req('POST', '/api/zeile', undefined, { 'content-type': 'text/plain' });
  ok(forged.status === 403, 'POST ohne x-redaktion → 403');

  // Bearbeiten: Deutsch geändert → Übersetzung neu fällig, KI-Hinweis weg
  const mcq = e.rows.find((r) => r.hinweis);
  const ed = await req('POST', '/api/zeile', { deck: id, id: mcq.id, aktion: 'bearbeiten', felder: { antwort: 'unter 10 %', ablenker: ['unter 20 %', 'unter 30 %', 'unter 50 %'], erklEn: 'HACK' } });
  ok(ed.status === 200 && ed.json.antwort === 'unter 10 %' && ed.json.uebersetzung === 'offen' && !ed.json.hinweis, 'Bearbeiten: Übersetzung offen, Hinweis erledigt');
  const file = JSON.parse(readFileSync(path.join(daten, 'entwuerfe', id + '.json'), 'utf-8'));
  ok(file.rows.find((r) => r.id === mcq.id).erklEn !== 'HACK', 'TR/EN-Felder nicht über die Seite änderbar');
  ok((await req('POST', '/api/zeile', { deck: id, id: mcq.id, aktion: 'freigeben' })).json.status === 'ok', 'Freigeben');
  const kern = e.rows.find((r) => r.typ === 'Kern');
  await req('POST', '/api/zeile', { deck: id, id: kern.id, aktion: 'loeschen' });

  // Klassen: nur bekannte
  const kl = await req('POST', '/api/klassen', { deck: id, klassen: ['1a', 'gibtsnicht'] });
  ok(kl.json.klassen.join() === '1a', 'nur bekannte Klassen');

  // CSV-Import im Format aus docs/ai-setup.md
  const csv = 'Frage,Typ,Fach,Lektion,Antwort,Ablenker 1,Ablenker 2,Ablenker 3,Erklärung TR,Schlüsselbegriffe,Gizle\n"Wie lange dauert die hygienische Händedesinfektion mindestens?","MCQ","Hygiene","Hände","30 Sekunden","5 Sekunden","3 Minuten","10 Minuten","en az 30 saniye","",""\n"die Hand, die Hände","Wort","Hygiene","Hände","el","","","","Die Hände werden desinfiziert.","",""\n';
  const imp = await req('POST', '/api/entwurf/import', { fach: 'Hygiene', lektion: 'Hände (Beispiel)', text: csv });
  ok(imp.status === 200 && imp.json.n === 2, 'CSV-Import: 2 Zeilen (Komma in Anführungszeichen)');
  ok((await req('POST', '/api/entwurf/import', { fach: 'Astrologie', lektion: 'x', text: csv })).status === 400, 'unbekanntes Fach abgelehnt');
  const ie = (await req('GET', '/api/entwurf?id=' + imp.json.id)).json;
  for (const r of ie.rows) await req('POST', '/api/zeile', { deck: imp.json.id, id: r.id, aktion: 'freigeben' });

  // Veröffentlichen: ein Paket pro Klasse, gültig für die App
  const pub = await req('POST', '/api/veroeffentlichen', {});
  ok(pub.status === 200 && pub.json.pakete.length === 3, 'drei Kurspakete');
  const p1a = JSON.parse(readFileSync(path.join(daten, 'ausgabe', 'kurs-beispiel-1a.json'), 'utf-8'));
  const c = cleanKurs(p1a);
  ok(c.skipped === 0 && c.meta.update === 'kurs/kurs-beispiel-1a.json', 'Paket 1A von der App lesbar');
  const fr = p1a.bank.rows.map((r) => r.frage);
  ok(fr.includes('Welche Kraftfähigkeit gilt als Basis für die anderen Kraftfähigkeiten?') && !fr.some((f) => f.startsWith('Die Kraftausdauer ist')) && !fr.includes('die Kraft'), 'nur Freigegebenes, Gelöschtes fehlt');
  ok(p1a.bank.rows.find((r) => r.frage.startsWith('Welche Kraft')).erklEn.startsWith('Maximal'), 'Hilfstexte (EN) im Paket');
  ok(fr.some((f) => f.startsWith('Wie lange')) && p1a.bank.rows.every((r) => r.fach && r.lektion && /^[0-9a-f]{16}$/.test(r.h)), 'Import im Paket, alle Zeilen vollständig');
  const p1b = JSON.parse(readFileSync(path.join(daten, 'ausgabe', 'kurs-beispiel-1b.json'), 'utf-8'));
  ok(!p1b.bank.rows.some((r) => r.fach === 'Trainingslehre'), 'Klasse 1B abgewählt → keine Kraft-Fragen');
  ok(pub.json.offenUebersetzung >= 1, 'ohne KI: offene Übersetzungen werden gemeldet');
  ok(!JSON.stringify(p1a).includes('hinweis') && !JSON.stringify(p1a).includes('quelle'), 'keine Redaktionsfelder im Paket');
} finally {
  srv.kill();
  rmSync(daten, { recursive: true, force: true });
}
ok(!existsSync(daten), 'Arbeitsordner aufgeräumt');

console.log(fail ? `${fail} von ${n} Redaktions-Tests fehlgeschlagen` : `Alle ${n} Redaktions-Tests bestanden`);
process.exit(fail ? 1 : 0);
