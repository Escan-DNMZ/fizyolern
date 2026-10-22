// Ters kartlar (umgekehrte Karten): Muskeln nach Knochenpunkt bzw. Nerv gruppiert.
// Die Karten werden automatisch aus MUSCLES (Felder o = Ursprung, i = Ansatz, inn = Innervation) erzeugt.
// Hier steht nur, welche Schreibweisen zu welchem Knochenpunkt/Nerv gehören (Normalisierung, z. B. „SIAS“ =
// „Spina iliaca anterior superior“) – welche Muskeln dazugehören, ergibt sich allein aus den Muskeldaten.
// Karten mit nur einem Muskel entfallen (das wäre keine Gruppe).
import { MUSCLES } from './data/anatomy.js';
import { LANDMARKS } from './data/landmarks.js';

// f = in welchen Feldern gesucht wird ('o' Ursprung, 'i' Ansatz); at = „am …“-Form für die Frage;
// re = Schreibweisen; not = Stellen, die nur scheinbar passen (werden vor der Suche entfernt)
export const POINTS = [
  { key: 'clavicula', f: 'o', name: 'Clavicula', at: 'an der Clavicula', re: /Clavicula/ },
  { key: 'proc_spinosi', f: 'o', name: 'Dornfortsätze (Proc. spinosi)', at: 'an den Dornfortsätzen (Proc. spinosi)', re: /Proc\. spinosi|Processus spinosi|Dornforts/ },
  { key: 'rippen', f: 'oi', name: 'Rippen', at: 'an den Rippen', re: /Rippe/ },
  { key: 'crista_iliaca', f: 'o', name: 'Crista iliaca (Darmbeinkamm)', at: 'an der Crista iliaca', re: /Crista iliaca|Darmbeinkamm/ },
  { key: 'os_sacrum', f: 'o', name: 'Os sacrum (Kreuzbein)', at: 'am Os sacrum', re: /Os sacrum|Kreuzbein/ },
  { key: 'fascia_thoracolumbalis', f: 'o', name: 'Fascia thoracolumbalis', at: 'an der Fascia thoracolumbalis', re: /Fascia thoracolumbalis/ },
  { key: 'os_ilium', f: 'o', name: 'Os ilium – Facies glutea', at: 'an der Außenfläche des Os ilium (Facies glutea)', re: /Os ilium|Facies glutea/ },
  { key: 'sias', f: 'o', name: 'Spina iliaca anterior superior (SIAS)', at: 'an der Spina iliaca anterior superior (SIAS)', re: /\bSIAS\b|Spina iliaca anterior superior/ },
  { key: 'foramen_obturatum', f: 'o', name: 'Membrana obturatoria / Foramen obturatum', at: 'an der Membrana obturatoria und am Rand des Foramen obturatum', re: /Membrana obturatoria|Foramen obturatum/ },
  { key: 'tuber_ischiadicum', f: 'o', name: 'Tuber ischiadicum (Sitzbeinhöcker)', at: 'am Tuber ischiadicum', re: /Tuber ischiadicum|Tuber ossis ischii|Sitzbeinhöcker/ },
  { key: 'ramus_inferior_pubis', f: 'o', name: 'Ramus inferior ossis pubis', at: 'am Ramus inferior ossis pubis', re: /Ramus inferior ossis pubis/ },
  { key: 'os_pubis', f: 'o', name: 'Os pubis (Schambein)', at: 'am Os pubis (Schambein)', re: /ossis pubis|Os pubis|pubica|Schambein/ },
  { key: 'linea_aspera', f: 'oi', name: 'Linea aspera', at: 'an der Linea aspera', re: /Linea aspera/ },
  { key: 'epicondylus_medialis_humeri', f: 'o', name: 'Epicondylus medialis humeri', at: 'am Epicondylus medialis humeri', re: /Epicondylus medialis humeri/ },
  { key: 'epicondylus_lateralis_humeri', f: 'o', name: 'Epicondylus lateralis humeri', at: 'am Epicondylus lateralis humeri', re: /Epicondylus lateralis humeri/ },
  { key: 'crista_supracondylaris_lateralis', f: 'o', name: 'Crista supracondylaris lateralis humeri', at: 'an der Crista supracondylaris lateralis humeri', re: /Crista supracondylaris lateralis/ },
  { key: 'humerus', f: 'o', name: 'Humerusschaft', at: 'am Schaft des Humerus', re: /\bHumerus\b/ },
  { key: 'ulna', f: 'oi', name: 'Ulna (Elle)', at: 'an der Ulna', re: /\bUlna\b|\bulnae\b/ },
  { key: 'membrana_interossea', f: 'o', name: 'Membrana interossea', at: 'an der Membrana interossea', re: /Membrana interossea/ },
  { key: 'tibia', f: 'o', name: 'Tibia (Schienbein)', at: 'an der Tibia', re: /\bTibia\b|\btibiae\b/ },
  { key: 'fibula', f: 'o', name: 'Fibula (Wadenbein)', at: 'an der Fibula', re: /\bFibula\b|\bfibulae\b/ },
  { key: 'tuberculum_majus', f: 'i', name: 'Tuberculum majus humeri', at: 'am Tuberculum majus humeri', re: /Tuberculum majus/ },
  { key: 'crista_tuberculi_minoris', f: 'i', name: 'Crista tuberculi minoris humeri', at: 'an der Crista tuberculi minoris humeri', re: /Crista tuberculi minoris/ },
  { key: 'margo_medialis_scapulae', f: 'i', name: 'Margo medialis scapulae', at: 'am Margo medialis scapulae', re: /Margo medialis scapulae/ },
  { key: 'linea_alba', f: 'i', name: 'Linea alba', at: 'an der Linea alba', re: /Linea alba/ },
  { key: 'trochanter_major', f: 'i', name: 'Trochanter major', at: 'am Trochanter major', re: /Trochanter major/ },
  { key: 'fossa_trochanterica', f: 'i', name: 'Fossa trochanterica', at: 'in der Fossa trochanterica', re: /Fossa trochanterica/ },
  { key: 'tractus_iliotibialis', f: 'i', name: 'Tractus iliotibialis', at: 'am Tractus iliotibialis', re: /Tractus iliotibialis/ },
  { key: 'tuberositas_tibiae', f: 'i', name: 'Tuberositas tibiae (über das Lig. patellae)', at: 'an der Tuberositas tibiae', re: /Tuberositas tibiae/, not: /medial der Tuberositas tibiae/ },
  { key: 'pes_anserinus_superficialis', f: 'i', name: 'Pes anserinus superficialis', at: 'am Pes anserinus superficialis', re: /Pes anserinus superficialis/ },
  { key: 'tuber_calcanei', f: 'i', name: 'Tuber calcanei (Achillessehne)', at: 'am Tuber calcanei', re: /Tuber calcanei|Achillessehne/ },
  { key: 'os_cuneiforme_mediale', f: 'i', name: 'Os cuneiforme mediale / Basis Os metatarsale I', at: 'am Os cuneiforme mediale und an der Basis des Os metatarsale I', re: /Os cuneiforme mediale|metatarsale I\b/ },
  { key: 'metacarpale_ii', f: 'i', name: 'Basis des Os metacarpale II', at: 'an der Basis des Os metacarpale II', re: /metacarpale II\b/ },
  { key: 'finger', f: 'i', name: 'Finger II–V', at: 'an den Fingern II–V', re: /Finger II–V/ },
];

