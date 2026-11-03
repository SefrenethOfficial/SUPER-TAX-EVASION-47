import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Player, buildCharacter } from './player.js';
import { FX } from './fx.js';

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

const world = new World(scene);
const fx = new FX(scene);
const input = new Input(canvas);

// --- HUD -------------------------------------------------------------------
const popup = document.getElementById('popup');
const debug = document.getElementById('debug');
let popupTimer = 0;
function showMove(name) {
  popup.textContent = name;
  popup.classList.remove('pop'); void popup.offsetWidth; popup.classList.add('pop');
  popupTimer = 1.1;
}
const help = document.getElementById('help');
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') help.classList.toggle('hidden');
  if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); debug.classList.toggle('hidden'); }
});

const start = document.getElementById('start');
function begin() {
  start.classList.add('hidden');
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
new GLTFLoader().load('assets/player.glb', (gltf) => {
  const ch = buildCharacter(gltf.scene);
  player = new Player(world, ch, fx);
  player.onMove = showMove;
  window.__player = player; // handy for debugging in the console
  window.__game = { renderer, scene, camera, cam, updateCamera, fx, input };
  document.body.classList.add('loaded');
}, undefined, (err) => {
  console.error(err);
  document.getElementById('loading').textContent = 'Could not load the character model.';
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
  fx.update(dt);
  if (popupTimer > 0) { popupTimer -= dt; if (popupTimer <= 0) popup.classList.remove('pop'); }
  renderer.render(scene, camera);
}
frame();
