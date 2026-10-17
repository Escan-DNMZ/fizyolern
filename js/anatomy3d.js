// Interaktives 3D-Anatomiemodell (schematisch) mit Three.js
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { BONES, MUSCLES, JOINTS } from './data/anatomy.js';
import { MUSCLE3D, partNames } from './data/muscle3d.js';
import { LANDMARKS, findLandmark, landmarksOf, shortLa } from './data/landmarks.js';
import { axesOf } from './data/axes.js';

const V = (p, sx = 1) => new THREE.Vector3(p[0] * sx, p[1], p[2]);

// Passt schematische Muskel- und Gelenkpunkte an das echte BodyParts3D-Skelett an:
// dort stehen die Beine enger zusammen und das Knie liegt etwas tiefer.
function warp([x, y, z]) {
  if (y >= 0.9 || x <= 0.03) return [x, y, z];
  if (y <= 0.49) return [x - 0.03, 0.06 + ((y - 0.075) * (0.445 - 0.06)) / (0.49 - 0.075), z];
  const t = (0.9 - y) / (0.9 - 0.49);
  return [x - 0.03 * t, 0.88 - t * (0.88 - 0.445), z];
}

const COLORS = {
  bone: 0xe8dcc2,
  muscle: 0xb8383b,
  tendon: 0xe9e2d0,
  joint: 0x3b82f6,
  highlight: 0xffc83d,
};

// Linke Körperseite (x > 0) bzw. Mittellinie
function isLeftMesh(m) {
  const p = m.userData.part || '';
  if (/\bright\b/i.test(p)) return false;
  if (/\bleft\b/i.test(p)) return true;
  if (!m.userData.real) return new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).x >= -0.005; // gespiegelte Teile: nur links
  return true; // Mittellinie (z. B. Zwerchfell, Wirbel)
}
const boxOf = (meshes) => meshes.reduce((b, m) => b.union(new THREE.Box3().setFromObject(m)), new THREE.Box3());
const cloneMesh = (m, mat, data) => {
  const c = new THREE.Mesh(m.geometry, mat);
  c.matrixAutoUpdate = false;
  c.matrix.copy(m.matrixWorld);
  c.userData = data || {};
  return c;
};
const MULTI = [0xe4572e, 0x2563eb, 0x16a34a, 0xa259ff, 0xf3a712, 0xff6fb5, 0x0ea5e9, 0x8d6e63, 0x84cc16, 0x9333ea];

// Spindelförmiger Muskelbauch entlang der y-Achse, Länge 1, Radius 1
function spindleGeometry() {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * t), 0.8);
    pts.push(new THREE.Vector2(r, t - 0.5));
  }
  return new THREE.LatheGeometry(pts, 18);
}
const SPINDLE = spindleGeometry();

// Ausrichtung entlang a→b mit optionaler „Flachrichtung“ n
function orient(mesh, a, b, n) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const y = dir.clone().normalize();
  let z = n ? n.clone().normalize() : new THREE.Vector3(0, 0, 1);
  z.sub(y.clone().multiplyScalar(z.dot(y)));
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(1, 0, 0).sub(y.clone().multiplyScalar(y.x));
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  return len;
}

function capsule(a, b, r) {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 6, 14);
  const m = new THREE.Mesh(g);
  orient(m, a, b);
  return m;
}

function prism(pts, depth) {
  // Dreieck mit Dicke (für die Scapula)
  const [p1, p2, p3] = pts;
  const nrm = new THREE.Vector3().subVectors(p2, p1).cross(new THREE.Vector3().subVectors(p3, p1)).normalize().multiplyScalar(depth / 2);
  const f = [p1, p2, p3].map((p) => p.clone().add(nrm));
  const k = [p1, p2, p3].map((p) => p.clone().sub(nrm));
  const tris = [
    [f[0], f[1], f[2]], [k[2], k[1], k[0]],
    [f[0], k[0], k[1]], [f[0], k[1], f[1]],
    [f[1], k[1], k[2]], [f[1], k[2], f[2]],
    [f[2], k[2], k[0]], [f[2], k[0], f[0]],
  ];
  const pos = [];
  tris.forEach((t) => t.forEach((v) => pos.push(v.x, v.y, v.z)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g);
}

function ribs(sx) {
  const group = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const y = 1.405 - t * 0.27;
    const w = 0.07 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 0.075 - Math.max(0, t - 0.75) * 0.08;
    const d = 0.075 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 0.045;
    const reach = i < 7 ? 1 : i < 10 ? 0.85 : 0.45; // echte / falsche / freie Rippen
    const pts = [];
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * reach;
      // Von hinten (Wirbelsäule) über die Seite nach vorne, vorne tiefer
      const x = Math.sin(a) * w + 0.02;
      const z = -Math.cos(a) * d * 0.9 + 0.012;
      const yy = y - (1 - Math.cos(a)) * 0.04;
      pts.push(new THREE.Vector3(x * sx, yy, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    group.push(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0055, 6, false)));
  }
  return group;
}

function primitive(p, sx) {
  switch (p.t) {
    case 'cap': return [capsule(V(p.a, sx), V(p.b, sx), p.r)];
    case 'sph': {
      const m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 20, 14));
      m.position.copy(V(p.c, sx));
      return [m];
    }
    case 'ell': {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16));
      m.scale.set(...p.s);
      m.position.copy(V(p.c, sx));
      m.rotation.set(p.rx || 0, (p.ry || 0) * sx, 0);
      return [m];
    }
    case 'box': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...p.s));
      m.position.copy(V(p.c, sx));
      m.rotation.set(p.rx || 0, 0, 0);
      return [m];
    }
    case 'stack': {
      const out = [];
      const h = (p.y1 - p.y0) / p.n;
      for (let i = 0; i < p.n; i++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, h * 0.72, 14));
        m.position.set(0, p.y0 + h * (i + 0.5), p.z);
        out.push(m);
        const sp = new THREE.Mesh(new THREE.BoxGeometry(p.r * 0.5, h * 0.5, p.r * 1.4));
        sp.position.set(0, p.y0 + h * (i + 0.5), p.z - p.r * 1.4);
        out.push(sp);
      }
      return out;
    }
    case 'ribs': return ribs(sx);
    case 'tri': return [prism(p.p.map((q) => V(q, sx)), p.d)];
    case 'dome': {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2));
      m.scale.set(...p.s);
      m.position.copy(V(p.c, sx));
      return [m];
    }
    default: {
      // Muskelteil
      const a = V(warp(p.a), sx);
      const b = V(warp(p.b), sx);
      const m = new THREE.Mesh(SPINDLE);
      const len = orient(m, a, b, p.n ? V(p.n, sx) : null);
      m.scale.set(p.r, len, p.r * (p.f || 1));
      m.userData.tendon = p.r <= 0.007;
      return [m];
    }
  }
}

