// Sınav hazırlığı: eigener Bereich (Tab „Sınav“) für die nächste Prüfung mit Themenliste.
// Quelle: Tabelle in der Notion-Seite „Sınav & Ödev Takibi“ – Ders = Fach, Konu = Themen mit Komma getrennt.
// Die Themen werden den Lektionen des Fachs zugeordnet, auf die Tage bis zur Prüfung verteilt
// (mehr Fragen = mehr Tage), der Tag vor der Prüfung ist Gesamtwiederholung + Deneme sınavı.
import * as store from './store.js';
import { LESSONS, FAECHER } from './lessons.js';
import { lessonMcq } from './quizgen.js';
import { upcoming, daysUntil } from './private.js';
import { startMock } from './exam.js';
import { t } from './i18n.js';
import './strings.js';

export const PRUEF_DAYS = 60; // Prüfungen so weit im Voraus bekommen schon einen Plan
export const TOPIC_QUIZ = 15; // Fragen im Thementest

const norm = (s) => String(s || '').toLocaleLowerCase('de').normalize('NFC');
const words = (s) => norm(s).split(/[^a-zäöüß]+/).filter(Boolean);
const STOP = new Set(['der', 'die', 'das', 'des', 'und', 'von', 'im', 'in', 'mit', 'the', 'of', 'and', 've']);
// allgemeine Wörter ohne eigenes Thema („Grundlagen der Physiologie“)
const GENERIC = new Set(['grundlagen', 'grundlage', 'einführung', 'allgemein', 'allgemeine', 'basics', 'introduction']);
const GENERIC_RE = /einf[üu]hrung|grundlag|hom[öo]ostase|regelkreis|allgemein/;
// Endungen, die nur das Fach wiederholen („Muskelphysiologie“ → „muskel“)
const TAILS = ['physiologie', 'systeme', 'system', 'lehre', 'kunde', 'anatomie'];

// Suchstämme eines Themas: null = nur allgemeine Wörter
export function topicStems(topic) {
  const out = [];
  for (let w of words(topic)) {
    if (STOP.has(w) || GENERIC.has(w)) continue;
    for (const tail of TAILS) if (w.endsWith(tail) && w.length > tail.length) { w = w.slice(0, -tail.length); break; }
    if (TAILS.includes(w)) continue;
    if (w.length < 4) continue;
    out.push(w.slice(0, 5));
  }
  return out.length ? [...new Set(out)] : null;
}

// Lektionen eines Fachs, die zu einem Thema passen (Reihenfolge wie im Unterricht)
export function topicLessons(topic, fach, lessons = LESSONS) {
  const pool = lessons.filter((l) => l.fach === fach && l.mcq.length + l.open.length + l.kern.length > 0);
  const stems = topicStems(topic);
  if (!stems) return pool.filter((l) => GENERIC_RE.test(norm(l.title)));
  return pool.filter((l) => words(l.title).some((w) => stems.some((s) => w.startsWith(s))));
}

export const splitTopics = (s) => String(s || '').split(/[,;·•\n]|\s\+\s/).map((x) => x.trim()).filter(Boolean);

// Prüfung → Themen mit Lektionen. Ohne Konu: jede Lektion des Fachs ist ein Thema.
export function examTopics(exam, lessons = LESSONS) {
  const names = splitTopics(exam.topic);
  if (!names.length) {
    return lessons.filter((l) => l.fach === exam.fach && l.mcq.length).map((l) => ({ name: l.title, lessons: [l.id], weight: weightOf([l]) }));
  }
  return names.map((name) => {
    const ls = topicLessons(name, exam.fach, lessons);
    return { name, lessons: ls.map((l) => l.id), weight: weightOf(ls) };
  });
}
// Umfang eines Themas = Anzahl Fragen + Kernaussagen (mind. 1)
function weightOf(ls) { return Math.max(1, ls.reduce((n, l) => n + l.mcq.length + l.open.length + l.kern.length, 0)); }

// Die nächste Prüfung, für die es Fragen gibt
export function activeExam(now = new Date()) {
  for (const e of upcoming('Sınav', PRUEF_DAYS, now)) {
    if (!FAECHER.includes(e.fach)) continue;
    const topics = examTopics(e);
    if (topics.some((x) => x.lessons.length)) return { ...e, key: e.fach + '|' + e.date, topics };
  }
  return null;
}

