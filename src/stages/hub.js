import * as THREE from 'three';
import { Terrain } from '../terrain.js?v=12';

// ---------------------------------------------------------------------------
// TAX HAVEN: the hub. Castle grounds with a castle; jump into the painting on
// the castle's front wall to enter Sunny Spire Hill. A second frame waits for
// a future course.
// ---------------------------------------------------------------------------

export const NAME = 'Tax Haven';
export const MUSIC = 'sunny-spire-hill.mp3';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const BOUNDS = { minX: -60, maxX: 60, minZ: -60, maxZ: 70 };
const WALL_Z = 30;              // castle front wall
const PAINTING = { x: -12, w: 6, h: 5, y: 1.2 };
const PATH = [[0, -48], [0, -20], [0, WALL_Z - 0.5]];
const PATH2 = [[0, 0], [-12, 18], [-12, WALL_Z - 0.5]];

function height(x, z) {
  let h = (noise(x * 0.05, z * 0.05) - 0.5) * 2.2;
  h += 3 * Math.exp(-(((x + 35) / 12) ** 2 + ((z + 20) / 12) ** 2));
  h += 2.5 * Math.exp(-(((x - 38) / 10) ** 2 + ((z + 5) / 14) ** 2));
  // flat courtyard in front of the castle
  h *= smooth(28, 40, Math.hypot(x, (z - 18) * 1.2));
  const edge = Math.max(Math.abs(x) - (BOUNDS.maxX - 14), z - (BOUNDS.maxZ - 14), -z - (-BOUNDS.minZ - 14));
  if (edge > 0) h += Math.pow(edge / 14, 1.5) * 22 + noise(x * 0.1, z * 0.1) * 3 * smooth(0, 5, edge);
  return h;
}

