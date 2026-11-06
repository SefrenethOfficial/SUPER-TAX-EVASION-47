import * as THREE from 'three';
import { FieldEnemy } from '../fieldenemy.js?v=49';
import { grassTuftTexture, brightWaterTexture, flowerTexture, plankTexture } from '../textures.js?v=49';

// ---------------------------------------------------------------------------
// OBSIDIAN FIELDLANDS: a wide, sunlit basin far below the beach, reached down
// a long grassy slope north of the grassland. Lost in the fog from above; step
// down into it and the fog lifts, the sky turns blue and its music starts.
//
// In the spirit of the Obsidian Fieldlands of Pokemon Legends: Arceus: rolling
// bright-green plains with big patches of tall grass, a river winding through
// from a waterfall over dark obsidian cliffs in the north, a lake ringed by
// cliffs in the west, a raised plateau of layered rock in the middle with a
// path climbing it, a deep forest with one enormous tree in the east, a
// flower meadow, a little camp where you come down, scattered trees and
// boulders, and a great hazy mountain on the horizon. Enemies roam the plains.
// It shares the beach's ground, so it's built from beach.js.
// ---------------------------------------------------------------------------

export const NAME = 'Obsidian Fieldlands';
export const MUSIC = 'obsidian-fieldlands.mp3';

export const FLOOR = -40;                    // the basin floor, way below the beach
export const SLOPE = { z0: 120, z1: 245 };  // the slope down to it
export const CENTRE = { x: 0, z: 360 };      // the middle of the fieldlands
const ENTER_Z = 236, LEAVE_Z = 224;          // where the fog lifts (and comes back)

// Landmarks
export const HEIGHTS = { x: 5, z: 398, r: 36, h: 16 };             // the plateau in the middle
const RAMP = { a: [-34, 344], b: [-16, 370], w: 7 };               // the path up onto it
export const LAKE = { x: -80, z: 342, r: 22 };                     // ringed by cliffs, open to the east
export const FALLS = { x: 30, top: 478, foot: 457, w: 9 };         // the waterfall in the north wall
export const POOL = { x: 30, z: 452, r: 8 };                       // the pool at its foot
export const FOREST = { x0: 64, x1: 120, z0: 292, z1: 372 };       // the deep forest, east
export const GREAT_TREE = { x: 92, z: 332 };
export const MEADOW = { x: -50, z: 284, r: 24 };                   // wildflowers
export const CAMP = { x: 16, z: 266 };
// The river: from the falls' pool, winding south round the plateau, then west into the lake.
export const RIVER = [[30, 452], [42, 438], [58, 420], [58, 398], [50, 376], [32, 352], [12, 334], [-10, 322], [-34, 322], [-52, 330], [-64, 338]];
const RIVER_W = 9;
// The obsidian: the dark glassy cliffs the falls pour over, and the black rocks round its pool.
export const OBSIDIAN = { x: 30, z: 468, r: 34 };
export const OBSIDIAN_GROUND = [{ x: 30, z: 456, r: 13 }];

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x, z, cx, cz, r, h) => { const d = Math.hypot(x - cx, z - cz) / r; return d < 1 ? h * (1 - d * d) * (1 - d * d) : 0; };
const lerp = (a, b, t) => a + (b - a) * t;

// Distance from (x, z) to a polyline (and the position along it, 0..1).
function polyDist(pts, x, z) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}
export const riverDist = (x, z) => polyDist(RIVER, x, z);

// A rock formation: a flat-topped stack with steep layered sides.
const stack = (x, z, cx, cz, r, h) => h * (1 - smooth(r * 0.6, r, Math.hypot(x - cx, z - cz) + 0.8 * Math.sin(Math.atan2(z - cz, x - cx) * 5 + cx)));
const STACKS = [[-22, 282, 7, 9], [58, 268, 6, 7], [-100, 296, 9, 13], [106, 410, 8, 11], [-58, 428, 7, 8], [-104, 380, 6, 10], [70, 456, 7, 9], [-14, 448, 5, 6]];

