import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=42';
import { World } from './world.js?v=42';
import { Player, buildCharacter } from './player.js?v=42';
import { FX } from './fx.js?v=42';
import { GameAudio } from './audio.js?v=42';
import { Battle } from './battle.js?v=42';
import { Dialogue } from './dialogue.js?v=42';
import { MOVES } from './battle.js?v=42';
import { LEARNABLE, WEAPONS, weaponMesh } from './items.js?v=42';
import { save } from './save.js?v=42';
import { Inventory } from './inventory.js?v=42';
// The open world, one area per module.
import * as blank from './stages/blank.js?v=42';
import * as beach from './stages/beach.js?v=42';

// Bump VERSION (and the ?v= on every local import) whenever files change,
// so browsers never mix old and new code.
const VERSION = '42';
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
  if ((e.code === 'KeyI' || e.code === 'Tab') && player && S && !S.battle && !dialogue.active) { e.preventDefault(); bag.toggle(); }
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
  // in a conversation, swing round over your shoulder so you can see who you're talking to
  if (S.talkWith) {
    const want = Math.atan2(S.talkWith.x - player.pos.x, S.talkWith.z - player.pos.z) + Math.PI + 0.95;
    cam.yaw += Math.atan2(Math.sin(want - cam.yaw), Math.cos(want - cam.yaw)) * Math.min(1, dt * 3);
    cam.pitch += (0.2 - cam.pitch) * Math.min(1, dt * 3);
  }
  // ...and frame both of you
  const p = S.talkWith ? player.pos.clone().lerp(S.talkWith, 0.5) : player.pos;
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
  const level = mod.build(world, { models: stageModels[key] || {} });

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
  S = { key, mod, scene, world, fx, level, portals: level.portals || [], battleZones: level.battleZones || [], battle: null, busy: false, talkWith: null };

  resetCamera(player);
  document.querySelectorAll('.course-name').forEach((el) => { el.textContent = mod.NAME; });
  const card = $('course-card');
  card.classList.remove('show'); void card.offsetWidth; if (S.mod.NAME) card.classList.add('show');
  showHealth(player.health);
  audio.music(mod.MUSIC);
  window.__game = { renderer, scene, camera, cam, updateCamera, fx, input, audio, S, go, loadStage, bag, game };
  window.__player = player;
}

// --- Conversations ---------------------------------------------------------------------
const dialogue = new Dialogue($('dialogue'), input);
// talk(lines, { with: Vector3 }) -> Promise of the last choice. You stand still while talking.
function talk(lines, { with: other = null } = {}) {
  player.locked = true;
  player.fwd = 0;
  S.talkWith = other;
  if (other) player.yaw = Math.atan2(other.x - player.pos.x, other.z - player.pos.z);   // turn to face them
  document.body.classList.add('talking');
  return dialogue.say(lines).then((pick) => {
    player.locked = false;
    S.talkWith = null;
    document.body.classList.remove('talking');
    return pick;
  });
}
// Your moves: the basics, plus any you've been taught.
function playerMoves() {
  return [...MOVES.slice(0, 3), ...save.learned.map((id) => LEARNABLE[id]).filter(Boolean), MOVES[3]];
}

// The weapon in your hand.
let heldWeapon = null;
function showWeapon(id) {
  if (!character || !character.hand) return;
  if (heldWeapon) { heldWeapon.parent.remove(heldWeapon); heldWeapon = null; }
  if (!id || id === 'fists') return;
  const w = weaponMesh(id);
  const hand = character.hand;
  hand.updateWorldMatrix(true, false);
  const s = new THREE.Vector3(); hand.getWorldScale(s);
  const holder = new THREE.Group();
  holder.position.set(0, 1.05, 0);            // at the end of the forearm (bone units)
  holder.scale.setScalar(1 / s.x);            // back to metres
  holder.add(w);
  hand.add(holder);
  heldWeapon = holder;
}

// Each frame: keep the weapon pointing forward and a little up from your hand,
// whatever the arm is doing.
const _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _ew = new THREE.Euler();
function aimWeapon() {
  if (!heldWeapon || !player) return;
  const state = player.state;
  const swing = state === 'punch1' || state === 'punch2' || state === 'kick' ? 0.9 : 0;
  _qw.setFromEuler(_ew.set(Math.PI / 2 - 0.95 + swing, player.yaw, 0, "YXZ"));
  heldWeapon.parent.getWorldQuaternion(_qp);
  heldWeapon.quaternion.copy(_qp.invert().multiply(_qw));
}

