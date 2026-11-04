import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=14';
import { World } from './world.js?v=14';
import { Player, buildCharacter } from './player.js?v=14';
import { FX } from './fx.js?v=14';
import { Coins } from './coins.js?v=14';
import { Star } from './star.js?v=14';
import { GameAudio } from './audio.js?v=14';
import { CherryBomb, KingCherryBomb } from './enemies.js?v=14';
import * as hub from './stages/hub.js?v=14';
import * as sunny from './stages/sunny-spire-hill.js?v=14';

// Bump VERSION (and the ?v= on every local import) whenever files change,
// so browsers never mix old and new code.
const VERSION = '14';
const STAGES = { hub, sunny };

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
const coinTex = texLoader.load(`assets/coin.webp?v=${VERSION}`);

// --- Saved stars --------------------------------------------------------------
const stars = new Set();
try { for (const s of JSON.parse(localStorage.getItem('ste47-stars') || '[]')) stars.add(s); } catch (_) { /* no storage */ }
const saveStars = () => { try { localStorage.setItem('ste47-stars', JSON.stringify([...stars])); } catch (_) { /* ignore */ } };

// --- HUD ------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const debug = $('debug'), help = $('help'), fade = $('fade'), healthEl = $('health');
const bump = (el) => { el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump'); };
let healthShownUntil = 0;
function showHealth(h) {
  const col = h >= 7 ? '#3cc8ff' : h >= 5 ? '#4fd84a' : h >= 3 ? '#ffd23f' : '#ff4a3a';
  healthEl.style.setProperty('--fill', `${(h / 8) * 100}%`);
  healthEl.style.setProperty('--col', col);
  healthEl.querySelector('span').textContent = h;
  healthShownUntil = performance.now() + 3500;
}
function updateStarHud() {
  $('star-count').textContent = stars.size;
  // stars for the current course, e.g. "3 / 7" on the course card
  const el = $('card-stars');
  if (!el) return;
  const total = S && S.mod.STARS;
  if (!total) { el.textContent = ''; return; }
  const got = [...stars].filter((s) => s.startsWith(`${S.key}:`)).length;
  el.textContent = `★ ${got} / ${total}`;
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') help.classList.toggle('hidden');
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'F3' || e.code === 'Backquote') { e.preventDefault(); debug.classList.toggle('hidden'); }
});

// --- Camera (SM64 Lakitu-style) -------------------------------------------------
// The camera hangs back on a "leash": it keeps its place and turns to look at
// the player, so it trails behind as you run and swings round when you run
// sideways. Q/E (C-left/right) turn it 45°, R/F or the wheel step between
// three zoom levels. The mouse can still turn it freely.
const ZOOMS = [{ dist: 6, pitch: 0.24 }, { dist: 9.5, pitch: 0.33 }, { dist: 14, pitch: 0.45 }];
const cam = {
  yaw: Math.PI, pitch: 0.33, dist: 9.5, zoom: 1, turn: 0, pitchAdj: 0,
  focus: new THREE.Vector3(0, 1.2, 0), pos: new THREE.Vector3(), close: 0,   // close: star-get zoom (0..1)
};

function resetCamera(player) {
  cam.yaw = player.yaw + Math.PI; cam.turn = 0; cam.zoom = 1; cam.close = 0; cam.pitchAdj = 0;
  cam.dist = ZOOMS[1].dist; cam.pitch = ZOOMS[1].pitch;
  cam.focus.copy(player.pos).add(new THREE.Vector3(0, 1.2, 0));
  cam.pos.set(cam.focus.x + Math.sin(cam.yaw) * cam.dist, cam.focus.y, cam.focus.z + Math.cos(cam.yaw) * cam.dist);
}

