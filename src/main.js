import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=26';
import { World } from './world.js?v=26';
import { Player, buildCharacter } from './player.js?v=26';
import { FX } from './fx.js?v=26';
import { GameAudio } from './audio.js?v=26';
// The open world, one area per module.
import * as blank from './stages/blank.js?v=26';
import * as beach from './stages/beach.js?v=26';

// Bump VERSION (and the ?v= on every local import) whenever files change,
// so browsers never mix old and new code.
const VERSION = '26';
const STAGES = { beach, blank };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
// Add ?low to the URL for weaker computers: renders at 1x pixel density.
const LOW = new URLSearchParams(location.search).has('low');
if (LOW) renderer.setPixelRatio(1);
renderer.shadowMap.enabled = false;   // blob shadows only, like SM64
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 600);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const input = new Input(canvas);
const audio = new GameAudio(VERSION);
const texLoader = new THREE.TextureLoader();

// --- HUD ------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const debug = $('debug'), help = $('help'), fade = $('fade'), healthEl = $('health');
let healthShownUntil = 0;
function showHealth(h) {
  const col = h >= 7 ? '#3cc8ff' : h >= 5 ? '#4fd84a' : h >= 3 ? '#ffd23f' : '#ff4a3a';
  healthEl.style.setProperty('--fill', `${(h / 8) * 100}%`);
  healthEl.style.setProperty('--col', col);
  healthEl.querySelector('span').textContent = h;
  healthShownUntil = performance.now() + 3500;
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') help.classList.toggle('hidden');
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); debug.classList.toggle('hidden'); }
});

// --- Camera (Lakitu-style) -------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.32, dist: 9, targetDist: 9, focus: new THREE.Vector3(0, 1.2, 0), idle: 0 };

function resetCamera(player) {
  cam.yaw = player.yaw + Math.PI; cam.pitch = 0.32; cam.dist = cam.targetDist = 9; cam.idle = 0;
  cam.focus.copy(player.pos).add(new THREE.Vector3(0, 1.2, 0));
}

function updateCamera(dt, player) {
  const c = input.consumeCam();
  if (!player.locked) {
    cam.yaw -= c.x;
    cam.pitch = Math.max(-0.25, Math.min(1.25, cam.pitch + c.y));
    cam.targetDist = Math.max(4, Math.min(18, cam.targetDist + c.zoom * 1.2));
  }
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
  const dy = p.y + 1.2 - cam.focus.y;
  const onGround = player.grounded || player.state === 'ledgehang' || player.state === 'wallcling';
  const ky = onGround || dy < -2.5 || dy > 3.5 ? 1 - Math.exp(-6 * dt) : 1 - Math.exp(-1.2 * dt);
  cam.focus.y += dy * ky;
  cam.dist += (cam.targetDist - cam.dist) * (1 - Math.exp(-6 * dt));
  const pitch = cam.pitch;
  const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
  const w = S.world;
  const hitD = w.rayDistance(cam.focus, off, cam.dist);
  const dist = hitD < cam.dist ? Math.max(1.2, hitD - 0.3) : cam.dist;
  camera.position.copy(cam.focus).addScaledVector(off, dist);
  if (w.terrain) camera.position.y = Math.max(camera.position.y, w.terrain.height(camera.position.x, camera.position.z) + 0.4);
  const tr = S.fx.trauma * S.fx.trauma, t = performance.now() / 1000;
  camera.position.x += Math.sin(t * 53) * tr * 0.35;
  camera.position.y += Math.sin(t * 61 + 1) * tr * 0.35;
  camera.lookAt(cam.focus);
}

// --- Stages ----------------------------------------------------------------------
let player = null, character = null;
let S = null;   // the running stage