// Lernplan: Themen nacheinander auf die Tage vom Planstart bis zum Vortag der Prüfung verteilen.
// Der Vortag ist Gesamtwiederholung + Deneme sınavı. Ergebnis je Thema: from/to = Tagesindex ab Planstart.
export function buildPlan(exam, start, now = new Date()) {
  const total = Math.max(1, daysUntil(exam.date, new Date(start + 'T12:00')));
  const study = Math.max(1, total - 1); // Tage für Themen; der letzte Tag vor der Prüfung = Wiederholung
  const topics = exam.topics.filter((x) => x.lessons.length);
  // Tage pro Thema: jedes Thema mind. 1 Tag, der Rest nach Umfang (größter Rest zuerst); zu wenig Tage → mehrere Themen pro Tag
  const n = topics.length;
  let days;
  if (study >= n) {
    const sum = topics.reduce((k, x) => k + x.weight, 0) || 1;
    const extra = study - n;
    const raw = topics.map((x) => (x.weight / sum) * extra);
    days = raw.map((r) => 1 + Math.floor(r));
    let left = study - days.reduce((a, b) => a + b, 0);
    for (const i of raw.map((r, i) => i).sort((i, j) => (raw[j] % 1) - (raw[i] % 1))) { if (!left) break; days[i]++; left--; }
  }
  let at = 0;
  const plan = topics.map((x, i) => {
    if (!days) { const d = Math.floor((i * study) / n); return { ...x, from: d, to: d }; }
    const from = at;
    at += days[i];
    return { ...x, from, to: at - 1 };
  });
  const dayIdx = total - daysUntil(exam.date, now); // heute ab Planstart
  return { plan, total, study, dayIdx, review: total > 1 && dayIdx >= study, examDay: daysUntil(exam.date, now) === 0 };
}

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const dayISO = (start, k) => { const d = new Date(start + 'T12:00'); d.setDate(d.getDate() + k); return iso(d); };

// Themen für heute (bei mehreren Themen pro Tag alle); vor dem Planstart das erste Thema
export function todayTopics(p) {
  if (p.review || p.examDay) return [];
  const k = Math.max(0, p.dayIdx);
  const hit = p.plan.filter((x) => x.from <= k && k <= x.to);
  return hit.length ? hit : p.plan.slice(-1);
}

// „sitzt“ = Frage zuletzt mindestens 2× in Folge richtig
export function mastery(lessonIds, lessons = LESSONS) {
  const st = store.get().quiz;
  const qs = lessons.filter((l) => lessonIds.includes(l.id)).flatMap(lessonMcq);
  const seen = qs.filter((q) => st[q.id]).length;
  const ok = qs.filter((q) => (st[q.id] || {}).st >= 2).length;
  return { n: qs.length, seen, ok, pct: qs.length ? Math.round((ok / qs.length) * 100) : 0 };
}

export const lessonKat = (ids) => 'Lektion: ' + ids.join(',');

// Alles, was Bugün, Kartlar und der Tab brauchen
export function pruefState(now = new Date()) {
  const exam = activeExam(now);
  if (!exam) return null;
  const start = store.pruefStart(exam.key);
  const p = buildPlan(exam, start, now);
  const today = todayTopics(p);
  const all = [...new Set(p.plan.flatMap((x) => x.lessons))];
  const todayIds = [...new Set(today.flatMap((x) => x.lessons))];
  return { exam, start, ...p, today, all, todayIds, todayKat: todayIds.length ? lessonKat(todayIds) : '', allKat: lessonKat(all) };
}

// ───── Ansicht #/sinav ─────
let ctx = null; // { view, $, $$, esc, allOpen, toast }
export function initPruefung(deps) { ctx = deps; }

const dm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const bar = (p) => `<div class="progress"><div style="width:${p}%;background:${p >= 80 ? 'var(--good)' : p >= 40 ? 'var(--warn)' : 'var(--bad)'}"></div></div>`;

