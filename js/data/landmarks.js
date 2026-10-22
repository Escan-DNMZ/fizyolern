// Knochenpunkte (Landmarks) am Becken und Bein.
// pos = Punkt auf dem echten BodyParts3D-Knochen der linken Körperseite (App-Koordinaten, Meter; rechts = x gespiegelt),
//       einmalig aus den Mesh-Eckpunkten bestimmt (Extrempunkte, z. B. SIAS = vorderster Punkt oben am Darmbein).
// o = Muskeln mit Ursprung hier, i = Muskeln mit Ansatz hier, via = Sehne läuft hier vorbei / wird umgelenkt.
// mid = liegt in der Mittellinie (nur einmal).
export const LANDMARKS = [
  { id: 'sias', la: 'Spina iliaca anterior superior (SIAS)', de: 'Vorderer oberer Darmbeinstachel', tr: 'Ön üst iliak çıkıntı', en: 'Front upper iliac spine', bone: 'os_coxae', pos: [0.1293, 0.9651, 0.0591],
    o: ['sartorius', 'tensor_fasciae_latae'], i: [] },
  { id: 'siai', la: 'Spina iliaca anterior inferior (SIAI)', de: 'Vorderer unterer Darmbeinstachel', tr: 'Ön alt iliak çıkıntı', en: 'Front lower iliac spine', bone: 'os_coxae', pos: [0.1056, 0.9231, 0.0339],
    o: ['rectus_femoris'], i: [] },
  { id: 'sips', la: 'Spina iliaca posterior superior (SIPS)', de: 'Hinterer oberer Darmbeinstachel', tr: 'Arka üst iliak çıkıntı', en: 'Back upper iliac spine', bone: 'os_coxae', pos: [0.046, 0.9785, -0.0787],
    o: ['gluteus_maximus'], i: [] },
  { id: 'sipi', la: 'Spina iliaca posterior inferior (SIPI)', de: 'Hinterer unterer Darmbeinstachel', tr: 'Arka alt iliak çıkıntı', en: 'Back lower iliac spine', bone: 'os_coxae', pos: [0.0494, 0.939, -0.0553],
    o: [], i: [], note: 'oberer Rand der Incisura ischiadica major' },
  { id: 'crista_iliaca', la: 'Crista iliaca', de: 'Darmbeinkamm', tr: 'İliak kanat kenarı (kalça kemiği tepesi)', en: 'Iliac crest (top edge of the hip bone)', bone: 'os_coxae', pos: [0.1049, 1.0281, -0.02],
    o: ['quadratus_lumborum', 'latissimus_dorsi', 'erector_spinae', 'transversus_abdominis', 'gluteus_maximus'], i: ['obliquus_externus'] },
  { id: 'tuberculum_iliacum', la: 'Tuberculum iliacum', de: 'Darmbeinhöcker', tr: 'İliak tümsek', en: 'Iliac tubercle', bone: 'os_coxae', pos: [0.143, 1.0017, 0.0129],
    o: ['tensor_fasciae_latae'], i: [] },
  { id: 'incisura_ischiadica_major', la: 'Incisura ischiadica major', de: 'Großer Sitzbeineinschnitt', tr: 'Büyük siyatik çentik', en: 'Greater sciatic notch', bone: 'os_coxae', pos: [0.0622, 0.9218, -0.0283],
    o: [], i: [], via: ['piriformis'] },
  { id: 'spina_ischiadica', la: 'Spina ischiadica', de: 'Sitzbeinstachel', tr: 'Siyatik çıkıntı', en: 'Ischial spine', bone: 'os_coxae', pos: [0.0456, 0.887, -0.044],
    o: ['gemellus_superior'], i: [] },
  { id: 'incisura_ischiadica_minor', la: 'Incisura ischiadica minor', de: 'Kleiner Sitzbeineinschnitt', tr: 'Küçük siyatik çentik', en: 'Lesser sciatic notch', bone: 'os_coxae', pos: [0.0467, 0.8485, -0.0265],
    o: [], i: [], via: ['obturatorius_internus'] },
  { id: 'tuber_ischiadicum', la: 'Tuber ischiadicum', de: 'Sitzbeinhöcker', tr: 'Oturma kemiği çıkıntısı', en: 'Sitting bone (ischial tuberosity)', bone: 'os_coxae', pos: [0.0532, 0.8236, -0.0359],
    o: ['biceps_femoris', 'semitendinosus', 'semimembranosus', 'gemellus_inferior', 'quadratus_femoris', 'adductor_magnus'], i: [] },
  { id: 'foramen_obturatum', la: 'Foramen obturatum', de: 'Hüftbeinloch', tr: 'Obturator deliği', en: 'Obturator foramen', bone: 'os_coxae', pos: [0.0505, 0.8322, 0.0082],
    o: ['obturatorius_internus', 'obturatorius_externus'], i: [] },
  { id: 'acetabulum', la: 'Acetabulum', de: 'Hüftpfanne', tr: 'Kalça çukuru (asetabulum)', en: 'Hip socket (acetabulum)', bone: 'os_coxae', pos: [0.0976, 0.8872, -0.0018],
    o: [], i: [] },
  { id: 'symphysis_pubica', la: 'Symphysis pubica', de: 'Schambeinfuge', tr: 'Kasık birleşimi (simfiz)', en: 'Pubic joint (symphysis)', bone: 'os_coxae', pos: [0.0055, 0.865, 0.038], mid: true,
    o: ['gracilis', 'adductor_longus', 'rectus_abdominis'], i: [] },
  { id: 'tuberculum_pubicum', la: 'Tuberculum pubicum', de: 'Schambeinhöcker', tr: 'Pubik tümsek', en: 'Pubic tubercle', bone: 'os_coxae', pos: [0.0175, 0.8733, 0.0574],
    o: ['adductor_longus'], i: [] },
  { id: 'promontorium', la: 'Promontorium (Os sacrum)', de: 'Vorberg des Kreuzbeins', tr: 'Sakrumun ön çıkıntısı (promontoryum)', en: 'Front projection of the sacrum (promontory)', bone: 'sacrum', pos: [0.0199, 0.9959, -0.0282], mid: true,
    o: [], i: [] },
  { id: 'os_coccygis', la: 'Os coccygis', de: 'Steißbein', tr: 'Kuyruk sokumu (koksiks)', en: 'Tailbone (coccyx)', bone: 'sacrum', pos: [0, 0.8528, -0.0657], mid: true, approx: true,
    o: ['gluteus_maximus'], i: [] },
  { id: 'trochanter_major', la: 'Trochanter major', de: 'Großer Rollhügel', tr: 'Büyük trokanter', en: 'Greater trochanter', bone: 'femur', pos: [0.1502, 0.854, -0.0039],
    o: ['vastus_lateralis'], i: ['gluteus_medius', 'gluteus_minimus', 'piriformis', 'gemellus_superior', 'obturatorius_internus', 'gemellus_inferior'] },
  { id: 'trochanter_minor', la: 'Trochanter minor', de: 'Kleiner Rollhügel', tr: 'Küçük trokanter', en: 'Lesser trochanter', bone: 'femur', pos: [0.0913, 0.818, -0.015],
    o: [], i: ['iliopsoas'] },
  // Femur (Anatomie I 2): Punkte am Mesh geprüft (vorne/hinten); Fossa/Crista/Linea = Mitte der Struktur
  { id: 'caput_femoris', la: 'Caput femoris', de: 'Hüftkopf', tr: 'Femur başı', en: 'Head of the femur', bone: 'femur', pos: [0.0844, 0.8823, 0.0216],
    o: [], i: [], note: 'Fovea capitis: Lig. capitis femoris' },
  { id: 'collum_femoris', la: 'Collum femoris', de: 'Schenkelhals', tr: 'Femur boynu', en: 'Neck of the femur', bone: 'femur', pos: [0.1052, 0.8752, 0.013],
    o: [], i: [] },
  { id: 'fossa_trochanterica', la: 'Fossa trochanterica', de: 'Rollhügelgrube', tr: 'Büyük trokanterin iç çukuru', en: 'Trochanteric fossa', bone: 'femur', pos: [0.1137, 0.8709, -0.0099],
    o: [], i: ['obturatorius_externus'] },
  { id: 'linea_intertrochanterica', la: 'Linea intertrochanterica', de: 'Linie zwischen den Rollhügeln (vorne)', tr: 'Trokanterler arası çizgi (önde)', en: 'Intertrochanteric line (front)', bone: 'femur', pos: [0.1153, 0.8407, 0.0086],
    o: [], i: [], note: 'Lig. iliofemorale' },
  { id: 'crista_intertrochanterica', la: 'Crista intertrochanterica', de: 'Kamm zwischen den Rollhügeln (hinten)', tr: 'Trokanterler arası kabartı (arkada)', en: 'Intertrochanteric crest (back)', bone: 'femur', pos: [0.1216, 0.8419, -0.0299],
    o: [], i: ['quadratus_femoris'] },
  { id: 'tuberositas_glutea', la: 'Tuberositas glutea', de: 'Gesäßrauigkeit', tr: 'Gluteal pürüzlülük (femur arkası, üst-dış)', en: 'Gluteal tuberosity', bone: 'femur', pos: [0.1273, 0.7998, -0.0113],
    o: [], i: ['gluteus_maximus'] },
  { id: 'linea_aspera', la: 'Linea aspera', de: 'Raue Linie (Oberschenkelrückseite)', tr: 'Femur arkasındaki pürüzlü çizgi', en: 'Rough line on the back of the femur', bone: 'femur', pos: [0.0987, 0.6745, -0.0004],
    o: ['vastus_lateralis', 'vastus_medialis', 'biceps_femoris'], i: ['adductor_longus', 'adductor_brevis', 'adductor_magnus'] },
  { id: 'condylus_medialis_femoris', la: 'Condylus medialis femoris', de: 'Innerer Gelenkknorren des Femurs', tr: 'Femurun iç kondili', en: 'Medial condyle of the femur', bone: 'femur', pos: [0.0494, 0.4616, -0.0303],
    o: [], i: [] },
  { id: 'condylus_lateralis_femoris', la: 'Condylus lateralis femoris', de: 'Äußerer Gelenkknorren des Femurs', tr: 'Femurun dış kondili', en: 'Lateral condyle of the femur', bone: 'femur', pos: [0.0962, 0.4633, -0.0266],
    o: [], i: [] },
  { id: 'epicondylus_medialis_femoris', la: 'Epicondylus medialis femoris', de: 'Innerer Epikondylus des Femurs', tr: 'Femurun iç epikondili', en: 'Medial epicondyle of the femur', bone: 'femur', pos: [0.032, 0.4737, -0.008],
    o: ['gastrocnemius'], i: [], note: 'Innenband (Lig. collaterale tibiale)' },
  { id: 'epicondylus_lateralis_femoris', la: 'Epicondylus lateralis femoris', de: 'Äußerer Epikondylus des Femurs', tr: 'Femurun dış epikondili', en: 'Lateral epicondyle of the femur', bone: 'femur', pos: [0.1126, 0.4651, -0.0012],
    o: ['gastrocnemius'], i: [], note: 'Außenband (Lig. collaterale fibulare)' },
  { id: 'tuberculum_adductorium', la: 'Tuberculum adductorium', de: 'Adduktorenhöcker', tr: 'Addüktör tümseği', en: 'Adductor tubercle', bone: 'femur', pos: [0.0408, 0.4855, -0.0016],
    o: [], i: ['adductor_magnus'] },
  { id: 'fossa_intercondylaris', la: 'Fossa intercondylaris', de: 'Grube zwischen den Femurkondylen', tr: 'Kondiller arası çukur', en: 'Intercondylar fossa', bone: 'femur', pos: [0.0696, 0.457, -0.0032],
    o: [], i: [], note: 'Kreuzbänder' },
  { id: 'tuberositas_tibiae', la: 'Tuberositas tibiae', de: 'Schienbeinrauigkeit', tr: 'Tibia ön tümseği', en: 'Tibial tuberosity (front bump of the tibia)', bone: 'tibia', pos: [0.0868, 0.4093, 0.0345],
    o: [], i: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'], note: 'über das Lig. patellae' },
];

export const findLandmark = (id) => LANDMARKS.find((l) => l.id === id);

// Landmarks eines Muskels: { o: [...], i: [...], via: [...] }
export function landmarksOf(muscleId) {
  const r = { o: [], i: [], via: [] };
  for (const l of LANDMARKS) for (const k of ['o', 'i', 'via']) if ((l[k] || []).includes(muscleId)) r[k].push(l);
  return r;
}

// Kurzname für Beschriftungen: „SIAS“, sonst la ohne Klammerzusatz
export const shortLa = (l) => (l.la.match(/\(([A-Z]{3,4})\)/) || [])[1] || l.la.replace(/\s*\(.*\)$/, '');
