// Anatomische Prüfung aller Bänder im 3D-Modell – unabhängig von den gespeicherten Koordinaten.
// 1) Jeder Endpunkt liegt auf der Oberfläche eines Knochens (≤ 2 mm, echtes Modell aus models/bones.glb)
//    und dieser Knochen gehört zum Band (knochen in ligaments.js).
// 2) Lehrbuchregeln je Band (Ursprung/Ansatz an den richtigen Knochenpunkten, Verlauf vorne/hinten/medial/lateral),
//    gemessen an den geprüften Knochenpunkten aus landmarks.js.
// 3) Lerntexte: Funktionen eindeutig, Teil-Bänder (Lig. deltoideum) nie als Ablenker in der Tagesfrage.
// Koordinaten: linke Körperseite, x = lateral, y = oben, z = vorne (Meter).
// Aufruf: node tools/test_lig_anatomie.mjs
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)));
const { LIGAMENTS, ligamentQuestion } = await imp('js/data/ligaments.js');
const { LIG3D } = await imp('js/data/lig3d.js');
const { LANDMARKS } = await imp('js/data/landmarks.js');
const { loadBones, distTo, boxOf } = await imp('tools/bones_geo.mjs');

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fail++; console.log('✗', msg); } };
const mm = (d) => `${Math.round(d * 1000)} mm`;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Knochen der linken Körperseite und der Mittellinie
const ALL = await loadBones();
const BONES = new Map([...ALL].filter(([k]) => !/\bright\b/i.test(k)));
const box = new Map([...BONES].map(([k, b]) => [k, boxOf(b)]));
// Auf welchem Knochen liegt p? → { part, group, d }
function boneAt(p) {
  let best = { part: null, group: null, d: Infinity };
  for (const [k, b] of BONES) {
    const { mn, mx } = box.get(k);
    if (p.some((v, i) => v < mn[i] - 0.01 || v > mx[i] + 0.01)) continue;
    const d = distTo(b, p);
    if (d < best.d) best = { part: k, group: b.group, d };
  }
  return best;
}
const LM = Object.fromEntries(LANDMARKS.map((l) => [l.id, l.pos]));
const C = (part) => box.get(part).c;
const MN = (part) => box.get(part).mn;

// ── Hilfen für die Regeln ──
let cur = '';
const on = (p, ...parts) => { const b = boneAt(p); ok(b.d <= 0.002 && parts.includes(b.part), `${cur}: Punkt [${p}] soll auf ${parts.join(' / ')} liegen, liegt auf ${b.part} (${mm(b.d)})`); };
const near = (p, lm, max) => { const d = dist(p, LM[lm]); ok(d <= max / 1000, `${cur}: Punkt soll ≤ ${max} mm von ${lm} liegen, ist ${mm(d)}`); };
const is = (cond, msg) => ok(cond, `${cur}: ${msg}`);
// liegt p in der unteren Hälfte des Knochenquerschnitts an dieser Stelle? (k = Längsachse des Knochens: 0 = x, 2 = z)
function lowerHalf(p, part, k) {
  const { pos } = BONES.get(part);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i + k] - p[k]) < 0.004) { lo = Math.min(lo, pos[i + 1]); hi = Math.max(hi, pos[i + 1]); }
  return p[1] <= (lo + hi) / 2;
}
// medialster Punkt des Femurkopfs (Fovea capitis liegt dort)
function femurHeadMedialX() {
  const { pos } = BONES.get('Left femur');
  let x = Infinity;
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > LM.collum_femoris[1] - 0.01) x = Math.min(x, pos[i]);
  return x;
}

const TA = 'Left talus', CA = 'Left calcaneus', TI = 'Left tibia', FI = 'Left fibula', FE = 'Left femur', HB = 'Left hip bone';
const NA = 'Navicular bone of left foot', CU = 'Left cuboid bone';

