import * as THREE from 'three';
import { MeshCollider } from '../collider.js?v=25';
import { IronBalls } from '../ironball.js?v=25';

// ---------------------------------------------------------------------------
// SUNNY SPIRE HILL, built on the level model (assets/sunny-spire-hill.glb).
//
// You start at the north edge. A wooden plank bridge runs down into the
// lowland where the stake stands by the gate; a ridge leads to a stone plaza.
// Another path skirts the orange lowland to the pale stone slope, which
// climbs to the terraced mountain; King Cherry Bomb waits on the summit. A
// little wooden bridge crosses the valley by the small stone spire, and
// cannons in the little grey holes fire you up to the floating island.
//
// The model's triangles are the collision (see collider.js).
// ---------------------------------------------------------------------------

export const NAME = 'Sunny Spire Hill';
export const MUSIC = 'sunny-spire-hill.mp3';
export const MODEL = 'sunny-spire-hill.glb';
export const STARS = 7;

const SCALE = 10.6;                                  // model units -> metres
const SUMMIT = { x: -24, z: 42 };
const ISLAND = { x: -38, z: -21 };
const PLAZA = { x: 69.2, z: -66.9 };                 // the round stone plaza (a cannon hole in its middle)
// The narrow road up the mountain's south-east side, top to bottom: iron balls roll down it.
const BALL_PATH = [[4.86, 78.91, 34.9], [6.31, 78.55, 34.1], [7.78, 78.33, 33.5], [9.24, 77.82, 32.7], [10.63, 77.17, 31.8], [12.01, 76.53, 30.9], [13.47, 76.04, 30.1], [14.78, 75.34, 29.2], [16.05, 74.58, 28.2], [17.38, 73.96, 27.4], [18.68, 73.3, 26.5], [20.05, 72.71, 25.6], [21.55, 72.25, 24.8], [22.96, 71.64, 23.9], [24.27, 70.95, 23.0], [25.61, 70.32, 22.2], [26.88, 69.59, 21.3], [28.21, 68.99, 20.4], [29.67, 68.5, 19.6], [31.18, 68.06, 18.8], [32.51, 67.35, 17.9], [33.88, 66.8, 17.1], [35.24, 66.17, 16.2], [36.61, 65.5, 15.3], [37.95, 64.79, 14.3], [39.88, 64.42, 13.5]];
const STAKE = { x: 4, z: -58 };                      // in the lowland, in front of the gate
const GATE = { x: -6, z: -56.4 };
const BIG_SPIRE = { x: -48, z: -56 };                // the big cobblestone spire
const SMALL_SPIRE = { x: 44, z: -9 };                // the small one, by the little valley
// The little grey holes in the ground: x, z, initial aim (yaw, pitch), shot
// speed. The ground ones start aimed at the floating island; the island's own
// cannon is aimed at the summit.
const CANNONS = [
  [69.2, -66.9, -1.19, 0.72, 80],   // stone plaza
  [62.1, 29.8, -2.04, 0.55, 80],    // on top of the big boulder
  [-58.4, 67.3, 2.885, 0.8, 62],    // mountain, outer terrace
  [-36.1, 18.4, -3.093, 0.55, 40],  // mountain, upper terrace
  [-37.2, -20.6, 0.208, 0.55, 62],  // the floating island (aimed at the summit)
];

