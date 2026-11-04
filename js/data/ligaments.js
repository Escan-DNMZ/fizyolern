// Wichtige Bänder (Ligamenta) – für „Günün kemiği/eklemi“: zu jedem Knochen bzw. Gelenk
// die prüfungsrelevanten Bänder + eine tägliche Bandfrage.
// knochen = IDs aus BONES (anatomy.js), gelenk = ID aus JOINTS.
// fn = Funktion auf Deutsch (Prüfungssprache), tr = kurze türkische Hilfe (Wortwurzel).

export const LIGAMENTS = [
  // ── Hüfte (Art. coxae) ──
  { id: 'lig_iliofemorale', la: 'Lig. iliofemorale', gelenk: 'art_coxae', knochen: ['os_coxae', 'femur'],
    fn: 'stärkstes Band des Körpers, hemmt die Extension', tr: 'ilio = ilium, femorale = femur · kalça önü' },
  { id: 'lig_pubofemorale', la: 'Lig. pubofemorale', gelenk: 'art_coxae', knochen: ['os_coxae', 'femur'],
    fn: 'hemmt die Abduktion', tr: 'pubo = pubis · bacak yana açılınca gerilir' },
  { id: 'lig_ischiofemorale', la: 'Lig. ischiofemorale', gelenk: 'art_coxae', knochen: ['os_coxae', 'femur'],
    fn: 'liegt hinten, hemmt die Innenrotation', tr: 'Ischio = Innenrotation (ikisi de I)' },
  { id: 'lig_capitis_femoris', la: 'Lig. capitis femoris', gelenk: 'art_coxae', knochen: ['os_coxae', 'femur'],
    fn: 'im Gelenk, führt die A. capitis femoris', tr: 'femur başı bağı · içinden arter geçer' },
  // ── Becken (ISG) ──
  { id: 'lig_sacrotuberale', la: 'Lig. sacrotuberale', gelenk: 'art_sacroiliaca', knochen: ['sacrum', 'os_coxae'],
    fn: 'vom Os sacrum zum Tuber ischiadicum, sichert das ISG', tr: 'sacro = sakrum, tuberale = tuber ischiadicum' },
  { id: 'lig_sacrospinale', la: 'Lig. sacrospinale', gelenk: 'art_sacroiliaca', knochen: ['sacrum', 'os_coxae'],
    fn: 'vom Os sacrum zur Spina ischiadica, sichert das ISG', tr: 'spinale = spina ischiadica' },
  // ── Knie (Art. genus) ──
  { id: 'lig_cruciatum_anterius', la: 'Lig. cruciatum anterius (VKB)', gelenk: 'art_genus', knochen: ['femur', 'tibia'],
    fn: 'verhindert, dass die Tibia nach vorne gleitet (vordere Schublade)', tr: 'crux = haç · ön çapraz bağ' },
  { id: 'lig_cruciatum_posterius', la: 'Lig. cruciatum posterius (HKB)', gelenk: 'art_genus', knochen: ['femur', 'tibia'],
    fn: 'verhindert, dass die Tibia nach hinten gleitet; stärkstes Knieband', tr: 'arka çapraz bağ' },
  { id: 'lig_collaterale_tibiale', la: 'Lig. collaterale tibiale', gelenk: 'art_genus', knochen: ['femur', 'tibia'],
    fn: 'Innenband, schützt gegen Valgus; mit dem Innenmeniskus verwachsen', tr: 'con + latus = yan · iç yan bağ' },
  { id: 'lig_collaterale_fibulare', la: 'Lig. collaterale fibulare', gelenk: 'art_genus', knochen: ['femur', 'fibula'],
    fn: 'Außenband, schützt gegen Varus; setzt am Caput fibulae an', tr: 'dış yan bağ' },
  { id: 'lig_patellae', la: 'Lig. patellae', gelenk: 'art_genus', knochen: ['patella', 'tibia'],
    fn: 'von der Patella zur Tuberositas tibiae, Fortsetzung der Quadrizepssehne', tr: 'diz kapağı bağı' },
  // ── Sprunggelenk (OSG / USG) ──
  { id: 'lig_talofibulare_anterius', la: 'Lig. talofibulare anterius', gelenk: 'art_talocruralis', knochen: ['talus', 'fibula'],
    fn: 'reißt beim Supinationstrauma als erstes', tr: 'talus + fibula + ön' },
  { id: 'lig_calcaneofibulare', la: 'Lig. calcaneofibulare', gelenk: 'art_talocruralis', knochen: ['calcaneus', 'fibula'],
    fn: 'Außenband, reißt beim Umknicken als zweites', tr: 'calcaneo = topuk kemiği' },
  { id: 'lig_talofibulare_posterius', la: 'Lig. talofibulare posterius', gelenk: 'art_talocruralis', knochen: ['talus', 'fibula'],
    fn: 'stärkstes Außenband, reißt selten', tr: 'talus + fibula + arka' },
  { id: 'lig_deltoideum', la: 'Lig. deltoideum', gelenk: 'art_talocruralis', knochen: ['tibia', 'talus', 'calcaneus', 'pes'],
    fn: 'Innenband des OSG, verhindert die Valgisierung', tr: 'Δ delta = üçgen/yelpaze · iç bağ' },
  { id: 'lig_tibiofibulare', la: 'Lig. tibiofibulare anterius/posterius (Syndesmose)', gelenk: 'art_talocruralis', knochen: ['tibia', 'fibula'],
    fn: 'hält die Malleolengabel zusammen', tr: 'syn + desmos = birlikte bağ' },
  { id: 'lig_talocalcaneum_interosseum', la: 'Lig. talocalcaneum interosseum', gelenk: 'art_subtalaris', knochen: ['talus', 'calcaneus'],
    fn: 'trennt vordere und hintere Kammer, wichtigster Stabilisator des USG', tr: 'interosseum = kemikler arası' },
  { id: 'lig_bifurcatum', la: 'Lig. bifurcatum', gelenk: 'art_subtalaris', knochen: ['calcaneus', 'pes'],
    fn: 'Y-förmig: Lig. calcaneonaviculare + Lig. calcaneocuboideum', tr: 'bi + furca = iki çatal' },
  { id: 'lig_plantare_longum', la: 'Lig. plantare longum', gelenk: 'art_subtalaris', knochen: ['calcaneus', 'pes'],
    fn: 'stützt das Längsgewölbe von unten', tr: 'uzun taban bağı' },
  // ── Obere Extremität ──
  { id: 'lig_coracohumerale', la: 'Lig. coracohumerale', gelenk: 'art_humeri', knochen: ['scapula', 'humerus'],
    fn: 'vom Proc. coracoideus zum Humerus, verstärkt die Schulterkapsel oben', tr: 'coraco = korakoid çıkıntı' },
  { id: 'lig_coracoclaviculare', la: 'Lig. coracoclaviculare', gelenk: 'art_acromioclavicularis', knochen: ['scapula', 'clavicula'],
    fn: 'Lig. trapezoideum + conoideum, sichert das AC-Gelenk', tr: 'korakoid + klavikula' },
  { id: 'lig_collaterale_ulnare', la: 'Lig. collaterale ulnare', gelenk: 'art_cubiti', knochen: ['humerus', 'ulna'],
    fn: 'Innenband des Ellenbogens, schützt gegen Valgus', tr: 'dirseğin iç yan bağı' },
  { id: 'lig_collaterale_radiale', la: 'Lig. collaterale radiale', gelenk: 'art_cubiti', knochen: ['humerus', 'radius'],
    fn: 'Außenband des Ellenbogens, schützt gegen Varus', tr: 'dirseğin dış yan bağı' },
  { id: 'lig_anulare_radii', la: 'Lig. anulare radii', gelenk: 'art_cubiti', knochen: ['radius', 'ulna'],
    fn: 'umgreift ringförmig das Radiusköpfchen', tr: 'anulus = halka' },
  { id: 'lig_costoclaviculare', la: 'Lig. costoclaviculare', gelenk: 'art_sternoclavicularis', knochen: ['clavicula', 'costae', 'sternum'],
    fn: 'von der 1. Rippe zur Clavicula, sichert das SC-Gelenk', tr: 'costa = kaburga' },
];

