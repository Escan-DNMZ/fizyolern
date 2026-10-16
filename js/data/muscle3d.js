// 3D-Zusatzdaten pro Muskel:
//  layer: 1 = oberflächlich, 2 = mittlere Schicht, 3 = tief
//  o / i: BodyParts3D-Knochenteile (Teilstrings), an denen Ursprung / Ansatz liegen
export const MUSCLE3D = {
  deltoideus: { layer: 1, o: ['clavicle', 'scapula'], i: ['humerus'] },
  biceps_brachii: { layer: 1, o: ['scapula'], i: ['radius'] },
  brachialis: { layer: 2, o: ['humerus'], i: ['ulna'] },
  triceps_brachii: { layer: 1, o: ['scapula', 'humerus'], i: ['ulna'] },
  brachioradialis: { layer: 1, o: ['humerus'], i: ['radius'] },
  flexor_carpi_radialis: { layer: 1, o: ['humerus'], i: ['second metacarpal', 'third metacarpal'] },
  extensor_carpi_radialis_longus: { layer: 1, o: ['humerus'], i: ['second metacarpal'] },
  extensor_digitorum: { layer: 1, o: ['humerus'], i: ['phalanx of'] },
  flexor_digitorum_superficialis: { layer: 2, o: ['humerus', 'ulna', 'radius'], i: ['Middle phalanx'] },
  flexor_digitorum_profundus: { layer: 3, o: ['ulna'], i: ['Distal phalanx'] },
  pectoralis_major: { layer: 1, o: ['clavicle', 'Manubrium', 'Body of sternum', 'costal cartilage'], i: ['humerus'] },
  serratus_anterior: { layer: 2, o: ['rib'], i: ['scapula'] },
  trapezius: { layer: 1, o: ['Occipital bone', 'cervical vertebra', 'thoracic vertebra'], i: ['clavicle', 'scapula'] },
  rhomboidei: { layer: 2, o: ['cervical vertebra', 'thoracic vertebra'], i: ['scapula'] },
  latissimus_dorsi: { layer: 1, o: ['thoracic vertebra', 'lumbar vertebra', 'hip bone'], i: ['humerus'] },
  supraspinatus: { layer: 2, o: ['scapula'], i: ['humerus'] },
  infraspinatus: { layer: 2, o: ['scapula'], i: ['humerus'] },
  teres_minor: { layer: 2, o: ['scapula'], i: ['humerus'] },
  teres_major: { layer: 2, o: ['scapula'], i: ['humerus'] },
  subscapularis: { layer: 3, o: ['scapula'], i: ['humerus'] },
  sternocleidomastoideus: { layer: 1, o: ['Manubrium', 'clavicle'], i: ['temporal bone', 'Occipital bone'] },
  rectus_abdominis: { layer: 1, o: ['hip bone'], i: ['costal cartilage', 'Xiphoid'] },
  obliquus_externus: { layer: 1, o: ['rib'], i: ['hip bone'] },
  transversus_abdominis: { layer: 3, o: ['costal cartilage', 'hip bone'], i: [] },
  erector_spinae: { layer: 2, o: ['Sacrum', 'hip bone', 'lumbar vertebra'], i: ['rib', 'thoracic vertebra', 'cervical vertebra'] },
  quadratus_lumborum: { layer: 3, o: ['hip bone'], i: ['twelfth rib', 'lumbar vertebra'] },
  diaphragma: { layer: 3, o: ['Xiphoid', 'rib', 'costal cartilage', 'lumbar vertebra'], i: [] },
  iliopsoas: { layer: 3, o: ['thoracic vertebra', 'lumbar vertebra', 'hip bone'], i: ['femur'] },
  gluteus_maximus: { layer: 1, o: ['hip bone', 'Sacrum'], i: ['femur'] },
  gluteus_medius: { layer: 2, o: ['hip bone'], i: ['femur'] },
  tensor_fasciae_latae: { layer: 1, o: ['hip bone'], i: ['tibia'] },
  piriformis: { layer: 3, o: ['Sacrum'], i: ['femur'] },
  rectus_femoris: { layer: 1, o: ['hip bone'], i: ['patella', 'tibia'] },
  vastus_lateralis: { layer: 1, o: ['femur'], i: ['patella', 'tibia'] },
  vastus_medialis: { layer: 1, o: ['femur'], i: ['patella', 'tibia'] },
  vastus_intermedius: { layer: 2, o: ['femur'], i: ['patella', 'tibia'] },
  sartorius: { layer: 1, o: ['hip bone'], i: ['tibia'] },
  gracilis: { layer: 1, o: ['hip bone'], i: ['tibia'] },
  adductor_longus: { layer: 1, o: ['hip bone'], i: ['femur'] },
  adductor_magnus: { layer: 2, o: ['hip bone'], i: ['femur'] },
  biceps_femoris: { layer: 1, o: ['hip bone', 'femur'], i: ['fibula', 'tibia'] },
  semitendinosus: { layer: 1, o: ['hip bone'], i: ['tibia'] },
  semimembranosus: { layer: 2, o: ['hip bone'], i: ['tibia'] },
  tibialis_anterior: { layer: 1, o: ['tibia'], i: ['medial cuneiform', 'first metatarsal'] },
  fibularis_longus: { layer: 1, o: ['fibula', 'tibia'], i: ['medial cuneiform', 'first metatarsal'] },
  gastrocnemius: { layer: 1, o: ['femur'], i: ['calcaneus'] },
  soleus: { layer: 2, o: ['fibula', 'tibia'], i: ['calcaneus'] },
  tibialis_posterior: { layer: 3, o: ['tibia', 'fibula'], i: ['navicular', 'cuneiform', 'metatarsal'] },
};