// Big banners (a boss's name, its defeat, yours) and small notices (picked something up).
const bannerEl = $('banner'), toastEl = $('toast');
function banner(text, kind = '') {
  bannerEl.className = kind;
  bannerEl.textContent = text;
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
  clearTimeout(banner.t);
  banner.t = setTimeout(() => bannerEl.classList.remove('show'), 3600);
}
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toastline';
  el.textContent = text;
  toastEl.append(el);
  setTimeout(() => el.remove(), 3200);
}

const bag = new Inventory($('bag'), input, {
  player: () => player,
  getParty: () => [{ name: 'You', hp: player.health, maxHp: 8 }, ...game.partyInfo()],
  onEquip: (id) => showWeapon(id),
  baseMoves: MOVES,
});

const game = {
  banner, toast, bag,
  // fade out, do something (move you somewhere), fade back in
  fade(fn) { fade.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => fade.classList.remove('on'), 150); }, 420); },
  // members of your party besides you, for the bag's party list (the area fills this in)
  partyInfo: () => [],
  // change the music for the part of the area you're in (null = quiet)
  music(file) { if (S.areaMusic === file) return; S.areaMusic = file; if (!S.battle) audio.music(file); },
  // show an area title card
  card(name) {
    document.querySelectorAll('.course-name').forEach((el) => { el.textContent = name; });
    const card = $('course-card'); card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  },
  // knocked out: come round at the area's start again
  respawn() { setTimeout(() => go(S.key), 300); },
  get player() { return player; }, get fx() { return S.fx; }, input, talk, fight: (zone) => { player.locked = true; return startBattle(zone); }, get talking() { return dialogue.active; }, get battling() { return !!S.battle; } };

// --- Battles -------------------------------------------------------------------------
const promptEl = $('prompt');
const BATTLE_MUSIC = 'battle.mp3';   // the enemy song
// zone: { spots: { player, enemy }, enemy: { name, maxHp, maxSp, atk, ... } }
// Resolves with { won, lost } (both false if you ran) once you're back exploring.
function startBattle(zone) {
  const sp = zone.spots;
  fade.classList.add('on');
  audio.music(zone.enemy.music || BATTLE_MUSIC);
  const done = new Promise((res) => { S.battleDone = res; });
  setTimeout(() => {
    // stand the player on their mark, facing the enemy
    player.pos.copy(sp.player);
    player.fwd = 0; player.vy = 0;
    player.setState('ground');
    player.yaw = Math.atan2(sp.enemy.x - sp.player.x, sp.enemy.z - sp.player.z);
    player.locked = true;
    player.update(1 / 60, input, cam.yaw);
    const E = zone.enemy;
    const party = [{ name: 'You', hp: player.health, maxHp: 8, sp: player.stamina, maxSp: player.maxStamina, pos: sp.player.clone(), actor: player,
      moves: playerMoves(), atkBonus: WEAPONS[save.equipped] ? WEAPONS[save.equipped].atk : 0,
      picture: { height: 1.7, dist: 2.0, yaw: player.yaw } }];
    // anyone travelling with you stands behind you and off to the side
    const ax = sp.enemy.x - sp.player.x, az = sp.enemy.z - sp.player.z, al = Math.hypot(ax, az) || 1;
    (zone.allies || []).forEach((A, i) => {
      const k = i + 1, x = sp.player.x - (ax / al) * 1.7 * k + (az / al) * 1.9 * k, z = sp.player.z - (az / al) * 1.7 * k - (ax / al) * 1.9 * k;
      const y = S.world.floorBelow(x, z, sp.player.y + 6);
      const pos = new THREE.Vector3(x, Number.isFinite(y) ? y : sp.player.y, z);
      A.node.position.set(pos.x, pos.y + (A.lift || 0), pos.z);
      A.node.rotation.set(0, player.yaw, 0);
      party.push({ ...A, hp: A.hp ?? A.maxHp, sp: A.sp ?? A.maxSp, pos, picture: { ...A.picture, yaw: player.yaw } });
    });
    const enemy = { ...E, hp: E.maxHp, sp: E.maxSp, pos: sp.enemy, picture: E.picture };
    document.exitPointerLock?.();
    document.body.classList.add('in-battle');
    S.battle = new Battle({ ui: $('battle'), input, camera, fx: S.fx, party, enemy, onEnd: endBattle });
    S.battle.onDamage = (f) => { if (f.actor) player.health = f.hp; };
    fade.classList.remove('on');
  }, 400);
  return done;
}
function endBattle(result = {}) {
  const { lost } = result;
  fade.classList.add('on');
  audio.music(S.areaMusic !== undefined ? S.areaMusic : S.mod.MUSIC);   // back to the area's music (or quiet)
  setTimeout(() => {
    S.battle = null;
    player.locked = false;
    player.stamina = player.maxStamina;          // catch your breath after a fight
    if (lost) player.health = 8;                  // (for now) knocked out just means you come round
    player.invuln = 0;
    player.setState('ground');
    document.body.classList.remove('in-battle');
    resetCamera(player);
    fade.classList.remove('on');
    const d = S.battleDone; S.battleDone = null;
    if (d) setTimeout(() => d(result), 250);
  }, 400);
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
  audio.buffer(BATTLE_MUSIC);
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
// Some models use the old spec-gloss material extension three.js no longer
// reads; give those meshes a plain material with their diffuse texture.
async function loadModel(url) {
  const g = await loadGLB(url);
  const json = g.parser.json, jobs = [];
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const a = g.parser.associations.get(o.material);
    const md = a && json.materials && json.materials[a.materials];
    const sg = md && md.extensions && md.extensions.KHR_materials_pbrSpecularGlossiness;
    if (sg && sg.diffuseTexture) {
      jobs.push(g.parser.getDependency('texture', sg.diffuseTexture.index).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        o.material = new THREE.MeshLambertMaterial({ map: t, side: md.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
      }));
    }
  });
  await Promise.all(jobs);
  return g;
}
// models each area asks for (export MODELS = { name: 'file.glb' })
const stageModels = {};
const stageLoads = Object.entries(STAGES).flatMap(([k, m]) => Object.entries(m.MODELS || {}).map(([name, file]) =>
  loadModel(file).then((g) => { (stageModels[k] ||= {})[name] = g.scene; })));
