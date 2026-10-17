// Bewegungsachsen der Gelenke (Neutral-Null-Stellung, aufrechter Stand).
// v = Richtung im 3D-Modell (x = links–rechts, y = oben–unten, z = vorne–hinten)
export const AXIS_DEF = {
  t: { la: 'Transversalachse', tr: 'enine eksen (sağ–sol)', ebene: 'Sagittalebene', v: [1, 0, 0], color: '#ef4444' },
  s: { la: 'Sagittalachse', tr: 'ön–arka eksen', ebene: 'Frontalebene', v: [0, 0, 1], color: '#16a34a' },
  l: { la: 'Longitudinalachse', tr: 'uzun (dikey) eksen', ebene: 'Transversalebene', v: [0, 1, 0], color: '#2563eb' },
};

// Pro Gelenk: welche Achsen es hat und welche Bewegung um die Achse stattfindet
export const JOINT_AXES = {
  art_humeri: { t: 'Anteversion / Retroversion', s: 'Abduktion / Adduktion', l: 'Außenrotation / Innenrotation' },
  art_coxae: { t: 'Flexion / Extension', s: 'Abduktion / Adduktion', l: 'Außenrotation / Innenrotation' },
  art_sternoclavicularis: { s: 'Elevation / Depression', l: 'Protraktion / Retraktion', t: 'Rotation der Clavicula um ihre Längsachse' },
  art_cubiti: { t: 'Flexion / Extension', l: 'Pronation / Supination (Unterarm)' },
  art_radiocarpalis: { t: 'Palmarflexion / Dorsalextension', s: 'Radialabduktion / Ulnarabduktion' },
  art_genus: { t: 'Flexion / Extension', l: 'Innenrotation / Außenrotation (nur in Flexion)' },
  art_talocruralis: { t: 'Dorsalextension / Plantarflexion' },
  art_subtalaris: { s: 'Inversion / Eversion (Achse verläuft schräg)' },
  art_atlantooccipitalis: { t: 'Flexion / Extension (Nicken)', s: 'Lateralflexion' },
  art_temporomandibularis: { t: 'Mundöffnung / Mundschluss' },
};

export const axesOf = (jointId) => Object.entries(JOINT_AXES[jointId] || {}).map(([k, mv]) => ({ k, mv, ...AXIS_DEF[k] }));
