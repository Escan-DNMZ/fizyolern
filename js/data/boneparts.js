// Einzelknochen im 3D-Modell: BodyParts3D-Name (englisch) → lateinischer + deutscher Name.
// Für Gruppen wie „pes“ oder „carpus“ zeigt die App so den angetippten Einzelknochen.
// typ = Art des Knochens ohne Nummer/Finger; gleiche Art wird in der Fokusansicht nur einmal beschriftet
// (z. B. nur „Os metatarsi I“ statt aller fünf Mittelfußknochen).

const ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const NUM = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const N = `(${Object.keys(NUM).join('|')})`;

// feste Namen (ohne Seite)
const FIX = {
  'navicular bone of foot': ['Os naviculare', 'Kahnbein'],
  'cuboid bone': ['Os cuboideum', 'Würfelbein'],
  'medial cuneiform bone': ['Os cuneiforme mediale', 'Inneres Keilbein'],
  'intermediate cuneiform bone': ['Os cuneiforme intermedium', 'Mittleres Keilbein'],
  'lateral cuneiform bone': ['Os cuneiforme laterale', 'Äußeres Keilbein'],
  scaphoid: ['Os scaphoideum', 'Kahnbein'],
  lunate: ['Os lunatum', 'Mondbein'],
  triquetral: ['Os triquetrum', 'Dreiecksbein'],
  pisiform: ['Os pisiforme', 'Erbsenbein'],
  trapezium: ['Os trapezium', 'Großes Vieleckbein'],
  trapezoid: ['Os trapezoideum', 'Kleines Vieleckbein'],
  capitate: ['Os capitatum', 'Kopfbein'],
  hamate: ['Os hamatum', 'Hakenbein'],
  atlas: ['Atlas (C1)', 'Erster Halswirbel'],
  axis: ['Axis (C2)', 'Zweiter Halswirbel'],
  manubrium: ['Manubrium sterni', 'Handgriff des Brustbeins'],
  'body of sternum': ['Corpus sterni', 'Brustbeinkörper'],
  'xiphoid process': ['Processus xiphoideus', 'Schwertfortsatz'],
  'frontal bone': ['Os frontale', 'Stirnbein'],
  'occipital bone': ['Os occipitale', 'Hinterhauptsbein'],
  'sphenoid bone': ['Os sphenoidale', 'Keilbein'],
  ethmoid: ['Os ethmoidale', 'Siebbein'],
  vomer: ['Vomer', 'Pflugscharbein'],
  'parietal bone': ['Os parietale', 'Scheitelbein'],
  'temporal bone': ['Os temporale', 'Schläfenbein'],
  maxilla: ['Maxilla', 'Oberkiefer'],
  'zygomatic bone': ['Os zygomaticum', 'Jochbein'],
  'nasal bone': ['Os nasale', 'Nasenbein'],
  'lacrimal bone': ['Os lacrimale', 'Tränenbein'],
  'palatine bone': ['Os palatinum', 'Gaumenbein'],
  'inferior nasal concha': ['Concha nasalis inferior', 'Untere Nasenmuschel'],
};
const PH = { proximal: ['proximalis', 'Grundglied'], middle: ['media', 'Mittelglied'], distal: ['distalis', 'Endglied'] };
const FINGER = { thumb: ['pollicis', 'Daumen', 1], 'index finger': ['digiti II manus', 'Zeigefinger', 2], 'middle finger': ['digiti III manus', 'Mittelfinger', 3], 'ring finger': ['digiti IV manus', 'Ringfinger', 4], 'little finger': ['digiti V manus', 'Kleiner Finger', 5] };
const TOE = { 'big toe': ['hallucis', 'Großzehe', 1], 'second toe': ['digiti II pedis', '2. Zehe', 2], 'third toe': ['digiti III pedis', '3. Zehe', 3], 'fourth toe': ['digiti IV pedis', '4. Zehe', 4], 'little toe': ['digiti V pedis', 'Kleinzehe', 5] };

// part = Originalname aus dem Modell, z. B. „Left first metatarsal bone“ → { la, de, typ, n }
export function partLatin(part) {
  const p = String(part || '').toLowerCase().replace(/\b(left|right)\s+/g, '').replace(/\s+of\s+(left|right)\s+/, ' of ').trim();
  if (FIX[p]) return { la: FIX[p][0], de: FIX[p][1], typ: FIX[p][0], n: 1 };
  let m = p.match(new RegExp(`^${N} metatarsal bone$`));
  if (m) return { la: `Os metatarsi ${ROM[NUM[m[1]]]}`, de: `${NUM[m[1]]}. Mittelfußknochen`, typ: 'Os metatarsi', n: NUM[m[1]] };
  m = p.match(new RegExp(`^${N} metacarpal bone$`));
  if (m) return { la: `Os metacarpi ${ROM[NUM[m[1]]]}`, de: `${NUM[m[1]]}. Mittelhandknochen`, typ: 'Os metacarpi', n: NUM[m[1]] };
  m = p.match(/^(proximal|middle|distal) phalanx of (.+)$/);
  if (m) {
    const d = FINGER[m[2]] || TOE[m[2]];
    if (d) return { la: `Phalanx ${PH[m[1]][0]} ${d[0]}`, de: `${PH[m[1]][1]} (${d[1]})`, typ: `Phalanx ${PH[m[1]][0]} ${FINGER[m[2]] ? 'manus' : 'pedis'}`, n: d[2] };
  }
  m = p.match(new RegExp(`^${N} (cervical|thoracic|lumbar) vertebra$`));
  if (m) {
    const [la, de] = { cervical: ['cervicalis', 'Halswirbel'], thoracic: ['thoracica', 'Brustwirbel'], lumbar: ['lumbalis', 'Lendenwirbel'] }[m[2]];
    return { la: `Vertebra ${la} ${ROM[NUM[m[1]]]}`, de: `${NUM[m[1]]}. ${de}`, typ: `Vertebra ${la}`, n: NUM[m[1]] };
  }
  m = p.match(new RegExp(`^${N} rib$`));
  if (m) return { la: `Costa ${ROM[NUM[m[1]]]}`, de: `${NUM[m[1]]}. Rippe`, typ: 'Costa', n: NUM[m[1]] };
  m = p.match(new RegExp(`^${N} costal cartilage$`));
  if (m) return { la: `Cartilago costalis ${ROM[NUM[m[1]]]}`, de: `${NUM[m[1]]}. Rippenknorpel`, typ: 'Cartilago costalis', n: NUM[m[1]] };
  return null;
}
