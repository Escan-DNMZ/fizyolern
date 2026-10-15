// Interaktives 3D-Anatomiemodell (schematisch) mit Three.js
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { BONES, MUSCLES, JOINTS } from './data/anatomy.js';

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

// Muskel-Meshes aus Sinew -> Struktur-IDs (erste ID = Gruppe, weitere werden mitdargestellt)
const MUSCLE_MESHES = {
  bicepsFemLong: ['biceps_femoris'],
  bicepsFemShort: ['biceps_femoris'],
  bicepsLong: ['biceps_brachii'],
  bicepsShort: ['biceps_brachii'],
  brachialis: ['brachialis'],
  brachioradialis: ['brachioradialis'],
  deltoid: ['deltoideus'],
  extensorDig: ['extensor_digitorum'],
  fdp: ['flexor_digitorum_profundus'],
  fds: ['flexor_digitorum_superficialis'],
  gastrocnemius: ['gastrocnemius'],
  gluteus: ['gluteus_maximus'],
  iliopsoas: ['iliopsoas'],
  rectusFemoris: ['rectus_femoris'],
  semis: ['semitendinosus', 'semimembranosus'],
  soleus: ['soleus'],
  supraspinatus: ['supraspinatus'],
  tibialisAnt: ['tibialis_anterior'],
  tricepsLat: ['triceps_brachii'],
  tricepsLong: ['triceps_brachii'],
  tricepsMed: ['triceps_brachii'],
  vasti: ['vastus_lateralis', 'vastus_medialis', 'vastus_intermedius'],
};

// Englische BodyParts3D-Knochennamen -> Struktur-IDs
function boneIdsFor(name) {
  const n = name.toLowerCase();
  const rules = [
    [/thoracic vertebra/, 'bws'], [/lumbar vertebra/, 'lws'], [/^sacrum/, 'sacrum'], [/^sternum/, 'sternum'],
    [/\brib\b/, 'costae'], [/clavicle/, 'clavicula'], [/scapula/, 'scapula'], [/humerus/, 'humerus'],
    [/scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate/, 'carpus'],
    [/metacarpal|finger|thumb/, 'manus'], [/radius/, 'radius'], [/ulna/, 'ulna'],
    [/hip bone/, 'os_coxae'], [/femur/, 'femur'], [/patella/, 'patella'], [/tibia/, 'tibia'], [/fibula/, 'fibula'],
    [/talus/, 'talus'], [/calcaneus/, 'calcaneus'], [/navicular|cuboid|cuneiform|metatarsal|toe/, 'pes'],
  ];
  const hit = rules.find(([re]) => re.test(n));
  return hit ? [hit[1]] : null;
}

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
    this.alias = {}; // Struktur-ID -> ID der Gruppe, deren echtes Mesh sie mitdarstellt

    this.build();
    this.bindPicking();
    this.ready = this.loadRealModels().catch((e) => console.warn('Echte 3D-Modelle nicht geladen, schematisches Modell bleibt:', e));

    new ResizeObserver(() => this.resize()).observe(container);
  }

  // Ersetzt schematische Teile durch die echten Modelle (BodyParts3D-Knochen, Sinew-Muskeln)
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
    this.useReal(bones.scene, (n) => boneIdsFor(n));
    this.useReal(muscles.scene, (n) => MUSCLE_MESHES[n]);
    draco.dispose();
    this.applyVisibility();
    if (this.selected) this.select(this.selected, { silent: true });
  }

  useReal(scene, idsFor) {
    // BodyParts3D: Millimeter, z = oben, vorne = -y, nur rechte Körperhälfte (x < 0).
    // → Meter, y = oben, vorne = +z; leicht verschoben, damit es zu den schematischen Teilen passt.
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
      const mirror = geo.boundingBox.max.x < 0.005; // nur paarige Strukturen spiegeln
      for (const sx of mirror ? [1, -1] : [1]) {
        const m = new THREE.Mesh(geo, group.userData.mats[0]);
        m.scale.x = sx;
        m.userData = { id: primary, kind: group.userData.kind, real: true };
        group.add(m);
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
    for (const [id, g] of this.byId) {
      const kind = g.userData.kind;
      let vis = this.layers[kind];
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
    this.camera.updateProjectionMatrix();
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
      requestAnimationFrame(loop);
    };
    loop();
  }

  stop() { this.running = false; }
}