// Lehrbuchregeln (Ursprung a → Ansatz b je Zug, Reihenfolge wie in lig3d.js)
const RULES = {
  // ── Hüfte ──
  lig_iliofemorale: (bs) => {
    for (const [a, b] of bs) {
      on(a, HB); near(a, 'siai', 15);
      on(b, FE); is(b[1] <= LM.trochanter_major[1] + 0.01 && b[1] >= LM.trochanter_minor[1] - 0.01 && b[2] > 0, 'Ansatz an der Linea intertrochanterica (vorne, zwischen den Trochanteren)');
    }
    is(bs.length === 2 && bs[0][1][0] > bs[1][1][0] + 0.01 && bs[0][1][1] > bs[1][1][1], 'Y-Form: Pars lateralis zieht höher und weiter lateral als Pars medialis');
  },
  lig_pubofemorale: ([[a, b]]) => {
    on(a, HB); is(a[0] < LM.acetabulum[0] - 0.02 && a[2] > LM.acetabulum[2] + 0.02, 'Ursprung am Ramus superior ossis pubis (medial und vor dem Acetabulum)');
    on(b, FE); near(b, 'trochanter_minor', 25); is(b[1] < LM.collum_femoris[1], 'Ansatz unten am Schenkelhals / vor dem Trochanter minor');
  },
  lig_ischiofemorale: ([[a, b]]) => {
    on(a, HB); is(a[2] < LM.acetabulum[2] - 0.015 && a[1] < LM.acetabulum[1], 'Ursprung am Sitzbein hinter/unter dem Acetabulum');
    on(b, FE); near(b, 'fossa_trochanterica', 20); is(b[2] < LM.collum_femoris[2], 'zieht hinten zum Schenkelhals');
  },
  lig_capitis_femoris: ([[a, b]]) => {
    on(a, FE); is(a[0] <= femurHeadMedialX() + 0.004, 'Ursprung an der Fovea capitis (medialster Teil des Femurkopfs)');
    on(b, HB); near(b, 'acetabulum', 50); is(dist(a, b) < 0.02, 'kurz, liegt im Gelenk');
  },
  // ── ISG ──
  lig_sacrotuberale: (bs) => {
    on(bs[0][0], 'Sacrum'); on(bs[1][0], HB); near(bs[1][0], 'sips', 20);
    for (const [, b] of bs) { on(b, HB); near(b, 'tuber_ischiadicum', 15); is(b[0] <= LM.tuber_ischiadicum[0], 'Ansatz an der Innenseite des Tuber ischiadicum'); }
  },
  lig_sacrospinale: ([[a, b]]) => {
    on(a, 'Sacrum'); on(b, HB); near(b, 'spina_ischiadica', 6);
  },
  // ── Knie ──
  lig_cruciatum_anterius: ([[a, b]]) => {
    on(a, FE); near(a, 'fossa_intercondylaris', 25); is(a[0] > LM.fossa_intercondylaris[0], 'Ursprung an der Innenfläche des Condylus lateralis femoris');
    on(b, TI); is(b[1] > box.get(TI).mx[1] - 0.012, 'Ansatz oben am Tibiaplateau (Area intercondylaris)');
    is(b[2] > a[2] + 0.01, 'verläuft von hinten-oben-lateral nach vorne-unten-medial');
  },
  lig_cruciatum_posterius: ([[a, b]]) => {
    const [[aa, ab]] = LIG3D.lig_cruciatum_anterius.bands;
    on(a, FE); near(a, 'fossa_intercondylaris', 25); is(a[0] < aa[0] - 0.005, 'Ursprung an der Innenfläche des Condylus medialis femoris (medialer als VKB)');
    on(b, TI); is(b[2] < ab[2] - 0.02, 'Ansatz an der Area intercondylaris posterior (hinter dem VKB)');
    is(b[2] < a[2], 'verläuft von vorne-oben nach hinten-unten');
  },
  lig_collaterale_tibiale: ([[a, b]]) => {
    on(a, FE); near(a, 'epicondylus_medialis_femoris', 8);
    on(b, TI); is(b[0] < C(TI)[0], 'Ansatz an der medialen Tibia');
    const gap = LM.condylus_medialis_tibiae[1] - b[1];
    is(gap >= 0.04 && gap <= 0.1, `Ansatz 4–10 cm unter dem Gelenkspalt (ist ${mm(gap)})`);
  },
  lig_collaterale_fibulare: ([[a, b]]) => {
    on(a, FE); near(a, 'epicondylus_lateralis_femoris', 8);
    on(b, FI); near(b, 'caput_fibulae', 10);
  },
  lig_patellae: ([[a, b]]) => {
    on(a, 'Left patella'); is(a[1] < MN('Left patella')[1] + 0.006, 'Ursprung an der Apex patellae (unterer Pol)');
    on(b, TI); near(b, 'tuberositas_tibiae', 6);
  },
  // ── Sprunggelenk lateral ──
  lig_talofibulare_anterius: ([[a, b]]) => {
    on(a, FI); near(a, 'malleolus_lateralis', 25);
    on(b, TA); is(b[2] > a[2] + 0.01, 'zieht nach vorne zum Talushals');
    is(a[2] > LIG3D.lig_talofibulare_posterius.bands[0][0][2] + 0.01, 'Ursprung am Vorderrand des Malleolus lateralis');
  },
  lig_calcaneofibulare: ([[a, b]]) => {
    on(a, FI); is(a[1] < MN(FI)[1] + 0.004, 'Ursprung an der Spitze des Malleolus lateralis');
    on(b, CA); is(b[0] > C(CA)[0], 'Ansatz an der lateralen Calcaneusfläche');
    is(b[1] < a[1] - 0.01 && b[2] < a[2], 'verläuft nach unten-hinten');
  },
  lig_talofibulare_posterius: ([[a, b]]) => {
    on(a, FI); near(a, 'malleolus_lateralis', 25);
    on(b, TA); is(b[2] < C(TA)[2], 'Ansatz am Processus posterior tali');
    is(Math.abs(a[1] - b[1]) < 0.025, 'verläuft annähernd horizontal nach hinten-medial');
  },
  // ── Sprunggelenk medial: Lig. deltoideum ──
  lig_deltoideum: () => is(LIG3D.lig_deltoideum.parts.length === 4, 'besteht aus vier Teilen'),
  lig_deltoideum_tibionavicularis: ([[a, b]]) => { deltoUrsprung(a); on(b, NA); near(b, 'tuberositas_ossis_navicularis', 10); },
  lig_deltoideum_tibiocalcanea: ([[a, b]]) => { deltoUrsprung(a); on(b, CA); near(b, 'sustentaculum_tali', 10); },
  lig_deltoideum_tibiotalaris_anterior: ([[a, b]]) => { deltoUrsprung(a); on(b, TA); is(b[2] > a[2] + 0.005 && b[0] < C(TA)[0], 'Ansatz vorne-medial am Talus (Talushals)'); },
  lig_deltoideum_tibiotalaris_posterior: ([[a, b]]) => { deltoUrsprung(a); on(b, TA); is(b[2] < a[2] - 0.01 && b[0] < C(TA)[0], 'Ansatz hinten-medial am Talus'); },
  lig_tibiofibulare: (bs) => {
    for (const [a, b] of bs) { on(a, TI); on(b, FI); is(Math.min(a[1], b[1]) > LM.trochlea_tali[1] - 0.01, 'liegt über dem oberen Sprunggelenk (Malleolengabel)'); }
    is((bs[0][0][2] + bs[0][1][2]) / 2 > (bs[1][0][2] + bs[1][1][2]) / 2 + 0.01, 'Zug 1 = anterius, Zug 2 = posterius');
  },
  // ── Unteres Sprunggelenk / Fuß ──
  lig_talocalcaneum_interosseum: ([[a, b]]) => {
    on(a, TA); on(b, CA); is(a[1] > b[1] && dist(a, b) < 0.02, 'kurz, von der Talusunterseite zur Calcaneusoberseite');
    is(a[0] > C(TA)[0], 'liegt im Sinus tarsi (lateral)');
  },
  lig_calcaneonaviculare_plantare: ([[a, b]]) => {
    on(a, CA); near(a, 'sustentaculum_tali', 10);
    on(b, NA); is(b[1] < C(NA)[1], 'Ansatz an der Unterseite des Os naviculare');
  },
  lig_bifurcatum: (bs) => {
    for (const [a] of bs) { on(a, CA); is(a[2] > C(CA)[2] && a[1] > C(CA)[1], 'Ursprung oben-vorne am Calcaneus'); }
    on(bs[0][1], NA); on(bs[1][1], CU);
  },
  lig_plantare_longum: (bs) => {
    for (const [a, b] of bs) {
      on(a, CA); is(a[1] < C(CA)[1], 'Ursprung an der Unterseite des Calcaneus');
      const bb = boneAt(b);
      is(bb.part === CU || /metatarsal/.test(bb.part || ''), `Ansatz an Os cuboideum oder Basen der Mittelfußknochen (ist ${bb.part})`);
      if (bb.part) is(lowerHalf(b, bb.part, 2), `Ansatz plantar (an der Unterseite von ${bb.part})`);
    }
  },
  // ── Schulter ──
  lig_coracohumerale: (bs) => {
    for (const [a] of bs) { on(a, 'Left scapula'); near(a, 'processus_coracoideus', 15); }
    on(bs[0][1], 'Left humerus'); near(bs[0][1], 'tuberculum_majus', 6);
    on(bs[1][1], 'Left humerus'); near(bs[1][1], 'tuberculum_minus', 6);
  },
  lig_coracoclaviculare: (bs) => {
    const cl = box.get('Left clavicle');
    for (const [a, b] of bs) {
      on(a, 'Left scapula'); near(a, 'processus_coracoideus', 15);
      on(b, 'Left clavicle'); is(b[1] > a[1] + 0.01 && lowerHalf(b, 'Left clavicle', 0), 'zieht nach oben zur Unterseite der Clavicula');
      is(b[0] > cl.mn[0] + (cl.mx[0] - cl.mn[0]) * 0.6, 'Ansatz im lateralen Drittel der Clavicula');
    }
    is(bs[0][1][0] < bs[1][1][0], 'Lig. conoideum (Zug 1) setzt medialer an als Lig. trapezoideum (Zug 2)');
    is(bs[0][1][2] < bs[1][1][2] - 0.005, 'Tuberculum conoideum liegt weiter hinten als die Linea trapezoidea');
  },
  lig_costoclaviculare: ([[a, b]]) => {
    on(a, 'Left first costal cartilage', 'Left first rib'); on(b, 'Left clavicle');
    is(b[0] < 0.06, 'Ansatz am sternalen (medialen) Ende der Clavicula');
  },
  // ── Ellenbogen ──
  lig_collaterale_ulnare: (bs) => {
    for (const [a, b] of bs) { on(a, 'Left humerus'); near(a, 'epicondylus_medialis_humeri', 8); on(b, 'Left ulna'); }
    near(bs[0][1], 'processus_coronoideus_ulnae', 12);
    near(bs[1][1], 'olecranon', 15);
  },
  lig_collaterale_radiale: ([[a, b]]) => {
    on(a, 'Left humerus'); near(a, 'epicondylus_lateralis_humeri', 8);
    on(b, 'Left radius'); near(b, 'caput_radii', 15); is(b[0] > LM.caput_radii[0] - 0.003, 'strahlt lateral in das Lig. anulare ein');
  },
  lig_anulare_radii: (_, g) => {
    const { c, r } = g.ring;
    is(c[1] < LM.caput_radii[1] && dist(c, LM.caput_radii) < 0.015, 'Ring um das Radiusköpfchen / Collum radii');
    const d = distTo(BONES.get('Left radius'), c);
    is(d <= r && d >= r - 0.006, `Ring liegt dem Radius an (Abstand Mitte–Knochen ${mm(d)}, Ringradius ${mm(r)})`);
  },
};
function deltoUrsprung(a) {
  on(a, TI); near(a, 'malleolus_medialis', 20);
  is(a[1] < LM.malleolus_medialis[1] && a[0] < C(TA)[0], 'Ursprung an der Spitze des Malleolus medialis');
}

