import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FieldEnemy } from '../fieldenemy.js?v=54';
import { NPC } from '../npc.js?v=54';
import { Pickup } from '../pickup.js?v=54';
import { save, store, flag, learn, addItem } from '../save.js?v=54';
import { mudTexture, leafTexture, redSandTexture, ashTexture, snowTexture, plankTexture } from '../textures.js?v=54';

// ---------------------------------------------------------------------------
// THE WILDS: five new lands out past the old walls of the world, each its own
// biome, reached through passes cut into the mountains.
//
//                Frostveil Pass        Ashen Peaks
//                      \                    |
//   Hollow Throne --- Obsidian Fieldlands --- Lantern Hollow --- Sunscorch Expanse
//                              |                                       |
//   Mirefen Marsh ---  Washed-Up Beach  ---  Emberleaf Woods ----------'
//
// Everything outside the old world is mountains, rising higher and higher
// towards the new edge of the map. Each land carves its own ground out of
// them; the passes join them up.
// ---------------------------------------------------------------------------

export const OLD = { minX: -262, maxX: 274, minZ: -46, maxZ: 482 };          // the world as it was
export const AREA = { minX: -660, maxX: 680, minZ: -60, maxZ: 940 };
// the grid is fine in the old world, coarser out in the wilds
export const SPANS = { x: [[-660, -262, 3], [-262, 274, 1.5], [274, 680, 3]], z: [[-60, -46, 1.4], [-46, 482, 1.5], [482, 940, 3]] };

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i, j) => {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vnoise = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.03 + 17, z * 2.03 - 9) * 0.3 + vnoise(x * 4.1 - 5, z * 4.1 + 31) * 0.15;
const bump = (x, z, cx, cz, r, h) => { const d = Math.hypot(x - cx, z - cz) / r; return d < 1 ? h * (1 - d * d) * (1 - d * d) : 0; };
// distance from (x, z) to a polyline, and how far along it the nearest point is
function polyNear(pts, x, z) {
  let best = Infinity, at = 0, along = 0, hAt = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ah = 0] = pts[i], [bx, bz, bh = 0] = pts[i + 1];
    const sx = bx - ax, sz = bz - az, L2 = sx * sx + sz * sz, L = Math.sqrt(L2);
    const t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / L2));
    const d = Math.hypot(x - (ax + sx * t), z - (az + sz * t));
    if (d < best) { best = d; at = along + t * L; hAt = ah + (bh - ah) * t; }
    along += L;
  }
  return { d: best, at, total: along, h: hAt };
}

// --- The five lands -----------------------------------------------------------------
export const WATER = 0.4;                                   // the marsh's still water
export const VOLCANO = { x: 70, z: 770, r: 160, h: 125 };   // the Ashen Peaks' dead volcano
export const CRATER = { r: 40, lake: 19, floor: 98 };
export const LAVA_Y = CRATER.floor + 1.3;
export const LAKE = { x: -470, z: 650, r: 58, y: 36 };      // Frostveil's frozen lake
export const SHRINE = { x: -330, z: 815, r: 52, h: 24 };
export const OASIS = { x: 410, z: 370, r: 24, y: -12, pool: 14 };
export const RIBS = { x: 525, z: 482 };
export const MESAS = [[565, 385, 22, 30], [432, 525, 18, 26], [605, 535, 26, 36], [372, 452, 13, 22], [560, 300, 15, 24]];
export const TOWER = { x: 440, z: 125, r: 38, h: 9 };
export const CHAPEL = { x: -470, z: 105 };
// rivers of lava running down the volcano's south side
export const LAVA = [
  [[66, 728], [58, 690], [72, 650], [52, 606], [38, 560]],
  [[92, 732], [124, 694], [140, 650], [176, 612]],
];

const crag = (x, z) => 1 - Math.abs(vnoise(x * 0.011 + 3, z * 0.011 - 7) * 2 - 1);
export const REGIONS = {
  marsh: {
    name: 'Mirefen Marsh', music: 'mirefen.mp3', cx: -390, cz: 75, rx: 215, rz: 130,
    floor: (x, z) => {
      let h = -0.6 + 1.9 * fbm(x * 0.02, z * 0.02);
      h = lerp(h, 1.25, 1 - smooth(14, 19, Math.hypot(x - CHAPEL.x, z - CHAPEL.z)));        // the chapel's island
      return h - 1.2 * (1 - smooth(-40, 5, z));                                              // into the sea at the south
    },
  },
  woods: {
    name: 'Emberleaf Woods', music: 'obsidian-fieldlands.mp3', cx: 390, cz: 95, rx: 220, rz: 135,
    floor: (x, z) => {
      let h = 3 + 10 * fbm(x * 0.012 + 40, z * 0.012);
      const d = Math.hypot(x - TOWER.x, z - TOWER.z);
      h += TOWER.h * (1 - smooth(TOWER.r * 0.25, TOWER.r, d));                              // the watchtower's hill
      return lerp(h, -1.5, 1 - smooth(-45, 15, z));                                         // down to the shore
    },
  },
  desert: {
    name: 'Sunscorch Expanse', music: 'ashen.mp3', cx: 485, cz: 440, rx: 180, rz: 175,
    floor: (x, z) => {
      // long dunes, rippling across the wind
      let h = -8 + 4.5 * Math.sin(x * 0.05 + 1.6 * Math.sin(z * 0.017)) * (0.5 + fbm(x * 0.01, z * 0.01)) + 3 * fbm(x * 0.03, z * 0.03);
      for (const [mx, mz, r, mh] of MESAS) {                                                // flat-topped mesas, sheer sides
        const d = Math.hypot(x - mx, z - mz) + 3 * Math.sin(Math.atan2(z - mz, x - mx) * 4 + mx);
        h = Math.max(h, lerp(h, -8 + mh, 1 - smooth(r * 0.82, r, d)));
      }
      const od = Math.hypot(x - OASIS.x, z - OASIS.z);
      h = lerp(h, OASIS.y + (od / OASIS.r) * 3, 1 - smooth(OASIS.r * 0.6, OASIS.r * 1.3, od));   // the oasis hollow
      h = lerp(h, -7.5, 1 - smooth(26, 36, Math.hypot(x - RIBS.x, z - RIBS.z)));               // flat round the bones
      return h;
    },
  },
  ashen: {
    name: 'Ashen Peaks', music: 'ashen.mp3', cx: 70, cz: 715, rx: 205, rz: 205,
    floor: (x, z) => {
      let h = 22 + 7 * fbm(x * 0.02, z * 0.02);
      const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z), u = d / VOLCANO.r;
      if (u < 1) h = Math.max(h, 22 + VOLCANO.h * Math.pow(1 - u, 1.15) + 3 * fbm(x * 0.05, z * 0.05));
      if (d < CRATER.r) h = CRATER.floor + 14 * (d / CRATER.r) ** 2;                          // the crater bowl
      if (d < CRATER.lake + 2) h = Math.min(h, CRATER.floor - 0.5);                           // the lava lake
      // the lava rivers' channels
      for (const L of LAVA) { const n = polyNear(L, x, z); if (n.d < 6) h -= 2.6 * (1 - smooth(2.6, 6, n.d)); }
      return h;
    },
  },
  frost: {
    name: 'Frostveil Pass', music: 'frostveil.mp3', cx: -410, cz: 705, rx: 225, rz: 205,
    floor: (x, z) => {
      let h = 42 + 18 * fbm(x * 0.01, z * 0.01) + 6 * fbm(x * 0.04, z * 0.04);
      h = lerp(h, LAKE.y, 1 - smooth(LAKE.r, LAKE.r + 34, Math.hypot(x - LAKE.x, z - LAKE.z)));
      const sd = Math.hypot(x - SHRINE.x, z - SHRINE.z);
      h += SHRINE.h * (1 - smooth(10, SHRINE.r, sd));                                        // the shrine's hill, flat on top
      return h;
    },
  },
};
for (const [k, R] of Object.entries(REGIONS)) R.key = k;
const ell = (R, x, z) => { const a = Math.atan2(z - R.cz, x - R.cx); return Math.hypot((x - R.cx) / R.rx, (z - R.cz) / R.rz) + 0.05 * Math.sin(a * 5 + R.cx * 0.01) + 0.035 * Math.sin(a * 9 + R.cz * 0.02); };
const inRegion = (R, x, z) => 1 - smooth(0.8, 1.0, ell(R, x, z));