// Basin ground.
function basin(x, z) {
  // rolling plains, with a few broad hills
  let h = FLOOR + 1.6 * Math.sin(x * 0.045) * Math.sin(z * 0.05 + 1) + 0.7 * Math.sin(x * 0.11 + z * 0.07)
    + bump(x, z, -72, 432, 34, 9) + bump(x, z, -36, 458, 26, 7) + bump(x, z, 84, 452, 30, 8) + bump(x, z, -96, 268, 26, 6) + bump(x, z, 96, 268, 22, 5);
  // the plateau: steep cliffs all round...
  const dp = Math.hypot(x - HEIGHTS.x, z - HEIGHTS.z) + 1.6 * Math.sin(Math.atan2(z - HEIGHTS.z, x - HEIGHTS.x) * 5 + 1);
  let plat = HEIGHTS.h * (1 - smooth(HEIGHTS.r - 5, HEIGHTS.r, dp));
  // ...with a path climbing up its south-west side
  {
    const [ax, az] = RAMP.a, [bx, bz] = RAMP.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = ((x - ax) * dx + (z - az) * dz) / l2;
    if (t > -0.1 && t < 1.25) {
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      const k = 1 - smooth(RAMP.w * 0.5, RAMP.w * 0.5 + 2.5, d);
      plat = Math.max(plat, HEIGHTS.h * Math.max(0, Math.min(1, t)) * k);
    }
  }
  h += plat;
  // rock stacks
  for (const [cx, cz, r, sh] of STACKS) h += stack(x, z, cx, cz, r, sh);
  // the lake: a shallow bowl, ringed by cliffs except on its east side
  {
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z), a = Math.atan2(z - LAKE.z, x - LAKE.x);
    const open = 1 - smooth(0.55, 0.9, Math.abs(a));                  // the east side (angle near 0)
    const wall = 15 * smooth(LAKE.r + 1, LAKE.r + 6, dl) * (1 - smooth(LAKE.r + 10, LAKE.r + 22, dl)) * (1 - open);
    h = lerp(h, FLOOR - 1.4, 1 - smooth(LAKE.r - 5, LAKE.r + 0.5, dl)) + wall;
  }
  // the river's channel, and the pool under the falls
  h -= 2.1 * (1 - smooth(RIVER_W * 0.42, RIVER_W * 0.75, riverDist(x, z)));
  h -= 2.4 * (1 - smooth(POOL.r - 2, POOL.r + 2, Math.hypot(x - POOL.x, z - POOL.z)));
  return h;
}

// Wrap the beach's height function: the land drops away north of the grassland
// to the basin, and rock walls hem the slope and basin in.
export function withFieldlands(beachHeight) {
  return (x, z) => {
    const s = smooth(SLOPE.z0, SLOPE.z1, z);
    let h = lerp(beachHeight(x, z), basin(x, z), s);
    // walls: the beach's headlands widen out into the basin's cliffs
    const w = smooth(130, 255, z);
    const edge = Math.abs(x) - (lerp(70, 128, w) + 5 * Math.sin(z * 0.08) + 4 * Math.sin(z * 0.031 + 2));
    // ...with mountains rising behind them
    const crags = 1 + 0.45 * Math.max(0, Math.sin(z * 0.045 + x * 0.01)) + 0.25 * Math.sin(z * 0.11 + 1.3);
    h += lerp(0, 55, w) * smooth(0, 14, edge) * crags + w * 30 * smooth(12, 40, edge) * Math.max(0, Math.sin(z * 0.07 + (x > 0 ? 1.7 : 0)));
    // the far end: a cliff the river pours over
    h += 58 * smooth(455, 478, z) * (1 + 0.4 * Math.max(0, Math.sin(x * 0.06)));
    return h;
  };
}

