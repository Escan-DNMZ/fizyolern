// Kurs-Modus: Kurspaket einer Klasse = gemeinsame Fragenbank + Klassenteil (Plan, Checkliste, Termine).
// Format und Ablauf: docs/kurs-modus.md. Ohne installiertes Paket ist alles hier unsichtbar und ohne Wirkung.
// Sicherheit:
//  • Das Paket wird Feld für Feld geprüft (cleanKurs), unbekannte Felder fallen weg.
//  • Gespeichert wird nur auf dem Gerät (localStorage „fizyo.kurs“), getrennt von fizyo.v1 und fizyo.private.
//  • Laden über das Netz nur von https-Adressen bzw. derselben Herkunft; die CSP in index.html entscheidet zusätzlich.
import { cleanPrivate, setKursLayer, KURS_KEY } from './private.js';
import { refreshLessons, FAECHER } from './lessons.js';
import { t, locale } from './i18n.js';
import './strings.js';

export const KURS_KIND = 'fizyolern-kurs';
export const KURS_VERSION = 1;
export const MAX_BYTES = 5e6;
const MAX_ROWS = 20000;
const UPDATE_EVERY = 3 * 3600 * 1000; // wie der Notion-Sync: höchstens alle 3 Stunden

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = (x, max = 5000) => (typeof x === 'string' ? x.slice(0, max).trim() : '');
const strs = (x, max = 500, n = 20) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string').map((v) => v.slice(0, max).trim()).filter(Boolean).slice(0, n) : []);
const HEX16 = /^[0-9a-f]{16}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;
const iso = (x) => (typeof x === 'string' && x.length <= 40 && ISO.test(x) && Number.isFinite(Date.parse(x)) ? x : '');
const TYPEN = ['Kern', 'MCQ', 'Offen', 'Wort'];
// Update-Adresse: https://… oder ein relativer Pfad auf derselben Seite (z. B. „kurs/1a.json“), nie „..“ oder fremde Schemata
export const UPDATE_URL = /^(https:\/\/[^\s"'<>\\]+|(?!\/\/)(?!.*\.\.)[A-Za-z0-9._~\-/]+\.json)$/;

// Eine Zeile der Fragenbank prüfen (null = unbrauchbar). Gleiche Regeln wie für Notion-Zeilen (lessons.js → rowToItem).
export function cleanRow(r) {
  if (!isObj(r) || !HEX16.test(r.h) || !TYPEN.includes(r.typ)) return null;
  const row = {
    h: r.h, typ: r.typ, fach: str(r.fach, 100), lektion: str(r.lektion, 200), frage: str(r.frage), antwort: str(r.antwort),
    ablenker: strs(r.ablenker, 1000, 3), erkl: str(r.erkl), kw: strs(r.kw, 200, 20),
    ...(str(r.erklEn) ? { erklEn: str(r.erklEn) } : {}), ...(str(r.antwortEn, 500) ? { antwortEn: str(r.antwortEn, 500) } : {}),
    ...(typeof r.ck === 'string' && /^ck:[0-9a-f]{16}$/.test(r.ck) ? { ck: r.ck } : {}),
    ...(iso(r.created) ? { created: r.created } : {}),
  };
  if (!row.fach || !row.frage) return null;
  if (row.typ === 'MCQ') {
    const o = [row.antwort, ...row.ablenker];
    if (o.length !== 4 || o.some((x) => !x) || new Set(o).size !== 4) return null;
  }
  if (row.typ === 'Offen' && !row.kw.length) return null;
  if (row.typ === 'Wort' && !row.antwort) return null;
  return row;
}

const EXAM = /^(sınav|sinav|prüfung|klausur|exam|test)$/i;

// Ganzes Paket prüfen → { meta, layer, skipped } oder Error('kurs.bad…')
export function cleanKurs(obj) {
  if (!isObj(obj) || obj.kind !== KURS_KIND) throw new Error('kurs.badFormat');
  if (!Number.isInteger(obj.version) || obj.version < 1 || obj.version > KURS_VERSION) throw new Error('kurs.badVersion');
  if (typeof obj.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(obj.id)) throw new Error('kurs.badFormat');
  const cls = isObj(obj.class) ? obj.class : {};
  const bank = isObj(obj.bank) ? obj.bank : {};
  const raw = Array.isArray(bank.rows) ? bank.rows.slice(0, MAX_ROWS) : [];
  const rows = [];
  const seen = new Set();
  for (const r of raw) {
    const c = cleanRow(r);
    if (c && !seen.has(c.h)) { seen.add(c.h); rows.push(c); }
  }
  const year = Number(cls.year);
  const meta = {
    id: obj.id, version: obj.version, built: iso(obj.built),
    class: { id: str(cls.id, 60), name: str(cls.name, 100) || obj.id, ...(Number.isInteger(year) && year >= 1 && year <= 5 ? { year } : {}) },
    bank: { id: str(bank.id, 60), n: rows.length },
    ...(typeof obj.update === 'string' && obj.update.length <= 500 && UPDATE_URL.test(obj.update) ? { update: obj.update } : {}),
  };
  const plan = isObj(obj.plan) ? obj.plan : {};
  // Klassenteil im selben Format wie fizyo.private → gleiche Prüfung (cleanPrivate) und gleiche Anzeige
  const layer = cleanPrivate({
    kind: 'fizyolern-private', version: 2, source: 'kurs', syncedAt: meta.built,
    weeks: Array.isArray(plan.weeks) ? plan.weeks : [],
    ck: Array.isArray(obj.ck) ? obj.ck : [],
    exams: (Array.isArray(obj.exams) ? obj.exams : []).filter(isObj).map((e) => ({ ...e, typ: EXAM.test(String(e.typ || '').trim()) ? 'Sınav' : 'Ödev' })),
    lessonRows: rows,
  });
  return { meta, layer, skipped: raw.length - rows.length };
}

// ───── Speicher ─────
function readRec() {
  try {
    const raw = localStorage.getItem(KURS_KEY);
    const k = raw && JSON.parse(raw);
    return isObj(k) && isObj(k.meta) && isObj(k.layer) ? k : null;
  } catch { return null; }
}
let rec = readRec();
function writeRec() {
  setKursLayer(rec ? rec.layer : null);
  refreshLessons();
  if (!rec) { try { localStorage.removeItem(KURS_KEY); } catch { /* ignorieren */ } return true; }
  try { localStorage.setItem(KURS_KEY, JSON.stringify(rec)); return true; } catch { return false; }
}

export const kursActive = () => !!rec;
export const kursMeta = () => (rec ? rec.meta : null);
export const odevCards = () => (rec ? rec.layer.fehler.filter((f) => f.odev) : []);

// Paket installieren (auch Aktualisierung): eigene „Ödev ekle“-Karten bleiben erhalten
export function installKurs(obj, { src = '' } = {}) {
  let c;
  try { c = cleanKurs(obj); } catch (e) { return { ok: false, error: e.message }; }
  const keep = odevCards();
  // ohne neue Quelle (z. B. Datei) bleibt die alte Adresse derselben Klasse für spätere Updates
  const from = typeof src === 'string' && UPDATE_URL.test(src) ? src : rec && rec.meta.id === c.meta.id ? rec.src : '';
  rec = { v: 1, meta: c.meta, src: from, checkedAt: Date.now(), layer: { ...c.layer, fehler: keep } };
  const stored = writeRec();
  return { ok: true, meta: c.meta, skipped: c.skipped, stored };
}

export function removeKurs() {
  rec = null;
  writeRec();
  try { localStorage.removeItem('fizyo.kurs.last'); } catch { /* ignorieren */ }
}

// ───── „Ödev ekle“: eigene Karten zum Auswendiglernen (erscheinen im Deck „📌 Ödev“) ─────
const rnd16 = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
export function addOdev({ fach, odev, q, a, tr = '' }) {
  if (!rec) return false;
  const card = { id: 'ko:' + rnd16(), fach: str(fach, 100), odev: str(odev, 200), q: str(q, 2000), a: str(a, 2000), tr: str(tr, 2000) };
  if (!card.fach || !card.odev || !card.q || !card.a) return false;
  rec.layer.fehler = [...rec.layer.fehler, card].slice(-3000);
  rec.layer = cleanPrivate(rec.layer); // gleiche Prüfung wie beim Laden
  return writeRec();
}
export function removeOdev(id) {
  if (!rec) return;
  rec.layer.fehler = rec.layer.fehler.filter((f) => f.id !== id);
  writeRec();
}

// ───── Laden über das Netz (nur https bzw. dieselbe Herkunft) ─────
export function resolveUrl(u, base = globalThis.location ? location.href : 'https://localhost/') {
  if (typeof u !== 'string' || !UPDATE_URL.test(u.trim())) return null;
  try {
    const url = new URL(u.trim(), base);
    const same = globalThis.location && url.origin === location.origin;
    return url.protocol === 'https:' || same ? url.href : null;
  } catch { return null; }
}

export async function fetchKurs(u) {
  const url = resolveUrl(u);
  if (!url) throw new Error('kurs.badUrl');
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
  } catch { throw new Error('kurs.network'); } // offline, zu langsam oder von der CSP blockiert
  if (!res.ok) throw new Error('kurs.network');
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('kurs.tooBig');
  try { return JSON.parse(text); } catch { throw new Error('kurs.badFormat'); }
}

// Beim Start: neueres Paket von der Update-Adresse holen (still; Fehler → altes Paket bleibt)
export async function autoUpdateKurs({ force = false } = {}) {
  if (!rec) return false;
  const u = rec.meta.update || rec.src;
  if (!u || (!force && Date.now() - (rec.checkedAt || 0) < UPDATE_EVERY)) return false;
  const obj = await fetchKurs(u);
  const c = cleanKurs(obj);
  if (c.meta.id !== rec.meta.id) throw new Error('kurs.otherClass'); // nie still die Klasse wechseln
  if (!force && c.meta.built && rec.meta.built && c.meta.built <= rec.meta.built) {
    rec.checkedAt = Date.now();
    try { localStorage.setItem(KURS_KEY, JSON.stringify(rec)); } catch { /* ignorieren */ }
    return false;
  }
  return installKurs(obj, { src: rec.src }).ok;
}

// ───── Oberfläche: #/kurs (Einrichtung / Status) und #/kurs/odev („Ödev ekle“) ─────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const msg = (e) => t(e && /^kurs\./.test(e.message) ? e.message : 'kurs.network');

function stats(meta, layer) {
  const rows = layer.lessonRows;
  return {
    faecher: [...new Set(rows.map((r) => r.fach))],
    q: rows.filter((r) => r.typ === 'MCQ' || r.typ === 'Offen').length,
    words: rows.filter((r) => r.typ === 'Wort').length,
    weeks: layer.weeks.length, ck: layer.ck.length, exams: layer.exams.length,
  };
}
function summaryHtml(meta, layer) {
  const s = stats(meta, layer);
  const built = meta.built ? new Date(meta.built).toLocaleString(locale()) : '–';
  return `<div class="eyebrow">${t('kurs.eyebrow')}</div>
    <h2 lang="de">${esc(meta.class.name)}</h2>
    <div class="muted small">${t('kurs.stats', { q: s.q, w: s.words, f: s.faecher.length })}${s.weeks ? ' · ' + t('kurs.weeks', { n: s.weeks }) : ''}${s.ck ? ' · ' + t('kurs.ck', { n: s.ck }) : ''}${s.exams ? ' · ' + t('kurs.exams', { n: s.exams }) : ''}</div>
    <div class="muted small" lang="de">${esc(s.faecher.join(' · '))}</div>
    <div class="muted small">${t('kurs.built', { d: esc(built) })}</div>`;
}

export function renderKurs(view, args = [], params = new URLSearchParams(), { toast = () => {} } = {}) {
  if (args[0] === 'odev') return renderOdevAdd(view, { toast });
  const $ = (s) => view.querySelector(s);
  let pending = null; // geladenes, noch nicht installiertes Paket

  const draw = () => {
    const m = kursMeta();
    view.innerHTML = `
      ${m ? `<div class="card">${summaryHtml(m, rec.layer)}
        <div class="grid2" style="margin-top:10px">
          <a class="btn" href="#/kurs/odev">${t('kurs.odevAdd')}</a>
          ${m.update || rec.src ? `<button class="btn ghost" id="kUpdate">${t('kurs.updateNow')}</button>` : `<label class="btn ghost">${t('kurs.fromFile')}<input type="file" id="kFile" accept="application/json,.json" hidden></label>`}
        </div>
        <div id="kStatus" class="muted small" style="margin-top:8px"></div>
      </div>
      ${odevCards().length ? `<div class="section-title">${t('kurs.odevMine')}</div>
      <div class="list">${odevCards().map((f) => `<div class="row"><span class="grow"><b lang="de">${esc(f.q)}</b><div class="muted small">📌 ${esc(f.odev)} · <span lang="de">${esc(f.fach)}</span></div></span><button class="btn plain" data-del="${esc(f.id)}" aria-label="${t('kurs.odevDel')}">✕</button></div>`).join('')}</div>` : ''}
      <div class="section-title">${t('kurs.remove')}</div>
      <p class="muted small" style="padding:0 4px">${t('kurs.removeNote')}</p>
      <button class="btn plain block" id="kRemove">${t('kurs.remove')}</button>`
    : `<div class="card kform">
        <div class="eyebrow">${t('kurs.eyebrow')}</div>
        <h2>${t('kurs.setupH')}</h2>
        <p class="small">${t('kurs.setupIntro')}</p>
        <input type="url" id="kUrl" placeholder="kurs/1a.json · https://…" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(params.get('paket') || '')}">
        <div class="grid2" style="margin-top:8px">
          <button class="btn" id="kFetch">${t('kurs.fetch')}</button>
          <label class="btn ghost">${t('kurs.fromFile')}<input type="file" id="kFile" accept="application/json,.json" hidden></label>
        </div>
        <div id="kStatus" class="muted small" style="margin-top:8px"></div>
      </div>
      <div id="kPreview"></div>
      <p class="muted small" style="padding:0 4px">${t('kurs.privacy')}</p>`}`;
    bind();
  };

  const status = (s) => { const el = $('#kStatus'); if (el) el.textContent = s; };
  const preview = (obj, src) => {
    let c;
    try { c = cleanKurs(obj); } catch (e) { status('⚠️ ' + msg(e)); return; }
    pending = { obj, src };
    // Im Status-Bildschirm (Paket schon installiert): Datei aus einer anderen Klasse nicht still übernehmen
    const other = kursMeta() && kursMeta().id !== c.meta.id;
    const box = $('#kPreview') || $('#kStatus');
    box.innerHTML = `<div class="card">${summaryHtml(c.meta, c.layer)}
      ${c.skipped ? `<div class="muted small">${t('kurs.skipped', { n: c.skipped })}</div>` : ''}
      ${other ? `<div class="muted small">⚠️ ${t('kurs.otherClassNote')}</div>` : ''}
      <button class="btn block" id="kInstall" style="margin-top:10px">${t('kurs.install')}</button></div>`;
    $('#kInstall').addEventListener('click', () => {
      const r = installKurs(pending.obj, { src: pending.src });
      if (!r.ok) { status('⚠️ ' + t(r.error)); return; }
      toast(r.stored ? t('kurs.installed') : t('set.storageFull'));
      location.hash = '#/bugun';
    });
  };
  const bind = () => {
    const f = $('#kFile');
    if (f) f.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > MAX_BYTES) { status('⚠️ ' + t('kurs.tooBig')); return; }
      try { preview(JSON.parse(await file.text()), ''); } catch { status('⚠️ ' + t('kurs.badFormat')); }
    });
    const go = $('#kFetch');
    if (go) go.addEventListener('click', async () => {
      const u = $('#kUrl').value.trim();
      status(t('kurs.loading'));
      try { const obj = await fetchKurs(u); status(''); preview(obj, u); } catch (e) { status('⚠️ ' + msg(e)); }
    });
    const up = $('#kUpdate');
    if (up) up.addEventListener('click', async () => {
      status(t('kurs.loading'));
      try { const changed = await autoUpdateKurs({ force: true }); toast(changed ? t('kurs.updated') : t('kurs.upToDate')); draw(); } catch (e) { status('⚠️ ' + msg(e)); }
    });
    view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { removeOdev(b.dataset.del); draw(); }));
    const rm = $('#kRemove');
    if (rm) rm.addEventListener('click', () => {
      if (!confirm(t('kurs.confirmRemove'))) return;
      removeKurs();
      toast(t('kurs.removed'));
      draw();
    });
  };
  draw();
  // Link aus QR-Code (#/kurs?paket=…): gleich laden und zur Bestätigung zeigen – installiert wird erst nach Tippen
  if (!kursMeta() && params.get('paket')) $('#kFetch').click();
}

