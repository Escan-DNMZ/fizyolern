// Checkliste: Lernziele der Lehrkraft (aus Notion, nur auf dem Gerät) als Rückgrat eines Fachs.
// • Welche Ziele wurden im Unterricht behandelt (Notion: abgehakt, „✅ TT.MM“)?
// • Wie sicher bin ich? 4 Stufen Selbsteinschätzung (store.ck), eine falsche Antwort senkt sie um eine Stufe.
// • Welche Fragen prüfen ein Ziel? Zuerst das Feld „ck“ einer Frage (Schlüsselbegriffe des Ziels),
//   sonst die beste ungefähre Übereinstimmung zwischen Zieltext und Frage (js/fuzzy.js).
import * as store from './store.js';
import { ckList, getPrivate } from './private.js';
import { LESSONS } from './lessons.js';
import { MCQ } from './data/questions.js';
import { containsFuzzy, fold } from './fuzzy.js';
import { t } from './i18n.js';
import './strings.js';

// Stufen von gut nach schlecht (lv 3 … 0); Knopfreihenfolge in der App
export const LEVELS = [
  { lv: 3, e: '😊', k: 'ck.lv3' },
  { lv: 2, e: '🙂', k: 'ck.lv2' },
  { lv: 1, e: '😕', k: 'ck.lv1' },
  { lv: 0, e: '😵', k: 'ck.lv0' },
];
export const emojiOf = (lv) => (LEVELS.find((x) => x.lv === lv) || {}).e || '';

export const ckFaecher = () => [...new Set(ckList().map((c) => c.fach))];
export const hasChecklist = (fach) => ckList().some((c) => c.fach === fach);
export const itemsOf = (fach) => ckList().filter((c) => c.fach === fach);
export const findItem = (id) => ckList().find((c) => c.id === id) || null;
export const levelOf = (id) => { const r = store.get().ck[id]; return r ? r.lv : null; };

// Abschnitte in der Reihenfolge der Notion-Seite
export function sectionsOf(fach) {
  const out = [];
  for (const it of itemsOf(fach)) {
    let s = out.find((x) => x.name === it.sec);
    if (!s) out.push((s = { name: it.sec, items: [] }));
    s.items.push(it);
  }
  return out;
}

// Ders Notu eines Ziels: „→ Notu 4“ = Lektion des Fachs mit Nummer 4 (trainingslehre-4, physiologie-4-muskel)
// oder eine Seitenerwähnung, deren Hash zur Lektion passt
export function linkedLessons(item) {
  return LESSONS.filter((l) => l.fach === item.fach && (
    (item.nh || []).includes(l.nh)
    || (item.notu || []).some((n) => new RegExp(`-${n}(?:-|$)`).test(l.id) || new RegExp(`^${n}\\b`).test(String(l.lektion || '')))
  ));
}

// ───── Fragen ↔ Lernziele ─────
// Wörter ohne Aussagekraft für die Zuordnung (Operatoren der Checkliste, Füllwörter)
const STOP = new Set(('definieren erklaeren erlaeutern nennen benennen beschreiben unterscheiden abgrenzen voneinander anhand sowie '
  + 'einer eines einem ihre ihrer ihren ihrem diese dieser welche welcher welches warum wodurch zwischen gegen durch nach ueber unter '
  + 'auch beim eine einen oder und nicht haeufig allgemeine allgemein beispiele beispiel bedeutung gruende skizze begriffe').split(' '));