// Paths: down the slope to the camp, on over the river to the plateau path.
export const PATH = { width: 4.5, points: [[0, 92], [5, 125], [-7, 160], [6, 195], [-3, 228], [2, 262], [-4, 290], [-8, 312], [-12, 330], [-30, 342], [-16, 370]] };
export const BRIDGE = { x: -9, z: 321 };     // where the path crosses the river


// A blue sky with drifting white clouds, for when the fog lifts.
function blueSky() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fc6'); grad.addColorStop(0.42, '#7fb4ea'); grad.addColorStop(0.5, '#cfe6f8'); grad.addColorStop(1, '#cfe6f8');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 512, y = 25 + rnd() * 95, r = 8 + rnd() * 22;
    for (let k = 0; k < 5; k++) {
      const cx = x + (rnd() - 0.5) * r * 2.5, cy = y + (rnd() - 0.5) * r * 0.5, cr = r * (0.5 + rnd() * 0.6);
      const cg = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0, 'rgba(255,255,255,0.7)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg;
      for (const dx of [-512, 0, 512]) { g.beginPath(); g.ellipse(cx + dx, cy, cr * 1.6, cr * 0.7, 0, 0, Math.PI * 2); g.fill(); }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -2;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(490, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  sky.onBeforeRender = (r, sc, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
  return sky;
}

// Low-poly trees, one InstancedMesh per part.
function forest(scene, list, { conifer }) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  const parts = conifer ? [
    [new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6).translate(0, 1.3, 0), 0x5c4632, false],
    [new THREE.ConeGeometry(2.3, 3.6, 7).translate(0, 3.2, 0), 0x2f5c36, true],
    [new THREE.ConeGeometry(1.85, 3.2, 7).translate(0, 5.0, 0), 0x356640, true],
    [new THREE.ConeGeometry(1.3, 2.8, 7).translate(0, 6.7, 0), 0x3b6e45, true],
  ] : [
    [new THREE.CylinderGeometry(0.2, 0.32, 3.0, 6).translate(0, 1.5, 0), 0x6a5038, false],
    [new THREE.IcosahedronGeometry(1.9, 0).translate(0, 4.2, 0), 0x4f8c3a, true],
    [new THREE.IcosahedronGeometry(1.5, 0).translate(1.2, 3.6, 0.5), 0x5a9a40, true],
    [new THREE.IcosahedronGeometry(1.4, 0).translate(-1.0, 3.8, -0.6), 0x4a8436, true],
    [new THREE.IcosahedronGeometry(1.2, 0).translate(0.2, 5.4, 0.3), 0x62a246, true],
  ];
  for (const [geo, c, leafy] of parts) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, s, r, tint], i) => {
      q.setFromEuler(e.set(0, r, 0));
      inst.setMatrixAt(i, m4.compose(ps.set(x, y - 0.15, z), q, sc.set(s, s * (0.92 + (tint % 0.16)), s)));
      inst.setColorAt(i, col.set(c).multiplyScalar(leafy ? 0.88 + tint * 0.28 : 1));
    });
    scene.add(inst);
  }
}

// The great tree in the forest: a vast trunk with buttress roots and a crown
// you can see from across the fieldlands.
function greatTree(scene, x, y, z) {
  const g = new THREE.Group();
  const bark = new THREE.MeshLambertMaterial({ color: 0x5e4836, flatShading: true });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x3f7a38, flatShading: true });
  const leaf2 = new THREE.MeshLambertMaterial({ color: 0x4f8f40, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 3.2, 24, 9), bark); trunk.position.y = 12;
  g.add(trunk);
  for (let i = 0; i < 6; i++) {        // roots
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 5), bark);
    r.position.set(Math.cos(a) * 3.2, 1.4, Math.sin(a) * 3.2); r.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    g.add(r);
  }
  for (let i = 0; i < 5; i++) {        // great boughs
    const a = (i / 5) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 9, 6), bark);
    b.position.set(Math.cos(a) * 3.6, 21, Math.sin(a) * 3.6); b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(b);
  }
  const blobs = [[0, 30, 0, 9], [6, 27, 2, 7], [-6, 27, -2, 7], [2, 26, -6, 6.5], [-2, 26, 6, 6.5], [0, 35, 0, 6], [5, 32, -4, 5], [-5, 32, 4, 5]];
  blobs.forEach(([bx, by, bz, r], i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), i % 2 ? leaf2 : leaf); m.position.set(bx, by, bz); g.add(m); });
  g.position.set(x, y - 0.5, z);
  scene.add(g);
}

