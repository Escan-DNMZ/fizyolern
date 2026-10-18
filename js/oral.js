// Sözlü sınav (mündliche Prüfung nach PhysTh-APrV § 13): Der „Prüfer“ liest die Frage auf Deutsch vor,
// die Antwort kommt per Spracherkennung oder iOS-Diktat ins Textfeld. Schlüsselbegriffe werden mit
// containsFuzzy geprüft; fehlt etwas, fragt der Prüfer einmal nach („Nachfrage“).
import * as store from './store.js';
import { MUSCLES, JOINTS } from './data/anatomy.js';
import { containsFuzzy } from './fuzzy.js';
import { shuffle } from './quizgen.js';
import { speak, stopSpeaking, canSpeak, canListen, listen, sayBtn, whenVoices } from './speech.js';

let ctx = null; // { view, $, $$, esc, toast, allOpen }
let sess = null;
let tick = null;
let rec = null;

export function initOral(deps) { ctx = deps; }

export const ORAL_N = 5;
// Höchstdauer der mündlichen Teilprüfungen (PhysTh-APrV § 13)
export const ORAL_MODES = [
  { id: 'anatomie', name: 'Anatomie', min: 30, sub: 'Kaslar (Ursprung · Ansatz · Innervation · Funktion), eklemler, açık uçlu sorular' },
  { id: 'physiologie', name: 'Physiologie', min: 15, sub: 'Ders notlarındaki açık uçlu sorular' },
  { id: 'krankheitslehre', name: 'Spezielle Krankheitslehre', min: 30, sub: 'Klinik, Neuro, Orthopädie/Chirurgie (O/C)' },
];

// ───── Schlüsselbegriffe aus den Anatomie-Daten ─────
// Allgemeine Wörter zählen nicht als Treffer („Tuberculum“ allein sagt nichts über den Ursprung)
const STOP = new Set(['pars', 'caput', 'laterales', 'lateralen', 'mediales', 'medialen', 'drittel', 'hälfte', 'oberen', 'unteren', 'oberer', 'unterer',
  'vorderer', 'vorderen', 'hinterer', 'hinteren', 'fläche', 'äußere', 'äußeren', 'innere', 'inneren', 'zwischen', 'sowie', 'gebeugtem', 'gestrecktem',
  'stärkster', 'wichtigster', 'muskel', 'muskels', 'beide', 'beider', 'über', 'unter', 'gegen', 'seite', 'gelenk', 'gelenks', 'stellung', 'tuberculum',
  'tuberositas', 'processus', 'linea', 'facies', 'margo', 'crista', 'spina', 'fossa', 'nervus', 'nervi', 'sehne', 'sehnen', 'anteil', 'anteile', 'fasern',
  'vorne', 'hinten', 'außen', 'innen', 'meist', 'teilweise', 'zusätzlich', 'ventral', 'dorsal', 'bewegung', 'bewegungen', 'kleine', 'großen', 'schwach',
  'inferior', 'superior', 'anterior', 'posterior', 'medialis', 'lateralis', 'minoris', 'majoris', 'proximal', 'distal',
  'freiheitsgrade', 'beweglichstes', 'körpers', 'durch', 'werden', 'wird', 'eines', 'einer', 'einem', 'dabei', 'hauptsächlich', 'jeweils']);
const terms = (s) => [...new Set(String(s || '').replace(/\([^)]*\)/g, ' ').split(/[^A-Za-zÄÖÜäöüß-]+/)
  .map((w) => w.replace(/^-+|-+$/g, '')).filter((w) => w.length >= 5 && !STOP.has(w.toLowerCase())))];
const part = (label, text, alts = terms(text)) => ({ label, fact: text, alts });

