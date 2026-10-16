// Erstellt einen Statusbericht als fertigen Prompt für Claude (zum Kopieren/Teilen).
// Enthält nur Lernfortschritt – niemals den Notion-Token.
import * as store from './store.js';
import { LESSONS } from './lessons.js';
import { MCQ } from './data/questions.js';
import { MUSCLES, BONES, JOINTS } from './data/anatomy.js';
import { fehlerList, todayPlan, week } from './private.js';
import { todaysWords } from './words.js';

const pct = (r, w) => (r + w ? Math.round((r / (r + w)) * 100) : null);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Frage-ID → { text, fach }
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
  const name = (list, id) => (list.find((x) => x.id === id) || {}).la || id;
  const gen = { inn: 'Innervation', ans: 'Ansatz', urs: 'Ursprung', fkt: 'Funktion', rev: 'Ursprung+Ansatz → Muskel' };
  return (id) => {
    if (idx[id]) return idx[id];
    const m = id.match(/^g:(\w+):(.+)$/);
    if (!m) return { text: id, fach: '?' };
    const [, kind, ref] = m;
    if (gen[kind]) return { text: `${name(MUSCLES, ref)} – ${gen[kind]}`, fach: 'Muskeln' };
    if (kind.startsWith('j')) return { text: `${name(JOINTS, ref)} – ${kind === 'jnn' ? 'Neutral-Null' : 'Gelenktyp'}`, fach: 'Gelenke' };
    if (kind.startsWith('b')) return { text: `${name(BONES, ref)} – Name`, fach: 'Knochen' };
    if (kind.startsWith('v')) return { text: `Vokabel: ${ref.replace(/^(v|gw|lv):/, '')}`, fach: 'Vokabeln' };
    return { text: id, fach: '?' };
  };
}

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
    const f = (byFach[info.fach] = byFach[info.fach] || { r: 0, w: 0 });
    f.r += q.r; f.w += q.w;
    if (q.w > 0 && q.w >= q.r) wrongRecent.push({ ...info, w: q.w, r: q.r, last: q.last });
  }
  wrongRecent.sort((a, b) => b.w - a.w || b.last.localeCompare(a.last));

  // Aktivität der letzten 7 Tage
  const last7 = [...Array(7)].map((_, i) => daysAgo(6 - i)).map((date) => ({ date, ...(s.days[date] || {}) }));
  const activeDays = last7.filter((x) => x.cards || x.quiz || x.open || x.lesson || x.lesson2).length;
  const weekQuiz = last7.reduce((a, x) => ({ r: a.r + (x.quizRight || 0), n: a.n + (x.quiz || 0) }), { r: 0, n: 0 });

  // Fehlerkarten: noch offen bzw. oft vergessen
  const fehler = fehlerList();
  const fehlerOpen = fehler.filter((f) => !s.srs[f.id] || s.srs[f.id].due <= today);
  const fehlerHard = fehler.filter((f) => s.srs[f.id] && s.srs[f.id].lapses >= 2);

  // Offene Fragen mit schwacher Selbsteinschätzung
  const openWeak = Object.entries(s.open).filter(([, v]) => v.score < 0.5).length;

  const lines = [];
  lines.push(`Merhaba şefim! FizyoLern'den günlük durum raporum (${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}):`);
  lines.push('');
  lines.push(`🔥 Seri: ${store.streak()} gün · Son 7 günde ${activeDays}/7 gün çalıştım`);
  lines.push(`📊 Bu hafta test: ${weekQuiz.n} soru, ${weekQuiz.n ? Math.round((weekQuiz.r / weekQuiz.n) * 100) + '% doğru' : '–'}`);
  lines.push(`🗂️ Kartlar: ${Object.values(s.srs).filter((c) => c.int >= 1).length} öğrenildi · bugün ${d.cards || 0} tekrar`);
  lines.push(`✅ Bugün: ${d.quiz || 0} test sorusu (${d.quizRight || 0} doğru), ${d.open || 0} açık uçlu soru${d.morning ? ', sabah testi yapıldı' : ''}${d.lesson ? ', günün kası tamam' : ''}`);
  const tw = todaysWords();
  if (tw.length) {
    const wr = d.wordRes || {};
    const fmt = (x) => (x ? `${x.r}/${x.n}` : 'yapılmadı');
    lines.push(`🔤 Kelimeler: sabah ${fmt(d.wordsMorning)}, dönüş ${fmt(d.wordsReturn)} · ${tw.map((x) => `${x.de}${wr[x.id] === false ? ' ✗' : wr[x.id] ? ' ✓' : ''}`).join(', ')}`);
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
  if (openWeak) lines.push(`📝 ${openWeak} açık uçlu soruda kendimi zayıf değerlendirdim.`);

  lines.push('');
  lines.push('Bu verilere göre benden şunları istiyorum:');
  lines.push('1. Kısa bir motivasyon ve bugünkü durumumun yorumu');
  lines.push('2. En zayıf 2 konumu Türkçe kısaca açıkla (Almanca terimlerle)');
  lines.push('3. Bu konulardan 5 soruluk mini sınav yap (Almanca, cevapları ben yazayım)');
  lines.push('4. Gerekirse Notion\'daki Haftalık Plan\'da ✗ listemi güncelle');
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
