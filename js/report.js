// Erstellt einen Statusbericht als fertigen Prompt für Claude (zum Kopieren/Teilen).
// Enthält nur Lernfortschritt – niemals den Notion-Token.
import * as store from './store.js';
import { LESSONS } from './lessons.js';
import { MCQ } from './data/questions.js';
import { MUSCLES, BONES, JOINTS } from './data/anatomy.js';
import { fehlerList, odevList, todayPlan, week, upcoming } from './private.js';
import { muscleQuestions, boneQuestions, jointQuestions, ALL_JOINT_DETAIL, exerciseQuestions } from './quizgen.js';
import { todaysWords } from './words.js';
import { t, locale } from './i18n.js';
import './strings.js';

const pct = (r, w) => (r + w ? Math.round((r / (r + w)) * 100) : null);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Gelenkname lesbar: „Art. coxae (Hüftgelenk)“
const jointName = (j) => `${j.la.replace(/^Articulatio\b/, 'Art.').replace(/\s*\(.*\)$/, '')} (${j.de})`;
const JX = [[/^rom/, 'Neutral-Null'], [/^achse/, 'Bewegungsachse'], [/^adl/, 'ADL-Bewegungsausmaß'], [/^haupt/, 'Hauptmuskeln'], [/^nicht-bew/, 'Muskelfunktion'], [/^nicht/, 'Muskelgruppe'], [/^kapsel/, 'Kapselmuster']];

// Frage-ID → { text, fach, answer } – nie die interne ID ausgeben
function questionIndex() {
  const idx = {};
  for (const l of LESSONS) {
    l.mcq.forEach((q, i) => {
      const entry = { text: q.q, fach: l.fach, answer: q.o[0] };
      idx[`L:${l.id}:${i}`] = entry;
      if (q.id) idx[q.id] = entry;
    });
  }
  for (const q of MCQ) idx[q.id] = { text: q.q, fach: 'Klinik/Anatomie', answer: q.o[q.a] };
  // Erzeugte Fragen (Muskeln, Knochen, Gelenke, Gelenkdetails, Übungen): echter Fragetext
  const gen = [...MUSCLES.flatMap(muscleQuestions), ...BONES.flatMap(boneQuestions), ...JOINTS.flatMap(jointQuestions), ...ALL_JOINT_DETAIL(), ...exerciseQuestions()];
  for (const q of gen) idx[q.id] = { text: q.q, fach: q.cat, answer: q.o[q.a] };

  const name = (list, id) => (list.find((x) => x.id === id) || {}).la;
  const kinds = { inn: 'Innervation', ans: 'Ansatz', urs: 'Ursprung', fkt: 'Funktion', rev: 'Ursprung+Ansatz → Muskel' };
  return (id) => {
    if (idx[id]) return idx[id];
    // Rückfall: lesbarer Titel aus der ID (z. B. ältere oder zufällig erzeugte Fragen)
    const m = id.match(/^g:(\w+):(.+)$/);
    if (m) {
      const [, kind, ref] = m;
      if (kind === 'jx') {
        const [jid, k = ''] = ref.split(':');
        const j = JOINTS.find((x) => x.id === jid);
        return { text: `${j ? jointName(j) : 'Gelenk'} – ${(JX.find(([re]) => re.test(k)) || [, 'Gelenkdetail'])[1]}`, fach: 'Gelenke' };
      }
      if (kinds[kind] && name(MUSCLES, ref)) return { text: `${name(MUSCLES, ref)} – ${kinds[kind]}`, fach: 'Muskeln' };
      if (kind.startsWith('j')) { const j = JOINTS.find((x) => x.id === ref); if (j) return { text: `${jointName(j)} – ${kind === 'jnn' ? 'Neutral-Null' : 'Gelenktyp'}`, fach: 'Gelenke' }; }
      if (kind.startsWith('b') && name(BONES, ref)) return { text: `${name(BONES, ref)} – Name`, fach: 'Knochen' };
      if (kind.startsWith('v')) return { text: `Vokabel: ${ref.replace(/^(v|gw|lv):/, '')}`, fach: 'Vokabeln' };
      if (kind.startsWith('ub')) return { text: `Fitnessübung: ${ref.replace(/-/g, ' ')}`, fach: 'Muskeln' };
    }
    return { text: t('rep.missing'), fach: '?', missing: true };
  };
}

const trDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

// Kursname ohne Lehrkraft und Raum: „Trainingslehre (Fr. X, R2)“ → „Trainingslehre“
export const courseName = (k) => String(k || '')
  .replace(/\([^)]*\)/g, '')
  .replace(/(^|\s)(Hr|Fr|Herr|Frau|Prof|Dr|Mr|Mrs|Ms)\.?\s+\p{Lu}[\p{L}-]*/gu, ' ')
  .replace(/\s+(bei|mit|with|by|ile)\s+\p{Lu}[\p{L}-]*/gu, '')
  .replace(/×\s*\d+|·.*$|,.*$|\s\/\s.*$/g, '')
  .replace(/\s*[–—\-/]\s*$/g, '')
  .replace(/\s{2,}/g, ' ').trim();

// details = auch Texte aus Notion (Fehlerkarten, Prüfungs-/Hausaufgabenthemen); standardmäßig aus
export function buildReport({ details = false } = {}) {
  const s = store.get();
  const lookup = questionIndex();
  const today = store.today();
  const d = store.day();
  const since = daysAgo(7);
  const plan = todayPlan();
  const w = week();

  // Test-Treffer der letzten 7 Tage nach Fach
  const byFach = Object.create(null); // Fachnamen kommen auch aus Notion (z. B. „__proto__“)
  const wrongRecent = [];
  for (const [id, q] of Object.entries(s.quiz)) {
    if (!q.last || q.last < since) continue;
    const info = lookup(id);
    if (info.missing) continue; // Frage gibt es nicht mehr – nicht als ID in den Bericht
    const f = (byFach[info.fach] = byFach[info.fach] || { r: 0, w: 0 });
    f.r += q.r; f.w += q.w;
    if (q.w > 0 && q.w >= q.r) wrongRecent.push({ ...info, w: q.w, r: q.r, last: q.last });
  }
  wrongRecent.sort((a, b) => b.w - a.w || b.last.localeCompare(a.last));

  // Aktivität: seit dem ersten Nutzungstag, erst ab Tag 8 zusätzlich die letzten 7 Tage
  const start = store.startDate();
  const dayN = store.dayNumber();
  const sinceStart = [...Array(dayN)].map((_, i) => daysAgo(dayN - 1 - i));
  const activeSinceStart = sinceStart.filter((date) => store.isActive(s.days[date])).length;
  const last7 = [...Array(7)].map((_, i) => daysAgo(6 - i)).map((date) => ({ date, ...(s.days[date] || {}) }));
  const activeDays = last7.filter((x) => store.isActive(x)).length;
  const weekQuiz = last7.reduce((a, x) => ({ r: a.r + (x.quizRight || 0), n: a.n + (x.quiz || 0) }), { r: 0, n: 0 });

  // Fehlerkarten: noch offen bzw. oft vergessen
  const fehler = fehlerList();
  const fehlerOpen = fehler.filter((f) => !s.srs[f.id] || s.srs[f.id].due <= today);
  const fehlerHard = fehler.filter((f) => s.srs[f.id] && s.srs[f.id].lapses >= 2);
  const odev = odevList();

  // Karten heute: neue (heute zum ersten Mal gesehen) und echte Wiederholungen getrennt
  const newToday = Object.values(s.srs).filter((c) => c.first === today);
  const newRatings = newToday.reduce((n, c) => n + (c.reps || 0), 0);
  const reviewRatings = Math.max(0, (d.cards || 0) - newRatings);
  const newSeen = newToday.filter((c) => c.reps > 0).length;

  // Offene Fragen mit schwacher Selbsteinschätzung
  const openWeak = Object.entries(s.open).filter(([, v]) => v.score < 0.5).length;

  const lines = [];
  lines.push(t('rep.hello', { date: new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }) }));
  lines.push(t('rep.context', { start: trDate(start), n: dayN }) + (dayN <= 14 ? t('rep.contextEarly') : ''));
  lines.push('');
  lines.push(t('rep.streak', { s: store.streak(), start: trDate(start), n: dayN, a: activeSinceStart }) + (dayN > 7 ? t('rep.last7', { a: activeDays }) : ''));
  lines.push(t('rep.weekQuiz', { n: weekQuiz.n, p: weekQuiz.n ? t('rep.pctRight', { p: Math.round((weekQuiz.r / weekQuiz.n) * 100) }) : '–' }));
  lines.push(t('rep.cards', { l: Object.values(s.srs).filter((c) => c.int >= 1).length, r: reviewRatings, nw: newSeen }) + (d.cards ? t('rep.cardsTotal', { n: d.cards }) : ''));
  lines.push(t('rep.today', { q: d.quiz || 0, r: d.quizRight || 0, o: d.open || 0 }) + (d.morning ? t('rep.morningDone') : '') + (d.lesson ? t('rep.muscleDone') : ''));
  const tw = todaysWords();
  if (tw.length) {
    const wr = d.wordRes || {};
    const fmt = (x) => (x ? `${x.r}/${x.n}` : t('rep.notDone'));
    lines.push(t('rep.words', { m: fmt(d.wordsMorning), d: fmt(d.wordsReturn), list: tw.map((x) => `${x.de}${wr[x.id] === 'close' ? ' ½' : wr[x.id] === false ? ' ✗' : wr[x.id] ? ' ✓' : ''}`).join(', ') }));
  }
  // Prüfungen & Hausaufgaben (Notion „Sınav & Ödev Takibi“) + letzte Probeklausuren
  const exams = upcoming('Sınav', 60);
  const hw = upcoming('Ödev', 14);
  const when = (e) => `${trDate(e.date).slice(0, 6)}, ${e.days === 0 ? t('rep.today0') : e.days === 1 ? t('rep.tomorrow') : t('rep.inDays', { n: e.days })}`;
  if (exams.length) lines.push(t('rep.exams', { x: exams.map((e) => `${e.fach || t('exam.default')}${details && e.topic ? ' (' + e.topic + ')' : ''} – ${when(e)}`).join(' · ') }));
  if (hw.length) lines.push(t('rep.hw', { x: hw.map((e) => `${e.fach ? e.fach + ': ' : ''}${(details && e.topic) || t('hw.default')} – ${when(e)}`).join(' · ') }));
  const mocks = (s.mocks || []).filter((m) => m.date >= daysAgo(14));
  if (mocks.length) {
    lines.push(t('rep.mocks', { x: mocks.slice(-4).map((m) => `${m.fach} ${t('pct', { p: m.pct })} (${trDate(m.date).slice(0, 6)})`).join(' · ') }));
    const last = mocks[mocks.length - 1];
    const weakT = Object.entries(last.topics).filter(([, v]) => v.n && v.r / v.n < 0.6).sort(([, a], [, b]) => a.r / a.n - b.r / b.n).slice(0, 3).map(([tp, v]) => `${tp} ${t('pct', { p: Math.round((v.r / v.n) * 100) })}`);
    if (weakT.length) lines.push(t('rep.mockWeak', { f: last.fach, x: weakT.join(', ') }));
  }
  if (w) lines.push(t('rep.plan', { kw: w.kw }) + (plan && plan.kurse.length ? t('rep.planToday', { x: [...new Set(plan.kurse.map(courseName).filter(Boolean))].join(' / ') }) : '') + (plan && plan.test.length ? t('rep.planMorning', { x: plan.test.join(' + ') }) : ''));

  const fachRows = Object.entries(byFach).map(([f, v]) => [f, pct(v.r, v.w), v.r + v.w]).filter((x) => x[2] >= 2).sort((a, b) => a[1] - b[1]);
  if (fachRows.length) {
    lines.push('');
    lines.push(t('rep.byFach'));
    fachRows.forEach(([f, p, n]) => lines.push(t('rep.fachRow', { f, p, n })));
  }

  if (wrongRecent.length) {
    lines.push('');
    lines.push(t('rep.wrong'));
    wrongRecent.slice(0, 8).forEach((q) => lines.push(`- [${q.fach}] ${q.text}${q.answer ? t('rep.correct', { a: q.answer }) : ''}${t('rep.wrongN', { n: q.w })}`));
  }

  if (fehler.length) {
    lines.push('');
    lines.push(t('rep.fehler', { n: fehler.length, o: fehlerOpen.length }));
    if (fehlerHard.length) {
      lines.push(t('rep.stillForget'));
      if (details) fehlerHard.slice(0, 5).forEach((f) => lines.push(`- [${f.fach}] ${f.q}`));
      else lines.push(t('rep.hardCount', { n: fehlerHard.length, f: [...new Set(fehlerHard.map((f) => f.fach).filter(Boolean))].join(', ') }));
    }
  }
  if (odev.length) {
    // Hausaufgaben zum Auswendiglernen – bewusst getrennt von der Fehlerliste
    lines.push('');
    lines.push(t('rep.odev'));
    [...new Set(odev.map((f) => f.odev))].forEach((ot, k) => {
      const cs = odev.filter((f) => f.odev === ot);
      const learned = cs.filter((f) => s.srs[f.id] && s.srs[f.id].int >= 1).length;
      const unseen = cs.filter((f) => !s.srs[f.id] || !s.srs[f.id].reps).length;
      lines.push(t('rep.odevRow', { t: details ? ot : t('rep.odevN', { n: k + 1 }), n: cs.length, l: learned, w: cs.length - learned - unseen, u: unseen }));
    });
  }
  if (openWeak) lines.push(t('rep.openWeak', { n: openWeak }));

  lines.push('');
  lines.push(t('rep.ask'));
  lines.push(t('rep.ask1'));
  lines.push(t('rep.ask2'));
  lines.push(t('rep.ask3'));
  const examSoon = exams.length && exams[0].days <= 7;
  if (examSoon) lines.push(t('rep.ask4exam', { f: exams[0].fach || t('exam.default'), n: exams[0].days }));
  lines.push(t('rep.askNotion', { k: examSoon ? 5 : 4 }));
  return lines.join('\n');
}