const MUSCLE_FOLLOW = {
  Ursprung: 'Und wo entspringt der Muskel?',
  Ansatz: 'Wo setzt er an?',
  Innervation: 'Welcher Nerv innerviert ihn?',
  Funktion: 'Und welche Funktion hat er?',
};
const JOINT_FOLLOW = {
  Gelenktyp: 'Um welchen Gelenktyp handelt es sich?',
  Bänder: 'Welche Bänder sichern das Gelenk?',
  Bewegungen: 'Welche Bewegungen sind möglich – und mit welchem Bewegungsausmaß?',
};

const muscleArt = (m) => (/^Mm\./.test(m.la) ? 'die' : /^M\./.test(m.la) ? 'den' : 'das');
function muscleItem(m) {
  return {
    id: 'oral:m:' + m.id, kind: 'muscle', topic: 'Kas · ' + m.la,
    q: `Stellen Sie ${muscleArt(m)} ${m.la} vor: Ursprung, Ansatz, Innervation und Funktion.`,
    parts: [part('Ursprung', m.o), part('Ansatz', m.i), part('Innervation', m.inn), part('Funktion', m.f)],
    a: `Ursprung: ${m.o}. Ansatz: ${m.i}. Innervation: ${m.inn}. Funktion: ${m.f}.`,
    tr: m.ftr, follow: MUSCLE_FOLLOW,
  };
}
// „Proximales Handgelenk“ → „das proximale Handgelenk“
const jointName = (j) => 'das ' + j.de.replace(/^([A-ZÄÖÜ][a-zäöü]+)es\s/, (_, a) => a.toLowerCase() + 'e ');
function jointItem(j) {
  const bew = j.rom ? j.rom.map((r) => `${r.bew} ${r.a}°–0°–${r.b}°`).join('; ') : j.nn;
  const bewAlts = terms(j.rom ? j.rom.map((r) => r.bew).join(' ') : j.nn).filter((w) => !/^\d/.test(w));
  return {
    id: 'oral:j:' + j.id, kind: 'joint', topic: 'Eklem · ' + j.de,
    q: `Stellen Sie ${jointName(j)} vor: Gelenktyp, Bänder und Bewegungsausmaß.`,
    parts: [part('Gelenktyp', j.typ, terms(j.typ.split(/[–(;,]/)[0])), part('Bänder', j.baender), part('Bewegungen', bew, bewAlts)].filter((p) => p.alts.length),
    a: `Gelenktyp: ${j.typ}. Bänder: ${j.baender}. Bewegungsausmaß: ${bew}.`,
    tr: j.tr, follow: JOINT_FOLLOW,
  };
}
function openItem(q) {
  return {
    id: q.id, kind: 'open', topic: q.cat, q: q.q, a: q.a, record: true,
    parts: q.kw.map((k) => ({ label: k.split('|')[0], alts: k.split('|') })),
    followAny: 'Was fällt Ihnen dazu noch ein? Können Sie das etwas genauer ausführen?',
  };
}

// Schlechter beantwortete / neue offene Fragen zuerst (mit Zufall innerhalb gleicher Stufe)
function byNeed(list) {
  const st = store.get().open;
  const lvl = (q) => (!st[q.id] ? 1 : st[q.id].score < 0.75 ? 0 : 2);
  return shuffle(list).sort((a, b) => lvl(a) - lvl(b));
}
function poolFor(mode) {
  const open = ctx.allOpen();
  if (mode === 'anatomie') {
    const o = byNeed(open.filter((q) => q.cat === 'Anatomie' || q.cat === 'Gelenke')).map(openItem);
    const ms = shuffle(MUSCLES).map(muscleItem);
    const js = shuffle(JOINTS).map(jointItem);
    return { pick: () => [ms[0], js[0], o[0], ms[1], o[1] || js[1]].filter(Boolean), size: o.length + ms.length + js.length };
  }
  const cats = mode === 'physiologie' ? ['Physiologie'] : ['Klinik', 'Neuro', 'O/C'];
  const o = byNeed(open.filter((q) => cats.includes(q.cat)));
  return { pick: () => o.slice(0, ORAL_N).map(openItem), size: o.length };
}

const mmss = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const leftMs = () => Math.max(0, sess.end - Date.now());
function stopAll() {
  if (tick) { clearInterval(tick); tick = null; }
  if (rec) { try { rec.abort(); } catch (e) { /* schon beendet */ } rec = null; }
  stopSpeaking();
}
const showText = () => store.get().settings.oralText !== false || !canSpeak();

const hitParts = (parts, text) => parts.map((p) => !!String(text || '').trim() && p.alts.some((a) => containsFuzzy(text, a)));

// ───── Start ─────
// Beim Verlassen der Prüfung: Timer, Mikrofon und Vorlesen stoppen
export const leaveOral = () => { if (tick || rec) stopAll(); };

export function renderOral(args = []) {
  if (args[0] === 'run' && sess) {
    if (rec) { try { rec.abort(); } catch (e) { /* egal */ } rec = null; }
    return sess.done ? renderSummary() : sess.phase === 'result' ? renderFeedback() : renderQuestion();
  }
  stopAll();
  const { view, $$, esc } = ctx;
  const voice = canSpeak(), mic = canListen();
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  view.innerHTML = `
    <div class="card">
      <div class="eyebrow">🎤 Sözlü sınav provası</div>
      <h2>Prüfer soruyor, sen Almanca cevaplıyorsun</h2>
      <p class="small muted" style="margin-bottom:0">${ORAL_N} soru · resmi süre sınırıyla (PhysTh-APrV § 13). Soru Almanca okunur; cevabını <b>sesli</b> ver. Eksik bir şey olursa Prüfer bir kez <b>nachfragt</b>. Sonunda bulunan/eksik kavramlar ve örnek cevap.</p>
    </div>
    <div class="card small">
      ${voice ? '🔊 Almanca ses: <b>var</b>' : '🔇 Bu cihazda Almanca ses bulunamadı – sorular yazılı gösterilecek.'}<br>
      ${mic ? '🎙️ Konuşma tanıma: <b>var</b> – mikrofon düğmesiyle konuş.' : `⌨️ Konuşma tanıma yok – ${isIOS ? 'klavyedeki <b>🎤 mikrofon</b> tuşuyla dikte et (klavye dili: Deutsch).' : 'cevabını yaz veya işletim sisteminin dikte özelliğini kullan.'}`}
      ${mic ? '<div class="muted" style="margin-top:4px">Not: Konuşma tanımayı tarayıcı yapar (Chrome/Safari sesi kendi sunucusunda işleyebilir); uygulama hiçbir yere ses göndermez.</div>' : ''}
    </div>
    <div class="section-title">Ders seç</div>
    <div class="list">
      ${ORAL_MODES.map((m) => {
        const n = poolFor(m.id).size;
        return `<button data-mode="${m.id}" class="row" style="width:100%;text-align:left" ${n ? '' : 'disabled'}><span class="grow"><b lang="de">${esc(m.name)}</b> <span class="badge">⏱️ ${m.min} dk</span><div class="muted small">${esc(m.sub)} · ${n} soru</div></span><span class="chev">›</span></button>`;
      }).join('')}
    </div>
    ${voice ? `<label class="row small" style="margin:12px 4px;gap:8px"><input type="checkbox" id="oralShowText" ${showText() ? 'checked' : ''}> Soruyu yazılı da göster <span class="muted">(kapalı = sadece dinleyerek, gerçek sınav gibi)</span></label>` : ''}`;
  const cb = document.getElementById('oralShowText');
  if (cb) cb.addEventListener('change', () => { store.get().settings.oralText = cb.checked; store.save(); });
  $$('[data-mode]').forEach((b) => b.addEventListener('click', () => start(b.dataset.mode)));
  if (!voice) whenVoices(() => { if (location.hash === '#/sozlu') renderOral(); });
}

function start(mode) {
  const m = ORAL_MODES.find((x) => x.id === mode);
  const qs = poolFor(mode).pick();
  if (!qs.length) return ctx.toast('Bu derste soru yok');
  sess = { mode: m, qs, i: 0, start: Date.now(), end: Date.now() + m.min * 60000, res: [], phase: 'ask', text: '', first: '', done: false, said: '0ask' };
  // Noch im Klick vorlesen: iOS erlaubt Sprachausgabe nur nach einer Nutzeraktion
  speak(qs[0].q);
  if (location.hash === '#/sozlu/run') renderQuestion();
  else location.hash = '#/sozlu/run';
}

// ───── Frage ─────
function renderQuestion() {
  const { view, $, esc } = ctx;
  if (!leftMs()) return finish(true);
  const q = sess.qs[sess.i];
  const follow = sess.phase === 'follow';
  const prompt = follow ? sess.followQ : q.q;
  const mic = canListen();
  view.innerHTML = `
    <div class="row mock-head"><span class="badge" lang="de">${esc(sess.mode.name)}</span><span class="muted small" style="margin-left:6px">Soru ${sess.i + 1}/${sess.qs.length}</span><span class="spacer"></span><span class="mock-timer" id="oralTimer">⏱️ ${mmss(leftMs())}</span></div>
    <div class="progress"><div style="width:${(sess.i / sess.qs.length) * 100}%"></div></div>
    <div class="examiner">
      <div class="examiner-who">👨‍⚕️ Prüfer${follow ? ' <span class="badge warn">fragt nach</span>' : ''}</div>
      <div class="examiner-q" lang="de" id="oralQ" ${showText() ? '' : 'hidden'}>${esc(prompt)}</div>
      ${showText() ? '' : '<div class="muted small" id="oralHidden">🎧 Dinle ve cevapla</div>'}
      <div class="row" style="gap:8px;margin-top:8px">
        ${canSpeak() ? '<button class="btn ghost" id="oralRepeat" style="min-height:36px;padding:4px 12px">🔊 Tekrar oku</button>' : ''}
        ${showText() ? '' : '<button class="btn plain" id="oralReveal" style="min-height:36px;padding:4px 12px">📝 Metni göster</button>'}
      </div>
    </div>
    ${follow ? `<div class="muted small" style="margin:4px 2px">İlk cevabın: <span lang="de">${esc(sess.first)}</span></div>` : ''}
    <textarea id="oralText" lang="de" placeholder="${mic ? '🎙️ Mikrofona dokun ve konuş – ya da yaz…' : 'Klavyedeki 🎤 ile dikte et ya da yaz (Almanca)…'}">${esc(sess.text)}</textarea>
    <div class="grid2" style="margin-top:10px">
      ${mic ? '<button class="btn ghost" id="oralMic">🎙️ Konuş</button>' : '<span></span>'}
      <button class="btn" id="oralDone">Cevabı bitir</button>
    </div>
    <button class="btn plain block" id="oralSkip" style="margin-top:12px">Bilmiyorum – geç</button>`;
  const ta = $('#oralText');
  ta.addEventListener('input', () => { sess.text = ta.value; });
  const say = () => speak(prompt);
  if ($('#oralRepeat')) $('#oralRepeat').addEventListener('click', say);
  if ($('#oralReveal')) $('#oralReveal').addEventListener('click', () => { $('#oralQ').hidden = false; $('#oralHidden').remove(); $('#oralReveal').remove(); });
  const micBtn = $('#oralMic');
  if (micBtn) micBtn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    stopSpeaking();
    const base = ta.value.trim();
    rec = listen({
      onText: (fin, interim) => { ta.value = [base, fin, interim].filter(Boolean).join(' '); sess.text = [base, fin].filter(Boolean).join(' '); },
      onEnd: (err) => {
        rec = null;
        ta.value = sess.text;
        if (!document.body.contains(micBtn)) return;
        micBtn.textContent = '🎙️ Konuş'; micBtn.classList.remove('rec');
        if (err === 'not-allowed' || err === 'service-not-allowed') ctx.toast('Mikrofon izni yok – klavyeden dikte et');
        else if (err && err !== 'no-speech' && err !== 'aborted') ctx.toast('Konuşma tanıma çalışmadı – yazarak devam et');
      },
    });
    if (rec) { micBtn.textContent = '⏹️ Durdur'; micBtn.classList.add('rec'); }
  });
  $('#oralDone').addEventListener('click', () => answer(ta.value));
  $('#oralSkip').addEventListener('click', () => answer(ta.value, true));
  startTick();
  // jede Frage/Nachfrage nur einmal automatisch vorlesen (nicht bei jedem Neuzeichnen)
  if (sess.said !== sess.i + sess.phase) { sess.said = sess.i + sess.phase; say(); }
}