// Nerven: subj = Subjekt der Frage, pl = Plural („innervieren“)
export const NERVES = [
  { key: 'n_axillaris', name: 'N. axillaris', subj: 'der N. axillaris', re: /N\. axillaris/ },
  { key: 'n_musculocutaneus', name: 'N. musculocutaneus', subj: 'der N. musculocutaneus', re: /N\. musculocutaneus/ },
  { key: 'n_radialis', name: 'N. radialis', subj: 'der N. radialis', re: /N\. radialis/, not: /kleiner Anteil N\. radialis/ },
  { key: 'n_medianus', name: 'N. medianus', subj: 'der N. medianus', re: /N\. medianus/ },
  { key: 'n_suprascapularis', name: 'N. suprascapularis', subj: 'der N. suprascapularis', re: /N\. suprascapularis/ },
  { key: 'n_thoracodorsalis', name: 'N. thoracodorsalis', subj: 'der N. thoracodorsalis', re: /N\. thoracodorsalis/ },
  { key: 'n_accessorius', name: 'N. accessorius (XI)', subj: 'der N. accessorius (XI)', re: /N\. accessorius/ },
  { key: 'plexus_cervicalis', name: 'Plexus cervicalis', subj: 'der Plexus cervicalis', re: /Plexus cervicalis/ },
  { key: 'nn_intercostales', name: 'Nn. intercostales', subj: 'die Nn. intercostales', pl: true, re: /Nn\. intercostales/ },
  { key: 'n_iliohypogastricus', name: 'N. iliohypogastricus / N. ilioinguinalis', subj: 'der N. iliohypogastricus (und der N. ilioinguinalis)', re: /N\. iliohypogastricus/ },
  { key: 'n_femoralis', name: 'N. femoralis', subj: 'der N. femoralis', re: /N\. femoralis/ },
  { key: 'n_obturatorius', name: 'N. obturatorius', subj: 'der N. obturatorius', re: /N\. obturatorius\b/ },
  { key: 'n_gluteus_superior', name: 'N. gluteus superior', subj: 'der N. gluteus superior', re: /N\. gluteus superior/ },
  { key: 'plexus_sacralis', name: 'Plexus sacralis (direkte Äste)', subj: 'der Plexus sacralis (direkte Äste)', re: /Plexus sacralis/ },
  { key: 'n_tibialis', name: 'N. tibialis', subj: 'der N. tibialis', re: /N\. tibialis/ },
  { key: 'n_fibularis', name: 'N. fibularis (peroneus) mit seinen Ästen', subj: 'der N. fibularis (communis, profundus, superficialis)', re: /N\. fibularis|N\. peroneus/ },
];

