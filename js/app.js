import * as store from './store.js';
import { t, tx, lang, setLang, flag, locale, LANGS } from './i18n.js';
import './strings.js';
import { MUSCLES, BONES, JOINTS, ALL_STRUCTURES, findStructure } from './data/anatomy.js';
import { GRUNDWORTSCHATZ, BASE_VOCAB } from './data/vocab.js';
import { OPEN } from './data/questions.js';
import { LESSONS, FAECHER, refreshLessons } from './lessons.js';
import { cleanSegments, cleanText, cardFront } from './private.js';
import { NOTION_URL, getPrivate, setPrivate, clearPrivate, loadLocalDevFile, fehlerList, odevList, notionLink, week, todayPlan, tomorrowPlan, upcoming, examFaecher, donusStart, HHMM } from './private.js';
import { getToken, setToken, clearToken, looksLikeToken, syncFromNotion } from './notion.js';
import { renderReport } from './report.js';
import { containsFuzzy } from './fuzzy.js';
import { LANDMARKS, findLandmark, shortLa } from './data/landmarks.js';
import { axesOf } from './data/axes.js';
import { todaysWords, weekWords, markKnown, recordWord, questionFor, checkTyped, typeLabel, WORDS_PER_DAY } from './words.js';
import * as M3 from './data/muscle3d.js';
import { UEBUNGEN } from './data/uebungen.js';
import { masteredLessons, vocabTr } from './quizgen.js';
import { initExam, renderMock } from './exam.js';
import { initOral, renderOral, leaveOral } from './oral.js';
import { initBefund, renderCases } from './befund.js';
import { renderChecklist, ckFaecher, hasChecklist, summary as ckSummary } from './checkliste.js';
import { sayBtn } from './speech.js';
import { reverseCards, findReverse, partsRating } from './reverse.js';
import { buildQuiz, quizCategories, lessonMcq, muscleQuestions, boneQuestions, jointQuestions, jointDetailQuestions, prepare, shuffle, weakTopics, muscleLevel, romUnlocked, weight, wpick, kursFaecher } from './quizgen.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Text escapen und Lücken „＿＿＿“ als nicht umbrechendes Kästchen darstellen
const escGap = (s) => esc(s).replace(/\s*＿+\s*/g, (m) => `${/^\s/.test(m) ? ' ' : ''}<span class="gap" aria-label="${t('aria.gap')}"></span>${/\s$/.test(m) ? ' ' : ''}`);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

const kindLabel = (k) => t('kind.' + k);
const { partText } = M3;
// Schicht-Namen (Yüzeysel / Superficial …); LAYER_NAMES_EN kommt evtl. erst später in die Daten
const layerName = (n) => ((lang() === 'en' && M3.LAYER_NAMES_EN) || M3.LAYER_NAMES)[n] || '';
// Kartenintervall „1dk / 10dk / 4g / 2,5ay“ (store.js) in der Hilfssprache
// Flagge der tatsächlich angezeigten Hilfssprache: fehlt die englische Fassung, ist der Text unbekannter Sprache → 🌐
const flagFor = (obj, field = 'tr') => (lang() === 'en' && obj && !obj[field === 'tr' ? 'en' : field === 'ftr' ? 'fen' : field + 'En'] ? '🌐' : flag());
const ivlLabel = (s) => (lang() === 'en' ? String(s).replace(/dk$/, 'm').replace(/ay$/, 'mo').replace(/yıl$/, 'y').replace(/g$/, 'd').replace(',', '.') : s);
// Zahl mit Dezimalkomma (TR) bzw. -punkt (EN)
const dec = (x) => (lang() === 'en' ? String(x) : String(x).replace('.', ','));
// Struktur oder Knochenpunkt
const findAny = (id) => findStructure(id) || (findLandmark(id) ? { ...findLandmark(id), kind: 'landmark' } : null);
const shortName = (s) => (s.kind === 'landmark' ? shortLa(s) : s.la.replace(/\s*\(.*\)$/, ''));
// Grundwortschatz: live aus Notion, falls synchronisiert – sonst die mitgelieferte Kopie
const gwWords = () => (getPrivate() && getPrivate().gw && getPrivate().gw.length ? getPrivate().gw : GRUNDWORTSCHATZ);
const allVocab = () => [...gwWords(), ...BASE_VOCAB, ...store.get().customVocab];
const vocabCategories = () => [...new Set([...gwWords(), ...BASE_VOCAB].map((v) => v.cat))];

// Offene Fragen: zuerst die aus den Notion-Ders-Notları, dann die allgemeinen
const allOpen = () => [
  ...LESSONS.flatMap((l) => l.open.map((q, i) => ({ id: q.id || `LO:${l.id}:${i}`, cat: l.fach, lesson: l.id, q: q.q, a: q.a, kw: q.kw }))),
  ...OPEN,
];
const lessonVocab = (filter) => LESSONS.filter(filter).flatMap((l) => l.vocab.map((v) => ({ ...v, id: 'lv:' + v.de, cat: l.fach })));