const tokens = (text) => [...new Set(fold(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
const qText = (q) => `${q.q} ${q.o[q.a || 0]}`;

// Alle Multiple-Choice-Fragen eines Fachs: Lektionen + handgeschriebene Fragen mit derselben Kategorie
function poolFor(fach) {
  return [
    ...LESSONS.filter((l) => l.fach === fach).flatMap((l) => l.mcq.map((q, i) => ({ id: q.id || `L:${l.id}:${i}`, cat: l.fach, lesson: l.id, q: q.q, o: q.o, a: 0, x: q.x, xEn: q.xEn, ck: q.ck }))),
    ...MCQ.filter((q) => q.cat === fach),
  ];
}

// Passung Frage ↔ Ziel: ck-Begriffe zählen voll (≥ 10), sonst Anteil der Zielwörter in der Frage (0…1)
function score(item, q, toks, lessons) {
  if (q.ck && q.ck.length) {
    const hits = [].concat(q.ck).filter((k) => containsFuzzy(item.text, k)).length;
    return hits ? 10 + hits : 0;
  }
  if (!toks.length) return 0;
  const text = qText(q);
  const hits = toks.filter((w) => containsFuzzy(text, w)).length;
  if (!hits) return 0;
  let s = hits / toks.length;
  if (lessons.length) s *= lessons.some((l) => l.id === q.lesson) ? 1.3 : 0.6;
  return s;
}
const MIN_FUZZY = 0.34;

let cache = { key: '', byItem: new Map(), byQ: new Map() };
function index() {
  const p = getPrivate();
  const key = (p ? p.syncedAt + ':' : '') + ckList().length + ':' + LESSONS.map((l) => l.id + l.mcq.length).join();
  if (key === cache.key && cache.list === ckList()) return cache;
  const byItem = new Map(), byQ = new Map();
  for (const fach of ckFaecher()) {
    const items = itemsOf(fach).map((it) => ({ it, toks: tokens(it.text), lessons: linkedLessons(it) }));
    for (const q of poolFor(fach)) {
      const scored = items.map((x) => ({ it: x.it, s: score(x.it, q, x.toks, x.lessons) })).filter((x) => x.s > 0);
      if (!scored.length) continue;
      const best = Math.max(...scored.map((x) => x.s));
      if (best < 10 && best < MIN_FUZZY) continue;
      // ck: alle Ziele mit gleich vielen Treffern; ungefähr: nur das beste
      const winners = best >= 10 ? scored.filter((x) => x.s === best) : [scored.find((x) => x.s === best)];
      for (const w of winners) {
        if (!byItem.has(w.it.id)) byItem.set(w.it.id, []);
        byItem.get(w.it.id).push({ q, s: w.s });
        if (!byQ.has(q.id)) byQ.set(q.id, []);
        byQ.get(q.id).push(w.it);
      }
    }
  }
  for (const list of byItem.values()) list.sort((a, b) => b.s - a.s);
  cache = { key, list: ckList(), byItem, byQ };
  return cache;
}

// Fragen eines Ziels (beste Passung zuerst) und Ziele einer Frage
export const questionsOf = (itemId) => (index().byItem.get(itemId) || []).map((x) => x.q);
export const itemsOfQuestion = (qid) => index().byQ.get(qid) || [];
// Für „Bu hedefi test et“: 3–5 Fragen
export const itemQuiz = (itemId, n = 5) => questionsOf(itemId).slice(0, n);

const daysSince = (iso) => (Date.now() - new Date(iso + 'T12:00:00')) / 864e5;

// Darf eine Frage im Morgentest/gemischten Test kommen? Nicht, wenn alle ihre Ziele noch nicht behandelt wurden.
// Fragen ohne Ziel bleiben erlaubt (sie stammen aus Ders-Notları, also aus behandeltem Stoff).
export function allowedInDaily(qid) {
  const its = itemsOfQuestion(qid);
  return !its.length || its.some((it) => it.done);
}

// Gewichtsfaktor: unsichere Ziele (😵/😕) und in den letzten 7 Tagen behandelte zuerst
export function ckWeight(qid) {
  const its = itemsOfQuestion(qid);
  if (!its.length) return 1;
  let w = 0;
  for (const it of its) {
    if (!it.done) continue;
    const lv = levelOf(it.id);
    let x = lv === 0 ? 3 : lv === 1 ? 2.5 : lv === null ? 1.3 : lv === 2 ? 1 : 0.6;
    if (it.date && daysSince(it.date) <= 7) x *= 2;
    w = Math.max(w, x);
  }
  return w || 1;
}

// Falsche Antwort → Ziel(e) automatisch eine Stufe tiefer (ohne Einschätzung: 🙂 → 😕); hochstufen geht von Hand
store.onQuizRecorded((qid, ok) => {
  if (ok || !ckList().length) return;
  for (const it of itemsOfQuestion(qid)) {
    if (!it.done) continue;
    const cur = levelOf(it.id);
    const lv = Math.max(0, (cur === null ? 2 : cur) - 1);
    store.get().ck[it.id] = { lv, last: store.today(), auto: true }; // recordQuiz speichert gleich danach
  }
});

// Zusammenfassung eines Fachs: behandelt a/b, Stufen, schwächste behandelte Ziele
export function summary(fach) {
  const items = itemsOf(fach);
  const done = items.filter((x) => x.done);
  const lv = (x) => levelOf(x.id);
  const weakest = done.filter((x) => lv(x) !== null && lv(x) <= 1)
    .sort((a, b) => lv(a) - lv(b) || (b.date || '').localeCompare(a.date || ''))
    .slice(0, 3);
  return {
    total: items.length, done: done.length,
    good: items.filter((x) => lv(x) === 3).length,
    almost: items.filter((x) => lv(x) === 2).length,
    weak: items.filter((x) => lv(x) !== null && lv(x) <= 1).length,
    rated: items.filter((x) => lv(x) !== null).length,
    weakest,
  };
}

// ───── Bildschirm ─────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '');
const openSecs = new Set(); // aufgeklappte Abschnitte (nur für diese Sitzung)
let openItem = null;

export function renderChecklist(view, fach, { toast } = {}) {
  if (!hasChecklist(fach)) { view.innerHTML = `<p class="empty">${t('ck.none')}</p>`; return; }
  const secs = sectionsOf(fach);
  const sm = summary(fach);
  // beim ersten Öffnen: Abschnitte mit behandelten Zielen aufklappen
  if (![...openSecs].some((k) => k.startsWith(fach + '|'))) secs.filter((s) => s.items.some((x) => x.done)).forEach((s) => openSecs.add(fach + '|' + s.name));
  const lessonsById = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

  const itemHtml = (it) => {
    const lv = levelOf(it.id);
    const rec = store.get().ck[it.id];
    const qs = questionsOf(it.id);
    const ls = linkedLessons(it);
    const open = openItem === it.id;
    return `<div class="ck-item${it.done ? '' : ' todo'}" data-item="${esc(it.id)}">
      <button class="ck-text" data-toggle="${esc(it.id)}" aria-expanded="${open}">
        <span lang="de">${esc(it.text)}</span>
        <span class="ck-meta small">${it.done ? `<span class="badge good">✓ ${it.date ? ddmm(it.date) : t('ck.done')}</span>` : `<span class="badge">${t('ck.notYet')}</span>`}
          ${it.skript ? `<span class="muted">Skript ${esc(it.skript)}</span>` : ''}
          <span class="muted">${qs.length ? t('n.questions', { n: qs.length }) : t('ck.noQ')}</span>
          ${rec && rec.auto ? `<span class="badge warn">${t('ck.auto')}</span>` : ''}</span>
      </button>
      <div class="ck-rate" role="group" aria-label="${t('ck.rateLabel')}">
        ${LEVELS.map((L) => `<button class="ck-lv${lv === L.lv ? ' on' : ''}" data-lv="${L.lv}" data-id="${esc(it.id)}" title="${t(L.k)}" aria-label="${t(L.k)}" aria-pressed="${lv === L.lv}">${L.e}</button>`).join('')}
      </div>
      ${open ? `<div class="ck-more small">
        <div class="muted">${LEVELS.map((L) => `${L.e} ${t(L.k)}`).join(' · ')}</div>
        ${ls.length ? ls.map((l) => `<a class="btn ghost block" href="#/not/${encodeURIComponent(l.id)}" lang="de">📖 ${esc(lessonsById[l.id].title)}</a>`).join('')
          : (it.notu || []).length ? `<div class="muted" style="margin-top:6px">Notu ${it.notu.join(', ')}</div>` : ''}
        ${qs.length ? `<a class="btn block" href="#/test?kat=${encodeURIComponent('Lernziel: ' + it.id)}">${t('ck.testIt', { n: Math.min(5, qs.length) })}</a>` : `<div class="muted" style="margin-top:6px">${t('ck.noQ')}</div>`}
      </div>` : ''}
    </div>`;
  };

  view.innerHTML = `
    <div class="card">
      <div class="eyebrow">${t('ck.eyebrow')}</div>
      <h2 lang="de">${esc(fach)}</h2>
      <div class="ck-bar" aria-hidden="true"><div style="width:${sm.total ? (sm.done / sm.total) * 100 : 0}%"></div></div>
      <div class="small">${t('ck.doneOf', { a: sm.done, b: sm.total })} · 😊 ${sm.good} · 🙂 ${sm.almost} · 😕/😵 ${sm.weak}</div>
      <p class="muted small" style="margin-bottom:0">${t('ck.intro')}</p>
      ${sm.done ? `<a class="btn block" style="margin-top:12px" href="#/test?kat=${encodeURIComponent('Ders: ' + fach)}">${t('ck.testDone')}</a>` : ''}
    </div>
    ${secs.map((s) => {
      const d = s.items.filter((x) => x.done).length;
      const key = fach + '|' + s.name;
      return `<details class="ck-sec" data-sec="${esc(key)}"${openSecs.has(key) ? ' open' : ''}>
        <summary><span class="grow" lang="de">${esc(s.name || t('ck.general'))}</span><span class="badge ${d === s.items.length ? 'good' : d ? 'warn' : ''}">${t('ck.secDone', { a: d, b: s.items.length })}</span></summary>
        ${s.items.map(itemHtml).join('')}
      </details>`;
    }).join('')}
  `;
  view.querySelectorAll('details.ck-sec').forEach((el) => el.addEventListener('toggle', () => {
    if (el.open) openSecs.add(el.dataset.sec); else openSecs.delete(el.dataset.sec);
  }));
  view.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    openItem = openItem === b.dataset.toggle ? null : b.dataset.toggle;
    const y = view.scrollTop;
    renderChecklist(view, fach, { toast });
    view.scrollTop = y;
  }));
  view.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.id, lv = +b.dataset.lv;
    store.rateCk(id, levelOf(id) === lv && !(store.get().ck[id] || {}).auto ? null : lv); // nochmal tippen = zurücknehmen
    if (toast) toast(t('saved'));
    const y = view.scrollTop;
    renderChecklist(view, fach, { toast });
    view.scrollTop = y;
  }));
}