function renderOdevAdd(view, { toast }) {
  if (!kursActive()) { location.hash = '#/kurs'; return; }
  const last = (() => { try { return JSON.parse(localStorage.getItem('fizyo.kurs.last') || '{}'); } catch { return {}; } })();
  view.innerHTML = `
    <div class="card kform">
      <div class="eyebrow">${t('kurs.odevEyebrow')}</div>
      <h2>${t('kurs.odevAdd')}</h2>
      <p class="small muted">${t('kurs.odevIntro')}</p>
      <label class="small">${t('kurs.odevFach')}</label>
      <select id="oFach">${FAECHER.map((f) => `<option ${f === last.fach ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
      <label class="small">${t('kurs.odevTitle')}</label>
      <input type="text" id="oTitle" maxlength="200" value="${esc(last.odev || '')}" placeholder="${t('kurs.odevTitlePh')}">
      <label class="small">${t('kurs.odevQ')}</label>
      <textarea id="oQ" rows="2" maxlength="2000" lang="de" placeholder="Spina iliaca anterior superior"></textarea>
      <label class="small">${t('kurs.odevA')}</label>
      <textarea id="oA" rows="2" maxlength="2000" lang="de" placeholder="SIAS – vorderer oberer Darmbeinstachel"></textarea>
      <label class="small">${t('kurs.odevTr')}</label>
      <input type="text" id="oTr" maxlength="2000">
      <button class="btn block" id="oSave" style="margin-top:10px">${t('kurs.odevSave')}</button>
      <a class="btn ghost block" href="#/oturum/odev" style="margin-top:8px">${t('kurs.odevPractice', { n: odevCards().length })}</a>
    </div>`;
  const $ = (s) => view.querySelector(s);
  $('#oSave').addEventListener('click', () => {
    const card = { fach: $('#oFach').value, odev: $('#oTitle').value, q: $('#oQ').value, a: $('#oA').value, tr: $('#oTr').value };
    if (!card.odev.trim() || !card.q.trim() || !card.a.trim()) { toast(t('kurs.odevMissing')); return; }
    if (!addOdev(card)) { toast(t('set.storageFull')); return; }
    try { localStorage.setItem('fizyo.kurs.last', JSON.stringify({ fach: card.fach, odev: card.odev.slice(0, 200) })); } catch { /* ignorieren */ }
    toast(t('kurs.odevSaved'));
    renderOdevAdd(view, { toast }); // gleich die nächste Karte
    $('#oQ').focus();
  });
}
