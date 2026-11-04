// Liest models/bones.glb (Draco) in Node und liefert die Knochen in App-Koordinaten – für Tests,
// die prüfen, ob Punkte (Bänder, Knochenpunkte) wirklich auf dem richtigen Knochen liegen.
// Umrechnung wie Anatomy3D.useReal: BodyParts3D mm, z oben, vorne = -y → Meter, y oben, vorne = +z, verschoben um (0, 0.07, -0.08).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function draco() {
  const ctx = { console, WebAssembly, setTimeout, clearTimeout, TextDecoder, Uint8Array };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'vendor/draco/draco_wasm_wrapper.js'), 'utf8') + '\n;this.DracoDecoderModule = DracoDecoderModule;', ctx);
  return ctx.DracoDecoderModule({ wasmBinary: fs.readFileSync(path.join(root, 'vendor/draco/draco_decoder.wasm')) });
}

// → Map „Left femur“ → { pos: Float32Array (x,y,z …), tri: Uint32Array (a,b,c …) }
export async function loadBones(file = 'models/bones.glb') {
  const data = fs.readFileSync(path.join(root, file));
  const jsonLen = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const D = await draco();
  const dec = new D.Decoder();
  const out = new Map();
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue;
    const prim = gltf.meshes[node.mesh].primitives[0];
    const ext = prim.extensions && prim.extensions.KHR_draco_mesh_compression;
    if (!ext) continue;
    const bv = gltf.bufferViews[ext.bufferView];
    const bytes = data.subarray(binStart + (bv.byteOffset || 0), binStart + (bv.byteOffset || 0) + bv.byteLength);
    const buf = new D.DecoderBuffer();
    buf.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), bytes.byteLength);
    const mesh = new D.Mesh();
    const st = dec.DecodeBufferToMesh(buf, mesh);
    if (!st.ok()) throw new Error('Draco: ' + st.error_msg());
    const att = dec.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
    const n = mesh.num_points();
    const arr = new D.DracoFloat32Array();
    dec.GetAttributeFloatForAllPoints(mesh, att, arr);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = arr.GetValue(3 * i), y = arr.GetValue(3 * i + 1), z = arr.GetValue(3 * i + 2);
      pos[3 * i] = x / 1000; pos[3 * i + 1] = z / 1000 + 0.07; pos[3 * i + 2] = -y / 1000 - 0.08;
    }
    const nf = mesh.num_faces();
    const tri = new Uint32Array(nf * 3);
    const ia = new D.DracoInt32Array();
    for (let f = 0; f < nf; f++) {
      dec.GetFaceFromMesh(mesh, f, ia);
      tri[3 * f] = ia.GetValue(0); tri[3 * f + 1] = ia.GetValue(1); tri[3 * f + 2] = ia.GetValue(2);
    }
    [arr, ia, mesh, buf].forEach((o) => D.destroy(o));
    const [group, part] = node.name.split('|');
    out.set(part.replace(/_/g, ' '), { group, pos, tri });
  }
  D.destroy(dec);
  return out;
}

// kleinster Abstand Punkt–Dreieck (Ericson, Real-Time Collision Detection)
function pointTri(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q;
  if (d1 <= 0 && d2 <= 0) q = a;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]]; }
      else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]]; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])]; }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
          }
        }
      }
    }
  }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// Abstand eines Punktes zur Oberfläche eines Knochenteils (m)
export function distTo(bone, p) {
  const { pos, tri } = bone;
  const P = (i) => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  let best = Infinity;
  for (let f = 0; f < tri.length; f += 3) best = Math.min(best, pointTri(p, P(tri[f]), P(tri[f + 1]), P(tri[f + 2])));
  return best;
}

// Mittelpunkt und Grenzen eines Knochenteils
export function boxOf(bone) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < bone.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], bone.pos[i + k]); mx[k] = Math.max(mx[k], bone.pos[i + k]); }
  return { mn, mx, c: mn.map((v, k) => (v + mx[k]) / 2) };
}