// Bänder zu einem Knochen (über knochen) bzw. Gelenk (über gelenk)
export function ligamentsFor(s) {
  if (!s) return [];
  return LIGAMENTS.filter((l) => (s.kind === 'joint' ? l.gelenk === s.id : l.knochen.includes(s.id)));
}

// kleine deterministische Zufallszahl (gleiche Frage am gleichen Tag)
function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// Tägliche Bandfrage zum Knochen/Gelenk des Tages: „Welches Band … ?“ – 4 Antworten
// Ablenker bevorzugt aus demselben Gelenk/Knochen (schwerer), sonst aus der ganzen Liste.
export function ligamentQuestion(s, seed = '') {
  const own = ligamentsFor(s);
  if (!own.length) return null;
  const h = hash(seed + s.id);
  const lig = own[h % own.length];
  const near = own.filter((l) => l.id !== lig.id);
  const far = LIGAMENTS.filter((l) => l.id !== lig.id && !near.includes(l));
  const pool = [...near, ...far.sort((a, b) => hash(seed + a.id) - hash(seed + b.id))];
  const wrong = pool.slice(0, 3);
  const opts = [lig, ...wrong].sort((a, b) => hash(seed + a.id + 'o') - hash(seed + b.id + 'o'));
  return {
    id: 'lig:' + lig.id,
    q: `Welches Band: ${lig.fn}?`,
    opts: opts.map((l) => l.la),
    ans: opts.indexOf(lig),
    lig,
  };
}
