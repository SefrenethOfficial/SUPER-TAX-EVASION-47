import * as THREE from 'three';
import { Terrain } from '../terrain.js?v=8';

// ---------------------------------------------------------------------------
// SUNNY SPIRE HILL
//
// A long valley course, south to north:
//   spawn meadow -> path over a creek on a wooden bridge -> ramp up onto a
//   raised plateau (a second slope drops east to a fenced pen) -> a big
//   mountain with a road spiralling 3.4 times round it to the summit, where a
//   rock spire with spiral ledges holds the star. A floating island hangs off
//   the mountain's west side, and a pond sits in the back meadow. Rolling
//   hills and steep valley walls close it in.
//
// The ground is a heightmap (see terrain.js). Bridges, fences, trees, rocks,
// ledges and the island are boxes.
// ---------------------------------------------------------------------------

export const NAME = 'Sunny Spire Hill';
export const MUSIC = 'sunny-spire-hill.mp3';

// ---- helpers ----------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.55 + noise(x * 2.1 + 5, z * 2.1 + 9) * 0.3 + noise(x * 4.3 + 13, z * 4.3 + 2) * 0.15;
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function sdRoundRect(x, z, x0, x1, z0, z1, rad) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 - rad, hz = (z1 - z0) / 2 - rad;
  const qx = Math.abs(x - cx) - hx, qz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rad;
}
function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const sx = bx - ax, sz = bz - az, l2 = sx * sx + sz * sz;
    const t = l2 ? clamp(((x - ax) * sx + (z - az) * sz) / l2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(x - ax - sx * t, z - az - sz * t));
  }
  return best;
}

// ---- layout constants ---------------------------------------------------------
const BOUNDS = { minX: -110, maxX: 110, minZ: -140, maxZ: 140 };
const PLATEAU = { x0: -44, x1: 30, z0: -40, z1: 12, r: 10, h: 6 };
const MTN = { x: 0, z: 45, R0: 36, w: 6.5, H: 6.4, turns: 3.4, base: 6, th0: -Math.PI / 2 };
const MTN_TOP = MTN.base + MTN.H * MTN.turns;
const creekZ = (x) => -76 + 5 * Math.sin(x * 0.045);
const POND = { x: 34, z: 100, r: 14, bed: -2, water: -0.7 };
const PEN = { x: 50, z: -48, half: 10 };
const HILLS = [[62, -100, 18, 7], [-62, -96, 22, 9], [72, 20, 20, 8], [-72, 12, 18, 6], [-32, 112, 20, 7], [70, 92, 18, 6], [-80, -40, 16, 5]];

// Paths (x, z polylines)
const MAIN_PATH = [[0, -134], [0, -104], [-6, -90], [-8, -78], [-10, -68], [-20, -66], [-34, -68], [-34, -40], [-26, -26], [-10, -8], [0, 9]];
const PEN_PATH = [[0, -104], [20, -92], [36, -70], [44, -58]];
const EAST_PATH = [[18, -20], [30, -20], [52, -20], [52, -40]];
const BACK_PATH = [[22, 78], [30, 86], [26, 112], [10, 126]];

// The road spiralling up the mountain, as a polyline
function roadCentre(f) { // f = turns travelled
  const r = MTN.R0 - MTN.w * f, a = MTN.th0 + f * Math.PI * 2;
  return [MTN.x + Math.cos(a) * r, MTN.z + Math.sin(a) * r, MTN.base + MTN.H * f];
}
const ROAD = [];
for (let f = 0; f <= MTN.turns + 1e-6; f += 0.01) { const [x, z] = roadCentre(f); ROAD.push([x, z]); }

