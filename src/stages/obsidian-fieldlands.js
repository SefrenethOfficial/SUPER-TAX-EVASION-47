import * as THREE from 'three';
import { FieldEnemy } from '../fieldenemy.js?v=39';
import { grassTuftTexture } from '../textures.js?v=39';

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

// Basin ground: gently rolling, with a few low hills between the fields.
function basin(x, z) {
  return FLOOR + 1.4 * Math.sin(x * 0.045) * Math.sin(z * 0.05 + 1) + 0.6 * Math.sin(x * 0.11 + z * 0.07)
    + bump(x, z, -60, 330, 28, 6) + bump(x, z, 55, 400, 32, 7) + bump(x, z, 20, 300, 18, 3) + bump(x, z, -30, 430, 22, 4);
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
    h += lerp(0, 55, w) * smooth(0, 14, edge);
    h += 58 * smooth(455, 478, z);                    // the far end of the basin
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
        if (y < FLOOR + 12) spots.push([x, y, z, 0.8 + rng() * 0.6, rng() * 3]);
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
  ].map(([k, x, z]) => new FieldEnemy(scene, k, { x, z }, G));

  // --- The fog lifting -----------------------------------------------------------------
  const sky = blueSky();
  scene.add(sky);
  const hemi = [];
  scene.traverse((o) => { if (o.isHemisphereLight) hemi.push(o); });
  const grey = { fog: new THREE.Color(scene.fog.color), near: scene.fog.near, far: scene.fog.far, sun: world.sun.intensity, sunCol: world.sun.color.clone(), hemi: hemi.map((h) => h.intensity) };
  const clear = { fog: new THREE.Color(0xc6dff3), near: 70, far: 560, sun: 1.5, sunCol: new THREE.Color(0xfff1d8), hemi: 2.1 };
  overcast.material.transparent = true;
  let t = 0, inside = false;
  const tmp = new THREE.Color();

  return {
    enemies,
    get inside() { return inside; },
    // returns true the moment you enter (or leave) the fieldlands
    update(dt, player) {
      ctx.grassClock.value += dt;
      const was = inside;
      if (!inside && player.pos.z > ENTER_Z) inside = true;
      if (inside && player.pos.z < LEAVE_Z) inside = false;
      t += Math.sign((inside ? 1 : 0) - t) * Math.min(Math.abs((inside ? 1 : 0) - t), dt * 0.7);
      const k = t * t * (3 - 2 * t);
      scene.fog.color.copy(tmp.copy(grey.fog).lerp(clear.fog, k));
      scene.background.copy(scene.fog.color);
      scene.fog.near = lerp(grey.near, clear.near, k);
      scene.fog.far = lerp(grey.far, clear.far, k);
      overcast.material.opacity = 1 - k;
      overcast.visible = k < 0.999;
      world.sun.intensity = lerp(grey.sun, clear.sun, k);
      world.sun.color.copy(tmp.copy(grey.sunCol).lerp(clear.sunCol, k));
      hemi.forEach((h, i) => { h.intensity = lerp(grey.hemi[i], clear.hemi, k); });
      terrain.setGrade(lerp(0.6, 1.0, k), lerp(0.92, 1, k), lerp(0.93, 1, k), lerp(0.94, 1, k));
      return was !== inside;
    },
  };
}