function startTick() {
  if (tick) clearInterval(tick);
  tick = setInterval(() => {
    const el = document.getElementById('oralTimer');
    if (!el || !sess || !location.hash.startsWith('#/sozlu/run')) { clearInterval(tick); tick = null; return; }
    const ms = leftMs();
    el.textContent = '⏱️ ' + mmss(ms);
    el.classList.toggle('low', ms < 3 * 60000);
    if (!ms) { ctx.toast('Süre doldu!'); finish(true); }
  }, 1000);
}

function answer(text, skip = false) {
  if (rec) { try { rec.stop(); } catch (e) { /* egal */ } rec = null; }
  stopSpeaking();
  const q = sess.qs[sess.i];
  if (sess.phase === 'ask') {
    const hits = hitParts(q.parts, text);
    sess.hits1 = hits;
    sess.first = text.trim();
    const missing = q.parts.filter((_, k) => !hits[k]);
    // Nachfrage nur, wenn etwas gesagt wurde und nicht alles fehlt
    if (!skip && missing.length && hits.some(Boolean)) {
      sess.followQ = q.follow ? q.follow[missing[0].label] : q.followAny;
      sess.phase = 'follow';
      sess.text = '';
      return renderQuestion();
    }
    return grade(hits, q.parts.map(() => false), '');
  }
  grade(sess.hits1, hitParts(q.parts, text).map((h, k) => h && !sess.hits1[k]), text.trim());
}

