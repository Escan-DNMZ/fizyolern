// Erstellt einen Statusbericht als fertigen Prompt für Claude (zum Kopieren/Teilen).
// Enthält nur Lernfortschritt – niemals den Notion-Token.
import * as store from './store.js';
import { LESSONS } from './lessons.js';
import { MCQ } from './data/questions.js';
import { MUSCLES, BONES, JOINTS } from './data/anatomy.js';
import { fehlerList, odevList, todayPlan, week, upcoming } from './private.js';
import { muscleQuestions, boneQuestions, jointQuestions, ALL_JOINT_DETAIL, exerciseQuestions } from './quizgen.js';
import { todaysWords } from './words.js';

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
    return { text: '(soru artık uygulamada yok)', fach: '?', missing: true };
  };
}

const trDate = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function buildReport() {
  const s = store.get();
  const lookup = questionIndex();
  const today = store.today();
  const d = store.day();
  const since = daysAgo(7);
  const plan = todayPlan();
  const w = week();

  // Test-Treffer der letzten 7 Tage nach Fach
  const byFach = {};
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
  lines.push(`Merhaba şefim! FizyoLern'den günlük durum raporum (${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}):`);
  lines.push(`ℹ️ Bağlam: Uygulama ${trDate(start)}'dan beri kullanımda (bugün ${dayN}. gün).${dayN <= 14 ? ' Düşük gün sayıları ve yüksek kart sayıları başlangıç döneminden kaynaklanıyor, düzensizlik anlamına gelmiyor.' : ''}`);
  lines.push('');
  lines.push(`🔥 Seri: ${store.streak()} gün · Kurulumdan beri (${trDate(start)}, ${dayN}. gün): ${activeSinceStart}/${dayN} gün aktif${dayN > 7 ? ` · son 7 gün: ${activeDays}/7` : ''}`);
  lines.push(`📊 Bu hafta test: ${weekQuiz.n} soru, ${weekQuiz.n ? Math.round((weekQuiz.r / weekQuiz.n) * 100) + '% doğru' : '–'}`);
  lines.push(`🗂️ Kartlar: ${Object.values(s.srs).filter((c) => c.int >= 1).length} öğrenildi · bugün ${reviewRatings} tekrar + ${newSeen} yeni (bugün ilk kez gördüğüm kartlar)${d.cards ? ` · toplam ${d.cards} değerlendirme` : ''}`);
  lines.push(`✅ Bugün: ${d.quiz || 0} test sorusu (${d.quizRight || 0} doğru), ${d.open || 0} açık uçlu soru${d.morning ? ', sabah testi yapıldı' : ''}${d.lesson ? ', günün kası tamam' : ''}`);
  const tw = todaysWords();
  if (tw.length) {
    const wr = d.wordRes || {};
    const fmt = (x) => (x ? `${x.r}/${x.n}` : 'yapılmadı');
    lines.push(`🔤 Kelimeler: sabah ${fmt(d.wordsMorning)}, dönüş ${fmt(d.wordsReturn)} · ${tw.map((x) => `${x.de}${wr[x.id] === 'close' ? ' ½' : wr[x.id] === false ? ' ✗' : wr[x.id] ? ' ✓' : ''}`).join(', ')}`);
  }
  // Prüfungen & Hausaufgaben (Notion „Sınav & Ödev Takibi“) + letzte Probeklausuren
  const exams = upcoming('Sınav', 60);
  const hw = upcoming('Ödev', 14);
  const when = (e) => `${trDate(e.date).slice(0, 6)}, ${e.days === 0 ? 'bugün' : e.days === 1 ? 'yarın' : e.days + ' gün sonra'}`;
  if (exams.length) lines.push(`📝 Yaklaşan sınavlar: ${exams.map((e) => `${e.fach || 'Sınav'}${e.topic ? ' (' + e.topic + ')' : ''} – ${when(e)}`).join(' · ')}`);
  if (hw.length) lines.push(`📌 Teslim edilecek ödevler: ${hw.map((e) => `${e.fach ? e.fach + ': ' : ''}${e.topic || 'Ödev'} – ${when(e)}`).join(' · ')}`);
  const mocks = (s.mocks || []).filter((m) => m.date >= daysAgo(14));
  if (mocks.length) {
    lines.push(`🧪 Deneme sınavları (son 14 gün): ${mocks.slice(-4).map((m) => `${m.fach} %${m.pct} (${trDate(m.date).slice(0, 6)})`).join(' · ')}`);
    const last = mocks[mocks.length - 1];
    const weakT = Object.entries(last.topics).filter(([, v]) => v.n && v.r / v.n < 0.6).sort(([, a], [, b]) => a.r / a.n - b.r / b.n).slice(0, 3).map(([t, v]) => `${t} %${Math.round((v.r / v.n) * 100)}`);
    if (weakT.length) lines.push(`   Son denemede zayıf konular (${last.fach}): ${weakT.join(', ')}`);
  }
  if (w) lines.push(`📅 Program: KW ${w.kw}${plan && plan.kurse.length ? ' · bugün: ' + plan.kurse.join(' / ') : ''}${plan && plan.test.length ? ' · sabah testi: ' + plan.test.join(' + ') : ''}`);

  const fachRows = Object.entries(byFach).map(([f, v]) => [f, pct(v.r, v.w), v.r + v.w]).filter((x) => x[2] >= 2).sort((a, b) => a[1] - b[1]);
  if (fachRows.length) {
    lines.push('');
    lines.push('📉 Derslere göre başarı (son 7 gün, zayıftan güçlüye):');
    fachRows.forEach(([f, p, n]) => lines.push(`- ${f}: %${p} (${n} cevap)`));
  }

  if (wrongRecent.length) {
    lines.push('');
    lines.push('❌ Son günlerde en çok yanlış yaptığım sorular:');
    wrongRecent.slice(0, 8).forEach((q) => lines.push(`- [${q.fach}] ${q.text}${q.answer ? ' → doğru: ' + q.answer : ''} (${q.w}× yanlış)`));
  }

  if (fehler.length) {
    lines.push('');
    lines.push(`✗ Hata listem: ${fehler.length} kart, ${fehlerOpen.length} tanesi tekrar bekliyor.`);
    if (fehlerHard.length) {
      lines.push('Hâlâ unuttuklarım:');
      fehlerHard.slice(0, 5).forEach((f) => lines.push(`- [${f.fach}] ${f.q}`));
    }
  }
  if (odev.length) {
    // Hausaufgaben zum Auswendiglernen – bewusst getrennt von der Fehlerliste
    lines.push('');
    lines.push('📌 Ödevlerim (ezber ödevi – hata değil):');
    for (const t of [...new Set(odev.map((f) => f.odev))]) {
      const cs = odev.filter((f) => f.odev === t);
      const learned = cs.filter((f) => s.srs[f.id] && s.srs[f.id].int >= 1).length;
      const unseen = cs.filter((f) => !s.srs[f.id] || !s.srs[f.id].reps).length;
      lines.push(`- ${t}: ${cs.length} kart · ${learned} öğrenildi · ${cs.length - learned - unseen} çalışılıyor · ${unseen} henüz görülmedi`);
    }
  }
  if (openWeak) lines.push(`📝 ${openWeak} açık uçlu soruda kendimi zayıf değerlendirdim.`);

  lines.push('');
  lines.push('Bu verilere göre benden şunları istiyorum:');
  lines.push('1. Kısa bir motivasyon ve bugünkü durumumun yorumu');
  lines.push('2. En zayıf 2 konumu Türkçe kısaca açıkla (Almanca terimlerle)');
  lines.push('3. Bu konulardan 5 soruluk mini sınav yap (Almanca, cevapları ben yazayım)');
  const examSoon = exams.length && exams[0].days <= 7;
  if (examSoon) lines.push(`4. ${exams[0].fach || 'Sınav'} sınavına ${exams[0].days} gün kaldı: o derse öncelik ver, kısa bir sınav planı öner`);
  lines.push(`${examSoon ? 5 : 4}. Gerekirse Notion'daki Haftalık Plan'da ✗ listemi güncelle`);
  return lines.join('\n');
}

// Bildschirm „Claude'a rapor“: Bericht anzeigen, kopieren oder über das iOS-Teilen-Menü senden
export function renderReport(view, toast) {
  const text = buildReport();
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  view.innerHTML = `
    <p class="muted small" style="padding:0 4px">Bu metni kopyalayıp Claude'a gönder; durumuna göre seni çalıştırsın. İçinde Notion anahtarın <b>yok</b>, sadece çalışma istatistiğin var.</p>
    <textarea id="reportText" readonly style="min-height:360px;font-size:14px">${esc(text)}</textarea>
    <div class="grid2" style="margin-top:10px">
      <button class="btn" id="copyReport">Kopyala</button>
      <button class="btn ghost" id="shareReport">Paylaş</button>
    </div>`;
  view.querySelector('#copyReport').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopyalandı – şimdi Claude\'a yapıştır ✓');
    } catch {
      const ta = view.querySelector('#reportText');
      ta.focus(); ta.select();
      toast('Metni seçtim, "Kopyala"ya bas');
    }
  });
  const share = view.querySelector('#shareReport');
  if (!navigator.share) share.disabled = true;
  share.addEventListener('click', () => navigator.share({ text }).catch(() => {}));
}
