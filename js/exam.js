// Deneme sınavı (Probeklausur) für ein Fach: 15 Multiple-Choice + 3 offene Fragen, mit Zeitlimit.
// Während der Prüfung kein Feedback; am Ende Ergebnis pro Thema und die falschen Antworten.
import * as store from './store.js';
import { LESSONS, FAECHER } from './lessons.js';
import { examPool, prepare, shuffle } from './quizgen.js';
import { containsFuzzy } from './fuzzy.js';
import { upcoming } from './private.js';

export const MOCK_MCQ = 15;
export const MOCK_OPEN = 3;
export const MOCK_MIN = 30; // 1 dk pro Multiple-Choice + 5 dk pro offene Frage

let ctx = null; // { view, $, $$, esc, escGap, toast, allOpen }
let tick = null;

export function initExam(deps) { ctx = deps; }

const lessonTitle = (id) => (LESSONS.find((l) => l.id === id) || {}).title;
// Thema einer Frage für die Auswertung: Lektion, sonst Kategorie (Muskeln, Knochen, Gelenke …)
const topicName = (q) => (q.lesson && lessonTitle(q.lesson)) || (String(q.id).startsWith('g:jx:') ? 'Gelenkdaten (ROM, Achsen, Muskeln)' : q.cat) || 'Diğer';

// Aus jedem Thema reihum ziehen, damit die Probeklausur das ganze Fach abdeckt
function spread(pool, n) {
  const groups = {};
  for (const q of shuffle(pool)) (groups[topicName(q)] = groups[topicName(q)] || []).push(q);
  const lists = shuffle(Object.values(groups));
  const out = [];
  const seen = new Set();
  while (out.length < n && lists.some((l) => l.length)) {
    for (const l of lists) {
      const q = l.shift();
      if (q && !seen.has(q.id)) { seen.add(q.id); out.push(q); }
      if (out.length === n) break;
    }
  }
  return out;
}

const openFor = (fach) => ctx.allOpen().filter((q) => q.cat === fach || (fach === 'Anatomie' && q.cat === 'Gelenke'));

export function mockFaecher() {
  return FAECHER.map((f) => ({ fach: f, mcq: examPool(f).length, open: openFor(f).length }))
    .filter((x) => x.mcq >= 8 && x.open >= 1);
}

// Notenschlüssel wie in vielen Berufsfachschulen (Prozent → Note), nur als grobe Orientierung
export const noteFor = (pct) => (pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 67 ? 3 : pct >= 50 ? 4 : pct >= 30 ? 5 : 6);

function startMock(fach) {
  const mcq = spread(examPool(fach), MOCK_MCQ).map((q) => {
    const p = prepare(q);
    return { id: p.id, cat: p.cat, lesson: p.lesson, q: p.q, opts: p.opts, ans: p.ans, x: p.x, topic: topicName(q) };
  });
  const open = spread(openFor(fach), MOCK_OPEN).map((q) => ({ id: q.id, q: q.q, a: q.a, kw: q.kw, topic: topicName(q) }));
  const s = store.get();
  s.mockRun = { fach, start: Date.now(), end: Date.now() + MOCK_MIN * 60000, i: 0, mcq, open, pick: {}, text: {} };
  store.save();
  location.hash = '#/deneme/run';
}

const run = () => store.get().mockRun;
const leftMs = () => Math.max(0, run().end - Date.now());
const mmss = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

