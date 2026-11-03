import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Enemies.
//
// CherryBomb: sits near home until you come close, then rolls after you.
// Stay next to it too long and its fuse burns down and it explodes. Punch,
// kick or dive into it to send it flying (it blows up away from you), or
// stomp on it to squash it flat.
//
// KingCherryBomb: the boss on the summit. Walks after you and throws cherry
// bombs. Get in front of him and he grabs and throws you. Grab him from
// behind (B), then throw him (B) so he lands on the summit: three throws
// beat him. Thrown off the edge, he jumps back up unhurt. When beaten he
// explodes and drops the star.
//
// ctx: { world, fx, coins, player, bombModel, onExplode }
// ---------------------------------------------------------------------------

const G = 30;
const tmp = new THREE.Vector3();

function bombMesh(model, radius) {
  const m = model.clone(true);
  m.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(0xff2000);
      o.material.emissiveIntensity = 0;
    }
  });
  // the model is a radius-1 ball sitting on y=0, facing +Z
  m.scale.setScalar(radius);
  m.position.y = -radius;
  return m;
}

function setGlow(obj, v) {
  obj.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = v; });
}

function blobShadow(scene, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  scene.add(m);
  return m;
}

function floorAt(world, x, z, y) { return world.floorBelow(x, z, y + 1.2, 0); }

export class CherryBomb {
  constructor(ctx, x, z) {
    this.ctx = ctx;
    this.R = 0.6;
    const y = floorAt(ctx.world, x, z, 200);
    this.home = new THREE.Vector3(x, y, z);
    this.pos = this.home.clone();
    this.group = new THREE.Group();
    this.roll = new THREE.Group();
    this.roll.position.y = this.R;
    this.body = bombMesh(ctx.bombModel, this.R);
    this.roll.add(this.body);
    this.group.add(this.roll);
    ctx.world.scene.add(this.group);
    this.shadow = blobShadow(ctx.world.scene, this.R * 1.1);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * 6;
    this.reset();
  }

  reset() {
    this.pos.copy(this.home);
    this.state = 'idle'; this.t = 0; this.fuse = 0; this.respawn = 0;
    this.group.visible = this.shadow.visible = true;
    this.group.scale.set(1, 1, 1);
    setGlow(this.body, 0);
  }

  update(dt) {
    const { player, world, fx } = this.ctx;
    this.t += dt;
    if (this.state === 'dead') {
      this.respawn -= dt;
      if (this.respawn <= 0 && player.pos.distanceTo(this.home) > 12) this.reset();
      return;
    }
    const p = player.pos;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dist = Math.hypot(dx, dz), dy = p.y - this.pos.y;

    if (this.state === 'launched' || this.state === 'squashed') {
      if (this.state === 'squashed') {
        this.group.scale.set(1.4, Math.max(0.15, 1 - this.t * 4), 1.4);
        if (this.t > 0.5) { fx.dust(this.pos, 10); this.die(true); }
        return this.place();
      }
      this.vel.y -= G * dt;
      const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
      this.pos.set(nx, this.pos.y + this.vel.y * dt, nz);
      this.roll.rotation.x += dt * 14;
      const f = floorAt(world, nx, nz, this.pos.y);
      if ((this.vel.y < 0 && this.pos.y <= f) || this.t > 1.6) { this.pos.y = Math.max(this.pos.y, f); this.explode(true); }
      return this.place();
    }

    // Getting hit
    const atk = player.attackSphere();
    const cy = this.pos.y + this.R;
    if (atk && Math.hypot(atk.x - this.pos.x, atk.y - cy, atk.z - this.pos.z) < atk.r + this.R) {
      const k = 1 / Math.max(0.01, dist);
      this.vel.set(-dx * k * 13, 8, -dz * k * 13);
      this.state = 'launched'; this.t = 0;
      fx.sparkle(tmp.set(this.pos.x, cy, this.pos.z), 6);
      fx.shake(0.1);
      return this.place();
    }
    if (player.stomping(this.pos.x, this.pos.z, this.pos.y + this.R * 2, this.R)) {
      player.bounce(11);
      this.state = 'squashed'; this.t = 0;
      return this.place();
    }

    // Chase or idle
    const near = dist < 15 && Math.abs(dy) < 5;
    if (this.state === 'idle' && near) this.state = 'chase';
    if (this.state === 'chase' && (dist > 22 || Math.abs(dy) > 7)) this.state = 'home';
    let tx = this.pos.x, tz = this.pos.z, speed = 0;
    if (this.state === 'chase') { tx = p.x; tz = p.z; speed = 3.6; }
    else if (this.state === 'home') {
      tx = this.home.x; tz = this.home.z; speed = 2.5;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.5) this.state = 'idle';
      if (near) this.state = 'chase';
    } else {
      // idle: wobble on the spot
      this.roll.rotation.z = Math.sin(this.t * 3) * 0.1;
    }
    if (speed > 0) {
      const mx = tx - this.pos.x, mz = tz - this.pos.z, md = Math.hypot(mx, mz);
      if (md > 0.8) {
        const step = Math.min(md - 0.6, speed * dt);
        const nx = this.pos.x + (mx / md) * step, nz = this.pos.z + (mz / md) * step;
        const f = floorAt(world, nx, nz, this.pos.y);
        // don't roll off cliffs or up walls
        if (f > -Infinity && f > this.pos.y - 1.2 && f < this.pos.y + 0.6) {
          this.pos.set(nx, f, nz);
          this.yaw = Math.atan2(mx, mz);
          this.roll.rotation.x += step / this.R;
        }
      }
    }

