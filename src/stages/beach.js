import * as THREE from 'three';
import { Terrain } from '../terrain.js?v=29';
import { sandTexture, grassTexture, rockTexture, dirtTexture, plankTexture, waterTexture } from '../textures.js?v=29';

// ---------------------------------------------------------------------------
// THE WASHED-UP BEACH: the first area of the open world. You wake up face down
// on the sand, next to the wreck of the ship you came in on, under a heavy grey
// sky. The sea is to the
// south; the beach rises through dunes to grassland in the north, between two
// headlands of rock.
// ---------------------------------------------------------------------------

export const NAME = 'Washed-Up Beach';
export const MUSIC = null;

const SEA = 0;                 // water level
const SAND_TOP = 2.6;          // sand below this height, grass above
const AREA = { minX: -90, maxX: 90, minZ: -46, maxZ: 110 };

// The shoreline wobbles along x; d = distance inland from it.
const shoreZ = (x) => -20 + 6 * Math.sin(x * 0.05) + 3 * Math.sin(x * 0.13 + 1);

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x, z, cx, cz, r, h) => { const d = Math.hypot(x - cx, z - cz) / r; return d < 1 ? h * (1 - d * d) * (1 - d * d) : 0; };
// a rock with steep sides: flat-ish top, quick drop
const rock = (x, z, cx, cz, r, h) => h * (1 - smooth(r * 0.55, r, Math.hypot(x - cx, z - cz)));

function height(x, z) {
  const d = z - shoreZ(x);
  let h;
  if (d < 0) h = Math.max(-1.1, d * 0.09);                      // into the sea (waist deep at most)
  else if (d < 34) h = d * 0.065 + 0.25 * Math.sin(x * 0.3) * smooth(18, 30, d);   // the sand
  else h = 2.2 + (d - 34) * 0.11 + 0.6 * Math.sin(x * 0.11) * Math.sin(z * 0.09);  // dunes, then grass
  h = Math.min(h, 9 + 0.8 * Math.sin(x * 0.07));                // grassland levels out
  // rocky headlands closing the beach in, east and west
  const edge = Math.abs(x) - (70 + 5 * Math.sin(z * 0.08));
  h += 16 * smooth(0, 9, edge);
  // rocks on the beach
  h += rock(x, z, -31, -9, 5, 3.4) + rock(x, z, -27, -13, 2.6, 1.8) + rock(x, z, 36, -12, 4, 2.6) + rock(x, z, 48, 4, 3, 2.2);
  // dunes
  h += bump(x, z, -14, 22, 9, 1.4) + bump(x, z, 18, 26, 11, 1.8) + bump(x, z, 44, 30, 9, 1.2) + bump(x, z, -44, 28, 10, 1.6);
  return h;
}

// A heavy overcast sky: grey cloud banks painted on a canvas, wrapped round a
// big sphere that follows the camera. Lighter towards the horizon, like mist.
function cloudSky(world) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#6d757a'); grad.addColorStop(0.4, '#858d92'); grad.addColorStop(0.5, '#8e969a'); grad.addColorStop(1, '#8e969a');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // soft cloud masses, darker underneath
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 512, y = 20 + rnd() * 105, r = 10 + rnd() * 34;
    const light = rnd() < 0.55;
    const cg = g.createRadialGradient(x, y, 0, x, y, r);
    const col = light ? '170,178,184' : '70,76,82';
    cg.addColorStop(0, `rgba(${col},${light ? 0.22 : 0.28})`); cg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = cg;
    for (const dx of [-512, 0, 512]) { g.beginPath(); g.ellipse(x + dx, y, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); g.fill(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -2;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  sky.onBeforeRender = (r, sc, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
  return sky;
}

// A low-poly palm: a curved trunk of tapering segments and drooping fronds.
function palm(rng) {
  const g = new THREE.Group();
  const bark = new THREE.MeshLambertMaterial({ color: 0x655a4c });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x4a5e3a, side: THREE.DoubleSide });
  const nut = new THREE.MeshLambertMaterial({ color: 0x3e3226 });
  const segs = 7, lean = 0.35 + rng() * 0.35, H = 6 + rng() * 2;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const k = i / segs, r0 = 0.32 - k * 0.14, r1 = 0.32 - (k + 1 / segs) * 0.14;
    const h = H / segs;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h * 1.04, 7), bark);
    const a = lean * k * k;
    m.position.set(x + Math.sin(a) * h / 2, y + Math.cos(a) * h / 2, 0);
    m.rotation.z = -a;
    g.add(m);
    x += Math.sin(a) * h; y += Math.cos(a) * h;
  }
  const top = new THREE.Vector3(x, y, 0);
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.PlaneGeometry(3.4, 0.9, 6, 1);
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const u = (p.getX(v) + 1.7) / 3.4;                 // 0 at the trunk, 1 at the tip
      p.setX(v, u * 3.4);
      p.setY(v, p.getY(v) * (1 - u * 0.7));             // narrow to the tip
      p.setZ(v, -u * u * 1.6);                           // droop
    }
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, leaf);
    f.position.copy(top);
    f.rotation.y = (i / 7) * Math.PI * 2 + rng() * 0.3;
    f.rotation.z = 0.25;
    g.add(f);
  }
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), nut);
    c.position.set(top.x + Math.cos(i * 2.1) * 0.3, top.y - 0.25, Math.sin(i * 2.1) * 0.3);
    g.add(c);
  }
  return { group: g, top };
}

