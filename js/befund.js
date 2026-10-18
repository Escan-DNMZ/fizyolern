// Befund-Trainer („Vaka çalışması“): Fall lesen → Untersuchungen wählen → Befundbogen ausfüllen → mit Musterlösung vergleichen.
// Ablauf wie in der praktischen Prüfung (PhysTh-APrV §14): Befund, Dokumentation, Therapieplan mit Zielen.
// Der laufende Fall liegt in store.caseRun und übersteht ein Neuladen der App.
import * as store from './store.js';
import { CASES, FIELDS, STADIEN, INDIKATION } from './data/cases.js';
import { containsFuzzy } from './fuzzy.js';

let ctx = null; // { view, $, $$, esc, toast, btn3d }

export function initBefund(deps) { ctx = deps; }

const caseById = (id) => CASES.find((c) => c.id === id);
const run = () => store.get().caseRun;
const pct = (x) => Math.round(x * 100);

// Schlüsselbegriffe eines Feldes prüfen („a|b“ = Alternativen)
const kwHits = (text, kw) => kw.map((k) => ({ k, hit: k.split('|').some((alt) => containsFuzzy(text, alt)) }));

// Gesamtauswertung: jedes Feld zählt gleich, dazu Stadium und Indikation
export function scoreCase(c, r) {
  const fields = FIELDS.map((f) => {
    const hits = kwHits((r.f || {})[f.k] || '', c[f.k].kw);
    return { ...f, hits, score: hits.filter((h) => h.hit).length / hits.length };
  });
  const chips = [r.stadium === c.stadium ? 1 : 0, r.indik === c.indikation ? 1 : 0];
  const parts = [...fields.map((f) => f.score), ...chips];
  const missed = c.exams.filter((e) => e.key && !r.seen.includes(e.id));
  return { fields, total: parts.reduce((a, b) => a + b, 0) / parts.length, missed };
}

// ───── Einstieg ─────
export function renderCases(args = []) {
  const id = args[0];
  if (!id) return renderList();
  const c = caseById(id);
  if (!c) { ctx.view.innerHTML = '<p class="empty">Vaka bulunamadı.</p>'; return; }
  const s = store.get();
  if (!s.caseRun || s.caseRun.id !== id) {
    s.caseRun = { id, step: 'anamnese', seen: [], f: {}, stadium: '', indik: '' };
    store.save();
  }
  ({ anamnese: renderAnamnese, exam: renderExam, bogen: renderBogen, result: renderResult }[run().step] || renderAnamnese)(c);
}

function setStep(step) {
  run().step = step;
  store.save();
  renderCases([run().id]);
  ctx.view.scrollTop = 0;
  window.scrollTo(0, 0);
}

