import * as store from './store.js';
import { MUSCLES, BONES, JOINTS, ALL_STRUCTURES, findStructure } from './data/anatomy.js';
import { GRUNDWORTSCHATZ, BASE_VOCAB } from './data/vocab.js';
import { OPEN } from './data/questions.js';
import { LESSONS, FAECHER, refreshLessons } from './lessons.js';
import { cleanSegments, cleanText } from './private.js';
import { getPrivate, setPrivate, clearPrivate, loadLocalDevFile, fehlerList, notionLink, week, todayPlan, tomorrowPlan } from './private.js';
import { getToken, setToken, clearToken, looksLikeToken, syncFromNotion } from './notion.js';
import { renderReport } from './report.js';
import { containsFuzzy } from './fuzzy.js';
import { todaysWords, weekWords, markKnown, recordWord, questionFor, checkTyped, TYPE_LABEL, WORDS_PER_DAY } from './words.js';
import { MUSCLE3D, LAYER_NAMES, partText } from './data/muscle3d.js';
import { UEBUNGEN } from './data/uebungen.js';
import { masteredLessons } from './quizgen.js';
import { buildQuiz, quizCategories, lessonMcq, muscleQuestions, boneQuestions, jointQuestions, jointDetailQuestions, prepare, shuffle, weakTopics, muscleLevel, romUnlocked } from './quizgen.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

const KIND_LABEL = { muscle: 'Kas', bone: 'Kemik', joint: 'Eklem' };
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
function deckCards(deck) {
  const rev = store.get().settings.reverse;
  if (deck.startsWith('vocab')) {
    const cat = deck.split(':')[1];
    return allVocab().filter((v) => !cat || v.cat === cat).map((v) => ({
      id: v.id,
      tag: v.cat,
      front: rev ? v.tr : v.de,
      back: `<div class="big">${esc(rev ? v.de : v.tr)}</div>${v.ex ? `<div class="sub">„${esc(v.ex)}“</div>` : ''}`,
    }));
  }
  if (deck === 'fehler' || deck.startsWith('fehler:')) {
    const only = deck.startsWith('fehler:') ? deck.slice(7).split(',').filter(Boolean) : null;
    return fehlerList().filter((f) => !only || only.includes(f.fach)).map((f) => ({
      id: f.id, tag: '✗ ' + f.fach, front: cleanText(f.q),
      // Aus Notion: Lückentext-Segmente (fett = Antwort); aus Datei: Frage/Antwort/Türkçe
      back: f.seg
        ? `<div class="detail" style="font-size:15px">${cleanSegments(f.seg).map((x) => (x.b ? `<b style="color:var(--accent)">${esc(x.t)}</b>` : esc(x.t))).join('')}</div>`
        : `<div class="detail" style="font-size:15px"><b>${esc(f.a)}</b><br><br><span class="muted">🇹🇷 ${esc(f.tr)}</span></div>`,
    }));
  }
  if (deck.startsWith('ders:')) {
    const fach = deck.slice(5);
    const seen = new Set();
    return lessonVocab((l) => l.fach === fach).filter((v) => !seen.has(v.id) && seen.add(v.id)).map((v) => ({
      id: v.id, tag: fach,
      front: rev ? v.tr : v.de,
      back: `<div class="big">${esc(rev ? v.de : v.tr)}</div>${v.ex ? `<div class="sub">„${esc(v.ex)}“</div>` : ''}`,
    }));
  }
  if (deck === 'muscles') {
    return MUSCLES.map((m) => ({
      id: 'm:' + m.id, tag: 'Kas', front: m.la, frontSub: m.de,
      back: `<div class="detail"><b>${esc(m.la)}</b> · ${esc(m.tr)}<br><br><b>Ursprung:</b> ${esc(m.o)}<br><b>Ansatz:</b> ${esc(m.i)}<br><b>Innervation:</b> ${esc(m.inn)}<br><b>Funktion:</b> ${esc(m.f)}${UEBUNGEN[m.id] ? `<br><br>💪 <b>Übung:</b> ${UEBUNGEN[m.id].map((u) => `${esc(u.n)} <span class="muted">(${esc(u.tr)})</span>`).join(', ')}` : ''}</div>`,
    }));
  }
  if (deck === 'bones') {
    return BONES.map((b) => ({
      id: 'b:' + b.id, tag: 'Kemik', front: b.de, frontSub: rev ? b.tr : '',
      back: `<div class="big">${esc(b.la)}</div><div class="sub">${esc(b.tr)}</div><div class="detail" style="margin-top:12px">${esc(b.merk)}</div>`,
    }));
  }
  if (deck === 'joints') {
    return JOINTS.map((j) => ({
      id: 'j:' + j.id, tag: 'Eklem', front: j.de, frontSub: j.la,
      back: `<div class="detail"><b>${esc(j.tr)}</b><br><br><b>Gelenktyp:</b> ${esc(j.typ)}<br><b>Neutral-Null:</b> ${esc(j.nn)}<br><b>Bänder:</b> ${esc(j.baender)}</div>`,
    }));
  }
  return [];
}

const DECKS = () => [
  ...(fehlerList().length ? [{ id: 'fehler', name: '✗ Hatalarım', sub: 'Notion testlerinde yanlış yaptıkların (öncelikli)' }] : []),
  ...FAECHER.map((f) => ({ id: 'ders:' + f, name: 'Ders: ' + f, sub: 'Ders notlarındaki terimler' })),
  { id: 'vocab', name: 'Tüm kelimeler', sub: `${allVocab().length} kelime` },
  ...vocabCategories().map((c) => ({ id: 'vocab:' + c, name: c, sub: 'Kelimeler' })),
  ...(store.get().customVocab.length ? [{ id: 'vocab:Eigene', name: 'Kendi kelimelerim', sub: `${store.get().customVocab.length} kelime` }] : []),
  { id: 'muscles', name: 'Kaslar', sub: 'Ursprung · Ansatz · Innervation · Funktion' },
  { id: 'bones', name: 'Kemikler', sub: 'Almanca · Latince · Türkçe' },
  { id: 'joints', name: 'Eklemler', sub: 'Gelenktyp · Neutral-Null' },
];

// ───────────────────────── Router ─────────────────────────
let viewer = null; // Anatomy3D-Instanz (lazy)
let current = '';

const routes = {
  bugun: { title: 'Bugün', tab: 'bugun', render: renderToday },
  test: { title: 'Test', tab: 'test', render: renderQuizStart },
  sorular: { title: 'Açık Uçlu Sorular', tab: 'sorular', render: renderOpenList },
  soru: { title: 'Soru', tab: 'sorular', render: renderOpenQuestion, back: '#/sorular' },
  kartlar: { title: 'Kartlar', tab: 'kartlar', render: renderDecks },
  oturum: { title: 'Kartlar', tab: 'kartlar', render: renderCardSession, back: '#/kartlar' },
  liste: { title: 'Kelime Listesi', tab: 'kartlar', render: renderWordList, back: '#/kartlar' },
  '3d': { title: '3D Anatomi', tab: '3d', render: render3D },
  ders: { title: 'Ders', tab: 'bugun', render: renderLesson, back: 'history' },
  dersler: { title: 'Ders Notları', tab: 'bugun', render: renderLessonList, back: '#/bugun' },
  not: { title: 'Ders Notu', tab: 'bugun', render: renderLessonNote, back: '#/dersler' },
  ayarlar: { title: 'Ayarlar', tab: null, render: renderSettings, back: '#/bugun' },
  rapor: { title: 'Durum Raporu', tab: 'bugun', render: () => renderReport(view, toast), back: '#/bugun' },
  kelime: { title: 'Günün Kelimeleri', tab: 'bugun', render: renderWordSession, back: '#/bugun' },
  donus: { title: 'Dönüş Yolu', tab: 'bugun', render: renderDonus, back: '#/bugun' },
  oku: { title: 'Ders Notları – Okuma', tab: 'bugun', render: renderReading, back: '#/donus' },
  cumartesi: { title: 'Haftalık Tekrar', tab: 'bugun', render: renderSaturday, back: '#/bugun' },
};