// Muskeln, die es in BodyParts3D nicht gibt: werden als dünne Muskelplatten zwischen
// Messpunkten am echten Skelett aufgebaut (siehe buildSheetMuscles).
// Dünne Platte (Muskel als Schicht) aus Querschnitt-Reihen: rows[i][j] = Punkt
function slab(rows, thick) {
  const R = rows.length, C = rows[0].length;
  const pos = [], idx = [];
  const front = rows.flat();
  // Flächennormalen grob über Nachbarn bestimmen, Rückseite um „thick“ nach innen versetzen
  const nAt = (i, j) => {
    const a = rows[Math.min(i + 1, R - 1)][j].clone().sub(rows[Math.max(i - 1, 0)][j]);
    const b = rows[i][Math.min(j + 1, C - 1)].clone().sub(rows[i][Math.max(j - 1, 0)]);
    return new THREE.Vector3().crossVectors(a, b).normalize();
  };
  const back = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) back.push(rows[i][j].clone().addScaledVector(nAt(i, j), -thick));
  [...front, ...back].forEach((v) => pos.push(v.x, v.y, v.z));
  const F = 0, B = R * C, at = (i, j) => i * C + j;
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < C - 1; j++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      idx.push(F + a, F + b, F + c, F + a, F + c, F + d);
      idx.push(B + a, B + c, B + b, B + a, B + d, B + c);
    }
  }
  const edge = (list) => {
    for (let k = 0; k < list.length - 1; k++) {
      const p = list[k], q = list[k + 1];
      idx.push(F + p, B + p, B + q, F + p, B + q, F + q);
    }
  };
  edge([...Array(C).keys()].map((j) => at(0, j)));
  edge([...Array(C).keys()].map((j) => at(R - 1, j)).reverse());
  edge([...Array(R).keys()].map((i) => at(i, 0)).reverse());
  edge([...Array(R).keys()].map((i) => at(i, C - 1)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const bez = (a, c, b, t) => a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(c, 2 * (1 - t) * t).addScaledVector(b, t * t);

export class Anatomy3D {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect || (() => {});
    this.meshes = []; // alle auswählbaren Meshes
    this.byId = new Map();
    this.layers = { bone: true, muscle: true, joint: false };
    this.muscleOpacity = 1;
    this.isolated = false;
    this.selected = null;
    this.running = false;

    const w = container.clientWidth || 360;
    const h = container.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 50);
    this.camera.position.set(0, 0.98, 3.5);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(1.5, 2.5, 2.5);
    this.scene.add(key);
    const back = new THREE.DirectionalLight(0xffffff, 0.8);
    back.position.set(-1.5, 1.5, -2.5);
    this.scene.add(back);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.98, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 5;
    this.controls.update();

    this.goal = null; // Kamerafahrt-Ziel
    this.depth = 1; // 1 = alle Muskeln, 2 = ab mittlerer Schicht, 3 = nur tiefe Muskeln
    this.focus = null; // aktiver Fokusmodus
    this.labels = [];
    this.onPart = () => {};
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'labels3d';
    container.appendChild(this.labelLayer);
    this.alias = {}; // Struktur-ID -> ID der Gruppe, deren echtes Mesh sie mitdarstellt
    this.onLandmark = () => {};
    this.showLm = false; // Knochenpunkte in der Gesamtansicht
    this.lmRoot = null;

    this.build();
    this.bindPicking();
    if (location.hostname === 'localhost') window.__anat = this; // nur zum Debuggen auf dem eigenen Rechner
    this.ready = this.loadRealModels().catch((e) => console.warn('Echte 3D-Modelle nicht geladen, schematisches Modell bleibt:', e));

    new ResizeObserver(() => this.resize()).observe(container);
  }

  // Ersetzt schematische Teile durch die echten Modelle (BodyParts3D, DBCLS, CC BY 4.0)
  async loadRealModels() {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('../vendor/GLTFLoader.js'),
      import('../vendor/DRACOLoader.js'),
    ]);
    const draco = new DRACOLoader().setDecoderPath(new URL('../vendor/draco/', import.meta.url).href);
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const base = new URL('../models/', import.meta.url).href;
    const [bones, muscles] = await Promise.all([
      loader.loadAsync(base + 'bones.glb'),
      loader.loadAsync(base + 'muscles.glb'),
    ]);
    // Mesh-Namen: „<struktur-id>|<BodyParts3D-Name>“ (tools/build_bp3d.py)
    const idsFor = (n) => [n.split('|')[0]];
    this.useReal(bones.scene, idsFor);
    this.useReal(muscles.scene, idsFor);
    this.buildSheetMuscles();
    this.placeJoints();
    draco.dispose();
    this.applyVisibility();
    if (this.selected) this.select(this.selected, { silent: true });
  }

  useReal(scene, idsFor) {
    // BodyParts3D: Millimeter, z = oben, vorne = -y; rechte Körperhälfte bei x < 0.
    // → Meter, y = oben, vorne = +z; leicht verschoben, damit Gelenkmarker und Muskelplatten passen.
    const T = new THREE.Matrix4().makeTranslation(0, 0.07, -0.08)
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
      .multiply(new THREE.Matrix4().makeScale(0.001, 0.001, 0.001));
    scene.updateMatrixWorld(true);
    const list = [];
    scene.traverse((o) => { if (o.isMesh) list.push(o); });
    const cleared = new Set();
    const clear = (id) => {
      if (cleared.has(id)) return;
      cleared.add(id);
      const g = this.byId.get(id);
      if (!g) return;
      for (const m of [...g.children]) {
        g.remove(m);
        this.meshes.splice(this.meshes.indexOf(m), 1);
      }
    };
    for (const src of list) {
      const ids = idsFor(src.name);
      if (!ids) continue;
      const [primary, ...others] = ids;
      const group = this.byId.get(primary);
      if (!group) continue;
      clear(primary);
      others.forEach((id) => { clear(id); this.alias[id] = primary; });
      const geo = src.geometry.clone().applyMatrix4(T.clone().multiply(src.matrixWorld));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.computeBoundingBox();
      // Beide Körperseiten sind eigene Modelle – nicht spiegeln
      const m = new THREE.Mesh(geo, group.userData.mats[0]);
      m.userData = { id: primary, kind: group.userData.kind, real: true, part: (src.name.split('|')[1] || '').replace(/_/g, ' ') }; // GLTFLoader macht aus Leerzeichen „_“
      group.add(m);
      this.meshes.push(m);
    }
  }

  // Punkte eines echten Knochenteils (Weltkoordinaten), optional gefiltert
  partVerts(part, filter = () => true) {
    const out = [];
    const v = new THREE.Vector3();
    for (const m of this.meshes) {
      if (m.userData.part !== part) continue;
      const a = m.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld);
        if (filter(v)) out.push(v.clone());
      }
    }
    return out;
  }

  extreme(part, key, sign = 1) {
    const vs = this.partVerts(part);
    if (!vs.length) return null;
    return vs.reduce((best, v) => (v[key] * sign > best[key] * sign ? v : best));
  }

  // Gelenkmarker auf die echten Knochen setzen (Mittelpunkt der jeweiligen Gelenkflächen)
  placeJoints() {
    const centroid = (vs) => (vs.length ? vs.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / vs.length) : null);
    const region = (part, axis, side, depth) => {
      const vs = this.partVerts(part);
      if (!vs.length) return [];
      const ext = vs.reduce((m, v) => (side > 0 ? Math.max(m, v[axis]) : Math.min(m, v[axis])), side > 0 ? -1e9 : 1e9);
      return vs.filter((v) => (side > 0 ? v[axis] > ext - depth : v[axis] < ext + depth));
    };
    const mid = (a, b) => (a && b ? a.clone().add(b).multiplyScalar(0.5) : a || b);
    const L = (n) => 'Left ' + n;

    const pos = {
      art_humeri: (() => { const c = centroid(region(L('humerus'), 'y', 1, 0.03)); return c && c.add(new THREE.Vector3(-0.008, -0.004, 0)); })(),
      art_acromioclavicularis: centroid(region(L('clavicle'), 'x', 1, 0.008)),
      art_sternoclavicularis: centroid(region(L('clavicle'), 'x', -1, 0.008)),
      art_cubiti: mid(centroid(region(L('humerus'), 'y', -1, 0.02)), centroid(region(L('ulna'), 'y', 1, 0.02))),
      art_radiocarpalis: (() => { const c = centroid(region(L('radius'), 'y', -1, 0.012)); return c && c.add(new THREE.Vector3(0, -0.006, 0)); })(),
      art_coxae: centroid(region(L('femur'), 'y', 1, 0.035).filter((v, _, all) => v.x < Math.min(...all.map((w) => w.x)) + 0.045)),
      art_sacroiliaca: centroid(region('Sacrum', 'x', 1, 0.012)),
      art_genus: mid(centroid(region(L('femur'), 'y', -1, 0.02)), centroid(region(L('tibia'), 'y', 1, 0.02))),
      art_talocruralis: centroid(region(L('talus'), 'y', 1, 0.01)),
      art_subtalaris: centroid(region(L('talus'), 'y', -1, 0.01)),
      art_atlantooccipitalis: (() => { const c = centroid(region('Atlas', 'y', 1, 0.008)); return c && c.setX(0); })(),
      art_temporomandibularis: centroid(region('Mandible', 'y', 1, 0.015).filter((v) => v.x > 0)),
    };
    for (const [id, p] of Object.entries(pos)) {
      const g = this.byId.get(id);
      if (!g || !p) continue;
      g.children.forEach((m, k) => m.position.set(k === 0 ? p.x : -p.x, p.y, p.z));
    }
  }

  // Die vier Muskeln ohne BodyParts3D-Modell als Platten zwischen echten Knochenpunkten aufbauen
  buildSheetMuscles() {
    this.scene.updateMatrixWorld(true);
    const L = (n) => 'Left ' + n; // linke Körperhälfte liegt bei x > 0
    const hip = this.partVerts(L('hip bone'));
    const rib12 = this.partVerts(L('twelfth rib'));
    const hum = this.partVerts(L('humerus'));
    if (!hip.length || !rib12.length || !hum.length) return; // Modelle unvollständig → Schema bleibt

    const maxBy = (vs, f) => vs.reduce((b, v) => (f(v) > f(b) ? v : b));
    const minBy = (vs, f) => vs.reduce((b, v) => (f(v) < f(b) ? v : b));
    const lerp = THREE.MathUtils.lerp;
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

    const pubis = maxBy(hip.filter((v) => v.x < 0.03), (v) => v.y);                 // Oberrand der Symphyse
    const crestTop = maxBy(hip, (v) => v.y);                                           // höchster Punkt des Beckenkamms
    const crestBack = minBy(hip.filter((v) => v.y > crestTop.y - 0.04), (v) => v.z);   // hinterer Beckenkamm
    const xiph = this.extreme('Xiphoid process', 'y', -1) || V3(0, 1.17, 0.12);
    const cc5 = this.extreme(L('fifth costal cartilage'), 'z', 1) || xiph.clone().add(V3(0.06, 0.03, 0));
    const cc7 = this.extreme(L('seventh costal cartilage'), 'y', -1) || xiph.clone().add(V3(0.08, -0.03, 0));
    const rib12Tip = maxBy(rib12, (v) => v.x);
    const rib12Med = minBy(rib12, (v) => v.x);
    const spine = (n) => this.extreme(n, 'z', -1); // Dornfortsatzspitze (am weitesten hinten)
    const T7 = spine('Seventh thoracic vertebra'), L1 = spine('First lumbar vertebra');
    const L3 = spine('Third lumbar vertebra'), L5 = spine('Fifth lumbar vertebra');
    const humTop = maxBy(hum, (v) => v.y);
    // Crista tuberculi minoris: vorne-medial, 4–9 cm unter dem Humeruskopf
    const humInsert = maxBy(hum.filter((v) => v.y > humTop.y - 0.09 && v.y < humTop.y - 0.04), (v) => v.z - v.x * 0.5);
    const L3body = this.partVerts('Third lumbar vertebra');
    const L3mid = L3body.length ? L3body.reduce((a, v) => a + v.z, 0) / L3body.length : -0.02;
    const costalZ = Math.max(cc5.z, cc7.z);

    const sheets = {};

    // M. rectus abdominis: Crista pubica/Symphyse → Rippenknorpel 5–7 und Proc. xiphoideus, Bauchwand leicht gewölbt
    {
      const rows = [];
      const yTop = (cc5.y + cc7.y) / 2;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const y = lerp(pubis.y + 0.005, yTop, t);
        const zLine = lerp(pubis.z + 0.012, costalZ + 0.006, t) + Math.sin(Math.PI * t) * 0.03;
        const w = lerp(0.03, Math.max(0.06, cc7.x - 0.01), t);
        const row = [];
        for (let j = 0; j <= 4; j++) {
          const u = j / 4;
          row.push(V3(0.008 + w * u, y, zLine - u * u * 0.02));
        }
        rows.push(row);
      }
      sheets.rectus_abdominis = slab(rows, 0.008);
    }

    // M. transversus abdominis: tiefe Schicht um die Taille, von der Fascia thoracolumbalis bis zur Linea alba
    {
      const rows = [];
      const yLow = crestTop.y - 0.01, yHigh = cc7.y - 0.01;
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const y = lerp(yLow, yHigh, t);
        const front = lerp(pubis.z, costalZ - 0.01, t) + Math.sin(Math.PI * t) * 0.018;
        const zc = (front + L3mid) / 2 - 0.005, rz = (front - L3mid) / 2 + 0.004;
        const rx = 0.115 + Math.sin(Math.PI * t) * 0.01;
        const row = [];
        for (let j = 0; j <= 10; j++) {
          const a = (j / 10) * Math.PI * 0.95; // von hinten (0) über die Flanke nach vorne
          row.push(V3(0.06 + Math.sin(a) * (rx - 0.06) - (j / 10) ** 3 * 0.045, y, zc - Math.cos(a) * rz));
        }
        rows.push(row);
      }
      sheets.transversus_abdominis = slab(rows, 0.005);
    }

    // M. latissimus dorsi: Fächer von den Dornfortsätzen T7–L5 und dem hinteren Beckenkamm zur Crista tuberculi minoris
    if (T7 && L1 && L3 && L5) {
      const origins = [T7, L1, L3, L5, crestBack].map((v) => v.clone().add(V3(0.004, 0, -0.006)));
      const rows = [];
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        rows.push(origins.map((o, k) => bez(o, V3(0.15, lerp(o.y, humInsert.y, 0.45), -0.085 + k * 0.004), humInsert, s)));
      }
      sheets.latissimus_dorsi = slab(rows, 0.006);
    }

    // M. quadratus lumborum: Beckenkamm → 12. Rippe und Querfortsätze L1–L4
    {
      const zq = L3mid - 0.012, yMid = (crestTop.y + rib12Med.y) / 2;
      const rows = [
        [V3(0.035, crestTop.y - 0.015, zq), V3(0.065, crestTop.y - 0.01, zq), V3(0.095, crestTop.y - 0.005, zq - 0.005)],
        [V3(0.032, yMid, zq), V3(0.055, yMid, zq), V3(0.08, yMid + 0.01, zq - 0.004)],
        [V3(0.03, rib12Med.y, zq), V3(0.045, rib12Med.y + 0.005, zq), V3(Math.min(rib12Tip.x, 0.07), rib12Med.y - 0.005, zq - 0.004)],
      ];
      sheets.quadratus_lumborum = slab(rows, 0.012);
    }

    for (const [id, geo] of Object.entries(sheets)) {
      const g = this.byId.get(id);
      if (!g) continue;
      for (const m of [...g.children]) { g.remove(m); this.meshes.splice(this.meshes.indexOf(m), 1); }
      for (const sx of [1, -1]) { // Platten für links bauen und für rechts spiegeln
        const m = new THREE.Mesh(geo, g.userData.mats[0]);
        m.scale.x = sx;
        m.userData = { id, kind: 'muscle', real: false };
        g.add(m);
        this.meshes.push(m);
      }
    }
  }

  build() {
    const add = (s, kind) => {
      const group = new THREE.Group();
      group.userData = { id: s.id, kind };
      const sides = s.mid ? [1] : [1, -1];
      const baseColor = COLORS[kind];
      const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: kind === 'bone' ? 0.65 : 0.5, metalness: 0.0 });
      const tendonMat = new THREE.MeshStandardMaterial({ color: COLORS.tendon, roughness: 0.4 });
      if (kind === 'joint') { mat.transparent = true; mat.opacity = 0.6; }
      const parts = kind === 'joint' ? [{ t: 'sph', c: warp(s.c), r: s.r }] : s.g;
      for (const sx of sides) {
        for (const p of parts) {
          for (const m of primitive(p, sx)) {
            m.material = m.userData.tendon ? tendonMat : mat;
            m.userData.id = s.id;
            m.userData.kind = kind;
            group.add(m);
            this.meshes.push(m);
          }
        }
      }
      group.userData.mats = [mat, tendonMat];
      this.byId.set(s.id, group);
      this.scene.add(group);
    };
    BONES.forEach((b) => add(b, 'bone'));
    MUSCLES.forEach((m) => add(m, 'muscle'));
    JOINTS.forEach((j) => add(j, 'joint'));
    this.applyVisibility();
  }

  applyVisibility() {
    const sel = this.alias[this.selected] || this.selected;
    if (this.lmRoot) this.lmRoot.visible = this.showLm && !this.focus;
    for (const [id, g] of this.byId) {
      const kind = g.userData.kind;
      if (this.focus) { g.visible = false; continue; } // im Fokusmodus zeigt nur focus.root etwas
      let vis = this.layers[kind];
      if (kind === 'muscle' && ((MUSCLE3D[id] || {}).layer || 1) < this.depth && id !== sel) vis = false;
      if (kind === 'muscle' && this.muscleOpacity <= 0.02) vis = false;
      if (this.isolated && sel) vis = id === sel || (kind === 'bone' && this.layers.bone);
      if (this.isolated && sel && id === sel) vis = true;
      g.visible = vis;
      const [mat, tendonMat] = g.userData.mats;
      if (kind === 'muscle') {
        const op = id === sel ? 1 : this.muscleOpacity;
        for (const m of [mat, tendonMat]) {
          m.transparent = op < 1;
          m.opacity = op;
          m.depthWrite = op >= 1;
        }
      }
      if (kind === 'bone' && this.isolated && sel && id !== sel) {
        mat.transparent = true; mat.opacity = 0.35; mat.depthWrite = false;
      } else if (kind === 'bone') {
        mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
      }
    }
  }

  setLayer(kind, on) { this.layers[kind] = on; this.applyVisibility(); }
  setMuscleOpacity(v) { this.muscleOpacity = v; this.applyVisibility(); }
  setIsolated(on) { this.isolated = on; this.applyVisibility(); }

  select(id, { focus = true, silent = false } = {}) {
    if (this.selected) {
      const prev = this.byId.get(this.alias[this.selected] || this.selected);
      if (prev) prev.userData.mats.forEach((m) => m.emissive.setHex(0x000000));
    }
    this.selected = id;
    const g = id && this.byId.get(this.alias[id] || id);
    if (g) {
      // Ebene einblenden, falls ausgeblendet
      if (!this.layers[g.userData.kind]) this.layers[g.userData.kind] = true;
      g.userData.mats.forEach((m) => m.emissive.setHex(0x8a5a00));
      if (focus) this.focusOn(g);
    }
    this.applyVisibility();
    if (!silent) this.onSelect(id);
  }

  focusOn(group) {
    // Bei paarigen Strukturen die linke Körperseite (x>0) fokussieren
    const box = new THREE.Box3();
    group.children.forEach((m) => {
      const b = new THREE.Box3().setFromObject(m);
      if (b.getCenter(new THREE.Vector3()).x >= -0.001 || group.children.length < 2) box.union(b);
    });
    if (box.isEmpty()) box.setFromObject(group);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * 2.6, 0.45, 2.6);
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    this.goal = { target: c, pos: c.clone().add(dir.multiplyScalar(dist)) };
  }

  // ───── Schichten (oberflächlich → tief) ─────
  setDepth(n) { this.depth = n; this.applyVisibility(); }

  // ───── Fokusansichten (Muskel, Knochen, Gelenk, Knochenpunkt, mehrere Strukturen) ─────
  _kit() {
    this.exitFocus();
    this.scene.updateMatrixWorld(true);
    const mats = [];
    return { root: new THREE.Group(), mats, labels: [], mat: (o) => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; } };
  }

  _leftMeshes(id) {
    const g = this.byId.get(this.alias[id] || id);
    if (!g) return [];
    if (g.userData.kind === 'joint') return g.children.slice(0, 1);
    return g.children.filter(isLeftMesh);
  }

  // Punkt mit Beschriftung; pick = Landmark-ID (zum Antippen)
  _dot(kit, pos, color, text, cls, pick = null, r = 0.007) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    s.renderOrder = 10;
    s.position.copy(pos);
    s.userData = { own: true, landmark: pick };
    kit.root.add(s);
    if (pick) { // größere, unsichtbare Trefferfläche für den Finger
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.copy(pos);
      hit.userData = { own: true, landmark: pick };
      kit.root.add(hit);
    }
    if (text) kit.labels.push(this.addLabel(text, pos, cls));
    return s;
  }

  // Knochen in der Nähe blass, „solid“-Knochen kräftig; skip = schon gezeigte Meshes
  _contextBones(kit, box, solid = () => false, skip = new Set(), pad = 0.15) {
    const attachMat = kit.mat({ color: COLORS.bone, roughness: 0.65 });
    const ghostMat = kit.mat({ color: COLORS.bone, roughness: 0.65, transparent: true, opacity: 0.22, depthWrite: false });
    const near = box.clone().expandByScalar(pad);
    for (const b of this.meshes) {
      if (b.userData.kind !== 'bone' || !b.userData.real || skip.has(b) || !isLeftMesh(b)) continue;
      if (solid(b)) kit.root.add(cloneMesh(b, attachMat));
      else if (near.intersectsBox(new THREE.Box3().setFromObject(b))) kit.root.add(cloneMesh(b, ghostMat));
    }
  }

  // Strukturen der vorherigen Schritte blass grau
  _ghosts(kit, ids, skip = new Set()) {
    if (!ids.length) return;
    const gm = kit.mat({ color: 0x9aa4b2, roughness: 0.6, transparent: true, opacity: 0.3, depthWrite: false });
    for (const gid of ids) {
      const lm = findLandmark(gid);
      if (lm) { this._dot(kit, V(lm.pos), 0x9aa4b2, null, '', null, 0.005); continue; }
      this._leftMeshes(gid).forEach((m) => { if (!skip.has(m)) { kit.root.add(cloneMesh(m, gm)); skip.add(m); } });
    }
  }

  _show(kit, data, box, factor, dir) {
    this.scene.add(kit.root);
    this.focus = { root: kit.root, mats: kit.mats, labels: kit.labels, parts: [], deeper: [], activePart: null, ...data };
    this.applyVisibility();
    this.applyViewOffset();
    this.focusBox(box, factor, dir);
  }

  enterFocus(id, { ghosts = [] } = {}) {
    if (findLandmark(id)) return this.enterLandmark(id, { ghosts });
    const muscle = MUSCLES.find((m) => m.id === id);
    if (!muscle) return this.enterStructure(id, { ghosts });
    const group = this.byId.get(id);
    if (!group || !group.children.length) return null;
    const kit = this._kit();
    const { root, mat } = kit;

    const own = group.children.filter(isLeftMesh);
    const selBox = boxOf(own);
    const info = MUSCLE3D[id] || { layer: 1, o: [], i: [] };

    // Teile des Muskels, jeder Teil eine eigene Farbe
    const PALETTE = [0xe4572e, 0xf3a712, 0xa259ff, 0xff6fb5, 0x8d6e63, 0xf97316]; // kein Grün/Blau (= U/A-Marker)
    const parts = [];
    for (const m of own) {
      const names = partNames(m.userData.part, muscle);
      let p = parts.find((x) => x.la === names.la);
      if (!p) {
        p = { ...names, meshes: [], mat: mat({ color: PALETTE[parts.length % PALETTE.length], roughness: 0.5 }) };
        parts.push(p);
      }
      const c = cloneMesh(m, p.mat, { focusPart: parts.indexOf(p) });
      p.meshes.push(c);
      root.add(c);
    }

    // Knochen: Ursprungs-/Ansatzknochen kräftig, Nachbarknochen blass
    const matches = (part, list) => list.some((x) => part.toLowerCase().includes(x.toLowerCase()));
    const attachBones = { o: [], i: [] };
    for (const b of this.meshes) {
      if (b.userData.kind !== 'bone' || !b.userData.real || !isLeftMesh(b)) continue;
      const part = b.userData.part || '';
      if (matches(part, info.o)) attachBones.o.push(b);
      if (matches(part, info.i)) attachBones.i.push(b);
    }
    const solid = new Set([...attachBones.o, ...attachBones.i]);
    this._contextBones(kit, selBox, (b) => solid.has(b));

    // Tiefere Muskeln in derselben Region halbtransparent
    const deepMat = mat({ color: 0xd98b8b, roughness: 0.5, transparent: true, opacity: 0.45, depthWrite: false });
    const touch = selBox.clone().expandByScalar(0.02);
    const deeper = [];
    const shown = new Set(own);
    for (const [mid, g] of this.byId) {
      if (mid === id || g.userData.kind !== 'muscle' || ghosts.includes(mid)) continue;
      const layer = (MUSCLE3D[mid] || {}).layer || 1;
      if (layer <= info.layer) continue;
      const ms = g.children.filter(isLeftMesh).filter((m) => touch.containsPoint(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()))); // Mitte liegt unter dem Muskel
      if (!ms.length) continue;
      deeper.push(mid);
      ms.forEach((m) => { shown.add(m); root.add(cloneMesh(m, deepMat, { deepId: mid })); });
    }
    this._ghosts(kit, ghosts.filter((g) => g !== id), shown);

    // Ursprung/Ansatz: benannte Knochenpunkte (z. B. „Ursprung: Spina ischiadica“), sonst Kontaktstelle am Knochen
    const lms = landmarksOf(id);
    const markers = this.attachmentPoints(own, attachBones).filter((mk) => !lms[mk.role].some((l) => l.bone === mk.boneId));
    for (const mk of markers) {
      const bone = BONES.find((x) => x.id === mk.boneId);
      this._dot(kit, mk.pos, mk.role === 'o' ? 0x16a34a : 0x2563eb, `${mk.role === 'o' ? 'U' : 'A'} · ${bone ? bone.de : ''}`, mk.role === 'o' ? 'lbl-o' : 'lbl-i');
    }
    const ROLE = { o: ['Ursprung', 0x16a34a, 'lbl-o'], i: ['Ansatz', 0x2563eb, 'lbl-i'], via: ['Umlenkung', 0xf59e0b, 'lbl-via'] };
    for (const role of ['o', 'i', 'via']) {
      for (const l of lms[role]) this._dot(kit, V(l.pos), ROLE[role][1], `${ROLE[role][0]}: ${shortLa(l)}`, ROLE[role][2], l.id);
    }
    if (parts.length > 1) {
      parts.forEach((p, k) => kit.labels.push(this.addLabel(p.la, boxOf(p.meshes).getCenter(new THREE.Vector3()), 'lbl-part', k)));
    }

    const c = selBox.getCenter(new THREE.Vector3());
    this._show(kit, { id, kind: 'muscle', parts, deeper, layer: info.layer }, selBox, 2.2, new THREE.Vector3(0.45, 0.12, c.z < -0.02 ? -1 : 1).normalize());
    return {
      kind: 'muscle',
      parts: parts.map((p) => ({ la: p.la, de: p.de, tr: p.tr, color: '#' + p.mat.color.getHexString() })),
      deeper, layer: info.layer, markers: markers.length,
      landmarks: ['o', 'i', 'via'].flatMap((r) => lms[r].map((l) => ({ id: l.id, role: r }))),
    };
  }

  // Knochen (mit seinen Knochenpunkten) oder Gelenk (mit den beteiligten Knochen, Achsen zuschaltbar)
  enterStructure(id, { ghosts = [] } = {}) {
    const isBone = BONES.some((x) => x.id === id);
    const isJoint = JOINTS.some((x) => x.id === id);
    if (!isBone && !isJoint) return null;
    const own = this._leftMeshes(id);
    if (!own.length) return null;
    const kit = this._kit();
    const hl = kit.mat(isBone ? { color: 0xf2c14e, roughness: 0.55 } : { color: COLORS.joint, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false });
    own.forEach((m) => kit.root.add(cloneMesh(m, hl)));
    const box = boxOf(own);
    const skip = new Set(own);
    let lmIds = [];
    let axisCenter = null;
    if (isBone) {
      this._contextBones(kit, box, () => false, skip);
      const lms = LANDMARKS.filter((l) => l.bone === id);
      lms.forEach((l) => this._dot(kit, V(l.pos), 0x9333ea, shortLa(l), 'lbl-lm', l.id, 0.006));
      lmIds = lms.map((l) => l.id);
    } else {
      axisCenter = box.getCenter(new THREE.Vector3());
      const jb = new THREE.Box3().setFromCenterAndSize(axisCenter, new THREE.Vector3(0.05, 0.05, 0.05));
      this._contextBones(kit, box, (b) => jb.intersectsBox(new THREE.Box3().setFromObject(b)), skip);
      box.expandByScalar(0.06);
    }
    this._ghosts(kit, ghosts.filter((g) => g !== id), skip);
    const c = box.getCenter(new THREE.Vector3());
    this._show(kit, { id, kind: isBone ? 'bone' : 'joint', axisCenter }, box, isBone ? 1.6 : 2.2, new THREE.Vector3(0.35, 0.15, c.z < -0.04 ? -1 : 1).normalize());
    return { kind: isBone ? 'bone' : 'joint', landmarks: lmIds, axes: isJoint ? axesOf(id) : [] };
  }

  // Knochenpunkt: Knochen kräftig, Muskeln mit Ursprung (grün) / Ansatz (blau) / Umlenkung (orange) halbtransparent
  enterLandmark(id, { ghosts = [] } = {}) {
    const l = findLandmark(id);
    const kit = this._kit();
    const p = V(l.pos);
    const bone = new Set(this._leftMeshes(l.bone));
    const box = new THREE.Box3().setFromCenterAndSize(p, new THREE.Vector3(0.12, 0.12, 0.12));
    this._contextBones(kit, box, (b) => bone.has(b));
    const shown = new Set();
    const COL = { o: 0x16a34a, i: 0x2563eb, via: 0xf59e0b };
    for (const role of ['o', 'i', 'via']) {
      const m = kit.mat({ color: COL[role], roughness: 0.5, transparent: true, opacity: 0.4, depthWrite: false });
      for (const mid of l[role] || []) this._leftMeshes(mid).forEach((x) => { shown.add(x); kit.root.add(cloneMesh(x, m, { deepId: mid })); });
    }
    this._ghosts(kit, ghosts.filter((g) => g !== id), shown);
    this._dot(kit, p, 0x9333ea, shortLa(l), 'lbl-lm', l.id, 0.009);
    // von außen auf den Punkt schauen (weg von der Knochenmitte)
    const out = p.clone().sub(boxOf([...bone]).getCenter(new THREE.Vector3()));
    out.y *= 0.3;
    if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
    this._show(kit, { id, kind: 'landmark' }, box, 2.4, out.normalize());
    return { kind: 'landmark', o: l.o || [], i: l.i || [], via: l.via || [] };
  }

  // Alle Strukturen zusammen, jede in eigener Farbe
  enterGroup(ids) {
    const kit = this._kit();
    const all = new THREE.Box3();
    const legend = [];
    const shown = new Set();
    ids.forEach((gid, k) => {
      const color = MULTI[k % MULTI.length];
      const lm = findLandmark(gid);
      if (lm) {
        const p = V(lm.pos);
        this._dot(kit, p, color, shortLa(lm), 'lbl-lm', lm.id, 0.008);
        all.expandByPoint(p);
      } else {
        const ms = this._leftMeshes(gid);
        if (!ms.length) return;
        const m = kit.mat({ color, roughness: 0.5 });
        ms.forEach((x) => { shown.add(x); kit.root.add(cloneMesh(x, m, { groupId: gid })); });
        all.union(boxOf(ms));
      }
      legend.push({ id: gid, color: '#' + new THREE.Color(color).getHexString() });
    });
    if (all.isEmpty()) return null;
    this._contextBones(kit, all, () => false, shown, 0.05);
    const c = all.getCenter(new THREE.Vector3());
    this._show(kit, { id: null, kind: 'group' }, all.expandByScalar(0.02), 1.9, new THREE.Vector3(0.35, 0.12, c.z < -0.04 ? -1 : 1).normalize());
    return { kind: 'group', legend };
  }

  // Bewegungsachsen am Gelenk ein-/ausblenden
  setAxes(on) {
    const f = this.focus;
    if (!f || !f.axisCenter) return;
    if (f.axisRoot) {
      f.root.remove(f.axisRoot);
      f.axisRoot.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      f.axisLabels.forEach((l) => l.el.remove());
      this.labels = this.labels.filter((l) => !f.axisLabels.includes(l));
      f.labels = f.labels.filter((l) => !f.axisLabels.includes(l));
      f.axisRoot = null;
    }
    if (!on) return;
    const grp = new THREE.Group();
    f.axisLabels = [];
    const len = 0.2;
    for (const a of axesOf(f.id)) {
      const dir = new THREE.Vector3(...a.v);
      const m = new THREE.MeshBasicMaterial({ color: a.color, depthTest: false });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, len, 8), m);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      rod.position.copy(f.axisCenter);
      rod.renderOrder = 11;
      grp.add(rod);
      for (const sgn of [1, -1]) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.016, 12), m.clone());
        tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().multiplyScalar(sgn));
        tip.position.copy(f.axisCenter).addScaledVector(dir, sgn * len / 2);
        tip.renderOrder = 11;
        grp.add(tip);
      }
      const l = this.addLabel(a.la, f.axisCenter.clone().addScaledVector(dir, len / 2 + 0.012), 'lbl-axis');
      l.el.style.background = a.color;
      f.axisLabels.push(l);
      f.labels.push(l);
    }
    f.root.add(grp);
    f.axisRoot = grp;
    // etwas weiter weg und schräg von vorne, damit alle drei Achsen samt Namen sichtbar sind
    const z = f.axisCenter.z < -0.04 ? -1 : 1;
    this.focusBox(new THREE.Box3().setFromCenterAndSize(f.axisCenter, new THREE.Vector3(len, len, len).multiplyScalar(1.25)), 1.7, new THREE.Vector3(0.55, 0.35, z).normalize());
  }

  // Knochenpunkte in der Gesamtansicht (Punkte beidseitig, Beschriftung links)
  setLandmarks(on) {
    this.showLm = on;
    if (on && !this.lmRoot) {
      this.lmRoot = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x9333ea, depthTest: false });
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const geo = new THREE.SphereGeometry(0.006, 14, 10), hitGeo = new THREE.SphereGeometry(0.016, 8, 6);
      for (const l of LANDMARKS) {
        for (const sx of l.mid ? [1] : [1, -1]) {
          const p = V(l.pos, sx);
          const d = new THREE.Mesh(geo, mat);
          d.renderOrder = 10;
          d.position.copy(p);
          const h = new THREE.Mesh(hitGeo, hitMat);
          h.position.copy(p);
          h.userData.landmark = d.userData.landmark = l.id;
          this.lmRoot.add(d, h);
        }
        const lbl = this.addLabel(shortLa(l), V(l.pos), 'lbl-lm');
        lbl.lm = true;
      }
      this.scene.add(this.lmRoot);
    }
    this.applyVisibility();
  }

  applyViewOffset() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (this.focus && w && h) this.camera.setViewOffset(w, h, 0, h * 0.22, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  exitFocus() {
    const f = this.focus;
    if (!f) return;
    this.scene.remove(f.root);
    f.root.traverse((o) => { if (o.isMesh && (o.userData.own || o.parent === f.axisRoot)) { o.geometry.dispose(); o.material.dispose(); } }); // geklonte Meshes teilen die Geometrie – nicht freigeben
    f.mats.forEach((m) => m.dispose());
    f.labels.forEach((l) => l.el.remove());
    this.labels = this.labels.filter((l) => !f.labels.includes(l));
    this.focus = null;
    this.applyViewOffset();
    this.applyVisibility();
  }

  // Einen Teil hervorheben (null = alle gleich)
  focusPart(k) {
    const f = this.focus;
    if (!f) return;
    f.activePart = k;
    f.parts.forEach((p, i) => {
      const dim = k !== null && k !== undefined && i !== k;
      p.mat.transparent = dim;
      p.mat.opacity = dim ? 0.25 : 1;
      p.mat.depthWrite = !dim;
      p.mat.emissive.setHex(i === k ? 0x553300 : 0x000000);
    });
    f.labels.forEach((l) => l.el.classList.toggle('lbl-active', l.part === k));
  }

  // Muskel-Eckpunkte, die näher als 6 mm an einem Ursprungs-/Ansatzknochen liegen → je Knochen ein Marker
  attachmentPoints(own, attachBones) {
    const CELL = 0.01;
    const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    const grids = {};
    for (const role of ['o', 'i']) {
      const grid = new Map();
      const v = new THREE.Vector3();
      for (const b of attachBones[role]) {
        const a = b.geometry.attributes.position;
        for (let n = 0; n < a.count; n++) {
          v.fromBufferAttribute(a, n).applyMatrix4(b.matrixWorld);
          const k = key(v.x, v.y, v.z);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push([v.x, v.y, v.z, b.userData.id]);
        }
      }
      grids[role] = grid;
    }
    const nearest = (grid, p) => {
      let best = null, bd = Infinity;
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!cell) continue;
        for (const q of cell) {
          const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2;
          if (d < bd) { bd = d; best = q; }
        }
      }
      return best ? { d: Math.sqrt(bd), boneId: best[3] } : null;
    };
    const hits = {};
    const fallback = { o: null, i: null };
    const v = new THREE.Vector3();
    for (const m of own) {
      const a = m.geometry.attributes.position;
      for (let n = 0; n < a.count; n++) {
        v.fromBufferAttribute(a, n).applyMatrix4(m.matrixWorld);
        const no = nearest(grids.o, v), ni = nearest(grids.i, v);
        let role = null, hit = null;
        if (no && (!ni || no.d <= ni.d)) { role = 'o'; hit = no; } else if (ni) { role = 'i'; hit = ni; }
        if (!hit) continue;
        if (!fallback[role] || hit.d < fallback[role].d) fallback[role] = { d: hit.d, boneId: hit.boneId, pos: v.clone() };
        if (hit.d > 0.006) continue;
        const k = role + '|' + hit.boneId;
        if (!hits[k]) hits[k] = { role, boneId: hit.boneId, sum: new THREE.Vector3(), n: 0 };
        hits[k].sum.add(v); hits[k].n++;
      }
    }
    const out = Object.values(hits).filter((h) => h.n >= 3).map((h) => ({ role: h.role, boneId: h.boneId, pos: h.sum.multiplyScalar(1 / h.n) }));
    for (const role of ['o', 'i']) {
      if (!out.some((h) => h.role === role) && fallback[role] && fallback[role].d < 0.03) out.push({ role, boneId: fallback[role].boneId, pos: fallback[role].pos });
    }
    return out;
  }

  addLabel(text, pos, cls, part = null) {
    const el = document.createElement('div');
    el.className = 'lbl3d ' + cls;
    el.textContent = text;
    this.labelLayer.appendChild(el);
    const l = { el, pos: pos.clone(), part };
    this.labels.push(l);
    return l;
  }

  updateLabels() {
    if (!this.labels.length) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const camDist = this.camera.position.distanceTo(this.controls.target);
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      v.copy(l.pos).project(this.camera);
      const hidden = v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1
        || (l.part !== null && !(this.focus && this.focus.activePart === l.part))
        || (l.lm && (!this.showLm || this.focus || camDist > 1.5)); // Gesamtansicht: Namen erst beim Heranzoomen
      l.el.style.display = hidden ? 'none' : '';
      if (!hidden) l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -130%)`;
    }
  }

  focusBox(box, factor = 2.6, viewDir = null) {
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * factor, 0.35, 2.6);
    const dir = viewDir ? viewDir.clone() : new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    this.goal = { target: c, pos: c.clone().add(dir.multiplyScalar(dist)) };
  }

  resetView() {
    this.goal = { target: new THREE.Vector3(0, 0.98, 0), pos: new THREE.Vector3(0, 0.98, 3.5) };
  }

  view(name) {
    const t = this.controls.target.clone();
    const d = this.camera.position.distanceTo(t);
    const dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0] };
    const v = new THREE.Vector3(...dirs[name]).multiplyScalar(d);
    this.goal = { target: t, pos: t.clone().add(v).add(new THREE.Vector3(0, 0.05, 0)) };
  }

  bindPicking() {
    const el = this.renderer.domElement;
    let start = null;
    el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    el.addEventListener('pointerup', (e) => {
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      const quick = performance.now() - start.t < 400;
      start = null;
      if (moved > 8 || !quick) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      if (this.focus) {
        const pick = [];
        this.focus.root.traverse((o) => { if (o.isMesh && (o.userData.focusPart !== undefined || o.userData.deepId || o.userData.landmark || o.userData.groupId)) pick.push(o); });
        const hits = ray.intersectObjects(pick, false);
        const h = hits.find((x) => x.object.userData.landmark) || hits[0]; // Knochenpunkte liegen obenauf
        if (!h) { this.focusPart(null); this.onPart(null); return; }
        const u = h.object.userData;
        if (u.landmark) { if (u.landmark !== this.focus.id) this.onLandmark(u.landmark); }
        else if (u.focusPart !== undefined) { this.focusPart(u.focusPart); this.onPart(u.focusPart); }
        else if (u.groupId) this.onPart({ group: u.groupId });
        else this.onSelect(u.deepId, { focus: true });
        return;
      }
      if (this.showLm && this.lmRoot) {
        const lh = ray.intersectObjects(this.lmRoot.children, false)[0];
        if (lh) { this.onLandmark(lh.object.userData.landmark); return; }
      }
      const visible = this.meshes.filter((m) => m.parent.visible && !(m.material.transparent && m.material.opacity < 0.5 && m.userData.id !== this.selected));
      const hit = ray.intersectObjects(visible, false)[0];
      if (hit) this.select(hit.object.userData.id, { focus: false });
      else this.select(null);
    });
    this.controls.addEventListener('start', () => { this.goal = null; });
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.applyViewOffset();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      if (this.goal) {
        // Auf einer Kugelbahn um das Ziel fahren, damit die Kamera nicht durch das Modell fliegt
        const cur = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
        const want = new THREE.Spherical().setFromVector3(this.goal.pos.clone().sub(this.goal.target));
        let dTheta = want.theta - cur.theta;
        if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
        if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
        const k = 0.12;
        cur.theta += dTheta * k;
        cur.phi += (want.phi - cur.phi) * k;
        cur.radius += (want.radius - cur.radius) * k;
        this.controls.target.lerp(this.goal.target, k);
        this.camera.position.setFromSpherical(cur).add(this.controls.target);
        if (this.camera.position.distanceTo(this.goal.pos) < 0.002) this.goal = null;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.updateLabels();
      requestAnimationFrame(loop);
    };
    loop();
  }

  stop() { this.running = false; }
}
