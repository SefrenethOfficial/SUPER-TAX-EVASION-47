import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Input } from './input.js?v=54';
import { World } from './world.js?v=54';
import { Player, buildCharacter } from './player.js?v=54';
import { FX } from './fx.js?v=54';
import { GameAudio } from './audio.js?v=54';
import { Dialogue } from './dialogue.js?v=54';
import { Combat } from './combat.js?v=54';
import { BASE_MOVES, weaponMesh } from './items.js?v=54';
import { save } from './save.js?v=54';
import { Inventory, QUICK } from './inventory.js?v=54';
// The open world, one area per module.
import * as blank from './stages/blank.js?v=54';
import * as beach from './stages/beach.js?v=54';

// Bump VERSION (and the ?v= on every local import) whenever files change,
// so browsers never mix old and new code.
const VERSION = '54';
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
const debug = $('debug'), help = $('help'), fade = $('fade');
// Health and Stamina bars, bottom left, with your party and quick items under them
const hud = $('hud'), hpBar = hud.querySelector('.hp i'), spBar = hud.querySelector('.sp i'), spWrap = hud.querySelector('.sp'), hudRow = $('hudrow');
let hudText = '';
function showHealth(h) { hpBar.style.width = `${(Math.max(0, h) / 8) * 100}%`; }
function updateHud() {
  showHealth(player.health);
  spBar.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
  const party = game.partyInfo().map((f) => `<span>with <b>${f.name}</b></span>`);
  const quick = Object.entries(QUICK).filter(([id]) => save.items[id]).map(([id, k]) => `<span>${k} <b>${({ herb: 'Herb', salve: 'Salve', tonic: 'Tonic', ember: 'Ember' })[id]}</b> x${save.items[id]}</span>`);
  const text = [...party, ...quick].join('');
  if (text !== hudText) { hudText = text; hudRow.innerHTML = text; }
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') help.classList.toggle('hidden');
  if ((e.code === 'KeyI' || e.code === 'Tab') && player && S && !dialogue.active) { e.preventDefault(); bag.toggle(); }
  // quick items: 1 Herb, 2 Salve, 3 Tonic, 4 throw an Ember Flask
  const n = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Numpad1: 1, Numpad2: 2, Numpad3: 3, Numpad4: 4 }[e.code];
  if (n && player && S && !dialogue.active && !bag.open && !player.locked && player.health > 0) {
    const id = Object.keys(QUICK).find((k) => QUICK[k] === n);
    S.combat.quickUse(id, player);
  }
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
  // a little scene playing: the area says where the camera is and what it looks at
  if (S.cutscene) {
    input.consumeCam();
    const shot = S.cutscene(dt);
    const k = S.cutAt ? 1 - Math.exp(-3.5 * dt) : 1;
    camera.position.lerp(shot.pos, k);
    S.cutLook = S.cutAt ? S.cutLook.lerp(shot.look, k) : shot.look.clone();
    S.cutAt = true;
    camera.lookAt(S.cutLook);
    return;
  }
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

function loadStage(key, { from, respawn } = {}) {
  const mod = STAGES[key];
  const scene = new THREE.Scene();
  const world = new World(scene, VERSION);
  world.low = LOW;
  const fx = new FX(scene);
  if (S && S.combat) S.combat.clear();
  const combat = new Combat({ scene, camera, fx, hud: { floaters: $('floaters'), bossBar: $('bossbar') } });
  combat.onTired = () => { spWrap.classList.remove('tired'); void spWrap.offsetWidth; spWrap.classList.add('tired'); };
  const level = mod.build(world, { models: stageModels[key] || {}, combat });

  if (!player) {
    player = new Player(world, character, fx);
    player.onHurt = showHealth;
    player.sfx = (n) => audio.voice(n);
    player.sfxStop = (n) => audio.stopVoice(n);
    // knocked down for good: YOU FELL, and you come round where you last rested
    // ...and you come round in the same part of the world you fell in
    player.onDeath = () => {
      banner('YOU FELL', 'died');
      const at = S.level.respawnFor ? S.level.respawnFor(player.pos) : null;
      // the area may have more to show first (your party being cut down)
      const more = S.level.onPlayerDeath ? S.level.onPlayerDeath(game) : null;
      Promise.all([new Promise((r) => setTimeout(r, 3200)), more]).then(() => go(S.key, { respawn: at }));
    };
    player.canGuard = () => save.learned.includes('guard');
    player.canEvade = () => save.learned.includes('miststep');
    player.onEvade = () => S.combat.float(player.pos.clone().setY(player.pos.y + 2.3), 'Evaded', 'note');
    player.onGuard = (n) => S.combat.float(player.pos.clone().setY(player.pos.y + 2.3), `Guarded (${n})`, 'note');
  } else {
    player.world = world; player.fx = fx;
    scene.add(player.root, player.blob);
  }
  // arriving from another area: use that area's entrance if there is one
  const entry = from && level.entrances && level.entrances[from];
  player.spawn.copy(respawn ? respawn.pos : entry ? entry.pos : level.spawn);
  player.spawnYaw = respawn ? respawn.yaw : entry ? entry.yaw : level.spawnYaw;
  player.reset();
  player.yaw = player.spawnYaw;
  if (respawn || (level.startLying && !entry)) player.setState('washed');   // come round on the ground
  if (respawn) player.invuln = 4;          // a moment's grace to get up before anything can hit you

  player.tryGrab = null; player.onThrow = null;
  S = { key, mod, scene, world, fx, level, combat, portals: level.portals || [], busy: false, talkWith: null, areaMusic: mod.MUSIC, playing: undefined, fightMusic: 0 };

  resetCamera(player);
  document.querySelectorAll('.course-name').forEach((el) => { el.textContent = mod.NAME; });
  const card = $('course-card');
  card.classList.remove('show'); void card.offsetWidth; if (S.mod.NAME) card.classList.add('show');
  showHealth(player.health);
  playMusic(mod.MUSIC);
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
  baseMoves: BASE_MOVES,
});