// ---- height function ------------------------------------------------------------
function meadow(x, z) {
  let h = (fbm(x * 0.025, z * 0.025) - 0.45) * 2.4;
  for (const [hx, hz, r, hh] of HILLS) {
    const d = Math.hypot(x - hx, z - hz) / r;
    h += hh * Math.exp(-d * d * 1.6);
  }
  // flatten around paths and the creek valley so bridges and paths sit nicely
  const pd = Math.min(distToPolyline(x, z, MAIN_PATH), distToPolyline(x, z, PEN_PATH), distToPolyline(x, z, BACK_PATH));
  h *= 0.35 + 0.65 * smooth(3, 12, pd);
  h *= smooth(6, 22, Math.abs(z - creekZ(x)));
  return h;
}
function plateau(x, z) {
  const sd = sdRoundRect(x, z, PLATEAU.x0, PLATEAU.x1, PLATEAU.z0, PLATEAU.z1, PLATEAU.r);
  return PLATEAU.h + (fbm(x * 0.08, z * 0.08) - 0.5) * 0.6 - Math.max(0, sd) * 3.2;
}
// ramp along z (west, from the creek up to the plateau)
function ramp1(x, z) {
  const t = (z + 68) / 28; if (t < -0.3 || t > 1.2) return -Infinity;
  return PLATEAU.h * smooth(0, 1, clamp(t, 0, 1)) - Math.max(0, Math.abs(x + 34) - 4.5) * 3;
}
// slope off the plateau's east side down towards the pen
function ramp2(x, z) {
  const t = (x - 26) / 26; if (t < -0.2 || t > 1.2) return -Infinity;
  return PLATEAU.h * (1 - smooth(0, 1, clamp(t, 0, 1))) - Math.max(0, Math.abs(z + 20) - 5) * 3;
}
function mountain(x, z) {
  const dx = x - MTN.x, dz = z - MTN.z, r = Math.hypot(dx, dz);
  let phi = (Math.atan2(dz, dx) - MTN.th0) % (Math.PI * 2);
  if (phi < 0) phi += Math.PI * 2;
  const f = phi / (Math.PI * 2);
  const u = (MTN.R0 - r) / MTN.w;
  const k = Math.round(u - f);
  if (k >= 0) {
    const ups = k + f;
    if (ups >= MTN.turns) return MTN_TOP + (fbm(x * 0.15, z * 0.15) - 0.5) * 0.5 * smooth(MTN.R0 - MTN.w * MTN.turns, 0, r);
    return MTN.base + MTN.H * ups;
  }
  const out = (f - 0.5 - u) * MTN.w;  // metres outside the outermost turn
  return MTN.base + MTN.H * f - Math.max(0, out) * 2.6 + (fbm(x * 0.2, z * 0.2) - 0.5) * 1.2;
}
export function height(x, z) {
  let h = Math.max(meadow(x, z), plateau(x, z), ramp1(x, z), ramp2(x, z), mountain(x, z));
  // creek
  const cd = Math.abs(z - creekZ(x));
  h = Math.min(h, -2.4 + 2.4 * smooth(2.5, 7, cd) + Math.max(0, cd - 7) * 9);
  // pond
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < POND.r + 8) h = Math.min(h, POND.bed + (0 - POND.bed) * smooth(POND.r - 4, POND.r + 2, pd) + Math.max(0, pd - POND.r - 2) * 9);
  // valley walls
  const edge = Math.max(Math.abs(x) - (BOUNDS.maxX - 18), Math.abs(z) - (BOUNDS.maxZ - 18));
  if (edge > 0) h = Math.max(h, h + Math.pow(edge / 18, 1.5) * 30 + fbm(x * 0.07, z * 0.07) * 4 * smooth(0, 6, edge));
  return h;
}