function renderList() {
  const { view, esc } = ctx;
  const st = store.get().cases || {};
  if (run() && run().step === 'result') { store.get().caseRun = null; store.save(); } // fertiger Fall → beim nächsten Öffnen neu
  const r = run();
  const open = r && caseById(r.id);
  view.innerHTML = `
    <div class="card">
      <div class="eyebrow">🩺 Befund-Trainer</div>
      <h2>Vaka çalışması</h2>
      <p class="small muted">Devlet sınavının pratik kısmında gerçek bir hastada muayene (Befund) yapıp belgeleyecek ve hedefli bir tedavi planı yazacaksın. Burada bunu adım adım çalışırsın: anamnezi oku → hangi muayeneyi yapacağını seç → Befundbogen'u doldur → örnek çözümle karşılaştır.</p>
      <p class="small muted">Vakalar Almanca, ipuçları Türkçe. Cevaplarını Almanca yaz (anahtar kavramlar kontrol edilir).</p>
    </div>
    ${open && r.step !== 'result' ? `<a class="card row" href="#/vaka/${encodeURIComponent(r.id)}" style="text-decoration:none;color:inherit;border:2px solid var(--accent)"><span class="grow"><div class="eyebrow">▶︎ Devam et</div><b lang="de">${esc(open.title)}</b><div class="muted small">${{ anamnese: 'Anamnez', exam: 'Muayene', bogen: 'Befundbogen' }[r.step] || ''}</div></span><span class="chev">›</span></a>` : ''}
    <div class="list">${CASES.map((c) => {
      const x = st[c.id];
      const badge = !x ? '<span class="badge">yeni</span>' : `<span class="badge ${x.best >= 0.75 ? 'good' : x.best >= 0.5 ? 'warn' : 'bad'}">%${pct(x.best)}</span>`;
      return `<a href="#/vaka/${encodeURIComponent(c.id)}"><span class="grow"><b class="small" lang="de">${esc(c.title)}</b><div class="muted small">${esc(c.tr)} · <span lang="de">${esc(c.bereich)}</span></div></span>${badge}<span class="chev">›</span></a>`;
    }).join('')}</div>
    <p class="muted small" style="padding:0 4px">Vakalar kurgusaldır. Ders kitabı bilgisine göre hazırlandı (Leitfragen, ICF, Klassifikationsmodell, Red/Yellow Flags).</p>
  `;
}

const stepper = (k) => `<div class="case-steps">${['Anamnez', 'Muayene', 'Befund', 'Sonuç'].map((s, i) => `<span class="${i < k ? 'done' : i === k ? 'on' : ''}">${i + 1}. ${s}</span>`).join('')}</div>`;

function anamneseBox(c, open = false) {
  const { esc } = ctx;
  return `<details class="card case-ana"${open ? ' open' : ''}><summary><b>Anamnese</b> <span class="muted small">(${esc(c.bereich)})</span></summary>
    <p lang="de">${esc(c.anamnese)}</p><div class="tr-box small">🇹🇷 ${esc(c.anamneseTr)}</div></details>`;
}

// ───── 1. Anamnese ─────
function renderAnamnese(c) {
  const { view, $, esc } = ctx;
  view.innerHTML = `
    ${stepper(0)}
    <div class="card">
      <div class="eyebrow" lang="de">${esc(c.bereich)}</div>
      <h2 lang="de">${esc(c.title)}</h2>
      <div class="muted small">🇹🇷 ${esc(c.tr)}</div>
      <h3>Anamnese</h3>
      <p lang="de" class="case-text">${esc(c.anamnese)}</p>
      <div class="tr-box small">🇹🇷 ${esc(c.anamneseTr)}</div>
    </div>
    <div class="card small">
      <b>Okurken düşün (4 Leitfrage):</b>
      <ol style="margin:6px 0 0;padding-left:20px" lang="de"><li>Was ist das Problem?</li><li>Was beeinflusst es?</li><li>Was kann der Patient tun?</li><li>Was soll sich verändern?</li></ol>
    </div>
    <button class="btn block" id="toExam">Muayeneye geç</button>
  `;
  $('#toExam').addEventListener('click', () => setStep('exam'));
}

// ───── 2. Untersuchung ─────
function findingsHtml(c, ids, { with3d = true } = {}) {
  const { esc, btn3d } = ctx;
  return ids.map((id, i) => {
    const e = c.exams.find((x) => x.id === id);
    return `<div class="card finding"><div class="row"><span class="badge">${i + 1}</span><b lang="de" class="grow">${esc(e.name)}</b></div>
      <ul lang="de">${e.find.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      ${e.note ? `<div class="muted small">💡 ${esc(e.note)}</div>` : ''}
      ${with3d ? btn3d(e.find.join(' '), { style: 'margin-top:8px', block: false }) : ''}</div>`;
  }).join('');
}