// Punkte: im ersten Anlauf genannt = 1, erst auf Nachfrage = ½
function grade(h1, h2, second) {
  const q = sess.qs[sess.i];
  const n = q.parts.length || 1;
  const score = (h1.filter(Boolean).length + 0.5 * h2.filter(Boolean).length) / n;
  if (q.record && (sess.first || second)) store.recordOpen(q.id, score);
  sess.res.push({ q: q.q, topic: q.topic, a: q.a, tr: q.tr, first: sess.first, followQ: sess.phase === 'follow' ? sess.followQ : '', second, score,
    parts: q.parts.map((p, k) => ({ label: p.label, fact: p.fact, st: h1[k] ? 'hit' : h2[k] ? 'follow' : 'miss' })) });
  sess.phase = 'result';
  renderFeedback();
}

function chips(parts, esc) {
  return parts.map((p) => `<span class="kw ${p.st === 'hit' ? 'hit' : p.st === 'follow' ? 'half' : 'miss'}" lang="de">${p.st === 'hit' ? '✓' : p.st === 'follow' ? '↻' : '✗'} ${esc(p.label)}</span>`).join('');
}

function renderFeedback() {
  const { view, $, esc } = ctx;
  const r = sess.res[sess.res.length - 1];
  const last = sess.i + 1 >= sess.qs.length;
  const missingFacts = r.parts.filter((p) => p.st !== 'hit' && p.fact);
  view.innerHTML = `
    <div class="row mock-head"><span class="badge" lang="de">${esc(sess.mode.name)}</span><span class="muted small" style="margin-left:6px">Soru ${sess.i + 1}/${sess.qs.length}</span><span class="spacer"></span><span class="mock-timer" id="oralTimer">⏱️ ${mmss(leftMs())}</span></div>
    <div class="card">
      <div class="muted small" lang="de">${esc(r.q)}</div>
      <h3 style="margin:8px 0 4px">Anahtar kavramlar · %${Math.round(r.score * 100)}</h3>
      ${chips(r.parts, esc)}
      <div class="muted small" style="margin-top:4px">✓ ilk cevapta · ↻ Nachfrage'de (yarım puan) · ✗ eksik</div>
      ${missingFacts.length ? `<dl class="facts" lang="de" style="margin-top:10px">${missingFacts.map((p) => `<dt>${esc(p.label)} ${sayBtn(p.fact, esc)}</dt><dd>${esc(p.fact)}</dd>`).join('')}</dl>` : ''}
      ${r.first ? `<div class="muted small" style="margin-top:10px">Senin cevabın:</div><p lang="de" style="margin-top:2px;white-space:pre-wrap">${esc(r.first)}</p>` : '<p class="muted small">⚪ Cevap yok</p>'}
      ${r.followQ ? `<div class="muted small">Nachfrage: <i lang="de">${esc(r.followQ)}</i></div><p lang="de" style="margin-top:2px;white-space:pre-wrap">${esc(r.second) || '<span class="muted">–</span>'}</p>` : ''}
      <h3>Örnek cevap (Musterlösung) ${sayBtn(r.a, esc)}</h3>
      <p class="small" lang="de">${esc(r.a)}</p>
      ${r.tr ? `<div class="tr-box small">🇹🇷 ${esc(r.tr)}</div>` : ''}
    </div>
    <button class="btn block" id="oralNext">${last ? 'Sonucu gör' : 'Sonraki soru'}</button>`;
  $('#oralNext').addEventListener('click', () => {
    stopSpeaking();
    if (last) return finish(false);
    sess.i++; sess.phase = 'ask'; sess.text = ''; sess.first = '';
    renderQuestion();
    ctx.view.scrollTop = 0;
  });
  startTick();
}