export const LAYER_NAMES = { 1: 'Yüzeysel', 2: 'Orta', 3: 'Derin' };

const CAPUT = { Long: ['Caput longum', 'Langer Kopf', 'uzun baş'], Short: ['Caput breve', 'Kurzer Kopf', 'kısa baş'], Lateral: ['Caput laterale', 'Seitlicher Kopf', 'dış baş'], Medial: ['Caput mediale', 'Innerer Kopf', 'iç baş'] };
const PARS = {
  Clavicular: ['Pars clavicularis', 'Schlüsselbeinteil', 'köprücük kısmı'],
  Acromial: ['Pars acromialis', 'Schulterhöhenteil', 'akromiyal kısım'],
  Spinal: ['Pars spinalis', 'Gräteteil', 'spina kısmı'],
  Sternocostal: ['Pars sternocostalis', 'Brustbein-Rippen-Teil', 'sternokostal kısım'],
  Abdominal: ['Pars abdominalis', 'Bauchteil', 'karın kısmı'],
  Descending: ['Pars descendens', 'Absteigender Teil', 'inen kısım'],
  Transverse: ['Pars transversa', 'Querer Teil', 'yatay kısım'],
  Ascending: ['Pars ascendens', 'Aufsteigender Teil', 'çıkan kısım'],
};
const NAMED = {
  'rhomboid major': ['M. rhomboideus major', 'Großer Rautenmuskel', 'büyük romboid'],
  'rhomboid minor': ['M. rhomboideus minor', 'Kleiner Rautenmuskel', 'küçük romboid'],
  'psoas major': ['M. psoas major', 'Großer Lendenmuskel', 'büyük psoas'],
  iliacus: ['M. iliacus', 'Darmbeinmuskel', 'iliak kas'],
  'tensor fasciae latae': ['M. tensor fasciae latae', 'Schenkelbindenspanner', 'tensor fasya lata'],
  'iliotibial tract': ['Tractus iliotibialis', 'Iliotibialband', 'iliotibial bant'],
  'calcaneal tendon': ['Tendo calcaneus', 'Achillessehne', 'Aşil tendonu'],
  'iliocostalis lumborum': ['M. iliocostalis lumborum', 'Lenden-Darmbein-Rippen-Muskel', 'iliokostalis (bel)'],
  'iliocostalis thoracis': ['M. iliocostalis thoracis', 'Brust-Darmbein-Rippen-Muskel', 'iliokostalis (göğüs)'],
  'longissimus thoracis': ['M. longissimus thoracis', 'Längster Brustmuskel', 'longissimus (göğüs)'],
  'spinalis thoracis': ['M. spinalis thoracis', 'Dornmuskel der Brust', 'spinalis (göğüs)'],
};

// BodyParts3D-Teilname → { la, de, tr } (Name des Muskelteils)
export function partNames(enName, muscle) {
  const n = (enName || '').replace(/#\d+$/, '');
  let m = n.match(/^(Long|Short|Lateral|Medial) head of/i);
  if (m) { const [la, de, tr] = CAPUT[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()]; return { la, de, tr }; }
  m = n.match(/^(\w+) part of/i);
  if (m && PARS[m[1]]) { const [la, de, tr] = PARS[m[1]]; return { la, de, tr }; }
  const key = n.replace(/^(left|right)\s+/i, '').toLowerCase();
  if (NAMED[key]) { const [la, de, tr] = NAMED[key]; return { la, de, tr }; }
  return { la: muscle.la, de: muscle.de, tr: muscle.tr };
}

// Ursprung/Ansatz-Text eines Teils aus dem Gesamttext herausschneiden („Pars clavicularis: …; Pars acromialis: …“)
export function partText(full, la) {
  if (!full) return '';
  const seg = full.split(/;\s*/).find((s) => s.toLowerCase().startsWith(la.toLowerCase()));
  return seg ? seg.slice(la.length).replace(/^[:\s]+/, '') : full;
}
