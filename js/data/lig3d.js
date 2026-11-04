// Bänder als kleine 3D-Bänder zwischen zwei Knochenpunkten (Ursprung → Ansatz).
// Punkte wie in landmarks.js: linke Körperseite, App-Koordinaten (Meter), einmalig am Modell bestimmt
// (Vorschlag aus Lehrbuch-Lage, dann auf den nächsten Mesh-Eckpunkt des jeweiligen Knochens gesetzt).
// Mehrere Paare = mehrere Züge (z. B. Y-Form des Lig. iliofemorale, Fächer des Lig. deltoideum).
// w = Dicke in m (Standard 0.0022).

export const LIG3D = {
  lig_iliofemorale: { w: 0.0035, bands: [[[0.1066, 0.9133, 0.0298], [0.1339, 0.8606, 0.0107]], [[0.1029, 0.9116, 0.0297], [0.1006, 0.8245, 0.0039]]] },
  lig_pubofemorale: { bands: [[[0.0606, 0.8863, 0.0325], [0.0948, 0.8306, -0.0029]]] },
  lig_ischiofemorale: { bands: [[[0.08, 0.8649, -0.0325], [0.1213, 0.8676, -0.0093]]] },
  lig_capitis_femoris: { w: 0.0025, bands: [[[0.0641, 0.8786, 0.0006], [0.0533, 0.8784, -0.0001]]] },
  lig_sacrotuberale: { w: 0.003, bands: [[[0.0305, 0.9059, -0.0606], [0.0433, 0.8302, -0.0399]], [[0.0422, 0.9644, -0.0738], [0.0433, 0.8302, -0.0399]]] },
  lig_sacrospinale: { bands: [[[0.0146, 0.8731, -0.0688], [0.0456, 0.887, -0.044]]] },
  lig_cruciatum_anterius: { w: 0.0025, bands: [[[0.0818, 0.4528, -0.0131], [0.07, 0.4407, 0.0096]]] },
  lig_cruciatum_posterius: { w: 0.0028, bands: [[[0.0666, 0.4494, -0.0016], [0.071, 0.4281, -0.0206]]] },
  lig_collaterale_tibiale: { w: 0.003, bands: [[[0.032, 0.4737, -0.008], [0.0608, 0.376, 0.0063]]] },
  lig_collaterale_fibulare: { bands: [[[0.1126, 0.4651, -0.0012], [0.1191, 0.4166, -0.0135]]] },
  lig_patellae: { w: 0.0035, bands: [[[0.0836, 0.4315, 0.0299], [0.0868, 0.4093, 0.0345]]] },
  lig_talofibulare_anterius: { bands: [[[0.096, 0.063, -0.0054], [0.0872, 0.0562, 0.0131]]] },
  lig_calcaneofibulare: { bands: [[[0.0976, 0.0448, -0.0237], [0.0852, 0.0243, -0.0298]]] },
  lig_talofibulare_posterius: { bands: [[[0.0891, 0.0676, -0.0297], [0.0672, 0.05, -0.0312]]] },
  // Lig. deltoideum = seine vier Teile (gemeinsamer Ursprung: Spitze des Malleolus medialis)
  lig_deltoideum: { parts: ['lig_deltoideum_tibionavicularis', 'lig_deltoideum_tibiocalcanea', 'lig_deltoideum_tibiotalaris_anterior', 'lig_deltoideum_tibiotalaris_posterior'] },
  lig_deltoideum_tibionavicularis: { w: 0.0018, bands: [[[0.0552, 0.0639, 0.0056], [0.0579, 0.0455, 0.028]]] },
  lig_deltoideum_tibiocalcanea: { w: 0.0022, bands: [[[0.0552, 0.0639, 0.0056], [0.0548, 0.0434, -0.0046]]] },
  lig_deltoideum_tibiotalaris_anterior: { w: 0.0018, bands: [[[0.0552, 0.0639, 0.0056], [0.0607, 0.0565, 0.02]]] },
  lig_deltoideum_tibiotalaris_posterior: { w: 0.0025, bands: [[[0.0552, 0.0639, 0.0056], [0.0553, 0.0486, -0.0199]]] },
  lig_tibiofibulare: { bands: [[[0.085, 0.0738, 0.0082], [0.1006, 0.0709, -0.0087]], [[0.0823, 0.0736, -0.0207], [0.0996, 0.0665, -0.0291]]] },
  lig_talocalcaneum_interosseum: { w: 0.003, bands: [[[0.0796, 0.0476, 0.0124], [0.0811, 0.0362, 0.0109]]] },
  lig_calcaneonaviculare_plantare: { w: 0.003, bands: [[[0.0572, 0.0402, 0.0018], [0.0641, 0.0403, 0.0299]]] },
  lig_bifurcatum: { w: 0.0018, bands: [[[0.0855, 0.0462, 0.0086], [0.0961, 0.0523, 0.0235]], [[0.0855, 0.0462, 0.0086], [0.0919, 0.0456, 0.0149]]] },
  lig_plantare_longum: { bands: [[[0.0769, 0.0092, -0.0275], [0.0986, 0.0207, 0.0167]], [[0.0769, 0.0092, -0.0275], [0.1025, 0.0274, 0.042]]] },
  lig_coracohumerale: { bands: [[[0.1385, 1.3954, 0.018], [0.1865, 1.3995, -0.0022]], [[0.1385, 1.3954, 0.018], [0.1642, 1.3848, 0.02]]] },
  lig_coracoclaviculare: { bands: [[[0.1252, 1.4001, 0.0146], [0.1126, 1.4138, -0.0216]], [[0.1288, 1.4001, 0.0178], [0.1373, 1.4157, -0.0112]]] }, // conoideum, trapezoideum
  lig_collaterale_ulnare: { bands: [[[0.1777, 1.1184, -0.0118], [0.2062, 1.0967, -0.0002]], [[0.1777, 1.1184, -0.0118], [0.2065, 1.1146, -0.0202]]] },
  lig_collaterale_radiale: { bands: [[[0.2408, 1.1235, -0.0183], [0.2394, 1.0944, -0.0052]]] },
  lig_costoclaviculare: { w: 0.003, bands: [[[0.0408, 1.3864, 0.0514], [0.0336, 1.3927, 0.0527]]] },
  // Ring um das Collum radii (Mitte, Radius, Achse ≈ Längsachse des Radius)
  lig_anulare_radii: { ring: { c: [0.2301, 1.0925, -0.0073], r: 0.0118, axis: [0.18, -1, 0.1] } },
};
