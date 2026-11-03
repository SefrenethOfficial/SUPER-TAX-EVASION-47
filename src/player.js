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

const AIR = new Set(['jump', 'double', 'triple', 'backflip', 'sideflip', 'longjump', 'wallkick', 'fall',
  'gp_spin', 'gp_fall', 'dive', 'jumpkick', 'rollout', 'bonk', 'slidekick', 'wallcling']);
const WALL_KICKABLE = new Set(['jump', 'double', 'triple', 'sideflip', 'longjump', 'wallkick', 'fall', 'rollout', 'backflip', 'jumpkick']);
const LEDGE_OK = new Set(['jump', 'double', 'triple', 'sideflip', 'backflip', 'wallkick', 'fall', 'rollout', 'jumpkick']);

const MOVE_NAMES = {
  double: 'DOUBLE JUMP', triple: 'TRIPLE JUMP!', backflip: 'BACKFLIP', sideflip: 'SIDE SOMERSAULT',
  longjump: 'LONG JUMP', wallkick: 'WALL KICK!', gp_spin: 'GROUND POUND', dive: 'DIVE', slidekick: 'SLIDE KICK',
  rollout: 'ROLLOUT', ledge: 'LEDGE GRAB',
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

// ---------------------------------------------------------------------------
// Character model: cut the single rigid mesh into body / arms / legs so the
// limbs can swing, and paint it with flat vertex colours.
// ---------------------------------------------------------------------------
const COL = {
  straw: new THREE.Color('#ecc15a'), band: new THREE.Color('#c0392b'), skin: new THREE.Color('#e9b48a'),
  shirt: new THREE.Color('#d8452f'), belt: new THREE.Color('#4a2c17'), pants: new THREE.Color('#2f5fc4'),
  shoes: new THREE.Color('#5a3417'),
};

function partOf(c) {
  if (c.y < -0.42 && Math.abs(c.x) > 0.02) return c.x > 0 ? 'legL' : 'legR';
  if (Math.abs(c.x) > 0.47 && c.y > -0.5 && c.y < 0.72) return c.x > 0 ? 'armL' : 'armR';
  return 'body';
}
function colourOf(c, part) {
  if (c.y > 1.05) {
    const r = Math.hypot(c.x, c.z);
    return c.y > 1.3 && c.y < 1.62 && r < 0.5 ? COL.band : COL.straw;
  }
  if (part === 'body') {
    if (c.y > 0.72) return COL.skin;
    if (c.y < -0.25) return COL.belt;
    return COL.shirt;
  }
  if (part.startsWith('arm')) return c.y < -0.12 ? COL.skin : COL.shirt;
  return c.y < -1.0 ? COL.shoes : COL.pants;
}

// Joint positions in the model's raw (unscaled) space.
const JOINTS = { armL: [0.55, 0.55, 0], armR: [-0.55, 0.55, 0], legL: [0.2, -0.42, 0], legR: [-0.2, -0.42, 0], body: [0, 0, 0] };

export function buildCharacter(gltfScene) {
  gltfScene.updateMatrixWorld(true);
  let src = null;
  gltfScene.traverse((o) => { if (o.isMesh && !src) src = o; });
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld).toNonIndexed();
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;

  const buckets = { body: [], armL: [], armR: [], legL: [], legR: [] };
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.x += pos.getX(i + k) / 3, c.y += pos.getY(i + k) / 3, c.z += pos.getZ(i + k) / 3;
    const p = partOf(c);
    buckets[p].push([i, colourOf(c, p)]);
  }

  const height = 3.374;
  const scale = 1.7 / height;
  const root = new THREE.Group();
  const holder = new THREE.Group();          // turns the model to face +Z and scales it
  holder.rotation.y = Math.PI;
  holder.scale.setScalar(scale);
  holder.position.y = 1.35 * scale - 0.85;   // feet at y=0 relative to the 0.85 pivot
  root.add(holder);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const parts = {};
  for (const [name, tris] of Object.entries(buckets)) {
    const n = tris.length * 3;
    const p = new Float32Array(n * 3), nn = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const j = JOINTS[name];
    let w = 0;
    for (const [i, colr] of tris) {
      for (let k = 0; k < 3; k++) {
        p[w * 3] = pos.getX(i + k) - j[0]; p[w * 3 + 1] = pos.getY(i + k) - j[1]; p[w * 3 + 2] = pos.getZ(i + k) - j[2];
        nn[w * 3] = nrm.getX(i + k); nn[w * 3 + 1] = nrm.getY(i + k); nn[w * 3 + 2] = nrm.getZ(i + k);
        col[w * 3] = colr.r; col[w * 3 + 1] = colr.g; col[w * 3 + 2] = colr.b;
        w++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    const joint = new THREE.Group();
    joint.position.set(...j);
    joint.add(mesh);
    holder.add(joint);
    parts[name] = joint;
  }
  return { root, parts };
}

// ---------------------------------------------------------------------------
// Player controller
// ---------------------------------------------------------------------------
export class Player {
  constructor(world, character, fx) {
    this.world = world;
    this.fx = fx;
    this.onMove = () => {};

    // Visual hierarchy: root(pos, yaw) > squash(scale) > pivot(y .85) > spin(rot) > character
    this.root = new THREE.Group();
    this.squashG = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.85;
    this.spin = new THREE.Group();
    this.root.add(this.squashG); this.squashG.add(this.pivot); this.pivot.add(this.spin);
    this.spin.add(character.root);
    this.parts = character.parts;
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
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s; this.t = 0;
    this.grounded = !AIR.has(s) && s !== 'ledgehang' && s !== 'ledgeclimb';
    if (MOVE_NAMES[s]) this.onMove(MOVE_NAMES[s]);
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
      case 'bonk': this.setState('stun'); this.fwd = 0; return;
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
    if (this.pos.y < -40) { this.reset(); this.onMove('TAXMAN GOT YOU'); }
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
    this.pos.x += dx * this.fwd * h;
    this.pos.z += dz * this.fwd * h;

    // Walls
    const hits = this.collideWalls(air ? 0.05 : STEP_UP);

    // Vertical
    if (!air) {
      const floor = w.floorBelow(this.pos.x, this.pos.z, this.pos.y + STEP_UP, R * 0.5);
      if (floor > -Infinity && floor >= this.pos.y - SNAP_DOWN) {
        this.pos.y = floor;
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
        const floor = w.floorBelow(this.pos.x, this.pos.z, this.pos.y + 0.05, R * 0.5);
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
        const top = hit.box.max.y;
        const rel = top - this.pos.y;
        if (rel > 0.9 && rel < 1.9 && !w.blocked(this.pos.x - hit.nx * 0.6, top + 0.05, top + H, this.pos.z - hit.nz * 0.6)) {
          this.grabLedge(hit, top);
          return true;
        }
      }
      if (WALL_KICKABLE.has(this.state) && into > 0.6 && this.fwd > 4 && this.clingCooldown <= 0 && hit.box.max.y > this.pos.y + 1.0) {
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
    this.ledgeEnd = new THREE.Vector3(this.pos.x - hit.nx * (R + 0.45), top, this.pos.z - hit.nz * (R + 0.45));
    this.setState('ledgehang');
    this.onMove(MOVE_NAMES.ledge);
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
        if (iter === 0) hits.push({ nx, nz, box: b });
      }
    }
    return hits;
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
    const sy = Math.max(0.5, 1 + a.sq - a.crouch);
    const sxz = 1 / Math.sqrt(sy);
    this.squashG.scale.set(sxz, sy, sxz);
    a.bob = damp(a.bob, bob, 20, dt);
    this.pivot.position.y = 0.85 + a.bob;

    // Limbs (rotation about the joint's local X; arms raise forward/up)
    const P = this.parts, kL = 18;
    const set = (j, x, z) => { j.rotation.x = damp(j.rotation.x, x, kL, dt); j.rotation.z = damp(j.rotation.z, z, kL, dt); };
    // The model is rotated 180° in its holder, so +X here is the model's left.
    set(P.armL, armL, armSpread);
    set(P.armR, armR, -armSpread);
    set(P.legL, legL, legSpread * 0.5);
    set(P.legR, legR, -legSpread * 0.5);

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

export { MOVE_NAMES };