    // Fuse: burns while you're close, cools off when you get away
    if (this.state === 'chase' && dist < 2.8 && Math.abs(dy) < 2) this.fuse += dt;
    else this.fuse = Math.max(0, this.fuse - dt * 0.6);
    const heat = this.fuse / 1.8;
    setGlow(this.body, heat > 0 ? (0.5 + 0.5 * Math.sin(this.t * (8 + heat * 30))) * heat * 1.6 : 0);
    const puff = 1 + heat * 0.15 * (0.5 + 0.5 * Math.sin(this.t * 30));
    this.group.scale.set(puff, puff, puff);
    if (this.fuse >= 1.8) this.explode(false);
    this.place();
  }

  place() {
    if (this.state === 'dead') return;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const f = floorAt(this.ctx.world, this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.shadow.position.set(this.pos.x, (f > -Infinity ? f : this.pos.y) + 0.03, this.pos.z);
  }

  explode(knockedAway) {
    const { player, fx } = this.ctx;
    const c = new THREE.Vector3(this.pos.x, this.pos.y + this.R, this.pos.z);
    fx.explode(c);
    if (this.ctx.onExplode) this.ctx.onExplode();
    this.lastBlast = c.distanceTo(tmp.copy(player.pos).setY(player.pos.y + 0.8));
    if (this.lastBlast < (knockedAway ? 2.4 : 3.2)) player.hurt(3, this.pos.x, this.pos.z);
    this.die(knockedAway);
  }

  die(dropCoin) {
    if (dropCoin) this.ctx.coins.spawn(this.pos.x, this.pos.y + 0.9, this.pos.z);
    this.state = 'dead';
    this.respawn = 15;
    this.group.visible = this.shadow.visible = false;
  }
}

// A bomb the King throws: flies in an arc and explodes where it lands.
class ThrownBomb {
  constructor(ctx, from, to, flight) {
    this.ctx = ctx;
    this.pos = from.clone();
    this.vel = new THREE.Vector3((to.x - from.x) / flight, 0, (to.z - from.z) / flight);
    this.vel.y = (to.y - from.y + 0.5 * G * flight * flight) / flight;
    this.mesh = bombMesh(ctx.bombModel, 0.55);
    this.group = new THREE.Group();
    this.mesh.position.y = 0;
    this.group.add(this.mesh);
    ctx.world.scene.add(this.group);
    this.shadow = blobShadow(ctx.world.scene, 0.6);
    this.done = false; this.t = 0;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.vel.y -= G * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.group.position.copy(this.pos);
    this.mesh.rotation.x += dt * 8;
    setGlow(this.mesh, 0.5 + 0.5 * Math.sin(this.t * 30));
    const f = floorAt(this.ctx.world, this.pos.x, this.pos.z, this.pos.y);
    this.shadow.position.set(this.pos.x, (f > -Infinity ? f : 0) + 0.03, this.pos.z);
    if ((this.vel.y < 0 && this.pos.y - 0.5 <= f) || this.t > 4) {
      const { player, fx } = this.ctx;
      fx.explode(this.pos);
      if (this.ctx.onExplode) this.ctx.onExplode();
      if (this.pos.distanceTo(tmp.copy(player.pos).setY(player.pos.y + 0.8)) < 2.8) player.hurt(2, this.pos.x, this.pos.z);
      this.remove();
    }
  }

  remove() {
    this.done = true;
    this.ctx.world.scene.remove(this.group);
    this.ctx.world.scene.remove(this.shadow);
  }
}