// Water surfaces: a ribbon down the river, the lake and the pool, and the falls.
function water(scene, G) {
  const tex = brightWaterTexture();
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xd8f0ff, transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide });
  const meshes = [];
  // river: follow a smooth curve through the points
  {
    const curve = new THREE.CatmullRomCurve3(RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.ceil(curve.getLength() / 1.5), pos = [], uv = [], idx = [];
    const half = RIVER_W * 0.48;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t), d = curve.getTangent(t);
      const nx = -d.z, nz = d.x, l = Math.hypot(nx, nz) || 1;
      const y = G(p.x, p.z) + 1.35;
      for (const s of [-1, 1]) { pos.push(p.x + (nx / l) * half * s, y, p.z + (nz / l) * half * s); uv.push(s < 0 ? 0 : 1, t * n * 0.25); }
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    meshes.push(new THREE.Mesh(geo, mat));
  }
  const disc = (x, z, r, y) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); meshes.push(m); return m; };
  disc(LAKE.x, LAKE.z, LAKE.r + 1.5, FLOOR - 0.2);
  disc(POOL.x, POOL.z, POOL.r + 1, G(POOL.x, POOL.z) + 1.5);
  for (const m of meshes) { m.renderOrder = 1; scene.add(m); }
  // the falls: a sheet of water hugging the cliff, scrolling downwards
  const ftex = brightWaterTexture();
  ftex.repeat.set(2, 3);
  const fmat = new THREE.MeshBasicMaterial({ map: ftex, color: 0xeaf8ff, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide, fog: true });
  {
    const pos = [], uv = [], idx = [], steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, z = lerp(FALLS.top, FALLS.foot, t);
      for (const s of [-1, 1]) { const x = FALLS.x + s * FALLS.w / 2 * (1 - 0.15 * t); pos.push(x, G(x, z) + 0.45, z - 0.3); uv.push(s < 0 ? 0 : 1, t * 4); }
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const falls = new THREE.Mesh(geo, fmat); falls.renderOrder = 2;
    scene.add(falls);
  }
  // spray where it lands
  const spray = [];
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), sprayMat);
    m.position.set(FALLS.x + (Math.random() - 0.5) * 6, G(POOL.x, POOL.z) + 1.8, FALLS.foot - 1 - Math.random() * 3);
    m.userData.p = Math.random() * 6;
    scene.add(m); spray.push(m);
  }
  return (t) => {
    tex.offset.set(t * 0.01, -t * 0.12);
    ftex.offset.set(0, -t * 0.9);
    for (const m of spray) { const k = (t * 0.6 + m.userData.p) % 1; m.scale.setScalar(0.6 + k * 1.6); m.material.opacity = 0.3 * (1 - k); m.position.y = G(POOL.x, POOL.z) + 1.6 + k * 1.5; }
  };
}

// Mountains on the horizon, through the haze: one great peak and its range.
function farMountains(scene) {
  const rock = new THREE.MeshLambertMaterial({ color: 0x7d8aa6, flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: 0xeef2f8, flatShading: true });
  const peak = (x, z, r, h, seg = 7) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg, 1), rock); m.position.set(x, -40 + h / 2, z); m.rotation.y = x * 0.01;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, h * 0.28, seg, 1), snow); cap.position.set(x, -40 + h - h * 0.14 + 0.5, z); cap.rotation.y = m.rotation.y;
    scene.add(m, cap);
  };
  peak(300, 520, 170, 330, 9);                 // the great mountain
  for (const [x, z, r, h] of [[230, 600, 90, 170], [390, 430, 110, 200], [120, 640, 80, 140], [-120, 640, 100, 160], [-300, 560, 120, 190], [-380, 380, 90, 150], [420, 280, 80, 130]]) peak(x, z, r, h);
}

