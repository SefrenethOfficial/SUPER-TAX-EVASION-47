import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Tunables. Units are metres and seconds. The player is ~1.7 m tall.
// ---------------------------------------------------------------------------
const R = 0.35;            // collision radius
const H = 1.6;             // collision height
const G = 38;              // gravity
const MAX_FALL = 45;
const RUN = 9;             // top running speed
const STEP_UP = 0.3;       // walkable step height
const SNAP_DOWN = 0.4;     // stick to ground over small drops
const SUB_DT = 1 / 120;    // physics sub-step

const JUMP_V = { jump: 12, double: 15, triple: 19.5, backflip: 20, sideflip: 18, longjump: 10, wallkick: 15.5, rollout: 10.5 };

const AIR = new Set(['jump', 'double', 'triple', 'backflip', 'sideflip', 'longjump', 'wallkick', 'fall', 'hurt', 'starjump',
  'gp_spin', 'gp_fall', 'dive', 'jumpkick', 'rollout', 'bonk', 'slidekick', 'wallcling']);
const WALL_KICKABLE = new Set(['jump', 'double', 'triple', 'sideflip', 'longjump', 'wallkick', 'fall', 'rollout', 'backflip', 'jumpkick']);
const LEDGE_OK = new Set(['jump', 'double', 'triple', 'sideflip', 'backflip', 'wallkick', 'fall', 'rollout', 'jumpkick']);


const NO_INPUT = { move: { x: 0, y: 0 }, buttons: { A: false, B: false, Z: false }, pressed: { A: false, B: false, Z: false } };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// ---------------------------------------------------------------------------
// Character model: the rigged block-head character. Its body keeps the
// model's own material; the head gets wood, an eye for a face and a traffic
// cone for a hat. The skeleton is driven procedurally: rotations are authored
// in the character's root space (faces +Z, Y up) and converted into each
// bone's local space against its rest pose.
// ---------------------------------------------------------------------------
const BONES = {
  armL: 'top_arm_bone001_Armature', elbowL: 'lower_arm_bone001_Armature',
  armR: 'top_arm_bone_Armature', elbowR: 'lower_arm_bone_Armature',
  legL: 'lap001_Armature', kneeL: 'lower_leg_bone001_Armature',
  legR: 'lap_Armature', kneeR: 'lower_leg_bone_Armature',
  head: 'head_Armature',
};
const ARM_DOWN = 1.15;             // rotate the T-pose arms down to the sides

// Split the head triangles off into their own material with box-projected UVs.
function woodenHead(mesh, headBone, woodTex) {
  const headIdx = mesh.skeleton.bones.indexOf(headBone);
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const n = pos.count;
  const M = mesh.matrixWorld;
  const P = new Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) P[i] = v.fromBufferAttribute(pos, i).applyMatrix4(M).clone();

  const headW = (i) => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === headIdx) w += sw.getComponent(i, k);
    return w;
  };
  const body = [], head = [];
  const box = new THREE.Box3();
  for (let t = 0; t < n; t += 3) {
    const w = (headW(t) + headW(t + 1) + headW(t + 2)) / 3;
    if (w > 0.5) { head.push(t, t + 1, t + 2); box.expandByPoint(P[t]).expandByPoint(P[t + 1]).expandByPoint(P[t + 2]); }
    else body.push(t, t + 1, t + 2);
  }
  // Planar UVs per face, picked by the face's dominant axis.
  const uv = new Float32Array(n * 2);
  const size = box.getSize(new THREE.Vector3());
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let k = 0; k < head.length; k += 3) {
    const a = P[head[k]], b = P[head[k + 1]], c = P[head[k + 2]];
    nn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    for (let j = 0; j < 3; j++) {
      const p = P[head[k + j]], i = head[k + j];
      let u, w;
      if (ay >= ax && ay >= az) { u = (p.x - box.min.x) / size.x; w = (p.z - box.min.z) / size.z; }
      else if (ax >= az) { u = (p.z - box.min.z) / size.z; w = (p.y - box.min.y) / size.y; }
      else { u = (p.x - box.min.x) / size.x; w = (p.y - box.min.y) / size.y; }
      uv[i * 2] = u; uv[i * 2 + 1] = w;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex([...body, ...head]);
  geo.clearGroups();
  geo.addGroup(0, body.length, 0);
  geo.addGroup(body.length, head.length, 1);
  mesh.geometry = geo;
  const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75, metalness: 0 });
  mesh.material = [mesh.material, wood];
  return box;  // head bounds in model space
}