// ── 1) + 2) Geometrie ──
for (const l of LIGAMENTS) {
  cur = l.id;
  const g = LIG3D[l.id];
  ok(g, `${l.id}: keine 3D-Form`);
  ok(RULES[l.id], `${l.id}: keine Lehrbuchregel im Test – bitte ergänzen`);
  if (!g) continue;
  for (const [a, b] of g.bands || []) {
    for (const p of [a, b]) {
      const bb = boneAt(p);
      ok(bb.d <= 0.002, `${l.id}: Endpunkt [${p}] liegt nicht auf einem Knochen (${mm(bb.d)} von ${bb.part})`);
      ok(l.knochen.includes(bb.group), `${l.id}: Endpunkt liegt auf ${bb.part} (${bb.group}), Band gehört aber zu ${l.knochen.join(', ')}`);
    }
  }
  if (RULES[l.id]) RULES[l.id](g.bands || [], g);
}

// ── 3) Lerntexte ──
const fns = LIGAMENTS.map((l) => l.fn);
ok(new Set(fns).size === fns.length, 'Funktionstexte doppelt – die Tagesfrage „Welches Band: …?“ wäre mehrdeutig');
for (const l of LIGAMENTS.filter((x) => x.teil)) {
  const p = LIGAMENTS.find((x) => x.id === l.teil);
  ok(p && p.gelenk === l.gelenk, `${l.id}: Oberband ${l.teil} fehlt oder anderes Gelenk`);
  ok(LIG3D[l.teil] && LIG3D[l.teil].parts.includes(l.id), `${l.id}: fehlt in parts von ${l.teil}`);
  ok(l.la.includes(p ? p.la : '?'), `${l.id}: Name nennt das Oberband nicht`);
}
for (const l of LIGAMENTS) {
  for (const s of [...new Set([...l.knochen.map((id) => ({ id, kind: 'bone' })), { id: l.gelenk, kind: 'joint' }].map(JSON.stringify))].map(JSON.parse)) {
    for (const seed of ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']) {
      const q = ligamentQuestion(s, seed);
      if (!q) continue;
      const fam = LIGAMENTS.filter((x) => x.id !== q.lig.id && (x.teil === q.lig.id || q.lig.teil === x.id)).map((x) => x.la);
      ok(!q.opts.some((o) => fam.includes(o)), `Tagesfrage ${s.id}/${seed}: Oberband/Teil von ${q.lig.la} als Ablenker`);
      ok(new Set(q.opts).size === 4, `Tagesfrage ${s.id}/${seed}: Antworten doppelt`);
    }
  }
}

console.log(fail ? `${fail} von ${n} Bänder-Anatomie-Tests fehlgeschlagen` : `Alle ${n} Bänder-Anatomie-Tests bestanden`);
process.exit(fail ? 1 : 0);