// The painting: a picture of Sunny Spire Hill drawn on a canvas.
function paintingTexture(title, locked) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 420;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, locked ? '#3a3a52' : '#2f78d8'); sky.addColorStop(1, locked ? '#6c6c88' : '#bfe2fb');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 420);
  if (!locked) {
    g.fillStyle = '#4fb33a';
    g.beginPath(); g.moveTo(0, 330); g.quadraticCurveTo(120, 270, 256, 310); g.quadraticCurveTo(400, 350, 512, 290); g.lineTo(512, 420); g.lineTo(0, 420); g.fill();
    // the spiral mountain
    const tiers = [[256, 300, 170, 34], [256, 262, 128, 34], [256, 224, 90, 34], [256, 186, 54, 34]];
    for (const [x, y, w, h] of tiers) {
      g.fillStyle = '#b8521f'; g.fillRect(x - w, y - h, w * 2, h);
      g.fillStyle = '#5fc23e'; g.fillRect(x - w, y - h - 6, w * 2, 8);
      g.fillStyle = '#8a6a3c'; g.fillRect(x - w + 10, y - h - 2, w * 2 - 20, 3);
    }
    // star at the top
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#7a5a00'; g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28;
      g.lineTo(256 + Math.cos(a) * r, 118 + Math.sin(a) * r);
    }
    g.closePath(); g.fill(); g.stroke();
    // trees
    for (const [x, y] of [[60, 330], [100, 315], [420, 330], [460, 312], [360, 340]]) {
      g.fillStyle = '#7a4a1a'; g.fillRect(x - 3, y - 6, 6, 16);
      g.fillStyle = '#1e8a1e'; g.beginPath(); g.arc(x, y - 18, 16, 0, Math.PI * 2); g.fill();
    }
  } else {
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.fillText('?', 256, 250);
  }
  g.font = 'bold 40px "Luckiest Guy", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 8; g.strokeStyle = '#1b1b3a'; g.strokeText(title, 256, 398);
  g.fillStyle = '#ffd23f'; g.fillText(title, 256, 398);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function build(world) {
  const scene = world.scene;
  const grassT = world.tile('grass.webp'), cliffT = world.tile('cliff.png'), pathT = world.tile('path.png'), rockT = world.tile('rock.png');
  const terrain = new Terrain({
    ...BOUNDS, res: 0.9, height,
    paths: [{ points: PATH, width: 5 }, { points: PATH2, width: 3.5 }],
    grass: grassT, cliff: cliffT, path: pathT,
  });
  world.setTerrain(terrain);

  const stone = world.mat(null, { color: 0xf1e6cc });
  const stoneDark = world.mat(null, { color: 0xd8c8a4 });
  const wood = world.mat(world.tile('wood.jpg'), { uvScale: 1.6 });
  wood.color.set(0x8a5a32);
  const gold = new THREE.MeshLambertMaterial({ color: 0xd8a830, emissive: 0x3a2800 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc8302a, flatShading: true });
  const box = (min, max, m) => world.addBox(min, max, m);

  // --- Castle ------------------------------------------------------------------
  box([-20, -1, WALL_Z], [20, 14, WALL_Z + 18], { top: stoneDark, side: stone });
  box([-12, 14, WALL_Z + 2], [12, 22, WALL_Z + 16], { top: stoneDark, side: stone });      // upper keep
  for (let x = -19; x <= 18; x += 3) box([x, 14, WALL_Z], [x + 1.6, 15.2, WALL_Z + 1], stoneDark);   // battlements
  const towers = [[-23, WALL_Z - 1], [23, WALL_Z - 1], [-23, WALL_Z + 19], [23, WALL_Z + 19]];
  for (const [x, z] of towers) {
    box([x - 3, -1, z - 3], [x + 3, 19, z + 3], { top: stoneDark, side: stone });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 7, 8), roofMat);
    roof.position.set(x, 22.5, z);
    scene.add(roof);
  }
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(9, 9, 4), roofMat);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.position.set(0, 26.5, WALL_Z + 9);
  scene.add(keepRoof);
  // the big front door (decoration)
  box([-2.6, 0, WALL_Z - 0.2], [2.6, 6, WALL_Z], wood);
  box([-3, 6, WALL_Z - 0.3], [3, 6.6, WALL_Z], stoneDark);
  // window slits
  const winMat = new THREE.MeshBasicMaterial({ color: 0x2a2a40 });
  for (const x of [-16, -6, 6, 16]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), winMat);
    w.position.set(x, 10, WALL_Z - 0.02); w.rotation.y = Math.PI;
    scene.add(w);
  }

  // --- Paintings -----------------------------------------------------------------
  const portals = [];
  const painting = (x, title, to) => {
    const { w, h, y } = PAINTING;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: paintingTexture(title, !to) }));
    pic.position.set(x, y + h / 2, WALL_Z - 0.06);
    pic.rotation.y = Math.PI;
    scene.add(pic);
    // gold frame
    const f = 0.35;
    for (const [x0, y0, x1, y1] of [[x - w / 2 - f, y - f, x + w / 2 + f, y], [x - w / 2 - f, y + h, x + w / 2 + f, y + h + f], [x - w / 2 - f, y, x - w / 2, y + h], [x + w / 2, y, x + w / 2 + f, y + h]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.3), gold);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z - 0.15);
      scene.add(m);
    }
    if (to) portals.push({ min: [x - w / 2, y - 0.5, WALL_Z - 0.6], max: [x + w / 2, y + h, WALL_Z + 1], to });
  };
  painting(PAINTING.x, 'SUNNY SPIRE HILL', 'sunny');
  painting(-PAINTING.x, 'COMING SOON', null);

  // --- Trees ---------------------------------------------------------------------
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
  const spots = [[-30, -30], [-38, -8], [-28, 8], [30, -32], [40, -14], [30, 6], [-14, -40], [14, -42], [-40, 22], [42, 22], [-22, -18], [22, -20]];
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, spots.length);
  trees.frustumCulled = false;
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const shGeo = new THREE.CircleGeometry(1, 20); shGeo.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(shGeo, shadowMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    const y = terrain.height(x, z);
    trees.setMatrixAt(i, m4.compose(v.set(x, y - 0.15, z), q, s.set(6.5, 6.5, 6.5)));
    shadows.setMatrixAt(i, m4.compose(v.set(x, y + 0.04, z), q, s.set(1.8, 1, 1.8)));
    world.addBox([x - 0.22, y - 0.5, z - 0.22], [x + 0.22, y + 5, z + 0.22], stone, { visible: false });
  });
  scene.add(trees, shadows);

  const H = (x, z) => terrain.height(x, z);
  return {
    spawn: new THREE.Vector3(0, H(0, -36), -36), spawnYaw: 0,
    // coming back out of the painting after a course
    returnSpawn: new THREE.Vector3(PAINTING.x, H(PAINTING.x, WALL_Z - 4), WALL_Z - 4), returnYaw: Math.PI,
    portals,
  };
}