// The passes: [x, z, height] along the middle of each, and how wide.
export const PASSES = [
  { to: 'marsh', w: 24, pts: [[-40, 25, 3], [-120, 32, 2.2], [-235, 50, 0.9]] },
  { to: 'woods', w: 24, pts: [[40, 25, 3], [120, 32, 3], [250, 60, 5]] },
  { to: 'desert', w: 18, pts: [[238, 318, -22], [300, 345, -15], [380, 380, -8]] },
  { to: 'desert', w: 18, pts: [[470, 150, 9], [475, 235, 1], [480, 320, -8]] },
  { to: 'ashen', w: 16, pts: [[85, 420, -40], [135, 455, -14], [120, 505, 12], [90, 560, 25]] },
  { to: 'frost', w: 16, fadeA: 3, pts: [[-205, 434, -8], [-212, 452, -7], [-222, 490, 6], [-262, 545, 28], [-320, 590, 48]] },
  { to: 'ashen', w: 18, pts: [[-270, 770, 48], [-185, 768, 44], [-60, 760, 40]] },
];

// The mountains everything else is: big, ragged, higher towards the edge of the world.
const base = (x, z) => {
  const edge = Math.min(x - AREA.minX, AREA.maxX - x, AREA.maxZ - z);
  return 70 + 60 * fbm(x * 0.007, z * 0.007) + 38 * crag(x, z) ** 2 + 120 * smooth(90, 0, edge);
};

// Wrap the old world's height function: mountains past its edges, then the lands and passes cut in.
export function withWilds(old) {
  return (x, z) => {
    const out = Math.max(OLD.minX - x, x - OLD.maxX, z - OLD.maxZ, 0);
    let h = out <= 0 ? old(x, z) : out < 35 ? lerp(old(x, z), base(x, z), smooth(0, 35, out)) : base(x, z);
    for (const R of Object.values(REGIONS)) {
      if (Math.abs(x - R.cx) > R.rx * 1.15 || Math.abs(z - R.cz) > R.rz * 1.15) continue;
      const m = inRegion(R, x, z);
      if (m > 0) h = lerp(h, R.floor(x, z), m);
    }
    for (const P of PASSES) {
      const n = polyNear(P.pts, x, z);
      if (n.d > P.w / 2 + 12) continue;
      const m = (1 - smooth(P.w / 2, P.w / 2 + 12, n.d)) * smooth(0, P.fadeA ?? 22, n.at) * smooth(0, 22, n.total - n.at);
      if (m > 0) h = lerp(h, n.h + 0.4 * Math.sin(x * 0.2) * Math.sin(z * 0.17), m);
    }
    return h;
  };
}

// How much of each biome's ground there is at (x, z): [marsh, woods, desert, snow, ash].
// height: the finished height function (for snow on the high peaks).
export function biomeWeights(height) {
  const order = ['marsh', 'woods', 'desert', 'frost', 'ashen'];
  return (x, z) => {
    const out = Math.max(OLD.minX - x, x - OLD.maxX, z - OLD.maxZ, 0);
    const wild = smooth(0, 25, out);
    const W = order.map((k) => {
      const R = REGIONS[k];
      let w = 1 - smooth(0.95, 1.5, ell(R, x, z));
      if (k === 'woods') w *= smooth(-25, 12, z);                     // sand along the shore
      // inside the old world, only where the land itself reaches in
      return w * Math.max(wild, inRegion(R, x, z));
    });
    // snow on the high peaks everywhere out here (not on the volcano)
    if (wild > 0) {
      const h = height(x, z);
      const caps = smooth(118, 140, h) * wild * (1 - W[4]);
      W[3] = Math.max(W[3], caps);
    }
    // the volcano's slopes are ash right up to the rim
    return W.map((w) => Math.max(0, Math.min(1, w)));
  };
}

// The ground textures and cliff tints for each biome, in the same order.
export const biomeLayers = () => [
  { ground: mudTexture(), cliff: [0.62, 0.66, 0.5], scale: 3 },
  { ground: leafTexture(), cliff: [0.85, 0.8, 0.7], scale: 2.5 },
  { ground: redSandTexture(), cliff: [1.35, 0.92, 0.66], scale: 3.5 },
  { ground: snowTexture(), cliff: [0.92, 0.96, 1.08], scale: 4 },
  { ground: ashTexture(), cliff: [0.36, 0.33, 0.34], scale: 3 },
];

// Dirt paths through the new lands.
export const PATHS = [
  { width: 3.5, points: [[480, 320], [460, 352], [430, 366], [470, 420], [510, 466]] },              // desert: pass, oasis, bones
  { width: 3.5, points: [[250, 60], [330, 80], [400, 108], [428, 122]] },                            // woods: to the tower
  { width: 3, points: [[90, 560], [60, 600], [96, 640], [70, 690], [44, 720], [60, 742]] },           // ashen: up the volcano
  { width: 3.5, points: [[-320, 590], [-380, 610], [-410, 655], [-400, 720], [-360, 770], [-336, 806]] },   // frost: past the lake to the shrine
];

// Which land (if any) you're in.
export function regionAt(x, z) {
  for (const R of Object.values(REGIONS)) if (ell(R, x, z) < 0.92) return R.key;
  return null;
}