const FIELD = { o: 'o', i: 'i', n: 'inn' };
const shortLa = (la) => la.replace(/\s*\(.*\)$/, '');

// Passt eine Angabe zum Knochenpunkt/Nerv? Liefert den passenden Teil (z. B. „Caput longum: Tuber ischiadicum“) oder null
const hits = (p, x) => p.re.test(p.not ? x.replace(new RegExp(p.not.source, 'g'), '') : x);
// an Kommas außerhalb von Klammern trennen: „A (x, y), B“ → [„A (x, y)“, „B“]
function splitTop(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  return [...out, cur.trim()].filter(Boolean);
}
export function matchSegment(text, p) {
  const s = String(text || '');
  if (!hits(p, s)) return null;
  const seg = s.split(/;\s*/).find((x) => hits(p, x)) || s;
  const m = seg.match(/^([^:()]{2,40}):\s*(.*)$/); // „Caput longum: …“ / „Pars costalis: …“
  const [label, body] = m ? [m[1] + ': ', m[2]] : ['', seg];
  const part = splitTop(body).find((x) => hits(p, x)) || body;
  return (label + part).trim();
}

const question = (kind, p) => (kind === 'o' ? `Welche Muskeln entspringen ${p.at}?`
  : kind === 'i' ? `Welche Muskeln setzen ${p.at} an?`
  : `Welche Muskeln ${p.pl ? 'innervieren' : 'innerviert'} ${p.subj}?`);

// Alle Ters kartlar: { id, kind ('o' | 'i' | 'n'), key, name, q, parts: [{ id, la, seg }] }
export function buildReverseCards(muscles = MUSCLES) {
  const out = [];
  const add = (kind, p) => {
    const parts = [];
    for (const m of muscles) {
      const seg = matchSegment(m[FIELD[kind]], p);
      if (seg) parts.push({ id: m.id, la: shortLa(m.la), seg });
    }
    if (parts.length >= 2) out.push({ id: `rv:${kind}:${p.key}`, kind, key: p.key, name: p.name, q: question(kind, p), parts });
  };
  for (const p of POINTS) for (const k of p.f) add(k, p);
  // Knochenpunkte aus js/data/landmarks.js (o/i-Listen): zusätzliche Gruppen, wenn es noch keine Karte
  // mit denselben (oder mehr) Muskeln gibt – so kommen neue Punkte (z. B. Caput fibulae) automatisch dazu
  for (const l of LANDMARKS) {
    for (const kind of ['o', 'i']) {
      const ids = (l[kind] || []).filter((id) => muscles.some((m) => m.id === id));
      if (ids.length < 2 || POINTS.some((p) => p.key === l.id)) continue;
      if (out.some((c) => c.kind === kind && ids.every((id) => c.parts.some((x) => x.id === id)))) continue;
      const name = l.la.replace(/\s*\(.*\)$/, '');
      const parts = ids.map((id) => { const m = muscles.find((x) => x.id === id); return { id, la: shortLa(m.la), seg: m[FIELD[kind]] }; });
      out.push({ id: `rv:${kind}:${l.id}`, kind, key: l.id, name: `${name} (${l.de})`, q: question(kind, { at: `am Knochenpunkt „${name}“` }), parts });
    }
  }
  for (const n of NERVES) add('n', n);
  return out;
}

let cache = null;
export const reverseCards = () => (cache ||= buildReverseCards());
export const findReverse = (id) => reverseCards().find((c) => c.id === id) || null;

// Bewertung aus „wie viele gewusst“: alle → Gut/Leicht wählbar, mindestens die Hälfte → Schwer, sonst Nochmal
export const partsRating = (known, total) => (known >= total ? 2 : known * 2 >= total ? 1 : 0);