function updateCamera(dt, player) {
  const c = input.consumeCam();
  const p = player.pos;
  if (!player.locked) {
    cam.turn += c.step * (Math.PI / 4);
    cam.zoom = Math.max(0, Math.min(2, cam.zoom + Math.sign(c.zoom)));
    cam.yaw -= c.x;
    cam.pitchAdj = Math.max(-0.3, Math.min(0.6, cam.pitchAdj + c.y));
  }
  // Leash: aim from where the camera already is, so it drags along behind.
  const lx = cam.pos.x - p.x, lz = cam.pos.z - p.z;
  if (lx * lx + lz * lz > 0.25 && !player.locked) cam.yaw = Math.atan2(lx, lz);
  // C-button turns ease in
  const tStep = cam.turn * Math.min(1, dt * 9);
  cam.yaw += tStep; cam.turn -= tStep;

  // Follow x/z tightly; follow height lazily mid-air so jumps don't bob the view.
  const k = 1 - Math.exp(-12 * dt);
  cam.focus.x += (p.x - cam.focus.x) * k;
  cam.focus.z += (p.z - cam.focus.z) * k;
  const fy = p.y + 1.2 - cam.close * 0.2;
  const dy = fy - cam.focus.y;
  const onGround = player.grounded || player.state === 'ledgehang' || player.state === 'wallcling';
  const ky = onGround || dy < -2.5 || dy > 3.5 ? 1 - Math.exp(-6 * dt) : 1 - Math.exp(-1.2 * dt);
  cam.focus.y += dy * ky;

  const z = ZOOMS[cam.zoom];
  const kz = 1 - Math.exp(-5 * dt);
  cam.dist += (z.dist * (1 - cam.close * 0.72) - cam.dist) * kz;
  cam.pitch += (z.pitch + cam.pitchAdj - cam.close * 0.2 - cam.pitch) * kz;
  const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  const w = S.world;
  const hitD = w.rayDistance(cam.focus, off, cam.dist);
  const dist = hitD < cam.dist ? Math.max(1.2, hitD - 0.3) : cam.dist;
  camera.position.copy(cam.focus).addScaledVector(off, dist);
  if (w.terrain) camera.position.y = Math.max(camera.position.y, w.terrain.height(camera.position.x, camera.position.z) + 0.4);
  // remember the unshaken position for next frame's leash
  cam.pos.set(cam.focus.x + Math.sin(cam.yaw) * cam.dist, camera.position.y, cam.focus.z + Math.cos(cam.yaw) * cam.dist);
  const tr = S.fx.trauma * S.fx.trauma, t = performance.now() / 1000;
  camera.position.x += Math.sin(t * 53) * tr * 0.35;
  camera.position.y += Math.sin(t * 61 + 1) * tr * 0.35;
  camera.lookAt(cam.focus);
}

// --- Stages ----------------------------------------------------------------------
let player = null, character = null, bombModel = null, starModel = null;
let S = null;   // the running stage

function loadStage(key, { from } = {}) {
  const mod = STAGES[key];
  const scene = new THREE.Scene();
  const world = new World(scene, VERSION);
  world.low = LOW;
  const fx = new FX(scene);
  const coins = new Coins(scene, coinTex, fx);
  coins.sound = () => audio.play('coin');
  // Coin count for the course (red coins are worth 2). 100 makes a star appear.
  const addCoins = (v) => {
    S.coinCount += v;
    $('coin-count').textContent = S.coinCount; bump($('coin-count'));
    player.heal(v);
    if (S.coinCount >= 100 && mod.STARS) spawnStar(2, player.pos.clone().add(new THREE.Vector3(0, 3.2, 0)), { drop: true });
  };
  coins.onCollect = () => addCoins(1);
  const reds = new Coins(scene, coinTex, fx, { tint: 0xff3a2a });
  reds.sound = () => audio.play('coin', 0.7, 1 + reds.count * 0.12);
  reds.onCollect = (n) => {
    addCoins(2);
    $('red-count').textContent = n; document.body.classList.add('has-reds'); bump($('red-count'));
    if (n === reds.total && S.level.redStar) spawnStar(3, S.level.redStar, { drop: true });
  };
  const level = mod.build(world, coins, reds);

  if (!player) {
    player = new Player(world, character, fx);
    player.onHurt = showHealth;
    player.sfx = (n) => audio.voice(n);
    player.onDeath = () => setTimeout(() => go(S.key), 1200);
  } else {
    player.world = world; player.fx = fx;
    scene.add(player.root, player.blob);
  }
  const back = from === 'clear' && level.returnSpawn;
  player.spawn.copy(back ? level.returnSpawn : level.spawn);
  player.spawnYaw = back ? level.returnYaw : level.spawnYaw;
  player.reset();
  player.yaw = player.spawnYaw;

  const ctx = { world, fx, coins, player, bombModel, sfx: (n) => audio.play(n, 0.5) };
  const enemies = (level.bombs || []).map(([x, z]) => new CherryBomb(ctx, x, z));
  let boss = null;
  player.tryGrab = null; player.onThrow = null;
  if (level.boss) {
    boss = new KingCherryBomb(ctx, level.boss);
    boss.onStart = () => { audio.music('boss.mp3'); showHealth(player.health); };
    player.tryGrab = () => boss.tryGrab();
    player.onThrow = () => { if (boss.state === 'held') boss.onThrown(); };
    boss.onDefeat = (p) => { audio.music(mod.MUSIC); spawnStar(1, p.clone().add(new THREE.Vector3(0, 1.4, 0)), { drop: true }); };
  }

  S = { key, mod, scene, world, fx, coins, reds, enemies, boss, level, stars: [], held: null, coinCount: 0, portals: level.portals || [], busy: false, clear: false };
  for (const d of level.stars || []) spawnStar(d.n, d.pos, { sound: false });

  resetCamera(player);
  $('coin-count').textContent = '0';
  $('coin-total').textContent = coins.total;
  document.body.classList.toggle('no-coins', coins.total === 0);
  document.querySelectorAll('.course-name').forEach((el) => { el.textContent = mod.NAME; });
  $('red-count').textContent = '0'; $('red-total').textContent = reds.total;
  document.body.classList.remove('has-reds');
  updateStarHud();
  const card = $('course-card');
  card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  showHealth(player.health);
  audio.music(mod.MUSIC);
  window.__game = { renderer, scene, camera, cam, updateCamera, fx, input, coins, audio, S, go, loadStage };
  window.__player = player;
}

