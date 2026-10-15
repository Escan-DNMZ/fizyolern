import * as store from './store.js';
import { MUSCLES, BONES, JOINTS, ALL_STRUCTURES, findStructure } from './data/anatomy.js';
import { GRUNDWORTSCHATZ, BASE_VOCAB } from './data/vocab.js';
import { OPEN } from './data/questions.js';
import { LESSONS } from './data/lessons.js';
import { getPrivate, setPrivate, clearPrivate, loadLocalDevFile, fehlerList, notionLink, week, todayPlan } from './private.js';
import { getToken, setToken, clearToken, looksLikeToken, syncFromNotion } from './notion.js';
import { buildQuiz, QUIZ_CATEGORIES, FAECHER, lessonMcq, muscleQuestions, boneQuestions, jointQuestions, prepare, shuffle } from './quizgen.js';

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
const ALL_OPEN = [
  ...LESSONS.flatMap((l) => l.open.map((q, i) => ({ id: `LO:${l.id}:${i}`, cat: l.fach, lesson: l.id, q: q.q, a: q.a, kw: q.kw }))),
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
  if (deck === 'fehler') {
    return fehlerList().map((f) => ({
      id: f.id, tag: '✗ ' + f.fach, front: f.q,
      // Aus Notion: Lückentext-Segmente (fett = Antwort); aus Datei: Frage/Antwort/Türkçe
      back: f.seg
        ? `<div class="detail" style="font-size:15px">${f.seg.map((x) => (x.b ? `<b style="color:var(--accent)">${esc(x.t)}</b>` : esc(x.t))).join('')}</div>`
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
      back: `<div class="detail"><b>${esc(m.la)}</b> · ${esc(m.tr)}<br><br><b>Ursprung:</b> ${esc(m.o)}<br><b>Ansatz:</b> ${esc(m.i)}<br><b>Innervation:</b> ${esc(m.inn)}<br><b>Funktion:</b> ${esc(m.f)}</div>`,
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
    </div>` : ''}

    <div class="list">
      ${tasks.map((t) => `<a class="task" href="${t.href}"><span class="check ${t.done ? 'done' : ''}">${t.done ? '✓' : ''}</span><span class="grow">${t.label}</span><span class="chev">›</span></a>`).join('')}
    </div>

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

    <div class="section-title">İstatistik</div>
    <div class="grid2">
      <div class="card" style="margin:0"><div class="muted small">Tekrar bekleyen kart</div><h2>${due}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">Test başarısı</div><h2>${acc === null ? '–' : acc + '%'}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">Öğrenilen yapı</div><h2>${Object.keys(s.learned).length}/${ALL_STRUCTURES.length}</h2></div>
      <div class="card" style="margin:0"><div class="muted small">Öğrenilen kart</div><h2>${Object.values(s.srs).filter((c) => c.int >= 1).length}</h2></div>
    </div>
  `;
}

function nextOpenQuestion() {
  const done = store.get().open;
  return ALL_OPEN.find((q) => !done[q.id]) || [...ALL_OPEN].sort((a, b) => (done[a.id].score - done[b.id].score) || done[a.id].last.localeCompare(done[b.id].last))[0];
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
        <dt>Bewegungsausmaß (Neutral-Null-Methode)</dt><dd>${esc(s.nn)}</dd>
        <dt>Bänder & Strukturen</dt><dd>${esc(s.baender)}</dd>
      </dl>`;
  }
  const terms = BONE_TERMS[s.id] || [];
  const related = s.kind === 'bone'
    ? MUSCLES.filter((m) => terms.some((t) => norm(m.o + ' ' + m.i).includes(norm(t))))
    : [];

  const gen = s.kind === 'muscle' ? muscleQuestions(s) : s.kind === 'bone' ? boneQuestions(s) : jointQuestions(s);
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
  const qs = l.mcq.map((_, i) => st.quiz[`L:${l.id}:${i}`]).filter(Boolean);
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
  const opens = ALL_OPEN.filter((q) => q.lesson === l.id);
  view.innerHTML = `
    <div class="card">
      <div class="eyebrow" lang="de">${esc(l.fach)}</div>
      <h2 lang="de">${esc(l.title)}</h2>
      <div class="grid2" style="margin-top:12px">
        <a class="btn" href="#/test?kat=${encodeURIComponent('Lektion: ' + l.id)}">Test (${l.mcq.length} soru)</a>
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

// ───────────────────────── Quiz ─────────────────────────
let quiz = null;
let quizCat = 'Gemischt';

function renderQuizStart(_, params = new URLSearchParams()) {
  const kat = params.get('kat');
  if (kat) {
    // Direktstart, z. B. Morgentest aus dem Tagesplan oder Test zu einer Lektion
    quizCat = kat;
    history.replaceState(null, '', '#/test');
    quiz = { qs: buildQuiz(kat, store.get().settings.quizGoal, store.get().customVocab), i: 0, right: 0, wrong: [], finished: false, cat: kat };
    if (!quiz.qs.length) { quiz = null; toast('Bu kategori için soru yok'); } else return renderQuizQuestion();
  }
  if (quiz && !quiz.finished) return renderQuizQuestion();
  const stats = store.get().quiz;
  const weak = Object.entries(stats).filter(([, v]) => v.w > v.r).length;
  view.innerHTML = `
    <div class="card">
      <h2>Kategori seç</h2>
      <div class="chips" style="margin-top:10px">
        ${[...QUIZ_CATEGORIES, ...(QUIZ_CATEGORIES.includes(quizCat) ? [] : [quizCat])].map((c) => `<button class="chip ${c === quizCat ? 'on' : ''}" data-cat="${esc(c)}">${c === 'Gemischt' ? 'Karışık' : esc(c)}</button>`).join('')}
      </div>
      <button class="btn block" id="startQuiz" style="margin-top:16px">${store.get().settings.quizGoal} soruluk testi başlat</button>
    </div>
    <p class="muted small" style="padding:0 4px">Sorular Almanca, açıklamalar Türkçe. Kas/kemik/eklem soruları anatomi verilerinden her seferinde yeniden üretilir.${weak ? ` Şu ana kadar <b>${weak}</b> soruda daha çok hata yaptın.` : ''}</p>
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
    if (navigator.vibrate) navigator.vibrate(ok ? 15 : [30, 40, 30]);
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
  const n = quiz.qs.length;
  const pct = n ? Math.round((quiz.right / n) * 100) : 0;
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="score">${quiz.right}/${n}</div>
      <div class="muted">${pct >= 80 ? 'Harika! 💪' : pct >= 50 ? 'İyi gidiyor, devam!' : 'Tekrar zamanı – yanlışlara bak 👇'}</div>
    </div>
    ${quiz.wrong.length ? `<div class="section-title">Yanlışların</div>${quiz.wrong.map((q) => `<div class="card small"><b>${esc(q.q)}</b><div class="explain">✔︎ ${esc(q.opts[q.ans])}<br><span class="muted">${esc(q.x)}</span></div></div>`).join('')}` : ''}
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
  const cats = [...new Set(ALL_OPEN.map((q) => q.cat))];
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">Cevabını Almanca yaz (sınav pratiği!). Uygulama anahtar kavramları kontrol eder, sonra örnek cevabı gösterir ve kendini değerlendirirsin.</p>
    ${cats.map((c) => `
      <div class="section-title" lang="de">${esc(c)}</div>
      <div class="list">
        ${ALL_OPEN.filter((q) => q.cat === c).map((q) => {
          const r = st[q.id];
          const badge = !r ? '<span class="badge">yeni</span>' : r.score >= 0.75 ? '<span class="badge good">iyi</span>' : r.score >= 0.4 ? '<span class="badge warn">kısmen</span>' : '<span class="badge bad">tekrar</span>';
          return `<a href="#/soru/${q.id}"><span class="grow small">${esc(q.q)}</span>${badge}</a>`;
        }).join('')}
      </div>`).join('')}
  `;
}

function renderOpenQuestion([id]) {
  const q = ALL_OPEN.find((x) => x.id === id) || ALL_OPEN[0];
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
    const hits = q.kw.map((k) => ({ k, hit: k.split('|').some((alt) => ans.includes(norm(alt))) }));
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
    session = { deck: deckId, queue: store.buildSession(cards, { noNewLimit: deckId === 'fehler' }), done: 0, flipped: false };
  }
  const deck = DECKS().find((d) => d.id === deckId);
  $('#title').textContent = deck ? deck.name : 'Kartlar';
  const card = session.queue[0];
  if (!card) {
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
        <div class="face back">${card.back}</div>
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
        viewer = new Anatomy3D($('#canvas3d'), { onSelect: showSheet });
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
  if (id) viewer.select(id);
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
      viewer.select(b.dataset.id);
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
        : `Haftalık programın, hata listen ve Grundwortschatz doğrudan Notion'dan okunur. Anahtar <b>sadece bu telefonda</b> saklanır ve sadece api.notion.com'a gönderilir.
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
    <p class="muted small" style="margin-top:24px;padding:0 4px">3D kemikler: <b>BodyParts3D</b>, © The Database Center for Life Science (DBCLS), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. 3D kas modelleri <b>Sinew</b> (sinew.pin.games) oyunundan. Kafatası, boyun omurları ve diğer kaslar şematik çizimdir. İçerik ders kitapları (ör. Prometheus, Schünke) ile kontrol edilmelidir.</p>
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
    try { setPrivate(JSON.parse(await f.text())); toast('Özel veriler yüklendi ✓'); renderSettings(); } catch { toast('Bu dosya özel veri dosyası değil'); }
  });
  $('#privClear').addEventListener('click', () => { clearPrivate(); toast('Kaldırıldı'); renderSettings(); });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Tüm ilerleme silinsin mi? Bu geri alınamaz.')) { store.reset(); toast('Sıfırlandı'); location.hash = '#/bugun'; }
  });
}

$('#settingsBtn').addEventListener('click', () => (location.hash = '#/ayarlar'));

// ───────────────────────── Start ─────────────────────────
navigate();
loadLocalDevFile().then((loaded) => { if (loaded && current === 'bugun') navigate(); });

// Beim Start automatisch aus Notion aktualisieren (höchstens alle 3 Stunden, still im Hintergrund)
if (getToken() && navigator.onLine) {
  const last = getPrivate() && getPrivate().syncedAt ? Date.parse(getPrivate().syncedAt) : 0;
  if (Date.now() - last > 3 * 3600 * 1000) {
    syncFromNotion({ faecher: FAECHER, lessons: LESSONS })
      .then(() => { toast("Notion'dan güncellendi ✓"); if (current === 'bugun' || current === 'kartlar') navigate(); })
      .catch(() => { /* offline oder Token ungültig – alte Daten bleiben */ });
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