function finish(timeout) {
  stopAll();
  if (!sess) return renderOral();
  sess.done = true;
  sess.timeout = timeout;
  sess.min = Math.max(1, Math.round((Math.min(Date.now(), sess.end) - sess.start) / 60000));
  if (location.hash !== '#/sozlu/run') history.replaceState(null, '', '#/sozlu/run');
  renderSummary();
}

function renderSummary() {
  const { view, $, esc } = ctx;
  const res = sess.res;
  const pct = res.length ? Math.round((res.reduce((n, r) => n + r.score, 0) / sess.qs.length) * 100) : 0;
  view.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="eyebrow">🎤 Sözlü sınav · <span lang="de">${esc(sess.mode.name)}</span></div>
      <div class="score">%${pct}</div>
      <div class="muted">${res.length}/${sess.qs.length} soru · ${sess.min} dk${sess.timeout ? ' · ⏱️ süre doldu' : ''}</div>
      <div class="small" style="margin-top:6px">${pct >= 75 ? 'Çok iyi – Prüfer memnun! 💪' : pct >= 50 ? 'Geçer – eksik kavramları sesli tekrar et.' : 'Daha çok sesli pratik lazım – örnek cevapları dinleyip tekrar et 👇'}</div>
    </div>
    ${res.map((r) => `<div class="card small">
      <div class="muted small">${esc(r.topic)} · %${Math.round(r.score * 100)}</div>
      <b lang="de">${esc(r.q)}</b>
      <div style="margin:8px 0">${chips(r.parts, esc)}</div>
      <div class="muted small">Örnek cevap ${sayBtn(r.a, esc)}</div><p lang="de" style="margin-top:2px">${esc(r.a)}</p>
    </div>`).join('')}
    <div class="grid2">
      <a class="btn ghost" href="#/sozlu">Ders seç</a>
      <button class="btn" id="oralAgain">Yeniden başla</button>
    </div>`;
  $('#oralAgain').addEventListener('click', () => start(sess.mode.id));
}