// ---- build ------------------------------------------------------------------------
export function build(world, coins) {
  const scene = world.scene;
  const grassT = world.tile('grass.webp'), cliffT = world.tile('cliff.png'), pathT = world.tile('path.png'), rockT = world.tile('rock.png');
  const terrain = new Terrain({
    ...BOUNDS, res: 0.85, height,
    paths: [
      { points: MAIN_PATH, width: 5 }, { points: PEN_PATH, width: 4 }, { points: EAST_PATH, width: 4 },
      { points: BACK_PATH, width: 4 }, { points: ROAD, width: MTN.w - 1.6 },
    ],
    grass: grassT, cliff: cliffT, path: pathT,
  });
  world.setTerrain(terrain);
  const H = (x, z) => terrain.height(x, z);

  const wood = world.mat(world.tile('wood.jpg'), { uvScale: 1.6 });
  wood.map.magFilter = THREE.LinearFilter;
  wood.color.set(0xa9835a);
  const rock = world.mat(rockT, { uvScale: 2 });
  const grass = world.mat(grassT, { uvScale: 2.5 });
  const cliff = world.mat(cliffT, { uvScale: 2 });
  const box = (min, max, m) => world.addBox(min, max, m);

  // --- Water -----------------------------------------------------------------
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3b8fd6, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.1 });
  {
    const g = new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX, 12, 220, 1);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + creekZ(p.getX(i)));
    const creek = new THREE.Mesh(g, waterMat);
    creek.position.y = -0.9;
    creek.receiveShadow = true;
    scene.add(creek);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 1.5, 48), waterMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(POND.x, POND.water, POND.z);
    pond.receiveShadow = true;
    scene.add(pond);
  }

  // --- Wooden bridge over the creek --------------------------------------------
  const bx0 = -10.6, bx1 = -5.4, bz0 = creekZ(-8) - 8, bz1 = creekZ(-8) + 8.5, deck = 0.28;
  box([bx0, -0.2, bz0], [bx1, deck, bz1], wood);
  for (let z = bz0 + 0.2; z <= bz1; z += 2.5) {
    box([bx0 - 0.25, deck, z], [bx0, deck + 1.1, z + 0.25], wood);
    box([bx1, deck, z], [bx1 + 0.25, deck + 1.1, z + 0.25], wood);
  }
  box([bx0 - 0.25, deck + 0.95, bz0], [bx0, deck + 1.1, bz1], wood);
  box([bx1, deck + 0.95, bz0], [bx1 + 0.25, deck + 1.1, bz1], wood);
  for (const z of [bz0 - 1, bz1 + 1]) for (const x of [bx0 - 0.4, bx1 + 0.15]) box([x, H(x, z) - 0.5, z - 0.12], [x + 0.25, H(x, z) + 1.3, z + 0.13], wood);

  // --- Fenced pen with a stake ---------------------------------------------------
  {
    const { x, z, half } = PEN, y = (px, pz) => H(px, pz);
    const post = (px, pz) => box([px - 0.15, y(px, pz) - 0.4, pz - 0.15], [px + 0.15, y(px, pz) + 1.2, pz + 0.15], wood);
    for (let t = -half; t <= half; t += 2.5) {
      post(x + t, z - half); post(x + t, z + half); post(x + half, z + t);
      if (Math.abs(t) > 2.5) post(x - half, z + t);   // gap on the west side
    }
    const ry = y(x, z) + 0.75;
    box([x - half, ry, z - half - 0.06], [x + half, ry + 0.14, z - half + 0.06], wood);
    box([x - half, ry, z + half - 0.06], [x + half, ry + 0.14, z + half + 0.06], wood);
    box([x + half - 0.06, ry, z - half], [x + half + 0.06, ry + 0.14, z + half], wood);
    box([x - half - 0.06, ry, z - half], [x - half + 0.06, ry + 0.14, z - 3.75], wood);
    box([x - half - 0.06, ry, z + 3.75], [x - half + 0.06, ry + 0.14, z + half], wood);
    box([x - 0.4, y(x, z) - 0.5, z - 0.4], [x + 0.4, y(x, z) + 2.0, z + 0.4], wood);
  }

  // --- Summit spire with spiral ledges, and the star ------------------------------
  const SP = { x: MTN.x, z: MTN.z };
  const spireTop = MTN_TOP + 6.5;
  box([SP.x - 2, MTN_TOP - 1, SP.z - 2], [SP.x + 2, spireTop, SP.z + 2], { top: grass, side: rock });
  const ledges = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 3);
    const lx = SP.x + Math.cos(a) * 3.9, lz = SP.z + Math.sin(a) * 3.9, top = MTN_TOP + 1.2 + i * 1.0;
    box([lx - 1.1, top - 0.5, lz - 1.1], [lx + 1.1, top, lz + 1.1], rock);
    ledges.push([lx, top, lz]);
  }

  // --- Floating island off the west side of the mountain ---------------------------
  const [rwX, rwZ, rwY] = roadCentre(0.75);   // first turn, due west
  const stones = [[rwX - 7, rwY + 1.35, rwZ + 2], [rwX - 12, rwY + 2.75, rwZ + 6], [rwX - 17, rwY + 4.15, rwZ + 10.5]];
  for (const [x, y, z] of stones) box([x - 1.3, y - 0.7, z - 1.3], [x + 1.3, y, z + 1.3], rock);
  const IS = { x: rwX - 28, z: rwZ + 17, y: rwY + 5.3 };
  box([IS.x - 7, IS.y - 3.5, IS.z - 5], [IS.x + 7, IS.y, IS.z + 5], { top: grass, side: cliff });
  box([IS.x - 5, IS.y - 3.5, IS.z - 7], [IS.x + 5, IS.y, IS.z + 7], { top: grass, side: cliff });
  box([IS.x - 4, IS.y - 6, IS.z - 4], [IS.x + 4, IS.y - 3.5, IS.z + 4], cliff);

  // --- Vegetation and rocks (instanced) -----------------------------------------------
  const R = rng(4747);
  const onPath = (x, z, m) => Math.min(distToPolyline(x, z, MAIN_PATH), distToPolyline(x, z, PEN_PATH), distToPolyline(x, z, EAST_PATH), distToPolyline(x, z, BACK_PATH)) < m;
  const g2 = { x: 0, z: 0 };
  const open = (x, z, margin) => {
    if (Math.abs(x) > BOUNDS.maxX - 22 || Math.abs(z) > BOUNDS.maxZ - 22) return false;
    if (Math.hypot(x - MTN.x, z - MTN.z) < MTN.R0 + 7) return false;
    if (Math.abs(z - creekZ(x)) < 9 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 5) return false;
    if (Math.abs(x - PEN.x) < PEN.half + 3 && Math.abs(z - PEN.z) < PEN.half + 3) return false;
    if (Math.hypot(x, z + 114) < 10) return false;
    if (onPath(x, z, margin)) return false;
    terrain.gradient(x, z, g2);
    return Math.hypot(g2.x, g2.z) < 0.4;
  };
  const place = (n, margin, tries = 40) => {
    const out = [];
    for (let i = 0; i < n * tries && out.length < n; i++) {
      const x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ);
      if (open(x, z, margin) && out.every(([ox, oz]) => Math.hypot(ox - x, oz - z) > margin)) out.push([x, z]);
    }
    return out;
  };

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const instanced = (geo, mat, n, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.castShadow = shadow; im.receiveShadow = true;
    scene.add(im);
    return im;
  };

  // Broadleaf trees: trunk + clustered leaf blobs
  const trees = place(70, 5);
  const pines = place(40, 4.5);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  const trunks = instanced(trunkGeo, trunkMat, trees.length + pines.length);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const blobs = instanced(blobGeo, leafMat, trees.length * 4);
  const coneGeo = new THREE.ConeGeometry(1, 1, 8); coneGeo.translate(0, 0.5, 0);
  const pineMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const cones = instanced(coneGeo, pineMat, pines.length * 3);
  let ti = 0, bi = 0, ci = 0;
  for (const [x, z] of trees) {
    const y = H(x, z), s = 0.8 + R() * 0.6, th = 3 * s;
    m4.compose(ps.set(x, y - 0.2, z), q.identity(), sc.set(s, th, s)); trunks.setMatrixAt(ti++, m4);
    world.addBox([x - 0.3 * s, y - 0.5, z - 0.3 * s], [x + 0.3 * s, y + th, z + 0.3 * s], cliff, { visible: false });
    for (let k = 0; k < 4; k++) {
      const a = R() * Math.PI * 2, rr = k === 0 ? 0 : 0.9 * s;
      const bs = (k === 0 ? 1.8 : 1.3 + R() * 0.4) * s;
      m4.compose(ps.set(x + Math.cos(a) * rr, y + th + (k === 0 ? 0.6 : 0.1 + R() * 0.6) * s, z + Math.sin(a) * rr),
        q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), sc.set(bs, bs * 0.85, bs));
      blobs.setMatrixAt(bi, m4);
      blobs.setColorAt(bi++, col.setHSL(0.27 + R() * 0.06, 0.55 + R() * 0.15, 0.27 + R() * 0.1));
    }
  }
  for (const [x, z] of pines) {
    const y = H(x, z), s = 0.9 + R() * 0.5;
    m4.compose(ps.set(x, y - 0.2, z), q.identity(), sc.set(s * 0.8, 1.6 * s, s * 0.8)); trunks.setMatrixAt(ti++, m4);
    world.addBox([x - 0.25 * s, y - 0.5, z - 0.25 * s], [x + 0.25 * s, y + 3 * s, z + 0.25 * s], cliff, { visible: false });
    const c = col.setHSL(0.33 + R() * 0.04, 0.5, 0.2 + R() * 0.06).clone();
    for (let k = 0; k < 3; k++) {
      const r = (2.1 - k * 0.55) * s, h = (2.6 - k * 0.3) * s;
      m4.compose(ps.set(x, y + (1.1 + k * 1.35) * s, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 3), sc.set(r, h, r));
      cones.setMatrixAt(ci, m4); cones.setColorAt(ci++, c);
    }
  }
  [trunks, blobs, cones].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });

  // Boulders
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.8 + hash(p.getX(i) * 9, p.getZ(i) * 7 + p.getY(i) * 3) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } rockGeo.computeVertexNormals(); }
  const rockMat = new THREE.MeshLambertMaterial({ map: rockT, flatShading: true });
  const rocksAt = place(26, 6);
  const rocks = instanced(rockGeo, rockMat, rocksAt.length);
  rocksAt.forEach(([x, z], i) => {
    const s = 0.9 + R() * 1.8, y = H(x, z);
    m4.compose(ps.set(x, y + s * 0.35, z), q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), sc.set(s * (1 + R() * 0.4), s * 0.8, s));
    rocks.setMatrixAt(i, m4);
    const e = s * 0.7;
    world.addBox([x - e, y - 0.5, z - e], [x + e, y + s * 0.95, z + e], rock, { visible: false });
  });
  rocks.instanceMatrix.needsUpdate = true;

  // Grass tufts and flowers (decoration only)
  const tuftGeo = new THREE.BufferGeometry();
  {
    const v = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      const cx = Math.cos(a) * 0.22, cz = Math.sin(a) * 0.22;
      v.push(-cx, 0, -cz, cx, 0, cz, 0, 0.45, 0);
    }
    tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    tuftGeo.computeVertexNormals();
  }
  const tuftMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const tuftsAt = [];
  const maxTufts = world.low ? 0 : 7000;
  for (let i = 0; i < 60000 && tuftsAt.length < maxTufts; i++) {
    const x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX), z = BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (Math.abs(x) > BOUNDS.maxX - 20 || Math.abs(z) > BOUNDS.maxZ - 20 || onPath(x, z, 3.2)) continue;
    if (Math.abs(z - creekZ(x)) < 6 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 1) continue;
    terrain.gradient(x, z, g2);
    if (Math.hypot(g2.x, g2.z) > 0.5) continue;
    tuftsAt.push([x, z]);
  }
  const tufts = instanced(tuftGeo, tuftMat, Math.max(1, tuftsAt.length), false);
  tufts.count = tuftsAt.length;
  tuftsAt.forEach(([x, z], i) => {
    const s = 0.7 + R() * 0.8;
    m4.compose(ps.set(x, H(x, z) - 0.02, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 3), sc.set(s, s * (0.8 + R() * 0.6), s));
    tufts.setMatrixAt(i, m4);
    tufts.setColorAt(i, col.setHSL(0.25 + R() * 0.06, 0.6, 0.3 + R() * 0.12));
  });
  tufts.instanceMatrix.needsUpdate = true; if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  const flowerGeo = new THREE.IcosahedronGeometry(0.09, 0);
  const flowers = instanced(flowerGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 900, false);
  for (let i = 0; i < 900; i++) {
    if (!tuftsAt.length) { flowers.count = 0; break; }
    const [x, z] = tuftsAt[Math.floor(R() * tuftsAt.length)];
    const fx = x + (R() - 0.5), fz = z + (R() - 0.5);
    m4.compose(ps.set(fx, H(fx, fz) + 0.3, fz), q.identity(), sc.set(1, 1, 1));
    flowers.setMatrixAt(i, m4);
    flowers.setColorAt(i, col.set([0xfff6a8, 0xffffff, 0xff8fb8, 0xb6a8ff][i % 4]));
  }
  flowers.instanceMatrix.needsUpdate = true; if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;

  // --- Coins ----------------------------------------------------------------------------
  const onGround = (x, z, up = 0.9) => coins.add(x, H(x, z) + up, z);
  for (let z = -110; z <= -104; z += 2) onGround(0, z);                      // spawn path
  { const [hx, hz] = HILLS[0]; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; onGround(hx + Math.cos(a) * 3, hz + Math.sin(a) * 3); } }
  for (let i = 0; i < 5; i++) coins.add(-8, deck + 0.9, bz0 + 2 + i * (bz1 - bz0 - 4) / 4);   // bridge
  for (const x of [-16, -1, 6]) onGround(x, creekZ(x));                      // in the creek
  for (let z = -62; z <= -44; z += 3.6) onGround(-34, z);                    // ramp
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; onGround(-12 + Math.cos(a) * 3, -18 + Math.sin(a) * 3); } // plateau
  for (let x = 32; x <= 48; x += 4) onGround(x, -20);                        // east slope
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; onGround(PEN.x + Math.cos(a) * 3.5, PEN.z + Math.sin(a) * 3.5); } // pen
  for (let f = 0.12; f < MTN.turns - 0.05; f += 0.14) { const [x, z] = roadCentre(f); onGround(x, z); } // the road
  for (const [x, y, z] of stones) coins.add(x, y + 0.9, z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; coins.add(IS.x + Math.cos(a) * 3, IS.y + 0.9, IS.z + Math.sin(a) * 3); }
  coins.add(IS.x, IS.y + 0.9, IS.z);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; onGround(SP.x + Math.cos(a) * 7, SP.z + Math.sin(a) * 7); } // summit
  coins.add(ledges[2][0], ledges[2][1] + 0.9, ledges[2][2]); coins.add(ledges[4][0], ledges[4][1] + 0.9, ledges[4][2]);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; coins.add(POND.x + Math.cos(a) * 6, POND.water + 0.9, POND.z + Math.sin(a) * 6); } // pond
  for (const [x, z] of BACK_PATH.slice(1)) onGround(x, z);
  { const [hx, hz] = HILLS[4]; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; onGround(hx + Math.cos(a) * 2.5, hz + Math.sin(a) * 2.5); } }

  return {
    spawn: new THREE.Vector3(0, H(0, -114), -114),
    spawnYaw: 0,
    star: new THREE.Vector3(SP.x, spireTop + 1.3, SP.z),
  };
}

// For tests and tooling.
export const layout = { MAIN_PATH, ROAD, MTN, roadCentre };