// Put star n of this course in the level (once). Stars you already have are ghosts.
function spawnStar(n, pos, { drop = false, sound = true } = {}) {
  if (S.stars.some((s) => s.n === n)) return;
  const st = new Star(S.scene, starModel, pos, S.fx, { drop, ghost: stars.has(`${S.key}:${n}`) });
  st.n = n;
  st.onGet = () => onStarGet(st);
  S.stars.push(st);
  if (sound) audio.play('star-appears', 0.7);
}

// Star get: cut any sound effects (e.g. the long star-appears chime), then the
// course clear song and "here we go" start together. The pose lasts as long as
// the song; then the camera closes in and the screen irises out to the hub.
function onStarGet(st) {
  S.clear = true;
  S.held = st;
  stars.add(`${S.key}:${st.n}`); saveStars(); updateStarHud(); bump($('star-count'));
  audio.stopSfx();
  player.starGet();
  audio.jingle('course-clear.mp3', () => {
    S.closeStart = performance.now();
    setTimeout(() => go('hub', { from: 'clear', iris: true }), 1000);
  });
}

// Switch stage behind a fade (or an SM64-style iris).
function go(key, opts = {}) {
  if (S && S.busy) return;
  if (S) S.busy = true;
  const cover = opts.iris ? $('iris') : fade;
  cover.classList.add('on');
  setTimeout(() => { loadStage(key, opts); setTimeout(() => cover.classList.remove('on'), 120); }, opts.iris ? 800 : 450);
}

// --- Start screen ------------------------------------------------------------------
const start = $('start');
start.addEventListener('click', () => {
  start.classList.add('hidden');
  audio.unlock();
  const card = $('course-card');
  card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  input.requestLock();
});
canvas.addEventListener('click', () => { if (!input.pointerLocked && start.classList.contains('hidden')) input.requestLock(); });

// --- Load assets, then start in the hub ----------------------------------------------
const wood = texLoader.load(`assets/wood.jpg?v=${VERSION}`);
wood.colorSpace = THREE.SRGBColorSpace;
const eye = texLoader.load(`assets/eye.png?v=${VERSION}`);
const gltfLoader = new GLTFLoader();
const loadGLB = (url) => new Promise((res, rej) => gltfLoader.load(`assets/${url}?v=${VERSION}`, res, undefined, rej));
Promise.all([loadGLB('character.glb'), loadGLB('cone.glb'), loadGLB('cherry-bomb.glb'), loadGLB('star.glb')]).then(([ch, cone, bomb, star]) => {
  character = buildCharacter(ch.scene, { wood, eye, cone: cone.scene });
  bomb.scene.traverse((o) => { if (o.isLight) o.visible = false; });
  bombModel = bomb.scene;
  starModel = star.scene;
  const first = new URLSearchParams(location.search).get('stage');
  loadStage(STAGES[first] ? first : 'hub');
  document.body.classList.add('loaded');
}).catch((err) => {
  console.error(err);
  const why = (err && (err.message || err.target?.status && `HTTP ${err.target.status}`)) || String(err);
  $('loading').textContent = `Could not load the game (${why}). Try a hard refresh: Ctrl+Shift+R.`;
});

// --- Main loop ------------------------------------------------------------------------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
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
    if (S.clear && S.held) S.held.hold(tmp.copy(player.pos).add(new THREE.Vector3(Math.cos(player.yaw) * 0.45, 2.75, -Math.sin(player.yaw) * 0.45)), dt);
    cam.close = S.closeStart ? Math.min(1, (performance.now() - S.closeStart) / 900) : 0;
    updateCamera(dt, player);
    S.coins.update(dt, player.pos);
    if (!S.clear) for (const st of S.stars) st.update(dt, player.pos);
    S.reds.update(dt, player.pos);
    if (S.level.update && !S.clear) S.level.update(dt, { player, fx: S.fx, spawnStar });
    if (!S.clear) {
      for (const e of S.enemies) e.update(dt);
      if (S.boss) S.boss.update(dt);
    }
    // Paintings / exits
    if (!S.busy) {
      for (const p of S.portals) {
        const q = player.pos;
        if (q.x > p.min[0] && q.x < p.max[0] && q.y + 0.8 > p.min[1] && q.y < p.max[1] && q.z > p.min[2] && q.z < p.max[2]) { audio.voice('yahoo'); go(p.to); break; }
      }
    }
    healthEl.classList.toggle('show', performance.now() < healthShownUntil || player.health < 8 || (S.boss && S.boss.state !== 'sleep' && S.boss.state !== 'gone'));
    if (!debug.classList.contains('hidden')) {
      debug.textContent = `state ${player.state}\nspeed ${player.fwd.toFixed(2)}\nvy ${player.vy.toFixed(2)}\npos ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(1)}\nhealth ${player.health}`;
    }
    S.fx.update(dt);
    if (!window.__noRender) renderer.render(S.scene, camera);
  }
}
window.__step = step;
frame();
