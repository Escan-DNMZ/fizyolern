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
  gluteus_minimus: { layer: 3, o: ['hip bone'], i: ['femur'] },
  gemellus_superior: { layer: 3, o: ['hip bone'], i: ['femur'] },
  obturatorius_internus: { layer: 3, o: ['hip bone'], i: ['femur'] },
  gemellus_inferior: { layer: 3, o: ['hip bone'], i: ['femur'] },
  obturatorius_externus: { layer: 3, o: ['hip bone'], i: ['femur'] },
  quadratus_femoris: { layer: 3, o: ['hip bone'], i: ['femur'] },
  pectineus: { layer: 2, o: ['hip bone'], i: ['femur'] },
  adductor_brevis: { layer: 2, o: ['hip bone'], i: ['femur'] },
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
export const LAYER_NAMES_EN = { 1: 'Superficial', 2: 'Middle', 3: 'Deep' };

const CAPUT = { Long: ['Caput longum', 'Langer Kopf', 'uzun baş', 'long head'], Short: ['Caput breve', 'Kurzer Kopf', 'kısa baş', 'short head'], Lateral: ['Caput laterale', 'Seitlicher Kopf', 'dış baş', 'lateral head'], Medial: ['Caput mediale', 'Innerer Kopf', 'iç baş', 'medial head'] };
const PARS = {
  Clavicular: ['Pars clavicularis', 'Schlüsselbeinteil', 'köprücük kısmı', 'clavicular part'],
  Acromial: ['Pars acromialis', 'Schulterhöhenteil', 'akromiyal kısım', 'acromial part'],
  Spinal: ['Pars spinalis', 'Gräteteil', 'spina kısmı', 'spinal part'],
  Sternocostal: ['Pars sternocostalis', 'Brustbein-Rippen-Teil', 'sternokostal kısım', 'sternocostal part'],
  Abdominal: ['Pars abdominalis', 'Bauchteil', 'karın kısmı', 'abdominal part'],
  Descending: ['Pars descendens', 'Absteigender Teil', 'inen kısım', 'descending part'],
  Transverse: ['Pars transversa', 'Querer Teil', 'yatay kısım', 'transverse part'],
  Ascending: ['Pars ascendens', 'Aufsteigender Teil', 'çıkan kısım', 'ascending part'],
};
const NAMED = {
  'rhomboid major': ['M. rhomboideus major', 'Großer Rautenmuskel', 'büyük romboid', 'rhomboid major'],
  'rhomboid minor': ['M. rhomboideus minor', 'Kleiner Rautenmuskel', 'küçük romboid', 'rhomboid minor'],
  'psoas major': ['M. psoas major', 'Großer Lendenmuskel', 'büyük psoas', 'psoas major'],
  iliacus: ['M. iliacus', 'Darmbeinmuskel', 'iliak kas', 'iliacus muscle'],
  'tensor fasciae latae': ['M. tensor fasciae latae', 'Schenkelbindenspanner', 'tensor fasya lata', 'tensor fasciae latae'],
  'iliotibial tract': ['Tractus iliotibialis', 'Iliotibialband', 'iliotibial bant', 'iliotibial band'],
  'calcaneal tendon': ['Tendo calcaneus', 'Achillessehne', 'Aşil tendonu', 'Achilles tendon'],
  'iliocostalis lumborum': ['M. iliocostalis lumborum', 'Lenden-Darmbein-Rippen-Muskel', 'iliokostalis (bel)', 'iliocostalis (lumbar)'],
  'iliocostalis thoracis': ['M. iliocostalis thoracis', 'Brust-Darmbein-Rippen-Muskel', 'iliokostalis (göğüs)', 'iliocostalis (thoracic)'],
  'longissimus thoracis': ['M. longissimus thoracis', 'Längster Brustmuskel', 'longissimus (göğüs)', 'longissimus (thoracic)'],
  'spinalis thoracis': ['M. spinalis thoracis', 'Dornmuskel der Brust', 'spinalis (göğüs)', 'spinalis (thoracic)'],
};

// BodyParts3D-Teilname → { la, de, tr, en } (Name des Muskelteils)
export function partNames(enName, muscle) {
  const n = (enName || '').replace(/#\d+$/, '');
  let m = n.match(/^(Long|Short|Lateral|Medial) head of/i);
  if (m) { const [la, de, tr, en] = CAPUT[m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()]; return { la, de, tr, en }; }
  m = n.match(/^(\w+) part of/i);
  if (m && PARS[m[1]]) { const [la, de, tr, en] = PARS[m[1]]; return { la, de, tr, en }; }
  const key = n.replace(/^(left|right)\s+/i, '').toLowerCase();
  if (NAMED[key]) { const [la, de, tr, en] = NAMED[key]; return { la, de, tr, en }; }
  return { la: muscle.la, de: muscle.de, tr: muscle.tr, en: muscle.en };
}

// Ursprung/Ansatz-Text eines Teils aus dem Gesamttext herausschneiden („Pars clavicularis: …; Pars acromialis: …“)
export function partText(full, la) {
  if (!full) return '';
  const seg = full.split(/;\s*/).find((s) => s.toLowerCase().startsWith(la.toLowerCase()));
  return seg ? seg.slice(la.length).replace(/^[:\s]+/, '') : full;
}