// ───── Start: Fach wählen ─────
export function renderMock(args = []) {
  stopTick();
  const { view, $$, esc } = ctx;
  if (args[0] === 'run' && run()) return renderRun();
  if (args[0] === 'sonuc') return renderResult(store.get().mocks.length - 1);
  const r = run();
  const soon = upcoming('Sınav', 30);
  const list = mockFaecher();
  const past = (store.get().mocks || []).slice(-5).reverse();
  view.innerHTML = `
    ${r ? `<a class="card row" href="#/deneme/run" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">⏱️ Devam eden sınav</div><h2>${esc(r.fach)}</h2><div class="muted small">${leftMs() ? 'Kalan süre ' + mmss(leftMs()) : 'Süre doldu – sonucu gör'}</div></span><span class="chev">›</span></a>` : ''}
    <div class="card">
      <div class="eyebrow">📝 Deneme sınavı</div>
      <h2>Gerçek sınav gibi çalış</h2>
      <p class="small muted" style="margin-bottom:0">${MOCK_MCQ} çoktan seçmeli + ${MOCK_OPEN} açık uçlu soru · <b>${MOCK_MIN} dk</b> · cevaplar ve açıklamalar sadece sonunda. Sonuçta konu konu başarın ve yanlışların listelenir.</p>
    </div>
    ${soon.length ? `<div class="section-title">Yaklaşan sınavlar</div><div class="list">${soon.map((e) => {
      const ok = list.some((x) => x.fach === e.fach);
      return `<${ok ? `button data-fach="${esc(e.fach)}"` : 'div'} class="row" style="width:100%;text-align:left"><span class="grow"><b>${esc(e.fach || 'Sınav')}</b>${e.topic ? ` <span class="muted small">· ${esc(e.topic)}</span>` : ''}<div class="muted small">${e.days === 0 ? 'Bugün!' : e.days === 1 ? 'Yarın' : e.days + ' gün sonra'} · ${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.</div></span>${ok ? '<span class="mini">Başlat</span>' : '<span class="muted small">soru yok</span>'}</${ok ? 'button' : 'div'}>`;
    }).join('')}</div>` : ''}
    <div class="section-title">Ders seç</div>
    <div class="list">
      ${list.map((x) => `<button data-fach="${esc(x.fach)}" class="row" style="width:100%;text-align:left"><span class="grow"><b>${esc(x.fach)}</b><div class="muted small">${x.mcq} test + ${x.open} açık uçlu soru havuzu</div></span><span class="chev">›</span></button>`).join('')}
    </div>
    ${past.length ? `<div class="section-title">Önceki denemeler</div><div class="list">${past.map((m, k) => `<button data-res="${store.get().mocks.length - 1 - k}" class="row" style="width:100%;text-align:left"><span class="grow"><b>${esc(m.fach)}</b> <span class="muted small">· ${m.date.slice(8, 10)}.${m.date.slice(5, 7)}.</span><div class="muted small">%${m.pct} · tahmini not ${noteFor(m.pct)} · ${m.min} dk</div></span><span class="chev">›</span></button>`).join('')}</div>` : ''}`;
  $$('[data-fach]').forEach((b) => b.addEventListener('click', () => {
    if (run() && !confirm('Devam eden sınav silinsin ve yenisi başlasın mı?')) return;
    startMock(b.dataset.fach);
  }));
  $$('[data-res]').forEach((b) => b.addEventListener('click', () => renderResult(+b.dataset.res)));
}

// ───── Prüfung: eine Frage pro Seite, Navigation über Nummern ─────
function renderRun() {
  const { view, $, $$, esc, escGap } = ctx;
  const r = run();
  if (!leftMs()) return finish();
  const total = r.mcq.length + r.open.length;
  const i = Math.min(r.i, total - 1);
  const isOpen = i >= r.mcq.length;
  const q = isOpen ? r.open[i - r.mcq.length] : r.mcq[i];
  const answered = (k) => (k < r.mcq.length ? r.pick[r.mcq[k].id] !== undefined : !!(r.text[r.open[k - r.mcq.length].id] || '').trim());
  const nAnswered = [...Array(total).keys()].filter(answered).length;
  view.innerHTML = `
    <div class="row mock-head"><span class="badge">${esc(r.fach)}</span><span class="spacer"></span><span class="mock-timer" id="mockTimer">⏱️ ${mmss(leftMs())}</span></div>
    <div class="mock-nav">${[...Array(total).keys()].map((k) => `<button class="${k === i ? 'on' : ''} ${answered(k) ? 'done' : ''} ${k >= r.mcq.length ? 'open' : ''}" data-go="${k}" aria-label="Soru ${k + 1}">${k + 1}</button>`).join('')}</div>
    <div class="muted small" style="margin:6px 2px">${isOpen ? 'Açık uçlu soru – Almanca cevap yaz' : 'Çoktan seçmeli'} · ${nAnswered}/${total} cevaplandı</div>
    <div class="question" lang="de">${escGap(q.q)}</div>
    ${isOpen
      ? `<textarea id="mockText" lang="de" placeholder="Cevabını buraya yaz (Almanca)…">${esc(r.text[q.id] || '')}</textarea>`
      : q.opts.map((o, k) => `<button class="opt ${r.pick[q.id] === k ? 'picked' : ''}" data-k="${k}">${esc(o)}</button>`).join('')}
    <div class="grid2" style="margin-top:14px">
      <button class="btn plain" id="prevQ" ${i === 0 ? 'disabled' : ''}>‹ Önceki</button>
      ${i + 1 < total ? '<button class="btn" id="nextQ">Sonraki ›</button>' : '<button class="btn" id="finishQ">Sınavı bitir</button>'}
    </div>
    ${i + 1 < total ? '<button class="btn plain block" id="finishQ" style="margin-top:16px">Sınavı bitir</button>' : ''}`;
  const go = (k) => { r.i = k; store.save(); renderRun(); view.scrollTop = 0; };
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.go)));
  $$('[data-k]').forEach((b) => b.addEventListener('click', () => {
    r.pick[q.id] = +b.dataset.k;
    store.save();
    $$('[data-k]').forEach((x) => x.classList.toggle('picked', x === b));
    const nav = $(`[data-go="${i}"]`);
    if (nav) nav.classList.add('done');
  }));
  const ta = $('#mockText');
  if (ta) ta.addEventListener('input', () => { r.text[q.id] = ta.value; store.save(); });
  $('#prevQ').addEventListener('click', () => go(i - 1));
  const nx = $('#nextQ');
  if (nx) nx.addEventListener('click', () => go(i + 1));
  $('#finishQ').addEventListener('click', () => {
    const missing = total - [...Array(total).keys()].filter(answered).length;
    if (missing && !confirm(`${missing} soru boş. Yine de bitirilsin mi?`)) return;
    finish();
  });
  stopTick();
  tick = setInterval(() => {
    const el = document.getElementById('mockTimer');
    if (!el || !run() || !location.hash.startsWith('#/deneme/run')) return stopTick();
    const ms = leftMs();
    el.textContent = '⏱️ ' + mmss(ms);
    el.classList.toggle('low', ms < 5 * 60000);
    if (!ms) { stopTick(); ctx.toast('Süre doldu!'); finish(); }
  }, 1000);
}

// ───── Auswertung ─────
function finish() {
  stopTick();
  const r = run();
  if (!r) return renderMock();
  const topics = {};
  const add = (t, got, max) => { const o = topics[t] || (topics[t] = { r: 0, n: 0 }); o.r += got; o.n += max; };
  const mcq = r.mcq.map((q) => {
    const pick = r.pick[q.id];
    const ok = pick === q.ans;
    if (pick !== undefined) store.recordQuiz(q.id, ok);
    add(q.topic, ok ? 1 : 0, 1);
    return { ...q, pick, ok };
  });
  // Offene Frage: 3 Punkte × Anteil der gefundenen Schlüsselbegriffe
  const open = r.open.map((q) => {
    const text = r.text[q.id] || '';
    const hits = q.kw.map((k) => ({ k: k.split('|')[0], hit: !!text.trim() && k.split('|').some((alt) => containsFuzzy(text, alt)) }));
    const score = hits.length ? hits.filter((h) => h.hit).length / hits.length : 0;
    if (text.trim()) store.recordOpen(q.id, score);
    add(q.topic, score * 3, 3);
    return { ...q, text, hits, score };
  });
  const got = mcq.filter((q) => q.ok).length + open.reduce((n, q) => n + q.score * 3, 0);
  const max = mcq.length + open.length * 3;
  store.recordMock({
    date: store.today(),
    fach: r.fach,
    pct: Math.round((got / max) * 100),
    min: Math.max(1, Math.round((Math.min(Date.now(), r.end) - r.start) / 60000)),
    mcq: { r: mcq.filter((q) => q.ok).length, n: mcq.length },
    open: { score: Math.round(open.reduce((n, q) => n + q.score, 0) * 10) / 10, n: open.length },
    topics: Object.fromEntries(Object.entries(topics).map(([t, v]) => [t, { r: Math.round(v.r * 10) / 10, n: v.n }])),
    // Details nur für die Ergebnisseite (falsche Fragen); IDs bleiben lokal
    wrong: mcq.filter((q) => !q.ok).map((q) => ({ q: q.q, pick: q.pick === undefined ? null : q.opts[q.pick], a: q.opts[q.ans], x: q.x, topic: q.topic })),
    openRes: open.map((q) => ({ q: q.q, text: q.text, a: q.a, hits: q.hits, score: Math.round(q.score * 100) / 100 })),
  });
  history.replaceState(null, '', '#/deneme/sonuc');
  renderResult(store.get().mocks.length - 1);
}

function renderResult(idx) {
  const { view, $, esc } = ctx;
  const m = store.get().mocks[idx];
  if (!m) return renderMock();
  const note = noteFor(m.pct);
  const rows = Object.entries(m.topics).map(([t, v]) => ({ t, p: v.n ? Math.round((v.r / v.n) * 100) : 0, v })).sort((a, b) => a.p - b.p);
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="eyebrow">📝 Deneme sınavı · ${esc(m.fach)}</div>
      <div class="score">%${m.pct}</div>
      <div class="muted">Tahmini not: <b>${note}</b> · ${m.mcq.r}/${m.mcq.n} test doğru · açık uçlu ${String(m.open.score).replace('.', ',')}/${m.open.n} · ${m.min} dk</div>
      <div class="small" style="margin-top:6px">${note <= 2 ? 'Sınava hazırsın! 💪' : note <= 4 ? 'Geçer – zayıf konuları bir kez daha tekrar et.' : 'Daha çok tekrar lazım – aşağıdaki konulardan başla 👇'}</div>
    </div>
    <div class="section-title">Konulara göre</div>
    <div class="card">
      ${rows.map(({ t, p, v }) => `<div class="mock-topic"><div class="row small"><span class="grow" lang="de">${esc(t)}</span><b>%${p}</b><span class="muted" style="margin-left:6px">${String(v.r).replace('.', ',')}/${v.n}</span></div><div class="progress"><div style="width:${p}%;background:${p >= 67 ? 'var(--good)' : p >= 50 ? 'var(--warn)' : 'var(--bad)'}"></div></div></div>`).join('')}
    </div>
    ${m.wrong.length ? `<div class="section-title">Yanlış / boş testler (${m.wrong.length})</div>${m.wrong.map((q) => `<div class="card small"><div class="muted small">${esc(q.topic)}</div><b lang="de">${esc(q.q)}</b>
      <div class="explain">${q.pick === null ? '⚪ Boş bıraktın' : `❌ Senin cevabın: ${esc(q.pick)}`}<br>✔︎ <b>${esc(q.a)}</b><br><span class="muted">${esc(q.x)}</span></div></div>`).join('')}` : '<div class="card small">✅ Tüm test soruları doğru!</div>'}
    <div class="section-title">Açık uçlu sorular</div>
    ${m.openRes.map((q) => `<div class="card small"><b lang="de">${esc(q.q)}</b>
      <div style="margin:8px 0">${q.hits.map((h) => `<span class="kw ${h.hit ? 'hit' : 'miss'}">${h.hit ? '✓' : '✗'} ${esc(h.k)}</span>`).join('')}</div>
      ${q.text.trim() ? `<div class="muted small">Senin cevabın:</div><p lang="de" style="white-space:pre-wrap;margin-top:2px">${esc(q.text)}</p>` : '<p class="muted">⚪ Boş bıraktın</p>'}
      <div class="muted small">Örnek cevap (Musterlösung):</div><p lang="de" style="margin-top:2px">${esc(q.a)}</p></div>`).join('')}
    <div class="grid2">
      <a class="btn ghost" href="#/deneme">Denemeler</a>
      <button class="btn" id="mockAgain">Yeni deneme</button>
    </div>`;
  $('#mockAgain').addEventListener('click', () => startMock(m.fach));
}