export class KingCherryBomb {
  // cfg: { x, z, y, arena }  onStart(), onDefeat(position)
  constructor(ctx, cfg) {
    this.ctx = ctx;
    this.cfg = cfg;
    this.R = 1.6;
    this.onStart = () => {};
    this.onDefeat = () => {};
    this.pos = new THREE.Vector3(cfg.x, cfg.y, cfg.z + 4);
    this.group = new THREE.Group();
    this.bodyG = new THREE.Group();
    this.bodyG.position.y = this.R + 0.9;   // legs lift the body
    this.body = bombMesh(ctx.bombModel, this.R);
    this.bodyG.add(this.body);
    this.group.add(this.bodyG);

    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const glove = new THREE.MeshLambertMaterial({ color: 0xf4f4f4 });
    const shoe = new THREE.MeshLambertMaterial({ color: 0xf0a030 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc928, metalness: 0.6, roughness: 0.3, emissive: 0x4a3000 });
    const gem = new THREE.MeshStandardMaterial({ color: 0xe0203a, metalness: 0.2, roughness: 0.2, emissive: 0x400008 });

    // arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * this.R * 0.95, 0.15, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.0, 4, 8), dark);
      arm.position.y = -0.65;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), glove);
      hand.position.y = -1.35;
      sh.add(arm, hand);
      sh.rotation.z = side * 0.5;
      this.bodyG.add(sh);
      this.arms.push(sh);
    }
    // legs
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.7, 1.0, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), dark);
      leg.position.y = -0.35;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), shoe);
      foot.scale.set(0.9, 0.5, 1.4);
      foot.position.set(0, -0.75, 0.2);
      hip.add(leg, foot);
      this.group.add(hip);
      this.legs.push(hip);
    }
    // crown
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.45, 12, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 6), gold);
      spike.position.set(Math.cos(a) * 0.78, 0.42, Math.sin(a) * 0.78);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), gem);
      g.position.set(Math.cos(a + 0.52) * 0.84, 0.02, Math.sin(a + 0.52) * 0.84);
      crown.add(spike, g);
    }
    crown.position.set(-0.25, this.R * 0.95, -0.1);
    crown.rotation.z = 0.12;
    this.bodyG.add(crown);

    ctx.world.scene.add(this.group);
    this.shadow = blobShadow(ctx.world.scene, this.R * 1.2);
    this.hp = 3;
    this.state = 'sleep'; this.t = 0; this.throwT = 2.5; this.walkPhase = 0;
    this.yaw = Math.PI;
    this.thrown = [];
    this.place();
  }

  get top() { return this.pos.y + this.bodyG.position.y + this.R; }

  // Where the player stands relative to the King: cos of the angle between
  // his facing and the direction to the player (1 = right in front, -1 = behind).
  facing(px, pz) {
    const dx = px - this.pos.x, dz = pz - this.pos.z, d = Math.hypot(dx, dz) || 1;
    return (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / d;
  }

  // Called when the player presses B on the ground. Only works from behind.
  tryGrab() {
    const p = this.ctx.player.pos;
    if (!['walk', 'windup'].includes(this.state)) return false;
    const dist = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (dist > this.R + 1.3 || Math.abs(p.y - this.pos.y) > 1.5) return false;
    if (this.facing(p.x, p.z) > -0.3) return false;   // not behind him
    this.state = 'held'; this.t = 0;
    for (const b of this.thrown) b.remove();
    this.bodyG.rotation.y = 0;
    return true;
  }

  // The player threw him.
  onThrown() {
    const pl = this.ctx.player;
    this.vel = new THREE.Vector3(Math.sin(pl.yaw) * 10, 8, Math.cos(pl.yaw) * 10);
    this.state = 'thrown'; this.t = 0; this.goodThrow = true;
  }

  update(dt) {
    const { player, fx } = this.ctx;
    this.t += dt;
    for (const b of this.thrown) b.update(dt);
    this.thrown = this.thrown.filter((b) => !b.done);
    if (this.state === 'gone') return;
    this.grabCooldown = Math.max(0, (this.grabCooldown || 0) - dt);
    const p = player.pos, c = this.cfg;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dist = Math.hypot(dx, dz);
    const playerInArena = Math.hypot(p.x - c.x, p.z - c.z) < c.arena + 2 && p.y > c.y - 1.5;
    const faceYaw = Math.atan2(dx, dz);
    const turn = (rate) => { const d = Math.atan2(Math.sin(faceYaw - this.yaw), Math.cos(faceYaw - this.yaw)); this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d)); };
    const groundY = () => floorAt(this.ctx.world, this.pos.x, this.pos.z, this.pos.y + 2);
    // he turns faster as he gets angrier
    const turnRate = [3.4, 3.0, 2.6, 2.2][this.hp];

    switch (this.state) {
      case 'sleep':
        this.bodyG.rotation.z = Math.sin(this.t * 1.5) * 0.04;
        if (playerInArena) { this.state = 'intro'; this.t = 0; this.onStart(); }
        break;
      case 'intro':
        turn(3);
        this.bodyG.position.y = this.R + 0.9 + Math.abs(Math.sin(this.t * 8)) * 0.3;
        if (this.t > 1.4) { this.state = 'walk'; this.t = 0; fx.shake(0.4); }
        break;
      case 'walk': {
        turn(turnRate);
        if (dist > this.R + 0.6) {
          const sp = (this.hp === 1 ? 3.0 : 2.4) * dt;
          let nx = this.pos.x + Math.sin(this.yaw) * sp, nz = this.pos.z + Math.cos(this.yaw) * sp;
          const ax = nx - c.x, az = nz - c.z, ar = Math.hypot(ax, az);
          if (ar > c.arena) { nx = c.x + ax / ar * c.arena; nz = c.z + az / ar * c.arena; }
          this.pos.x = nx; this.pos.z = nz;
          this.pos.y = Math.max(c.y - 1, groundY());
          this.walkPhase += dt * 6;
        }
        this.throwT -= dt;
        if (this.throwT <= 0 && playerInArena) { this.state = 'windup'; this.t = 0; }
        // Walk up to his face and he grabs you
        if (this.grabCooldown <= 0 && dist < this.R + 1.1 && Math.abs(p.y - this.pos.y) < 2.2 && this.facing(p.x, p.z) > 0.35 && player.state !== 'grabbed' && player.invuln <= 0) {
          this.state = 'grabbing'; this.t = 0;
          player.setState('grabbed'); player.fwd = 0; player.vy = 0;
        }
        break;
      }
      case 'windup':
        turn(turnRate);
        if (this.t > 0.7) {
          const from = new THREE.Vector3(this.pos.x, this.top + 0.6, this.pos.z);
          const to = new THREE.Vector3(p.x + player.inDir.x * 1.5, p.y, p.z + player.inDir.y * 1.5);
          this.thrown.push(new ThrownBomb(this.ctx, from, to, 1.1));
          this.state = 'walk'; this.t = 0; this.throwT = this.hp === 1 ? 2.2 : 3.2;
        }
        break;
      case 'grabbing': {
        // hold the player up in front, spin round, then hurl them
        this.yaw += dt * (this.t > 0.4 ? 7 : 0);
        player.pos.set(this.pos.x + Math.sin(this.yaw) * (this.R + 0.5), this.pos.y + 1.8, this.pos.z + Math.cos(this.yaw) * (this.R + 0.5));
        player.yaw = this.yaw + Math.PI;
        if (this.t > 1.1) {
          player.setState('fall');
          player.invuln = 0;
          player.hurt(2, this.pos.x, this.pos.z, 2.2);
          this.state = 'walk'; this.t = 0; this.grabCooldown = 1.5; this.throwT = Math.max(this.throwT, 1.5);
        }
        break;
      }
      case 'held': {
        // carried by the player: legs kick, he can wriggle free after a while
        const yaw = player.yaw;
        this.pos.set(p.x + Math.sin(yaw) * 1.3, p.y + 0.6, p.z + Math.cos(yaw) * 1.3);
        this.yaw = yaw + Math.PI;
        this.walkPhase += dt * 18;
        if (player.state !== 'carry' && player.state !== 'throwing') {
          // dropped (player got hit or fell)
          this.vel = new THREE.Vector3(0, 0, 0); this.state = 'thrown'; this.t = 0; this.goodThrow = false;
        } else if (this.t > 5) {
          player.setState('ground');
          this.vel = new THREE.Vector3(Math.sin(yaw) * 3, 6, Math.cos(yaw) * 3); this.state = 'thrown'; this.t = 0; this.goodThrow = false;
        }
        break;
      }
      case 'thrown': {
        this.vel.y -= G * dt;
        this.pos.addScaledVector(this.vel, dt);
        this.bodyG.rotation.x += dt * 6;
        const f = groundY();
        if (this.vel.y < 0 && this.pos.y <= f) {
          this.pos.y = f;
          this.bodyG.rotation.x = 0;
          fx.dust(this.pos, 14); fx.shake(0.5);
          const inside = Math.hypot(this.pos.x - c.x, this.pos.z - c.z) <= c.arena + 0.5 && f > c.y - 1.5;
          if (inside && this.goodThrow) this.hit();
          else if (!inside) { this.state = 'recover'; this.t = 0; this.from = this.pos.clone(); }
          else { this.state = 'walk'; this.t = 0; }
        }
        break;
      }
      case 'recover': {
        // thrown off the summit: he leaps back up, unhurt
        const k = Math.min(1, this.t / 1.3);
        const ax = this.from.x - c.x, az = this.from.z - c.z, ar = Math.hypot(ax, az) || 1;
        const tx = c.x + ax / ar * (c.arena - 2), tz = c.z + az / ar * (c.arena - 2);
        this.pos.set(this.from.x + (tx - this.from.x) * k, this.from.y + (c.y - this.from.y) * k + Math.sin(k * Math.PI) * 6, this.from.z + (tz - this.from.z) * k);
        this.yaw += dt * 5;
        if (k >= 1) { this.pos.y = c.y; this.state = 'walk'; this.t = 0; fx.shake(0.4); fx.dust(this.pos, 10); }
        break;
      }
      case 'stunned':
        setGlow(this.body, Math.floor(this.t * 12) % 2 ? 1.2 : 0);
        this.bodyG.rotation.z = Math.sin(this.t * 25) * 0.08;
        if (this.t > 1.6) { setGlow(this.body, 0); this.state = 'walk'; this.t = 0; this.throwT = 1.0; }
        break;
      case 'defeated': {
        const k = Math.min(1, this.t / 2.2);
        this.bodyG.rotation.y += dt * (4 + k * 20);
        setGlow(this.body, (Math.floor(this.t * (8 + k * 20)) % 2) * 1.5);
        const s = 1 + k * 0.4;
        this.group.scale.set(s, s, s);
        if (this.t > 2.2) {
          for (let i = 0; i < 4; i++) fx.explode(tmp.set(this.pos.x + (Math.random() - 0.5) * 2, this.pos.y + 1 + Math.random() * 3, this.pos.z + (Math.random() - 0.5) * 2));
          if (this.ctx.onExplode) this.ctx.onExplode();
          fx.shake(0.8);
          this.group.visible = this.shadow.visible = false;
          this.state = 'gone';
          for (let i = 0; i < 5; i++) this.ctx.coins.spawn(this.pos.x + Math.cos(i * 1.26) * 2, this.pos.y + 0.9, this.pos.z + Math.sin(i * 1.26) * 2);
          this.onDefeat(new THREE.Vector3(c.x, c.y, c.z));
        }
        break;
      }
    }

    // Stomping or punching him doesn't hurt him: you just bounce off.
    if (this.state === 'walk' || this.state === 'windup' || this.state === 'stunned') {
      if (player.stomping(this.pos.x, this.pos.z, this.top, this.R * 0.9)) player.bounce(12);
      const atk = player.attackSphere();
      if (atk && Math.hypot(atk.x - this.pos.x, atk.y - (this.pos.y + this.bodyG.position.y), atk.z - this.pos.z) < atk.r + this.R) {
        player.fwd = Math.min(player.fwd, -4);
      }
    }

    // Animation
    const moving = this.state === 'walk';
    const kick = this.state === 'held' || this.state === 'thrown';
    const sw = moving || kick ? Math.sin(this.walkPhase) : 0;
    this.legs[0].rotation.x = sw * (kick ? 1.0 : 0.6); this.legs[1].rotation.x = -sw * (kick ? 1.0 : 0.6);
    if (this.state === 'windup') { this.arms[0].rotation.x = this.arms[1].rotation.x = -2.6 * Math.min(1, this.t / 0.4); }
    else if (this.state === 'grabbing') { this.arms[0].rotation.x = this.arms[1].rotation.x = -1.6; }
    else { this.arms[0].rotation.x = -sw * 0.5; this.arms[1].rotation.x = sw * 0.5; }
    if (this.state !== 'intro') this.bodyG.position.y = this.R + 0.9 + (moving ? Math.abs(sw) * 0.12 : 0);
    if (this.state !== 'stunned' && this.state !== 'thrown') this.bodyG.rotation.z = moving ? sw * 0.08 : 0;
    this.place();
  }

  hit() {
    const { fx } = this.ctx;
    this.hp -= 1;
    fx.sparkle(tmp.set(this.pos.x, this.top, this.pos.z), 16);
    fx.shake(0.6);
    this.t = 0;
    this.state = this.hp <= 0 ? 'defeated' : 'stunned';
    for (const b of this.thrown) b.remove();
  }

  place() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const f = floorAt(this.ctx.world, this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.shadow.position.set(this.pos.x, (f > -Infinity ? f : this.pos.y) + 0.04, this.pos.z);
  }
}
