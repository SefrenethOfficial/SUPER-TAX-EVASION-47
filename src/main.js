import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=19';
import { World } from './world.js?v=19';
import { Player, buildCharacter } from './player.js?v=19';
import { FX } from './fx.js?v=19';
import { Coins } from './coins.js?v=19';
import { Star } from './star.js?v=19';
import { GameAudio } from './audio.js?v=19';
import { CherryBomb, KingCherryBomb } from './enemies.js?v=19';
import { Cannon } from './cannon.js?v=19';
import * as hub from './stages/hub.js?v=19';
import * as sunny from './stages/sunny-spire-hill.js?v=19';

// Bump VERSION (and the ?v= on every local import) whenever files change,
// so browsers never mix old and new code.
const VERSION = '19';
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

// --- Camera (Lakitu-style) -------------------------------------------------------
const cam = { yaw: Math.PI, pitch: 0.32, dist: 9, targetDist: 9, focus: new THREE.Vector3(0, 1.2, 0), idle: 0, close: 0 };   // close: star-get zoom (0..1)

function resetCamera(player) {
  cam.yaw = player.yaw + Math.PI; cam.pitch = 0.32; cam.dist = cam.targetDist = 9; cam.idle = 0; cam.close = 0;
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
  // Swing in behind a cannon shot
  if (player.state === 'cannonfly') {
    const behind = player.yaw + Math.PI;
    cam.yaw += Math.atan2(Math.sin(behind - cam.yaw), Math.cos(behind - cam.yaw)) * Math.min(1, dt * 4);
  }
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
  cam.dist += (cam.targetDist * (1 - cam.close * 0.72) - cam.dist) * (1 - Math.exp(-6 * dt));
  const pitch = cam.pitch - cam.close * 0.15;
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
let player = null, character = null, bombModel = null, starModel = null;
const models = {};   // stage key -> level model (gltf scene)
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
  const level = mod.build(world, coins, reds, { model: models[key] });

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

  const cannons = (level.cannons || []).map((c) => new Cannon(scene, c));
  S = { key, mod, scene, world, fx, coins, reds, enemies, boss, level, cannons, inCannon: null, stars: [], held: null, coinCount: 0, portals: level.portals || [], busy: false, clear: false };
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
  // decode the course music now so it starts the moment you enter the painting
  for (const m of Object.values(STAGES)) if (m.MUSIC) audio.buffer(m.MUSIC);
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
const stageModels = Object.entries(STAGES).filter(([, m]) => m.MODEL);
Promise.all([loadGLB('character.glb'), loadGLB('cone.glb'), loadGLB('cherry-bomb.glb'), loadGLB('star.glb'), ...stageModels.map(([, m]) => loadGLB(m.MODEL))]).then(([ch, cone, bomb, star, ...levels]) => {
  stageModels.forEach(([k], i) => { models[k] = levels[i].scene; });
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
    // Cannons: climb in by standing in the hole, aim, A fires, B climbs out
    for (const c of S.cannons) c.update(dt);
    if (S.inCannon) {
      const c = S.inCannon, look = input.consumeCam();
      c.aim(dt, input.move, look);
      if (input.pressed.A) { c.fire(player, S.fx); S.inCannon = null; cam.yaw = player.yaw + Math.PI; cam.pitch = 0.25; }
      else if (input.pressed.B) { c.exit(player); S.inCannon = null; }
      else c.camera(camera);
    } else if (!S.clear) {
      for (const c of S.cannons) {
        // after climbing out you have to leave the hole before you can get back in
        if (c.left && Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.z) > 3.4) c.left = false;
        if (!c.left && c.cool <= 0 && player.grounded && player.state === 'ground' && c.near(player)) { c.enter(player); S.inCannon = c; break; }
      }
    }
    document.body.classList.toggle('aiming', !!S.inCannon);
    if (!S.inCannon) updateCamera(dt, player);
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
