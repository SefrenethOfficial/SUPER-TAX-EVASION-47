import * as THREE from 'three';

// ---------------------------------------------------------------------------
// SM64-style iron balls. Every few seconds one appears at the top of a path and
// rolls down it, picking up speed, then carries on off the end until it drops
// away. Get hit and you're knocked flying. Jump over them or step aside.
// The ball is a camera-facing sprite, like the N64 ones.
// ---------------------------------------------------------------------------

const R = 0.75;          // ball radius
const ACCEL = 5.5;       // m/s² down the path
const MAX_SPEED = 11;
const GRAV = 38;

export class IronBalls {
  // path: [[x, z, y], ...] from the top down. opts: { every, texture }
  constructor(scene, world, path, opts = {}) {
    this.scene = scene;
    this.world = world;
    this.pts = path.map(([x, z, y]) => new THREE.Vector3(x, y, z));
    this.len = [0];
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      this.len.push(this.len[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.total = this.len[this.len.length - 1];
    this.every = opts.every ?? 4.5;
    this.timer = 1.5;
    this.balls = [];
    this.mat = new THREE.SpriteMaterial({ map: opts.texture, transparent: true, alphaTest: 0.4 });
    this.shadowGeo = new THREE.CircleGeometry(R * 1.05, 16);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false });
  }

  floor(x, z, y) { return this.world.floorBelow(x, z, y + 1.2, 0); }

  spawn() {
    const sprite = new THREE.Sprite(this.mat);
    sprite.scale.setScalar(R * 2.15);
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 2;
    this.scene.add(sprite, shadow);
    const p = this.pts[0];
    this.balls.push({ s: 0, v: 0, free: false, t: 0, pos: new THREE.Vector3(p.x, p.y + R, p.z), vel: new THREE.Vector3(), vy: 0, sprite, shadow, grow: 0 });
  }

  // Point on the path at distance s, and the direction there.
  at(s, out, dir) {
    let i = 1;
    while (i < this.len.length - 1 && this.len[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const k = Math.min(1, (s - this.len[i - 1]) / Math.max(1e-6, this.len[i] - this.len[i - 1]));
    out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
    dir.set(b.x - a.x, 0, b.z - a.z).normalize();
  }

  update(dt, player) {
    this.timer -= dt;
    if (this.timer <= 0 && this.balls.length < 6) { this.timer = this.every; this.spawn(); }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.grow = Math.min(1, b.grow + dt * 3);           // pops into view at the top
      if (!b.free) {
        b.v = Math.min(MAX_SPEED, b.v + ACCEL * dt);
        b.s += b.v * dt;
        if (b.s >= this.total) {
          b.free = true;
          this.at(this.total, P, D);
          b.vel.copy(D).multiplyScalar(b.v);
        } else {
          this.at(b.s, P, D);
          const f = this.floor(P.x, P.z, P.y + 0.5);
          b.pos.set(P.x, (f > -Infinity ? f : P.y) + R, P.z);
        }
      }
      if (b.free) {
        // off the end of the path: keep rolling, fall off whatever's there
        b.t += dt;
        b.pos.x += b.vel.x * dt; b.pos.z += b.vel.z * dt;
        b.vy -= GRAV * dt;
        b.pos.y += b.vy * dt;
        const f = this.floor(b.pos.x, b.pos.z, b.pos.y - R + 0.3);
        if (f > -Infinity && b.pos.y - R < f) { b.pos.y = f + R; b.vy = 0; }
      }
      b.sprite.position.copy(b.pos);
      b.sprite.scale.setScalar(R * 2.15 * b.grow);
      const sf = this.floor(b.pos.x, b.pos.z, b.pos.y);
      b.shadow.visible = sf > -Infinity && b.pos.y - sf < 12;
      if (b.shadow.visible) b.shadow.position.set(b.pos.x, sf + 0.05, b.pos.z);
      // hit the player
      if (player && b.grow > 0.5) {
        const dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z, dy = player.pos.y + 0.8 - b.pos.y;
        if (Math.hypot(dx, dy, dz) < R + 0.6) player.hurt(2, b.pos.x, b.pos.z, 1.6);
      }
      if (b.t > 2.5 || b.pos.y < -20) {
        this.scene.remove(b.sprite, b.shadow);
        this.balls.splice(i, 1);
      }
    }
  }
}

const P = new THREE.Vector3(), D = new THREE.Vector3();
