// Hilfssprache der Oberfläche und Erklärungen: Türkisch (Standard) oder Englisch.
// Die Fachinhalte bleiben immer Deutsch/Latein.
import * as store from './store.js';

export const LANGS = {
  tr: { name: 'Türkçe', flag: '🇹🇷', locale: 'tr-TR' },
  en: { name: 'English', flag: '🇬🇧', locale: 'en-GB' },
};

export const lang = () => (store.get().settings.lang === 'en' ? 'en' : 'tr');
export const flag = () => LANGS[lang()].flag;
export const locale = () => LANGS[lang()].locale;

export function setLang(l) {
  store.get().settings.lang = LANGS[l] ? l : 'tr';
  store.save();
  document.documentElement.lang = lang();
}

// Übersetzung eines Datenfelds: tr → en, ftr → fen, x → xEn (sonst <feld>En); fehlt Englisch, bleibt Türkisch
const EN_FIELD = { tr: 'en', ftr: 'fen', x: 'xEn' };
export function tx(obj, field = 'tr') {
  if (!obj) return '';
  if (lang() === 'en') {
    const v = obj[EN_FIELD[field] || field + 'En'];
    if (v) return v;
  }
  return obj[field] ?? '';
}

// Oberflächentexte: STR[key] = [türkisch, englisch]; {name} wird aus vars ersetzt
const STR = {};
export function addStrings(map) { Object.assign(STR, map); }
export function t(key, vars) {
  const e = STR[key];
  let s = e ? (lang() === 'en' && e[1] ? e[1] : e[0]) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