export function renderPruefung() {
  const { view, $, $$, esc, allOpen } = ctx;
  const s = pruefState();
  if (!s) { view.innerHTML = `<div class="card"><h2>${t('pr.noneH')}</h2><p class="small muted" style="margin-bottom:0">${t('pr.none')}</p></div>`; return; }
  const { exam } = s;
  const days = daysUntil(exam.date);
  const overall = mastery(s.all);
  const missing = exam.topics.filter((x) => !x.lessons.length).map((x) => x.name);
  const d = store.day();
  const openQ = allOpen().filter((q) => s.todayIds.includes(q.lesson));
  const nextOpen = openQ.find((q) => !store.get().open[q.id]) || openQ[0];
  const reviewDay = dayISO(s.start, s.study);

  const todayCard = s.examDay
    ? `<h2>${t('pr.examToday')}</h2><p class="small muted">${t('pr.examTodaySub')}</p>`
    : s.review
      ? `<h2>${t('pr.reviewH')}</h2><p class="small muted">${t('pr.reviewSub')}</p>
         <div class="grid2"><button class="btn" data-mock>${t('pr.mock')}</button><a class="btn ghost" href="#/test?kat=${encodeURIComponent(s.allKat)}&n=${TOPIC_QUIZ}">${t('pr.allTest')}</a></div>`
      : `<h2 lang="de">${s.today.map((x) => esc(x.name)).join(' + ')}</h2>
         <div class="muted small">${t('pr.todaySub', { p: mastery(s.todayIds).pct })}${d.pruef ? ' · ' + t('pr.doneToday', { r: d.pruef.r, n: d.pruef.n }) : ''}</div>
         <div class="grid2" style="margin-top:10px">
           <a class="btn" href="#/test?kat=${encodeURIComponent(s.todayKat)}&n=${TOPIC_QUIZ}">${t('pr.topicTest', { n: TOPIC_QUIZ })}</a>
           <a class="btn ghost" href="#/oturum/sinav">${t('pr.cards')}</a>
         </div>
         ${nextOpen ? `<a class="btn plain block" style="margin-top:8px" href="#/soru/${encodeURIComponent(nextOpen.id)}">${t('pr.open')}</a>` : ''}`;

  view.innerHTML = `
    <div class="card exam-card${days <= 7 ? ' soon' : ''}">
      <div class="eyebrow">${t('pr.eyebrow')}</div>
      <h2>${t(days === 0 ? 'exam.h.today' : days === 1 ? 'exam.h.tomorrow' : 'exam.h.days', { f: esc(exam.fach), n: days })}</h2>
      <div class="muted small">${dm(exam.date)} · ${t('pr.overall', { p: overall.pct, ok: overall.ok, n: overall.n })}</div>
      ${bar(overall.pct)}
    </div>
    <div class="card">
      <div class="eyebrow">${t('pr.today')}</div>
      ${todayCard}
    </div>
    <div class="section-title">${t('pr.plan')}</div>
    <div class="list">
      ${s.plan.map((x) => {
        const m = mastery(x.lessons);
        const now = s.today.includes(x);
        const past = !now && s.dayIdx > x.to;
        return `<a href="#/test?kat=${encodeURIComponent(lessonKat(x.lessons))}&n=${TOPIC_QUIZ}" class="${now ? 'pr-now' : ''}"><span class="grow"><b lang="de">${esc(x.name)}</b>${now ? ` <span class="badge good">${t('pr.nowBadge')}</span>` : past ? ' <span class="muted small">✓</span>' : ''}
          <div class="muted small">${dm(dayISO(s.start, x.from))}${x.to > x.from ? '–' + dm(dayISO(s.start, x.to)) : ''} · ${t('pr.topicStat', { p: m.pct, n: m.n })}</div>${bar(m.pct)}</span><span class="chev">›</span></a>`;
      }).join('')}
      <button class="row" data-mock style="width:100%;text-align:left"><span class="grow"><b>${t('pr.reviewRow')}</b><div class="muted small">${dm(reviewDay)} · ${t('pr.reviewRowSub')}</div></span><span class="mini">${t('mock.start')}</span></button>
    </div>
    ${missing.length ? `<div class="card small">${t('pr.missing', { list: esc(missing.join(', ')) })}</div>` : ''}
    <a class="btn ghost block" style="margin-top:12px" href="#/test?kat=${encodeURIComponent(s.allKat)}&n=${TOPIC_QUIZ}">${t('pr.allTest')}</a>
    <p class="small muted">${t('pr.howto')}</p>`;
  $$('[data-mock]').forEach((b) => b.addEventListener('click', () => {
    if (store.get().mockRun && !confirm(t('mock.confirmNew'))) return;
    startMock(exam.fach, s.all);
  }));
}