function renderExam(c) {
  const { view, $, $$, esc } = ctx;
  const r = run();
  const left = c.exams.filter((e) => !r.seen.includes(e.id));
  view.innerHTML = `
    ${stepper(1)}
    ${anamneseBox(c)}
    <p class="muted small" style="padding:0 4px">Sırada hangi muayeneyi yapardın? Her seçim bulguları açar. Gerekli olmayan bir test seçersen sonunda sana söylenir – gerçek sınavda da zaman sınırlı.</p>
    ${findingsHtml(c, r.seen)}
    ${left.length ? `<div class="section-title">Muayene seç</div><div class="list">${left.map((e) => `<button data-ex="${e.id}"><span class="grow"><b lang="de">${esc(e.name)}</b><div class="muted small">${esc(e.tr)}</div></span><span class="chev">＋</span></button>`).join('')}</div>` : '<p class="muted small" style="padding:0 4px">Tüm muayeneler yapıldı.</p>'}
    <button class="btn block" id="toBogen" ${r.seen.length ? '' : 'disabled'}>Befundbogen'u doldur${r.seen.length ? ` (${r.seen.length} muayene)` : ''}</button>
  `;
  $$('[data-ex]').forEach((b) => b.addEventListener('click', () => {
    r.seen.push(b.dataset.ex);
    store.save();
    renderExam(c);
    const cards = $$('.finding');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $('#toBogen').addEventListener('click', () => setStep('bogen'));
}

// ───── 3. Befundbogen ─────
function renderBogen(c) {
  const { view, $, $$, esc } = ctx;
  const r = run();
  const chipRow = (key, opts) => `<div class="chips" data-chips="${key}">${opts.map((o) => `<button class="chip${r[key] === o ? ' on' : ''}" data-v="${o}" lang="de">${o}</button>`).join('')}</div>`;
  view.innerHTML = `
    ${stepper(2)}
    ${anamneseBox(c)}
    <details class="card"><summary><b>Bulgular</b> <span class="muted small">(${r.seen.length} muayene)</span></summary>${findingsHtml(c, r.seen, { with3d: false })}</details>
    <div class="card">
      <h2>Befundbogen</h2>
      <p class="muted small">Almanca, kısa notlar yeterli. Taslak otomatik kaydedilir.</p>
      <h3 lang="de">Stadium</h3>
      ${chipRow('stadium', STADIEN)}
      <div class="muted small" style="margin-top:4px">akut ≤ 4. hafta · subakut 5.–12. hafta · chronisch &gt; 12 hafta</div>
      <h3 lang="de">Physiotherapie ist …</h3>
      ${chipRow('indik', INDIKATION)}
      ${FIELDS.map((f) => `<h3 lang="de">${esc(f.de)}</h3><div class="muted small">${esc(f.tr)}</div><textarea class="case-ta" data-f="${f.k}" lang="de" autocapitalize="sentences">${esc(r.f[f.k] || '')}</textarea>`).join('')}
    </div>
    <div class="grid2">
      <button class="btn ghost" id="backExam">← Muayene</button>
      <button class="btn" id="check">Karşılaştır</button>
    </div>
  `;
  $$('[data-chips]').forEach((row) => $$('.chip', row).forEach((b) => b.addEventListener('click', () => {
    r[row.dataset.chips] = b.dataset.v;
    store.save();
    $$('.chip', row).forEach((x) => x.classList.toggle('on', x === b));
  })));
  $$('.case-ta').forEach((ta) => ta.addEventListener('input', () => { r.f[ta.dataset.f] = ta.value; store.save(); }));
  $('#backExam').addEventListener('click', () => setStep('exam'));
  $('#check').addEventListener('click', () => {
    const empty = FIELDS.filter((f) => !(r.f[f.k] || '').trim()).length;
    if (empty > 4 && !confirm(`${empty} alan boş. Yine de karşılaştırılsın mı?`)) return;
    const res = scoreCase(c, r);
    store.recordCase(c.id, res.total, res.missed.map((e) => e.id));
    setStep('result');
  });
}

// ───── 4. Vergleich mit der Musterlösung ─────
function renderResult(c) {
  const { view, $, esc, btn3d } = ctx;
  const r = run();
  const res = scoreCase(c, r);
  const extra = c.exams.filter((e) => !e.key && r.seen.includes(e.id));
  const cls = (x) => (x >= 0.75 ? 'good' : x >= 0.4 ? 'warn' : 'bad');
  const allText = [c.anamnese, ...c.exams.flatMap((e) => e.find), c.massnahmen.a].join(' ');
  view.innerHTML = `
    ${stepper(3)}
    <div class="card" style="text-align:center">
      <div class="eyebrow" lang="de">${esc(c.title)}</div>
      <div class="score">%${pct(res.total)}</div>
      <div class="muted small">anahtar kavramlar + evre + endikasyon</div>
    </div>
    <div class="card">
      <h2>Muayene seçimi</h2>
      ${res.missed.length ? `<p class="small">❗ Atladığın önemli muayeneler:</p>${res.missed.map((e) => `<div class="small">• <b lang="de">${esc(e.name)}</b> – <span lang="de">${esc(e.find[0])}</span>${e.note ? `<div class="muted">💡 ${esc(e.note)}</div>` : ''}</div>`).join('')}` : '<p class="small">✅ Tüm önemli muayeneleri yaptın.</p>'}
      ${extra.length ? `<p class="small" style="margin-top:10px">ℹ️ Bu vakada gerekmeyen testler:</p>${extra.map((e) => `<div class="small">• <b lang="de">${esc(e.name)}</b> – ${esc(e.note || '')}</div>`).join('')}` : ''}
    </div>
    <div class="card">
      <h2>Klassifikationsmodell</h2>
      <p class="small" lang="de">Stadium: <b>${esc(c.stadium)}</b> ${r.stadium === c.stadium ? '✅' : `❌ <span class="muted">(dein: ${esc(r.stadium || '–')})</span>`}<br>
      Physiotherapie: <b>${esc(c.indikation)}</b> ${r.indik === c.indikation ? '✅' : `❌ <span class="muted">(dein: ${esc(r.indik || '–')})</span>`}</p>
      <div class="muted small">Diagnose · beitragende Faktoren · Stadium → Therapie · Management · Prognose</div>
    </div>
    ${res.fields.map((f) => `
      <div class="card">
        <div class="row"><h3 class="grow" style="margin:0" lang="de">${esc(f.de)}</h3><span class="badge ${cls(f.score)}">${f.hits.filter((h) => h.hit).length}/${f.hits.length}</span></div>
        <div style="margin-top:6px">${f.hits.map((h) => `<span class="kw ${h.hit ? 'hit' : 'miss'}" lang="de">${h.hit ? '✓' : '✗'} ${esc(h.k.split('|')[0])}</span>`).join('')}</div>
        ${(r.f[f.k] || '').trim() ? `<div class="case-mine small" lang="de">${esc(r.f[f.k])}</div>` : '<div class="muted small">(boş)</div>'}
        <div class="explain" lang="de">${esc(c[f.k].a)}</div>
        ${f.k === 'flags' ? `<div class="small" lang="de"><b>🔴 Red:</b> ${c.flags.red.map(esc).join(' · ')}<br><b>🟡 Yellow:</b> ${c.flags.yellow.map(esc).join(' · ')}</div>` : ''}
      </div>`).join('')}
    ${btn3d(allText, { style: 'margin:4px 0 12px' })}
    <div class="grid2">
      <button class="btn ghost" id="retry">Yeniden dene</button>
      <a class="btn" href="#/vaka">Diğer vakalar</a>
    </div>
  `;
  $('#retry').addEventListener('click', () => {
    store.get().caseRun = { id: c.id, step: 'anamnese', seen: [], f: {}, stadium: '', indik: '' };
    store.save();
    renderCases([c.id]);
  });
}
