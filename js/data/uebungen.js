// Typische Übungen aus dem Fitnessstudio pro Muskel (Namen so, wie man sie im Studio sagt).
// b = Bewegung, die der Muskel dabei hauptsächlich macht; tr = kurze türkische Erklärung, en = kurze englische Erklärung.
// Nur eindeutige Zuordnungen – Muskeln ohne klare Studio-Übung fehlen bewusst.
export const UEBUNGEN = {
  gluteus_maximus: [
    { n: 'Hip Thrust', b: 'Hüftextension', tr: 'kalçayı yerden yukarı itme', en: 'pushing the hips up from the floor' },
    { n: 'Kreuzheben', b: 'Hüftextension', tr: 'yerden barı kaldırma (deadlift)', en: 'lifting the bar from the floor (deadlift)' },
  ],
  gluteus_medius: [
    { n: 'Abduktorenmaschine', b: 'Hüftabduktion', tr: 'bacakları dışa açma makinesi', en: 'machine for opening the legs outward' },
    { n: 'Kabelzug-Abduktion', b: 'Hüftabduktion', tr: 'kabloyla bacağı yana açma', en: 'moving the leg out to the side with a cable' },
  ],
  tensor_fasciae_latae: [
    { n: 'Seitliches Beinheben', b: 'Hüftabduktion', tr: 'yan yatarak bacağı kaldırma', en: 'lifting the leg while lying on the side' },
  ],
  gluteus_minimus: [{ n: 'Abduktorenmaschine', b: 'Hüftabduktion', tr: 'bacakları dışa açma makinesi', en: 'machine for opening the legs outward' }],
  pectineus: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi', en: 'machine for closing the legs inward' }],
  adductor_brevis: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi', en: 'machine for closing the legs inward' }],
  adductor_longus: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi', en: 'machine for closing the legs inward' }],
  adductor_magnus: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi', en: 'machine for closing the legs inward' }],
  gracilis: [{ n: 'Adduktorenmaschine', b: 'Hüftadduktion', tr: 'bacakları içe kapatma makinesi', en: 'machine for closing the legs inward' }],
  iliopsoas: [{ n: 'Hängendes Knieheben', b: 'Hüftflexion', tr: 'barfiks barında asılıyken dizleri göğse çekme', en: 'hanging from a pull-up bar and pulling the knees to the chest' }],
  biceps_femoris: [
    { n: 'Rumänisches Kreuzheben', b: 'Hüftextension', tr: 'dizler hafif bükük, kalçadan öne eğilip doğrulma', en: 'knees slightly bent, bending forward at the hips and straightening up' },
    { n: 'Beinbeuger', b: 'Knieflexion', tr: 'leg curl makinesi', en: 'leg curl machine' },
  ],
  semitendinosus: [
    { n: 'Rumänisches Kreuzheben', b: 'Hüftextension', tr: 'dizler hafif bükük, kalçadan öne eğilip doğrulma', en: 'knees slightly bent, bending forward at the hips and straightening up' },
    { n: 'Beinbeuger', b: 'Knieflexion', tr: 'leg curl makinesi', en: 'leg curl machine' },
  ],
  semimembranosus: [
    { n: 'Rumänisches Kreuzheben', b: 'Hüftextension', tr: 'dizler hafif bükük, kalçadan öne eğilip doğrulma', en: 'knees slightly bent, bending forward at the hips and straightening up' },
    { n: 'Beinbeuger', b: 'Knieflexion', tr: 'leg curl makinesi', en: 'leg curl machine' },
  ],
  rectus_femoris: [
    { n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi', en: 'leg extension machine' },
    { n: 'Hängendes Beinheben', b: 'Hüftflexion', tr: 'asılıyken düz bacakları kaldırma', en: 'lifting straight legs while hanging' },
  ],
  vastus_lateralis: [{ n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi', en: 'leg extension machine' }, { n: 'Kniebeuge', b: 'Knieextension', tr: 'squat', en: 'squat' }],
  vastus_medialis: [{ n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi', en: 'leg extension machine' }, { n: 'Kniebeuge', b: 'Knieextension', tr: 'squat', en: 'squat' }],
  vastus_intermedius: [{ n: 'Beinstrecker', b: 'Knieextension', tr: 'leg extension makinesi', en: 'leg extension machine' }, { n: 'Kniebeuge', b: 'Knieextension', tr: 'squat', en: 'squat' }],
  gastrocnemius: [{ n: 'Wadenheben stehend', b: 'Plantarflexion (Knie gestreckt)', tr: 'ayakta parmak ucuna yükselme', en: 'rising onto the toes while standing' }],
  soleus: [{ n: 'Wadenheben sitzend', b: 'Plantarflexion (Knie gebeugt)', tr: 'oturarak parmak ucuna yükselme', en: 'rising onto the toes while sitting' }],
  tibialis_anterior: [{ n: 'Tibia Raises', b: 'Dorsalextension', tr: 'sırtı duvara dayalı, ayak uçlarını yukarı çekme', en: 'back against the wall, pulling the toes up' }],
  biceps_brachii: [{ n: 'Bizepscurls', b: 'Ellenbogenflexion + Supination', tr: 'dambıl/bar ile kol bükme', en: 'arm curls with a dumbbell/bar' }],
  brachialis: [{ n: 'Hammercurls', b: 'Ellenbogenflexion', tr: 'başparmak yukarı dambıl kol bükme', en: 'dumbbell arm curls with the thumb up' }],
  brachioradialis: [{ n: 'Hammercurls', b: 'Ellenbogenflexion (Neutralstellung)', tr: 'başparmak yukarı dambıl kol bükme', en: 'dumbbell arm curls with the thumb up' }],
  triceps_brachii: [
    { n: 'Trizepsdrücken am Kabel', b: 'Ellenbogenextension', tr: 'kabloyu aşağı itme (pushdown)', en: 'pushing the cable down (pushdown)' },
    { n: 'Dips', b: 'Ellenbogenextension', tr: 'paralel barda dips', en: 'dips on parallel bars' },
  ],
  deltoideus: [
    { n: 'Seitheben', b: 'Schulterabduktion', tr: 'dambılları yana kaldırma', en: 'lifting the dumbbells to the side' },
    { n: 'Schulterdrücken', b: 'Schulterabduktion/Flexion', tr: 'omuz press', en: 'shoulder press' },
  ],
  pectoralis_major: [
    { n: 'Bankdrücken', b: 'Horizontale Adduktion', tr: 'bench press', en: 'bench press' },
    { n: 'Butterfly', b: 'Horizontale Adduktion', tr: 'kelebek makinesi (fly)', en: 'butterfly machine (fly)' },
  ],
  latissimus_dorsi: [
    { n: 'Latzug', b: 'Schulteradduktion/-extension', tr: 'lat pulldown', en: 'lat pulldown' },
    { n: 'Klimmzüge', b: 'Schulteradduktion/-extension', tr: 'barfiks', en: 'pull-ups' },
  ],
  teres_major: [{ n: 'Latzug', b: 'Schulteradduktion/-extension', tr: 'lat pulldown', en: 'lat pulldown' }],
  trapezius: [
    { n: 'Shrugs', b: 'Elevation der Scapula (Pars descendens)', tr: 'omuz silkme', en: 'shoulder shrugs' },
    { n: 'Face Pulls', b: 'Retraktion der Scapula (Pars transversa)', tr: 'kabloyu yüze doğru çekme', en: 'pulling the cable toward the face' },
  ],
  rhomboidei: [{ n: 'Rudern eng', b: 'Retraktion der Scapula', tr: 'dar tutuşla kürek çekme', en: 'rowing with a narrow grip' }],
  serratus_anterior: [{ n: 'Liegestütz plus', b: 'Protraktion der Scapula', tr: 'şınavın en üstünde kürek kemiklerini öne itme', en: 'at the top of a push-up, pushing the shoulder blades forward' }],
  infraspinatus: [{ n: 'Außenrotation am Kabel', b: 'Außenrotation Schulter', tr: 'kabloyla kolu dışa döndürme', en: 'turning the arm outward with a cable' }],
  teres_minor: [{ n: 'Außenrotation am Kabel', b: 'Außenrotation Schulter', tr: 'kabloyla kolu dışa döndürme', en: 'turning the arm outward with a cable' }],
  subscapularis: [{ n: 'Innenrotation am Kabel', b: 'Innenrotation Schulter', tr: 'kabloyla kolu içe döndürme', en: 'turning the arm inward with a cable' }],
  flexor_carpi_radialis: [{ n: 'Handgelenkcurls', b: 'Palmarflexion', tr: 'ön kol bankta, bileği yukarı bükme', en: 'forearm on the bench, bending the wrist up' }],
  extensor_carpi_radialis_longus: [{ n: 'Reverse Wrist Curls', b: 'Dorsalextension Hand', tr: 'avuç aşağı, bileği yukarı kaldırma', en: 'palm down, lifting the wrist up' }],
  rectus_abdominis: [{ n: 'Crunches', b: 'Rumpfflexion', tr: 'mekik (crunch)', en: 'sit-up (crunch)' }],
  obliquus_externus: [{ n: 'Russian Twist', b: 'Rumpfrotation', tr: 'oturarak gövdeyi sağa sola çevirme', en: 'sitting and turning the trunk right and left' }],
  transversus_abdominis: [{ n: 'Unterarmstütz (Plank)', b: 'Rumpfstabilisation', tr: 'plank', en: 'plank' }],
  erector_spinae: [{ n: 'Rückenstrecker (Hyperextension)', b: 'Extension der Wirbelsäule', tr: 'hiperekstansiyon sehpasında gövdeyi kaldırma', en: 'lifting the trunk on a hyperextension bench' }],
  quadratus_lumborum: [{ n: 'Seitstütz', b: 'Lateralflexion stabilisieren', tr: 'yan plank', en: 'side plank' }],
};