function loadStage(key, { from } = {}) {
  const mod = STAGES[key];
  const scene = new THREE.Scene();
  const world = new World(scene, VERSION);
  world.low = LOW;
  const fx = new FX(scene);
  const level = mod.build(world);

  if (!player) {
    player = new Player(world, character, fx);
    player.onHurt = showHealth;
    player.sfx = (n) => audio.voice(n);
    player.sfxStop = (n) => audio.stopVoice(n);
    player.onDeath = () => setTimeout(() => go(S.key), 1200);
  } else {
    player.world = world; player.fx = fx;
    scene.add(player.root, player.blob);
  }
  // arriving from another area: use that area's entrance if there is one
  const entry = from && level.entrances && level.entrances[from];
  player.spawn.copy(entry ? entry.pos : level.spawn);
  player.spawnYaw = entry ? entry.yaw : level.spawnYaw;
  player.reset();
  player.yaw = player.spawnYaw;
  if (level.startLying && !entry) player.setState('washed');   // wake up on the ground

  player.tryGrab = null; player.onThrow = null;
  S = { key, mod, scene, world, fx, level, portals: level.portals || [], busy: false };

  resetCamera(player);
  document.querySelectorAll('.course-name').forEach((el) => { el.textContent = mod.NAME; });
  const card = $('course-card');
  card.classList.remove('show'); void card.offsetWidth; if (S.mod.NAME) card.classList.add('show');
  showHealth(player.health);
  audio.music(mod.MUSIC);
  window.__game = { renderer, scene, camera, cam, updateCamera, fx, input, audio, S, go, loadStage };
  window.__player = player;
}

// Switch area behind a fade.
function go(key, opts = {}) {
  if (S && S.busy) return;
  if (S) S.busy = true;
  fade.classList.add('on');
  setTimeout(() => { loadStage(key, opts); setTimeout(() => fade.classList.remove('on'), 120); }, 450);
}

// --- Start screen ------------------------------------------------------------------
const start = $('start');
start.addEventListener('click', () => {
  start.classList.add('hidden');
  audio.unlock();
  // decode area music now so it starts straight away
  for (const m of Object.values(STAGES)) if (m.MUSIC) audio.buffer(m.MUSIC);
  const card = $('course-card');
  card.classList.remove('show'); void card.offsetWidth; if (S.mod.NAME) card.classList.add('show');
  input.requestLock();
});
canvas.addEventListener('click', () => { if (!input.pointerLocked && start.classList.contains('hidden')) input.requestLock(); });

// --- Load assets, then start ----------------------------------------------
const wood = texLoader.load(`assets/wood.jpg?v=${VERSION}`);
wood.colorSpace = THREE.SRGBColorSpace;
const eye = texLoader.load(`assets/eye.png?v=${VERSION}`);
const gltfLoader = new GLTFLoader();
const loadGLB = (url) => new Promise((res, rej) => gltfLoader.load(`assets/${url}?v=${VERSION}`, res, undefined, rej));
Promise.all([loadGLB('character.glb'), loadGLB('cone.glb')]).then(([ch, cone]) => {
  character = buildCharacter(ch.scene, { wood, eye, cone: cone.scene });
  const first = new URLSearchParams(location.search).get('stage');
  loadStage(STAGES[first] ? first : 'beach');
  document.body.classList.add('loaded');
}).catch((err) => {
  console.error(err);
  const why = (err && (err.message || err.target?.status && `HTTP ${err.target.status}`)) || String(err);
  $('loading').textContent = `Could not load the game (${why}). Try a hard refresh: Ctrl+Shift+R.`;
});

// --- Main loop ------------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  if (window.__pause) return;   // lets tests step the game by hand
  const dt = Math.min(clock.getDelta(), 1 / 20);
  step(dt);
}
function step(dt) {
  input.update(dt);
  if (player && S) {
    player.update(dt, input, cam.yaw);
    updateCamera(dt, player);
    if (S.level.update) S.level.update(dt, { player, fx: S.fx });
    // exits to other areas
    if (!S.busy) {
      for (const p of S.portals) {
        const q = player.pos;
        if (q.x > p.min[0] && q.x < p.max[0] && q.y + 0.8 > p.min[1] && q.y < p.max[1] && q.z > p.min[2] && q.z < p.max[2]) { go(p.to, { from: S.key }); break; }
      }
    }
    healthEl.classList.toggle('show', performance.now() < healthShownUntil || player.health < 8);
    if (!debug.classList.contains('hidden')) {
      debug.textContent = `state ${player.state}\nspeed ${player.fwd.toFixed(2)}\nvy ${player.vy.toFixed(2)}\npos ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(1)}\nhealth ${player.health}`;
    }
    S.fx.update(dt);
    if (!window.__noRender) renderer.render(S.scene, camera);
  }
}
window.__step = step;
frame();