// ───────────────────────── Tagesauswahl ─────────────────────────
function hashDate(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

function dailyPick(list, key) {
  const d = store.day();
  if (d[key] && list.some((x) => x.id === d[key])) return list.find((x) => x.id === d[key]);
  const learned = store.get().learned;
  const fresh = list.filter((x) => !learned[x.id]);
  let pickItem;
  if (fresh.length) pickItem = fresh[hashDate(store.today() + key) % Math.min(fresh.length, 5)];
  else pickItem = [...list].sort((a, b) => learned[a.id].localeCompare(learned[b.id]))[0];
  d[key] = pickItem.id;
  store.save();
  return pickItem;
}
const muscleOfDay = () => dailyPick(MUSCLES, 'muscleId');
const structureOfDay = () => dailyPick([...BONES.map((b) => ({ ...b, kind: 'bone' })), ...JOINTS.map((j) => ({ ...j, kind: 'joint' }))], 'boneId');

// ───────────────────────── Karteikarten-Decks ─────────────────────────
// Ters kart → Karteikarte; parts = Muskeln, die man einzeln abhakt („2/3 gewusst“)
function revCard(c, tag = '⇄ ' + t('rev.kind.' + c.kind)) {
  return {
    id: c.id, tag, front: c.q, frontSub: t('rev.hint', { n: c.parts.length }), parts: c.parts,
    back: `<div class="detail"><b>${esc(c.name)}</b><ol class="rv-list">${c.parts.map((p) => `<li><b>${esc(p.la)}</b> <span class="muted">– ${esc(p.seg)}</span></li>`).join('')}</ol><div class="muted small">${t('rev.scope')}</div></div>`,
  };
}
// nicht ganz gewusste Ters kartlar (✗-Liste), falls es die Karte noch gibt
const revWrong = () => Object.keys(store.get().revx).map(findReverse).filter(Boolean);

function deckCards(deck) {
  const rev = store.get().settings.reverse;
  if (deck.startsWith('vocab')) {
    const cat = deck.split(':')[1];
    return allVocab().filter((v) => !cat || v.cat === cat).map((v) => ({
      id: v.id,
      tag: v.cat, de: v.de,
      front: rev ? vocabTr(v) : v.de,
      back: `<div class="big">${esc(rev ? v.de : vocabTr(v))}</div>${v.ex ? `<div class="sub">„${esc(v.ex)}“</div>` : ''}`,
    }));
  }
  if (deck === 'fehler' || deck.startsWith('fehler:') || deck === 'odev') {
    const only = deck.startsWith('fehler:') ? deck.slice(7).split(',').filter(Boolean) : null;
    // Hausaufgaben („Ezber kartları“ in Notion) sind eigene Karten, keine Fehler
    const notion = (deck === 'odev' ? odevList() : fehlerList()).filter((f) => !only || only.includes(f.fach)).map((f) => ({
      id: f.id, tag: f.odev ? '📌 ' + f.odev : '✗ ' + f.fach, front: f.seg ? cardFront(f.seg) : cleanText(f.q),
      // Aus Notion: Lückentext-Segmente (fett = Antwort); aus Datei: Frage/Antwort/Türkçe
      back: f.seg
        ? `<div class="detail" style="font-size:15px">${cleanSegments(f.seg).map((x) => (x.b ? `<b style="color:var(--accent)">${esc(x.t)}</b>` : esc(x.t))).join('')}</div>`
        : `<div class="detail" style="font-size:15px"><b>${esc(f.a)}</b><br><br><span class="muted">${flag()} ${esc(f.tr)}</span></div>`,
    }));
    // nicht ganz gewusste Ters kartlar gehören zum Fach Anatomie
    const rev = deck === 'odev' || (only && !only.includes('Anatomie')) ? [] : revWrong().map((c) => revCard(c, '✗ ' + t('rev.tag')));
    return [...notion, ...rev];
  }
  if (deck === 'ters' || deck.startsWith('ters:')) {
    const kind = deck.slice(5);
    return reverseCards().filter((c) => !kind || c.kind === kind).map((c) => revCard(c));
  }
  if (deck.startsWith('ders:')) {
    const fach = deck.slice(5);
    const seen = new Set();
    return lessonVocab((l) => l.fach === fach).filter((v) => !seen.has(v.id) && seen.add(v.id)).map((v) => ({
      id: v.id, tag: fach, de: v.de,
      front: rev ? vocabTr(v) : v.de,
      back: `<div class="big">${esc(rev ? v.de : vocabTr(v))}</div>${v.ex ? `<div class="sub">„${esc(v.ex)}“</div>` : ''}`,
    }));
  }
  if (deck === 'muscles') {
    return MUSCLES.map((m) => ({
      id: 'm:' + m.id, tag: kindLabel('muscle'), front: m.la, frontSub: m.de,
      back: `<div class="detail"><b>${esc(m.la)}</b> · ${esc(tx(m))}<br><br><b>Ursprung:</b> ${esc(m.o)}<br><b>Ansatz:</b> ${esc(m.i)}<br><b>Innervation:</b> ${esc(m.inn)}<br><b>Funktion:</b> ${esc(m.f)}${UEBUNGEN[m.id] ? `<br><br>💪 <b>Übung:</b> ${UEBUNGEN[m.id].map((u) => `${esc(u.n)} <span class="muted">(${esc(tx(u))})</span>`).join(', ')}` : ''}</div>`,
    }));
  }
  if (deck === 'bones') {
    return BONES.map((b) => ({
      id: 'b:' + b.id, tag: kindLabel('bone'), front: b.de, frontSub: rev ? tx(b) : '',
      back: `<div class="big">${esc(b.la)}</div><div class="sub">${esc(tx(b))}</div><div class="detail" style="margin-top:12px">${esc(b.merk)}</div>`,
    }));
  }
  if (deck === 'joints') {
    return JOINTS.map((j) => ({
      id: 'j:' + j.id, tag: kindLabel('joint'), front: j.de, frontSub: j.la,
      back: `<div class="detail"><b>${esc(tx(j))}</b><br><br><b>Gelenktyp:</b> ${esc(j.typ)}<br><b>Neutral-Null:</b> ${esc(j.nn)}<br><b>Bänder:</b> ${esc(j.baender)}</div>`,
    }));
  }
  return [];
}

const DECKS = () => [
  ...(odevList().length ? [{ id: 'odev', name: t('deck.odev'), sub: t('deck.odevSub', { list: [...new Set(odevList().map((f) => f.odev))].join(', ') }) }] : []),
  ...(fehlerList().length || revWrong().length ? [{ id: 'fehler', name: t('deck.fehler'), sub: t(fehlerList().length ? 'deck.fehlerSub' : 'deck.fehlerSubRev') }] : []),
  ...FAECHER.map((f) => ({ id: 'ders:' + f, name: t('deck.ders', { f }), sub: t('deck.dersSub') })),
  { id: 'vocab', name: t('deck.allWords'), sub: t('n.words', { n: allVocab().length }) },
  ...vocabCategories().map((c) => ({ id: 'vocab:' + c, name: c, sub: t('deck.words') })),
  ...(store.get().customVocab.length ? [{ id: 'vocab:Eigene', name: t('deck.own'), sub: t('n.words', { n: store.get().customVocab.length }) }] : []),
  { id: 'muscles', name: t('deck.muscles'), sub: 'Ursprung · Ansatz · Innervation · Funktion' },
  { id: 'ters', name: t('deck.ters'), sub: t('deck.tersSub') },
  { id: 'ters:o', name: t('deck.ters') + ' · Ursprung', sub: t('deck.tersO') },
  { id: 'ters:i', name: t('deck.ters') + ' · Ansatz', sub: t('deck.tersI') },
  { id: 'ters:n', name: t('deck.ters') + ' · Innervation', sub: t('deck.tersN') },
  { id: 'bones', name: t('deck.bones'), sub: t('deck.bonesSub') },
  { id: 'joints', name: t('deck.joints'), sub: 'Gelenktyp · Neutral-Null' },
];

// ───────────────────────── Router ─────────────────────────
let viewer = null; // Anatomy3D-Instanz (lazy)
let current = '';

initExam({ view, $, $$, esc, escGap, toast, allOpen });
initOral({ view, $, $$, esc, toast, allOpen });
initBefund({ view, $, $$, esc, toast, btn3d });
// 🔊-Knopf für deutsche/lateinische Aussprache
const say = (t) => sayBtn(t, esc);

const routes = {
  bugun: { title: 'route.bugun', tab: 'bugun', render: renderToday },
  test: { title: 'route.test', tab: 'test', render: renderQuizStart },
  sorular: { title: 'route.sorular', tab: 'sorular', render: renderOpenList },
  soru: { title: 'route.soru', tab: 'sorular', render: renderOpenQuestion, back: '#/sorular' },
  kartlar: { title: 'route.kartlar', tab: 'kartlar', render: renderDecks },
  oturum: { title: 'route.kartlar', tab: 'kartlar', render: renderCardSession, back: '#/kartlar' },
  liste: { title: 'route.liste', tab: 'kartlar', render: renderWordList, back: '#/kartlar' },
  '3d': { title: 'route.3d', tab: '3d', render: render3D },
  ders: { title: 'route.ders', tab: 'bugun', render: renderLesson, back: 'history' },
  dersler: { title: 'route.dersler', tab: 'bugun', render: renderLessonList, back: '#/bugun' },
  not: { title: 'route.not', tab: 'bugun', render: renderLessonNote, back: '#/dersler' },
  ck: { title: 'route.ck', tab: 'bugun', render: ([fach]) => renderChecklist(view, fach, { toast }), back: 'history' },
  ayarlar: { title: 'route.ayarlar', tab: null, render: renderSettings, back: '#/bugun' },
  rapor: { title: 'route.rapor', tab: 'bugun', render: () => renderReport(view, toast), back: '#/bugun' },
  kelime: { title: 'route.kelime', tab: 'bugun', render: renderWordSession, back: '#/bugun' },
  donus: { title: 'route.donus', tab: 'bugun', render: renderDonus, back: '#/bugun' },
  oku: { title: 'route.oku', tab: 'bugun', render: renderReading, back: '#/donus' },
  cumartesi: { title: 'route.cumartesi', tab: 'bugun', render: renderSaturday, back: '#/bugun' },
  deneme: { title: 'route.deneme', tab: 'test', render: renderMock, back: '#/test' },
  vaka: { title: 'route.vaka', tab: 'test', render: renderCases, back: 'history' },
  sozlu: { title: 'route.sozlu', tab: 'sorular', render: renderOral, back: '#/sorular' },
};

function navigate() {
  const hash = location.hash.replace(/^#\/?/, '') || 'bugun';
  const [path, query] = hash.split('?');
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  const [name, ...args] = path.split('/').map(dec);
  const r = routes[name] || routes.bugun;
  const params = new URLSearchParams(query || '');
  current = name;
  if (name !== 'sozlu') leaveOral();

  $('#title').textContent = t(r.title);
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
  const back = $('#backBtn');
  // 3D-Ansicht aus einer Frage/Lektion geöffnet (#/3d?ids=…): Zurück führt dorthin (z. B. zur laufenden Testfrage)
  const backTo = name === '3d' && (params.get('ids') || params.get('id')) && history.length > 1 ? 'history' : r.back;
  back.hidden = !backTo;
  back.onclick = () => (backTo === 'history' ? history.back() : (location.hash = backTo));
  $('#settingsBtn').hidden = name !== 'bugun';

  const is3d = name === '3d';
  $('#view3d').hidden = !is3d;
  view.hidden = is3d;
  if (!is3d && viewer) viewer.stop();

  view.scrollTop = 0;
  r.render(args, params);
}

// Nicht in fremden Seiten einbetten lassen (Clickjacking) – vor allem anderen
if (window.top !== window.self) { document.body.textContent = ''; throw new Error('framed'); }
window.addEventListener('hashchange', navigate);
store.onSaveError(() => toast(t('set.storageFull')));
// „Zurück“-Knöpfe ohne Inline-Handler (die CSP erlaubt keine onclick-Attribute)
document.addEventListener('click', (e) => { if (e.target.closest('[data-back]')) history.back(); });

// ───────────────────────── Heute ─────────────────────────
function renderToday() {
  const s = store.get();
  const d = store.day();
  const m = muscleOfDay();
  const b = structureOfDay();
  const vocabCards = deckCards('vocab');
  const due = store.dueCount(vocabCards) + ['muscles', 'ters', 'bones', 'joints'].reduce((n, k) => n + store.dueCount(deckCards(k)), 0);

  const plan = todayPlan();
  const fehlerCards = deckCards('fehler');
  // höchstens 20 Fehlerkarten pro Tag (wie in der Kartensitzung)
  const fehlerOpen = Math.min(fehlerCards.filter((c) => store.isNew(c.id) || store.isDue(c.id)).length, Math.max(0, FEHLER_PER_DAY - (d.fehlerSeen || []).length));
  const odevOpen = deckCards('odev').filter((c) => store.isNew(c.id) || store.isDue(c.id)).length;
  const tasks = [
    ...(deckCards('odev').length ? [{ done: !odevOpen, label: `${t('task.odev', { list: esc([...new Set(odevList().map((f) => f.odev))].join(', ')) })} <span class="muted">(${t('n.cards', { n: odevOpen })})</span>`, href: '#/oturum/odev' }] : []),
    // Knochenpunkte gehören zur Hausaufgabe (PT Befund) – am 3D-Modell zeigen
    ...(deckCards('odev').length ? [{ done: !!d.lmQuiz, label: `${t('task.lmQuiz')} ${d.lmQuiz ? `<span class="muted">${d.lmQuiz.r}/${d.lmQuiz.n}</span>` : `<span class="muted">${t('task.lmQuizSub')}</span>`}`, href: '#/3d?quiz=pelvis' }] : []),
    // erledigte Aufgabe bleibt (abgehakt) stehen, statt zu verschwinden
    ...(fehlerOpen || (d.fehlerSeen || []).length ? [{ done: !fehlerOpen, label: `${t('task.fehler')} <span class="muted">(${t('n.cards', { n: fehlerOpen })})</span>`, href: '#/oturum/fehler' }] : []),
    // Morgentest: Fächer aus dem Wochenplan + Fächer mit Prüfung in ≤ 7 Tagen (📝)
    ...(morningKat()
      ? [{ done: !!d.morning, label: t('task.morning', { list: esc(morningFaecher().map((f) => (examFaecher(7).includes(f) ? '📝 ' + f : f)).join(' + ')) }), href: `#/test?kat=${encodeURIComponent(morningKat())}` }] : []),
    { done: !!d.wordsMorning, label: `${t('task.wordsMorning', { n: WORDS_PER_DAY })}${d.wordsMorning ? ` <span class="muted">${d.wordsMorning.r}/${d.wordsMorning.n}</span>` : ''}`, href: '#/kelime/sabah' },
    { done: !!d.wordsReturn, label: `${t('task.wordsReturn', { n: WORDS_PER_DAY })}${d.wordsReturn ? ` <span class="muted">${d.wordsReturn.r}/${d.wordsReturn.n}</span>` : ''}`, href: '#/kelime/donus' },
    { done: d.lesson, label: t('task.muscle', { name: esc(m.la) }), href: `#/ders/${m.id}` },
    { done: d.lesson2, label: t(b.kind === 'bone' ? 'task.bone' : 'task.joint', { name: esc(b.de) }), href: `#/ders/${b.id}` },
    { done: d.cards >= s.settings.cardsGoal, label: `${t('task.cards', { n: s.settings.cardsGoal })} <span class="muted">(${d.cards}/${s.settings.cardsGoal})</span>`, href: '#/oturum/vocab' },
    // fertiger Morgentest zählt auch für das Tagesziel (er hat so viele Fragen wie das Ziel, außer das Fach hat weniger)
    { done: d.quiz >= s.settings.quizGoal || !!d.morning, label: `${t('task.quiz', { n: s.settings.quizGoal })} <span class="muted">(${d.quiz}/${s.settings.quizGoal})</span>`, href: '#/test' },
    { done: d.open >= 1, label: t('task.open'), href: `#/soru/${encodeURIComponent(nextOpenQuestion().id)}` },
  ];
  const doneN = tasks.filter((t) => t.done).length;
  const pct = doneN / tasks.length;
  const C = 2 * Math.PI * 26;
  const streak = store.streak();
  const dateStr = new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  const totalQ = Object.values(s.quiz).reduce((a, q) => ({ r: a.r + q.r, w: a.w + q.w }), { r: 0, w: 0 });
  const acc = totalQ.r + totalQ.w ? Math.round((totalQ.r / (totalQ.r + totalQ.w)) * 100) : null;
  const weak = weakTopics(3);

  view.innerHTML = `
    ${isIOS && !standalone ? `<div class="card install small">${t('install')}</div>` : ''}
    <div class="card">
      <div class="hero">
        <svg class="ring" viewBox="0 0 64 64">
          <circle class="bg" cx="32" cy="32" r="26"/>
          <circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
          <text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${doneN}/${tasks.length}</text>
        </svg>
        <div>
          <div class="muted small">${esc(dateStr)}</div>
          <h2>${doneN === tasks.length ? t('today.allDone') : t('today.hello')}</h2>
          <div class="streak">${streak > 0 ? t('today.streak', { n: streak }) : t('today.firstStep')}</div>
        </div>
      </div>
    </div>

    ${examCard()}

    ${plan ? `<div class="card">
      <div class="eyebrow">${t('today.lessons', { kw: week().kw })}</div>
      ${plan.kurse.length ? plan.kurse.map((k) => `<div class="small">📚 ${esc(k)}</div>`).join('') : `<div class="small muted">${t('today.noLessons')}</div>`}
      ${plan.note ? `<p class="small muted" style="margin-bottom:0">📝 ${esc(plan.note)}</p>` : ''}
      ${tomorrowLine()}
    </div>` : tomorrowLine() ? `<div class="card small">${tomorrowLine()}</div>` : ''}

    <div class="list">
      ${tasks.map((t) => `<a class="task" href="${t.href}"><span class="check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</span><span class="grow">${t.label}</span><span class="chev">›</span></a>`).join('')}
    </div>

    ${weak.length ? `<div class="section-title">${t('today.weak')}</div>
    <div class="list">
      ${weak.map((w) => `<a href="${w.topic === 'Knochenpunkte' ? '#/3d?quiz=pelvis' : `#/test?kat=${encodeURIComponent(w.topic)}`}"><span class="grow">${esc(topicLabel(w.topic))}<div class="muted small">${t('today.weakStat', { p: Math.round(w.acc * 100), n: w.total })}</div></span><span class="mini">${t('today.testIt')}</span></a>`).join('')}
    </div>` : ''}

    ${ckFaecher().map((f) => { const c = ckSummary(f); return `<a class="card row" href="#/ck/${encodeURIComponent(f)}" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">${t('ck.eyebrow')}</div><h2 lang="de">${esc(f)}</h2><div class="muted small">${t('ck.doneOf', { a: c.done, b: c.total })} · 😊 ${c.good} · 😕/😵 ${c.weak}</div></span><span class="chev">›</span></a>`; }).join('')}

    ${LESSONS.length ? `<a class="card row" href="#/dersler" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">${t('today.fromNotion')}</div><h2>${t('today.lessonNotes')}</h2><div class="muted small">${t('today.lessonNotesSub', { n: LESSONS.length })}</div></span><span class="chev">›</span></a>` : ''}

    <div class="card">
      <div class="eyebrow">${t('today.muscleOfDay')}</div>
      <h2>${esc(m.la)}</h2>
      <div class="muted">${esc(m.de)} · ${esc(tx(m))}</div>
      <p class="small">${esc(tx(m, 'ftr'))}</p>
      <div class="grid2">
        <a class="btn" href="#/ders/${m.id}">${t('btn.openLesson')}</a>
        <a class="btn ghost" href="#/3d?id=${m.id}">${t('btn.show3d')}</a>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow">${t(b.kind === 'bone' ? 'today.boneOfDay' : 'today.jointOfDay')}</div>
      <h2>${esc(b.de)}</h2>
      <div class="muted">${esc(b.la)} · ${esc(tx(b))}</div>
      <p class="small">${esc(b.typ)}</p>
      <div class="grid2">
        <a class="btn" href="#/ders/${b.id}">${t('btn.openLesson')}</a>
        <a class="btn ghost" href="#/3d?id=${b.id}">${t('btn.show3d')}</a>
      </div>
    </div>

    ${[6, 0].includes(new Date().getDay()) ? `<a class="card row" href="#/cumartesi" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">${t('today.weekly')}</div><h2>${t('today.weeklyH')}</h2><div class="muted small">${t('today.weeklySub')}</div></span><span class="chev">›</span></a>` : ''}
    ${(() => {
      // Rückweg ab Unterrichtsende (Wochenplan bzw. Einstellung) + eingestellte Minuten; an Tagen ohne Unterricht nicht
      const now = new Date();
      const from = donusStart(todayPlan(now), s.settings, now);
      if (from === null || now.getHours() * 60 + now.getMinutes() < from) return '';
      const { steps, total } = donusInfo();
      const left = steps.filter((x) => x.state === 'open').length;
      return `<a class="card row" href="#/donus" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">${t('today.donus')}</div><h2>${left ? t('today.donusLeft', { n: left, min: total }) : t('today.donusDone')}</h2><div class="muted small">${t('today.donusSub')}</div></span><span class="chev">›</span></a>`;
    })()}

    <a class="card row" href="#/rapor" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">${t('today.claude')}</div><h2>${t('today.report')}</h2><div class="muted small">${t('today.reportSub')}</div></span><span class="chev">›</span></a>

    <div class="section-title">${t('today.stats')}</div>
    <div class="grid2">
      <div class="card" style="margin:0"><div class="muted small">${t('stat.due')}</div><h2>${due}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">${t('stat.acc')}</div><h2>${acc === null ? '–' : acc + '%'}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">${t('stat.learned')}</div><h2>${Object.keys(s.learned).length}/${ALL_STRUCTURES.length}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">${t('stat.cards')}</div><h2>${Object.values(s.srs).filter((c) => c.int >= 1).length}</h2></div>
    </div>
  `;
}

// „Yarın: Physiologie + AM“ – Kursnamen ohne Lehrer/Raum
function tomorrowLine() {
  const tp = tomorrowPlan();
  if (!tp) return '';
  const names = [...new Set((tp.kurse || []).flatMap((k) => k.replace(/\([^)]*\)/g, '').split(/\s*\+\s*/)).map((k) => k.replace(/×\s*\d+|·.*$|,.*$/g, '').trim()).filter(Boolean))];
  return `<div class="small muted" style="margin-top:6px">${t('tomorrow', { x: names.length ? esc(names.join(' + ')) : t('tomorrow.none') })}</div>`;
}

// Morgentest-Fächer: Prüfung bald zuerst, dann die Fächer aus dem Wochenplan (nur Fächer mit Fragen)
function morningFaecher(plan = todayPlan()) {
  return [...new Set([...examFaecher(7), ...((plan && plan.test) || [])])].filter((f) => FAECHER.includes(f));
}
const morningKat = () => (morningFaecher().length ? 'Ders: ' + morningFaecher().join(',') : '');

// Countdown „📝 PT Befund sınavına 5 gün“ + Hausaufgaben der nächsten 7 Tage
function examCard() {
  const ex = upcoming('Sınav', 30).slice(0, 3);
  const hw = upcoming('Ödev', 7).slice(0, 3);
  if (!ex.length && !hw.length) return '';
  const when = (e) => (e.days === 0 ? t('when.today') : e.days === 1 ? t('when.tomorrow') : t('when.days', { n: e.days }));
  const soon = ex.some((e) => e.days <= 7);
  return `<div class="card exam-card${soon ? ' soon' : ''}">
    ${ex.map((e, k) => `<div class="${k ? 'small' : ''}" style="${k ? 'margin-top:6px' : ''}">
      ${k ? '' : `<div class="eyebrow">${t('exam.countdown')}</div>`}
      ${k ? `📝 ${esc(e.fach || t('exam.default'))}: <b>${when(e)}</b>` : `<h2>${t(e.days === 0 ? 'exam.h.today' : e.days === 1 ? 'exam.h.tomorrow' : 'exam.h.days', { f: esc(e.fach || t('exam.default')), n: e.days })}</h2>`}
      ${e.topic && !k ? `<div class="muted small" lang="de">${esc(e.topic)} · ${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.</div>` : ''}
    </div>`).join('')}
    ${hw.map((e) => `<div class="small" style="margin-top:6px">${t('hw')}${e.fach ? ' · ' + esc(e.fach) : ''}${e.topic ? ': ' + esc(e.topic) : ''} – <b>${when(e)}</b></div>`).join('')}
    ${ex.length ? `<div class="grid2" style="margin-top:10px">
      <a class="btn" href="#/deneme">${t('btn.mock')}</a>
      ${FAECHER.includes(ex[0].fach) ? `<a class="btn ghost" href="#/test?kat=${encodeURIComponent('Ders: ' + ex[0].fach)}">${t('btn.quickTest')}</a>` : `<a class="btn ghost" href="#/test">${t('btn.test')}</a>`}
    </div>` : ''}
  </div>`;
}

function nextOpenQuestion() {
  const done = store.get().open;
  const mastered = new Set(masteredLessons().map((l) => l.id));
  const upgrade = allOpen().find((q) => mastered.has(q.lesson) && !done[q.id]);
  if (upgrade) return upgrade;
  const all = allOpen();
  return all.find((q) => !done[q.id]) || [...all].sort((a, b) => (done[a.id].score - done[b.id].score) || done[a.id].last.localeCompare(done[b.id].last))[0];
}

// ───────────────────────── Lektion (Muskel/Knochen/Gelenk) ─────────────────────────
// Suchbegriffe, um Muskeln zu finden, die an einem Knochen entspringen oder ansetzen
const BONE_TERMS = {
  cranium: ['Linea nuchae', 'Proc. mastoideus', 'Protuberantia occipitalis', 'Os occipitale'],
  hws: ['C6', 'C7', 'Lig. nuchae'],
  bws: ['T1', 'T3', 'T7', 'Rippen, Proc'],
  lws: ['L1', 'L5', 'Proc. costales'],
  sacrum: ['sacrum'],
  sternum: ['Sternum', 'sterni', 'xiphoideus'],
  costae: ['Rippe'],
  clavicula: ['Clavicula'],
  scapula: ['scapula', 'Acromion', 'coracoideus', 'glenoidale', 'Fossa supraspinata', 'Fossa infraspinata', 'Fossa subscapularis'],
  humerus: ['humer', 'Tuberculum majus', 'Tuberculum minus', 'Crista tuberculi'],
  radius: ['radii'],
  ulna: ['ulna', 'Olecranon'],
  manus: ['metacarpale'],
  os_coxae: ['Os ilium', 'Crista iliaca', 'pubis', 'ischii', 'ischiadicum', 'Spina iliaca', 'Fossa iliaca', 'Acetabul', 'Crista pubica', 'Symphys'],
  femur: ['femor', 'Femur', 'Trochanter', 'Linea aspera', 'Tuberositas glutea', 'Linea intertrochanterica', 'Tuberculum adductorium'],
  patella: ['Patella'],
  tibia: ['tibia'],
  fibula: ['fibula'],
  calcaneus: ['calcane'],
  pes: ['metatarsal', 'cuneiforme', 'navicularis'],
};

function renderLesson([id]) {
  const s = findStructure(id);
  if (!s) { view.innerHTML = `<p class="empty">${t('notFound')}</p>`; return; }
  $('#title').textContent = kindLabel(s.kind);
  const learned = store.get().learned[id];

  let facts = '';
  if (s.kind === 'muscle') {
    facts = `
      <dl class="facts" lang="de">
        <dt>Ursprung (Origo)</dt><dd>${esc(s.o)}</dd>
        <dt>Ansatz (Insertio)</dt><dd>${esc(s.i)}</dd>
        <dt>Innervation</dt><dd>${esc(s.inn)}</dd>
        <dt>Funktion</dt><dd>${esc(s.f)}</dd>
        ${UEBUNGEN[s.id] ? `<dt>💪 Übung im Studio</dt><dd>${UEBUNGEN[s.id].map((u) => `<b>${esc(u.n)}</b> – ${esc(u.b)} <span class="muted">(${flag()} ${esc(tx(u))})</span>`).join('<br>')}</dd>` : ''}
      </dl>
      <div class="tr-box small">${flagFor(s, 'ftr')} ${esc(tx(s, 'ftr'))}</div>`;
  } else if (s.kind === 'bone') {
    facts = `
      <dl class="facts" lang="de">
        <dt>Knochentyp</dt><dd>${esc(s.typ)}</dd>
        <dt>Wichtige Strukturen</dt><dd>${esc(s.merk)}</dd>
      </dl>`;
  } else {
    facts = `
      <dl class="facts" lang="de">
        <dt>Gelenktyp</dt><dd>${esc(s.typ)}</dd>
        <dt>Bewegungsausmaß (Neutral-Null-Methode)</dt><dd>${s.rom ? s.rom.map((r) => `${esc(r.bew)}: <b>${r.a}° – 0° – ${r.b}°</b> <span class="muted">(${esc(r.achse)})</span>`).join('<br>') + `<div class="muted small">Quelle: ${esc(s.romQuelle || '')}</div>` : esc(s.nn)}</dd>
        ${s.lehrbuch ? `<dt>Lehrbuch (zum Vergleich)</dt><dd class="muted">${esc(s.lehrbuch)}</dd>` : ''}
        ${s.adl ? `<dt>ADL – ${esc(s.adlQuelle || '')}</dt><dd>${s.adl.map((a) => `${esc(a.akt)}: ${esc(a.w)}`).join('<br>')}</dd>` : ''}
        ${s.muskelGruppen ? `<dt>Muskeln nach Bewegungsrichtung – ${esc(s.gruppenQuelle || '')} (fett = Hauptmuskel)</dt><dd>${Object.entries(s.muskelGruppen).map(([g, m]) => `<b>${esc(g)}:</b> ${[...m.haupt.map((x) => `<b>${esc(x)}</b>`), ...m.weitere.map(esc)].join(', ')}`).join('<br>')}</dd>` : ''}
        ${s.kapsel ? `<dt>Kapselmuster</dt><dd>${esc(s.kapsel)}${s.kapselNote ? ` <span class="badge warn">${esc(tx(s, 'kapselNote'))}</span>` : ''}</dd>` : ''}
        <dt>Bänder & Strukturen</dt><dd>${esc(s.baender)}</dd>
      </dl>`;
  }
  const terms = BONE_TERMS[s.id] || [];
  const related = s.kind === 'bone'
    ? MUSCLES.filter((m) => terms.some((t) => norm(m.o + ' ' + m.i).includes(norm(t))))
    : [];

  const gen = s.kind === 'muscle' ? muscleQuestions(s) : s.kind === 'bone' ? boneQuestions(s) : [...jointQuestions(s), ...jointDetailQuestions(s)];
  const mini = shuffle(gen).slice(0, 3).map(prepare);

  view.innerHTML = `
    <div class="card">
      <span class="badge ${s.kind}">${kindLabel(s.kind)}</span>
      <h2 style="margin-top:8px">${esc(s.de)} ${say(s.de)}</h2>
      <div class="la">${esc(s.la)} ${say(s.la)}</div>
      <div class="muted small">${flagFor(s)} ${esc(tx(s))}</div>
      ${facts}
      ${s.k || s.klinik ? `<div class="klinik small">🩺 <b>Klinik:</b> ${esc(s.k || s.klinik)}</div>` : ''}
      <a class="btn ghost block" style="margin-top:14px" href="#/3d?id=${s.id}">${t('btn.show3dModel')}</a>
    </div>
    ${related.length ? `<div class="section-title">${t('lesson.related')}</div><div class="list">${related.map((m) => `<a href="#/ders/${m.id}"><span class="grow">${esc(m.la)}<div class="muted small">${esc(tx(m))}</div></span><span class="chev">›</span></a>`).join('')}</div>` : ''}
    ${mini.length ? `<div class="section-title">${t('lesson.mini')}</div><div id="miniQuiz"></div>` : ''}
    <button class="btn block" id="learnedBtn" style="margin-top:12px">${learned ? t('lesson.reviewed') : t('lesson.learned')}</button>
  `;

  const mq = $('#miniQuiz');
  if (mq) {
    mini.forEach((q, qi) => {
      const box = document.createElement('div');
      box.className = 'card';
      box.innerHTML = `<div class="muted small">${t('q.n', { i: qi + 1, n: mini.length })}</div><div class="question" style="font-size:16px">${esc(q.q)}</div>
        ${q.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}<div class="ex"></div>`;
      $$('.opt', box).forEach((btn) => btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        $$('.opt', box).forEach((b2, j) => { b2.disabled = true; if (j === q.ans) b2.classList.add('correct'); });
        if (i !== q.ans) btn.classList.add('wrong');
        store.recordQuiz(q.id, i === q.ans);
        $('.ex', box).innerHTML = `<div class="explain">${esc(tx(q, 'x'))}</div>${btn3d(`${q.q} ${q.opts[q.ans]} ${q.x}`, { style: 'margin-top:8px' })}`;
      }));
      mq.appendChild(box);
    });
  }

  $('#learnedBtn').addEventListener('click', () => {
    store.markLearned(s.id, s.kind === 'muscle' ? 'lesson' : 'lesson2');
    const cardId = { muscle: 'm:', bone: 'b:', joint: 'j:' }[s.kind] + s.id;
    store.markIntroduced(cardId);
    store.save();
    toast(t('lesson.savedToast'));
    setTimeout(() => (location.hash = '#/bugun'), 600);
  });
}

// ───────────────────────── Ders-Notları (aus Notion) ─────────────────────────
function lessonProgress(l) {
  const st = store.get();
  const qs = lessonMcq(l).map((q) => st.quiz[q.id]).filter(Boolean);
  const right = qs.filter((q) => q.r > 0 && q.r >= q.w).length;
  return { seen: qs.length, right, total: l.mcq.length };
}

function renderLessonList() {
  const byFach = Object.create(null);
  LESSONS.forEach((l) => (byFach[l.fach] = byFach[l.fach] || []).push(l));
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">${t('lessons.intro')}</p>
    ${Object.entries(byFach).map(([fach, ls]) => `
      <div class="section-title" lang="de">${esc(fach)}</div>
      ${hasChecklist(fach) ? (() => { const c = ckSummary(fach); return `<a class="card row ck-link" href="#/ck/${encodeURIComponent(fach)}"><span class="grow">📋 ${t('ck.open')}<div class="muted small">${t('ck.doneOf', { a: c.done, b: c.total })}</div></span><span class="chev">›</span></a>`; })() : ''}
      <div class="list">${ls.map((l) => {
        const p = lessonProgress(l);
        const badge = !p.seen ? `<span class="badge">${t('badge.new')}</span>` : `<span class="badge ${p.right / p.total >= 0.8 ? 'good' : 'warn'}">${p.right}/${p.total}</span>`;
        return `<a href="#/not/${encodeURIComponent(l.id)}"><span class="grow small" lang="de">${esc(l.title)}</span>${badge}<span class="chev">›</span></a>`;
      }).join('')}</div>`).join('') || `<p class="empty">${t('lessons.none')}</p>`}
  `;
}

function renderLessonNote([id]) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) { view.innerHTML = `<p class="empty">${t('notFound')}</p>`; return; }
  $('#title').textContent = l.fach;
  const opens = allOpen().filter((q) => q.lesson === l.id);
  view.innerHTML = `
    <div class="card">
      <div class="eyebrow" lang="de">${esc(l.fach)}</div>
      <h2 lang="de">${esc(l.title)}</h2>
      <div class="grid2" style="margin-top:12px">
        ${l.mcq.length ? `<a class="btn" href="#/test?kat=${encodeURIComponent('Lektion: ' + l.id)}">${t('note.test', { n: l.mcq.length })}</a>` : ''}
        ${notionLink(l.id) && NOTION_URL.test(notionLink(l.id)) ? `<a class="btn ghost" href="${esc(notionLink(l.id))}" target="_blank" rel="noopener noreferrer">${t('note.openNotion')}</a>` : ''}
      </div>
      ${l.fach === 'PT Befund' ? `<a class="btn ghost block" style="margin-top:10px" href="#/vaka">${t('vaka.btn')}</a>` : ''}
      ${l.fach === 'Anatomie' && /femur/i.test(l.title) ? `<a class="btn ghost block" style="margin-top:10px" href="#/3d?quiz=femur">${t('pq.femurBtn')}</a>` : ''}
      ${hasChecklist(l.fach) ? `<a class="btn ghost block" style="margin-top:10px" href="#/ck/${encodeURIComponent(l.fach)}">📋 ${t('ck.open')}</a>` : ''}
    </div>
    <div class="section-title">${t('note.summary')}</div>
    <div class="list">${l.kern.map((k) => `<div style="display:block"><div lang="de">${esc(k.de)}</div><div class="muted small">${flagFor(k)} ${esc(tx(k))}</div></div>`).join('')}</div>
    ${opens.length ? `<div class="section-title">${t('note.open')}</div><div class="list">${opens.map((q) => `<a href="#/soru/${encodeURIComponent(q.id)}"><span class="grow small" lang="de">${esc(q.q)}</span><span class="chev">›</span></a>`).join('')}</div>` : ''}
    <div class="section-title">${t('note.terms')}</div>
    <div class="list">${l.vocab.map((v) => `<div><span class="grow"><b lang="de">${esc(v.de)}</b><div class="small">${esc(vocabTr(v))}</div></span>${say(v.de)}</div>`).join('')}</div>
    <a class="btn ghost block" href="#/oturum/${encodeURIComponent('ders:' + l.fach)}">${t('note.studyTerms')}</a>
  `;
}

// ───────────────────────── Günün kelimeleri ─────────────────────────
let wordSess = null;

function renderWordSession([pass = 'sabah']) {
  if (!wordSess || wordSess.pass !== pass || wordSess.date !== store.today()) {
    wordSess = { pass, date: store.today(), i: 0, res: [], answered: false };
  }
  $('#title').textContent = t(pass === 'donus' ? 'words.donusTitle' : pass === 'hafta' ? 'words.weekTitle' : 'words.morningTitle');
  const words = pass === 'hafta' ? weekWords() : todaysWords();
  if (!words.length) { view.innerHTML = `<p class="empty">${t('words.noneWeek')}</p><a class="btn block" href="#/bugun">${t('route.bugun')}</a>`; return; }
  if (wordSess.i >= words.length) return renderWordEnd(words);
  const w = words[wordSess.i];
  const q = (wordSess.q && wordSess.q.id === w.id) ? wordSess.q.q : questionFor(w, pass);
  wordSess.q = { id: w.id, q };
  view.innerHTML = `
    <div class="row"><span class="badge">${esc(w.cat.replace('GW · ', ''))}</span><span class="badge">${typeLabel(q.type)}</span><span class="spacer"></span><span class="muted small">${wordSess.i + 1} / ${words.length}</span></div>
    <div class="progress"><div style="width:${(wordSess.i / words.length) * 100}%"></div></div>
    <p class="muted small" style="margin:4px 0">${esc(q.prompt)}</p>
    <div class="card" style="text-align:center"><div class="big-word" lang="de">${escGap(q.big)}</div>${q.sub ? `<div class="muted small" style="margin-top:6px">${esc(q.sub)}</div>` : ''}</div>
    ${q.typed
      ? `<input type="text" id="wInput" placeholder="${t('words.placeholder')}" autocomplete="off" autocapitalize="off" spellcheck="false" lang="de">
         <button class="btn block" id="wCheck" style="margin-top:8px">${t('check')}</button>`
      : q.opts.map((o, n) => `<button class="opt" data-n="${n}" lang="de">${esc(o)}</button>`).join('')}
    <div id="wAfter"></div>
    ${pass === 'hafta' ? '' : `<button class="btn plain block" id="wKnown" style="margin-top:14px">${t('words.known')}</button>`}`;
  // ok: true/false; near: fast richtig (Artikel falsch/fehlt) = halber Punkt; note darf HTML enthalten
  // Rückmeldung anzeigen (auch nach „3D'de göster“ → Zurück, ohne erneut zu zählen)
  const showAfter = ({ ok, note, near }) => {
    if ($('#wKnown')) $('#wKnown').hidden = true;
    $('#wAfter').innerHTML = `<div class="explain">${t(ok ? 'res.right' : near ? 'res.near' : 'res.wrong')}${note ? ' · ' + note : ''}<br><b lang="de">${esc(w.de)}</b> = ${esc(vocabTr(w))}${w.ex ? `<br><span class="muted" lang="de">„${esc(w.ex)}“</span>` : ''}${q.type === 'partizip' ? `<br>Partizip II: <b lang="de">${esc(q.answer)}</b>` : ''}</div>${btn3d(w.de, { style: 'margin:0 0 10px' })}
      <button class="btn block" id="wNext">${wordSess.i + 1 < words.length ? t('words.next') : t('finish')}</button>`;
    $('#wNext').addEventListener('click', () => { wordSess.i++; wordSess.answered = false; wordSess.fb = null; wordSess.q = null; renderWordSession([pass]); });
  };
  const finish = (ok, note = '', near = false) => {
    if (wordSess.answered) return;
    wordSess.answered = true;
    wordSess.fb = { ok, note, near, pick: wordSess.pick, typed: wordSess.typed };
    const morningOk = (store.day().wordRes || {})[w.id];
    // Morgens zählt für das Leitner-Fach; abends nur, wenn falsch (zurück in Fach 1) oder morgens nicht geübt
    if (pass === 'sabah' || !ok || morningOk === undefined) recordWord(w.id, ok, near);
    const d = store.day();
    d.wordRes = { ...(d.wordRes || {}), [w.id]: near ? 'close' : ok };
    store.save();
    wordSess.res.push({ id: w.id, ok, near });
    showAfter(wordSess.fb);
  };
  if (q.typed) {
    const input = $('#wInput');
    const check = () => {
      const r = checkTyped(w, input.value);
      wordSess.typed = input.value;
      input.disabled = true; $('#wCheck').hidden = true;
      const b = (x) => `<b lang="de">${esc(x)}</b>`;
      const note = r.ok && r.abbr ? t('words.abbr', { x: b(r.target) })
        : r.ok && !r.exact ? t('words.typo', { x: b(r.target) })
        : r.hint === 'Artikel falsch' ? t('words.artWrong', { x: b(r.art) })
        : r.hint === 'Artikel fehlt' ? t('words.artMissing', { x: b(r.art) }) : '';
      finish(r.ok, note, !!r.close);
    };
    $('#wCheck').addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  } else {
    $$('.opt').forEach((b) => b.addEventListener('click', () => {
      const ok = q.opts[+b.dataset.n] === q.answer;
      wordSess.pick = +b.dataset.n;
      $$('.opt').forEach((x) => { x.disabled = true; if (q.opts[+x.dataset.n] === q.answer) x.classList.add('correct'); });
      if (!ok) b.classList.add('wrong');
      finish(ok);
    }));
  }
  // schon beantwortet (z. B. zurück aus der 3D-Ansicht): Antwort und Rückmeldung wiederherstellen
  if (wordSess.answered && wordSess.fb) {
    const fb = wordSess.fb;
    if (q.typed) { $('#wInput').value = fb.typed || ''; $('#wInput').disabled = true; $('#wCheck').hidden = true; }
    else $$('.opt').forEach((x) => { x.disabled = true; if (q.opts[+x.dataset.n] === q.answer) x.classList.add('correct'); if (+x.dataset.n === fb.pick && !fb.ok) x.classList.add('wrong'); });
    showAfter(fb);
  }
  if ($('#wKnown')) $('#wKnown').addEventListener('click', () => {
    const next = markKnown(w.id);
    toast(next ? t('words.knownToast', { w: next.de }) : t('words.knownNone'));
    wordSess.q = null;
    renderWordSession([pass]);
  });
}

function renderWordEnd(words) {
  const { pass, res } = wordSess;
  const r = res.filter((x) => x.ok).length;
  const d = store.day();
  d[pass === 'donus' ? 'wordsReturn' : pass === 'hafta' ? 'wordsWeek' : 'wordsMorning'] = { r, n: words.length };
  store.save();
  view.innerHTML = `
    <div class="card" style="text-align:center"><div class="score">${r}/${words.length}</div><div class="muted">${t(pass === 'donus' ? 'words.endDonus' : pass === 'hafta' ? 'words.endWeek' : 'words.endMorning')}</div></div>
    <div class="list">${words.map((w) => { const ok = (d.wordRes || {})[w.id]; return `<div><span class="grow"><b lang="de">${esc(w.de)}</b><div class="small">${esc(vocabTr(w))}</div></span><span class="badge ${ok === 'close' ? 'warn' : ok ? 'good' : ok === false ? 'bad' : ''}">${ok === 'close' ? '½' : ok ? '✓' : ok === false ? '✗' : '–'}</span></div>`; }).join('')}</div>
    <a class="btn block" href="#/bugun">${t('backToday')}</a>`;
  wordSess = null;
}

// Sammelbegriffe → mehrere Strukturen
const GROUP_NAMES = [
  [/wirbelsäule|columna vertebralis/, ['hws', 'bws', 'lws', 'sacrum']],
  [/\bmm\.\s*gemelli\b|\bgemelli\b|zwillingsmuskeln/, ['gemellus_superior', 'gemellus_inferior']],
  [/\bmm\.\s*obturatorii\b|\bobturatorii\b/, ['obturatorius_internus', 'obturatorius_externus']],
  [/ischiocrural|ischiokrural|hamstrings/, ['biceps_femoris', 'semitendinosus', 'semimembranosus']],
  [/quadri[cz]eps/, ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius']],
  [/\bmm\.\s*vasti\b/, ['vastus_lateralis', 'vastus_medialis', 'vastus_intermedius']],
  [/tri[cz]eps surae/, ['gastrocnemius', 'soleus']],
  [/rotatorenmanschette/, ['supraspinatus', 'infraspinatus', 'teres_minor', 'subscapularis']],
  [/adduktoren|\bmm\.\s*adductores\b/, ['pectineus', 'adductor_longus', 'adductor_brevis', 'adductor_magnus', 'gracilis']],
  [/tiefen? (hüft)?außenrotatoren|pelvitrochant/, ['piriformis', 'gemellus_superior', 'obturatorius_internus', 'gemellus_inferior', 'obturatorius_externus', 'quadratus_femoris']],
  // „Mm. glutaei medius et minimus“, „Gluteus medius/minimus“, „Glutaei med. et min.“
  [/glut(a)?e(i|us)\s+med(ius)?\.?\s*(et|\/|und|\+)\s*min(imus)?/, ['gluteus_medius', 'gluteus_minimus']],
  [/\bmm\.\s*glut(a)?ei\b(?!\s+med)|gesäßmuskeln|glutealmuskulatur/, ['gluteus_maximus', 'gluteus_medius', 'gluteus_minimus']],
  [/bauchmuskel/, ['rectus_abdominis', 'obliquus_externus', 'transversus_abdominis']],
];
const LETTERS = 'a-zäöüß';
let nameIndex = null;
function structureNames() {
  if (nameIndex) return nameIndex;
  const rx = (n) => n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\.\s+/g, '\\.\\s*').replace(/\s+/g, '\\s+');
  nameIndex = [...ALL_STRUCTURES, ...LANDMARKS.map((l) => ({ ...l, kind: 'landmark' }))].map((st) => {
    const v = new Set();
    for (const b of [st.la.replace(/\s*\(.*\)$/, ''), st.de]) {
      v.add(b);
      v.add(b.replace(/^(M|Mm|Lig|Ligg)\.\s+/, ''));        // „gluteus minimus“ ohne „M.“
      v.add(b.replace(/^Articulatio\b/, 'Art.'));
    }
    const ab = (st.la.match(/\(([^)]+)\)$/) || [])[1];      // Abkürzung in Klammern: SIAS, ISG, OSG, AC-Gelenk …
    if (ab && /^[A-ZÄÖÜ][\wÄÖÜäöü–-]+$/.test(ab)) v.add(ab);
    const names = [...v].filter((x) => x.length > 3 || /^[A-Z]{3}$/.test(x));
    // nur ganze Wörter (mit Genitiv-/Plural-Endung), damit „Tibia“ nicht in „tibialis“ trifft
    return { st, re: new RegExp(`(^|[^${LETTERS}])(${names.map(rx).join('|')})(?:s|es|n|en)?(?![${LETTERS}])`) };
  });
  return nameIndex;
}