export function build(world, coins, reds, { model }) {
  const scene = world.scene;

  // --- The level model ------------------------------------------------------
  // --- Sky: the sunny SM64 skybox wrapped round a big sphere that follows the camera
  {
    const tex = world.loader.load(`assets/sky-sunny.png?v=${world.version}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -4;                     // four times round; negative because we see it from inside
    tex.magFilter = THREE.LinearFilter;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    sky.onBeforeRender = (r, sc, cam) => { sky.position.copy(cam.position); sky.updateMatrixWorld(); };
    scene.add(sky);
    scene.fog.color.set(0xd6eefa);
  }

  const level = model.clone(true);
  level.scale.setScalar(SCALE);
  scene.add(level);
  level.updateMatrixWorld(true);
  const meshes = [], tris = [];
  const v = new THREE.Vector3();
  level.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    const map = src.map;
    if (map) { map.magFilter = THREE.LinearFilter; map.anisotropy = 8; map.colorSpace = THREE.SRGBColorSpace; }
    o.material = new THREE.MeshLambertMaterial({ map, color: src.color, side: THREE.DoubleSide, alphaTest: src.transparent ? 0.5 : 0 });
    o.material.name = src.name;
    meshes.push(o);
    const g = o.geometry, p = g.attributes.position, idx = g.index;
    const count = idx ? idx.count : p.count;
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
      tris.push(v.x, v.y, v.z);
    }
  });
  const collider = new MeshCollider(new Float32Array(tris));
  world.setCollider(collider, meshes);
  // ground height at (x, z), highest surface at or below y
  const G = (x, z, y = 200) => collider.floor(x, z, y);

  const wood = world.mat(world.tile('wood.jpg'), { uvScale: 1.6 });
  wood.color.set(0xa9835a);
  const box = (min, max, m) => world.addBox(min, max, m);

  // --- A little bridge across the valley by the small stone spire ------------
  const bz0 = -23.5, bz1 = -19.5, bx0 = 21, bx1 = 42;
  const deck = Math.max(G(bx0, (bz0 + bz1) / 2, 20), G(bx1, (bz0 + bz1) / 2, 20)) + 0.02;
  box([bx0, deck - 0.3, bz0], [bx1, deck, bz1], wood);
  for (let x = bx0 + 1; x <= bx1 - 0.5; x += 2.5) {
    box([x, deck, bz0 - 0.25], [x + 0.25, deck + 1.1, bz0], wood);
    box([x, deck, bz1], [x + 0.25, deck + 1.1, bz1 + 0.25], wood);
  }
  box([bx0, deck + 0.95, bz0 - 0.25], [bx1, deck + 1.1, bz0], wood);
  box([bx0, deck + 0.95, bz1], [bx1, deck + 1.1, bz1 + 0.25], wood);
  // support posts down into the valley
  for (const x of [bx0 + 6, bx1 - 6]) for (const z of [bz0 + 0.3, bz1 - 0.6]) box([x, G(x, z, deck - 1) - 0.2, z], [x + 0.3, deck - 0.3, z + 0.3], wood);

  // --- Stone steps (just under the step-up height, so you walk straight up) --
  const stone = world.mat(world.tile('rock.png'), { uvScale: 2 });
  const RISE = 0.28, RUN = 0.55;

  // big stone spire: steps up its south face to the top
  {
    const top = G(BIG_SPIRE.x + 1.5, BIG_SPIRE.z) + 0.02, x0 = BIG_SPIRE.x - 1.2, x1 = BIG_SPIRE.x + 1.2;
    let z = BIG_SPIRE.z + 5.4, y = top;
    box([x0, 9.5, BIG_SPIRE.z + 2.2], [x1, top, z], stone);              // landing at the top edge
    while (true) {
      const ground = G((x0 + x1) / 2, z + RUN / 2, 14);
      if (y - RISE < ground + 0.1) break;
      y -= RISE;
      box([x0, 9.5, z], [x1, y, z + RUN], stone);
      z += RUN;
    }
  }
  // stone cap over the hole in the spire's top
  box([BIG_SPIRE.x - 1.3, G(BIG_SPIRE.x + 1.5, BIG_SPIRE.z) - 0.6, BIG_SPIRE.z - 1.8], [BIG_SPIRE.x + 0.8, G(BIG_SPIRE.x + 1.5, BIG_SPIRE.z) + 0.02, BIG_SPIRE.z + 0.8], stone);

  // --- The stake in the lowland by the gate (ground-pound it three times) -----
  const penFloor = G(STAKE.x, STAKE.z, 5);
  const stake = box([STAKE.x - 0.45, penFloor - 0.5, STAKE.z - 0.45], [STAKE.x + 0.45, penFloor + 2.0, STAKE.z + 0.45], wood);

  // --- Trees (camera-facing sprites with blob shadows) ------------------------
  const treeSpots = [[-70, -86], [-62, -78], [-74, -70], [-30, -88], [-40, -80], [20, -88], [36, -84], [48, -88],
    [-72, -40], [-66, -22], [-74, -6], [-62, 10], [60, -40], [74, -36], [84, -20], [66, -8], [86, 4],
    [58, 64], [72, 70], [86, 60], [-68, 60], [-72, 40], [-60, 74], [10, 70], [24, 72]];
  const treeTex = world.loader.load(`assets/tree.png?v=${world.version}`);
  treeTex.colorSpace = THREE.SRGBColorSpace;
  const treeGeo = new THREE.PlaneGeometry(181 / 256, 1); treeGeo.translate(0, 0.5, 0);
  const treeMat = new THREE.MeshBasicMaterial({ map: treeTex, alphaTest: 0.5, side: THREE.DoubleSide });
  treeMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
vec3 tc = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float tsx = length(instanceMatrix[0].xyz), tsy = length(instanceMatrix[1].xyz);
vec3 camR = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
vec4 mvPosition = viewMatrix * vec4(tc + camR * position.x * tsx + vec3(0.0, position.y * tsy, 0.0), 1.0);
gl_Position = projectionMatrix * mvPosition;`);
  };
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, treeSpots.length);
  trees.frustumCulled = false;
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shGeo = new THREE.CircleGeometry(1, 20); shGeo.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(shGeo, shadowMat, treeSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  treeSpots.forEach(([x, z], i) => {
    const y = G(x, z), s = 6 + (i % 3) * 0.6;
    trees.setMatrixAt(i, m4.compose(ps.set(x, y - 0.15, z), q, sc.set(s, s, s)));
    shadows.setMatrixAt(i, m4.compose(ps.set(x, y + 0.04, z), q, sc.set(1.7, 1, 1.7)));
    world.addBox([x - 0.22, y - 0.5, z - 0.22], [x + 0.22, y + s * 0.75, z + 0.22], wood, { visible: false });
  });
  scene.add(trees, shadows);

  // --- Coins -------------------------------------------------------------------
  const onFloor = (x, z, yMax = 200) => { const y = world.floorBelow(x, z, yMax); if (y > -Infinity) coins.add(x, y + 0.9, z); };
  const line = (a, b, n, yMax) => { for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1); onFloor(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, yMax); } };
  const ring = (cx, cz, r, n, yMax) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; onFloor(cx + Math.cos(a) * r, cz + Math.sin(a) * r, yMax); } };
  line([-12, -88], [-14, -66], 5);                 // from the start
  line([-8, -70], [10, -70], 5);                   // over the plank bridge
  line([16, -70], [56, -69], 8);                   // along the ridge to the pen
  ring(STAKE.x, STAKE.z, 4.5, 8);                  // round the stake
  ring(PLAZA.x, PLAZA.z, 5.5, 8);                  // round the stone plaza
  line([-12, -58], [18, -34], 6);                  // the path beside the lowland
  line([22, -10], [40, -14], 5, 5);                // down in the little valley
  line([0, -30], [-14, 2], 6);                     // up the stone slope
  for (const r of [30, 24]) ring(SUMMIT.x, SUMMIT.z, r, 12, 44);   // mountain terraces
  ring(SUMMIT.x, SUMMIT.z, 9, 8);                  // summit
  line([30, 30], [42, 56], 6);                     // the stone bridge
  ring(62, 30, 8, 8);                              // round the big boulder
  ring(ISLAND.x, ISLAND.z, 7, 8);                  // floating island
  line([-70, -60], [-70, -20], 6);                 // west field
  line([60, 60], [86, 40], 6);                     // south-east field
  ring(BIG_SPIRE.x, BIG_SPIRE.z, 6, 8);            // round the big stone spire

  // --- Red coins: all 8 make a star appear on the stone slope ---------------------
  const red = (x, z, up = 0.9, yMax = 200) => { const y = world.floorBelow(x, z, yMax); if (y > -Infinity) reds.add(x, y + up, z); };
  red(SMALL_SPIRE.x, SMALL_SPIRE.z + 1);           // on the small stone spire
  red(5, -69.5, 1.8);                              // above the plank bridge
  red(31, -26, 0.9, 5);                            // under the new bridge
  red(36, 42, 0.9, 12);                            // on the stone bridge
  red(80, -80);                                    // behind the Chain Chomp's pen
  red(-74, -88);                                   // far north-west corner
  red(-50, 30, 0.9, 30);                           // on a mountain terrace
  red(86, 70);                                     // far south-east corner

  // --- Stake: count ground pounds on top of it ------------------------------------
  const stakeH0 = stake.max.y - stake.min.y;
  let pounds = 0, pounding = false;
  // --- Iron balls rolling down the mountain road ----------------------------------
  const ballTex = world.loader.load(`assets/iron-ball.png?v=${world.version}`);
  ballTex.colorSpace = THREE.SRGBColorSpace;
  const balls = new IronBalls(scene, world, BALL_PATH, { texture: ballTex, every: 4.5 });

  const update = (dt, game) => {
    const P = game.player;
    balls.update(dt, P);
    const onStake = Math.abs(P.pos.x - STAKE.x) < 0.8 && Math.abs(P.pos.z - STAKE.z) < 0.8 && Math.abs(P.pos.y - stake.max.y) < 0.08;
    if (P.state === 'gp_land' && onStake && !pounding && pounds < 3) {
      pounding = true;
      pounds++;
      stake.max.y -= 0.6;
      stake.mesh.scale.y = (stake.max.y - stake.min.y) / stakeH0;
      stake.mesh.position.y = (stake.min.y + stake.max.y) / 2;
      P.pos.y = stake.max.y;
      game.fx.shake(0.3); game.fx.dust(P.pos, 10);
      if (pounds === 3) game.spawnStar(6, new THREE.Vector3(GATE.x, G(GATE.x, GATE.z, 5) + 1.6, GATE.z));   // the gate's star
    }
    if (P.state !== 'gp_land') pounding = false;
  };

  // --- Cannons, down in the grey holes: drop in to climb aboard ----------------
  const cannons = CANNONS.map(([x, z, yaw, pitch, speed]) => {
    const top = G(x + 2.4, z);                  // the ground round the hole
    return { x, z, y: G(x, z, top - 1), top, yaw, pitch, speed };
  });

  const top = G(SUMMIT.x, SUMMIT.z);
  return {
    spawn: new THREE.Vector3(-12, G(-12, -90), -90),
    spawnYaw: 0,
    update,
    cannons,
    // Stars: 1 King Cherry Bomb, 2 hundred coins, 3 red coins, 6 the stake appear
    // during play; these sit in the level from the start.
    stars: [
      { n: 4, pos: new THREE.Vector3(ISLAND.x - 7, G(ISLAND.x - 7, ISLAND.z) + 1.4, ISLAND.z) },                   // floating island
      { n: 5, pos: new THREE.Vector3((bx0 + bx1) / 2, G((bx0 + bx1) / 2, -16, 5) + 1.3, -16) },                   // down in the little valley
      { n: 7, pos: new THREE.Vector3(BIG_SPIRE.x, G(BIG_SPIRE.x + 1.5, BIG_SPIRE.z) + 1.6, BIG_SPIRE.z - 1) },       // on top of the big stone spire
    ],
    redStar: new THREE.Vector3(-4, G(-4, -10) + 1.6, -10),
    boss: { x: SUMMIT.x, z: SUMMIT.z, y: top, arena: 12 },
    bombs: [[-20, -72], [12, -69], [40, -69], [58, -58], [0, -46], [14, -32], [30, -15], [-6, -16],
      [36, 42], [56, 12], [-64, -44], [-56, -6], [-50, 20], [0, 22], [-44, 60], [74, 60]],
  };
}

// For tests and tooling.
export const layout = { BALL_PATH, SUMMIT, ISLAND, PLAZA, STAKE, GATE, BIG_SPIRE, SMALL_SPIRE, CANNONS };
