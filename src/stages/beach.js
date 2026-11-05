import * as THREE from 'three';
import { Terrain } from '../terrain.js?v=25';

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

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Grainy N64-style sand.
function sandTexture() {
  return canvasTex(64, (g, n) => {
    g.fillStyle = '#c4b28c'; g.fillRect(0, 0, n, n);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? 'rgba(120,110,90,0.35)' : v < 0.85 ? 'rgba(220,215,200,0.3)' : 'rgba(80,72,60,0.4)';
      g.fillRect(Math.floor(rnd() * n), Math.floor(rnd() * n), 1 + Math.floor(rnd() * 2), 1);
    }
  });
}

function waterTexture() {
  return canvasTex(128, (g, n) => {
    g.fillStyle = '#3a5562'; g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(200,215,220,0.22)'; g.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      const y0 = (k * 37) % n, x0 = (k * 53) % n;
      g.beginPath();
      for (let x = 0; x <= 40; x += 4) g.lineTo((x0 + x) % n, y0 + Math.sin(x * 0.3) * 3);
      g.stroke();
    }
  });
}

// A heavy overcast sky: grey cloud banks painted on a canvas, wrapped round a
// big sphere that follows the camera. Lighter towards the horizon, like mist.
function cloudSky(world) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5f676d'); grad.addColorStop(0.45, '#7f888e'); grad.addColorStop(0.5, '#8e979c'); grad.addColorStop(1, '#8e979c');
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
  const FOG = 0x8e979c;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 25, 190);
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
    grass: world.tile('grass.webp'), cliff: world.tile('rock.png'), path: world.tile('path.png'),
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
  const wood = world.mat(world.tile('wood.jpg'), { uvScale: 1.6 });
  wood.color.set(0x7a6c5c);
  const darkWood = new THREE.MeshLambertMaterial({ map: world.tile('wood.jpg'), color: 0x4e443a });
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
  const barrelMat = new THREE.MeshLambertMaterial({ map: world.tile('wood.jpg'), color: 0x6a5240 });
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
    const tex = world.loader.load(`assets/tree.png?v=${world.version}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(181 / 256, 1); geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x7d8676, fog: true });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
vec3 tc = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float tsx = length(instanceMatrix[0].xyz), tsy = length(instanceMatrix[1].xyz);
vec3 camR = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
vec4 mvPosition = viewMatrix * vec4(tc + camR * position.x * tsx + vec3(0.0, position.y * tsy, 0.0), 1.0);
gl_Position = projectionMatrix * mvPosition;`);
    };
    const trees = new THREE.InstancedMesh(geo, mat, spots.length);
    trees.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
    spots.forEach(([x, z], i) => {
      const y = G(x, z), s = 6 + (i % 3) * 0.7;
      trees.setMatrixAt(i, m4.compose(ps.set(x, y - 0.15, z), q, sc.set(s, s, s)));
      box([x - 0.22, y - 0.5, z - 0.22], [x + 0.22, y + s * 0.75, z + 0.22], wood, { visible: false });
    });
    scene.add(trees);
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

  // You wash up face down a few metres from the water, head towards the land.
  const sx = 0, sz = shoreZ(0) + 6;
  return {
    spawn: new THREE.Vector3(sx, G(sx, sz), sz),
    spawnYaw: 0,
    startLying: true,
    update,
  };
}

// For tests and tooling.
export const layout = { SEA, SAND_TOP, AREA, shoreZ };
