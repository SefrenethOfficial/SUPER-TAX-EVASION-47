import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=9';
import { World } from './world.js?v=9';
import { Player, buildCharacter } from './player.js?v=9';
import { FX } from './fx.js?v=9';
import { Coins } from './coins.js?v=9';
import { Star } from './star.js?v=9';
import { GameAudio } from './audio.js?v=9';
import * as stage from './stages/sunny-spire-hill.js?v=9';

// Bump VERSION (and the ?v= on the imports above) whenever files change,
// so browsers never mix old and new code.
const VERSION = '9';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
// Add ?low to the URL for weaker computers: renders at 1x pixel density.
const LOW = new URLSearchParams(location.search).has('low');
renderer.shadowMap.enabled = false;   // blob shadows only, like SM64
if (LOW) renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Plain colour output (no film tone mapping), for the N64 look.

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const world = new World(scene, VERSION);
world.low = LOW;
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
const level = stage.build(world, coins);
const audio = new GameAudio(VERSION, stage.MUSIC);
coins.sound = () => audio.play('coin');
const star = new Star(scene, level.star, fx);
const starCount = document.getElementById('star-count');
star.onGet = () => {
  audio.play('coin', 0.8);
  setTimeout(() => audio.play('coin', 0.8), 120);
  setTimeout(() => audio.play('coin', 0.8), 240);
  starCount.textContent = '1';
  starCount.parentElement.classList.remove('bump'); void starCount.offsetWidth; starCount.parentElement.classList.add('bump');
};
document.querySelectorAll('.course-name').forEach((el) => { el.textContent = stage.NAME; });
document.getElementById('coin-total').textContent = coins.total;

// --- HUD -------------------------------------------------------------------
const debug = document.getElementById('debug');
const help = document.getElementById('help');
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') help.classList.toggle('hidden');
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); debug.classList.toggle('hidden'); }
});

const start = document.getElementById('start');
function begin() {
  start.classList.add('hidden');
  coins.unlockAudio();
  audio.unlock();
  const card = document.getElementById('course-card');
  card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  input.requestLock();
}
start.addEventListener('click', begin);
canvas.addEventListener('click', () => { if (!input.pointerLocked && start.classList.contains('hidden')) input.requestLock(); });

// --- Lakitu-style camera ----------------------------------------------------
const cam = {
  yaw: Math.PI, pitch: 0.32, dist: 9, targetDist: 9,
  focus: level.spawn.clone().add(new THREE.Vector3(0, 1.2, 0)), idle: 0,
};

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
  const hitD = world.rayDistance(cam.focus, off, cam.dist);
  const dist = hitD < cam.dist ? Math.max(1.2, hitD - 0.3) : cam.dist;
  camera.position.copy(cam.focus).addScaledVector(off, dist);
  if (world.terrain) camera.position.y = Math.max(camera.position.y, world.terrain.height(camera.position.x, camera.position.z) + 0.4);

  // Shake
  const tr = fx.trauma * fx.trauma;
  const t = performance.now() / 1000;
  camera.position.x += Math.sin(t * 53) * tr * 0.35;
  camera.position.y += Math.sin(t * 61 + 1) * tr * 0.35;
  camera.lookAt(cam.focus);
}

// --- Load the character and go ----------------------------------------------
let player = null;
const wood = texLoader.load(`assets/wood.jpg?v=${VERSION}`);
wood.colorSpace = THREE.SRGBColorSpace;
wood.anisotropy = 8;
const eye = texLoader.load(`assets/eye.png?v=${VERSION}`);
const gltfLoader = new GLTFLoader();
const loadGLB = (url) => new Promise((res, rej) => gltfLoader.load(url, res, undefined, rej));
Promise.all([loadGLB(`assets/character.glb?v=${VERSION}`), loadGLB(`assets/cone.glb?v=${VERSION}`)]).then(([gltf, coneGltf]) => {
  const ch = buildCharacter(gltf.scene, { wood, eye, cone: coneGltf.scene });
  player = new Player(world, ch, fx);
  player.spawn.copy(level.spawn);
  player.reset();
  player.spawnYaw = level.spawnYaw;
  player.yaw = level.spawnYaw;
  window.__player = player; // handy for debugging in the console
  window.__game = { renderer, scene, camera, cam, updateCamera, fx, input, coins, star, audio };
  document.body.classList.add('loaded');
}).catch((err) => {
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
  if (player) { coins.update(dt, player.pos); star.update(dt, player.pos); }
  fx.update(dt);
  renderer.render(scene, camera);
}
frame();