Promise.all([loadGLB('character.glb'), loadGLB('cone.glb'), ...stageLoads]).then(([ch, cone]) => {
  character = buildCharacter(ch.scene, { wood, eye, cone: cone.scene });
  setTimeout(() => showWeapon(save.equipped), 0);
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
    dialogue.update(dt);
    bag.update(dt);
    player.locked = player.locked || bag.open;
    if (bag.wasOpen && !bag.open && !dialogue.active && !S.battle) player.locked = false;
    bag.wasOpen = bag.open;
    if (S.battle) {
      player.update(dt, input, cam.yaw);     // locked: just idles
      S.battle.update(dt);
      if (S.level.update) S.level.update(dt, game);
      S.fx.update(dt);
      if (!window.__noRender) { renderer.render(S.scene, camera); S.battle.renderPictures(renderer, S.scene); }
      return;
    }
    // things to do with B (instead of punching): talk to someone, start a battle
    const free = !S.busy && !dialogue.active && !fade.classList.contains('on') && player.grounded && player.state === 'ground';
    const zone = free ? S.battleZones.find((z) => Math.hypot(player.pos.x - z.x, player.pos.z - z.z) < z.r) : null;
    const act = free ? (S.level.interact && S.level.interact(game)) || (zone && { text: 'B — Start a test battle', go: () => { player.locked = true; startBattle(zone); } }) : null;
    promptEl.textContent = act ? act.text : '';
    promptEl.classList.toggle('on', !!act);
    if (act && input.pressed.B) { promptEl.classList.remove('on'); input.pressed.B = false; act.go(); }
    player.update(dt, input, cam.yaw);
    // out of battle, Health slowly comes back
    if (player.health > 0 && player.health < 8 && !dialogue.active) {
      S.regen = (S.regen || 0) + dt;
      if (S.regen > 6) { S.regen = 0; player.health++; }
    }
    updateCamera(dt, player);
    aimWeapon();
    if (S.level.update) S.level.update(dt, game);
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