export function build(world) {
  const scene = world.scene;
  // --- Overcast: a grey sky, mist, flat light ------------------------------------
  // thick sea fog: you can barely see past the wreck
  const FOG = 0x8e969a;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 3, 55);
  scene.traverse((o) => {
    if (o.isHemisphereLight) { o.color.set(0xb8c2c8); o.groundColor.set(0x4c4a44); o.intensity = 1.5; }
  });
  world.sun.color.set(0xd2d8dc);
  world.sun.intensity = 0.55;
  const skyMesh = cloudSky(world);
  const skyTex = skyMesh.material.map;
  scene.add(skyMesh);

  // --- Ground ------------------------------------------------------------------
  const terrain = new Terrain({
    ...AREA, res: 1, height,
    grass: grassTexture(), cliff: rockTexture(), path: dirtTexture(),
    sand: sandTexture(), sandTop: SAND_TOP,
    grade: { sat: 0.6, tint: new THREE.Color(0.92, 0.93, 0.94) },
  });
  world.setTerrain(terrain);
  const G = (x, z) => terrain.height(x, z);

  // --- The sea: a big plane that slowly drifts, and a second one for shimmer ------
  const wt = waterTexture();
  wt.repeat.set(60, 60);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: 0.9, depthWrite: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, SEA, -200);
  sea.renderOrder = 1;
  scene.add(sea);
  const wt2 = wt.clone(); wt2.needsUpdate = true; wt2.repeat.set(41, 41);
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ map: wt2, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.position.set(0, SEA + 0.02, -200);
  shimmer.renderOrder = 1;
  scene.add(shimmer);

  // --- The shipwreck ---------------------------------------------------------------
  const planks = plankTexture();
  const wood = world.mat(planks, { uvScale: 1.6 });
  wood.color.set(0xb0a698);
  const darkWood = new THREE.MeshLambertMaterial({ map: planks, color: 0x8a8078 });
  const box = (min, max, m = wood, opts) => world.addBox(min, max, m, opts);
  const onGround = (x, z, w, d, h, m) => {      // a box resting on the sand at (x, z)
    const y = Math.min(G(x - w / 2, z - d / 2), G(x + w / 2, z - d / 2), G(x - w / 2, z + d / 2), G(x + w / 2, z + d / 2), G(x, z));
    return box([x - w / 2, y - 0.3, z - d / 2], [x + w / 2, y + h, z + d / 2], m);
  };

  // the hull: a broken half of the ship lying on its side, half in the water
  {
    const hull = new THREE.Group();
    const L = 11, plank = new THREE.BoxGeometry(L, 0.18, 0.55);
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.5 + (i / 10) * Math.PI;      // round the curve of the hull
      const p = new THREE.Mesh(plank, i % 3 ? darkWood : wood);
      p.position.set(0, Math.sin(a) * 2.4 + 2.4, Math.cos(a) * 2.4);
      p.rotation.x = -a;
      if (i === 3 || i === 7) p.scale.x = 0.7, p.position.x = -L * 0.15;   // broken planks
      hull.add(p);
    }
    for (let k = -2; k <= 2; k++) {                          // ribs showing through
      const rib = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.13, 5, 10, Math.PI), darkWood);
      rib.position.set(k * 2.4, 2.4, 0);
      rib.rotation.set(0, Math.PI / 2, Math.PI / 2);
      hull.add(rib);
    }
    hull.rotation.order = 'YXZ';
    hull.rotation.set(-1.15, -0.45, 0.1);          // rolled onto its side, bow pointing up the beach
    hull.position.set(16, G(16, -11) - 1.6, -11);
    scene.add(hull);
    // what you bump into
    const hy = G(16, -11);
    box([11.5, hy - 1, -14.5], [20.5, hy + 2.8, -8], wood, { visible: false });
  }
  // the snapped mast, lying across the sand
  {
    const x0 = -18, x1 = -6, z = -4.5;
    const y = Math.min(G(x0, z), G(x1, z), G((x0 + x1) / 2, z));
    box([x0, y - 0.2, z - 0.3], [x1, y + 0.45, z + 0.3], darkWood);
    box([x1 - 2.8, y + 0.45, z - 0.15], [x1 - 2.5, y + 2.2, z + 0.15], darkWood);   // a spar still sticking up
  }
  // crates, barrels and planks washed up along the tideline
  onGround(-5, -10, 1.3, 1.3, 1.3);
  onGround(-6.4, -8.6, 1.1, 1.1, 1.1);
  { const b = onGround(-5.2, -9.9, 1.0, 1.0, 1.0); b.min.y += 1.3; b.max.y += 1.3; b.mesh.position.y += 1.3; }
  onGround(7, -17, 1.2, 1.2, 1.2);
  onGround(27, -3, 1.2, 1.2, 1.2);
  onGround(-22, -14, 1.0, 1.0, 1.0);
  for (const [x, z, w, d] of [[3, -6, 2.6, 0.35], [10, -4, 0.35, 2.2], [-12, -12, 3.0, 0.3], [22, -16, 0.3, 2.6], [-2, 2, 2.0, 0.3]]) onGround(x, z, w, d, 0.12, darkWood);
  const barrelMat = new THREE.MeshLambertMaterial({ map: planks, color: 0xa08a78 });
  const hoop = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  for (const [x, z, lying] of [[-10, -15, false], [9, -7, true], [-26, 2, false], [31, -9, true]]) {
    const y = G(x, z);
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10), barrelMat);
    g.add(b);
    for (const hy of [-0.35, 0.35]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 4, 12), hoop); h.rotation.x = Math.PI / 2; h.position.y = hy; g.add(h); }
    if (lying) { g.rotation.z = Math.PI / 2; g.rotation.y = 0.7; g.position.set(x, y + 0.38, z); box([x - 0.55, y - 0.2, z - 0.45], [x + 0.55, y + 0.8, z + 0.45], barrelMat, { visible: false }); }
    else { g.position.set(x, y + 0.55, z); box([x - 0.42, y - 0.2, z - 0.42], [x + 0.42, y + 1.1, z + 0.42], barrelMat, { visible: false }); }
    scene.add(g);
  }

  // --- Palms along the beach, trees further up -----------------------------------
  let seed = 3;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [x, z] of [[-24, 8], [-19, 15], [-38, 4], [-46, 14], [21, 9], [28, 3], [40, 13], [52, 20], [4, 24], [-6, 31], [-56, 24], [60, 8]]) {
    const { group } = palm(rng);
    group.position.set(x, G(x, z) - 0.1, z);
    group.rotation.y = rng() * Math.PI * 2;
    scene.add(group);
    const y = G(x, z);
    box([x - 0.3, y - 0.5, z - 0.3], [x + 0.3, y + 4, z + 0.3], wood, { visible: false });
  }
  {
    const spots = [];
    for (let i = 0; i < 40; i++) {
      const x = -62 + rng() * 124, z = 62 + rng() * 44;
      if (G(x, z) > SAND_TOP + 1 && G(x, z) < 12) spots.push([x, z]);
    }
    // low-poly conifers, dark and wind-bent, fading into the fog
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6); trunkGeo.translate(0, 1.1, 0);
    const coneGeo = [new THREE.ConeGeometry(1.9, 3.0, 7), new THREE.ConeGeometry(1.5, 2.6, 7), new THREE.ConeGeometry(1.0, 2.2, 7)];
    coneGeo.forEach((g, k) => g.translate(0, 2.4 + k * 1.5, 0));
    const barkMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
    const needleMat = new THREE.MeshLambertMaterial({ color: 0x34402e, flatShading: true });
    const n = spots.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, n);
    const cones = coneGeo.map((g) => new THREE.InstancedMesh(g, needleMat, n));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
    spots.forEach(([x, z], i) => {
      const y = G(x, z), s = 1.1 + rng() * 0.7;
      q.setFromEuler(e.set((rng() - 0.5) * 0.12, rng() * 6.3, (rng() - 0.5) * 0.12));
      m4.compose(ps.set(x, y - 0.2, z), q, sc.set(s, s * (0.9 + rng() * 0.3), s));
      trunks.setMatrixAt(i, m4);
      for (const c of cones) c.setMatrixAt(i, m4);
      box([x - 0.25, y - 0.5, z - 0.25], [x + 0.25, y + 4, z + 0.25], wood, { visible: false });
    });
    scene.add(trunks, ...cones);
  }

  // --- Waves lapping: drift the water textures --------------------------------------
  let t = 0;
  const update = (dt) => {
    t += dt;
    wt.offset.set(t * 0.004, t * 0.012);
    wt2.offset.set(-t * 0.006, t * 0.008);
    sea.position.y = SEA + Math.sin(t * 0.9) * 0.06;
    skyTex.offset.x = t * 0.002;
  };

  // --- TEMPORARY: a battle test ring with a training dummy --------------------------
  // Walk into the ring of stones and press B to start a test battle.
  const ARENA = { x: -6, z: 10, r: 5 };
  const battleSpots = { player: new THREE.Vector3(ARENA.x - 3, 0, ARENA.z), enemy: new THREE.Vector3(ARENA.x + 3, 0, ARENA.z) };
  for (const v of Object.values(battleSpots)) v.y = G(v.x, v.z);
  let dummy;
  {
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x6d6c67, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, x = ARENA.x + Math.cos(a) * ARENA.r, z = ARENA.z + Math.sin(a) * ARENA.r;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + rng() * 0.12, 0), stoneMat);
      st.position.set(x, G(x, z) + 0.12, z);
      st.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      st.scale.y = 0.7;
      scene.add(st);
    }
    // the dummy: a post, a crossbar for arms and a stuffed sack with a head
    const sack = new THREE.MeshLambertMaterial({ color: 0x9a8a6a });
    const rope = new THREE.MeshLambertMaterial({ color: 0x5c4e3a });
    const d = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), darkWood); post.position.y = 1.1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.9, 8), sack); body.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), sack); head.position.y = 1.95;
    const arms = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), darkWood); arms.position.y = 1.55;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.04, 4, 12), rope); belt.rotation.x = Math.PI / 2; belt.position.y = 1.0;
    d.add(post, body, head, arms, belt);
    d.position.copy(battleSpots.enemy);
    d.rotation.y = -Math.PI / 2;        // facing the player's spot
    scene.add(d);
    dummy = d;
    const e = battleSpots.enemy;
    box([e.x - 0.35, e.y - 0.3, e.z - 0.35], [e.x + 0.35, e.y + 2.2, e.z + 0.35], wood, { visible: false });
    // a sign at the edge of the ring
    const sx2 = ARENA.x - 1, sz2 = ARENA.z - ARENA.r - 0.8, sy2 = G(sx2, sz2);
    box([sx2 - 0.06, sy2 - 0.2, sz2 - 0.06], [sx2 + 0.06, sy2 + 1.3, sz2 + 0.06], darkWood);
    box([sx2 - 0.6, sy2 + 0.9, sz2 - 0.05], [sx2 + 0.6, sy2 + 1.45, sz2 + 0.05], wood);
  }
  const battleZones = [{
    x: ARENA.x, z: ARENA.z, r: ARENA.r,
    spots: battleSpots,
    enemy: { name: 'Training Dummy', maxHp: 10, maxSp: 5, atk: 1, attackText: 'wobbles back at you', model: dummy, picture: { height: 1.85, dist: 2.0, yaw: -Math.PI / 2 } },
  }];

  // You wash up face down a few metres from the water, head towards the land.
  const sx = 0, sz = shoreZ(0) + 6;
  return {
    spawn: new THREE.Vector3(sx, G(sx, sz), sz),
    spawnYaw: 0,
    startLying: true,
    update,
    battleZones,
  };
}

// For tests and tooling.
export const layout = { SEA, SAND_TOP, AREA, shoreZ };