const game = {
  banner, toast, bag,
  // fade out, do something (move you somewhere), fade back in
  fade(fn) { fade.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => fade.classList.remove('on'), 150); }, 420); },
  // members of your party besides you, for the bag's party list (the area fills this in)
  partyInfo: () => [],
  // change the music for the part of the area you're in (null = quiet)
  music(file) { S.areaMusic = file; },
  // take over the camera for a little scene: fn(dt) -> { pos, look }; null hands it back
  cutscene(fn) { S.cutscene = fn; S.cutAt = false; document.body.classList.toggle('cutscene', !!fn); if (!fn) resetCamera(player); },
  // show an area title card
  card(name) {
    document.querySelectorAll('.course-name').forEach((el) => { el.textContent = name; });
    const card = $('course-card'); card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  },
  // knocked out: come round at the area's start again
  respawn() { setTimeout(() => go(S.key), 300); },
  get player() { return player; }, get fx() { return S.fx; }, get combat() { return S.combat; }, input, talk, get talking() { return dialogue.active; } };

const promptEl = $('prompt');
// Music: the area's own, or the enemy song while monsters are after you
// (a boss brings its own: the area switches to it).
const BATTLE_MUSIC = 'battle.mp3';
function playMusic(file) { if (S && S.playing === file) return; if (S) S.playing = file; audio.music(file); }
function updateMusic(dt) {
  const fighting = S.combat.foes.some((f) => f.alive && f.engaged && !f.boss && !f.noAllies);
  S.inFight = S.combat.foes.some((f) => f.alive && f.engaged);      // any fight at all, a boss's included
  S.fightMusic = fighting ? 4 : Math.max(0, S.fightMusic - dt);     // keeps going a few seconds after
  const boss = S.combat.foes.some((f) => f.boss && f.alive);
  playMusic(S.fightMusic > 0 && !boss ? BATTLE_MUSIC : S.areaMusic);
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
  audio.buffer('boss.mp3');
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
    if (bag.wasOpen && !bag.open && !dialogue.active) player.locked = false;
    bag.wasOpen = bag.open;
    // things to do with E: talk to someone, pick something up
    const free = !S.busy && !dialogue.active && !fade.classList.contains('on') && player.grounded && player.state === 'ground' && player.health > 0;
    // (not mid-fight, though: then B is always an attack, even with your party right beside you)
    const act = free && S.fightMusic <= 0 && !S.inFight ? S.level.interact && S.level.interact(game) : null;
    if (act && input.usingGamepad) act.text = act.text.replace(/^E \u2014 /, 'Y \u2014 ');   // the gamepad button for it
    promptEl.textContent = act ? act.text : '';
    promptEl.classList.toggle('on', !!act);
    if (act && input.pressed.E) { promptEl.classList.remove('on'); input.pressed.E = false; act.go(); }
    player.update(dt, input, cam.yaw);
    // when nothing's after you, Health slowly comes back
    if (player.health > 0 && player.health < 8 && !dialogue.active && S.fightMusic <= 0 && !S.inFight) {
      S.regen = (S.regen || 0) + dt;
      if (S.regen > 6) { S.regen = 0; player.health++; }
    }
    updateCamera(dt, player);
    aimWeapon();
    if (S.level.update) S.level.update(dt, game);
    S.combat.update(dt, player);
    updateMusic(dt);
    updateHud();
    // exits to other areas
    if (!S.busy) {
      for (const p of S.portals) {
        const q = player.pos;
        if (q.x > p.min[0] && q.x < p.max[0] && q.y + 0.8 > p.min[1] && q.y < p.max[1] && q.z > p.min[2] && q.z < p.max[2]) { go(p.to, { from: S.key }); break; }
      }
    }
    if (!debug.classList.contains('hidden')) {
      debug.textContent = `state ${player.state}\nspeed ${player.fwd.toFixed(2)}\nvy ${player.vy.toFixed(2)}\npos ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(1)}\nhealth ${player.health}`;
    }
    S.fx.update(dt);
    if (!window.__noRender) renderer.render(S.scene, camera);
  }
}
window.__step = step;
frame();