// Alle Muskeln, Knochen, Gelenke und Knochenpunkte, die in einem Text genannt werden (Reihenfolge wie im Text)
function structuresInText(text, max = 8) {
  const t = ' ' + String(text || '').replace(/\((M\. (quadriceps femoris|triceps surae))\)/g, ' ').toLowerCase() + ' ';
  const hits = [];
  for (const { st, re } of structureNames()) {
    const m = re.exec(t);
    if (m) hits.push({ at: m.index + m[1].length, len: m[2].length, ids: [st.id] });
  }
  for (const [re, ids] of GROUP_NAMES) {
    const m = re.exec(t);
    if (m) hits.push({ at: m.index, len: m[0].length, ids });
  }
  hits.sort((x, y) => x.at - y.at || y.len - x.len);
  // Treffer, die ganz in einem längeren Namen liegen, weglassen
  const kept = hits.filter((h, i) => !hits.some((o, j) => j !== i && o.len > h.len && o.at <= h.at && o.at + o.len >= h.at + h.len && !o.ids.includes(h.ids[0])));
  const ids = [...new Set(kept.flatMap((h) => h.ids))];
  return ids.map(findAny).filter(Boolean).slice(0, max);
}

// „🦴 3D'de göster“-Knopf für alle Strukturen in einem Text
function btn3d(text, { style = 'margin-top:10px', stop = false, block = true } = {}) {
  const ss = structuresInText(text);
  if (!ss.length) return '';
  const label = ss.length > 1 ? t('btn3d.many', { n: ss.length }) : t('btn3d.one', { x: esc(shortName(ss[0])) });
  return `<a class="btn ghost${block ? ' block' : ''}" style="${style}" href="#/3d?ids=${ss.map((x) => x.id).join(',')}"${stop ? ' data-stop' : ''}>${label}</a>`;
}