function navigate() {
  const hash = location.hash.replace(/^#\/?/, '') || 'bugun';
  const [path, query] = hash.split('?');
  const [name, ...args] = path.split('/').map(decodeURIComponent);
  const r = routes[name] || routes.bugun;
  const params = new URLSearchParams(query || '');
  current = name;

  $('#title').textContent = r.title;
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
  const back = $('#backBtn');
  back.hidden = !r.back;
  back.onclick = () => (r.back === 'history' ? history.back() : (location.hash = r.back));
  $('#settingsBtn').hidden = name !== 'bugun';

  const is3d = name === '3d';
  $('#view3d').hidden = !is3d;
  view.hidden = is3d;
  if (!is3d && viewer) viewer.stop();

  view.scrollTop = 0;
  r.render(args, params);
}

window.addEventListener('hashchange', navigate);

// ───────────────────────── Heute ─────────────────────────
function renderToday() {
  const s = store.get();
  const d = store.day();
  const m = muscleOfDay();
  const b = structureOfDay();
  const vocabCards = deckCards('vocab');
  const due = store.dueCount(vocabCards) + ['muscles', 'bones', 'joints'].reduce((n, k) => n + store.dueCount(deckCards(k)), 0);

  const plan = todayPlan();
  const fehlerCards = deckCards('fehler');
  const fehlerOpen = fehlerCards.filter((c) => store.isNew(c.id) || store.isDue(c.id)).length;
  const tasks = [
    ...(fehlerOpen || d.fehler ? [{ done: !fehlerOpen, label: `✗ Hatalarımı tekrar et <span class="muted">(${fehlerOpen} kart)</span>`, href: '#/oturum/fehler' }] : []),
    ...(plan && plan.test.length && FAECHER.some((f) => plan.test.includes(f))
      ? [{ done: !!d.morning, label: `Sabah testi: <b>${esc(plan.test.join(' + '))}</b>`, href: `#/test?kat=${encodeURIComponent('Ders: ' + plan.test.join(','))}` }] : []),
    { done: !!d.wordsMorning, label: `Sabah kelimeleri (${WORDS_PER_DAY})${d.wordsMorning ? ` <span class="muted">${d.wordsMorning.r}/${d.wordsMorning.n}</span>` : ''}`, href: '#/kelime/sabah' },
    { done: !!d.wordsReturn, label: `Dönüş kelimeleri (${WORDS_PER_DAY})${d.wordsReturn ? ` <span class="muted">${d.wordsReturn.r}/${d.wordsReturn.n}</span>` : ''}`, href: '#/kelime/donus' },
    { done: d.lesson, label: `Günün kası: <b>${esc(m.la)}</b>`, href: `#/ders/${m.id}` },
    { done: d.lesson2, label: `Günün ${b.kind === 'bone' ? 'kemiği' : 'eklemi'}: <b>${esc(b.de)}</b>`, href: `#/ders/${b.id}` },
    { done: d.cards >= s.settings.cardsGoal, label: `${s.settings.cardsGoal} kart tekrar et <span class="muted">(${d.cards}/${s.settings.cardsGoal})</span>`, href: '#/oturum/vocab' },
    { done: d.quiz >= s.settings.quizGoal, label: `${s.settings.quizGoal} test sorusu <span class="muted">(${d.quiz}/${s.settings.quizGoal})</span>`, href: '#/test' },
    { done: d.open >= 1, label: '1 açık uçlu soru cevapla', href: `#/soru/${nextOpenQuestion().id}` },
  ];
  const doneN = tasks.filter((t) => t.done).length;
  const pct = doneN / tasks.length;
  const C = 2 * Math.PI * 26;
  const streak = store.streak();
  const dateStr = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  const totalQ = Object.values(s.quiz).reduce((a, q) => ({ r: a.r + q.r, w: a.w + q.w }), { r: 0, w: 0 });
  const acc = totalQ.r + totalQ.w ? Math.round((totalQ.r / (totalQ.r + totalQ.w)) * 100) : null;
  const weak = weakTopics(3);

  view.innerHTML = `
    ${isIOS && !standalone ? `<div class="card install small">📲 <b>Uygulama olarak yükle:</b> Safari'de alttaki <b>Paylaş</b> düğmesine dokun → <b>Ana Ekrana Ekle</b>. Böylece tam ekran ve çevrimdışı çalışır.</div>` : ''}
    <div class="card">
      <div class="hero">
        <svg class="ring" viewBox="0 0 64 64">
          <circle class="bg" cx="32" cy="32" r="26"/>
          <circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
          <text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${doneN}/${tasks.length}</text>
        </svg>
        <div>
          <div class="muted small">${esc(dateStr)}</div>
          <h2>${doneN === tasks.length ? 'Bugünkü hedefler tamam! 🎉' : 'Merhaba! Bugünkü planın'}</h2>
          <div class="streak">${streak > 0 ? `🔥 ${streak} gün seri` : 'Bugün ilk adımı at!'}</div>
        </div>
      </div>
    </div>

    ${plan ? `<div class="card">
      <div class="eyebrow">Bugünkü dersler · KW ${week().kw}</div>
      ${plan.kurse.length ? plan.kurse.map((k) => `<div class="small">📚 ${esc(k)}</div>`).join('') : '<div class="small muted">Bugün ders yok.</div>'}
      ${plan.note ? `<p class="small muted" style="margin-bottom:0">📝 ${esc(plan.note)}</p>` : ''}
      ${tomorrowLine()}
    </div>` : tomorrowLine() ? `<div class="card small">${tomorrowLine()}</div>` : ''}

    <div class="list">
      ${tasks.map((t) => `<a class="task" href="${t.href}"><span class="check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</span><span class="grow">${t.label}</span><span class="chev">›</span></a>`).join('')}
    </div>

    ${weak.length ? `<div class="section-title">Zayıf konular</div>
    <div class="list">
      ${weak.map((t) => `<a href="#/test?kat=${encodeURIComponent(t.topic)}"><span class="grow">${esc(topicLabel(t.topic))}<div class="muted small">%${Math.round(t.acc * 100)} doğru · ${t.total} cevap</div></span><span class="mini">Test et</span></a>`).join('')}
    </div>` : ''}

    ${LESSONS.length ? `<a class="card row" href="#/dersler" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">Notion'dan</div><h2>Ders notları</h2><div class="muted small">${LESSONS.length} ders · özet, test, terimler</div></span><span class="chev">›</span></a>` : ''}

    <div class="card">
      <div class="eyebrow">Günün kası</div>
      <h2>${esc(m.la)}</h2>
      <div class="muted">${esc(m.de)} · ${esc(m.tr)}</div>
      <p class="small">${esc(m.ftr)}</p>
      <div class="grid2">
        <a class="btn" href="#/ders/${m.id}">Dersi aç</a>
        <a class="btn ghost" href="#/3d?id=${m.id}">3D'de göster</a>
      </div>
    </div>

    <div class="card">
      <div class="eyebrow">Günün ${b.kind === 'bone' ? 'kemiği' : 'eklemi'}</div>
      <h2>${esc(b.de)}</h2>
      <div class="muted">${esc(b.la)} · ${esc(b.tr)}</div>
      <p class="small">${esc(b.typ)}</p>
      <div class="grid2">
        <a class="btn" href="#/ders/${b.id}">Dersi aç</a>
        <a class="btn ghost" href="#/3d?id=${b.id}">3D'de göster</a>
      </div>
    </div>

    ${[6, 0].includes(new Date().getDay()) ? `<a class="card row" href="#/cumartesi" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">📆 Haftalık tekrar</div><h2>Bu haftanın yanlışları + ✗ kartları + kelimeler</h2><div class="muted small">Çoğunlukla açık uçlu sorular</div></span><span class="chev">›</span></a>` : ''}
    ${(() => {
      const now = new Date();
      if ([6, 0].includes(now.getDay())) return '';
      if (now.getHours() * 60 + now.getMinutes() < 14 * 60 + 30) return '';
      const { steps, total } = donusInfo();
      const left = steps.filter((x) => x.state === 'open').length;
      return `<a class="card row" href="#/donus" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">🚆 Dönüş yolu</div><h2>${left ? `${left} adım · ≈ ${total} dk` : 'Bugünün tekrarı tamam ✓'}</h2><div class="muted small">Hatalar → kelimeler → bugünün notları + mini test</div></span><span class="chev">›</span></a>`;
    })()}

    <a class="card row" href="#/rapor" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">Claude ile çalış</div><h2>Durum raporu</h2><div class="muted small">Bugünkü durumunu Claude'a gönderilecek bir mesaja çevir</div></span><span class="chev">›</span></a>

    <div class="section-title">İstatistik</div>
    <div class="grid2">
      <div class="card" style="margin:0"><div class="muted small">Tekrar bekleyen kart</div><h2>${due}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">Test başarısı</div><h2>${acc === null ? '–' : acc + '%'}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">Öğrenilen yapı</div><h2>${Object.keys(s.learned).length}/${ALL_STRUCTURES.length}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">Öğrenilen kart</div><h2>${Object.values(s.srs).filter((c) => c.int >= 1).length}</h2></div>
    </div>
  `;
}

// „Yarın: Physiologie + AM“ – Kursnamen ohne Lehrer/Raum
function tomorrowLine() {
  const t = tomorrowPlan();
  if (!t) return '';
  const names = [...new Set((t.kurse || []).flatMap((k) => k.replace(/\([^)]*\)/g, '').split(/\s*\+\s*/)).map((k) => k.replace(/×\s*\d+|·.*$|,.*$/g, '').trim()).filter(Boolean))];
  return `<div class="small muted" style="margin-top:6px">⏭️ Yarın: ${names.length ? esc(names.join(' + ')) : 'ders yok'}</div>`;
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
  if (!s) { view.innerHTML = '<p class="empty">Bulunamadı.</p>'; return; }
  $('#title').textContent = KIND_LABEL[s.kind];
  const learned = store.get().learned[id];

  let facts = '';
  if (s.kind === 'muscle') {
    facts = `
      <dl class="facts" lang="de">
        <dt>Ursprung (Origo)</dt><dd>${esc(s.o)}</dd>
        <dt>Ansatz (Insertio)</dt><dd>${esc(s.i)}</dd>
        <dt>Innervation</dt><dd>${esc(s.inn)}</dd>
        <dt>Funktion</dt><dd>${esc(s.f)}</dd>
        ${UEBUNGEN[s.id] ? `<dt>💪 Übung im Studio</dt><dd>${UEBUNGEN[s.id].map((u) => `<b>${esc(u.n)}</b> – ${esc(u.b)} <span class="muted">(🇹🇷 ${esc(u.tr)})</span>`).join('<br>')}</dd>` : ''}
      </dl>
      <div class="tr-box small">🇹🇷 ${esc(s.ftr)}</div>`;
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
        ${s.kapsel ? `<dt>Kapselmuster</dt><dd>${esc(s.kapsel)}${s.kapselNote ? ` <span class="badge warn">${esc(s.kapselNote)}</span>` : ''}</dd>` : ''}
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
      <span class="badge ${s.kind}">${KIND_LABEL[s.kind]}</span>
      <h2 style="margin-top:8px">${esc(s.de)}</h2>
      <div class="la">${esc(s.la)}</div>
      <div class="muted small">🇹🇷 ${esc(s.tr)}</div>
      ${facts}
      ${s.k || s.klinik ? `<div class="klinik small">🩺 <b>Klinik:</b> ${esc(s.k || s.klinik)}</div>` : ''}
      <a class="btn ghost block" style="margin-top:14px" href="#/3d?id=${s.id}">3D modelde göster</a>
    </div>
    ${related.length ? `<div class="section-title">Bu kemiğe bağlanan kaslar</div><div class="list">${related.map((m) => `<a href="#/ders/${m.id}"><span class="grow">${esc(m.la)}<div class="muted small">${esc(m.tr)}</div></span><span class="chev">›</span></a>`).join('')}</div>` : ''}
    ${mini.length ? `<div class="section-title">Mini test</div><div id="miniQuiz"></div>` : ''}
    <button class="btn block" id="learnedBtn" style="margin-top:12px">${learned ? 'Tekrar ettim ✓' : 'Öğrendim ✓'}</button>
  `;

  const mq = $('#miniQuiz');
  if (mq) {
    mini.forEach((q, qi) => {
      const box = document.createElement('div');
      box.className = 'card';
      box.innerHTML = `<div class="muted small">Soru ${qi + 1}/${mini.length}</div><div class="question" style="font-size:16px">${esc(q.q)}</div>
        ${q.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}<div class="ex"></div>`;
      $$('.opt', box).forEach((btn) => btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        $$('.opt', box).forEach((b2, j) => { b2.disabled = true; if (j === q.ans) b2.classList.add('correct'); });
        if (i !== q.ans) btn.classList.add('wrong');
        store.recordQuiz(q.id, i === q.ans);
        $('.ex', box).innerHTML = `<div class="explain">${esc(q.x)}</div>`;
      }));
      mq.appendChild(box);
    });
  }

  $('#learnedBtn').addEventListener('click', () => {
    store.markLearned(s.id, s.kind === 'muscle' ? 'lesson' : 'lesson2');
    const cardId = { muscle: 'm:', bone: 'b:', joint: 'j:' }[s.kind] + s.id;
    store.markIntroduced(cardId);
    store.save();
    toast('Kaydedildi – kart destene eklendi ✓');
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
  const byFach = {};
  LESSONS.forEach((l) => (byFach[l.fach] = byFach[l.fach] || []).push(l));
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">Notion'daki ders notlarından hazırlandı: kısa özet, test, açık uçlu sorular ve terimler.</p>
    ${Object.entries(byFach).map(([fach, ls]) => `
      <div class="section-title" lang="de">${esc(fach)}</div>
      <div class="list">${ls.map((l) => {
        const p = lessonProgress(l);
        const badge = !p.seen ? '<span class="badge">yeni</span>' : `<span class="badge ${p.right / p.total >= 0.8 ? 'good' : 'warn'}">${p.right}/${p.total}</span>`;
        return `<a href="#/not/${encodeURIComponent(l.id)}"><span class="grow small" lang="de">${esc(l.title)}</span>${badge}<span class="chev">›</span></a>`;
      }).join('')}</div>`).join('') || '<p class="empty">Henüz ders notu yok.</p>'}
  `;
}

function renderLessonNote([id]) {
  const l = LESSONS.find((x) => x.id === id);
  if (!l) { view.innerHTML = '<p class="empty">Bulunamadı.</p>'; return; }
  $('#title').textContent = l.fach;
  const opens = allOpen().filter((q) => q.lesson === l.id);
  view.innerHTML = `
    <div class="card">
      <div class="eyebrow" lang="de">${esc(l.fach)}</div>
      <h2 lang="de">${esc(l.title)}</h2>
      <div class="grid2" style="margin-top:12px">
        ${l.mcq.length ? `<a class="btn" href="#/test?kat=${encodeURIComponent('Lektion: ' + l.id)}">Test (${l.mcq.length} soru)</a>` : ''}
        ${notionLink(l.id) ? `<a class="btn ghost" href="${esc(notionLink(l.id))}" target="_blank" rel="noopener">Notion'da aç</a>` : ''}
      </div>
    </div>
    <div class="section-title">Özet (Kernaussagen)</div>
    <div class="list">${l.kern.map((k) => `<div style="display:block"><div lang="de">${esc(k.de)}</div><div class="muted small">🇹🇷 ${esc(k.tr)}</div></div>`).join('')}</div>
    ${opens.length ? `<div class="section-title">Açık uçlu sorular</div><div class="list">${opens.map((q) => `<a href="#/soru/${encodeURIComponent(q.id)}"><span class="grow small" lang="de">${esc(q.q)}</span><span class="chev">›</span></a>`).join('')}</div>` : ''}
    <div class="section-title">Terimler</div>
    <div class="list">${l.vocab.map((v) => `<div><span class="grow"><b lang="de">${esc(v.de)}</b><div class="small">${esc(v.tr)}</div></span></div>`).join('')}</div>
    <a class="btn ghost block" href="#/oturum/${encodeURIComponent('ders:' + l.fach)}">Terimleri kartlarla çalış</a>
  `;
}

// ───────────────────────── Günün kelimeleri ─────────────────────────
let wordSess = null;

function renderWordSession([pass = 'sabah']) {
  if (!wordSess || wordSess.pass !== pass || wordSess.date !== store.today()) {
    wordSess = { pass, date: store.today(), i: 0, res: [], answered: false };
  }
  $('#title').textContent = pass === 'donus' ? 'Dönüş Kelimeleri' : pass === 'hafta' ? 'Haftanın Kelimeleri' : 'Sabah Kelimeleri';
  const words = pass === 'hafta' ? weekWords() : todaysWords();
  if (!words.length) { view.innerHTML = '<p class="empty">Bu hafta henüz kelime çalışılmadı.</p><a class="btn block" href="#/bugun">Bugün</a>'; return; }
  if (wordSess.i >= words.length) return renderWordEnd(words);
  const w = words[wordSess.i];
  const q = (wordSess.q && wordSess.q.id === w.id) ? wordSess.q.q : questionFor(w, pass);
  wordSess.q = { id: w.id, q };
  view.innerHTML = `
    <div class="row"><span class="badge">${esc(w.cat.replace('GW · ', ''))}</span><span class="badge">${TYPE_LABEL[q.type]}</span><span class="spacer"></span><span class="muted small">${wordSess.i + 1} / ${words.length}</span></div>
    <div class="progress"><div style="width:${(wordSess.i / words.length) * 100}%"></div></div>
    <p class="muted small" style="margin:4px 0">${esc(q.prompt)}</p>
    <div class="card" style="text-align:center"><div class="big-word" lang="de">${esc(q.big)}</div>${q.sub ? `<div class="muted small" style="margin-top:6px">${esc(q.sub)}</div>` : ''}</div>
    ${q.typed
      ? `<input type="text" id="wInput" placeholder="ör. die Schwellung" autocomplete="off" autocapitalize="off" spellcheck="false" lang="de">
         <button class="btn block" id="wCheck" style="margin-top:8px">Kontrol et</button>`
      : q.opts.map((o, n) => `<button class="opt" data-n="${n}" lang="de">${esc(o)}</button>`).join('')}
    <div id="wAfter"></div>
    ${pass === 'hafta' ? '' : '<button class="btn plain block" id="wKnown" style="margin-top:14px">Biliyorum ✓ <span class="muted small">(seyrek tekrar, yerine yeni kelime)</span></button>'}`;
  // ok: true/false; near: fast richtig (Artikel falsch/fehlt) = halber Punkt; note darf HTML enthalten
  const finish = (ok, note = '', near = false) => {
    if (wordSess.answered) return;
    wordSess.answered = true;
    const morningOk = (store.day().wordRes || {})[w.id];
    // Morgens zählt für das Leitner-Fach; abends nur, wenn falsch (zurück in Fach 1) oder morgens nicht geübt
    if (pass === 'sabah' || !ok || morningOk === undefined) recordWord(w.id, ok, near);
    const d = store.day();
    d.wordRes = { ...(d.wordRes || {}), [w.id]: near ? 'close' : ok };
    store.save();
    wordSess.res.push({ id: w.id, ok, near });
    if ($('#wKnown')) $('#wKnown').hidden = true;
    $('#wAfter').innerHTML = `<div class="explain">${ok ? '✅ Doğru' : near ? '⚠️ Neredeyse' : '❌ Yanlış'}${note ? ' · ' + note : ''}<br><b lang="de">${esc(w.de)}</b> = ${esc(w.tr)}${w.ex ? `<br><span class="muted" lang="de">„${esc(w.ex)}“</span>` : ''}${q.type === 'partizip' ? `<br>Partizip II: <b lang="de">${esc(q.answer)}</b>` : ''}</div>
      <button class="btn block" id="wNext">${wordSess.i + 1 < words.length ? 'Sonraki kelime' : 'Bitir'}</button>`;
    $('#wNext').addEventListener('click', () => { wordSess.i++; wordSess.answered = false; wordSess.q = null; renderWordSession([pass]); });
  };
  if (q.typed) {
    const input = $('#wInput');
    const check = () => {
      const r = checkTyped(w, input.value);
      input.disabled = true; $('#wCheck').hidden = true;
      const note = r.ok && r.abbr ? `kısaltma kabul edildi – tam yazılışı: <b lang="de">${esc(r.target)}</b>`
        : r.ok && !r.exact ? `küçük yazım farkı – doğru yazılışı: <b lang="de">${esc(r.target)}</b>`
        : r.hint === 'Artikel falsch' ? `Artikel yanlış: <b lang="de">${esc(r.art)}</b>`
        : r.hint === 'Artikel fehlt' ? `Artikel eksik: <b lang="de">${esc(r.art)}</b>` : '';
      finish(r.ok, note, !!r.close);
    };
    $('#wCheck').addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  } else {
    $$('.opt').forEach((b) => b.addEventListener('click', () => {
      const ok = q.opts[+b.dataset.n] === q.answer;
      $$('.opt').forEach((x) => { x.disabled = true; if (q.opts[+x.dataset.n] === q.answer) x.classList.add('correct'); });
      if (!ok) b.classList.add('wrong');
      finish(ok);
    }));
  }
  if ($('#wKnown')) $('#wKnown').addEventListener('click', () => {
    const next = markKnown(w.id);
    toast(next ? `Tamam – yerine: ${next.de}` : 'Tamam – başka yeni kelime yok');
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
    <div class="card" style="text-align:center"><div class="score">${r}/${words.length}</div><div class="muted">${pass === 'donus' ? 'Dönüş tekrarı tamam 🎉' : pass === 'hafta' ? 'Haftanın kelimeleri tamam 🎉' : 'Sabah kelimeleri tamam – dönüşte aynı kelimeler başka soru tipiyle gelecek'}</div></div>
    <div class="list">${words.map((w) => { const ok = (d.wordRes || {})[w.id]; return `<div><span class="grow"><b lang="de">${esc(w.de)}</b><div class="small">${esc(w.tr)}</div></span><span class="badge ${ok === 'close' ? 'warn' : ok ? 'good' : ok === false ? 'bad' : ''}">${ok === 'close' ? '½' : ok ? '✓' : ok === false ? '✗' : '–'}</span></div>`; }).join('')}</div>
    <a class="btn block" href="#/bugun">Bugün'e dön</a>`;
  wordSess = null;
}

// Ersten Muskel/Knochen/Gelenk finden, der in einem Text genannt wird (lateinisch oder deutsch)
function structureInText(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const names = (s) => [s.la.replace(/\s*\(.*\)$/, ''), s.de].map((x) => x.toLowerCase()).filter((x) => x.length > 4);
  const esc2 = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // nur am Wortanfang, damit z. B. kurze Namen nicht mitten in anderen Wörtern treffen
  return ALL_STRUCTURES.filter((s) => s.kind !== 'joint').find((s) => names(s).some((n) => new RegExp(`[^a-zäöüß]${esc2(n)}`).test(t))) || null;
}

// ───────────────────────── Samstag: Wochenwiederholung ─────────────────────────
function renderSaturday() {
  const wrong = store.wrongSince(7).length;
  const fehler = deckCards('fehler').length;
  const words = weekWords();
  const w = week();
  const weekFaecher = w ? [...new Set(Object.values(w.days || {}).flatMap((d) => (d && d.test) || []))] : [];
  const opens = allOpen().filter((q) => weekFaecher.includes(q.cat)).slice(0, 8);
  const d = store.day();
  view.innerHTML = `
    <div class="card"><div class="eyebrow">📆 Haftalık tekrar</div><h2>Bu hafta: yanlışlar, ✗ kartlar, kelimeler, açık uçlu sorular</h2>
      <div class="muted small">Çoğunlukla açık uçlu – sınav pratiği. ${weekFaecher.length ? 'Bu haftanın dersleri: ' + esc(weekFaecher.join(', ')) : ''}</div></div>
    <div class="list">
      <a href="#/test?kat=${encodeURIComponent('Hatalar: hafta')}"><span class="grow"><b>❌ Bu hafta yanlış yaptıkların</b><div class="muted small">${wrong} soru</div></span><span class="chev">›</span></a>
      <a href="#/oturum/fehler"><span class="grow"><b>✗ Tüm ✗ kartları</b><div class="muted small">${fehler} kart (Notion)</div></span><span class="chev">›</span></a>
      <a href="#/kelime/hafta"><span class="grow"><b>🔤 Haftanın kelimeleri</b><div class="muted small">${words.length} kelime · çoğunlukla yazarak${d.wordsWeek ? ` · bugün ${d.wordsWeek.r}/${d.wordsWeek.n}` : ''}</div></span><span class="chev">›</span></a>
    </div>
    ${opens.length ? `<div class="section-title">Açık uçlu sorular (bu haftanın dersleri)</div><div class="list">${opens.map((q) => `<a href="#/soru/${encodeURIComponent(q.id)}"><span class="grow small" lang="de">${esc(q.q)}</span><span class="badge">${esc(q.cat)}</span></a>`).join('')}</div>` : ''}`;
}

// ───────────────────────── Dönüş yolu (Rückweg) ─────────────────────────
// Fächer von heute: Morgentest + erkannte Kursnamen
function todayFaecher(plan = todayPlan()) {
  if (!plan) return [];
  const text = (plan.kurse || []).join(' ').replace(/PT-Befund/g, 'PT Befund');
  const all = [...new Set([...FAECHER, 'AM', 'AKL', 'Atemtherapie', 'KI'])];
  const hit = all.filter((f) => (f.length <= 3 ? new RegExp(`(^|[^A-Za-zÄÖÜäöü])${f.replace('/', '\\/')}($|[^A-Za-zÄÖÜäöü])`).test(text) : text.includes(f)) || (f === 'Anatomie' && /\bANA\b/.test(text)));
  return [...new Set([...(plan.test || []), ...hit])];
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
  const wrong = (d.wrong || []).length;
  const fehlerCards = deckCards('fehler:' + fs.join(',')).filter((c) => store.isNew(c.id) || store.isDue(c.id)).length;
  const lessons = readingLessons(fs);
  const kern = lessons.reduce((n, l) => n + l.kern.length, 0);
  const steps = [
    { key: 'hatalar', icon: '❌', title: 'Bugünün hataları', sub: wrong ? `${wrong} yanlış soru (sabah testi)` : 'Bugün yanlış soru yok', min: Math.ceil(wrong * 1.5), href: '#/test?kat=' + encodeURIComponent('Hatalar: bugün'), empty: !wrong },
    { key: 'fehler', icon: '✗', title: 'Notion ✗ kartları', sub: fs.length ? `${fehlerCards} kart · ${fs.join(' + ')}` : 'Bugün ders yok', min: fehlerCards, href: '#/oturum/' + encodeURIComponent('fehler:' + fs.join(',')), empty: !fehlerCards },
    { key: 'kelime', icon: '🔤', title: 'Dönüş kelimeleri', sub: `${WORDS_PER_DAY} kelime, başka soru tipiyle`, min: 8, href: '#/kelime/donus', done: !!d.wordsReturn },
    { key: 'notlar', icon: '📖', title: 'Bugünün ders notları', sub: lessons.length ? `${lessons.length} ders · ${kern} cümle + 5 soruluk mini test` : 'Bugünün dersi için not yok', min: lessons.length ? Math.ceil(kern * 0.75) + 6 : 0, href: '#/oku', empty: !lessons.length },
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
      <div class="eyebrow">🚆 Dönüş yolu</div>
      <h2>Bugünün tekrarı · ≈ ${total} dk</h2>
      <div class="muted small">${fs.length ? 'Bugünkü dersler: ' + esc(fs.join(' + ')) : 'Bugün için program yok'} · her adım tek dokunuşla atlanabilir</div>
    </div>
    <div class="list">
      ${steps.map((s, n) => `<div style="display:block">
        <div class="row"><span class="check ${s.state === 'done' || s.state === 'skip' ? 'done' : ''}">${s.state === 'done' ? '✓' : s.state === 'skip' ? '–' : n + 1}</span>
          <span class="grow"><b>${s.icon} ${esc(s.title)}</b><div class="muted small">${esc(s.sub)}${s.min && s.state === 'open' ? ` · ≈ ${s.min} dk` : ''}</div></span></div>
        ${s.state === 'open' ? `<div class="grid2" style="margin-top:8px"><a class="btn" href="${s.href}">Başla</a><button class="btn plain" data-skip="${s.key}">Atla</button></div>` : ''}
      </div>`).join('')}
    </div>
    <a class="btn ghost block" href="#/rapor">Durum raporunu Claude'a gönder</a>`;
  $$('[data-skip]').forEach((b) => b.addEventListener('click', () => { markDonus(b.dataset.skip, 'skip'); renderDonus(); }));
}

// Lesemodus: Kernaussagen der heutigen Fächer, große Schrift, danach Mini-Test
function renderReading() {
  const fs = todayFaecher();
  const lessons = readingLessons(fs);
  if (!lessons.length) { view.innerHTML = '<p class="empty">Bugünün dersleri için not yok.</p><a class="btn block" href="#/donus">Geri</a>'; return; }
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">Kaydırarak oku · Almanca cümle, altında Türkçesi</p>
    ${lessons.map((l) => `
      <div class="section-title" lang="de">${esc(l.fach)} · ${esc(l.title)}</div>
      ${l.kern.map((k) => `<div class="card read-card"><div lang="de">${esc(k.de)}</div><div class="muted">🇹🇷 ${esc(k.tr)}</div></div>`).join('')}`).join('')}
    <button class="btn block" id="readDone" style="margin-top:12px">Okudum ✓ → Mini test (5 soru)</button>
    <button class="btn plain block" id="readSkip" style="margin-top:8px">Testi atla</button>`;
  const markRead = () => { lessons.forEach((l) => { store.get().learned['les:' + l.id] = store.today(); }); markDonus('notlar'); };
  $('#readDone').addEventListener('click', () => { markRead(); location.hash = '#/test?kat=' + encodeURIComponent('Lektion: ' + lessons.map((l) => l.id).join(',')) + '&donus=1'; });
  $('#readSkip').addEventListener('click', () => { markRead(); location.hash = '#/donus'; });
}

// ───────────────────────── Quiz ─────────────────────────
let quiz = null;

const topicLabel = (t) => (t.startsWith('Ders: ') ? t.slice(6) + ' (ders)' : t === 'Gemischt' ? 'Karışık' : t);
let quizCat = 'Gemischt';

function renderQuizStart(_, params = new URLSearchParams()) {
  const kat = params.get('kat');
  if (kat) {
    // Direktstart, z. B. Morgentest aus dem Tagesplan oder Test zu einer Lektion
    quizCat = kat;
    history.replaceState(null, '', '#/test');
    const donus = params.get('donus') === '1' || kat.startsWith('Dönüş: ');
    const n = donus ? 5 : kat.startsWith('Hatalar: ') ? 30 : store.get().settings.quizGoal;
    quiz = { qs: buildQuiz(kat, n, store.get().customVocab), i: 0, right: 0, wrong: [], finished: false, cat: kat, donus };
    if (!quiz.qs.length) { quiz = null; toast('Bu kategori için soru yok'); } else return renderQuizQuestion();
  }
  if (quiz && !quiz.finished) return renderQuizQuestion();
  const stats = store.get().quiz;
  const weak = Object.entries(stats).filter(([, v]) => v.w > v.r).length;
  view.innerHTML = `
    <div class="card">
      <h2>Kategori seç</h2>
      <div class="chips" style="margin-top:10px">
        ${[...quizCategories(), ...(quizCategories().includes(quizCat) ? [] : [quizCat])].map((c) => `<button class="chip ${c === quizCat ? 'on' : ''}" data-cat="${esc(c)}">${c === 'Gemischt' ? 'Karışık' : esc(c)}</button>`).join('')}
      </div>
      <button class="btn block" id="startQuiz" style="margin-top:16px">${store.get().settings.quizGoal} soruluk testi başlat</button>
    </div>
    <p class="muted small" style="padding:0 4px">Sorular Almanca, açıklamalar Türkçe. Kas/kemik/eklem soruları anatomi verilerinden her seferinde yeniden üretilir; yanlış yaptıkların ve uzun süredir görmediklerin daha sık gelir. Kas seviyesi: <b>${muscleLevel()}/3</b>${romUnlocked() ? ' · ROM soruları açık' : ''}.${weak ? ` Şu ana kadar <b>${weak}</b> soruda daha çok hata yaptın.` : ''}</p>
  `;
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => { quizCat = b.dataset.cat; renderQuizStart(); }));
  $('#startQuiz').addEventListener('click', () => {
    const qs = buildQuiz(quizCat, store.get().settings.quizGoal, store.get().customVocab);
    quiz = { qs, i: 0, right: 0, wrong: [], answered: false, finished: false, cat: quizCat };
    renderQuizQuestion();
  });
}

function renderQuizQuestion() {
  if (quiz.i >= quiz.qs.length) return renderQuizEnd();
  const q = quiz.qs[quiz.i];
  view.innerHTML = `
    <div class="row"><span class="badge">${esc(q.cat)}</span><span class="spacer"></span><span class="muted small">${quiz.i + 1} / ${quiz.qs.length}</span></div>
    <div class="progress"><div style="width:${(quiz.i / quiz.qs.length) * 100}%"></div></div>
    <div class="question">${esc(q.q)}</div>
    ${q.opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}
    <div id="after"></div>
    <button class="btn plain block" id="quitQuiz" style="margin-top:20px">Testi bitir</button>
  `;
  $$('.opt').forEach((btn) => btn.addEventListener('click', () => {
    const i = +btn.dataset.i;
    const ok = i === q.ans;
    $$('.opt').forEach((b, j) => { b.disabled = true; if (j === q.ans) b.classList.add('correct'); });
    if (!ok) { btn.classList.add('wrong'); quiz.wrong.push(q); } else quiz.right++;
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ok ? 15 : [30, 40, 30]);
    store.recordQuiz(q.id, ok);
    $('#after').innerHTML = `<div class="explain">${ok ? '✅ Doğru! ' : '❌ Yanlış. '}${esc(q.x)}</div><button class="btn block" id="next">${quiz.i + 1 < quiz.qs.length ? 'Sonraki soru' : 'Sonucu gör'}</button>`;
    $('#next').addEventListener('click', () => { quiz.i++; renderQuizQuestion(); });
    $('#next').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  $('#quitQuiz').addEventListener('click', () => { quiz.qs = quiz.qs.slice(0, quiz.i); renderQuizEnd(); });
}

function renderQuizEnd() {
  quiz.finished = true;
  const plan = todayPlan();
  if (plan && plan.test.length && quiz.cat === 'Ders: ' + plan.test.join(',') && quiz.qs.length) { store.day().morning = true; store.save(); }
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
      <div class="muted">${pct >= 80 ? 'Harika! 💪' : pct >= 50 ? 'İyi gidiyor, devam!' : 'Tekrar zamanı – yanlışlara bak 👇'}</div>
    </div>
    ${quiz.wrong.length ? `<div class="section-title">Yanlışların</div>${quiz.wrong.map((q) => `<div class="card small"><b>${esc(q.q)}</b><div class="explain">✔︎ ${esc(q.opts[q.ans])}<br><span class="muted">${esc(q.x)}</span></div></div>`).join('')}` : ''}
    ${upgrade.map(({ l, q }) => `<a class="card row" href="#/soru/${encodeURIComponent(q.id)}" style="text-decoration:none;color:inherit"><span class="grow"><div class="eyebrow">⬆️ Seviye atla</div><b lang="de">${esc(l.title)}</b><div class="muted small">Bu dersin soruları 2× üst üste doğru → şimdi açık uçlu soru</div></span><span class="chev">›</span></a>`).join('')}
    <div class="grid2">
      ${quiz.wrong.length ? '<button class="btn ghost" id="retryWrong">Yanlışları tekrarla</button>' : ''}
      <button class="btn" id="again">Yeni test</button>
    </div>
  `;
  $('#again').addEventListener('click', () => { quiz = null; renderQuizStart(); });
  const rw = $('#retryWrong');
  if (rw) rw.addEventListener('click', () => {
    quiz = { qs: shuffle(quiz.wrong).map((q) => prepare({ ...q, o: [q.opts[q.ans], ...q.opts.filter((_, i) => i !== q.ans)], a: 0 })), i: 0, right: 0, wrong: [], finished: false };
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
    <p class="muted small" style="padding:0 4px">Cevabını Almanca yaz (sınav pratiği!). Uygulama anahtar kavramları kontrol eder, sonra örnek cevabı gösterir ve kendini değerlendirirsin.</p>
    ${cats.map((c) => `
      <div class="section-title" lang="de">${esc(c)}</div>
      <div class="list">
        ${all.filter((q) => q.cat === c).map((q) => {
          const r = st[q.id];
          const badge = !r ? '<span class="badge">yeni</span>' : r.score >= 0.75 ? '<span class="badge good">iyi</span>' : r.score >= 0.4 ? '<span class="badge warn">kısmen</span>' : '<span class="badge bad">tekrar</span>';
          return `<a href="#/soru/${q.id}"><span class="grow small">${esc(q.q)}</span>${badge}</a>`;
        }).join('')}
      </div>`).join('')}
  `;
}

function renderOpenQuestion([id]) {
  const all = allOpen();
  const q = all.find((x) => x.id === id) || all[0];
  view.innerHTML = `
    <div class="card">
      <span class="badge">${esc(q.cat)}</span>
      <div class="question" style="margin-top:8px">${esc(q.q)}</div>
      <textarea id="answer" placeholder="Cevabını buraya yaz (Almanca)…">${esc(drafts[q.id] || '')}</textarea>
      <button class="btn block" id="check" style="margin-top:10px">Kontrol et</button>
    </div>
    <div id="result"></div>
  `;
  const ta = $('#answer');
  ta.addEventListener('input', () => { drafts[q.id] = ta.value; });
  $('#check').addEventListener('click', () => {
    const ans = norm(ta.value);
    const hits = q.kw.map((k) => ({ k, hit: k.split('|').some((alt) => containsFuzzy(ta.value, alt)) }));
    const score = hits.filter((h) => h.hit).length / hits.length;
    $('#result').innerHTML = `
      <div class="card">
        <h3 style="margin-top:0">Anahtar kavramlar (${hits.filter((h) => h.hit).length}/${hits.length})</h3>
        ${hits.map((h) => `<span class="kw ${h.hit ? 'hit' : 'miss'}">${h.hit ? '✓' : '✗'} ${esc(h.k.split('|')[0])}</span>`).join('')}
        <h3>Örnek cevap (Musterlösung)</h3>
        <p class="small">${esc(q.a)}</p>
        <h3>Kendini değerlendir</h3>
        <div class="grid2" style="grid-template-columns:1fr 1fr 1fr">
          <button class="btn danger" data-s="0">Bilmedim</button>
          <button class="btn plain" data-s="0.5">Kısmen</button>
          <button class="btn" data-s="1">İyi bildim</button>
        </div>
      </div>`;
    $$('[data-s]').forEach((b) => b.addEventListener('click', () => {
      // Mittelwert aus Schlüsselbegriffen und Selbsteinschätzung
      store.recordOpen(q.id, (score + +b.dataset.s) / 2);
      delete drafts[q.id];
      toast('Kaydedildi ✓');
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
      ${due ? `<span class="badge warn">${due} tekrar</span>` : ''}<span class="badge">${fresh} yeni</span></a>`;
  });
  view.innerHTML = `
    <div class="section-title">Desteler</div>
    <div class="list">${rows.join('')}</div>
    <div class="grid2">
      <a class="btn ghost" href="#/liste">Kelime listesi</a>
      <button class="btn ghost" id="revBtn">${store.get().settings.reverse ? 'Yön: TR → DE' : 'Yön: DE → TR'}</button>
    </div>
    <div class="card">
      <h2>Kendi kelimeni ekle</h2>
      <p class="muted small">Derste/staj yerinde duyduğun yeni kelimeleri ekle.</p>
      <input type="text" id="newDe" placeholder="Almanca (z. B. der Oberschenkel)" style="margin-top:8px">
      <input type="text" id="newTr" placeholder="Türkçe (ör. uyluk)" style="margin-top:8px">
      <input type="text" id="newEx" placeholder="Örnek cümle (isteğe bağlı)" style="margin-top:8px">
      <button class="btn block" id="addWord" style="margin-top:10px">Ekle</button>
    </div>
  `;
  $('#revBtn').addEventListener('click', () => { store.get().settings.reverse = !store.get().settings.reverse; store.save(); renderDecks(); });
  $('#addWord').addEventListener('click', () => {
    const de = $('#newDe').value.trim();
    const tr = $('#newTr').value.trim();
    if (!de || !tr) { toast('Almanca ve Türkçe gerekli'); return; }
    const s = store.get();
    if (allVocab().some((v) => v.de === de)) { toast('Bu kelime zaten var'); return; }
    s.customVocab.push({ id: 'v:' + de, de, tr, ex: $('#newEx').value.trim(), cat: 'Eigene' });
    store.save();
    toast('Kelime eklendi ✓');
    renderDecks();
  });
}

let session = null;

function renderCardSession([deckId]) {
  if (!session || session.deck !== deckId) {
    const cards = deckCards(deckId);
    // Fehlerkarten immer alle zeigen (kein Tageslimit für neue Karten)
    session = { deck: deckId, queue: store.buildSession(cards, { noNewLimit: deckId.startsWith('fehler') }), done: 0, flipped: false };
  }
  const deck = DECKS().find((d) => d.id === deckId);
  $('#title').textContent = deck ? deck.name : 'Kartlar';
  const card = session.queue[0];
  if (!card) {
    if (deckId.startsWith('fehler:')) markDonus('fehler');
    view.innerHTML = `
      <div class="empty"><div style="font-size:48px">🎉</div><h2>Bu deste için bugünlük bitti!</h2>
      <p>${session.done} kart tekrar edildi.</p></div>
      <div class="grid2"><a class="btn ghost" href="#/kartlar">Destelere dön</a><a class="btn" href="#/bugun">Bugün</a></div>`;
    session = null;
    return;
  }
  store.markIntroduced(card.id);
  const c = store.get().srs[card.id];
  const isNewCard = c.reps === 0;
  const ivl = (r) => {
    const int = c.int;
    if (r === 0) return '<1g';
    const n = r === 1 ? Math.max(1, Math.round(int * 1.2)) : r === 2 ? (int < 1 ? 1 : Math.round(int * 2.5)) : (int < 1 ? 4 : Math.round(int * 3.5));
    return n + 'g';
  };
  view.innerHTML = `
    <div class="row"><span class="muted small">Kalan: ${session.queue.length}</span><span class="spacer"></span>${isNewCard ? '<span class="badge good">yeni</span>' : ''}</div>
    <div class="flash ${session.flipped ? 'flipped' : ''}" id="flash">
      <div class="flash-inner">
        <div class="face front"><span class="badge tag">${esc(card.tag)}</span><div class="big">${esc(card.front)}</div>${card.frontSub ? `<div class="sub">${esc(card.frontSub)}</div>` : ''}<div class="sub" style="margin-top:24px">Çevirmek için dokun</div></div>
        <div class="face back">${card.back}${(() => {
          if (!deckId.startsWith('fehler')) return '';
          const s = structureInText(card.front + ' ' + card.back.replace(/<[^>]+>/g, ' '));
          return s ? `<a class="btn ghost" style="margin-top:12px" href="#/3d?id=${s.id}" onclick="event.stopPropagation()">🦴 3D'de göster: ${esc(s.la)}</a>` : '';
        })()}</div>
      </div>
    </div>
    <div id="rateBox" ${session.flipped ? '' : 'hidden'}>
      <div class="rate">
        <button class="r0" data-r="0">Tekrar<small>${ivl(0)}</small></button>
        <button class="r1" data-r="1">Zor<small>${ivl(1)}</small></button>
        <button class="r2" data-r="2">İyi<small>${ivl(2)}</small></button>
        <button class="r3" data-r="3">Kolay<small>${ivl(3)}</small></button>
      </div>
    </div>
    <button class="btn block" id="showBtn" ${session.flipped ? 'hidden' : ''}>Cevabı göster</button>
  `;
  const flip = () => {
    session.flipped = !session.flipped;
    $('#flash').classList.toggle('flipped', session.flipped);
    $('#rateBox').hidden = !session.flipped;
    $('#showBtn').hidden = session.flipped;
  };
  $('#flash').addEventListener('click', flip);
  $('#showBtn').addEventListener('click', flip);
  $$('[data-r]').forEach((b) => b.addEventListener('click', () => {
    const r = +b.dataset.r;
    store.rate(card.id, r);
    session.queue.shift();
    if (r === 0) session.queue.splice(Math.min(3, session.queue.length), 0, card); // bald wiederholen
    else session.done++;
    session.flipped = false;
    renderCardSession([deckId]);
  }));
}

function renderWordList() {
  view.innerHTML = `
    <input type="search" id="wq" placeholder="Ara (Almanca veya Türkçe)…" style="margin-top:8px">
    <div id="wl"></div>`;
  const draw = () => {
    const q = norm($('#wq').value);
    const list = allVocab().filter((v) => !q || norm(v.de + ' ' + v.tr).includes(q));
    const byCat = {};
    list.forEach((v) => (byCat[v.cat] = byCat[v.cat] || []).push(v));
    $('#wl').innerHTML = Object.entries(byCat).map(([cat, vs]) => `
      <div class="section-title" lang="de">${esc(cat)}</div>
      <div class="list">${vs.map((v) => `<div><span class="grow"><b>${esc(v.de)}</b><div class="small">${esc(v.tr)}</div>${v.ex ? `<div class="muted small">${esc(v.ex)}</div>` : ''}</span>
        ${v.cat === 'Eigene' ? `<button class="btn danger" style="min-height:32px;padding:4px 10px" data-del="${esc(v.id)}">Sil</button>` : ''}</div>`).join('')}</div>`).join('') || '<p class="empty">Sonuç yok</p>';
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
      $('#hint3d').textContent = '3D model yükleniyor…';
      threeLoading = import('./anatomy3d.js').then(({ Anatomy3D }) => {
        viewer = new Anatomy3D($('#canvas3d'), { onSelect: (sid, o) => (o && o.focus ? startFocus(sid) : showSheet(sid)) });
        viewer.onPart = (k) => renderFocusSheet(k);
        $('#hint3d').textContent = 'Döndürmek için sürükle · yakınlaştırmak için iki parmak · seçmek için dokun';
        setup3DControls();
      }).catch((e) => {
        $('#hint3d').textContent = '3D yüklenemedi: ' + e.message;
        threeLoading = null;
        throw e;
      });
    }
    try { await threeLoading; } catch { return; }
  }
  if (current !== '3d') return;
  viewer.start();
  const id = params.get('id');
  if (!id) return;
  // Muskeln (z. B. „Günün kası“ oder aus einer Lektion) direkt im Fokusmodus zeigen
  const s = findStructure(id);
  if (s && s.kind === 'muscle') {
    $('#hint3d').textContent = 'Kas modeli hazırlanıyor…';
    await viewer.ready;
    if (current === '3d') startFocus(id);
  } else viewer.select(id);
}

// ───── Fokusmodus: ein Muskel mit Teilen, Ursprung/Ansatz und tieferen Muskeln ─────
let focusState = null;

function startFocus(id) {
  const s = findStructure(id);
  const info = viewer.enterFocus(id);
  if (!s || !info) { showSheet(id); return; }
  focusState = { id, s, info };
  document.body.classList.add('focus3d');
  $('#hint3d').hidden = true;
  renderFocusSheet(null);
}

function exitFocus() {
  const id = focusState && focusState.id;
  focusState = null;
  viewer.exitFocus();
  document.body.classList.remove('focus3d');
  if (id) viewer.select(id); else showSheet(null);
}

function renderFocusSheet(k) {
  if (!focusState) return;
  const { s, info } = focusState;
  const sheet = $('#sheet3d');
  sheet.hidden = false;
  sheet.classList.remove('collapsed');
  const part = k !== null && k !== undefined ? info.parts[k] : null;
  const o = part ? partText(s.o, part.la) : s.o;
  const i = part ? partText(s.i, part.la) : s.i;
  sheet.innerHTML = `
    <button class="close" aria-label="Tüm vücut">✕</button>
    <span class="badge muscle">Kas</span> <span class="badge">${LAYER_NAMES[info.layer] || ''} katman</span>
    <h2 style="margin:6px 0 0;font-size:18px">${esc(s.la)}</h2>
    <div class="muted small">${esc(s.de)} · 🇹🇷 ${esc(s.tr)}</div>
    ${info.parts.length > 1 ? `<div class="chips" style="margin-top:10px">${info.parts.map((p, n) => `<button class="chip part-chip ${n === k ? 'on' : ''}" data-part="${n}"><span class="dot" style="background:${p.color}"></span>${esc(p.la)}</button>`).join('')}</div>` : ''}
    ${part ? `<div class="small" style="margin-top:8px"><b lang="de">${esc(part.la)}</b> · ${esc(part.de)} · 🇹🇷 ${esc(part.tr)}</div>` : ''}
    <dl class="facts small" lang="de">
      <dt>🟢 Ursprung</dt><dd>${esc(o)}</dd>
      <dt>🔵 Ansatz</dt><dd>${esc(i)}</dd>
      ${part ? '' : `<dt>Innervation</dt><dd>${esc(s.inn)}</dd><dt>Funktion</dt><dd>${esc(s.f)}</dd>`}
    </dl>
    <p class="muted small" style="margin:8px 0 0">🟢 U = Ursprung · 🔵 A = Ansatz · soluk kırmızı = altındaki derin kaslar (dokununca onlara geçer)${info.parts.length > 1 ? ' · parçaya dokunarak seç' : ''}</p>
    <div class="grid2" style="margin-top:8px">
      <button class="btn plain" id="exitFocus">Tüm vücut</button>
      <a class="btn" href="#/ders/${s.id}">Dersi aç</a>
    </div>`;
  $('.close', sheet).addEventListener('click', exitFocus);
  $('#exitFocus').addEventListener('click', exitFocus);
  $$('.part-chip', sheet).forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.part;
    const next = n === k ? null : n;
    viewer.focusPart(next);
    renderFocusSheet(next);
  }));
}

function setup3DControls() {
  $$('[data-layer]').forEach((b) => b.addEventListener('click', () => {
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on);
    viewer.setLayer(b.dataset.layer, on);
  }));
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
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => viewer.view(b.dataset.view)));
  $('#resetView').addEventListener('click', () => viewer.resetView());

  const input = $('#search3d');
  const results = $('#searchResults');
  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    if (!q) { results.hidden = true; return; }
    const found = ALL_STRUCTURES.filter((s) => norm(`${s.de} ${s.la} ${s.tr}`).includes(q)).slice(0, 12);
    results.hidden = false;
    results.className = 'search-results list';
    results.innerHTML = found.length
      ? found.map((s) => `<button data-id="${s.id}"><span class="badge ${s.kind}">${KIND_LABEL[s.kind]}</span><span class="grow">${esc(s.la)}<div class="muted small">${esc(s.de)} · ${esc(s.tr)}</div></span></button>`).join('')
      : '<div class="muted small">Sonuç yok</div>';
    $$('button', results).forEach((b) => b.addEventListener('click', () => {
      if (focusState) exitFocus();
      const hit = findStructure(b.dataset.id);
      if (hit && hit.kind === 'muscle') startFocus(b.dataset.id); else viewer.select(b.dataset.id);
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
  const summary = s.kind === 'muscle' ? s.ftr : s.kind === 'bone' ? s.typ : `${s.typ}`;
  const more = s.kind === 'muscle'
    ? `<dl class="facts" lang="de"><dt>Ursprung</dt><dd>${esc(s.o)}</dd><dt>Ansatz</dt><dd>${esc(s.i)}</dd><dt>Innervation</dt><dd>${esc(s.inn)}</dd><dt>Funktion</dt><dd>${esc(s.f)}</dd></dl>`
    : s.kind === 'bone'
      ? `<dl class="facts" lang="de"><dt>Wichtige Strukturen</dt><dd>${esc(s.merk)}</dd></dl>`
      : `<dl class="facts" lang="de"><dt>Neutral-Null</dt><dd>${esc(s.nn)}</dd><dt>Bänder</dt><dd>${esc(s.baender)}</dd></dl>`;
  sheet.innerHTML = `
    <button class="close" aria-label="Kapat">✕</button>
    <span class="badge ${s.kind}">${KIND_LABEL[s.kind]}</span>
    <h2 style="margin:6px 0 0;font-size:18px">${esc(s.la)}</h2>
    <div class="muted small">${esc(s.de)} · 🇹🇷 ${esc(s.tr)}</div>
    <p class="small" style="margin:6px 0">${esc(summary)}</p>
    <div class="more small">${more}${s.k || s.klinik ? `<div class="klinik">🩺 ${esc(s.k || s.klinik)}</div>` : ''}</div>
    <div class="grid2" style="margin-top:8px">
      <button class="btn plain" id="moreBtn">Detaylar</button>
      <a class="btn" href="#/ders/${s.id}">Dersi aç</a>
    </div>`;
  $('.close', sheet).addEventListener('click', () => viewer.select(null));
  $('#moreBtn').addEventListener('click', (e) => {
    if (s.kind === 'muscle') { startFocus(s.id); return; } // Kas: parçalar + Ursprung/Ansatz + derin kaslar
    const collapsed = sheet.classList.toggle('collapsed');
    e.currentTarget.textContent = collapsed ? 'Detaylar' : 'Daha az';
  });
}

// ───────────────────────── Einstellungen ─────────────────────────
function renderSettings() {
  const s = store.get().settings;
  view.innerHTML = `
    <div class="section-title">Günlük hedefler</div>
    <div class="list">
      <label><span class="grow">Kart tekrarı / gün</span><input type="number" min="5" max="200" id="cardsGoal" value="${s.cardsGoal}" style="width:80px"></label>
      <label><span class="grow">Test sorusu / tur</span><input type="number" min="5" max="50" id="quizGoal" value="${s.quizGoal}" style="width:80px"></label>
      <label><span class="grow">Yeni kart / gün</span><input type="number" min="0" max="100" id="newPerDay" value="${s.newPerDay}" style="width:80px"></label>
    </div>
    <div class="section-title">Yedekleme</div>
    <p class="muted small" style="padding:0 4px">İlerlemen sadece bu cihazda saklanır. Telefon değiştirirken veya güvenlik için yedek al.</p>
    <div class="grid2">
      <button class="btn ghost" id="exportBtn">Yedeği indir</button>
      <label class="btn ghost">Yedeği yükle<input type="file" id="importFile" accept="application/json" hidden></label>
    </div>
    <div class="section-title">Notion bağlantısı</div>
    <div class="card small" style="margin-top:0">
      ${getToken()
        ? `🔒 Bağlı · ${getPrivate() && getPrivate().syncedAt ? 'son güncelleme: ' + esc(new Date(getPrivate().syncedAt).toLocaleString('tr-TR')) : 'henüz güncellenmedi'}
           <div class="grid2" style="margin-top:10px"><button class="btn" id="nSync">Şimdi güncelle</button><button class="btn danger" id="nDisconnect">Bağlantıyı sil</button></div>`
        : `Haftalık programın, hata listen, Grundwortschatz ve yeni ders soruları (FizyoLern Sorular) doğrudan Notion'dan okunur. Anahtar <b>sadece bu telefonda</b> saklanır ve sadece api.notion.com'a gönderilir.
           <input type="password" id="nToken" placeholder="ntn_… (Notion Internal Integration Secret)" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:10px">
           <button class="btn block" id="nConnect" style="margin-top:8px">Bağlan ve güncelle</button>`}
      <div id="nStatus" class="muted" style="margin-top:8px"></div>
    </div>
    <div class="section-title">Özel veriler</div>
    <p class="muted small" style="padding:0 4px">Haftalık program, hata listen ve Notion linklerin herkese açık uygulamada yok. <b>fizyolern-ozel.json</b> dosyasını buradan yükle; sadece bu telefonda saklanır.</p>
    <div class="card small" style="margin-top:0">${getPrivate() ? `✅ Yüklü: KW ${esc(week()?.kw ?? '–')} · ${fehlerList().length} hata kartı` : '⚠️ Henüz yüklenmedi'}</div>
    <div class="grid2">
      <label class="btn ghost">Özel verileri yükle<input type="file" id="privFile" accept="application/json,.json" hidden></label>
      <button class="btn plain" id="privClear" ${getPrivate() ? '' : 'disabled'}>Kaldır</button>
    </div>
    <div class="section-title">Diğer</div>
    <button class="btn danger block" id="resetBtn">Tüm ilerlemeyi sıfırla</button>
    <p class="muted small" style="margin-top:24px;padding:0 4px">3D kemik ve kas modelleri: <b>BodyParts3D</b>, © The Database Center for Life Science (DBCLS), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> – Sinew (sinew.pin.games) oyunuyla aynı kaynak. BodyParts3D'de olmayan 4 kas (M. latissimus dorsi, M. rectus abdominis, M. transversus abdominis, M. quadratus lumborum) gerçek iskeletteki ölçüm noktalarına göre uygulama tarafından çizilir. İçerik ders kitapları (ör. Prometheus, Schünke) ile kontrol edilmelidir.</p>
  `;
  ['cardsGoal', 'quizGoal', 'newPerDay'].forEach((k) => $('#' + k).addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) { s[k] = v; store.save(); toast('Kaydedildi'); }
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
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.srs || !data.days) throw new Error('format');
      store.replace(data);
      toast('Yedek yüklendi ✓');
    } catch { toast('Geçersiz yedek dosyası'); }
  });
  const nStatus = $('#nStatus');
  const runSync = async () => {
    nStatus.textContent = "Notion'dan okunuyor…";
    try {
      const r = await syncFromNotion({ faecher: FAECHER, lessons: LESSONS });
      refreshLessons();
      toast("Notion'dan güncellendi ✓");
      renderSettings();
      $('#nStatus').textContent = '✅ ' + r;
    } catch (err) { nStatus.textContent = '⚠️ ' + err.message; }
  };
  const nConnect = $('#nConnect');
  if (nConnect) nConnect.addEventListener('click', () => {
    const t = $('#nToken').value.trim();
    if (!looksLikeToken(t)) { nStatus.textContent = '⚠️ Bu bir Notion anahtarına benzemiyor (ntn_… ile başlamalı).'; return; }
    setToken(t);
    $('#nToken').value = '';
    runSync();
  });
  const nSync = $('#nSync');
  if (nSync) nSync.addEventListener('click', runSync);
  const nDisc = $('#nDisconnect');
  if (nDisc) nDisc.addEventListener('click', () => {
    if (!confirm('Notion anahtarı bu telefondan silinsin mi?')) return;
    clearToken();
    toast('Anahtar silindi');
    renderSettings();
  });
  $('#privFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { setPrivate(JSON.parse(await f.text())); refreshLessons(); toast('Özel veriler yüklendi ✓'); renderSettings(); } catch { toast('Bu dosya özel veri dosyası değil'); }
  });
  $('#privClear').addEventListener('click', () => { clearPrivate(); refreshLessons(); toast('Kaldırıldı'); renderSettings(); });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Tüm ilerleme silinsin mi? Bu geri alınamaz.')) { store.reset(); toast('Sıfırlandı'); location.hash = '#/bugun'; }
  });
}

$('#settingsBtn').addEventListener('click', () => (location.hash = '#/ayarlar'));

// ───────────────────────── Start ─────────────────────────
navigate();
loadLocalDevFile().then((loaded) => { if (loaded) { refreshLessons(); if (current === 'bugun') navigate(); } });

// Beim Start automatisch aus Notion aktualisieren (höchstens alle 3 Stunden, still im Hintergrund)
if (getToken() && navigator.onLine) {
  const last = getPrivate() && getPrivate().syncedAt ? Date.parse(getPrivate().syncedAt) : 0;
  if (Date.now() - last > 3 * 3600 * 1000) {
    syncFromNotion({ faecher: FAECHER, lessons: LESSONS })
      .then(() => { refreshLessons(); toast("Notion'dan güncellendi ✓"); if (['bugun', 'kartlar', 'dersler'].includes(current)) navigate(); })
      .catch(() => { /* offline oder Token ungültig – alte Daten bleiben */ });
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
