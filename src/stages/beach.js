import * as THREE from 'three';
import { Terrain } from '../terrain.js?v=42';
import { ShyGhost } from '../ghost.js?v=42';
import { sandTexture, grassTexture, rockTexture, dirtTexture, plankTexture, waterTexture, obsidianTexture } from '../textures.js?v=42';
import * as Fieldlands from './obsidian-fieldlands.js?v=42';
import * as Hollow from './lantern-hollow.js?v=42';
import * as Throne from './hollow-throne.js?v=42';
import { NPC } from '../npc.js?v=42';
import { Pickup } from '../pickup.js?v=42';
import { save, store, flag, learn, addWeapon, addItem } from '../save.js?v=42';

// ---------------------------------------------------------------------------
// THE WASHED-UP BEACH: the first area of the open world. You wake up face down
// on the sand, next to the wreck of the ship you came in on, under a heavy grey
// sky. The sea is to the south; the beach rises through dunes to grassland in
// the north, between two headlands of rock. Past the grassland the land drops
// away down a long slope to the Obsidian Fieldlands (obsidian-fieldlands.js).
// ---------------------------------------------------------------------------

export const NAME = 'Washed-Up Beach';
export const MUSIC = null;
export const MODELS = { ghost: 'ghost.glb' };

// The ghost's name. Change it here.
const GHOST = 'Vivian';

// What you've done here, kept while the page is open (and across visits).
const progress = (() => { try { return JSON.parse(localStorage.getItem('ste47-beach') || '{}'); } catch (_) { return {}; } })();
const saveProgress = () => { try { localStorage.setItem('ste47-beach', JSON.stringify(progress)); } catch (_) { /* no storage */ } };

// --- What the ghost says -----------------------------------------------------------
const basics = () => [
  { who: GHOST, text: "Okay! Um. Let's see... You move with WASD, or the left stick. Hold C if you want to walk slowly." },
  { who: GHOST, text: 'Space jumps. If you jump again just as you land, you go higher. Three in a row and you really fly.' },
  { who: GHOST, text: 'Shift crouches. Crouch while you run and then jump, and you leap a long way. Press Shift in the air to slam down.' },
  { who: GHOST, text: 'In the air, next to a wall, jump again to kick off it. And you can grab onto ledges and climb up.' },
  { who: GHOST, text: "J, X or a click to punch. Punch while you're running and you dive forward." },
  { who: GHOST, text: 'The mouse moves the camera. Or Q and E, R and F. H shows all the controls if you forget.' },
  { who: GHOST, text: "Fights here go in turns. Pick Fight and you choose a move. Every move costs Stamina..." },
  { who: GHOST, text: "...so watch it. If you run low, Catch Breath gets some back. And if it goes badly, you can always Run." },
  { who: GHOST, text: "If you want to practise fighting... you could fight me. Just come and talk to me. I'll, um, try to go easy on you." },
  { who: GHOST, text: "That's... all the basics. Sorry if that was too much." },
];


const SEA = 0;                 // water level
const SAND_TOP = 2.6;          // sand below this height, grass above
const AREA = { minX: -262, maxX: 274, minZ: -46, maxZ: 482 };   // the beach, the slope, the fieldlands, Lantern Hollow and the Hollow Throne

// The shoreline wobbles along x; d = distance inland from it.
const shoreZ = (x) => -20 + 6 * Math.sin(x * 0.05) + 3 * Math.sin(x * 0.13 + 1);

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (x, z, cx, cz, r, h) => { const d = Math.hypot(x - cx, z - cz) / r; return d < 1 ? h * (1 - d * d) * (1 - d * d) : 0; };
// a rock with steep sides: flat-ish top, quick drop
const rock = (x, z, cx, cz, r, h) => h * (1 - smooth(r * 0.55, r, Math.hypot(x - cx, z - cz)));

function height(x, z) {
  // far out to the sides of the beach it's all mountain
  const outer = 46 * smooth(96, 120, Math.abs(x)) * (1 - smooth(230, 260, z));
  return beachHeight(x, z) + outer;
}

