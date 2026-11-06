import * as THREE from 'three';
import { FieldEnemy } from '../fieldenemy.js?v=43';
import { grassTuftTexture } from '../textures.js?v=43';

// ---------------------------------------------------------------------------
// OBSIDIAN FIELDLANDS: a wide basin far below the beach, reached down a long
// grassy slope north of the grassland. From above it's lost in the fog; step
// down into it and the fog lifts, the sky turns blue and its music starts. A
// patchwork of grass fields, tall grass, spires and boulders of black volcanic
// glass, walled in by obsidian cliffs, and enemies roaming the fields.
// It shares the beach's ground, so it's built from beach.js.
// ---------------------------------------------------------------------------

export const NAME = 'Obsidian Fieldlands';
export const MUSIC = 'obsidian-fieldlands.mp3';

export const FLOOR = -40;                    // the basin floor, way below the beach
export const SLOPE = { z0: 120, z1: 245 };  // the slope down to it
export const CENTRE = { x: 0, z: 360 };      // the middle of the fields
const ENTER_Z = 236, LEAVE_Z = 224;          // where the fog lifts (and comes back)

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x, z, cx, cz, r, h) => { const d = Math.hypot(x - cx, z - cz) / r; return d < 1 ? h * (1 - d * d) * (1 - d * d) : 0; };
const lerp = (a, b, t) => a + (b - a) * t;

// Mountains: x, z, radius, height. A ridged peak, steep near the top and
// spreading out into foothills; most can be climbed, the tops are rock.
export const MOUNTAINS = [
  { name: 'west peak', x: -92, z: 318, r: 48, h: 52 },
  { name: 'east range', x: 92, z: 395, r: 42, h: 40 },
  { name: 'east range', x: 104, z: 335, r: 30, h: 28 },
  { name: 'north ridge', x: -45, z: 458, r: 36, h: 34 },
  { name: 'Obsidian Peak', x: 52, z: 462, r: 34, h: 46 },   // a mountain of black glass
];
// Obsidian flats: patches where the ground itself is black glass.
export const OBSIDIAN_FLATS = [
  { x: -34, z: 302, r: 24 },
  { x: 38, z: 322, r: 18 },
  { x: -8, z: 428, r: 26 },
  { x: 52, z: 462, r: 40 },        // round the foot of Obsidian Peak
  { x: -68, z: 388, r: 16 },
];

function peak(x, z, m) {
  const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz) / m.r;
  if (d >= 1) return 0;
  const a = Math.atan2(dz, dx);
  // ridges running down from the summit, and a craggy surface
  const ridge = 1 + 0.16 * Math.sin(a * 6 + m.x * 0.1) * d + 0.07 * Math.sin(a * 13 + d * 9);
  const k = 1 - d;
  return m.h * Math.pow(k, 1.7) * ridge + 1.2 * Math.sin(x * 0.4 + z * 0.3) * k * k;
}

// Basin ground: gently rolling, with low hills between the fields and mountains.
function basin(x, z) {
  let h = FLOOR + 1.4 * Math.sin(x * 0.045) * Math.sin(z * 0.05 + 1) + 0.6 * Math.sin(x * 0.11 + z * 0.07)
    + bump(x, z, -60, 330, 28, 6) + bump(x, z, 55, 400, 32, 7) + bump(x, z, 20, 300, 18, 3) + bump(x, z, -30, 430, 22, 4);
  for (const m of MOUNTAINS) h += peak(x, z, m);
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
    // ...with jagged mountain peaks rising behind them
    const crags = 1 + 0.45 * Math.max(0, Math.sin(z * 0.045 + x * 0.01)) + 0.25 * Math.sin(z * 0.11 + 1.3);
    h += lerp(0, 55, w) * smooth(0, 14, edge) * crags + w * 30 * smooth(12, 40, edge) * Math.max(0, Math.sin(z * 0.07 + (x > 0 ? 1.7 : 0)));
    h += 58 * smooth(455, 478, z) * (1 + 0.4 * Math.max(0, Math.sin(x * 0.06)));   // the far end of the basin
    return h;
  };
}

