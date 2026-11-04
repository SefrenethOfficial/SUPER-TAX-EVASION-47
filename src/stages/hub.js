import * as THREE from 'three';

// ---------------------------------------------------------------------------
// TAX HAVEN: the hub, inside the castle. A lobby with a tiled floor, a red
// carpet and pillars. Jump into the painting on the far wall to enter Sunny
// Spire Hill. A second frame waits for a future course.
// ---------------------------------------------------------------------------

export const NAME = 'Tax Haven';
export const MUSIC = 'sunny-spire-hill.mp3';

const ROOM = { x: 16, z0: -22, z1: 20, h: 12 };   // half width, back/front walls, height
const WALL_Z = ROOM.z1;                              // inner face of the painting wall
const PAINTING = { x: -8, w: 6, h: 5, y: 1.4 };

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
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
  scene.background = new THREE.Color(0x1a1420);
  scene.fog = null;

  // Floor tiles, carpet and stone walls
  const tiles = canvasTex(128, 128, (g, w, h) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#d9cfb8' : '#b8ab90'; g.fillRect(x * 64, y * 64, 64, 64);
      g.strokeStyle = 'rgba(80,60,40,.35)'; g.lineWidth = 2; g.strokeRect(x * 64 + 1, y * 64 + 1, 62, 62);
    }
  }, true);
  const carpet = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#a3192a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e2b13c'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
    g.fillStyle = '#7d1020'; g.fillRect(10, 0, 3, h); g.fillRect(w - 13, 0, 3, h);
  }, true);
  const stoneT = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,100,70,.35)'; g.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      g.beginPath(); g.moveTo(0, r * 32); g.lineTo(w, r * 32); g.stroke();
      for (let k = 0; k < 2; k++) { const x = ((k * 64) + (r % 2) * 32) % w; g.beginPath(); g.moveTo(x, r * 32); g.lineTo(x, r * 32 + 32); g.stroke(); }
    }
  }, true);
  const floorMat = world.mat(tiles, { uvScale: 3 });
  const carpetMat = world.mat(carpet, { uvScale: 4, strip: true });
  const stone = world.mat(stoneT, { uvScale: 3 });
  const trim = world.mat(null, { color: 0x8a6a48 });
  const gold = new THREE.MeshLambertMaterial({ color: 0xd8a830, emissive: 0x3a2800 });
  const box = (min, max, m) => world.addBox(min, max, m);
  const { x: hx, z0, z1, h } = ROOM;

  // --- The room ------------------------------------------------------------------
  box([-hx - 1, -1, z0 - 1], [hx + 1, 0, z1 + 1], floorMat);
  box([-2.5, 0, z0], [2.5, 0.03, z1], { top: carpetMat, side: trim });               // carpet to the paintings
  box([-hx - 1, 0, z1], [hx + 1, h, z1 + 1], stone);                                  // painting wall
  box([-hx - 1, 0, z0 - 1], [hx + 1, h, z0], stone);                                  // entrance wall
  box([-hx - 1, 0, z0], [-hx, h, z1], stone);                                         // side walls
  box([hx, 0, z0], [hx + 1, h, z1], stone);
  box([-hx - 1, h, z0 - 1], [hx + 1, h + 1, z1 + 1], trim);                           // ceiling
  // skirting
  for (const [a, b] of [[[-hx, 0, z1 - 0.3], [hx, 0.6, z1]], [[-hx, 0, z0], [hx, 0.6, z0 + 0.3]], [[-hx, 0, z0], [-hx + 0.3, 0.6, z1]], [[hx - 0.3, 0, z0], [hx, 0.6, z1]]]) box(a, b, trim);
  // pillars
  for (const x of [-9, 9]) for (const z of [-10, 6]) {
    box([x - 0.9, 0, z - 0.9], [x + 0.9, h, z + 0.9], stone);
    box([x - 1.2, 0, z - 1.2], [x + 1.2, 0.7, z + 1.2], trim);
    box([x - 1.2, h - 0.7, z - 1.2], [x + 1.2, h, z + 1.2], trim);
  }
  // the entrance door (decoration)
  box([-2.4, 0, z0], [2.4, 5.5, z0 + 0.15], world.mat(null, { color: 0x6a4024 }));
  // a raised step in front of the paintings
  box([-hx, 0, z1 - 4], [hx, 0.3, z1 - 0.3], world.mat(tiles, { uvScale: 3 }));

  // Warm lights
  const lamp = new THREE.PointLight(0xffd9a0, 40, 40, 1.6);
  lamp.position.set(0, h - 2, 0);
  scene.add(lamp);
  for (const x of [-hx + 1.2, hx - 1.2]) for (const z of [-12, 4]) {
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd070 }));
    torch.position.set(x, 6, z);
    scene.add(torch);
    const l = new THREE.PointLight(0xffb060, 8, 14, 1.8);
    l.position.copy(torch.position);
    scene.add(l);
  }

  // --- Paintings -------------------------------------------------------------------
  const portals = [];
  const painting = (x, title, to) => {
    const { w, h: ph, y } = PAINTING;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, ph), new THREE.MeshBasicMaterial({ map: paintingTexture(title, !to) }));
    pic.position.set(x, y + ph / 2, WALL_Z - 0.06);
    pic.rotation.y = Math.PI;
    scene.add(pic);
    const f = 0.35;
    for (const [x0, y0, x1, y1] of [[x - w / 2 - f, y - f, x + w / 2 + f, y], [x - w / 2 - f, y + ph, x + w / 2 + f, y + ph + f], [x - w / 2 - f, y, x - w / 2, y + ph], [x + w / 2, y, x + w / 2 + f, y + ph]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.3), gold);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z - 0.15);
      scene.add(m);
    }
    if (to) portals.push({ min: [x - w / 2, y - 0.5, WALL_Z - 0.6], max: [x + w / 2, y + ph, WALL_Z + 1], to });
  };
  painting(PAINTING.x, 'SUNNY SPIRE HILL', 'sunny');
  painting(-PAINTING.x, 'COMING SOON', null);

  return {
    spawn: new THREE.Vector3(0, 0.03, z0 + 4), spawnYaw: 0,
    // coming back out of the painting after a course
    returnSpawn: new THREE.Vector3(PAINTING.x, 0.3, WALL_Z - 2.5), returnYaw: Math.PI,
    portals,
  };
}