// How each land looks: fog, light, sky. (See the weather in obsidian-fieldlands.js.)
export const LOOKS = {
  marsh: { fog: 0x4a5848, near: 4, far: 85, sun: 0.45, sunCol: 0xc8d8a8, hemi: 1.1, cloud: 1, sat: 0.55, tint: [0.86, 0.96, 0.82], skyLum: 0.55, sky: [0.8, 1, 0.8] },
  woods: { fog: 0xe2cba4, near: 30, far: 300, sun: 1.5, sunCol: 0xffd49a, hemi: 1.7, cloud: 0, sat: 1.05, tint: [1.08, 1.0, 0.86] },
  desert: { fog: 0xf0dab8, near: 70, far: 520, sun: 2.2, sunCol: 0xfff2d6, hemi: 2.2, cloud: 0, sat: 1.0, tint: [1.1, 1.03, 0.92] },
  ashen: { fog: 0x3c2822, near: 8, far: 170, sun: 0.7, sunCol: 0xff9a60, hemi: 0.95, cloud: 1, sat: 0.7, tint: [1.1, 0.86, 0.76], skyLum: 0.5, sky: [1.25, 0.6, 0.4] },
  frost: { fog: 0xd6dee8, near: 6, far: 120, sun: 0.9, sunCol: 0xe8f0ff, hemi: 1.8, cloud: 1, sat: 0.55, tint: [0.93, 0.98, 1.08], skyLum: 1.05, sky: [0.95, 1, 1.1] },
};

// Where you come round in each land after falling.
export const RESPAWNS = {
  marsh: [[-235, 50, -1.4], [CHAPEL.x + 10, CHAPEL.z - 8, -1], [-330, 55, -1.6]],
  woods: [[250, 60, 1.4], [TOWER.x - 14, TOWER.z - 10, 0.8], [520, 60, 0]],
  desert: [[380, 380, 1.2], [OASIS.x + 4, OASIS.z - 26, 0], [RIBS.x - 30, RIBS.z - 10, 1.4], [480, 330, 0]],
  ashen: [[90, 560, 0], [44, 720, 0], [-40, 640, 0.5]],
  frost: [[-320, 590, -0.8], [-410, 655, 0], [SHRINE.x, SHRINE.z - 14, 0]],
};

