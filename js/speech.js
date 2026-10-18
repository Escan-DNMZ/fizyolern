// Sprachausgabe (speechSynthesis, de-DE) und Spracherkennung (SpeechRecognition, de-DE).
// Beides stellt der Browser bzw. das Betriebssystem bereit – die App selbst baut keine Netzverbindung auf.
import { t as tr } from './i18n.js';
import './strings.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voice = null;

function pickVoice() {
  if (!synth) return null;
  const vs = synth.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
  // lokale Stimme bevorzugen (offline), sonst die erste deutsche
  voice = vs.find((v) => /de-DE/i.test(v.lang) && v.localService) || vs.find((v) => /de-DE/i.test(v.lang)) || vs[0] || null;
  return voice;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const canSpeak = () => !!synth && !!(voice || pickVoice());
// Stimmen laden manche Browser erst später (Chrome/Edge): cb einmal aufrufen, sobald eine deutsche da ist
export function whenVoices(cb) {
  if (!synth || canSpeak()) return;
  const h = () => { if (pickVoice()) { synth.removeEventListener('voiceschanged', h); cb(); } };
  synth.addEventListener?.('voiceschanged', h);
}

// Abkürzungen ausschreiben, damit „M. biceps“ nicht als „Em Punkt“ gelesen wird
const ABBR = [
  [/\bMm\.\s*/g, 'Musculi '], [/\bM\.\s*/g, 'Musculus '], [/\bNn\.\s*/g, 'Nervi '], [/\bN\.\s*/g, 'Nervus '],
  [/\bLigg\.\s*/g, 'Ligamenta '], [/\bLig\.\s*/g, 'Ligamentum '], [/\bArt\.\s*/g, 'Articulatio '],
  [/\bProc\.\s*/g, 'Processus '], [/\bA\.\s*/g, 'Arteria '], [/\bV\.\s*/g, 'Vena '], [/\bz\.\s*B\./g, 'zum Beispiel'],
  [/\bu\.\s*a\./g, 'unter anderem'], [/\bbzw\./g, 'beziehungsweise'], [/\bggf\./g, 'gegebenenfalls'], [/\bca\./g, 'circa'],
  [/\bsup\./g, 'superior'], [/\binf\./g, 'inferior'], [/\bant\./g, 'anterior'], [/\bpost\./g, 'posterior'], [/\bmed\./g, 'medialis'], [/\blat\./g, 'lateralis'],
  [/\bAR\b/g, 'Außenrotation'], [/\bIR\b/g, 'Innenrotation'], [/\bHWS\b/g, 'Halswirbelsäule'], [/\bBWS\b/g, 'Brustwirbelsäule'], [/\bLWS\b/g, 'Lendenwirbelsäule'],
  [/(\d)\s*[–-]\s*([A-Z]?\d)/g, '$1 bis $2'], [/＿+/g, ' … '], [/\|/g, ''], [/\//g, ', '],
];
export const speakable = (t) => ABBR.reduce((s, [re, r]) => s.replace(re, r), String(t || '')).replace(/\s+/g, ' ').trim();

// Text vorlesen; Promise endet, wenn fertig gesprochen (oder sofort, wenn keine Stimme)
export function speak(text, { rate = 0.92 } = {}) {
  if (!canSpeak()) return Promise.resolve(false);
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(speakable(text));
    u.lang = 'de-DE';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.speak(u);
  });
}
export const stopSpeaking = () => { if (synth) synth.cancel(); };

// 🔊-Knopf: data-say enthält den Text; der Klick wird in der Capture-Phase abgefangen,
// damit z. B. die Karteikarte darunter nicht umdreht.
export function sayBtn(text, esc, cls = '') {
  return `<button type="button" class="say-btn ${cls}" data-say="${esc(text)}" aria-label="${tr('say.aria')}">🔊</button>`;
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-say]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (!canSpeak()) { b.title = tr('say.noVoice'); b.classList.add('off'); return; }
    speak(b.dataset.say);
  }, true);
}

// ───── Spracherkennung ─────
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canListen = () => !!SR;

// Startet die Erkennung; onText(finalText, interimText) bei jedem Ergebnis, onEnd(error?) am Ende.
export function listen({ onText, onEnd }) {
  if (!SR) return null;
  const r = new SR();
  r.lang = 'de-DE';
  r.continuous = true;
  r.interimResults = true;
  let finalText = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += (finalText ? ' ' : '') + t.trim();
      else interim += t;
    }
    onText(finalText, interim);
  };
  let err = null;
  r.onerror = (e) => { err = e.error || 'error'; };
  r.onend = () => onEnd(err);
  try { r.start(); } catch (e) { onEnd('start'); return null; }
  return r;
}