// Bildschirm „Claude'a rapor“: Bericht anzeigen, kopieren oder über das iOS-Teilen-Menü senden
export function renderReport(view, toast) {
  let text = buildReport();
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">${t('rep.intro')}</p>
    <label class="row small" style="gap:8px;padding:0 4px;margin:6px 0"><input type="checkbox" id="repDetails"> ${t('rep.details')}</label>
    <textarea id="reportText" readonly aria-label="${t('rep.textLabel')}" style="min-height:360px;font-size:14px">${esc(text)}</textarea>
    <div class="grid2" style="margin-top:10px">
      <button class="btn" id="copyReport">${t('rep.copy')}</button>
      <button class="btn ghost" id="shareReport">${t('rep.share')}</button>
    </div>`;
  view.querySelector('#repDetails').addEventListener('change', (e) => {
    text = buildReport({ details: e.target.checked });
    view.querySelector('#reportText').value = text;
  });
  view.querySelector('#copyReport').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('rep.copied'));
    } catch {
      const ta = view.querySelector('#reportText');
      ta.focus(); ta.select();
      toast(t('rep.selected'));
    }
  });
  const share = view.querySelector('#shareReport');
  if (!navigator.share) share.disabled = true;
  share.addEventListener('click', () => navigator.share({ text }).catch(() => {}));
}