function beachHeight(x, z) {
  const d = z - shoreZ(x);
  let h;
  if (d < 0) h = Math.max(-1.1, d * 0.09);                      // into the sea (waist deep at most)
  else if (d < 34) h = d * 0.065 + 0.25 * Math.sin(x * 0.3) * smooth(18, 30, d);   // the sand
  else h = 2.2 + (d - 34) * 0.11 + 0.6 * Math.sin(x * 0.11) * Math.sin(z * 0.09);  // dunes, then grass
  h = Math.min(h, 9 + 0.8 * Math.sin(x * 0.07));                // grassland levels out
  // rocky headlands closing the beach in, east and west
  const edge = Math.abs(x) - (70 + 5 * Math.sin(z * 0.08));
  h += 16 * smooth(0, 9, edge) * (1 - smooth(115, 150, z));   // (further north the fieldlands' walls take over)
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

export function build(world, { models = {} } = {}) {
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
    ...AREA, res: 1.5, height: Throne.withThrone(Hollow.withHollow(Fieldlands.withFieldlands(height))),
    paths: [Fieldlands.PATH,
      { width: 3.5, points: [[40, 300], [90, 284], [120, 280], [184, 281], [214, 299]] },               // east, to the tavern
      { width: 3.5, points: [[-20, 340], [-70, 396], [-112, 404], [-180, 404], [Throne.GATE.x + 2, 404]] },   // west, to the throne
    ],
    grass: grassTexture(), cliff: rockTexture(), path: dirtTexture(),
    rock: obsidianTexture(), rockZone: new THREE.Vector3(Fieldlands.CENTRE.x, Fieldlands.CENTRE.z, 175),   // obsidian cliffs round the basin
    fields: { x: Fieldlands.CENTRE.x, z: Fieldlands.CENTRE.z, r: 150 },
    groundZones: Fieldlands.OBSIDIAN_FLATS,                    // patches of black glass ground
    sand: sandTexture(), sandTop: SAND_TOP, sandMaxZ: 70,
    grade: { sat: 0.6, tint: new THREE.Color(0.92, 0.93, 0.94) },
  });
  world.setTerrain(terrain);
  world.killY = Fieldlands.FLOOR - 30;      // the basin is way below sea level
  const G = (x, z) => terrain.height(x, z);

  // --- The sea: a big plane that slowly drifts, and a second one for shimmer ------
  const wt = waterTexture();
  wt.repeat.set(60, 60);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 840), new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: 0.9, depthWrite: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, SEA, -380);        // ends just inland of the beach (the basin is below sea level)
  sea.renderOrder = 1;
  scene.add(sea);
  const wt2 = wt.clone(); wt2.needsUpdate = true; wt2.repeat.set(41, 41);
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(1200, 840), new THREE.MeshBasicMaterial({ map: wt2, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
  shimmer.rotation.x = -Math.PI / 2;
  shimmer.position.set(0, SEA + 0.02, -380);
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

  // --- Down the slope: the Obsidian Fieldlands ---------------------------------------
  const fields = Fieldlands.build({ world, scene, G, terrain, overcast: skyMesh, rng, box });
  const hollow = Hollow.build({ world, scene, G, box, rng });
  const throne = Throne.build({ scene, G, box, rng });

  // --- Things to pick up around the world ------------------------------------------
  const pickups = [
    { id: 'club', weapon: 'club', x: 11, z: -6 },                       // driftwood by the wreck
    { id: 'herb-beach', item: 'herb', x: -30, z: 6 },
    { id: 'herb-f1', item: 'herb', x: 22, z: 312 },
    { id: 'herb-f2', item: 'herb', x: -46, z: 372 },
    { id: 'herb-f3', item: 'herb', count: 2, x: 66, z: 418 },
    { id: 'tonic-west', item: 'tonic', x: -86, z: 312 },               // up the West Peak
    { id: 'tonic-east', item: 'tonic', x: 96, z: 392 },                // up the East Range
    { id: 'dagger', weapon: 'dagger', x: 54, z: 459 },                  // on top of Obsidian Peak
    { id: 'ember-flat', item: 'ember', x: -36, z: 300 },
  ].map((p) => new Pickup(scene, { ...p, pos: new THREE.Vector3(p.x, G(p.x, p.z), p.z) }));

  // --- The hermit on the West Peak: teaches Skybreaker to anyone who climbs up --------
  const peak = Fieldlands.MOUNTAINS[0];
  const hermit = new NPC(scene, { name: 'Hermit', pos: { x: peak.x + 2.5, z: peak.z + 1 }, ground: G, yaw: Math.PI / 2,
    look: { skin: 0xb89a80, shirt: 0x6a6a5a, pants: 0x4a4a40, cloak: 0x5a5448, hat: 'wide', hatColor: 0x5a5040, beard: 0xe8e8e0, height: 1.7 } });
  const talkHermit = (game) => game.talk(save.learned.includes('skybreaker') ? [
    { who: 'Hermit', text: 'Still here? The view is the same as ever. Go on, use what I showed you.' },
  ] : [
    { who: 'Hermit', text: '...Someone climbed all this way? For an old man and a lot of wind?' },
    { who: 'Hermit', text: "Then you've legs, and you've stubbornness. That's half of what I teach." },
    { who: 'Hermit', text: "Watch. You leap, you hang there, and you bring the whole sky down with you. Skybreaker, my master called it." },
    { who: '', text: 'You learned Skybreaker! (7 Stamina: a leap and a crash, 9-11 damage.)', onShow: () => learn('skybreaker') },
  ], { with: hermit.root.position });

  // --- Your party: Vivian, and Marrow once he joins --------------------------------
  const marrow = hollow.npcs.marrow;
  const inParty = (who) => save.recruits.includes(who);
  const setRecruit = (who, on) => {
    save.recruits = save.recruits.filter((r) => r !== who);
    if (on) save.recruits.push(who);
    store();
  };
  // Marrow walks along behind your other shoulder
  const followMarrow = (dt, P) => {
    const s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    const tx = P.pos.x - s * 2.6 - c * 1.5, tz = P.pos.z - c * 2.6 + s * 1.5;
    const fx = tx - marrow.pos.x, fz = tz - marrow.pos.z, fd = Math.hypot(fx, fz);
    if (fd > 40) { marrow.pos.x = tx; marrow.pos.z = tz; }
    else if (fd > 0.05) { const sp = Math.min(fd * 2.4, 16) * dt; marrow.pos.x += (fx / fd) * Math.min(sp, fd); marrow.pos.z += (fz / fd) * Math.min(sp, fd); }
    const fy = world.floorBelow(marrow.pos.x, marrow.pos.z, P.pos.y + 4);
    marrow.pos.y = Number.isFinite(fy) && fy > -1e3 ? fy : P.pos.y;
    marrow.root.position.copy(marrow.pos);
    const yaw = fd > 1 ? Math.atan2(fx, fz) : P.yaw;
    marrow.yaw += Math.atan2(Math.sin(yaw - marrow.yaw), Math.cos(yaw - marrow.yaw)) * Math.min(1, dt * 6);
    marrow.root.rotation.y = marrow.yaw;
    // a bit of a stride when walking
    const parts = marrow.model.userData.parts, walk = Math.min(1, fd / 1.5);
    parts.armL.rotation.x = Math.sin(t * 9) * 0.5 * walk; parts.armR.rotation.x = -Math.sin(t * 9) * 0.5 * walk;
    marrow.model.position.y = Math.abs(Math.sin(t * 9)) * 0.06 * walk;
  };
  const marrowHome = { pos: marrow.pos.clone(), yaw: marrow.homeYaw };
  if (save.flags.marrowAt) { marrow.pos.set(save.flags.marrowAt.x, save.flags.marrowAt.y, save.flags.marrowAt.z); marrow.root.position.copy(marrow.pos); }
  const MARROW_MOVES = [
    { name: 'Lantern Bash', cost: 2, desc: 'A clout with his lantern. 3-4 damage.', hits: [{ at: 0.2, dur: 0.5, dmg: [3, 4] }] },
    { name: 'Cleave', cost: 5, desc: 'A great two-handed cut. 5-7 damage.', hits: [{ at: 0.3, dur: 0.7, dmg: [5, 7] }] },
    { name: 'Guard', cost: 1, guard: true, desc: 'He braces: half damage until his next turn.' },
    { name: 'Catch Breath', cost: 0, rest: 3, desc: 'Skip his attack and get 3 Stamina back.' },
  ];
  // party HP is kept between fights (until you rest)
  const partyHp = save.flags.partyHp || {};
  const member = (key, def) => ({ ...def, hp: partyHp[key] ?? def.maxHp, key });

  // --- Region names and music ------------------------------------------------------
  const regionOf = (P) => (Throne.contains(P.pos.x, P.pos.z) ? 'throne' : Hollow.contains(P.pos.x, P.pos.z) ? 'hollow' : fields.inside ? 'fields' : 'beach');
  const REGION = {
    beach: { name: NAME, music: MUSIC },
    fields: { name: Fieldlands.NAME, music: Fieldlands.MUSIC },
    hollow: { name: Hollow.NAME, music: Fieldlands.MUSIC },
    throne: { name: Throne.NAME, music: null },
  };
  let region = 'beach';

  // --- The Hollow Warden -------------------------------------------------------------
  let bossBusy = false;
  if (save.flags.wardenDead) { throne.remove(); throne.openGate(); }
  const bossReward = new Pickup(scene, { id: 'blade', weapon: 'blade', pos: new THREE.Vector3(Throne.ARENA.x, Throne.PLATEAU.y, Throne.ARENA.z) });
  if (!save.flags.wardenDead && !bossReward.taken) scene.remove(bossReward.root);
  pickups.push(bossReward);
  const enterFog = (game) => {
    bossBusy = true;
    const P = game.player;
    P.locked = true;
    game.fade(() => { P.pos.copy(throne.gateIn); P.pos.y = G(P.pos.x, P.pos.z); P.yaw = -Math.PI / 2; P.fwd = 0; });
    setTimeout(() => { throne.rise(); game.banner('THE HOLLOW WARDEN'); }, 900);
    setTimeout(() => {
      const sp = throne.playerSpot.clone(); sp.y = G(sp.x, sp.z);
      const ep = throne.standPos.clone();
      game.fight({
        spots: { player: sp, enemy: ep },
        enemy: Throne.wardenFighter(throne.warden, Math.PI / 2),
        allies: allies(),
      }).then((res) => {
        const { won, lost } = res;
        keepHp(res);
        bossBusy = false;
        if (won) {
          flag('wardenDead');
          throne.remove(); throne.openGate();
          scene.add(bossReward.root);
          game.banner('WARDEN FELLED', 'felled');
          game.toast('The fog clears from the throne.');
        } else if (lost) {
          game.banner('YOU FELL', 'died');
          setTimeout(() => game.respawn(), 2200);
        } else {
          // ran: back out through the fog
          P.pos.set(Throne.GATE.x + 3, Throne.PLATEAU.y, Throne.GATE.z);
          P.locked = false;
        }
      });
    }, 3600);
  };

  // --- Waves lapping: drift the water textures --------------------------------------
  let t = 0;
  const update = (dt, game) => {
    t += dt;
    if (ghost && game && !game.battling) {
      ghost.update(dt, game.player);
      if (ghost.state === 'cornered' && !talking) meet(game);
    }
    if (game) {
      const P = game.player;
      // the weather: the fog lifts as you come down into the fieldlands, and
      // closes in, dark, round the Hollow Throne
      fields.update(dt, P, Throne.contains(P.pos.x, P.pos.z));
      const r = regionOf(P);
      if (r !== region) {
        const was = REGION[region];
        region = r;
        if (REGION[r].music !== was.music) game.music(REGION[r].music);
        game.card(REGION[r].name);
      }
      hollow.update(dt, P);
      throne.update(dt);
      hermit.update(dt, P);
      for (const p of pickups) p.update(dt);
      if (inParty('marrow') && !game.battling) followMarrow(dt, P);
      game.partyInfo = () => [
        ...(ghost && progress.party ? [{ name: GHOST, hp: partyHp.vivian ?? 10, maxHp: 10 }] : []),
        ...(inParty('marrow') ? [{ name: 'Marrow', hp: partyHp.marrow ?? 14, maxHp: 14 }] : []),
      ];
      // enemies: touch one and it's a fight
      const busy = game.battling || game.talking || fighting || bossBusy || (game.bag && game.bag.open);
      for (const e of fields.enemies) if (e.update(dt, game.player, busy) && !busy) { fightEnemy(game, e); break; }
    }
    wt.offset.set(t * 0.004, t * 0.012);
    wt2.offset.set(-t * 0.006, t * 0.008);
    sea.position.y = SEA + Math.sin(t * 0.9) * 0.06;
    skyTex.offset.x = t * 0.002;
  };

  // --- The shy ghost -----------------------------------------------------------------
  // A dark figure floats ahead of where you wake up. She backs away from you until
  // you corner her against the edge of the beach. Talk to her to learn the basics,
  // or to fight her for practice.
  let ghost = null, met = !!progress.metGhost, talking = false;
  if (models.ghost) {
    const start = met ? progress.ghostAt : { x: -3, z: 2 };
    ghost = new ShyGhost(scene, models.ghost.clone(), {
      pos: start, ground: G, height: 1.9,
      region: { minX: -60, maxX: 10, minZ: -14, maxZ: 32 },
    });
    if (met) { ghost.reveal = 1; ghost.setLook(); ghost.state = 'idle'; }
  }

  // Corner her: the darkness fades and she talks to you.
  const meet = (game) => {
    talking = true;
    ghost.startReveal();
    progress.metGhost = true; progress.ghostAt = { x: ghost.pos.x, z: ghost.pos.z }; saveProgress();
    game.talk([
      { who: '???', text: 'Eek! N-no, please! Don’t hurt me!' },
      { who: '???', text: '...' },
      { who: '???', text: "Oh. You're... not one of them, are you? You washed up with that wreck." },
      { who: '???', text: "I'm sorry I kept running. Everyone who sees me screams, so I... I hide. I'm a ghost, you see." },
      { who: GHOST, text: `I'm ${GHOST}. It's... nice to meet you.` },
      { who: GHOST, text: 'You look lost. If you want... I could teach you the basics. How to get around, and how to fight. Only if you want to.',
        choices: ['Yes, please', 'Not right now'],
        then: (k) => {
          if (k === 0) { progress.taught = true; saveProgress(); return [...basics(), { who: GHOST, text: "I'll be here, if you need me again." }]; }
          return [{ who: GHOST, text: "Oh. That's okay. I'll... be right here if you change your mind." }];
        } },
    ], { with: ghost.root.position }).then(() => { talking = false; });
  };
  // A practice fight with her.
  const spar = (game) => {
    const P = game.player, gp = ghost.pos;
    let dx = P.pos.x - gp.x, dz = P.pos.z - gp.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const px = gp.x + dx * 4.5, pz = gp.z + dz * 4.5;
    const zone = {
      spots: { player: new THREE.Vector3(px, G(px, pz), pz), enemy: new THREE.Vector3(gp.x, G(gp.x, gp.z), gp.z) },
      enemy: { name: GHOST, maxHp: 12, maxSp: 8, atk: 1, attackText: 'swings a shadowy fist at you', model: ghost.root, top: 3.4,
        intro: `${GHOST} is ready for a practice fight!`,
        picture: { height: 2.15, dist: 3.0, yaw: Math.atan2(dx, dz) } },
    };
    return game.fight(zone).then(({ won, lost }) => {
      progress.sparred = true; saveProgress();
      const lines = won ? [
        { who: GHOST, text: 'Ow, ow, ow... okay! You win! You\u2019re stronger than you look.' },
        { who: GHOST, text: "That's good. Whatever's out there won't go easy on you like I did." },
      ] : lost ? [
        { who: GHOST, text: "Oh no! Are you alright?! I-I didn't mean to hit you that hard..." },
        { who: GHOST, text: "Let's just call that practice. Remember to Catch Breath when you're tired, okay?" },
      ] : [
        { who: GHOST, text: "Oh! That's okay. Running away is smart sometimes. I do it all the time." },
      ];
      return game.talk(lines, { with: ghost.root.position });
    });
  };
  // --- Vivian in your party: she follows you and fights at your side ------------------
  const setParty = (on) => {
    progress.party = on;
    if (!on) progress.ghostAt = { x: ghost.pos.x, z: ghost.pos.z };
    saveProgress();
    ghost.state = on ? 'follow' : 'idle';
  };
  if (ghost && progress.party) ghost.state = 'follow';
  const VIVIAN_MOVES = [
    { name: 'Shadow Fist', cost: 2, desc: 'A punch wrapped in shadow. 2-3 damage.', hits: [{ at: 0.2, dur: 0.5, dmg: [2, 3] }] },
    { name: 'Dark Flame', cost: 5, desc: 'A burst of ghostly fire. 4-6 damage.', hits: [{ at: 0.3, dur: 0.75, dmg: [4, 6] }] },
    { name: 'Catch Breath', cost: 0, rest: 3, desc: 'Skip her attack and get 3 Stamina back.' },
  ];
  const allies = () => [
    ...(ghost && progress.party ? [member('vivian', { name: GHOST, maxHp: 10, maxSp: 8, moves: VIVIAN_MOVES, node: ghost.root, lift: 1.1, top: 3.1, picture: { height: 2.55, dist: 3.0 } })] : []),
    ...(inParty('marrow') ? [member('marrow', { name: 'Marrow', maxHp: 14, maxSp: 6, moves: MARROW_MOVES, node: marrow.root, lift: 0, top: 2.5, picture: { height: 1.65, dist: 2.2 } })] : []),
  ];
  // after a fight: remember how hurt everyone is
  const keepHp = (result) => {
    for (const f of result.party || []) if (f.key) partyHp[f.key] = Math.max(1, f.hp);
    save.flags.partyHp = partyHp; store();
  };

  // --- Fighting the fieldlands' enemies ---------------------------------------------
  let fighting = false;
  const fightEnemy = (game, e) => {
    fighting = true;
    const P = game.player;
    let dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const px = e.pos.x + dx * 4.5, pz = e.pos.z + dz * 4.5;
    e.yaw = Math.atan2(dx, dz); e.place();
    game.fight({
      spots: { player: new THREE.Vector3(px, G(px, pz), pz), enemy: new THREE.Vector3(e.pos.x, e.pos.y, e.pos.z) },
      enemy: e.fighter(Math.atan2(dx, dz)),
      allies: allies(),
    }).then((res) => {
      const { won, lost } = res;
      keepHp(res);
      if (won) e.remove();
      else e.cool = 4;                               // ran away: it leaves you alone for a bit
      fighting = false;
      if (lost) { game.banner('YOU FELL', 'died'); setTimeout(() => game.respawn(), 2200); }   // knocked out: you come round where you last rested
    });
  };

  // Talk to her again later.
  const chat = (game) => {
    talking = true;
    const inParty = progress.party;
    game.talk([
      { who: GHOST, text: inParty ? 'Hm? Did you need something?' : progress.sparred ? 'Oh! Hello again. Did you need something?' : 'Oh, hello again. Did you need something?',
        choices: ['Teach me the basics', "Let's spar", inParty ? 'Wait here for now' : 'Come with me?', 'Never mind'],
        then: (k) => {
          if (k === 0) { progress.taught = true; saveProgress(); return basics(); }
          if (k === 1) return [{ who: GHOST, text: progress.sparred ? 'Again? Okay... Ready when you are!' : "F-fight? Me? Um... okay. Just for practice. Here I come!", onShow: () => { wantSpar = true; } }];
          if (k === 2 && inParty) return [{ who: GHOST, text: "Oh. Okay. I'll wait right here. Come back for me, alright?", onShow: () => setParty(false) }];
          if (k === 2) return [
            { who: GHOST, text: 'M-me? Come with you?' },
            { who: GHOST, text: '...Nobody has ever asked me that before.' },
            { who: GHOST, text: "Okay! I'll come. I'll try to be useful, I promise. I'm good at shadows, and... and hiding.", onShow: () => setParty(true) },
            { who: '', text: `${GHOST} joined your party! She'll fight at your side.` },
          ];
          return [{ who: GHOST, text: inParty ? 'Okay! Lead the way.' : 'Okay. Be careful out there.' }];
        } },
    ], { with: ghost.root.position }).then(() => {
      if (wantSpar) { wantSpar = false; return spar(game); }
    }).then(() => { talking = false; });
  };
  let wantSpar = false;
  const ghostNear = (P) => ghost && (ghost.state === 'idle' || ghost.state === 'follow') && Math.hypot(P.pos.x - ghost.pos.x, P.pos.z - ghost.pos.z) < 3.4;

  // You wash up face down a few metres from the water, head towards the land.
  const sx = 0, sz = shoreZ(0) + 6;
  const rested = save.flags.restAt === 'tavern';
  // resting by Hesta's fire heals everyone and makes it where you come round
  const partyHeal = () => { for (const k of Object.keys(partyHp)) delete partyHp[k]; save.flags.partyHp = partyHp; store(); if (gameRef) { gameRef.player.health = 8; gameRef.player.stamina = gameRef.player.maxStamina; } };
  const setRest = () => flag('restAt', 'tavern');
  let gameRef = null;
  const near = (P, n, r = 2.6) => Math.hypot(P.pos.x - n.pos.x, P.pos.z - n.pos.z) < r && Math.abs(P.pos.y - n.pos.y) < 2.2;
  const say = (game, fn) => { talking = true; Promise.resolve(fn()).then(() => { talking = false; }); };
  const interact = (game) => {
    gameRef = game;
    const P = game.player;
    if (talking || bossBusy) return null;
    for (const p of pickups) if (p.near(P)) return { text: `B \u2014 Pick up ${p.label}`, go: () => { const what = p.take(); game.toast(`Got ${what}`); } };
    for (const [key, n] of Object.entries(hollow.npcs)) {
      if (near(P, n)) return { text: `B \u2014 Talk to ${n.name}`, go: () => say(game, () => hollow.talks[key]({ game, npc: n, partyHeal, setRest,
        inParty: () => inParty('marrow'),
        setParty: (on) => {
          setRecruit('marrow', on);
          marrow.following = on;
          if (!on) { save.flags.marrowAt = { x: marrow.pos.x, y: marrow.pos.y, z: marrow.pos.z }; marrow.homeYaw = marrow.yaw; store(); }
        } })) };
    }
    if (near(P, hermit)) return { text: 'B \u2014 Talk to the Hermit', go: () => say(game, () => talkHermit(game)) };
    if (!save.flags.wardenDead && Math.hypot(P.pos.x - (Throne.GATE.x + 1.2), P.pos.z - Throne.GATE.z) < 3.2) return { text: 'B \u2014 Step through the fog', go: () => enterFog(game) };
    // Vivian last: she's often right beside you
    if (ghostNear(P)) return { text: `B \u2014 Talk to ${GHOST}`, go: () => chat(game) };
    return null;
  };
  marrow.following = inParty('marrow');
  return {
    spawn: rested ? hollow.restSpot.clone() : new THREE.Vector3(sx, G(sx, sz), sz),
    spawnYaw: rested ? hollow.restYaw : 0,
    spawnYaw: 0,
    startLying: !rested,
    update,
    ghost, fields, hollow, throne, pickups, hermit,   // for tests
    // B near the ghost: talk
    interact,
  };
}

// For tests and tooling.
export const layout = { SEA, SAND_TOP, AREA, shoreZ, FIELDLANDS: { FLOOR: Fieldlands.FLOOR, SLOPE: Fieldlands.SLOPE, CENTRE: Fieldlands.CENTRE } };