const stoneMat = () => new THREE.MeshLambertMaterial({ color: 0xa9a59a, flatShading: true });

// Build everything down in the basin. ctx: { world, scene, G, terrain, overcast (the grey sky mesh), rng, box }
export function build(ctx) {
  const { world, scene, G, terrain, overcast, rng, box } = ctx;

  // where things mustn't go: the river, the lake, the paths, the camp, the ramp
  const pathDist = (x, z) => polyDist(PATH.points, x, z);
  const clear = (x, z, pad = 0) => riverDist(x, z) > RIVER_W * 0.8 + pad && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 2 + pad
    && pathDist(x, z) > 4 + pad && Math.hypot(x - CAMP.x, z - CAMP.z) > 12 + pad && Math.hypot(x - POOL.x, z - POOL.z) > POOL.r + 3;
  const onPlateau = (x, z) => Math.hypot(x - HEIGHTS.x, z - HEIGHTS.z) < HEIGHTS.r - 6;
  const inForest = (x, z) => x > FOREST.x0 && x < FOREST.x1 && z > FOREST.z0 && z < FOREST.z1;
  const trunk = (x, y, z, r, h) => box([x - r, y - 0.5, z - r], [x + r, y + h, z + r], stoneMat(), { visible: false });

  // --- Trees: the deep forest, the plateau's woods, and scattered across the plains --
  const conifers = [], broad = [];
  const plant = (list, x, z, s) => { const y = G(x, z); list.push([x, y, z, s, rng() * 6.3, rng()]); trunk(x, y, z, 0.32 * s, 5 * s); };
  for (let i = 0; i < 170; i++) {
    const x = lerp(FOREST.x0, FOREST.x1, rng()), z = lerp(FOREST.z0, FOREST.z1, rng());
    if (!clear(x, z) || Math.hypot(x - GREAT_TREE.x, z - GREAT_TREE.z) < 9 || G(x, z) > FLOOR + 30) continue;
    if (rng() < 0.8) plant(conifers, x, z, 1.1 + rng() * 0.9); else plant(broad, x, z, 1.0 + rng() * 0.5);
  }
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (HEIGHTS.r - 7), x = HEIGHTS.x + Math.cos(a) * d, z = HEIGHTS.z + Math.sin(a) * d;
    if (Math.hypot(x - HEIGHTS.x, z - HEIGHTS.z) < 7) continue;                  // a clearing in the middle
    plant(conifers, x, z, 0.9 + rng() * 0.8);
  }
  for (let i = 0; i < 160; i++) {
    const x = (rng() - 0.5) * 230, z = 262 + rng() * 190;
    if (!clear(x, z, 2) || inForest(x, z) || onPlateau(x, z) || G(x, z) > FLOOR + 14) continue;
    if (Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r) continue;
    if (rng() < 0.55) plant(broad, x, z, 0.9 + rng() * 0.6); else plant(conifers, x, z, 0.8 + rng() * 0.7);
  }
  forest(scene, conifers, { conifer: true });
  forest(scene, broad, { conifer: false });
  { const y = G(GREAT_TREE.x, GREAT_TREE.z); greatTree(scene, GREAT_TREE.x, y, GREAT_TREE.z); trunk(GREAT_TREE.x, y, GREAT_TREE.z, 2.6, 24); }

  // --- Boulders and stones ----------------------------------------------------------
  {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const list = [];
    for (let i = 0; i < 70; i++) {
      const x = (rng() - 0.5) * 236, z = 262 + rng() * 196;
      if (!clear(x, z, 1)) continue;
      list.push([x, z, 0.5 + rng() * rng() * 2.4]);
    }
    const inst = new THREE.InstancedMesh(geo, stoneMat(), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach(([x, z, s], i) => {
      const y = G(x, z);
      inst.setMatrixAt(i, m4.compose(ps.set(x, y + s * 0.25, z), q.setFromEuler(e.set(rng() * 3, rng() * 3, rng() * 3)), sc.set(s, s * 0.72, s)));
      if (s > 0.9) box([x - s * 0.7, y - 0.5, z - s * 0.7], [x + s * 0.7, y + s * 0.6, z + s * 0.7], stoneMat(), { visible: false });
    });
    scene.add(inst);
  }
  // dark obsidian rocks round the pool under the falls
  {
    const glass = new THREE.MeshPhongMaterial({ color: 0x1a1820, specular: 0x8f86c8, shininess: 110, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.3, d = POOL.r + 2 + rng() * 5, x = POOL.x + Math.cos(a) * d, z = POOL.z + Math.sin(a) * d * 0.8;
      const s = 0.7 + rng() * 1.6, y = G(x, z);
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), glass);
      m.position.set(x, y + s * 0.4, z); m.rotation.set(rng() * 2, rng() * 3, rng() * 2); m.scale.y = 1.3;
      scene.add(m);
    }
  }

  // --- The bridge where the path crosses the river ----------------------------------
  {
    const b = BRIDGE, y = Math.max(G(b.x, b.z - 8), G(b.x, b.z + 8)) + 0.15;
    const planks = plankTexture();
    const deck = new THREE.MeshLambertMaterial({ map: planks, color: 0xc8b496 });
    const post = new THREE.MeshLambertMaterial({ map: planks, color: 0x8a7458 });
    box([b.x - 2.2, y - 0.4, b.z - 8.5], [b.x + 2.2, y, b.z + 8.5], deck);
    for (const s of [-1, 1]) {
      box([b.x + s * 2.1 - 0.08, y, b.z - 8.5], [b.x + s * 2.1 + 0.08, y + 1.0, b.z + 8.5], post);
      for (let k = -8; k <= 8; k += 4) box([b.x + s * 2.1 - 0.14, y - 2.5, b.z + k - 0.14], [b.x + s * 2.1 + 0.14, y + 1.1, b.z + k + 0.14], post);
    }
  }

  // --- The camp where the slope comes down: tents, a fire, crates -----------------------
  {
    const cloth = [0xe8dcc0, 0xc9b48a, 0xd8c8a4];
    const tent = (x, z, yaw, c) => {
      const y = G(x, z);
      const m = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 4, 1, true), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, flatShading: true }));
      m.position.set(x, y + 1.25, z); m.rotation.y = yaw + Math.PI / 4;
      scene.add(m);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.1, 5), new THREE.MeshLambertMaterial({ color: 0x5a4632 })); pole.position.set(x, y + 1.5, z);
      scene.add(pole);
      box([x - 1.3, y - 0.5, z - 1.3], [x + 1.3, y + 2.0, z + 1.3], stoneMat(), { visible: false });
    };
    tent(CAMP.x + 6, CAMP.z - 3, 0.3, cloth[0]); tent(CAMP.x + 9, CAMP.z + 4, -0.4, cloth[1]); tent(CAMP.x - 1, CAMP.z + 7, 0.9, cloth[2]);
    const fy = G(CAMP.x + 2, CAMP.z + 1);
    const logs = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 5), logs); l.rotation.set(Math.PI / 2, i * 0.8, 0); l.position.set(CAMP.x + 2, fy + 0.12, CAMP.z + 1); scene.add(l); }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xffa040 })); fire.position.set(CAMP.x + 2, fy + 0.4, CAMP.z + 1);
    scene.add(fire);
    ctx.campFire = fire;
    for (const [x, z] of [[CAMP.x + 11, CAMP.z - 1], [CAMP.x + 11.8, CAMP.z + 0.2]]) { const y = G(x, z); box([x - 0.5, y - 0.3, z - 0.5], [x + 0.5, y + 0.8, z + 0.5], new THREE.MeshLambertMaterial({ map: plankTexture(), color: 0xb09a7a })); }
    // a banner on a pole
    const py = G(CAMP.x - 4, CAMP.z - 2);
    box([CAMP.x - 4.08, py - 0.4, CAMP.z - 2.08], [CAMP.x - 3.92, py + 5, CAMP.z - 1.92], new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshLambertMaterial({ color: 0x3a6ab0, side: THREE.DoubleSide }));
    flag.position.set(CAMP.x - 3.2, py + 4.3, CAMP.z - 2); scene.add(flag);
    ctx.flag = flag;
  }

  // --- Tall grass, in big patches across the plains -------------------------------------
  const sway = { value: 0 };
  const swaying = (mat, amt) => {
    mat.onBeforeCompile = (sh) => {     // sway in the wind
      sh.uniforms.uTime = sway;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uTime * 1.6 + wp.x * 0.15 + wp.z * 0.11) * ${amt} * position.y;
transformed.x += sway; transformed.z += sway * 0.5;`);
    };
  };
  const scatter = (tex, w, h, spots, amt, color = 0xffffff) => {
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color });
    swaying(mat, amt);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const gg of [geo, geo.clone().rotateY(Math.PI / 2)]) {
      const inst = new THREE.InstancedMesh(gg, mat, spots.length);
      spots.forEach(([x, y, z, s, r], i) => inst.setMatrixAt(i, m4.compose(ps.set(x, y - 0.05, z), q.setFromEuler(e.set(0, r, 0)), sc.set(s, s, s))));
      inst.frustumCulled = false;
      scene.add(inst);
    }
  };
  {
    const spots = [];
    for (let p = 0; p < 34; p++) {
      const cx = (rng() - 0.5) * 220, cz = 268 + rng() * 180, r = 6 + rng() * 9;
      for (let i = 0; i < r * r * 2.2; i++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * (0.75 + 0.25 * Math.sin(a * 3 + p)), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!clear(x, z) || inForest(x, z)) continue;
        const y = G(x, z);
        if (y < FLOOR + 18) spots.push([x, y, z, 1.0 + rng() * 0.5, rng() * 3]);
      }
    }
    scatter(grassTuftTexture(), 1.5, 1.35, spots, 0.2);
  }
  // wildflowers: thick in the meadow, sprinkled everywhere else
  {
    const spots = [];
    for (let i = 0; i < 900; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * MEADOW.r, x = MEADOW.x + Math.cos(a) * d, z = MEADOW.z + Math.sin(a) * d;
      if (clear(x, z)) spots.push([x, G(x, z), z, 0.55 + rng() * 0.3, rng() * 3]);
    }
    for (let i = 0; i < 600; i++) {
      const x = (rng() - 0.5) * 230, z = 262 + rng() * 190;
      if (clear(x, z) && !inForest(x, z) && G(x, z) < FLOOR + 18) spots.push([x, G(x, z), z, 0.5 + rng() * 0.3, rng() * 3]);
    }
    scatter(flowerTexture(), 0.9, 0.8, spots, 0.08, 0xffffff);
  }

  const waterUpdate = water(scene, G);
  farMountains(scene);

  // --- Enemies roaming the plains ------------------------------------------------------
  const enemies = [
    ['shardling', -12, 282], ['shardling', 36, 300], ['thornback', -40, 312], ['shardling', 60, 336], ['shardling', -50, 368],
    ['thornback', 24, 362], ['shardling', -28, 420], ['thornback', 46, 430], ['shardling', 84, 420], ['thornback', -84, 440], ['shardling', 2, 446],
    ['shardling', -66, 296], ['shardling', -34, 300], ['shardling', 40, 318], ['shardling', 10, 410], ['shardling', 70, 300],
    ['thornback', -96, 400], ['thornback', 86, 380],
  ].map(([k, x, z]) => new FieldEnemy(scene, k, { x, z }, G));
  // --- Weather: the fog lifting (and the gloom over the Hollow Throne) -----------------
  // Three looks, blended between smoothly: grey beach fog, clear blue
  // fieldlands, and a dark, smoky gloom up on the throne plateau.
  const sky = blueSky();
  scene.add(sky);
  const hemi = [];
  scene.traverse((o) => { if (o.isHemisphereLight) hemi.push(o); });
  const look = (o) => ({ fog: new THREE.Color(o.fog), near: o.near, far: o.far, sun: o.sun, sunCol: new THREE.Color(o.sunCol), hemi: o.hemi, cloud: o.cloud, sat: o.sat, tint: o.tint, skyLum: o.skyLum ?? 1 });
  const LOOKS = {
    grey: look({ fog: scene.fog.color.getHex(), near: scene.fog.near, far: scene.fog.far, sun: world.sun.intensity, sunCol: world.sun.color.getHex(), hemi: hemi[0] ? hemi[0].intensity : 1.5, cloud: 1, sat: 0.6, tint: [0.92, 0.93, 0.94] }),
    clear: look({ fog: 0xd2e5f0, near: 50, far: 480, sun: 1.7, sunCol: 0xfff0d6, hemi: 2.0, cloud: 0, sat: 0.95, tint: [1.06, 1.04, 0.9] }),
    gloom: look({ fog: 0x2e2a30, near: 6, far: 120, sun: 0.35, sunCol: 0xd8b0a0, hemi: 0.85, cloud: 1, sat: 0.45, tint: [0.9, 0.82, 0.8], skyLum: 0.32 }),
  };
  const cur = look({ ...LOOKS.grey, fog: LOOKS.grey.fog.getHex(), sunCol: LOOKS.grey.sunCol.getHex() });
  overcast.material.transparent = true;
  let inside = false, clock = 0;

  return {
    enemies,
    get inside() { return inside; },
    // gloom: you're on the throne plateau. Returns true the moment you enter (or leave) the fieldlands.
    update(dt, player, gloom = false) {
      clock += dt;
      sway.value = clock;
      waterUpdate(clock);
      if (ctx.campFire) ctx.campFire.scale.set(1 + Math.sin(clock * 11) * 0.1, 1 + Math.sin(clock * 9) * 0.18, 1);
      if (ctx.flag) ctx.flag.rotation.y = Math.sin(clock * 1.7) * 0.25;
      const was = inside;
      if (!inside && player.pos.z > ENTER_Z) inside = true;
      if (inside && player.pos.z < LEAVE_Z) inside = false;
      const L = gloom ? LOOKS.gloom : inside ? LOOKS.clear : LOOKS.grey;
      const k = 1 - Math.exp(-dt * 1.3);
      cur.fog.lerp(L.fog, k); cur.sunCol.lerp(L.sunCol, k);
      for (const f of ['near', 'far', 'sun', 'hemi', 'cloud', 'sat', 'skyLum']) cur[f] = lerp(cur[f], L[f], k);
      cur.tint = cur.tint.map((v, i) => lerp(v, L.tint[i], k));
      scene.fog.color.copy(cur.fog);
      scene.background.copy(cur.fog);
      scene.fog.near = cur.near; scene.fog.far = cur.far;
      overcast.material.opacity = cur.cloud;
      overcast.material.color.setRGB(cur.skyLum, cur.skyLum * 0.95, cur.skyLum * 0.95);
      overcast.visible = cur.cloud > 0.002;
      world.sun.intensity = cur.sun;
      world.sun.color.copy(cur.sunCol);
      hemi.forEach((h) => { h.intensity = cur.hemi; });
      terrain.setGrade(cur.sat, ...cur.tint);
      return was !== inside;
    },
  };
}
