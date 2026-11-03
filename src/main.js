import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=4';
import { World } from './world.js?v=4';
import { Player, buildCharacter } from './player.js?v=4';
import { FX } from './fx.js?v=4';
import { Coins } from './coins.js?v=4';

// Bump VERSION (and the ?v= on the imports above) whenever files change,
// so browsers never mix old and new code.
const VERSION = '4';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const world = new World(scene, VERSION);
const fx = new FX(scene);
const input = new Input(canvas);

// --- Coins -------------------------------------------------------------------
const texLoader = new THREE.TextureLoader();
const coins = new Coins(scene, texLoader.load(`assets/coin.webp?v=${VERSION}`), fx);
const coinCount = document.getElementById('coin-count');
coins.onCollect = (n) => {
  coinCount.textContent = n;
  coinCount.parentElement.classList.remove('bump'); void coinCount.offsetWidth; coinCount.parentElement.classList.add('bump');
};
{
  // around spawn
  coins.ring(0, 0.9, 5, 2, 8);
  // up the stairs
  for (let i = 0; i < 6; i++) coins.add(-5.4 - i * 1.2, 0.25 * (i + 1) + 0.9, 9.5);
  // on the platforms
  coins.ring(8.5, 3.5, 10.5, 1.5, 6);
  coins.line([14, 5.1, 10], [16, 5.1, 10], 3);
  // up the wall-kick chimney, and on the ledge at the top
  coins.line([-17.25, 2.5, 0], [-17.25, 12.5, 0], 6);
  coins.line([-25, 14.9, 0], [-21, 14.9, 0], 3);
  // floating stepping stones
  for (const [x, y, z] of [[0, 3, -12], [4, 4.5, -15], [8, 6, -17], [12, 7.5, -16], [15, 9, -12]]) coins.add(x, y + 0.9, z);
  // tower top
  coins.ring(20, 9.9, -6, 1, 4);
  // arc over the runway gap
  coins.add(0, 3.2, 20); coins.add(1.75, 3.6, 20); coins.add(3.5, 3.2, 20);
}
document.getElementById('coin-total').textContent = coins.total;

// --- HUD -------------------------------------------------------------------
const debug = document.getElementById('debug');
const help = document.getElementById('help');
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') help.classList.toggle('hidden');
  if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); debug.classList.toggle('hidden'); }
});

const start = document.getElementById('start');
function begin() {
  start.classList.add('hidden');
  coins.unlockAudio();
  input.requestLock();
}
start.addEventListener('click', begin);
canvas.addEventListener('click', () => { if (!input.pointerLocked && start.classList.contains('hidden')) input.requestLock(); });

// --- Lakitu-style camera ----------------------------------------------------
const cam = {
  yaw: Math.PI, pitch: 0.32, dist: 9, targetDist: 9,
  focus: new THREE.Vector3(0, 1.2, 0), idle: 0,
};
const ray = new THREE.Raycaster();

function updateCamera(dt, player) {
  const c = input.consumeCam();
  cam.yaw -= c.x;
  cam.pitch = Math.max(-0.25, Math.min(1.25, cam.pitch + c.y));
  cam.targetDist = Math.max(4, Math.min(18, cam.targetDist + c.zoom * 1.2));
  if (Math.abs(c.x) + Math.abs(c.y) > 1e-4) cam.idle = 0; else cam.idle += dt;

  // Gently swing behind the player while running, after the stick has been left alone.
  if (cam.idle > 1.2 && player.grounded && player.fwd > 4 && player.state === 'ground') {
    const behind = player.yaw + Math.PI;
    const d = Math.atan2(Math.sin(behind - cam.yaw), Math.cos(behind - cam.yaw));
    cam.yaw += d * Math.min(1, dt * 0.9) * (player.fwd / 9);
  }

  // Follow x/z tightly; follow height lazily mid-air so jumps don't bob the view.
  const p = player.pos;
  const k = 1 - Math.exp(-10 * dt);
  cam.focus.x += (p.x - cam.focus.x) * k;
  cam.focus.z += (p.z - cam.focus.z) * k;
  const ty = p.y + 1.2;
  const dy = ty - cam.focus.y;
  const onGround = player.grounded || player.state === 'ledgehang' || player.state === 'wallcling';
  const ky = onGround || dy < -2.5 || dy > 3.5 ? 1 - Math.exp(-6 * dt) : 1 - Math.exp(-1.2 * dt);
  cam.focus.y += dy * ky;

  cam.dist += (cam.targetDist - cam.dist) * (1 - Math.exp(-6 * dt));
  const off = new THREE.Vector3(
    Math.sin(cam.yaw) * Math.cos(cam.pitch),
    Math.sin(cam.pitch),
    Math.cos(cam.yaw) * Math.cos(cam.pitch),
  );
  // Don't let walls get between camera and player.
  ray.set(cam.focus, off);
  ray.far = cam.dist;
  const hit = ray.intersectObjects(world.meshes, false)[0];
  const dist = hit ? Math.max(1.2, hit.distance - 0.3) : cam.dist;
  camera.position.copy(cam.focus).addScaledVector(off, dist);
  if (camera.position.y < 0.3) camera.position.y = 0.3;

  // Shake
  const tr = fx.trauma * fx.trauma;
  const t = performance.now() / 1000;
  camera.position.x += Math.sin(t * 53) * tr * 0.35;
  camera.position.y += Math.sin(t * 61 + 1) * tr * 0.35;
  camera.lookAt(cam.focus);
}

// --- Load the character and go ----------------------------------------------
let player = null;
const skin = texLoader.load(`assets/character.jpg?v=${VERSION}`);
skin.colorSpace = THREE.SRGBColorSpace;
skin.wrapS = skin.wrapT = THREE.RepeatWrapping;
skin.repeat.set(3, 3);
skin.anisotropy = 8;
new GLTFLoader().load(`assets/stickman.glb?v=${VERSION}`, (gltf) => {
  const ch = buildCharacter(gltf.scene, skin);
  player = new Player(world, ch, fx);
  window.__player = player; // handy for debugging in the console
  window.__game = { renderer, scene, camera, cam, updateCamera, fx, input, coins };
  document.body.classList.add('loaded');
}, undefined, (err) => {
  console.error(err);
  const why = (err && (err.message || err.target?.status && `HTTP ${err.target.status}`)) || String(err);
  document.getElementById('loading').textContent = `Could not load the character model (${why}). Try a hard refresh: Ctrl+Shift+R.`;
});

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  input.update(dt);
  if (player) {
    player.update(dt, input, cam.yaw);
    updateCamera(dt, player);
    // keep the sun's shadow box centred on the player
    world.sun.position.set(player.pos.x + 30, player.pos.y + 50, player.pos.z + 20);
    world.sun.target.position.copy(player.pos);
    if (!debug.classList.contains('hidden')) {
      debug.textContent = `state ${player.state}\nspeed ${player.fwd.toFixed(2)}\nvy ${player.vy.toFixed(2)}\npos ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(1)}`;
    }
  }
  if (player) coins.update(dt, player.pos);
  fx.update(dt);
  renderer.render(scene, camera);
}
frame();