export function buildCharacter(gltfScene, { wood, eye, cone } = {}) {
  const bones = {};
  let skinned = null;
  gltfScene.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;   // skinned bounds don't follow the pose
      if (o.isSkinnedMesh) skinned = o;
    }
  });
  gltfScene.updateMatrixWorld(true);
  const modelBox = new THREE.Box3().setFromObject(gltfScene, true);
  const headBone = bones[BONES.head];

  if (skinned && headBone && wood) {
    const hb = woodenHead(skinned, headBone, wood);
    const hs = hb.getSize(new THREE.Vector3());
    // Eye on the front face
    if (eye) {
      eye.colorSpace = THREE.SRGBColorSpace;
      const ew = hs.x * 0.95;
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(ew, ew), new THREE.MeshStandardMaterial({ map: eye, transparent: true, alphaTest: 0.3, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
      decal.position.set((hb.min.x + hb.max.x) / 2, hb.min.y + hs.y * 0.52, hb.max.z + 0.01);
      gltfScene.add(decal);
      headBone.attach(decal);
    }
    // Traffic cone hat
    if (cone) {
      const cb = new THREE.Box3().setFromObject(cone);
      const cs = cb.getSize(new THREE.Vector3());
      const k = (hs.x * 0.78) / cs.x;
      const hat = new THREE.Group();
      cone.position.set(-(cb.min.x + cb.max.x) / 2, -cb.min.y, -(cb.min.z + cb.max.z) / 2);
      hat.add(cone);
      hat.scale.setScalar(k);
      hat.position.set((hb.min.x + hb.max.x) / 2, hb.max.y - hs.y * 0.04, (hb.min.z + hb.max.z) / 2);
      hat.rotation.z = -0.08;
      hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      gltfScene.add(hat);
      headBone.attach(hat);
    }
  }

  // Rest data for each driven bone: local rest rotation and its parent's
  // rest rotation in model space.
  const rig = {};
  const tmp = new THREE.Quaternion();
  const rootInv = gltfScene.getWorldQuaternion(new THREE.Quaternion()).invert();
  for (const [key, name] of Object.entries(BONES)) {
    const b = bones[name];
    if (!b) continue;
    const parentQ = rootInv.clone().multiply(b.parent.getWorldQuaternion(tmp));
    rig[key] = { bone: b, rest: b.quaternion.clone(), P: parentQ, Pinv: parentQ.clone().invert() };
  }

  const height = modelBox.max.y - modelBox.min.y;
  const scale = 1.7 / height;
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.scale.setScalar(scale);
  holder.position.y = -modelBox.min.y * scale - 0.85;   // feet at y=0 relative to the 0.85 pivot
  holder.add(gltfScene);
  root.add(holder);

  const q = new THREE.Quaternion();
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  // Apply a model-space rotation to a bone, relative to its rest pose.
  const apply = (key, qModel) => {
    const r = rig[key];
    if (!r) return;
    r.bone.quaternion.copy(r.Pinv).multiply(qModel).multiply(r.P).multiply(r.rest);
  };
  const state = {};
  const smooth = (k, v, dt) => (state[k] = damp(state[k] ?? v, v, 26, dt));

  // p: armL/armR (forward swing, rad), armSpread, legL/legR (forward swing),
  //    legSpread, kneeL/kneeR, elbowL/elbowR
  function pose(p, dt) {
    const v = {};
    for (const k of ['armL', 'armR', 'legL', 'legR', 'armSpread', 'legSpread', 'kneeL', 'kneeR', 'elbowL', 'elbowR']) v[k] = smooth(k, p[k] || 0, dt);
    // Arms: the "L" arm points down -X in T-pose, "R" arm down +X.
    apply('armL', qa.setFromAxisAngle(X, -v.armL).multiply(qb.setFromAxisAngle(Z, ARM_DOWN - v.armSpread)));
    apply('armR', qa.setFromAxisAngle(X, -v.armR).multiply(qb.setFromAxisAngle(Z, -(ARM_DOWN - v.armSpread))));
    apply('elbowL', q.setFromAxisAngle(Y, v.elbowL));
    apply('elbowR', q.setFromAxisAngle(Y, -v.elbowR));
    apply('legL', qa.setFromAxisAngle(X, -v.legL).multiply(qb.setFromAxisAngle(Z, -v.legSpread * 0.5)));
    apply('legR', qa.setFromAxisAngle(X, -v.legR).multiply(qb.setFromAxisAngle(Z, v.legSpread * 0.5)));
    apply('kneeL', q.setFromAxisAngle(X, v.kneeL));
    apply('kneeR', q.setFromAxisAngle(X, v.kneeR));
  }
  pose({}, 1);
  return { root, pose };
}

// ---------------------------------------------------------------------------
// Player controller
// ---------------------------------------------------------------------------
export class Player {
  constructor(world, character, fx) {
    this.world = world;
    this.fx = fx;

    // Visual hierarchy: root(pos, yaw) > squash(scale) > pivot(y .85) > spin(rot) > character
    this.root = new THREE.Group();
    this.squashG = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.85;
    this.spin = new THREE.Group();
    this.root.add(this.squashG); this.squashG.add(this.pivot); this.pivot.add(this.spin);
    this.spin.add(character.root);
    this.character = character;
    world.scene.add(this.root);

    // Blob shadow (classic platformer depth cue)
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.renderOrder = 2;
    world.scene.add(sh);
    this.blob = sh;

    this.spawn = new THREE.Vector3(0, 0, 0);
    this.reset();
  }

  reset() {
    this.pos = this.spawn.clone();
    this.vy = 0; this.fwd = 0; this.yaw = 0;
    this.state = 'ground'; this.t = 0;
    this.grounded = true;
    this.combo = 0; this.comboTimer = 0;
    this.jumpBuffer = 0; this.coyote = 0; this.landLock = 0;
    this.airMax = RUN; this.airControl = 1;
    this.kicked = false; this.queued = false;
    this.clingCooldown = 0; this.ledgeCooldown = 0;
    this.wallN = new THREE.Vector2();
    this.anim = { pitch: 0, roll: 0, yaw: 0, bob: 0, phase: 0, sq: 0, sqv: 0, lean: 0, limbs: 0, armUp: 0 };
    this.lastFloor = 0;
    this.inDir = new THREE.Vector2(); this.inMag = 0; this.inYaw = 0;
    this.health = 8; this.invuln = 0; this.locked = false;
    this.root.visible = true;
  }

  // --- health ------------------------------------------------------------------
  // Take damage from something at (fromX, fromZ): knocked back and briefly
  // invulnerable. onHurt / onDeath let the game update the HUD and respawn.
  hurt(amount, fromX, fromZ) {
    if (this.invuln > 0 || this.locked || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = 2;
    this.yaw = Math.atan2(fromX - this.pos.x, fromZ - this.pos.z);   // face the hit
    this.fwd = -7; this.vy = 9; this.airControl = 0; this.airMax = RUN;
    this.setState('hurt');
    this.grounded = false;
    this.fx.shake(0.3);
    if (this.onHurt) this.onHurt(this.health);
    if (this.health <= 0 && this.onDeath) this.onDeath();
    return true;
  }

  heal(n) {
    if (this.health <= 0) return;
    this.health = Math.min(8, this.health + n);
    if (this.onHurt) this.onHurt(this.health);
  }

  // Bounce off an enemy's head.
  bounce(v = 11) {
    this.vy = v; this.airControl = 1; this.airMax = Math.max(RUN, this.fwd);
    this.setState('jump'); this.grounded = false; this.kicked = false;
  }

  // Where the player's current attack hits, or null.
  attackSphere() {
    const s = this.state;
    const reach = { punch1: 0.75, punch2: 0.75, kick: 0.6, jumpkick: 0.7, dive: 0.8, slidekick: 0.6, slide: 0.6, bellyslide: 0.7 }[s];
    if (reach === undefined) return null;
    if ((s === 'punch1' || s === 'punch2') && (this.t < 0.04 || this.t > 0.18)) return null;
    if (s === 'jumpkick' && this.t > 0.3) return null;
    if ((s === 'slide' || s === 'bellyslide') && this.fwd < 3) return null;
    const y = s === 'slide' || s === 'bellyslide' || s === 'slidekick' ? 0.4 : 0.9;
    return { x: this.pos.x + Math.sin(this.yaw) * reach, y: this.pos.y + y, z: this.pos.z + Math.cos(this.yaw) * reach, r: 0.85 };
  }

  // Falling onto something whose top is at `top`, centred at (x, z) with radius r?
  stomping(x, z, top, r) {
    if (this.grounded || this.vy > 0) return false;
    if (Math.hypot(this.pos.x - x, this.pos.z - z) > r + 0.3) return false;
    return this.pos.y > top - 0.6 && this.pos.y < top + 0.4;
  }

  // The star-get celebration: hop, land, turn to the camera, hold the star up.
  starGet() {
    this.locked = true;
    this.fwd = 0; this.vy = 7;
    this.setState('starjump');
    this.grounded = false;
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s; this.t = 0;
    this.grounded = !AIR.has(s) && s !== 'ledgehang' && s !== 'ledgeclimb';
  }

  // --- jumps -----------------------------------------------------------------
  jump(kind) {
    const v = JUMP_V[kind] ?? JUMP_V.jump;
    this.airControl = 1;
    switch (kind) {
      case 'jump': this.vy = v + this.fwd * 0.2; break;
      case 'double': this.vy = v + this.fwd * 0.2; break;
      case 'triple': this.vy = v; break;
      case 'backflip': this.vy = v; this.fwd = -3.2; this.airControl = 0.15; break;
      case 'sideflip': this.vy = v; this.yaw = this.inMag > 0.2 ? this.inYaw : wrap(this.yaw + Math.PI); this.fwd = 4.5; this.airControl = 0.5; break;
      case 'longjump': this.vy = v; this.fwd = Math.min(Math.max(this.fwd, 6) * 1.5, 16.5); this.airControl = 0.4; break;
      case 'wallkick': this.vy = v; this.yaw = Math.atan2(this.wallN.x, this.wallN.y); this.fwd = 7.5; this.airControl = 0.6; break;
      case 'rollout': this.vy = v; this.fwd = Math.max(this.fwd, 3); break;
    }
    this.airMax = Math.max(RUN, this.fwd);
    this.kicked = false;
    this.jumpBuffer = 0; this.coyote = 0;
    this.setState(kind);
    this.grounded = false;
    this.anim.sq = 0.28; this.anim.sqv = 0;      // stretch on take-off
    if (kind !== 'wallkick') this.fx.dust(this.pos, 4);
  }

  groundJump() {
    if (this.landLock > 0) return false;
    if (this.comboTimer > 0 && this.combo === 1) this.jump('double');
    else if (this.comboTimer > 0 && this.combo === 2 && this.fwd > 5) this.jump('triple');
    else this.jump('jump');
    return true;
  }

  // --- landing ---------------------------------------------------------------
  land() {
    const from = this.state;
    const impact = Math.min(1, -this.vy / 25);
    this.vy = 0;
    this.combo = 0; this.comboTimer = 0;
    this.anim.sq = -0.18 - impact * 0.25; this.anim.sqv = 0;
    switch (from) {
      case 'dive': this.setState('bellyslide'); this.fx.dust(this.pos, 8); return;
      case 'slidekick': this.setState('slide'); this.fx.dust(this.pos, 6); return;
      case 'gp_fall':
        this.setState('gp_land'); this.fwd = 0;
        this.fx.ring(this.pos); this.fx.dust(this.pos, 14); this.fx.shake(0.35);
        return;
      case 'bonk': case 'hurt': this.setState('stun'); this.fwd = 0; return;
      case 'starjump': this.setState('starpose'); this.fwd = 0; return;
      case 'jump': this.combo = 1; this.comboTimer = 0.22; break;
      case 'double': this.combo = 2; this.comboTimer = 0.22; break;
      case 'triple': this.landLock = 0.18; this.fwd *= 0.5; this.fx.dust(this.pos, 8); break;
      case 'backflip': this.landLock = 0.22; this.fwd = 0; break;
      case 'sideflip': this.landLock = 0.12; break;
      case 'longjump': this.fwd *= 0.55; this.landLock = 0.1; break;
    }
    this.fx.dust(this.pos, 3 + Math.round(impact * 5));
    this.setState('ground');
  }

  // --- per-frame update ------------------------------------------------------
  update(dt, input, camYaw) {
    this.camYaw = camYaw;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.locked) input = NO_INPUT;
    // Camera-relative stick
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);  // camera forward
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);   // camera right
    const ix = fx * input.move.y + rx * input.move.x;
    const iz = fz * input.move.y + rz * input.move.x;
    this.inMag = Math.min(1, Math.hypot(ix, iz));
    this.inDir.set(ix, iz);
    if (this.inMag > 0.01) this.inYaw = Math.atan2(ix, iz);

    if (input.pressed.A) this.jumpBuffer = 0.12; else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.landLock = Math.max(0, this.landLock - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.clingCooldown = Math.max(0, this.clingCooldown - dt);
    this.ledgeCooldown = Math.max(0, this.ledgeCooldown - dt);
    this.t += dt;

    this.logic(dt, input);
    if (this.state !== 'ledgehang' && this.state !== 'ledgeclimb' && this.state !== 'wallcling' && this.state !== 'gp_spin') {
      let remaining = dt;
      while (remaining > 1e-6) {
        const h = Math.min(SUB_DT, remaining);
        remaining -= h;
        if (this.physics(h, input)) break;
      }
    }
    if (this.pos.y < -40) { const y = this.spawnYaw || 0; this.reset(); this.yaw = y; }
    // blink while invulnerable
    this.root.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0;
    this.animate(dt);
  }

  // State machine: inputs and velocities. Physics (collision) happens after.
  logic(dt, input) {
    const A = this.jumpBuffer > 0, B = input.pressed.B, Zp = input.pressed.Z, Zh = input.buttons.Z;
    const d = wrap(this.inYaw - this.yaw);
    switch (this.state) {
      case 'ground': {
        if (Zh && this.fwd > 5) { this.setState('crouchslide'); break; }
        if (Zh) { this.setState('crouch'); break; }
        if (A && this.groundJump()) break;
        if (B) {
          if (this.fwd >= 7.5) { this.dive(true); break; }
          this.setState('punch1'); this.queued = false; this.fwd = Math.max(this.fwd * 0.5, 2.5); break;
        }
        if (this.inMag > 0.5 && Math.abs(d) > 2.3 && this.fwd > 5.5) { this.setState('skid'); this.fx.dust(this.pos, 4); break; }
        this.groundMove(dt);
        break;
      }
      case 'skid': {
        this.fwd = approach(this.fwd, 0, 30 * dt);
        if (Math.random() < 0.5) this.fx.dust(this.pos, 1);
        if (A) { this.jump('sideflip'); break; }
        if (this.fwd <= 0.01) {
          if (this.inMag > 0.2) this.yaw = this.inYaw;
          this.setState('ground');
        }
        break;
      }
      case 'crouch': {
        if (A && this.landLock <= 0) { this.jump('backflip'); break; }
        if (!Zh) { this.setState('ground'); break; }
        // crawl
        if (this.inMag > 0.2) this.yaw = this.turnToward(this.yaw, this.inYaw, 6 * dt);
        this.fwd = approach(this.fwd, this.inMag * 1.6, 12 * dt);
        if (B && this.fwd > 3) this.slideKick();
        break;
      }
      case 'crouchslide': {
        if (A) { this.jump('longjump'); break; }
        if (B) { this.slideKick(); break; }
        this.fwd = approach(this.fwd, 0, 9 * dt);
        if (this.inMag > 0.2) this.yaw = this.turnToward(this.yaw, this.inYaw, 1.8 * dt);
        if (Math.random() < 0.3) this.fx.dust(this.pos, 1);
        if (this.fwd < 2) this.setState(Zh ? 'crouch' : 'ground');
        else if (!Zh && this.t > 0.25) this.setState('ground');
        break;
      }
      case 'punch1': case 'punch2': case 'kick': {
        const dur = this.state === 'kick' ? 0.38 : 0.22;
        this.fwd = approach(this.fwd, 0, 14 * dt);
        if (B && this.t > 0.06) this.queued = true;
        if (A && this.landLock <= 0) { this.jump('jump'); break; }
        if (this.t >= dur) {
          if (this.queued && this.state !== 'kick') {
            this.queued = false;
            this.setState(this.state === 'punch1' ? 'punch2' : 'kick');
            this.fwd = Math.max(this.fwd, 2);
            if (this.inMag > 0.2) this.yaw = this.inYaw;
          } else this.setState('ground');
        }
        break;
      }
      case 'bellyslide': case 'slide': {
        this.fwd = approach(this.fwd, 0, (this.state === 'slide' ? 8 : 10) * dt);
        if (this.inMag > 0.2) this.yaw = this.turnToward(this.yaw, this.inYaw, 1.5 * dt);
        if ((A || B) && this.t > 0.08) { this.jump('rollout'); break; }
        if (this.fwd < 0.3 && this.t > 0.3) this.setState('ground');
        break;
      }
      case 'gp_land': {
        if (this.t > 0.38) this.setState('ground');
        break;
      }
      case 'starpose': {
        // turn to face the camera
        this.yaw = this.turnToward(this.yaw, this.camYaw ?? this.yaw, 7 * dt);
        break;
      }
      case 'hurt': case 'starjump':
        break;
      case 'stun': {
        if (this.t > 0.6) this.setState('ground');
        break;
      }
      case 'gp_spin': {
        if (this.t >= 0.3) { this.setState('gp_fall'); this.vy = -32; }
        break;
      }
      case 'wallcling': {
        if (A) { this.jump('wallkick'); this.clingCooldown = 0.12; this.fx.dust(this.pos.clone().add(new THREE.Vector3(-this.wallN.x * R, 1, -this.wallN.y * R)), 5); break; }
        if (this.t > 0.2) { this.setState('fall'); this.fwd = -1.2; this.clingCooldown = 0.45; }
        break;
      }
      case 'ledgehang': {
        if (this.t < 0.2) break;
        const into = Math.cos(d) * this.inMag;
        if (A) { this.climbFast = true; this.setState('ledgeclimb'); break; }
        if (Zp || into < -0.5) { this.setState('fall'); this.fwd = -1; this.ledgeCooldown = 0.5; break; }
        if (into > 0.5 || B) { this.climbFast = false; this.setState('ledgeclimb'); break; }
        break;
      }
      case 'ledgeclimb': {
        const k = Math.min(1, this.t / (this.climbFast ? 0.22 : 0.45));
        const s = this.ledgeStart, e = this.ledgeEnd;
        const up = Math.min(1, k / 0.6), fw = Math.max(0, (k - 0.35) / 0.65);
        this.pos.set(lerp(s.x, e.x, fw), lerp(s.y, e.y, up), lerp(s.z, e.z, fw));
        if (k >= 1) {
          this.fwd = 0; this.setState('ground');
          if (this.climbFast) { this.fwd = 2; this.jump('jump'); this.vy = 9; }
        }
        break;
      }
      // --- airborne ---
      case 'fall':
        if (A && this.coyote > 0) { this.jump('jump'); break; }
      // falls through
      case 'jump': case 'double': case 'triple': case 'backflip': case 'sideflip':
      case 'wallkick': case 'rollout': case 'longjump': case 'jumpkick': {
        if (Zp && this.state !== 'longjump') { this.groundPound(); break; }
        if (B && this.state !== 'jumpkick') {
          if (this.fwd > 5 && this.state !== 'backflip') { this.dive(false); break; }
          if (!this.kicked) { this.kicked = true; this.setState('jumpkick'); break; }
        }
        if (this.state === 'jumpkick' && this.t > 0.32) this.setState('fall');
        this.airMove(dt);
        break;
      }
      case 'dive': case 'slidekick': case 'bonk':
        if (this.state === 'dive' && Zp) { this.groundPound(); break; }
        this.airMove(dt, 0.15);
        break;
      case 'gp_fall':
        break;
    }
  }

  turnToward(a, b, max) { const dd = wrap(b - a); return a + Math.max(-max, Math.min(max, dd)); }

  groundMove(dt) {
    const target = this.inMag * RUN;
    if (this.inMag > 0.05) {
      const rate = this.fwd < 2 ? 22 : lerp(13, 7, Math.min(1, this.fwd / RUN));
      this.yaw = this.turnToward(this.yaw, this.inYaw, rate * dt);
      // turning hard bleeds a little speed
      const d = Math.abs(wrap(this.inYaw - this.yaw));
      if (d > 0.6) this.fwd = approach(this.fwd, 0, d * 6 * dt);
    }
    if (this.fwd < target) this.fwd = approach(this.fwd, target, (this.fwd < 3 ? 26 : 13) * dt);
    else this.fwd = approach(this.fwd, target, (this.fwd > RUN ? 14 : 24) * dt);
  }

  airMove(dt, scale = 1) {
    const k = this.airControl * scale;
    if (this.inMag > 0.05) {
      const d = wrap(this.inYaw - this.yaw);
      this.fwd += Math.cos(d) * this.inMag * 9 * k * dt;
      this.yaw += Math.sin(d) * this.inMag * 2.4 * k * dt;
    }
    const minF = this.state === 'backflip' ? -4 : -2;
    this.fwd = Math.max(minF, Math.min(this.airMax, this.fwd));
  }

  dive(fromGround) {
    this.fwd = Math.min(this.fwd + 4, 15.5);
    this.vy = fromGround ? 7 : Math.max(this.vy, 4);
    this.airMax = this.fwd;
    this.setState('dive');
    this.grounded = false;
  }

  slideKick() {
    this.fwd = Math.max(this.fwd, 11);
    this.vy = 5.5;
    this.airMax = this.fwd;
    this.setState('slidekick');
    this.grounded = false;
  }

  groundPound() {
    this.fwd = 0; this.vy = 0;
    this.setState('gp_spin');
  }

  // One collision sub-step. Returns true if the state left physics control.
  physics(h, input) {
    const w = this.world;
    const air = !this.grounded;

    if (air) {
      if (this.state === 'gp_fall') this.vy = -32;
      else {
        let g = G;
        // Variable jump height: let go of A early for a shorter hop.
        if ((this.state === 'jump' || this.state === 'double') && this.vy > 0 && !input.buttons.A) g *= 2.6;
        if (this.state === 'longjump') g *= 0.78;
        this.vy = Math.max(-MAX_FALL, this.vy - g * h);
      }
    }

    const dx = Math.sin(this.yaw), dz = Math.cos(this.yaw);
    const px0 = this.pos.x, pz0 = this.pos.z;
    this.pos.x += dx * this.fwd * h;
    this.pos.z += dz * this.fwd * h;

    // Walls
    const hits = this.collideWalls(air ? 0.05 : STEP_UP);
    this.terrainWalls(px0, pz0, air, hits);

    // Vertical
    if (!air) {
      const floor = w.floorBelow(this.pos.x, this.pos.z, this.pos.y + STEP_UP, R * 0.5);
      if (floor > -Infinity && floor >= this.pos.y - SNAP_DOWN) {
        this.pos.y = floor;
        // Too steep to stand on: slide downhill.
        const T = w.terrain;
        if (T && Math.abs(T.height(this.pos.x, this.pos.z) - floor) < 1e-4) {
          const g = T.gradient(this.pos.x, this.pos.z, this._g2 || (this._g2 = { x: 0, z: 0 }));
          const gm = Math.hypot(g.x, g.z);
          if (gm > 1.25) {
            this.pos.x -= (g.x / gm) * 6 * h; this.pos.z -= (g.z / gm) * 6 * h;
            this.pos.y = Math.max(this.pos.y - gm * 6 * h, T.height(this.pos.x, this.pos.z));
          }
        }
      } else {
        // walked off a ledge
        const keep = this.state;
        this.grounded = false;
        if (keep === 'bellyslide' || keep === 'slide') { this.setState('dive'); this.vy = 0; }
        else { this.setState('fall'); this.coyote = 0.08; this.vy = 0; this.airMax = Math.max(RUN, this.fwd); this.airControl = 1; }
      }
    } else {
      const ny = this.pos.y + this.vy * h;
      if (this.vy <= 0) {
        const floor = w.floorBelow(this.pos.x, this.pos.z, this.pos.y + 0.05, R * 0.5, 0.4);
        if (ny <= floor) {
          this.pos.y = floor;
          this.grounded = true;
          this.land();
        } else this.pos.y = ny;
      } else {
        const head = this.pos.y + H;
        let ceil = Infinity;
        for (const b of w.boxes) {
          if (!this.circleOverlaps(b, R * 0.8)) continue;
          if (b.min.y >= head - 0.05 && b.min.y < ny + H && b.min.y < ceil) ceil = b.min.y;
        }
        if (ceil < Infinity) { this.pos.y = ceil - H; this.vy = 0; }
        else this.pos.y = ny;
        // rising past a slope: don't sink into it
        if (w.terrain) this.pos.y = Math.max(this.pos.y, w.terrain.height(this.pos.x, this.pos.z));
      }
    }

    // Wall interactions
    for (const hit of hits) {
      const into = -(dx * hit.nx + dz * hit.nz);  // how head-on we hit it
      if (this.grounded) {
        if (into > 0.3) {
          if ((this.state === 'bellyslide' || this.state === 'slide') && this.fwd > 6) { this.fwd = 0; this.setState('stun'); this.fx.shake(0.15); }
          else this.fwd = Math.min(this.fwd, RUN * (1 - into) + 1);
        }
        continue;
      }
      // Ledge grab
      if (LEDGE_OK.has(this.state) && this.vy <= 0 && into > 0.5 && this.ledgeCooldown <= 0) {
        const top = hit.top;
        const rel = top - this.pos.y;
        if (rel > 0.9 && rel < 1.9 && !w.blocked(this.pos.x - hit.nx * 0.6, top + 0.05, top + H, this.pos.z - hit.nz * 0.6)) {
          this.grabLedge(hit, top);
          return true;
        }
      }
      if (WALL_KICKABLE.has(this.state) && into > 0.6 && this.fwd > 4 && this.clingCooldown <= 0 && hit.top > this.pos.y + 1.0) {
        this.wallN.set(hit.nx, hit.nz);
        this.vy = 0;
        this.setState('wallcling');
        this.fx.dust(this.pos.clone().add(new THREE.Vector3(-hit.nx * R, 1, -hit.nz * R)), 3);
        return true;
      }
      if (this.state === 'dive' && into > 0.5 && this.fwd > 6) {
        this.setState('bonk'); this.fwd = -3; this.vy = Math.min(this.vy, 2); this.airMax = RUN;
        this.fx.shake(0.2);
      } else if (into > 0.3) {
        this.fwd = Math.min(this.fwd, Math.max(0, RUN * (1 - into)));
      }
    }
    return !(this.state !== 'ledgehang' && this.state !== 'ledgeclimb' && this.state !== 'wallcling' && this.state !== 'gp_spin');
  }

  grabLedge(hit, top) {
    this.vy = 0; this.fwd = 0;
    this.yaw = Math.atan2(-hit.nx, -hit.nz);
    this.pos.y = top - 1.45;
    this.ledgeStart = this.pos.clone();
    const back = hit.terrain ? R + 1.0 : R + 0.45;
    this.ledgeEnd = new THREE.Vector3(this.pos.x - hit.nx * back, top, this.pos.z - hit.nz * back);
    if (hit.terrain) this.ledgeEnd.y = Math.max(top, this.world.terrain.height(this.ledgeEnd.x, this.ledgeEnd.z));
    this.setState('ledgehang');
    this.anim.sq = -0.1;
  }

  circleOverlaps(b, r) {
    const cx = Math.max(b.min.x, Math.min(this.pos.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(this.pos.z, b.max.z));
    return (this.pos.x - cx) ** 2 + (this.pos.z - cz) ** 2 < r * r;
  }

  collideWalls(step) {
    const hits = [];
    const feet = this.pos.y, head = this.pos.y + H;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.world.boxes) {
        if (b.max.y <= feet + step || b.min.y >= head) continue;
        const cx = Math.max(b.min.x, Math.min(this.pos.x, b.max.x));
        const cz = Math.max(b.min.z, Math.min(this.pos.z, b.max.z));
        let nx = this.pos.x - cx, nz = this.pos.z - cz;
        const d2 = nx * nx + nz * nz;
        if (d2 >= R * R) continue;
        let push;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2); nx /= d; nz /= d; push = R - d;
        } else {
          // centre inside the box footprint: leave along the shallowest side
          const o = [this.pos.x - b.min.x, b.max.x - this.pos.x, this.pos.z - b.min.z, b.max.z - this.pos.z];
          const m = o.indexOf(Math.min(...o));
          nx = [-1, 1, 0, 0][m]; nz = [0, 0, -1, 1][m]; push = o[m] + R;
        }
        this.pos.x += nx * push; this.pos.z += nz * push;
        if (iter === 0) hits.push({ nx, nz, top: b.max.y, box: b });
      }
    }
    return hits;
  }

  // Terrain walls: slopes too steep to walk up (and cliffs) block movement.
  // Slides along them, and reports them as wall hits for kicks / ledges.
  terrainWalls(px0, pz0, air, hits) {
    const T = this.world.terrain;
    if (!T) return;
    const feet = this.pos.y;
    const allow = air ? 0.05 : STEP_UP;
    const g = this._g || (this._g = { x: 0, z: 0 });
    const probe = () => {
      const mdx = this.pos.x - px0, mdz = this.pos.z - pz0, md = Math.hypot(mdx, mdz);
      const ux = md > 1e-6 ? mdx / md : 0, uz = md > 1e-6 ? mdz / md : 0;
      let best = -Infinity;
      const pts = [[0, 0], [ux, uz], [ux * 0.7 - uz * 0.7, uz * 0.7 + ux * 0.7], [ux * 0.7 + uz * 0.7, uz * 0.7 - ux * 0.7]];
      for (const [ox, oz] of pts) {
        const x = this.pos.x + ox * R * 0.85, z = this.pos.z + oz * R * 0.85;
        const th = T.height(x, z);
        if (th > best) { best = th; this._px = x; this._pz = z; }
      }
      return best;
    };
    const gentle = (th, gm) => air && gm < 1.0 && th - feet < 0.45;
    let th = probe();
    if (th - feet <= allow) return;
    T.gradient(this._px, this._pz, g);
    const gm = Math.hypot(g.x, g.z);
    if (gentle(th, gm)) return;  // the landing code will pick it up
    if (gm < 1e-4) { this.pos.x = px0; this.pos.z = pz0; return; }
    const nx = -g.x / gm, nz = -g.z / gm;   // downhill = away from the wall
    const into = (this.pos.x - px0) * nx + (this.pos.z - pz0) * nz;
    if (into < 0) { this.pos.x -= nx * into; this.pos.z -= nz * into; }
    th = probe();
    if (th - feet > allow && !gentle(th, gm)) { this.pos.x = px0; this.pos.z = pz0; }
    hits.push({ nx, nz, top: T.height(this.pos.x - nx * 1.2, this.pos.z - nz * 1.2), terrain: true });
  }

  // -------------------------------------------------------------------------
  // Procedural animation
  // -------------------------------------------------------------------------
  animate(dt) {
    const a = this.anim, s = this.state, t = this.t;
    let pitch = 0, roll = 0, yawOff = 0, bob = 0, crouch = 0;
    let armL = 0, armR = 0, legL = 0, legR = 0, armSpread = 0, legSpread = 0;
    let direct = false; // flips set rotation directly (no smoothing)

    const speedK = Math.min(1, Math.abs(this.fwd) / RUN);
    const flip = (dur) => Math.min(1, t / dur);
    const ease = (k) => 1 - Math.pow(1 - k, 2);

    switch (s) {
      case 'ground': {
        if (Math.abs(this.fwd) > 0.3) {
          a.phase += this.fwd * dt * 1.7;
          const sw = Math.sin(a.phase);
          const amp = 0.25 + speedK * 0.6;
          legL = sw * amp; legR = -sw * amp;
          armL = -sw * amp * 0.9; armR = sw * amp * 0.9;
          bob = Math.abs(Math.cos(a.phase)) * 0.07 * speedK;
          roll = sw * 0.06 * speedK;
          pitch = speedK * 0.22;
        } else {
          a.phase = 0;
          bob = Math.sin(performance.now() / 600) * 0.012;
          armSpread = 0.05;
        }
        break;
      }
      case 'skid': pitch = -0.45; armL = armR = -0.6; legL = 0.6; legR = 0.3; armSpread = 0.4; break;
      case 'crouch': crouch = 0.4; pitch = 0.25; legL = legR = 0.5; armL = armR = 0.4;
        if (this.fwd > 0.2) { a.phase += this.fwd * dt * 3; legL += Math.sin(a.phase) * 0.4; legR -= Math.sin(a.phase) * 0.4; }
        break;
      case 'crouchslide': crouch = 0.35; pitch = 0.35; legL = 0.8; legR = 0.4; armL = armR = -0.8; armSpread = 0.4; break;
      case 'punch1': armR = 1.6 * Math.sin(Math.min(1, t / 0.22) * Math.PI); yawOff = -0.3 * Math.sin(Math.min(1, t / 0.22) * Math.PI); pitch = 0.15; break;
      case 'punch2': armL = 1.6 * Math.sin(Math.min(1, t / 0.22) * Math.PI); yawOff = 0.3 * Math.sin(Math.min(1, t / 0.22) * Math.PI); pitch = 0.15; break;
      case 'kick': yawOff = ease(flip(0.38)) * Math.PI * 2; legL = 1.4; armSpread = 0.9; direct = true; break;
      case 'jump': case 'fall': case 'rollout': {
        if (s === 'rollout' && t < 0.45) { pitch = ease(flip(0.45)) * Math.PI * 2; crouch = 0.25; direct = true; break; }
        const up = this.vy > 0;
        armL = up ? 2.6 : 1.2; armR = up ? -0.2 : 1.2; legL = up ? 0.9 : 0.3; legR = up ? -0.2 : -0.1; armSpread = 0.3;
        break;
      }
      case 'double': armL = armR = 2.8; legL = 0.9; legR = -0.3; armSpread = 0.5; yawOff = this.vy > 0 ? ease(flip(0.5)) * Math.PI * 2 : 0; direct = this.vy > 0; break;
      case 'triple': pitch = ease(flip(0.85)) * Math.PI * 2; crouch = t < 0.85 ? 0.25 : 0; armL = armR = t < 0.85 ? 0.6 : 2.5; legL = legR = t < 0.85 ? 1.2 : 0.2; direct = true; break;
      case 'backflip': pitch = -ease(flip(0.95)) * Math.PI * 2; crouch = t < 0.9 ? 0.2 : 0; armL = armR = 2.4; legL = legR = 0.8; direct = true; break;
      case 'sideflip': roll = ease(flip(0.75)) * Math.PI * 2; armSpread = 1.3; legSpread = 0.4; direct = true; break;
      case 'longjump': pitch = 1.15; armL = armR = 2.9; legL = -0.4; legR = -0.6; break;
      case 'wallkick': yawOff = -ease(flip(0.35)) * Math.PI * 2; armL = armR = 2.4; legL = 0.8; armSpread = 0.4; direct = true; break;
      case 'wallcling': pitch = -0.25; armL = armR = 1.6; legL = 0.9; legR = 0.2; armSpread = 0.5; break;
      case 'gp_spin': pitch = ease(flip(0.3)) * Math.PI * 2; crouch = 0.35; legL = legR = 1.4; armL = armR = 0.8; direct = true; break;
      case 'gp_fall': crouch = 0.3; legL = legR = 1.5; armL = armR = 2.6; armSpread = 0.3; break;
      case 'gp_land': crouch = Math.max(0, 0.45 - t); legL = legR = 0.6; armSpread = 0.6; break;
      case 'dive': pitch = 1.45; armL = armR = 3.0; legL = legR = -0.2; break;
      case 'bellyslide': pitch = 1.5; armL = armR = 3.0; legL = legR = -0.25; bob = -0.55; break;
      case 'slidekick': case 'slide': pitch = -1.25; legL = 1.6; legR = 0.6; armL = armR = -1.2; armSpread = 0.5; bob = s === 'slide' ? -0.45 : 0; break;
      case 'jumpkick': legL = 1.6 * Math.sin(Math.min(1, t / 0.32) * Math.PI); legR = -0.3; armL = -0.6; armR = 1.0; pitch = -0.2; break;
      case 'bonk': pitch = -0.9; armSpread = 1.4; legSpread = 0.5; break;
      case 'stun': pitch = -0.5 + Math.min(0.5, t); crouch = 0.15; roll = Math.sin(t * 18) * 0.1 * (1 - t / 0.6); armSpread = 0.8; break;
      case 'ledgehang': armL = armR = 3.0; legL = 0.2; legR = -0.1 + Math.sin(t * 3) * 0.1; break;
      case 'hurt': pitch = -0.7; armL = armR = 1.2; armSpread = 1.3; legL = 0.6; legR = 0.2; break;
      case 'starjump': armR = 3.0; armL = 0.6; armSpread = 0.4; legL = 0.8; legR = 0.1; yawOff = ease(flip(0.6)) * Math.PI * 2; direct = true; break;
      case 'starpose': {
        // star held high, then a happy little bounce
        armR = 3.05; armL = t > 0.6 ? 1.4 + Math.sin(t * 9) * 0.25 : 0.4; armSpread = 0.35;
        bob = t > 0.6 ? Math.abs(Math.sin(t * 5)) * 0.06 : 0; legL = legR = 0;
        break;
      }
      case 'ledgeclimb': { const k = Math.min(1, t / (this.climbFast ? 0.22 : 0.45)); armL = armR = 3.0 * (1 - k) + 0.3; legL = 1.2 * Math.sin(k * Math.PI); crouch = 0.3 * Math.sin(k * Math.PI); pitch = 0.4 * Math.sin(k * Math.PI); break; }
    }

    // Body rotation
    if (direct) {
      a.pitch = pitch; a.roll = roll; a.yaw = yawOff;
    } else {
      a.pitch = damp(wrap(a.pitch), pitch, 14, dt);
      a.roll = damp(wrap(a.roll), roll, 14, dt);
      a.yaw = damp(wrap(a.yaw), yawOff, 14, dt);
    }
    this.spin.rotation.set(a.pitch, a.yaw, a.roll, 'YXZ');

    // Squash & stretch spring
    a.sqv += (-170 * a.sq - 14 * a.sqv) * dt;
    a.sq += a.sqv * dt;
    a.crouch = damp(a.crouch || 0, crouch, 16, dt);
    const sy = Math.max(0.5, 1 + a.sq - a.crouch * 0.6);
    const sxz = 1 / Math.sqrt(sy);
    this.squashG.scale.set(sxz, sy, sxz);
    a.bob = damp(a.bob, bob, 20, dt);
    this.pivot.position.y = 0.85 + a.bob;

    // Limbs: rigid arms and legs (no elbow or knee bends), posed at 30 Hz like
    // an N64 game, so motion reads as snappy key poses.
    a.poseClock = (a.poseClock || 0) + dt;
    if (a.poseClock >= 1 / 30) {
      this.character.pose({ armL, armR, legL, legR, armSpread, legSpread, kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0 }, a.poseClock);
      a.poseClock = 0;
    }

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;

    // Blob shadow on the floor below
    const fy = this.world.floorBelow(this.pos.x, this.pos.z, this.pos.y + 0.1, 0);
    if (fy > -Infinity) {
      this.blob.visible = true;
      this.blob.position.set(this.pos.x, fy + 0.02, this.pos.z);
      const hgt = this.pos.y - fy;
      const k = Math.max(0.35, 1 - hgt / 14);
      this.blob.scale.setScalar(k);
      this.blob.material.opacity = 0.38 * k;
    } else this.blob.visible = false;
  }
}