// ───────────────────────── Samstag: Wochenwiederholung ─────────────────────────
function renderSaturday() {
  const wrong = store.wrongSince(7).filter((id) => !id.startsWith('lm:')).length; // 3D-Quiz läuft nicht im Test
  const fehler = deckCards('fehler').length;
  const words = weekWords();
  const w = week();
  const weekFaecher = w ? [...new Set(Object.values(w.days || {}).flatMap((d) => (d && d.test) || []))] : [];
  const opens = allOpen().filter((q) => weekFaecher.includes(q.cat)).slice(0, 8);
  const d = store.day();
  view.innerHTML = `
    <div class="card"><div class="eyebrow">${t('today.weekly')}</div><h2>${t('sat.h')}</h2>
      <div class="muted small">${t('sat.sub')} ${weekFaecher.length ? t('sat.subjects', { x: esc(weekFaecher.join(', ')) }) : ''}</div></div>
    <div class="list">
      <a href="#/test?kat=${encodeURIComponent('Hatalar: hafta')}"><span class="grow"><b>${t('sat.wrong')}</b><div class="muted small">${t('n.questions', { n: wrong })}</div></span><span class="chev">›</span></a>
      <a href="#/oturum/fehler"><span class="grow"><b>${t('sat.fehler')}</b><div class="muted small">${t('sat.fehlerSub', { n: fehler })}</div></span><span class="chev">›</span></a>
      <a href="#/sozlu"><span class="grow"><b>${t('sat.oral')}</b><div class="muted small">${t('sat.oralSub')}</div></span><span class="chev">›</span></a>
      <a href="#/kelime/hafta"><span class="grow"><b>${t('sat.words')}</b><div class="muted small">${t('sat.wordsSub', { n: words.length })}${d.wordsWeek ? t('sat.today', { r: d.wordsWeek.r, n: d.wordsWeek.n }) : ''}</div></span><span class="chev">›</span></a>
    </div>
    ${opens.length ? `<div class="section-title">${t('sat.open')}</div><div class="list">${opens.map((q) => `<a href="#/soru/${encodeURIComponent(q.id)}"><span class="grow small" lang="de">${esc(q.q)}</span><span class="badge">${esc(q.cat)}</span></a>`).join('')}</div>` : ''}`;
}

// ───────────────────────── Dönüş yolu (Rückweg) ─────────────────────────
// Fächer von heute: Morgentest + erkannte Kursnamen
function todayFaecher(plan = todayPlan()) {
  if (!plan) return examFaecher(7);
  const hit = kursFaecher(plan.kurse, [...new Set([...FAECHER, 'AM', 'AKL', 'Atemtherapie', 'KI'])]);
  // Fächer mit Prüfung in ≤ 7 Tagen zuerst (Lesestoff und ✗-Karten im Rückweg)
  return [...new Set([...examFaecher(7), ...(plan.test || []), ...hit])];
}

// Höchstens 2 Lektionen pro Rückweg: Fächer des Morgentests zuerst, je Fach die am längsten nicht gelesene
function readingLessons(fs = todayFaecher()) {
  const read = store.get().learned;
  const out = [];
  for (const f of fs) {
    const l = LESSONS.filter((x) => x.fach === f).sort((a, b) => (read['les:' + a.id] || '').localeCompare(read['les:' + b.id] || ''))[0];
    if (l && !out.includes(l)) out.push(l);
    if (out.length === 2) break;
  }
  return out;
}

function donusInfo() {
  const d = store.day();
  const fs = todayFaecher();
  const st = d.donus || {};
  const wrong = (d.wrong || []).filter((id) => !id.startsWith('lm:')).length; // 3D-Quiz läuft nicht im Test
  const fehlerCards = deckCards('fehler:' + fs.join(',')).filter((c) => store.isNew(c.id) || store.isDue(c.id)).length;
  const odevOpen = deckCards('odev').filter((c) => store.isNew(c.id) || store.isDue(c.id)).length;
  const lessons = readingLessons(fs);
  const kern = lessons.reduce((n, l) => n + l.kern.length, 0);
  const steps = [
    // Test „Hatalar: bugün“ fragt höchstens 30 Fragen
    { key: 'hatalar', icon: '❌', title: t('don.hatalar'), sub: wrong ? `${t('don.hatalarSub', { n: wrong })}${wrong > 30 ? t('don.max30') : ''}` : t('don.noWrong'), min: Math.ceil(Math.min(wrong, 30) * 1.5), href: '#/test?kat=' + encodeURIComponent('Hatalar: bugün'), empty: !wrong },
    { key: 'fehler', icon: '✗', title: t('don.fehler'), sub: fs.length ? `${t('n.cards', { n: fehlerCards })} · ${fs.join(' + ')}` : t('don.noClass'), min: fehlerCards, href: '#/oturum/' + encodeURIComponent('fehler:' + fs.join(',')), empty: !fehlerCards },
    ...(odevOpen ? [{ key: 'odev', icon: '📌', title: t('don.odev'), sub: `${t('n.cards', { n: odevOpen })} · ${[...new Set(odevList().map((f) => f.odev))].join(', ')}`, min: Math.ceil(Math.min(odevOpen, 20) * 0.75), href: '#/oturum/odev' }] : []),
    { key: 'kelime', icon: '🔤', title: t('don.words'), sub: t('don.wordsSub', { n: WORDS_PER_DAY }), min: 8, href: '#/kelime/donus', done: !!d.wordsReturn },
    { key: 'notlar', icon: '📖', title: t('don.notes'), sub: lessons.length ? t('don.notesSub', { n: lessons.length, k: kern }) : t('don.noNotes'), min: lessons.length ? Math.ceil(kern * 0.75) + 6 : 0, href: '#/oku', empty: !lessons.length },
  ];
  for (const s of steps) s.state = s.done ? 'done' : st[s.key] || (s.empty ? 'empty' : 'open');
  return { steps, total: steps.filter((s) => s.state === 'open').reduce((n, s) => n + s.min, 0), fs };
}

function markDonus(key, value = 'done') {
  const d = store.day();
  d.donus = { ...(d.donus || {}), [key]: value };
  store.save();
}

function renderDonus() {
  const { steps, total, fs } = donusInfo();
  view.innerHTML = `
    <div class="card">
      <div class="eyebrow">${t('today.donus')}</div>
      <h2>${t('don.h', { min: total })}</h2>
      <div class="muted small">${fs.length ? t('don.subjects', { x: esc(fs.join(' + ')) }) : t('don.noPlan')} · ${t('don.skipHint')}</div>
    </div>
    <div class="list">
      ${steps.map((s, n) => `<div style="display:block">
        <div class="row"><span class="check ${s.state === 'done' || s.state === 'skip' ? 'done' : ''}">${s.state === 'done' ? '✓' : s.state === 'skip' ? '–' : n + 1}</span>
          <span class="grow"><b>${s.icon} ${esc(s.title)}</b><div class="muted small">${esc(s.sub)}${s.min && s.state === 'open' ? ` · ${t('min', { n: s.min })}` : ''}</div></span></div>
        ${s.state === 'open' ? `<div class="grid2" style="margin-top:8px"><a class="btn" href="${s.href}">${t('don.start')}</a><button class="btn plain" data-skip="${s.key}">${t('don.skip')}</button></div>` : ''}
      </div>`).join('')}
    </div>
    <a class="btn ghost block" href="#/rapor">${t('don.report')}</a>`;
  $$('[data-skip]').forEach((b) => b.addEventListener('click', () => { markDonus(b.dataset.skip, 'skip'); renderDonus(); }));
}

