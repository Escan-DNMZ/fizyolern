// Typische Übungen aus dem Fitnessstudio pro Muskel (Namen so, wie man sie im Studio sagt).
// b = Bewegung, die der Muskel dabei hauptsächlich macht; tr = kurze türkische Erklärung.
// Nur eindeutige Zuordnungen – Muskeln ohne klare Studio-Übung fehlen bewusst.
export const UEBUNGEN = {
  gluteus_maximus: [
    { n: 'Hip Thrust', b: 'Hüftextension', tr: 'kalçayı yerden yukarı itme' },
    { n: 'Kreuzheben', b: 'Hüftextension', tr: 'yerden barı kaldırma (deadlift)' },
  ],
  gluteus_medius: [
    { n: 'Abduktorenmaschine', b: 'Hüftabduktion', tr: 'bacakları dışa açma makinesi' },
    { n: 'Kabelzug-Abduktion', b: 'Hüftabduktion', tr: 'kabloyla bacağı yana açma' },
  ],
  tensor_fasciae_latae: [
    { n: 'Seitliches Beinheben', b: 'Hüftabduktion', tr: 'yan yatarak bacağı kaldırma' },
  ],
  adductor_longus: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi' }],
  adductor_magnus: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi' }],
  gracilis: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi' }],
  iliopsoas: [{ n: 'Hängendes Knieheben', b: 'Hüftflexion', tr: 'barfiks barında asılıyken dizleri göğse çekme' }],
  biceps_femoris: [
    { n: 'Rumänisches Kreuzheben', b: 'Hüftextension', tr: 'dizler hafif bükük, kalçadan öne eğilip doğrulma' },
    { n: 'Beinbeuger', b: 'Knieflexion', tr: 'leg curl makinesi' },
  ],
  semitendinosus: [
    { n: 'Rumänisches Kreuzheben', b: 'Hüftextension', tr: 'dizler hafif bükük, kalçadan öne eğilip doğrulma' },
    { n: 'Beinbeuger', b: 'Knieflexion', tr: 'leg curl makinesi' },
  ],
  semimembranosus: [
    { n: 'Rumänisches Kreuzheben', b: 'Hüftextension', tr: 'dizler hafif bükük, kalçadan öne eğilip doğrulma' },
    { n: 'Beinbeuger', b: 'Knieflexion', tr: 'leg curl makinesi' },
  ],
  rectus_femoris: [
    { n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi' },
    { n: 'Hängendes Beinheben', b: 'Hüftflexion', tr: 'asılıyken düz bacakları kaldırma' },
  ],
  vastus_lateralis: [{ n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi' }, { n: 'Kniebeuge', b: 'Knieextension', tr: 'squat' }],
  vastus_medialis: [{ n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi' }, { n: 'Kniebeuge', b: 'Knieextension', tr: 'squat' }],
  vastus_intermedius: [{ n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi' }, { n: 'Kniebeuge', b: 'Knieextension', tr: 'squat' }],
  gastrocnemius: [{ n: 'Wadenheben stehend', b: 'Plantarflexion (Knie gestreckt)', tr: 'ayakta parmak ucuna yükselme' }],
  soleus: [{ n: 'Wadenheben sitzend', b: 'Plantarflexion (Knie gebeugt)', tr: 'oturarak parmak ucuna yükselme' }],
  tibialis_anterior: [{ n: 'Tibia Raises', b: 'Dorsalextension', tr: 'sırtı duvara dayalı, ayak uçlarını yukarı çekme' }],
  biceps_brachii: [{ n: 'Bizepscurls', b: 'Ellenbogenflexion + Supination', tr: 'dambıl/bar ile kol bükme' }],
  brachialis: [{ n: 'Hammercurls', b: 'Ellenbogenflexion', tr: 'başparmak yukarı dambıl kol bükme' }],
  brachioradialis: [{ n: 'Hammercurls', b: 'Ellenbogenflexion (Neutralstellung)', tr: 'başparmak yukarı dambıl kol bükme' }],
  triceps_brachii: [
    { n: 'Trizepsdrücken am Kabel', b: 'Ellenbogenextension', tr: 'kabloyu aşağı itme (pushdown)' },
    { n: 'Dips', b: 'Ellenbogenextension', tr: 'paralel barda dips' },
  ],
  deltoideus: [
    { n: 'Seitheben', b: 'Schulterabduktion', tr: 'dambılları yana kaldırma' },
    { n: 'Schulterdrücken', b: 'Schulterabduktion/Flexion', tr: 'omuz press' },
  ],
  pectoralis_major: [
    { n: 'Bankdrücken', b: 'Horizontale Adduktion', tr: 'bench press' },
    { n: 'Butterfly', b: 'Horizontale Adduktion', tr: 'kelebek makinesi (fly)' },
  ],
  latissimus_dorsi: [
    { n: 'Latzug', b: 'Schulteradduktion/-extension', tr: 'lat pulldown' },
    { n: 'Klimmzüge', b: 'Schulteradduktion/-extension', tr: 'barfiks' },
  ],
  teres_major: [{ n: 'Latzug', b: 'Schulteradduktion/-extension', tr: 'lat pulldown' }],
  trapezius: [
    { n: 'Shrugs', b: 'Elevation der Scapula (Pars descendens)', tr: 'omuz silkme' },
    { n: 'Face Pulls', b: 'Retraktion der Scapula (Pars transversa)', tr: 'kabloyu yüze doğru çekme' },
  ],
  rhomboidei: [{ n: 'Rudern eng', b: 'Retraktion der Scapula', tr: 'dar tutuşla kürek çekme' }],
  serratus_anterior: [{ n: 'Liegestütz plus', b: 'Protraktion der Scapula', tr: 'şınavın en üstünde kürek kemiklerini öne itme' }],
  infraspinatus: [{ n: 'Außenrotation am Kabel', b: 'Außenrotation Schulter', tr: 'kabloyla kolu dışa döndürme' }],
  teres_minor: [{ n: 'Außenrotation am Kabel', b: 'Außenrotation Schulter', tr: 'kabloyla kolu dışa döndürme' }],
  subscapularis: [{ n: 'Innenrotation am Kabel', b: 'Innenrotation Schulter', tr: 'kabloyla kolu içe döndürme' }],
  flexor_carpi_radialis: [{ n: 'Handgelenkcurls', b: 'Palmarflexion', tr: 'ön kol bankta, bileği yukarı bükme' }],
  extensor_carpi_radialis_longus: [{ n: 'Reverse Wrist Curls', b: 'Dorsalextension Hand', tr: 'avuç aşağı, bileği yukarı kaldırma' }],
  rectus_abdominis: [{ n: 'Crunches', b: 'Rumpfflexion', tr: 'mekik (crunch)' }],
  obliquus_externus: [{ n: 'Russian Twist', b: 'Rumpfrotation', tr: 'oturarak gövdeyi sağa sola çevirme' }],
  transversus_abdominis: [{ n: 'Unterarmstütz (Plank)', b: 'Rumpfstabilisation', tr: 'plank' }],
  erector_spinae: [{ n: 'Rückenstrecker (Hyperextension)', b: 'Extension der Wirbelsäule', tr: 'hiperekstansiyon sehpasında gövdeyi kaldırma' }],
  quadratus_lumborum: [{ n: 'Seitstütz', b: 'Lateralflexion stabilisieren', tr: 'yan plank' }],
};