// ---------------------------------------------------------------------------
// Build everything in the wilds. ctx: { scene, G, box, rng, gibs, telegraph, fx (later) }
// ---------------------------------------------------------------------------
export function build(ctx) {
  const { scene, G, box, rng } = ctx;
  const updaters = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o });
  const hidden = lam(0x777777);
  const solid = (x, y, z, r, h) => box([x - r, y - 0.5, z - r], [x + r, y + h, z + r], hidden, { visible: false });
  // scatter: n spots inside a land, where ok(x, z, y) says so, kept apart from each other
  const scatter = (key, n, ok, gap = 4, tries = n * 30) => {
    const R = REGIONS[key], out = [];
    for (let t = 0; t < tries && out.length < n; t++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.9;
      const x = R.cx + Math.cos(a) * r * R.rx, z = R.cz + Math.sin(a) * r * R.rz;
      if (ell(R, x, z) > 0.86) continue;
      const y = G(x, z);
      if (!ok(x, z, y)) continue;
      if (out.some(([px, pz]) => Math.hypot(px - x, pz - z) < gap)) continue;
      out.push([x, z, y]);
    }
    return out;
  };
  const awayFromPaths = (x, z, pad = 4) => PATHS.every((p) => polyNear(p.points, x, z).d > p.width / 2 + pad);
  // put copies of a geometry at spots (one InstancedMesh), with optional per-copy colours
  const instance = (geo, mat, spots, place, colours) => {
    const im = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach((s, i) => { place(s, i); im.setMatrixAt(i, m4); if (colours) im.setColorAt(i, colours(i)); });
    im.castShadow = true; im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  const at = (x, y, z, s = 1, yaw = 0, tilt = 0) => { q.setFromEuler(eu.set(tilt * (rng() - 0.5), yaw, tilt * (rng() - 0.5))); m4.compose(ps.set(x, y, z), q, sc.set(s, s, s)); };
  const atS = (x, y, z, sx, sy, sz, yaw = 0) => { q.setFromEuler(eu.set(0, yaw, 0)); m4.compose(ps.set(x, y, z), q, sc.set(sx, sy, sz)); };

  // =====================================================================================
  // MIREFEN MARSH: black water, dead trees, reeds, boardwalks, a half-sunken chapel.
  // =====================================================================================
  {
    const R = REGIONS.marsh;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(R.rx * 2.3, R.rz * 2.3), new THREE.MeshLambertMaterial({ color: 0x24301e, transparent: true, opacity: 0.88, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set(R.cx, WATER, R.cz); water.renderOrder = 1;
    scene.add(water);
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(R.rx * 2.3, R.rz * 2.3), new THREE.MeshBasicMaterial({ color: 0x9aa890, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.set(R.cx, WATER + 0.02, R.cz); sheen.renderOrder = 1;
    scene.add(sheen);
    // dead trees: a twisted trunk with a few bare branches
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.18, 0.42, 6, 6, 4); trunk.translate(0, 3, 0);
    { const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 0.9) * 0.35); p.setZ(i, p.getZ(i) + Math.cos(y * 0.7) * 0.25); } }
    parts.push(trunk);
    for (const [y, a, l, tilt] of [[3.6, 0, 2.6, 0.9], [4.6, 2.2, 2.0, 0.8], [5.3, 4.1, 1.6, 0.7], [2.6, 3.4, 1.8, 1.1]]) {
      const b = new THREE.CylinderGeometry(0.05, 0.13, l, 4); b.translate(0, l / 2, 0); b.rotateZ(tilt); b.rotateY(a); b.translate(0, y, 0);
      parts.push(b);
    }
    const deadGeo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    deadGeo.computeVertexNormals();
    const deadSpots = scatter('marsh', 70, (x, z, y) => y > WATER - 0.5 && Math.hypot(x - CHAPEL.x, z - CHAPEL.z) > 22, 9);
    instance(deadGeo, lam(0x3a352e), deadSpots, ([x, z, y]) => at(x, y - 0.3, z, 0.8 + rng() * 0.7, rng() * 6.3, 0.25));
    for (const [x, z, y] of deadSpots) solid(x, y, z, 0.35, 5);
    // reeds in the shallows, lily pads on the water
    const reedSpots = scatter('marsh', 500, (x, z, y) => y > WATER - 0.6 && y < WATER + 0.4, 1.5, 6000);
    const reed = new THREE.ConeGeometry(0.05, 1.6, 3); reed.translate(0, 0.8, 0);
    instance(reed, lam(0x6a7442), reedSpots, ([x, z]) => at(x, WATER - 0.1, z, 0.8 + rng() * 0.6, rng() * 6.3, 0.4));
    const padSpots = scatter('marsh', 220, (x, z, y) => y < WATER - 0.25, 2, 4000);
    const pad = new THREE.CircleGeometry(0.5, 8, 0.3, Math.PI * 2 - 0.5); pad.rotateX(-Math.PI / 2);
    instance(pad, lam(0x4a6a32, { side: THREE.DoubleSide }), padSpots, ([x, z]) => at(x, WATER + 0.03, z, 0.6 + rng() * 0.8, rng() * 6.3));
    // boardwalks from the pass across the water to the chapel and beyond
    const plankMat = new THREE.MeshLambertMaterial({ map: plankTexture(), color: 0x8a7a64 });
    plankMat.userData.uvScale = 1.2;
    const walk = [[-215, 46], [-262, 58], [-318, 52], [-372, 70], [-420, 92], [CHAPEL.x + 14, CHAPEL.z - 3], [CHAPEL.x - 16, CHAPEL.z - 10], [-540, 70], [-575, 40]];
    const top = WATER + 0.55;
    const planks = [], posts = [];
    for (let i = 0; i < walk.length - 1; i++) {
      const [ax, az] = walk[i], [bx, bz] = walk[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.2), yaw = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < n; k++) {
        const x = lerp(ax, bx, (k + 0.5) / n), z = lerp(az, bz, (k + 0.5) / n);
        if (G(x, z) > top - 0.05) continue;                         // dry land: no need
        planks.push([x, z, yaw]);
        box([x - 0.85, top - 0.2, z - 0.85], [x + 0.85, top, z + 0.85], hidden, { visible: false });
        if (k % 4 === 0) for (const sd of [-1, 1]) posts.push([x + Math.cos(yaw) * 0.85 * sd, z - Math.sin(yaw) * 0.85 * sd, G(x, z)]);
      }
    }
    instance(new THREE.BoxGeometry(2.1, 0.18, 1.15), plankMat, planks, ([x, z, yaw]) => atS(x, top - 0.09, z, 1, 1, 1, yaw + (rng() - 0.5) * 0.06));
    const post = new THREE.CylinderGeometry(0.09, 0.11, 1, 5); post.translate(0, 0.5, 0);
    instance(post, plankMat, posts, ([x, z, y]) => atS(x, y - 0.3, z, 1, top - y + 0.5, 1));
    // the chapel: grey stone, half sunk and leaning, its spire snapped
    const stone = lam(0x6e6a62);
    const cy = G(CHAPEL.x, CHAPEL.z);
    const W = 7, D = 11, H = 5;
    const cx = CHAPEL.x, cz = CHAPEL.z;
    box([cx - W, cy - 1, cz - D], [cx - W + 0.8, cy + H, cz + D], stone);              // west wall
    box([cx + W - 0.8, cy - 1, cz - D], [cx + W, cy + H * 0.6, cz + D], stone);        // east wall, broken down
    box([cx - W, cy - 1, cz + D - 0.8], [cx + W, cy + H, cz + D], stone);              // back wall
    box([cx - W, cy - 1, cz - D], [cx - 2, cy + H, cz - D + 0.8], stone);              // front, either side of the door
    box([cx + 2, cy - 1, cz - D], [cx + W, cy + H * 0.8, cz - D + 0.8], stone);
    box([cx - 2, cy + 3.4, cz - D], [cx + 2, cy + H, cz - D + 0.8], stone);           // over the door
    box([cx - 1.4, cy - 0.5, cz + D - 4], [cx + 1.4, cy + 1.1, cz + D - 2.2], stone);  // the altar
    const spire = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 4), stone); tower.position.y = 4.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5, 4), lam(0x3a3a3e)); cap.position.y = 11.2; cap.rotation.y = Math.PI / 4;
    spire.add(tower, cap);
    spire.position.set(cx + 3, cy - 1.2, cz + D + 2.5); spire.rotation.set(-0.18, 0, 0.22);
    scene.add(spire);
    solid(cx + 3.6, cy, cz + D + 2.6, 2, 8);
    // fireflies
    ctx.fireflies = true;
  }

  // =====================================================================================
  // EMBERLEAF WOODS: autumn trees, falling leaves, mossy ruins, a watchtower to climb.
  // =====================================================================================
  const tower = { x: TOWER.x, z: TOWER.z };
  {
    // a broadleaf tree: trunk and a cloud of leaves in reds, oranges and gold
    const trunk = new THREE.CylinderGeometry(0.25, 0.42, 5, 6); trunk.translate(0, 2.5, 0);
    const blobs = [[0, 6, 0, 2.4], [1.4, 5.2, 0.6, 1.7], [-1.3, 5.4, -0.5, 1.8], [0.3, 7.3, -0.4, 1.6], [-0.4, 5.0, 1.3, 1.5]];
    const canopy = mergeGeometries(blobs.map(([x, y, z, r]) => { const g = new THREE.IcosahedronGeometry(r, 1); g.translate(x, y, z); return g.toNonIndexed(); }));
    canopy.computeVertexNormals();
    const spots = scatter('woods', 420, (x, z, y) => y > 1.5 && awayFromPaths(x, z, 3) && Math.hypot(x - TOWER.x, z - TOWER.z) > 16, 5.5, 20000);
    const palette = [0xb8401c, 0xd2681e, 0xe0a030, 0x9a3418, 0xc8862a, 0x7a8a3a, 0xd85a22];
    const col = new THREE.Color();
    instance(trunk, lam(0x4a3a2c), spots, ([x, z, y], i) => at(x, y - 0.2, z, spots[i][3] = 0.9 + rng() * 0.6, rng() * 6.3, 0.1));
    instance(canopy, lam(0xffffff), spots, ([x, z, y, s]) => at(x, y - 0.2, z, s, rng() * 6.3), (i) => col.setHex(palette[Math.floor(rng() * palette.length)]).multiplyScalar(0.85 + rng() * 0.3));
    for (const [x, z, y] of spots) solid(x, y, z, 0.4, 5);
    // mossy ruins scattered through the trees
    const mossy = lam(0x6a7058);
    for (const [x, z, w, d, h] of [[360, 70, 8, 1, 2.4], [372, 64, 1, 6, 1.6], [500, 150, 1, 9, 3], [505, 140, 6, 1, 1.4], [300, 120, 5, 1, 2]]) {
      const y = G(x, z);
      box([x - w / 2, y - 1, z - d / 2], [x + w / 2, y + h, z + d / 2], mossy);
    }
    // the watchtower: a square stone tower with stairs winding up the outside
    const ty = G(TOWER.x, TOWER.z), S = 3.2, TH = 16;
    const towerStone = lam(0x86826e);
    box([TOWER.x - S, ty - 2, TOWER.z - S], [TOWER.x + S, ty + TH, TOWER.z + S], towerStone);
    // stairs: up round the four sides
    let y = ty, side = 0, k = 0;
    const steps = Math.ceil(TH / 0.28);
    const perSide = 10;
    for (let i = 0; i < steps; i++) {
      y = ty + (i + 1) * 0.28;
      if (y > ty + TH) break;
      const f = (i % perSide) / perSide, s = Math.floor(i / perSide) % 4;
      let x0, z0;
      const L = 2 * S + 1.2;
      if (s === 0) { x0 = TOWER.x - S - 0.6 + f * L; z0 = TOWER.z - S - 0.9; }
      else if (s === 1) { x0 = TOWER.x + S + 0.9; z0 = TOWER.z - S - 0.6 + f * L; }
      else if (s === 2) { x0 = TOWER.x + S + 0.6 - f * L; z0 = TOWER.z + S + 0.9; }
      else { x0 = TOWER.x - S - 0.9; z0 = TOWER.z + S + 0.6 - f * L; }
      box([x0 - 0.75, y - 0.4, z0 - 0.75], [x0 + 0.75, y, z0 + 0.75], towerStone);
      side = s; k = i;
    }
    // battlements on top
    for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) box([TOWER.x + i * S - 0.5 - (i > 0 ? 0 : 0), ty + TH, TOWER.z + j * S - 0.5], [TOWER.x + i * S + 0.5, ty + TH + 1.1, TOWER.z + j * S + 0.5], towerStone);
    tower.top = ty + TH;
  }

  // =====================================================================================
  // SUNSCORCH EXPANSE: red dunes, mesas, an oasis, the bones of something enormous.
  // =====================================================================================
  {
    // the oasis pool and its palms
    const pool = new THREE.Mesh(new THREE.CircleGeometry(OASIS.pool, 28), new THREE.MeshLambertMaterial({ color: 0x3a8a9a, transparent: true, opacity: 0.85, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(OASIS.x, OASIS.y + 1.1, OASIS.z); pool.renderOrder = 1;
    scene.add(pool);
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 6, 6); trunk.translate(0, 3, 0);
    const frond = new THREE.ConeGeometry(2.2, 1.2, 7, 1, true); frond.translate(0, 6.2, 0);
    const palmSpots = [];
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + rng() * 0.3, r = OASIS.pool + 3 + rng() * 5; const x = OASIS.x + Math.cos(a) * r, z = OASIS.z + Math.sin(a) * r; palmSpots.push([x, z, G(x, z)]); }
    instance(trunk, lam(0x7a6650), palmSpots, ([x, z, y]) => at(x, y, z, 1, 0, 0.2));
    instance(frond, lam(0x4a7a36, { side: THREE.DoubleSide }), palmSpots, ([x, z, y]) => at(x, y, z, 1, rng() * 6.3));
    for (const [x, z, y] of palmSpots) solid(x, y, z, 0.3, 5);
    // bleached bones: a spine, an arch of ribs, and a skull
    const bone = lam(0xe8dcc0);
    const by = G(RIBS.x, RIBS.z);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 58, 8), bone);
    spine.rotation.z = Math.PI / 2; spine.position.set(RIBS.x, by + 11, RIBS.z);
    scene.add(spine);
    for (let i = 0; i < 9; i++) {
      const x = RIBS.x - 24 + i * 5.5, s = 1 - Math.abs(i - 3.5) * 0.07;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(11 * s, 0.55, 6, 18, Math.PI), bone);
      rib.rotation.y = Math.PI / 2; rib.position.set(x, by + 11 - 11 * s + 0.2, RIBS.z);
      rib.scale.y = 1.05;
      scene.add(rib);
      for (const sgn of [-1, 1]) solid(x, by, RIBS.z + sgn * 11 * s, 0.6, 3);
    }
    const skull = new THREE.Group();
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), bone); cranium.scale.set(1.3, 0.8, 0.9);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 5), bone); snout.position.set(7, -1.5, 0);
    const socket = lam(0x2a2018);
    for (const z of [-2.4, 2.4]) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), socket); s.position.set(3.5, 1, z); skull.add(s); }
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 5), bone); t.position.set(5 + i * 1.4, -3.6, (i % 2 ? 1.6 : -1.6)); t.rotation.x = Math.PI; skull.add(t); }
    skull.add(cranium, snout);
    skull.position.set(RIBS.x + 34, by + 3.2, RIBS.z + 2); skull.rotation.set(0, -0.2, -0.25);
    scene.add(skull);
    box([RIBS.x + 27, by - 1, RIBS.z - 5], [RIBS.x + 41, by + 6, RIBS.z + 6], hidden, { visible: false });
    // small bones and dry scrub about the sand
    const small = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 5); small.rotateZ(Math.PI / 2);
    instance(small, bone, scatter('desert', 90, (x, z, y) => y < 2, 6), ([x, z, y]) => at(x, y + 0.08, z, 0.7 + rng(), rng() * 6.3));
    const scrub = new THREE.IcosahedronGeometry(0.6, 0); scrub.scale(1, 0.6, 1);
    instance(scrub, lam(0x8a7a4a), scatter('desert', 160, (x, z, y) => y < 2 && awayFromPaths(x, z), 4), ([x, z, y]) => at(x, y + 0.2, z, 0.6 + rng() * 0.8, rng() * 6.3));
    const rocky = new THREE.DodecahedronGeometry(1, 0);
    instance(rocky, lam(0x9a5a3a), scatter('desert', 70, (x, z, y) => y < 4 && awayFromPaths(x, z), 8), ([x, z, y]) => at(x, y + 0.3, z, 0.6 + rng() * 1.6, rng() * 6.3, 0.6));
  }

  // =====================================================================================
  // ASHEN PEAKS: black rock and ash, lava rivers, basalt spires, the dead volcano.
  // =====================================================================================
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a14 });
  const lavaTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ff5a14'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 128, y = Math.random() * 128, r = 6 + Math.random() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const hot = Math.random() < 0.5;
      gr.addColorStop(0, hot ? 'rgba(255,220,90,0.8)' : 'rgba(120,20,8,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  lavaMat.map = lavaTex; lavaMat.color.set(0xffffff);
  {
    // the rivers: ribbons following their channels
    for (const L of LAVA) {
      const pts = [];
      for (let i = 0; i < L.length - 1; i++) {
        const [ax, az] = L[i], [bx, bz] = L[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2);
        for (let k = 0; k < n; k++) pts.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]);
      }
      pts.push(L[L.length - 1]);
      const pos = [], uv = [], idx = [];
      let along = 0;
      pts.forEach(([x, z], i) => {
        const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)], [px, pz] = pts[Math.max(0, i - 1)];
        let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        if (i) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
        const y = G(x, z) + 0.7;
        for (const s of [-1, 1]) { pos.push(x - dz * 2.9 * s, y, z + dx * 2.9 * s); uv.push(s < 0 ? 0 : 1, along / 8); }
        if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, lavaMat);
      m.material.side = THREE.DoubleSide;
      scene.add(m);
    }
    // the crater's lava lake
    const lake = new THREE.Mesh(new THREE.CircleGeometry(CRATER.lake + 2.5, 32), lavaMat);
    lake.rotation.x = -Math.PI / 2; lake.position.set(VOLCANO.x, LAVA_Y, VOLCANO.z);
    scene.add(lake);
    const glow = new THREE.PointLight(0xff6a20, 400, 90, 1.4); glow.position.set(VOLCANO.x, LAVA_Y + 8, VOLCANO.z);
    scene.add(glow);
    updaters.push((t) => { lavaTex.offset.set(t * 0.02, -t * 0.08); glow.intensity = 380 + Math.sin(t * 3) * 60; });
    // basalt spires: tall hexagonal columns in clusters
    const col = new THREE.CylinderGeometry(1, 1, 1, 6); col.translate(0, 0.5, 0);
    const spires = [];
    for (const [x0, z0] of scatter('ashen', 14, (x, z, y) => y < 60 && awayFromPaths(x, z, 8), 30)) {
      for (let i = 0; i < 6; i++) { const x = x0 + (rng() - 0.5) * 8, z = z0 + (rng() - 0.5) * 8; spires.push([x, z, G(x, z), 4 + rng() * 9]); }
    }
    instance(col, lam(0x2a2628), spires, ([x, z, y, h]) => atS(x, y - 1, z, 0.9 + rng() * 0.5, h + 1, 0.9 + rng() * 0.5, rng()));
    for (const [x, z, y, h] of spires) solid(x, y, z, 0.9, h);
    // charred trees
    const dead = new THREE.CylinderGeometry(0.1, 0.3, 5, 5); dead.translate(0, 2.5, 0);
    instance(dead, lam(0x161414), scatter('ashen', 80, (x, z, y) => y < 50 && awayFromPaths(x, z), 6), ([x, z, y]) => at(x, y - 0.2, z, 0.7 + rng() * 0.6, rng() * 6.3, 0.4));
    // vents puffing smoke and embers
    ctx.vents = scatter('ashen', 10, (x, z, y) => y < 70 && awayFromPaths(x, z, 6), 30);
  }

  // =====================================================================================
  // FROSTVEIL PASS: snow, pines, a frozen lake, an ice shrine.
  // =====================================================================================
  {
    // pines with snow on their branches
    const trunk = new THREE.CylinderGeometry(0.16, 0.28, 2.4, 6); trunk.translate(0, 1.2, 0);
    const cones = [new THREE.ConeGeometry(2.0, 3.0, 7), new THREE.ConeGeometry(1.55, 2.6, 7), new THREE.ConeGeometry(1.05, 2.2, 7)];
    cones.forEach((g, k) => g.translate(0, 2.5 + k * 1.55, 0));
    const caps = cones.map((g) => { const c = g.clone(); c.scale(0.92, 0.45, 0.92); c.translate(0, 0, 0); return c; });
    caps.forEach((g, k) => g.translate(0, 1.4 + k * 0.85, 0));
    const spots = scatter('frost', 380, (x, z, y) => Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 6 && Math.hypot(x - SHRINE.x, z - SHRINE.z) > 16 && awayFromPaths(x, z, 3), 6, 20000);
    const place = ([x, z, y], i) => at(x, y - 0.2, z, spots[i][3] || (spots[i][3] = 1 + rng() * 0.8), spots[i][4] || (spots[i][4] = rng() * 6.3));
    instance(trunk, lam(0x3e342c), spots, place);
    const needles = lam(0x2a3a30), snowy = lam(0xeef2f8);
    cones.forEach((g) => instance(g, needles, spots, place));
    caps.forEach((g) => instance(g, snowy, spots, place));
    for (const [x, z, y] of spots) solid(x, y, z, 0.3, 5);
    // the frozen lake: pale, glassy ice
    const ice = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 3, 40), new THREE.MeshPhongMaterial({ color: 0xbfd8ec, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.92 }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(LAKE.x, LAKE.y + 0.06, LAKE.z); ice.renderOrder = 1;
    scene.add(ice);
    // the shrine: a ring of ice pillars round a stone dais
    const sy = G(SHRINE.x, SHRINE.z);
    const stone = lam(0x8a8e96);
    box([SHRINE.x - 5, sy - 1, SHRINE.z - 5], [SHRINE.x + 5, sy + 0.5, SHRINE.z + 5], stone);
    const crystal = new THREE.MeshPhongMaterial({ color: 0xb8e6ff, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.8, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = SHRINE.x + Math.cos(a) * 8, z = SHRINE.z + Math.sin(a) * 8, h = 4 + (i % 3) * 1.5;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.8, h, 5), crystal);
      p.position.set(x, G(x, z) + h / 2 - 0.3, z); p.rotation.set((rng() - 0.5) * 0.2, rng() * 3, (rng() - 0.5) * 0.2);
      scene.add(p);
      solid(x, G(x, z), z, 0.6, h);
    }
    // a figure frozen into a block of ice, behind the dais
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 1.8), crystal);
    block.position.set(SHRINE.x, sy + 2.3, SHRINE.z + 4.2);
    scene.add(block);
    box([SHRINE.x - 1.2, sy, SHRINE.z + 3.3], [SHRINE.x + 1.2, sy + 4, SHRINE.z + 5.1], hidden, { visible: false });
  }

  // =====================================================================================
  // People: a merchant at the oasis, and the shrine's keeper
  // =====================================================================================
  const npcs = {
    merchant: new NPC(scene, { name: 'Sabra', pos: { x: OASIS.x - 8, z: OASIS.z - 18 }, ground: G, yaw: 0.6,
      look: { skin: 0x9a6a48, shirt: 0xc8a060, pants: 0x6a4a30, hat: 'hood', hatColor: 0xd8c090, cloak: 0xb08850, height: 1.8 } }),
    keeper: new NPC(scene, { name: 'Sister Isolde', pos: { x: SHRINE.x + 2.2, z: SHRINE.z - 1.5 }, ground: (x, z) => G(SHRINE.x, SHRINE.z) + 0.5, yaw: Math.PI,
      look: { skin: 0xe2c8b4, shirt: 0xd8e2ee, pants: 0x9aa6b8, hat: 'hood', hatColor: 0xe8eef6, cloak: 0xc8d4e2, height: 1.75 } }),
  };
  // the merchant's tent
  {
    const cloth = new THREE.MeshLambertMaterial({ color: 0xb8442a, side: THREE.DoubleSide, flatShading: true });
    const tx = OASIS.x - 11, tz = OASIS.z - 20, ty = G(tx, tz);
    const tent = new THREE.Mesh(new THREE.ConeGeometry(4, 3.4, 4, 1, true), cloth);
    tent.position.set(tx, ty + 1.7, tz); tent.rotation.y = Math.PI / 4;
    scene.add(tent);
    for (const [x, z] of [[2.6, 1.2], [3.4, -0.4]]) { const cr = box([tx + x - 0.45, ty - 0.2, tz + z - 0.45], [tx + x + 0.45, ty + 0.8, tz + z + 0.45], lam(0x8a6a44)); }
  }

  const talks = {
    merchant: (game) => {
      const first = !save.flags.metSabra;
      flag('metSabra');
      return game.talk([
        ...(first ? [
          { who: 'Sabra', text: "Ho there! A customer, out here? You must've come through the hollow. Or crawled out of the sea." },
          { who: 'Sabra', text: "Sabra. I trade. Water for stories, mostly. Nobody carries coin any more." },
        ] : [{ who: 'Sabra', text: 'Back for more stories? Sit, sit. Mind the scorpions.' }]),
        { who: 'Sabra', text: 'What can I do for you?', choices: ['Trade a story', 'What are the bones?', 'Any advice?', 'Goodbye'],
          then: (k) => {
            if (k === 0) {
              if (save.flags.tradedSabra) return [{ who: 'Sabra', text: "You've already told me that one. Twice! Come back when you've got a new one." }];
              return [
                { who: '', text: 'You tell her about the wreck, the shy ghost on the beach, the knight on the throne...' },
                { who: 'Sabra', text: "Ha! Now that's a story. Here, take these. Fair's fair.", onShow: () => { flag('tradedSabra'); addItem('salve', 1); addItem('tonic', 2); addItem('ember', 1); store(); } },
                { who: '', text: 'Got a Hearth Salve, 2 Tonics and an Ember Flask.' },
              ];
            }
            if (k === 1) return [
              { who: 'Sabra', text: "Something that walked here when the sea was sand and the sand was sea. Nobody knows what." },
              { who: 'Sabra', text: "The beetles nest round it. They swim through the sand like it's water. Watch the ground: when it glows red, move." },
            ];
            if (k === 2) return [
              { who: 'Sabra', text: "North and west of the old fields there's a pass up into the snow. A woman keeps a shrine up there." },
              { who: 'Sabra', text: "She taught me to dance out of a sandstorm's way. Might teach you, if you ask nicely." },
            ];
            return [{ who: 'Sabra', text: 'Water, shade, and keep moving. Safe travels.' }];
          } },
      ]);
    },
    keeper: (game) => {
      if (save.learned.includes('miststep')) return game.talk([{ who: 'Sister Isolde', text: 'Be like the snow on the wind. Nothing that strikes it ever holds it.' }]);
      return game.talk([
        { who: 'Sister Isolde', text: "...You climbed through the blizzard to reach me. The wraiths didn't stop you." },
        { who: 'Sister Isolde', text: 'They are the ones who came before. They wait for the ice to let go of them, as it let go of me.' },
        { who: 'Sister Isolde', text: 'You fight like a stone: you stand, you take the blow. Learn to be mist instead.' },
        { who: 'Sister Isolde', text: 'When you slide, when you dive, give yourself to the motion. Nothing can hold what is already moving.' },
        { who: '', text: 'You learned Mist Step! While you slide, dive or belly slide, attacks pass straight through you.', onShow: () => learn('miststep') },
      ]);
    },
  };

  // =====================================================================================
  // Things to find
  // =====================================================================================
  const pickups = [
    { id: 'salve-chapel', item: 'salve', count: 2, x: CHAPEL.x, z: CHAPEL.z + 6 },
    { id: 'herb-marsh', item: 'herb', count: 2, x: -330, z: 54 },
    { id: 'herb-tower', item: 'herb', count: 3, x: TOWER.x, z: TOWER.z, y: tower.top },
    { id: 'tonic-tower', item: 'tonic', x: TOWER.x + 1.5, z: TOWER.z + 1.5, y: tower.top },
    { id: 'herb-woods', item: 'herb', x: 520, z: 60 },
    { id: 'ember-ribs', item: 'ember', count: 2, x: RIBS.x, z: RIBS.z },
    { id: 'cinderaxe', weapon: 'cinderaxe', x: VOLCANO.x + 28, z: VOLCANO.z + 6 },
    { id: 'ember-ashen', item: 'ember', count: 2, x: 44, z: 720 },
    { id: 'tonic-lake', item: 'tonic', count: 2, x: LAKE.x + LAKE.r + 6, z: LAKE.z },
    { id: 'herb-shrine', item: 'herb', count: 2, x: SHRINE.x - 3, z: SHRINE.z - 3 },
  ].map((p) => new Pickup(scene, { ...p, pos: new THREE.Vector3(p.x, p.y ?? G(p.x, p.z) + (p.id === 'herb-shrine' ? 0.5 : 0), p.z) }));

  // =====================================================================================
  // The creatures of each land
  // =====================================================================================
  const enemies = [];
  const spawn = (kind, list) => { for (const [x, z] of list) enemies.push(new FieldEnemy(scene, kind, { x, z }, G)); };
  const R = (k, n, ok, gap) => scatter(k, n, ok, gap, n * 80);
  spawn('boglurker', R('marsh', 10, (x, z, y) => y < WATER - 0.3 && x < -230, 22));
  spawn('barkling', R('woods', 10, (x, z, y) => y > 2 && x > 270, 26).map(([x, z]) => [x, z]));
  spawn('dunescuttler', R('desert', 11, (x, z, y) => y < 0 && Math.hypot(x - OASIS.x, z - OASIS.z) > 30, 26));
  spawn('cinderhound', R('ashen', 11, (x, z, y) => y < 70 && Math.hypot(x - VOLCANO.x, z - VOLCANO.z) > 50, 28));
  spawn('rimewraith', R('frost', 10, (x, z, y) => Math.hypot(x - SHRINE.x, z - SHRINE.z) > 25, 30));
  for (const e of enemies) if (e.kind.hide === 'water') e.waterY = WATER;

  // =====================================================================================
  // Weather you can see: leaves, snow, ash, fireflies, blowing sand, near you
  // =====================================================================================
  const N = 700, box3 = new THREE.Vector3(60, 26, 60);
  const pPos = new Float32Array(N * 3), pSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pPos[i * 3] = (rng() - 0.5) * box3.x; pPos[i * 3 + 1] = rng() * box3.y; pPos[i * 3 + 2] = (rng() - 0.5) * box3.z; pSeed[i] = rng() * 100; }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const dot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const pMat = new THREE.PointsMaterial({ size: 0.25, map: dot, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  const PARTICLES = {
    woods: { color: 0xd8702a, size: 0.32, fall: 1.1, sway: 1.2, blend: THREE.NormalBlending, opacity: 0.9 },
    frost: { color: 0xffffff, size: 0.22, fall: 2.6, sway: 0.8, blend: THREE.NormalBlending, opacity: 0.95 },
    ashen: { color: 0x9a8e88, size: 0.2, fall: 0.6, sway: 0.5, blend: THREE.NormalBlending, opacity: 0.8, embers: true },
    marsh: { color: 0xd8f070, size: 0.18, fall: 0, sway: 0.4, blend: THREE.AdditiveBlending, opacity: 0.9, hover: true },
    desert: { color: 0xe8c48a, size: 0.12, fall: 0, sway: 0, blend: THREE.NormalBlending, opacity: 0.55, wind: 12 },
  };
  let pKind = null, pFade = 0;
  const particles = (dt, t, P, region) => {
    const want = region && PARTICLES[region];
    if (want && pKind !== want) { if (pFade < 0.05 || !pKind) { pKind = want; pMat.color.set(want.color); pMat.size = want.size; pMat.blending = want.blend; pMat.needsUpdate = true;
      // scatter them round you afresh
      for (let i = 0; i < N; i++) { pPos[i * 3] = P.pos.x + (rng() - 0.5) * box3.x; pPos[i * 3 + 1] = P.pos.y - 6 + rng() * box3.y; pPos[i * 3 + 2] = P.pos.z + (rng() - 0.5) * box3.z; }
    } }
    pFade = lerp(pFade, want && pKind === want ? 1 : 0, 1 - Math.exp(-dt * 1.5));
    pMat.opacity = pFade * (pKind ? pKind.opacity : 0);
    points.visible = pFade > 0.01;
    if (!points.visible || !pKind) return;
    const K = pKind, cx = P.pos.x, cy = P.pos.y - 6, cz = P.pos.z;
    for (let i = 0; i < N; i++) {
      const s = pSeed[i];
      let x = pPos[i * 3], y = pPos[i * 3 + 1], z = pPos[i * 3 + 2];
      if (K.hover) { x += Math.sin(t * 0.7 + s) * 0.6 * dt; y += Math.sin(t * 1.1 + s * 2) * 0.4 * dt; z += Math.cos(t * 0.6 + s) * 0.6 * dt; }
      else if (K.wind) { x += (K.wind + Math.sin(s) * 3) * dt; y += Math.sin(t * 3 + s) * 0.3 * dt; }
      else {
        y -= K.fall * (0.7 + (s % 1) * 0.6) * dt;
        x += Math.sin(t * K.sway + s) * K.sway * dt; z += Math.cos(t * K.sway * 0.8 + s) * K.sway * dt;
        if (K.embers && i % 9 === 0) y += (K.fall + 2.2) * dt * 2;
      }
      // keep them in a box round you (in the world: walking through them, they stay put)
      const hx = box3.x / 2, hz = box3.z / 2;
      if (x < cx - hx) x += box3.x; if (x > cx + hx) x -= box3.x;
      if (z < cz - hz) z += box3.z; if (z > cz + hz) z -= box3.z;
      if (y < cy) y += box3.y; if (y > cy + box3.y) y -= box3.y;
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    }
    pGeo.attributes.position.needsUpdate = true;
  };

  // =====================================================================================
  // Hazards: lava, and the fires a cinderhound leaves when it dies
  // =====================================================================================
  const fires = [];
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.85 });
  const addFire = (x, z) => {
    const y = G(x, z);
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 5), fireMat); const a = (i / 7) * 6.3, r = i ? 1.2 : 0; f.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r); g.add(f); }
    g.position.set(x, y, z);
    scene.add(g);
    fires.push({ g, x, z, y, t: 0 });
  };
  for (const e of enemies) if (e.kind.name === 'Cinderhound') e.onDie = (en) => addFire(en.pos.x, en.pos.z);
  const lavaAt = (x, z, y) => {
    const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    if (d < CRATER.lake + 2 && y < LAVA_Y + 0.4) return true;
    for (const L of LAVA) { const n = polyNear(L, x, z); if (n.d < 3.2 && y < G(x, z) + 1.2) return true; }
    return false;
  };

  const ventSmoke = [];
  if (ctx.vents) for (const [x, z, y] of ctx.vents) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 0.8, 7), lam(0x1a1616)); v.position.set(x, y + 0.3, z); scene.add(v);
    const glowTop = new THREE.Mesh(new THREE.CircleGeometry(0.75, 10), lavaMat); glowTop.rotation.x = -Math.PI / 2; glowTop.position.set(x, y + 0.72, z); scene.add(glowTop);
    ventSmoke.push([x, y + 1, z]);
  }

  // --- Each frame -----------------------------------------------------------------------
  let t = 0, lastRegion = null;
  return {
    enemies, pickups, npcs, talks, tower,
    regionAt,
    lavaAt,
    update(dt, P, game, region) {
      t += dt;
      for (const u of updaters) u(t);
      for (const n of Object.values(npcs)) n.update(dt, P);
      particles(dt, t, P, region);
      // fires burn for a few seconds, and hurt to stand in
      for (let i = fires.length - 1; i >= 0; i--) {
        const f = fires[i]; f.t += dt;
        f.g.children.forEach((c, k) => { c.scale.y = 0.7 + Math.abs(Math.sin(t * 9 + k)) * 0.6; });
        f.g.scale.setScalar(Math.max(0.01, 1 - Math.max(0, f.t - 3) / 1));
        if (f.t < 3.5 && Math.hypot(P.pos.x - f.x, P.pos.z - f.z) < 1.8 && P.pos.y - f.y < 1.2) P.hurt(1, f.x, f.z, 0.8);
        if (f.t > 4) { scene.remove(f.g); fires.splice(i, 1); }
      }
      // smoke and embers from the vents (only near you)
      if (game && game.fx && region === 'ashen' && Math.random() < dt * 6) {
        const v = ventSmoke[Math.floor(Math.random() * ventSmoke.length)];
        if (v && Math.hypot(v[0] - P.pos.x, v[2] - P.pos.z) < 60) game.fx.sparkle(new THREE.Vector3(...v), 3);
      }
      // lava burns: you're thrown up out of it
      if (region === 'ashen' && P.health > 0 && P.vy <= 0 && lavaAt(P.pos.x, P.pos.z, P.pos.y)) {
        if (game && game.fx) game.fx.explode(P.pos.clone());
        if (P.invuln > 0 || !P.hurt(2, P.pos.x - Math.sin(P.yaw), P.pos.z - Math.cos(P.yaw), 2.4)) P.bounce(15);
        else P.vy = 15;
        if (game && P.health > 0) game.toast('Burned by the lava!');
      }
      // the ground under you: deep snow slows you, the frozen lake is slippery, marsh water drags
      let surface = null;
      if (P.grounded) {
        if (region === 'frost') {
          const onLake = Math.hypot(P.pos.x - LAKE.x, P.pos.z - LAKE.z) < LAKE.r + 2 && P.pos.y < LAKE.y + 0.5;
          const onPath = PATHS.some((p) => polyNear(p.points, P.pos.x, P.pos.z).d < p.width / 2 + 0.5);
          surface = onLake ? { speed: 1.25, grip: 0.12 } : onPath ? null : { speed: 0.72, grip: 0.8 };
        } else if (region === 'marsh' && P.pos.y < WATER - 0.15) surface = { speed: 0.7, grip: 0.9 };
        else if (region === 'desert' && P.pos.y < 3) surface = { speed: 0.88, grip: 0.85 };
      }
      P.surface = surface;
      // blizzard gusts in the pass (see the weather): returns how thick
      lastRegion = region;
    },
    // the frost's gusts: 0..1, for the fog
    gust() { return Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1)) ; },
    // people to talk to near you
    nearNPC(P) { for (const [k, n] of Object.entries(npcs)) if (n.near(P)) return [k, n]; return null; },
  };
}