// Lesemodus: Kernaussagen der heutigen Fächer, große Schrift, danach Mini-Test
function renderReading() {
  const fs = todayFaecher();
  const lessons = readingLessons(fs);
  if (!lessons.length) { view.innerHTML = `<p class="empty">${t('read.none')}</p><a class="btn block" href="#/donus">${t('backPlain')}</a>`; return; }
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">${t('read.intro')}</p>
    ${lessons.map((l) => `
      <div class="section-title" lang="de">${esc(l.fach)} · ${esc(l.title)}</div>
      ${l.kern.map((k) => `<div class="card read-card"><div lang="de">${esc(k.de)}</div><div class="muted">${flagFor(k)} ${esc(tx(k))}</div>${btn3d(k.de, { style: 'margin-top:10px', block: false })}</div>`).join('')}`).join('')}
    <button class="btn block" id="readDone" style="margin-top:12px">${t('read.done')}</button>
    <button class="btn plain block" id="readSkip" style="margin-top:8px">${t('read.skip')}</button>`;
  const markRead = () => { lessons.forEach((l) => { store.get().learned['les:' + l.id] = store.today(); }); markDonus('notlar'); };
  $('#readDone').addEventListener('click', () => { markRead(); location.hash = '#/test?kat=' + encodeURIComponent('Lektion: ' + lessons.map((l) => l.id).join(',')) + '&donus=1'; });
  $('#readSkip').addEventListener('click', () => { markRead(); location.hash = '#/donus'; });
}

// ───────────────────────── Quiz ─────────────────────────
// Laufender Test liegt auch im Speicher (store.quizRun): 3D-Ansicht, Tab-Wechsel oder Neuladen setzen ihn nicht zurück
function saveQuiz() {
  store.get().quizRun = quiz ? {
    date: quiz.date || store.today(), cat: quiz.cat || '', donus: !!quiz.donus, qs: quiz.qs, i: quiz.i, right: quiz.right,
    wrong: quiz.wrong.map((q) => quiz.qs.indexOf(q)).filter((i) => i >= 0), answers: quiz.answers || {}, finished: !!quiz.finished, endAt: quiz.endAt || 0,
  } : null;
  store.save();
}
function loadQuiz() {
  const r = store.get().quizRun;
  return r && r.date === store.today() ? { ...r, wrong: r.wrong.map((i) => r.qs[i]).filter(Boolean) } : null;
}
let quiz = loadQuiz();
// neuer Test: heutiges Datum mitgeben und sofort speichern
const startQuiz = (q) => { quiz = { date: store.today(), ...q }; saveQuiz(); };

const topicLabel = (c) => (c.startsWith('Ders: ') ? t('topic.ders', { f: c.slice(6) }) : c === 'Knochenpunkte' ? t('topic.lm') : catLabel(c));
// Beschriftung einer Test-Kategorie (die Kategorie selbst bleibt der interne Schlüssel)
const catLabel = (c) => (c.startsWith('Lernziel: ') ? t('cat.ck') : c === 'Gemischt' ? t('cat.mixed') : c === 'Hatalar: bugün' ? t('cat.wrongToday') : c === 'Hatalar: hafta' ? t('cat.wrongWeek') : c.startsWith('Ders: ') ? topicLabel(c) : c);
let quizCat = 'Gemischt';

function renderQuizStart(_, params = new URLSearchParams()) {
  const kat = params.get('kat');
  if (quiz && quiz.date && quiz.date !== store.today()) { quiz = null; saveQuiz(); } // Test von gestern nicht fortsetzen
  if (kat) {
    // Direktstart, z. B. Morgentest aus dem Tagesplan oder Test zu einer Lektion
    quizCat = kat;
    history.replaceState(null, '', '#/test');
    // derselbe Test läuft noch (z. B. zurück aus der 3D-Ansicht über den Tagesplan) → dort weitermachen
    if (quiz && !quiz.finished && quiz.cat === kat) return renderQuizQuestion();
    const donus = params.get('donus') === '1' || kat.startsWith('Dönüş: ');
    const n = donus ? 5 : kat.startsWith('Hatalar: ') ? 30 : store.get().settings.quizGoal;
    const qs = buildQuiz(kat, n, store.get().customVocab, { morning: !donus && kat === morningKat() });
    if (!qs.length) toast(t('quiz.none'));
    else { startQuiz({ qs, i: 0, right: 0, wrong: [], finished: false, cat: kat, donus }); return renderQuizQuestion(); }
  }
  if (quiz && !quiz.finished) return renderQuizQuestion();
  // gerade beendet (z. B. zurück aus der 3D-Ansicht): Ergebnis statt Kategorieauswahl zeigen
  if (quiz && quiz.finished && Date.now() - quiz.endAt < 10 * 60e3) return renderQuizEnd();
  const stats = store.get().quiz;
  const weak = Object.entries(stats).filter(([, v]) => v.w > v.r).length;
  view.innerHTML = `
    <div class="card">
      <h2>${t('quiz.choose')}</h2>
      <div class="chips" style="margin-top:10px">
        ${[...quizCategories(), ...(quizCategories().includes(quizCat) ? [] : [quizCat])].map((c) => `<button class="chip ${c === quizCat ? 'on' : ''}" data-cat="${esc(c)}">${esc(catLabel(c))}</button>`).join('')}
      </div>
      <button class="btn block" id="startQuiz" style="margin-top:16px">${t('quiz.start', { n: store.get().settings.quizGoal })}</button>
    </div>
    <a class="card row" href="#/deneme" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">${t('quiz.mockEyebrow')}</div><h2>${t('quiz.mockH')}</h2><div class="muted small">${t('quiz.mockSub')}</div></span><span class="chev">›</span></a>
    <a class="card row" href="#/vaka" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">${t('vaka.eyebrow')}</div><h2>Befund-Trainer</h2><div class="muted small">${t('vaka.sub')}</div></span><span class="chev">›</span></a>
    <p class="muted small" style="padding:0 4px">${t('quiz.info', { lvl: muscleLevel() })}${romUnlocked() ? t('quiz.romOpen') : ''}.${weak ? t('quiz.weakInfo', { n: weak }) : ''}</p>
  `;
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { quizCat = b.dataset.cat; renderQuizStart(); }));
  $('#startQuiz').addEventListener('click', () => {
    const qs = buildQuiz(quizCat, store.get().settings.quizGoal, store.get().customVocab, { morning: quizCat === morningKat() });
    startQuiz({ qs, i: 0, right: 0, wrong: [], finished: false, cat: quizCat });
    renderQuizQuestion();
  });
}

function renderQuizQuestion() {
  if (quiz.i >= quiz.qs.length) return renderQuizEnd();
  const q = quiz.qs[quiz.i];
  view.innerHTML = `
    <div class="row"><span class="badge">${esc(q.cat)}</span><span class="spacer"></span><span class="muted small">${quiz.i + 1} / ${quiz.qs.length}</span></div>
    <div class="progress"><div style="width:${(quiz.i / quiz.qs.length) * 100}%"></div></div>
    <div class="question">${escGap(q.q)}</div>
    ${q.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}
    <div id="after"></div>
    <button class="btn plain block" id="quitQuiz" style="margin-top:20px">${t('quiz.quit')}</button>
  `;
  // Antwort anzeigen; record = false, wenn die Frage schon beantwortet war (z. B. zurück aus der 3D-Ansicht)
  const answer = (i, record) => {
    const ok = i === q.ans;
    $$('.opt').forEach((b, j) => { b.disabled = true; if (j === q.ans) b.classList.add('correct'); if (j === i && !ok) b.classList.add('wrong'); });
    if (record) {
      quiz.answers = { ...(quiz.answers || {}), [quiz.i]: i };
      if (!ok) quiz.wrong.push(q); else quiz.right++;
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ok ? 15 : [30, 40, 30]);
      saveQuiz();
      store.recordQuiz(q.id, ok);
    }
    $('#after').innerHTML = `<div class="explain">${ok ? t('quiz.right') : t('quiz.wrong')}${esc(tx(q, 'x'))}</div>${btn3d(`${q.q} ${q.opts[q.ans]} ${q.x}`, { style: 'margin:0 0 10px' })}<button class="btn block" id="next">${quiz.i + 1 < quiz.qs.length ? t('quiz.next') : t('quiz.result')}</button>`;
    $('#next').addEventListener('click', () => { quiz.i++; saveQuiz(); renderQuizQuestion(); });
    if (record) $('#next').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $$('.opt').forEach((btn) => btn.addEventListener('click', () => answer(+btn.dataset.i, true)));
  const prev = quiz.answers && quiz.answers[quiz.i];
  if (prev !== undefined) answer(prev, false);
  $('#quitQuiz').addEventListener('click', () => { quiz.qs = quiz.qs.slice(0, quiz.i); renderQuizEnd(); });
}

function renderQuizEnd() {
  quiz.finished = true;
  quiz.endAt = quiz.endAt || Date.now();
  saveQuiz();
  const plan = todayPlan();
  if (morningKat() && quiz.cat === morningKat() && quiz.qs.length) { store.day().morning = true; store.save(); }
  if (quiz.cat === 'Hatalar: bugün') markDonus('hatalar');
  if (quiz.donus) markDonus('test');
  const n = quiz.qs.length;
  const pct = n ? Math.round((quiz.right / n) * 100) : 0;
  const quizLessons = new Set(quiz.qs.map((q) => q.lesson).filter(Boolean));
  const doneOpen = store.get().open;
  const upgrade = masteredLessons().filter((l) => quizLessons.has(l.id))
    .map((l) => ({ l, q: allOpen().find((o) => o.lesson === l.id && !doneOpen[o.id]) || allOpen().find((o) => o.lesson === l.id) }))
    .filter((x) => x.q);
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="score">${quiz.right}/${n}</div>
      <div class="muted">${t(pct >= 80 ? 'quiz.great' : pct >= 50 ? 'quiz.good' : 'quiz.review')}</div>
    </div>
    ${quiz.wrong.length ? `<div class="section-title">${t('yourWrong')}</div>${quiz.wrong.map((q) => `<div class="card small"><b>${esc(q.q)}</b><div class="explain">✔︎ ${esc(q.opts[q.ans])}<br><span class="muted">${esc(tx(q, 'x'))}</span></div>${btn3d(`${q.q} ${q.opts[q.ans]} ${q.x}`, { style: 'margin-top:8px' })}</div>`).join('')}` : ''}
    ${upgrade.map(({ l, q }) => `<a class="card row" href="#/soru/${encodeURIComponent(q.id)}" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">${t('quiz.levelUp')}</div><b lang="de">${esc(l.title)}</b><div class="muted small">${t('quiz.levelUpSub')}</div></span><span class="chev">›</span></a>`).join('')}
    <div class="grid2">
      ${quiz.wrong.length ? `<button class="btn ghost" id="retryWrong">${t('retryWrong')}</button>` : ''}
      <button class="btn" id="again">${t('quiz.again')}</button>
    </div>
  `;
  $('#again').addEventListener('click', () => { quiz = null; saveQuiz(); renderQuizStart(); });
  const rw = $('#retryWrong');
  if (rw) rw.addEventListener('click', () => {
    startQuiz({ qs: shuffle(quiz.wrong).map((q) => prepare({ ...q, o: [q.opts[q.ans], ...q.opts.filter((_, i) => i !== q.ans)], a: 0 })), i: 0, right: 0, wrong: [], finished: false });
    renderQuizQuestion();
  });
}

// ───────────────────────── Offene Fragen ─────────────────────────
const drafts = {};

function renderOpenList() {
  const st = store.get().open;
  const all = allOpen();
  const cats = [...new Set(all.map((q) => q.cat))];
  view.innerHTML = `
    <a class="card row" href="#/sozlu" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">${t('sat.oral')}</div><h2>${t('oral.cardH')}</h2><div class="muted small">${t('oral.cardSub')}</div></span><span class="chev">›</span></a>
    <p class="muted small" style="padding:0 4px">${t('open.intro')}</p>
    ${cats.map((c) => `
      <div class="section-title" lang="de">${esc(c)}</div>
      <div class="list">
        ${all.filter((q) => q.cat === c).map((q) => {
          const r = st[q.id];
          const badge = !r ? `<span class="badge">${t('badge.new')}</span>` : r.score >= 0.75 ? `<span class="badge good">${t('badge.good')}</span>` : r.score >= 0.4 ? `<span class="badge warn">${t('badge.partial')}</span>` : `<span class="badge bad">${t('badge.again')}</span>`;
          return `<a href="#/soru/${encodeURIComponent(q.id)}"><span class="grow small">${esc(q.q)}</span>${badge}</a>`;
        }).join('')}
      </div>`).join('')}
  `;
}

function renderOpenQuestion([id]) {
  const all = allOpen();
  const q = all.find((x) => x.id === id);
  if (!q) { view.innerHTML = `<p class="empty">${t('open.notFound')}</p><a class="btn block" href="#/sorular">${t('route.sorular')}</a>`; return; }
  view.innerHTML = `
    <div class="card">
      <span class="badge">${esc(q.cat)}</span>
      <div class="question" style="margin-top:8px" lang="de">${esc(q.q)} ${say(q.q)}</div>
      <textarea id="answer" placeholder="${t('open.placeholder')}">${esc(drafts[q.id] || '')}</textarea>
      <button class="btn block" id="check" style="margin-top:10px">${t('check')}</button>
    </div>
    <div id="result"></div>
  `;
  const ta = $('#answer');
  ta.addEventListener('input', () => { drafts[q.id] = ta.value; });
  $('#check').addEventListener('click', () => {
    if (!ta.value.trim()) { toast(t('open.writeFirst')); ta.focus(); return; }
    const ans = norm(ta.value);
    const hits = q.kw.map((k) => ({ k, hit: k.split('|').some((alt) => containsFuzzy(ta.value, alt)) }));
    const score = hits.filter((h) => h.hit).length / hits.length;
    $('#result').innerHTML = `
      <div class="card">
        <h3 style="margin-top:0">${t('open.kw', { h: hits.filter((h) => h.hit).length, n: hits.length })}</h3>
        ${hits.map((h) => `<span class="kw ${h.hit ? 'hit' : 'miss'}">${h.hit ? '✓' : '✗'} ${esc(h.k.split('|')[0])}</span>`).join('')}
        <h3>${t('open.model')}</h3>
        <p class="small">${esc(q.a)}</p>${btn3d(`${q.q} ${q.a}`, { style: 'margin-bottom:10px' })}
        <h3>${t('open.rate')}</h3>
        <div class="grid2" style="grid-template-columns:1fr 1fr 1fr">
          <button class="btn danger" data-s="0">${t('open.no')}</button>
          <button class="btn plain" data-s="0.5">${t('open.partly')}</button>
          <button class="btn" data-s="1">${t('open.yes')}</button>
        </div>
      </div>`;
    $$('[data-s]').forEach((b) => b.addEventListener('click', () => {
      // Mittelwert aus Schlüsselbegriffen und Selbsteinschätzung
      store.recordOpen(q.id, (score + +b.dataset.s) / 2);
      delete drafts[q.id];
      toast(t('saved'));
      location.hash = '#/sorular';
    }));
    $('#result').scrollIntoView({ behavior: 'smooth' });
  });
}

// ───────────────────────── Karteikarten ─────────────────────────
function renderDecks() {
  const rows = DECKS().map((d) => {
    const cards = deckCards(d.id === 'vocab:Eigene' ? 'vocab:Eigene' : d.id);
    const due = store.dueCount(cards);
    const fresh = cards.filter((c) => store.isNew(c.id)).length;
    return `<a href="#/oturum/${encodeURIComponent(d.id)}"><span class="grow"><b>${esc(d.name)}</b><div class="muted small">${esc(d.sub)}</div></span>
      ${due ? `<span class="badge warn">${t('decks.due', { n: due })}</span>` : ''}<span class="badge">${t(d.id.startsWith('fehler') ? 'decks.fehlerN' : 'decks.newN', { n: fresh })}</span></a>`;
  });
  view.innerHTML = `
    <div class="section-title">${t('decks.title')}</div>
    <div class="list">${rows.join('')}</div>
    <div class="grid2">
      <a class="btn ghost" href="#/liste">${t('decks.list')}</a>
      <button class="btn ghost" id="revBtn">${store.get().settings.reverse ? t('decks.dirRev') : t('decks.dir')}</button>
    </div>
    <div class="card">
      <h2>${t('decks.addH')}</h2>
      <p class="muted small">${t('decks.addSub')}</p>
      <input type="text" id="newDe" placeholder="${t('decks.phDe')}" style="margin-top:8px">
      <input type="text" id="newTr" placeholder="${t('decks.phTr')}" style="margin-top:8px">
      <input type="text" id="newEx" placeholder="${t('decks.phEx')}" style="margin-top:8px">
      <button class="btn block" id="addWord" style="margin-top:10px">${t('decks.add')}</button>
    </div>
  `;
  $('#revBtn').addEventListener('click', () => { store.get().settings.reverse = !store.get().settings.reverse; store.save(); renderDecks(); });
  $('#addWord').addEventListener('click', () => {
    const de = $('#newDe').value.trim();
    const tr = $('#newTr').value.trim();
    if (!de || !tr) { toast(t('decks.need')); return; }
    const s = store.get();
    if (allVocab().some((v) => v.de === de)) { toast(t('decks.exists')); return; }
    // Im Englisch-Modus eingegebene Übersetzung gilt auch als englisches Feld
    s.customVocab.push({ id: 'v:' + de, de, tr, ...(lang() === 'en' ? { en: tr } : {}), ex: $('#newEx').value.trim(), cat: 'Eigene' });
    store.save();
    toast(t('decks.added'));
    renderDecks();
  });
}

let session = null;
const FEHLER_PER_DAY = 20;

function renderCardSession([deckId]) {
  // unbekanntes Deck (z. B. aus einem Link): Hinweis statt „heute fertig“
  const known = DECKS().some((d) => d.id === deckId) || /^(fehler|ders):/.test(deckId) || deckId === 'fehler'
    || (deckId.startsWith('vocab:') && vocabCategories().includes(deckId.slice(6)));
  if (!known) { view.innerHTML = `<p class="empty">${t('cards.notFound')}</p><a class="btn block" href="#/kartlar">${t('route.kartlar')}</a>`; return; }
  if (!session || session.deck !== deckId) {
    const cards = deckCards(deckId);
    let queue = store.buildSession(cards, { noNewLimit: deckId.startsWith('fehler') || deckId === 'odev' });
    let later = 0;
    if (deckId.startsWith('fehler')) {
      // Höchstens 20 Fehlerkarten pro Tag: heutige Fächer zuerst, dann fällige, dann die am häufigsten vergessenen
      const fs = todayFaecher();
      const fach = Object.fromEntries(fehlerList().map((f) => [f.id, f.fach]));
      const srs = store.get().srs;
      const ex = examFaecher(7); // Prüfung bald → diese Karten ganz vorne
      const key = (c) => [ex.includes(fach[c.id]) ? 0 : fs.includes(fach[c.id]) ? 1 : 2, store.isDue(c.id) ? 0 : 1, -((srs[c.id] || {}).lapses || 0)];
      queue.sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
      const seen = store.day().fehlerSeen || [];
      const cap = Math.max(0, FEHLER_PER_DAY - seen.length);
      later = Math.max(0, queue.length - cap);
      queue = queue.slice(0, cap);
    }
    session = { deck: deckId, queue, done: 0, flipped: false, later };
  }
  const deck = DECKS().find((d) => d.id === deckId);
  $('#title').textContent = deck ? deck.name : t('route.kartlar');
  const card = session.queue[0];
  if (!card) {
    if (deckId.startsWith('fehler:')) markDonus('fehler');
    if (deckId === 'odev') markDonus('odev');
    view.innerHTML = `
      <div class="empty"><div style="font-size:48px">🎉</div><h2>${t('cards.doneH')}</h2>
      <p>${t('cards.doneN', { n: session.done })}</p>${session.later ? `<p class="muted">${t('cards.later', { n: session.later, max: FEHLER_PER_DAY })}</p>` : ''}</div>
      <div class="grid2"><a class="btn ghost" href="#/kartlar">${t('cards.backDecks')}</a><a class="btn" href="#/bugun">${t('route.bugun')}</a></div>`;
    session = null;
    return;
  }
  store.markIntroduced(card.id);
  const c = store.get().srs[card.id];
  const isNewCard = c.reps === 0;
  const ivl = (r) => ivlLabel(store.nextInterval(c, r).label);
  // Vorderseite deutsch/lateinisch? Bei „TR → DE“ steht das deutsche Wort hinten
  const deFront = !(store.get().settings.reverse && card.de);
  // Ters kart: abhaken, welche Muskeln man wusste
  if (card.parts && session.rvId !== card.id) { session.rvId = card.id; session.rvKnown = []; }
  view.innerHTML = `
    <div class="row"><span class="muted small">${t('cards.left', { n: session.queue.length })}</span><span class="spacer"></span>${deckId.startsWith('fehler') ? `<span class="badge bad">${t('cards.badgeFehler')}</span>` : deckId === 'odev' ? `<span class="badge warn">${t('cards.badgeOdev')}</span>` : isNewCard ? `<span class="badge good">${t('badge.new')}</span>` : ''}</div>
    <div class="flash ${session.flipped ? 'flipped' : ''}" id="flash">
      <div class="flash-inner">
        <div class="face front"><span class="badge tag">${esc(card.tag)}</span><div class="big">${escGap(card.front)}</div>${deFront ? say(card.de || card.front) : ''}${card.frontSub ? `<div class="sub">${esc(card.frontSub)}</div>` : ''}<div class="sub" style="margin-top:24px">${t('cards.tap')}</div></div>
        <div class="face back${card.parts ? ' multi' : ''}">${deFront ? '' : say(card.de)}${card.back}${btn3d(card.front + ' ' + card.back.replace(/<[^>]+>/g, ' '), { style: 'margin-top:12px', stop: true, block: false })}</div>
      </div>
    </div>
    <div id="rateBox" ${session.flipped ? '' : 'hidden'}>
      ${card.parts ? `<p class="muted small" style="margin:0 0 6px">${t('rev.howMany')}</p>
      <div class="rv-pick">${card.parts.map((p, i) => `<button class="chip${session.rvKnown.includes(i) ? ' on' : ''}" data-k="${i}" aria-pressed="${session.rvKnown.includes(i)}">${esc(p.la)}</button>`).join('')}</div>
      <div class="rate" id="rvRate"></div>` : `<div class="rate">
        <button class="r0" data-r="0">${t('rate.0')}<small>${ivl(0)}</small></button>
        <button class="r1" data-r="1">${t('rate.1')}<small>${ivl(1)}</small></button>
        <button class="r2" data-r="2">${t('rate.2')}<small>${ivl(2)}</small></button>
        <button class="r3" data-r="3">${t('rate.3')}<small>${ivl(3)}</small></button>
      </div>`}
    </div>
    <button class="btn block" id="showBtn" ${session.flipped ? 'hidden' : ''}>${t('cards.show')}</button>
  `;
  const flip = () => {
    session.flipped = !session.flipped;
    $('#flash').classList.toggle('flipped', session.flipped);
    $('#rateBox').hidden = !session.flipped;
    $('#showBtn').hidden = session.flipped;
  };
  // Knöpfe/Links auf der Karte (3D, 🔊) drehen die Karte nicht um
  $('#flash').addEventListener('click', (e) => { if (!e.target.closest('a, button, [data-stop]')) flip(); });
  $('#showBtn').addEventListener('click', flip);
  const onRate = (r) => {
    const step = store.nextInterval(store.get().srs[card.id], r);
    if (card.parts) store.rateParts(card.id, session.rvKnown.length, card.parts.length, r);
    else store.rate(card.id, r);
    if (deckId.startsWith('fehler')) { const d = store.day(); d.fehlerSeen = [...new Set([...(d.fehlerSeen || []), card.id])]; store.save(); }
    session.queue.shift();
    if (step.requeue === 'soon') session.queue.splice(Math.min(3, session.queue.length), 0, card); // gleich nochmal
    else if (step.requeue === 'end') session.queue.push(card);                                      // am Ende dieser Sitzung
    else session.done++;
    session.flipped = false;
    renderCardSession([deckId]);
  };
  if (card.parts) {
    // Alle gewusst → Gut/Leicht wählen; sonst eine Bewertung nach Anteil (≥ Hälfte = Schwer, sonst Nochmal) + ✗-Liste
    const drawRate = () => {
      const k = session.rvKnown.length, n = card.parts.length;
      const r = partsRating(k, n);
      $('#rvRate').style.gridTemplateColumns = k === n ? '1fr 1fr' : '1fr';
      $('#rvRate').innerHTML = k === n
        ? `<button class="r2" data-r="2">${t('rate.2')} · ${k}/${n}<small>${ivl(2)}</small></button><button class="r3" data-r="3">${t('rate.3')}<small>${ivl(3)}</small></button>`
        : `<button class="r${r}" data-r="${r}">${t('rev.save', { k, n })} · ${t('rate.' + r)}<small>${ivl(r)} · ${t('rev.toList')}</small></button>`;
      $$('#rvRate [data-r]').forEach((b) => b.addEventListener('click', () => onRate(+b.dataset.r)));
    };
    $$('.rv-pick [data-k]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.k;
      session.rvKnown = session.rvKnown.includes(i) ? session.rvKnown.filter((x) => x !== i) : [...session.rvKnown, i];
      b.classList.toggle('on', session.rvKnown.includes(i));
      b.setAttribute('aria-pressed', session.rvKnown.includes(i));
      drawRate();
    }));
    drawRate();
  } else $$('[data-r]').forEach((b) => b.addEventListener('click', () => onRate(+b.dataset.r)));
}

function renderWordList() {
  view.innerHTML = `
    <input type="search" id="wq" placeholder="${t('list.search')}" style="margin-top:8px">
    <div id="wl"></div>`;
  const draw = () => {
    const q = norm($('#wq').value);
    const list = allVocab().filter((v) => !q || norm(v.de + ' ' + v.tr + ' ' + vocabTr(v)).includes(q));
    const byCat = Object.create(null);
    list.forEach((v) => (byCat[v.cat] = byCat[v.cat] || []).push(v));
    $('#wl').innerHTML = Object.entries(byCat).map(([cat, vs]) => `
      <div class="section-title" lang="de">${esc(cat)}</div>
      <div class="list">${vs.map((v) => `<div><span class="grow"><b>${esc(v.de)}</b><div class="small">${esc(vocabTr(v))}</div>${v.ex ? `<div class="muted small">${esc(v.ex)}</div>` : ''}</span>
        ${v.cat === 'Eigene' ? `<button class="btn danger" style="min-height:32px;padding:4px 10px" data-del="${esc(v.id)}">${t('list.del')}</button>` : ''}</div>`).join('')}</div>`).join('') || `<p class="empty">${t('noResults')}</p>`;
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const s = store.get();
      s.customVocab = s.customVocab.filter((v) => v.id !== b.dataset.del);
      store.save();
      draw();
    }));
  };
  $('#wq').addEventListener('input', draw);
  draw();
}

// ───────────────────────── 3D ─────────────────────────
let threeLoading = null;

async function render3D(_, params) {
  if (!viewer) {
    if (!threeLoading) {
      $('#hint3d').textContent = t('h3d.loading');
      threeLoading = import('./anatomy3d.js').then(({ Anatomy3D }) => {
        viewer = new Anatomy3D($('#canvas3d'), { onSelect: (sid, o) => (o && o.focus ? openFrom(sid) : showSheet(sid)) });
        viewer.onPart = (k) => (k && k.group ? showTourStep(tour.ids.indexOf(k.group)) : renderFocusSheet(k));
        viewer.onLandmark = (lid) => (focusState ? openFrom(lid) : startFocus(lid));
        viewer.onQuizTap = onQuizTap;
        $('#hint3d').textContent = t('h3d.hint');
        setup3DControls();
      }).catch((e) => {
        $('#hint3d').textContent = t('h3d.fail', { msg: e.message });
        threeLoading = null;
        throw e;
      });
    }
    try { await threeLoading; } catch { return; }
  }
  if (current !== '3d') return;
  viewer.start();
  // #/3d?quiz=pelvis – „Noktayı bul“
  if (params.get('quiz')) {
    $('#hint3d').textContent = t('h3d.preparing');
    await viewer.ready;
    $('#hint3d').textContent = t('h3d.hint');
    if (current === '3d') startPointQuiz(params.get('quiz'));
    return;
  }
  // #/3d?ids=a,b,c (mehrere Strukturen nacheinander) – altes #/3d?id=a funktioniert weiter
  const ids = (params.get('ids') || params.get('id') || '').split(',').map((x) => x.trim()).filter((x) => findAny(x));
  if (!ids.length) return;
  $('#hint3d').textContent = t('h3d.preparing');
  await viewer.ready;
  if (current !== '3d') return;
  focusHistory = [];
  if (ids.length > 1) { tour = { ids, k: 0 }; showTourStep(0); } else startFocus(ids[0]);
}

// ───── Fokusmodus: Muskel (Teile, Ursprung/Ansatz, tiefere Muskeln), Knochen, Gelenk, Knochenpunkt ─────
let focusState = null;
let tour = null;           // { ids, k } – Schritt k; k === ids.length = alle zusammen
let focusHistory = [];     // für „‹ Geri“ nach dem Antippen eines Knochenpunkts / Muskels

function startFocus(id, { ghosts = [], keepTour = false } = {}) {
  const s = findAny(id);
  if (!keepTour) tour = null;
  const info = s && viewer.enterFocus(id, { ghosts });
  if (!info) { if (focusState) exitFocus(); showSheet(id); return; }
  focusState = { id, s, info, axes: false };
  document.body.classList.add('focus3d');
  $('#hint3d').hidden = true;
  renderFocusSheet(null);
}

// Von der aktuellen Fokusansicht zu einer anderen Struktur springen (mit „‹ Geri“)
function openFrom(id) {
  if (focusState) focusHistory.push({ id: focusState.id, tour: tour && { ...tour } });
  startFocus(id);
}

function goBack() {
  const h = focusHistory.pop();
  if (!h) return;
  if (h.tour) { tour = h.tour; showTourStep(tour.k); } else if (h.id) startFocus(h.id);
}

function showTourStep(k) {
  if (!tour || k < 0 || k > tour.ids.length) return;
  tour.k = k;
  if (k < tour.ids.length) { startFocus(tour.ids[k], { ghosts: tour.ids.slice(0, k), keepTour: true }); return; }
  const info = viewer.enterGroup(tour.ids);
  if (!info) return;
  focusState = { id: null, s: null, info };
  document.body.classList.add('focus3d');
  $('#hint3d').hidden = true;
  renderFocusSheet(null);
}

function exitFocus() {
  $('#sheet3d').classList.remove('pq-end');
  const id = focusState && focusState.id;
  const kind = focusState && focusState.info.kind;
  focusState = null;
  tour = null;
  focusHistory = [];
  pq = null;
  viewer.exitFocus();
  document.body.classList.remove('focus3d', 'pq3d');
  if (id && kind !== 'landmark') viewer.select(id); else showSheet(null);
}

function stepperHtml() {
  const back = focusHistory.length ? `<button class="chip" id="fBack">${t('back')}</button>` : '';
  if (!tour) return back ? `<div class="stepper">${back}</div>` : '';
  const n = tour.ids.length, k = tour.k;
  return `<div class="stepper">${back}<button class="chip" id="stPrev" ${k === 0 ? 'disabled' : ''}>${t('prev')}</button>
    <span class="count">${k < n ? `${k + 1}/${n}` : t('all')}</span>
    <button class="chip" id="stNext" ${k >= n ? 'disabled' : ''}>${k === n - 1 ? t('allNext') : t('next')}</button></div>`;
}

const lmChip = (l, prefix = '') => `<button class="chip lm-go" data-go="${l.id}">${prefix}${esc(shortLa(l))}</button>`;
const muscleChip = (id) => { const m = findStructure(id); return m ? `<button class="chip lm-go" data-go="${id}">${esc(m.la)}</button>` : ''; };

function renderFocusSheet(k) {
  if (!focusState) return;
  const { s, info } = focusState;
  if (info.kind === 'quiz') { renderPointQuizSheet(); return; }
  const sheet = $('#sheet3d');
  sheet.hidden = false;
  sheet.classList.remove('collapsed');
  const head = (badge, cls) => `${stepperHtml()}
    <button class="close" aria-label="${t('f.allBody')}">✕</button>
    <span class="badge ${cls}">${badge}</span>
    <h2 style="margin:6px 0 0;font-size:18px">${esc(s.la)}</h2>
    <div class="muted small">${esc(s.de)} · ${flagFor(s)} ${esc(tx(s))}</div>`;
  const foot = (lesson = true) => `<div class="grid2" style="margin-top:8px">
      <button class="btn plain" id="exitFocus">${t('f.allBody')}</button>
      ${lesson && s && findStructure(s.id) ? `<a class="btn" href="#/ders/${s.id}">${t('btn.openLesson')}</a>` : `<button class="btn" data-back>${t('f.goBack')}</button>`}
    </div>`;
  let body = '';
  if (info.kind === 'muscle') {
    const part = k !== null && k !== undefined ? info.parts[k] : null;
    const o = part ? partText(s.o, part.la) : s.o;
    const i = part ? partText(s.i, part.la) : s.i;
    const lmRole = (r) => info.landmarks.filter((x) => x.role === r).map((x) => findLandmark(x.id));
    const lmLine = [...lmRole('o').map((l) => lmChip(l, '🟢 ')), ...lmRole('i').map((l) => lmChip(l, '🔵 ')), ...lmRole('via').map((l) => lmChip(l, '🟠 '))].join('');
    body = `${head(kindLabel('muscle'), 'muscle')} <span class="badge">${t('f.layer', { x: layerName(info.layer) })}</span>
    ${info.parts.length > 1 ? `<div class="chips" style="margin-top:10px">${info.parts.map((p, n) => `<button class="chip part-chip ${n === k ? 'on' : ''}" data-part="${n}"><span class="dot" style="background:${p.color}"></span>${esc(p.la)}</button>`).join('')}</div>` : ''}
    ${part ? `<div class="small" style="margin-top:8px"><b lang="de">${esc(part.la)}</b> · ${esc(part.de)} · ${flag()} ${esc(part.en && lang() === 'en' ? part.en : part.la === s.la ? tx(s) : part.tr)}</div>` : ''}
    <dl class="facts small" lang="de">
      <dt>🟢 Ursprung</dt><dd>${esc(o)}</dd>
      <dt>🔵 Ansatz</dt><dd>${esc(i)}</dd>
      ${part ? '' : `<dt>Innervation</dt><dd>${esc(s.inn)}</dd><dt>Funktion</dt><dd>${esc(s.f)}</dd>`}
    </dl>
    ${lmLine ? `<div class="small muted" style="margin-top:6px">${t('f.lmTap')}</div><div class="lm-list">${lmLine}</div>` : ''}
    <p class="muted small" style="margin:8px 0 0">🟢 Ursprung · 🔵 Ansatz${lmRole('via').length ? t('f.legend.via') : ''}${t('f.legend.deep')}${tour && tour.k ? t('f.legend.grey') : ''}${info.parts.length > 1 ? t('f.legend.parts') : ''}</p>
    ${foot()}`;
  } else if (info.kind === 'bone') {
    const lms = info.landmarks.map(findLandmark);
    body = `${head(kindLabel('bone'), 'bone')}
    <p class="small" style="margin:6px 0">${esc(s.typ || '')}</p>
    ${s.merk ? `<dl class="facts small" lang="de"><dt>Wichtige Strukturen</dt><dd>${esc(s.merk)}</dd></dl>` : ''}
    ${lms.length ? `<div class="small muted" style="margin-top:6px">${t('f.boneLms')}</div><div class="lm-list">${lms.map((l) => lmChip(l)).join('')}</div>` : ''}
    ${foot()}`;
  } else if (info.kind === 'joint') {
    body = `${head(kindLabel('joint'), 'joint')}
    <p class="small" style="margin:6px 0">${esc(s.typ || '')}</p>
    <dl class="facts small" lang="de"><dt>Neutral-Null</dt><dd>${esc(s.nn || '')}</dd>${s.baender ? `<dt>Bänder</dt><dd>${esc(s.baender)}</dd>` : ''}</dl>
    ${info.axes.length ? `<button class="btn ghost block" id="axesBtn" style="margin-top:8px">${focusState.axes ? t('f.axesHide') : t('f.axesShow')}</button>
      ${focusState.axes ? `<div class="small" style="margin-top:8px" lang="de">${info.axes.map((a) => `<div style="margin:4px 0"><span class="dot" style="background:${a.color}"></span><b>${esc(a.la)}</b> <span class="muted">(${esc(tx(a))})</span> → ${esc(a.mv)} <span class="muted">· in der ${esc(a.ebene)}</span></div>`).join('')}</div>` : ''}` : ''}
    ${foot()}`;
  } else if (info.kind === 'landmark') {
    const bone = findStructure(s.bone);
    const list = (ids, title) => (ids.length ? `<div class="small" style="margin-top:8px"><b>${title}</b></div><div class="lm-list">${ids.map(muscleChip).join('')}</div>` : '');
    body = `${head(kindLabel('landmark'), 'landmark')}
    <div class="small" style="margin-top:4px">${t('f.bone')} <b lang="de">${esc(bone ? bone.la : s.bone)}</b>${s.note ? ` · <span lang="de">${esc(s.note)}</span>` : ''}</div>
    ${list(info.o, t('f.lmO'))}
    ${list(info.i, t('f.lmI'))}
    ${list(info.via, t('f.lmVia'))}
    ${!info.o.length && !info.i.length && !info.via.length ? `<p class="muted small">${t('f.lmNone')}</p>` : ''}
    ${s.approx ? `<p class="muted small">${t('f.coccyx')}</p>` : ''}
    ${foot(false)}`;
  } else if (info.kind === 'group') {
    body = `${stepperHtml()}<button class="close" aria-label="${t('f.allBody')}">✕</button>
    <h2 style="margin:2px 0 0;font-size:18px">${t('f.groupH', { n: info.legend.length })}</h2>
    <div class="legend">${info.legend.map((x) => { const st = findAny(x.id); return `<button data-step="${tour.ids.indexOf(x.id)}"><span class="dot" style="background:${x.color}"></span><span class="grow"><b lang="de">${esc(shortName(st))}</b> <span class="muted small">· ${esc(tx(st))}</span></span><span class="badge ${st.kind}">${kindLabel(st.kind)}</span></button>`; }).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">${t('f.groupHint')}</p>
    ${foot(false)}`;
  }
  sheet.innerHTML = body;
  $('.close', sheet).addEventListener('click', exitFocus);
  $('#exitFocus').addEventListener('click', exitFocus);
  if ($('#fBack')) $('#fBack').addEventListener('click', goBack);
  if ($('#stPrev')) $('#stPrev').addEventListener('click', () => showTourStep(tour.k - 1));
  if ($('#stNext')) $('#stNext').addEventListener('click', () => showTourStep(tour.k + 1));
  $$('[data-step]', sheet).forEach((b) => b.addEventListener('click', () => showTourStep(+b.dataset.step)));
  $$('.lm-go', sheet).forEach((b) => b.addEventListener('click', () => openFrom(b.dataset.go)));
  if ($('#axesBtn')) $('#axesBtn').addEventListener('click', () => { focusState.axes = !focusState.axes; viewer.setAxes(focusState.axes); renderFocusSheet(null); });
  $$('.part-chip', sheet).forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.part;
    const next = n === k ? null : n;
    viewer.focusPart(next);
    renderFocusSheet(next);
  }));
}

// ───── Quiz „Noktayı bul“: Knochenpunkt bzw. Ursprung/Ansatz eines Muskels am Modell antippen ─────
const PQ_SETS = { pelvis: ['os_coxae', 'sacrum', 'femur'], femur: ['femur'] };
// Becken-Quiz: nur das obere Femur (Knie-Punkte gehören zum Femur-Quiz, sonst müsste man weit herauszoomen)
const PQ_ONLY = { pelvis: (l) => l.bone !== 'femur' || l.pos[1] > 0.6 };
// Toleranz in Metern; lange oder flächige Strukturen großzügiger (sy < 1: in der Höhe großzügiger).
// Tuberculum adductorium und Epicondylus medialis liegen nur ~1,6 cm auseinander → enger.
// area = Fläche/Loch/Linie: feste Toleranz, nicht durch Nachbarpunkte verkleinert
const PQ_TOL = { crista_iliaca: { tol: 0.035, area: true }, linea_aspera: { tol: 0.02, sy: 0.2, area: true }, foramen_obturatum: { tol: 0.025, area: true }, acetabulum: { tol: 0.025, area: true },
  linea_intertrochanterica: { tol: 0.025 }, tuberositas_glutea: { tol: 0.02, sy: 0.5 },
  condylus_medialis_femoris: { tol: 0.022 }, condylus_lateralis_femoris: { tol: 0.022 },
  tuberculum_adductorium: { tol: 0.013 }, epicondylus_medialis_femoris: { tol: 0.013 } };
const PQ_ROUNDS = 10;
let pq = null; // { set, qs, k, results, answer }

function pointQuestions(set) {
  const bones = Object.hasOwn(PQ_SETS, set) ? PQ_SETS[set] : PQ_SETS.pelvis;
  const only = (Object.hasOwn(PQ_ONLY, set) && PQ_ONLY[set]) || (() => true);
  const lms = LANDMARKS.filter((l) => bones.includes(l.bone) && only(l));
  const qs = lms.map((l) => ({ id: 'lm:' + l.id, kind: 'point', ans: [l] }));
  for (const role of ['o', 'i']) {
    const by = {};
    for (const l of lms) for (const mid of l[role] || []) (by[mid] = by[mid] || []).push(l);
    for (const [mid, ans] of Object.entries(by)) {
      const m = findStructure(mid);
      if (m) qs.push({ id: `lm:${role}:${mid}`, kind: role, m, ans });
    }
  }
  return qs;
}

// 6 Knochenpunkte + 4 Muskelfragen, schwache/neue bevorzugt; only = nur diese IDs (Fehler wiederholen)
function buildPointQuiz(set, only = null) {
  const all = pointQuestions(set);
  if (only) return shuffle(all.filter((q) => only.includes(q.id)));
  const w = (q) => weight(q.id);
  const pts = wpick(all.filter((q) => q.kind === 'point'), 6, w);
  return shuffle([...pts, ...wpick(all.filter((q) => q.kind !== 'point'), PQ_ROUNDS - pts.length, w)]);
}

function startPointQuiz(set = 'pelvis', only = null) {
  if (focusState) exitFocus();
  if (!Object.hasOwn(PQ_SETS, set)) set = 'pelvis'; // unbekannter Name aus einem Link
  const info = viewer.enterPointQuiz(PQ_SETS[set]);
  if (!info) { toast(t('pq.notReady')); return; }
  pq = { set, qs: buildPointQuiz(set, only), k: 0, results: [], answer: null, ...pqNeighbors(set) };
  focusState = { id: null, s: null, info };
  document.body.classList.add('focus3d', 'pq3d'); // pq3d: Ansicht-Knöpfe ausblenden, damit sie keine Punkte verdecken
  $('#hint3d').hidden = true;
  renderPointQuizSheet();
}

const pqCm = (d) => dec((d * 100).toFixed(1)) + ' cm';

// Faire Toleranz: nie mehr als 60 % des Abstands zum nächsten anderen Punkt der Runde (mind. 1,2 cm),
// damit nah beieinander liegende Punkte (SIAS/SIAI, Epicondylus/Tuberculum adductorium) nicht beide zählen
function pqNeighbors(set) {
  const bones = PQ_SETS[set] || PQ_SETS.pelvis;
  const only = (Object.hasOwn(PQ_ONLY, set) && PQ_ONLY[set]) || (() => true);
  const lms = LANDMARKS.filter((l) => bones.includes(l.bone) && only(l));
  const nn = {};
  for (const l of lms) nn[l.id] = Math.min(Infinity, ...lms.filter((o) => o !== l).map((o) => Math.hypot(o.pos[0] - l.pos[0], o.pos[1] - l.pos[1], o.pos[2] - l.pos[2])));
  return { lms, nn };
}
function pqTol(l) {
  const base = PQ_TOL[l.id] || {};
  const nn = (pq && pq.nn && pq.nn[l.id]) || Infinity;
  if (base.area) return base;
  return { ...base, tol: Math.min(base.tol || 0.02, Math.max(0.012, nn * 0.6)) };
}

function onQuizTap(hit, ray) {
  if (!pq || pq.answer || pq.k >= pq.qs.length) return;
  const q = pq.qs[pq.k];
  let best = null;
  for (const l of q.ans) {
    const r = viewer.judgePoint(l, hit, ray, pqTol(l));
    if (!best || r.d < best.d) best = { ...r, l };
  }
  if (!hit && !best.ok) { toast(t('pq.tapBone')); return; }
  // näher an einem anderen Punkt als am gefragten → falsch, und sagen, welcher es war
  if (best.ok) {
    for (const o of pq.lms || []) {
      if (q.ans.includes(o)) continue;
      const r = viewer.judgePoint(o, hit, ray, { ...pqTol(o), tol: 0 });
      if (r.d < best.d && r.d <= pqTol(o).tol) { best = { ...best, ok: false, other: o }; break; }
    }
  }
  // knapp daneben, aber so weit herausgezoomt, dass 2 cm kaum ein Fingertipp sind → nicht werten
  if (!best.ok && !best.other && best.d < 0.05 && viewer.pxPer(best.pos, 0.02) < 22) { toast(t('pq.zoom')); return; }
  answerPoint(q, best.ok, { tap: hit, best });
}

function answerPoint(q, ok, { tap = null, best = null } = {}) {
  store.recordQuiz(q.id, ok);
  pq.results.push({ q, ok });
  pq.answer = { ok, skipped: !tap && !best, d: best ? best.d : null, hitLm: best && best.l, other: best && best.other };
  if (tap) viewer.quizMark(tap, ok ? 0x16a34a : 0xdc2626, null, 0.004);
  // richtige Punkte zeigen – auf der Seite, auf die getippt wurde
  const right = tap && tap.x < 0 ? -1 : 1;
  for (const l of q.ans) viewer.quizMark(viewer.lmPos(l, right), 0x9333ea, shortLa(l), 0.006);
  if (!ok) { viewer.quizLook(viewer.lmPos(best && best.l ? best.l : q.ans[0], right)); pq.moved = true; }
  renderPointQuizSheet();
}

function nextPoint() {
  viewer.quizClear();
  if (pq.moved) { viewer.quizHome(); pq.moved = false; }
  pq.answer = null;
  pq.k++;
  if (pq.k >= pq.qs.length) {
    const r = pq.results.filter((x) => x.ok).length;
    const d = store.day();
    d.lmQuiz = { r: Math.max(r, (d.lmQuiz || {}).r || 0), n: pq.results.length };
    store.save();
  }
  renderPointQuizSheet();
}

function pqPrompt(q) {
  if (q.kind === 'point') {
    const l = q.ans[0];
    return `<h2 style="margin:4px 0 0;font-size:18px" lang="la">${esc(l.la)}</h2>
      <div class="muted small"><span lang="de">${esc(l.de)}</span> · ${flagFor(l)} ${esc(tx(l))}</div>
      <div class="small" style="margin-top:6px">${t('pq.showPoint')}</div>`;
  }
  const verb = q.kind === 'o' ? t('pq.origin') : t('pq.insert');
  return `<div class="small muted" style="margin-top:2px" lang="de">${q.kind === 'o' ? '🟢 Ursprung' : '🔵 Ansatz'}</div>
    <h2 style="margin:2px 0 0;font-size:18px"><span lang="la">${esc(q.m.la.replace(/\s*\(.*\)$/, ''))}</span> ${verb}</h2>
    <div class="small" style="margin-top:6px">${t('pq.showLm')}${q.ans.length > 1 ? ` <span class="muted">${t('pq.multi')}</span>` : ''}</div>`;
}

function renderPointQuizSheet() {
  const sheet = $('#sheet3d');
  sheet.hidden = false;
  sheet.classList.remove('collapsed');
  const n = pq.qs.length;
  sheet.classList.toggle('pq-end', pq.k >= n);
  const close = `<button class="close" aria-label="${t('close')}">✕</button>`;
  let body;
  if (pq.k >= n) {
    const r = pq.results.filter((x) => x.ok).length;
    const wrong = pq.results.filter((x) => !x.ok).map((x) => x.q);
    body = `${close}<div class="eyebrow">${t('pq.title')} · ${t('pq.result')}</div>
      <h2 style="margin:6px 0 0;font-size:22px">${t('pq.nCorrect', { r, n })} ${r === n ? '🎉' : r >= n * 0.7 ? '👍' : '💪'}</h2>
      <div class="muted small">${t(r === n ? 'pq.all' : r >= n * 0.7 ? 'pq.good' : 'pq.more')}</div>
      ${wrong.length ? `<div class="small" style="margin-top:10px"><b>${t('yourWrong')}</b></div><div class="small" style="margin-top:4px">${wrong.map((q) => `<div style="margin:4px 0">• ${q.kind === 'point' ? `<b lang="la">${esc(shortLa(q.ans[0]))}</b> <span class="muted">· ${esc(tx(q.ans[0]))}</span>` : `<span lang="de">${q.kind === 'o' ? 'Ursprung' : 'Ansatz'}</span> ${esc(q.m.la.replace(/\s*\(.*\)$/, ''))} → <b lang="la">${q.ans.map((l) => esc(shortLa(l))).join(', ')}</b>`}</div>`).join('')}</div>` : ''}
      <div class="grid2" style="margin-top:10px">
        ${wrong.length ? `<button class="btn ghost" id="pqRetry">${t('retryWrong')}</button>` : `<button class="btn plain" id="pqExit">${t('finish')}</button>`}
        <button class="btn" id="pqAgain">${t('pq.again')}</button>
      </div>
      ${wrong.length ? `<button class="btn plain block" id="pqExit" style="margin-top:8px">${t('finish')}</button>` : ''}
      <button class="btn ghost block" id="pqOther" style="margin-top:8px">${t(pq.set === 'femur' ? 'pq.toPelvis' : 'pq.toFemur')}</button>`;
  } else {
    const q = pq.qs[pq.k];
    const a = pq.answer;
    let fb = '';
    if (a) {
      const where = q.ans.map((l) => `<b lang="la">${esc(shortLa(l))}</b>`).join(', ');
      fb = a.ok
        ? `<div class="pq-fb ok">${t('pq.ok')} ${a.hitLm && q.ans.length > 1 ? `<b lang="la">${esc(shortLa(a.hitLm))}</b> · ` : ''}<span class="muted">${t('pq.dist', { d: pqCm(a.d) })}</span></div>`
        : `<div class="pq-fb bad">${a.skipped ? '' : a.other ? t('pq.wrongOther', { x: `<b lang="la">${esc(shortLa(a.other))}</b>` }) : a.d < 1 ? t('pq.wrongD', { d: pqCm(a.d) }) : t('pq.wrongX')}${t(q.ans.length > 1 ? 'pq.rights' : 'pq.right')}: ${where} ${t('pq.marked')}</div>`;
      if (q.kind !== 'point') fb += `<div class="muted small" style="margin-top:4px">${q.ans.map((l) => `<span lang="de">${esc(l.de)}</span>`).join(' · ')}</div>`;
    }
    body = `${close}<div class="stepper"><span class="eyebrow" style="flex:1">${t('pq.title')} · ${pq.k + 1}/${n}</span><span class="muted small">${pq.results.filter((x) => x.ok).length} ✓</span></div>
      ${pqPrompt(q)}
      ${fb}
      <div class="grid2" style="margin-top:8px">
        ${a ? '<span></span>' : `<button class="btn plain" id="pqSkip">${t('pq.skip')}</button>`}
        ${a ? `<button class="btn" id="pqNext">${pq.k + 1 < n ? t('next') : t('pq.resultBtn')}</button>` : `<span class="muted small" style="align-self:center">${t('pq.tapHint')}</span>`}
      </div>`;
  }
  sheet.innerHTML = body;
  $('.close', sheet).addEventListener('click', exitFocus);
  const on = (id, f) => { const b = $('#' + id, sheet); if (b) b.addEventListener('click', f); };
  on('pqSkip', () => answerPoint(pq.qs[pq.k], false));
  on('pqNext', nextPoint);
  on('pqExit', exitFocus);
  on('pqAgain', () => startPointQuiz(pq.set));
  on('pqOther', () => startPointQuiz(pq.set === 'femur' ? 'pelvis' : 'femur'));
  on('pqRetry', () => startPointQuiz(pq.set, pq.results.filter((x) => !x.ok).map((x) => x.q.id)));
}

function setup3DControls() {
  $$('[data-layer]').forEach((b) => b.addEventListener('click', () => {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    viewer.setLayer(b.dataset.layer, on);
  }));
  $('#lmBtn').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', on);
    viewer.setLandmarks(on);
    if (on) toast(t('toast.lm'));
  });
  $('#isolateBtn').addEventListener('click', (e) => {
    const on = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', on);
    viewer.setIsolated(on);
  });
  $('#opacity3d').addEventListener('input', (e) => viewer.setMuscleOpacity(+e.target.value));
  $$('[data-depth]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-depth]').forEach((x) => x.classList.toggle('on', x === b));
    viewer.setDepth(+b.dataset.depth);
  }));
  $('#focusExitBtn').addEventListener('click', exitFocus);
  $('#pqBtn').addEventListener('click', () => viewer.ready.then(() => startPointQuiz('pelvis')));
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => viewer.view(b.dataset.view)));
  $('#resetView').addEventListener('click', () => viewer.resetView());

  const input = $('#search3d');
  const results = $('#searchResults');
  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    if (!q) { results.hidden = true; return; }
    const found = [...ALL_STRUCTURES, ...LANDMARKS.map((l) => ({ ...l, kind: 'landmark' }))].filter((s) => norm(`${s.de} ${s.la} ${s.tr} ${s.en || ''}`).includes(q)).slice(0, 12);
    results.hidden = false;
    results.className = 'search-results list';
    results.innerHTML = found.length
      ? found.map((s) => `<button data-id="${s.id}"><span class="badge ${s.kind}">${kindLabel(s.kind)}</span><span class="grow">${esc(s.la)}<div class="muted small">${esc(s.de)} · ${esc(tx(s))}</div></span></button>`).join('')
      : `<div class="muted small">${t('noResults')}</div>`;
    $$('button', results).forEach((b) => b.addEventListener('click', () => {
      if (focusState) exitFocus();
      const hit = findAny(b.dataset.id);
      if (hit && hit.kind !== 'joint' && hit.kind !== 'bone') startFocus(b.dataset.id); else viewer.select(b.dataset.id);
      input.value = '';
      results.hidden = true;
      input.blur();
    }));
  });
}

function showSheet(id) {
  const sheet = $('#sheet3d');
  const s = id && findStructure(id);
  if (!s) { sheet.hidden = true; $('#hint3d').hidden = false; return; }
  $('#hint3d').hidden = true;
  sheet.hidden = false;
  sheet.classList.add('collapsed');
  const summary = s.kind === 'muscle' ? tx(s, 'ftr') : s.kind === 'bone' ? s.typ : `${s.typ}`;
  const more = s.kind === 'muscle'
    ? `<dl class="facts" lang="de"><dt>Ursprung</dt><dd>${esc(s.o)}</dd><dt>Ansatz</dt><dd>${esc(s.i)}</dd><dt>Innervation</dt><dd>${esc(s.inn)}</dd><dt>Funktion</dt><dd>${esc(s.f)}</dd></dl>`
    : s.kind === 'bone'
      ? `<dl class="facts" lang="de"><dt>Wichtige Strukturen</dt><dd>${esc(s.merk)}</dd></dl>`
      : `<dl class="facts" lang="de"><dt>Neutral-Null</dt><dd>${esc(s.nn)}</dd><dt>Bänder</dt><dd>${esc(s.baender)}</dd></dl>`;
  sheet.innerHTML = `
    <button class="close" aria-label="${t('close')}">✕</button>
    <span class="badge ${s.kind}">${kindLabel(s.kind)}</span>
    <h2 style="margin:6px 0 0;font-size:18px">${esc(s.la)}</h2>
    <div class="muted small">${esc(s.de)} · ${flagFor(s)} ${esc(tx(s))}</div>
    <p class="small" style="margin:6px 0">${esc(summary)}</p>
    <div class="more small">${more}${s.k || s.klinik ? `<div class="klinik">🩺 ${esc(s.k || s.klinik)}</div>` : ''}</div>
    <div class="grid2" style="margin-top:8px">
      <button class="btn plain" id="moreBtn">${t('sheet.details')}</button>
      <a class="btn" href="#/ders/${s.id}">${t('btn.openLesson')}</a>
    </div>`;
  $('.close', sheet).addEventListener('click', () => viewer.select(null));
  $('#moreBtn').addEventListener('click', (e) => {
    startFocus(s.id); // Kas: parçalar + Ursprung/Ansatz · Kemik: kemik noktaları · Eklem: hareket eksenleri
  });
}

// ───────────────────────── Einstellungen ─────────────────────────
function renderSettings() {
  const s = store.get().settings;
  view.innerHTML = `
    <div class="section-title">${t('set.lang')}</div>
    <div class="card small" style="margin-top:0">
      <div class="chips">${Object.entries(LANGS).map(([k, v]) => `<button class="chip ${lang() === k ? 'on' : ''}" data-lang="${k}">${v.flag} ${v.name}</button>`).join('')}</div>
      <div class="muted" style="margin-top:8px">${t('set.langNote')}</div>
    </div>
    <div class="section-title">${t('set.goals')}</div>
    <div class="list">
      <label><span class="grow">${t('set.cardsGoal')}</span><input type="number" min="1" max="200" id="cardsGoal" value="${s.cardsGoal}" style="width:80px"></label>
      <label><span class="grow">${t('set.quizGoal')}</span><input type="number" min="1" max="50" id="quizGoal" value="${s.quizGoal}" style="width:80px"></label>
      <label><span class="grow">${t('set.newPerDay')}</span><input type="number" min="0" max="100" id="newPerDay" value="${s.newPerDay}" style="width:80px"></label>
    </div>
    <div class="section-title">${t('set.donus')}</div>
    <div class="list">
      <label><span class="grow">${t('set.donusAfter')}</span><input type="number" min="0" max="240" step="5" id="donusAfter" value="${s.donusAfter}" style="width:80px"></label>
      <label><span class="grow">${t('set.classEnd')}</span><input type="time" id="classEnd" value="${esc(s.classEnd)}" style="width:110px"></label>
    </div>
    <p class="muted small" style="padding:0 4px">${t('set.donusNote')}</p>
    <div class="section-title">${t('set.backup')}</div>
    <p class="muted small" style="padding:0 4px">${t('set.backupNote')}</p>
    <div class="grid2">
      <button class="btn ghost" id="exportBtn">${t('set.export')}</button>
      <label class="btn ghost">${t('set.import')}<input type="file" id="importFile" accept="application/json" hidden></label>
    </div>
    <div class="section-title">${t('set.notion')}</div>
    <div class="card small" style="margin-top:0">
      ${getToken()
        ? `${t('set.connected')} · ${getPrivate() && getPrivate().syncedAt ? t('set.lastSync', { d: esc(new Date(getPrivate().syncedAt).toLocaleString(locale())) }) : t('set.neverSync')}
           <div class="grid2" style="margin-top:10px"><button class="btn" id="nSync">${t('set.syncNow')}</button><button class="btn danger" id="nDisconnect">${t('set.disconnect')}</button></div>`
        : `${t('set.notionInfo')}
           <input type="password" id="nToken" placeholder="ntn_… (Notion Internal Integration Secret)" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:10px">
           <button class="btn block" id="nConnect" style="margin-top:8px">${t('set.connect')}</button>`}
      <div id="nStatus" class="muted" style="margin-top:8px"></div>
    </div>
    <div class="section-title">${t('set.private')}</div>
    <p class="muted small" style="padding:0 4px">${t('set.privateNote')}</p>
    <div class="card small" style="margin-top:0">${getPrivate() ? `${t('set.loaded', { kw: esc(week()?.kw ?? '–'), n: fehlerList().length })}${odevList().length ? t('set.odevN', { n: odevList().length }) : ''}` : t('set.notLoaded')}</div>
    <div class="grid2">
      <label class="btn ghost">${t('set.loadPrivate')}<input type="file" id="privFile" accept="application/json,.json" hidden></label>
      <button class="btn plain" id="privClear" ${getPrivate() ? '' : 'disabled'}>${t('set.remove')}</button>
    </div>
    <div class="section-title">${t('set.other')}</div>
    <button class="btn danger block" id="resetBtn">${t('set.reset')}</button>
    <button class="btn plain block" id="wipeBtn" style="margin-top:8px">${t('set.wipe')}</button>
    <p class="muted small" style="padding:0 4px">${t('set.wipeNote')}</p>
    <p class="muted small" style="margin-top:24px;padding:0 4px">${t('set.credits', { lic: '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>' })}</p>
  `;
  $('#classEnd').addEventListener('change', (e) => {
    if (!HHMM.test(e.target.value)) { e.target.value = s.classEnd; return; }
    s.classEnd = e.target.value;
    store.save();
    toast(t('savedPlain'));
  });
  const LIMITS = { cardsGoal: [1, 200], quizGoal: [1, 50], newPerDay: [0, 100], donusAfter: [0, 240] };
  ['cardsGoal', 'quizGoal', 'newPerDay', 'donusAfter'].forEach((k) => $('#' + k).addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v)) { e.target.value = s[k]; return; }
    s[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));
    e.target.value = s[k];
    store.save();
    toast(t('savedPlain'));
  }));
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.lang === lang()) return;
    setLang(b.dataset.lang);
    applyStatic();
    navigate();
  }));
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fizyolern-yedek-${store.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5e6) { toast(t('set.tooBig')); return; }
    try {
      const data = JSON.parse(await f.text());
      if (!store.looksLikeBackup(data)) throw new Error('format');
      store.replace(data); // prüft und bereinigt alle Felder
      applyStatic(); // Sprache der Sicherung
      toast(t('set.backupLoaded'));
      renderSettings();
    } catch { toast(t('set.backupBad')); }
  });
  const nStatus = $('#nStatus');
  const runSync = async () => {
    nStatus.textContent = t('set.reading');
    try {
      const r = await syncFromNotion({ faecher: FAECHER, lessons: LESSONS });
      refreshLessons();
      toast(t('set.synced'));
      renderSettings();
      $('#nStatus').textContent = '✅ ' + r;
    } catch (err) {
      // ungültiger Schlüssel: nicht gespeichert lassen (sonst „verbunden“, obwohl nichts geht)
      if (err.status === 401) { clearToken(); renderSettings(); }
      $('#nStatus').textContent = '⚠️ ' + err.message;
    }
  };
  const nConnect = $('#nConnect');
  if (nConnect) nConnect.addEventListener('click', () => {
    const tok = $('#nToken').value.trim();
    if (!looksLikeToken(tok)) { nStatus.textContent = t('set.badToken'); return; }
    setToken(tok);
    $('#nToken').value = '';
    runSync();
  });
  const nSync = $('#nSync');
  if (nSync) nSync.addEventListener('click', runSync);
  const nDisc = $('#nDisconnect');
  if (nDisc) nDisc.addEventListener('click', () => {
    if (!confirm(t('set.confirmDisc'))) return;
    clearToken();
    // auch die aus Notion gelesenen Daten (Plan, Fehler, Ödev, Prüfungen) vom Gerät löschen?
    if (getPrivate() && confirm(t('set.confirmDiscData'))) { clearPrivate(); refreshLessons(); }
    toast(t('set.keyDeleted'));
    renderSettings();
  });
  $('#privFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5e6) { toast(t('set.tooBig')); return; }
    try {
      const stored = setPrivate(JSON.parse(await f.text())); // prüft alle Felder
      refreshLessons();
      toast(stored ? t('set.privLoaded') : t('set.storageFull'));
      renderSettings();
    } catch { toast(t('set.privBad')); }
  });
  $('#privClear').addEventListener('click', () => { clearPrivate(); refreshLessons(); toast(t('set.removed')); renderSettings(); });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm(t('set.confirmReset'))) { store.reset(); toast(t('set.resetDone')); location.hash = '#/bugun'; }
  });
  // Alles vom Gerät löschen: Fortschritt, Notion-Schlüssel, Notion-Daten, Offline-Dateien
  $('#wipeBtn').addEventListener('click', async () => {
    if (!confirm(t('set.confirmWipe'))) return;
    const doneMsg = t('set.wiped'); // vor dem Löschen (danach ist die Sprache zurückgesetzt)
    clearToken();
    clearPrivate();
    store.reset();
    try { Object.keys(localStorage).filter((k) => k.startsWith('fizyo.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignorieren */ }
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.unregister(); } catch { /* ignorieren */ }
    try { for (const k of await caches.keys()) if (k.startsWith('fizyolern-')) await caches.delete(k); } catch { /* ignorieren */ }
    alert(doneMsg);
    location.replace(location.pathname);
  });
}

$('#settingsBtn').addEventListener('click', () => (location.hash = '#/ayarlar'));

// Feste Beschriftungen in index.html (Tab-Leiste, 3D-HUD, Platzhalter) in die Hilfssprache übersetzen
function applyStatic() {
  document.documentElement.lang = lang();
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
applyStatic();

// ───────────────────────── Start ─────────────────────────
navigate();
loadLocalDevFile().then((loaded) => { if (loaded) { refreshLessons(); if (current === 'bugun') navigate(); } });

// Beim Start automatisch aus Notion aktualisieren (höchstens alle 3 Stunden, still im Hintergrund)
if (getToken() && navigator.onLine) {
  const last = getPrivate() && getPrivate().syncedAt ? Date.parse(getPrivate().syncedAt) : 0;
  if (Date.now() - last > 3 * 3600 * 1000) {
    syncFromNotion({ faecher: FAECHER, lessons: LESSONS })
      .then(() => { refreshLessons(); toast(t('set.synced')); if (['bugun', 'kartlar', 'dersler'].includes(current)) navigate(); })
      .catch(() => { /* offline oder Token ungültig – alte Daten bleiben */ });
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