// The dirt path from the grassland down the slope into the fields.
export const PATH = { width: 4.5, points: [[0, 92], [5, 125], [-7, 160], [6, 195], [-3, 228], [2, 262], [-6, 300]] };

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

const glassMat = () => new THREE.MeshPhongMaterial({ color: 0x15131b, specular: 0x9a90d0, shininess: 120, flatShading: true });

// Build everything down in the basin. ctx: { world, scene, G, terrain, overcast (the grey sky mesh), rng, box }
export function build(ctx) {
  const { world, scene, G, terrain, overcast, rng, box } = ctx;

  // --- Obsidian: spires and boulders of black glass --------------------------------
  const glass = glassMat();
  const spire = (x, z, h, r) => {
    const y = G(x, z);
    const g = new THREE.Group();
    const main = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), glass);
    main.position.y = h / 2 - 0.3; main.rotation.y = rng() * 3;
    g.add(main);
    for (let i = 0; i < 3; i++) {   // smaller shards round its foot
      const hh = h * (0.3 + rng() * 0.3), rr = r * (0.35 + rng() * 0.25), a = rng() * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.ConeGeometry(rr, hh, 4), glass);
      s.position.set(Math.cos(a) * r * 0.9, hh / 2 - 0.2, Math.sin(a) * r * 0.9);
      s.rotation.set(Math.sin(a) * 0.35, rng() * 3, -Math.cos(a) * 0.35);
      g.add(s);
    }
    g.position.set(x, y, z);
    g.rotation.z = (rng() - 0.5) * 0.12;
    scene.add(g);
    const k = r * 0.7;
    box([x - k, y - 1, z - k], [x + k, y + h * 0.75, z + k], glass, { visible: false });
  };
  const boulder = (x, z, s) => {
    const y = G(x, z);
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), glass);
    m.position.set(x, y + s * 0.35, z);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.scale.y = 0.7;
    scene.add(m);
    const k = s * 0.7;
    box([x - k, y - 1, z - k], [x + k, y + s * 0.75, z + k], glass, { visible: false });
  };
  for (const [x, z, h, r] of [[-38, 268, 11, 2.2], [42, 280, 9, 1.8], [-85, 300, 16, 3], [90, 330, 14, 2.6], [-20, 350, 7, 1.4], [28, 372, 12, 2.2],
    [-92, 390, 18, 3.2], [70, 430, 15, 2.8], [-50, 440, 10, 2], [8, 452, 13, 2.4], [100, 270, 12, 2.4], [-104, 340, 14, 2.6], [-8, 410, 8, 1.6]]) spire(x, z, h, r);
  for (const [x, z, s] of [[-14, 262, 1.4], [18, 290, 1.1], [-58, 300, 1.8], [64, 352, 1.5], [-30, 395, 1.2], [44, 410, 1.9], [-72, 420, 1.4], [82, 300, 1.2], [4, 330, 0.9], [-4, 380, 1.0]]) boulder(x, z, s);

  // forests of glass spires on the obsidian flats, and shards everywhere on them
  const inFlat = (x, z, k = 0.8) => OBSIDIAN_FLATS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r * k);
  const shardGeo = new THREE.ConeGeometry(0.22, 1, 4);
  const shards = [];
  for (const f of OBSIDIAN_FLATS) {
    const n = Math.round(f.r / 2.2);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * f.r * 0.75;
      const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
      if (Math.hypot(x - PATH.points[PATH.points.length - 1][0], z - PATH.points[PATH.points.length - 1][1]) < 6) continue;
      spire(x, z, 3 + rng() * 7, 0.7 + rng() * 1.1);
    }
    for (let i = 0; i < f.r * 6; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * f.r * 0.85;
      shards.push([f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, 0.3 + rng() * 0.9]);
    }
  }
  // the crown of Obsidian Peak: great glass spires round the summit
  {
    const m = MOUNTAINS.find((q) => q.name === 'Obsidian Peak');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng() * 0.4, d = 4 + rng() * 7;
      spire(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, 8 + rng() * 9, 1.6 + rng() * 1.2);
    }
  }
  // boulders tumbled down the other mountains
  for (const m of MOUNTAINS) {
    if (m.name === 'Obsidian Peak') continue;
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2, d = m.r * (0.3 + rng() * 0.6);
      boulder(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, 0.8 + rng() * 1.4);
    }
  }
  {
    const inst = new THREE.InstancedMesh(shardGeo, glass, shards.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
    shards.forEach(([x, z, s], i) => {
      q.setFromEuler(e.set((rng() - 0.5) * 0.8, rng() * 6.3, (rng() - 0.5) * 0.8));
      inst.setMatrixAt(i, m4.compose(ps.set(x, G(x, z) + s * 0.35, z), q, sc.set(s, s, s)));
    });
    scene.add(inst);
  }

  // --- Tall grass, in patches across the fields ------------------------------------
  {
    const tex = grassTuftTexture();
    const geo = new THREE.PlaneGeometry(1.3, 1.1);
    geo.translate(0, 0.55, 0);
    const g2 = geo.clone().rotateY(Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
    const clock = { value: 0 };
    mat.onBeforeCompile = (sh) => {     // sway in the wind
      sh.uniforms.uTime = clock;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uTime * 1.6 + wp.x * 0.15 + wp.z * 0.11) * 0.18 * position.y;
transformed.x += sway; transformed.z += sway * 0.5;`);
    };
    const spots = [];
    const patches = 22;
    for (let p = 0; p < patches; p++) {
      const cx = CENTRE.x + (rng() - 0.5) * 210, cz = 270 + rng() * 180, r = 6 + rng() * 10;
      for (let i = 0; i < r * r * 1.6; i++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const y = G(x, z);
        if (y < FLOOR + 12 && !inFlat(x, z, 1)) spots.push([x, y, z, 0.8 + rng() * 0.6, rng() * 3]);
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const gg of [geo, g2]) {
      const inst = new THREE.InstancedMesh(gg, mat, spots.length);
      spots.forEach(([x, y, z, s, r], i) => inst.setMatrixAt(i, m4.compose(ps.set(x, y - 0.05, z), q.setFromEuler(e.set(0, r, 0)), sc.set(s, s, s))));
      inst.frustumCulled = false;
      scene.add(inst);
    }
    ctx.grassClock = clock;
  }

  // --- Enemies roaming the fields ------------------------------------------------------
  const enemies = [
    ['shardling', -12, 275], ['shardling', 30, 300], ['thornback', -45, 320], ['shardling', 60, 335], ['shardling', -70, 360],
    ['thornback', 15, 355], ['shardling', -25, 410], ['thornback', 55, 395], ['shardling', 85, 420], ['thornback', -80, 440], ['shardling', 0, 440],
    // out on the obsidian flats and the mountainsides
    ['shardling', -40, 296], ['shardling', -28, 310], ['shardling', 42, 326], ['shardling', -2, 425], ['shardling', 50, 440],
    ['thornback', -62, 300], ['thornback', 80, 360],
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
    clear: look({ fog: 0xc6dff3, near: 70, far: 560, sun: 1.5, sunCol: 0xfff1d8, hemi: 2.1, cloud: 0, sat: 1, tint: [1, 1, 1] }),
    gloom: look({ fog: 0x2e2a30, near: 6, far: 120, sun: 0.35, sunCol: 0xd8b0a0, hemi: 0.85, cloud: 1, sat: 0.45, tint: [0.9, 0.82, 0.8], skyLum: 0.32 }),
  };
  const cur = look({ ...LOOKS.grey, fog: LOOKS.grey.fog.getHex(), sunCol: LOOKS.grey.sunCol.getHex() });
  overcast.material.transparent = true;
  let inside = false;

  return {
    enemies,
    get inside() { return inside; },
    // gloom: you're on the throne plateau. Returns true the moment you enter (or leave) the fieldlands.
    update(dt, player, gloom = false) {
      ctx.grassClock.value += dt;
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
