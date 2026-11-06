import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Enemies you meet out in the world. They wander near where they live, chase
// you when you come close, and fight in real time: they wind up (they flash
// and crouch, so you can see it coming), lunge, and need a moment to recover,
// which is your opening. Hit them and they stagger back.
// ---------------------------------------------------------------------------

const glass = () => new THREE.MeshPhongMaterial({ color: 0x17151d, specular: 0x8f86c8, shininess: 110, flatShading: true });

// The kinds of enemy: how they look, move and fight.
export const KINDS = {
  // a little hopping shard of obsidian with glowing eyes
  shardling: {
    name: 'Shardling', maxHp: 16, atk: 2, windup: 0.4, lunge: 10, recover: 0.6, reach: 1.7, combo: 2,
    speed: 6.2, sight: 13, radius: 0.55, top: 1.9,
    build() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), glass());
      body.scale.set(0.9, 1.35, 0.9); body.position.y = 0.85;
      const eye = new THREE.MeshBasicMaterial({ color: 0xc9a2ff });
      for (const x of [-0.16, 0.16]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eye); e.position.set(x, 0.98, 0.42); g.add(e); }
      // little shard spikes on top and stubby legs
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), glass());
        s.position.set(Math.cos(i * 2.1) * 0.18, 1.55, Math.sin(i * 2.1) * 0.18 - 0.05); s.rotation.set(Math.sin(i * 2.1) * 0.4, 0, -Math.cos(i * 2.1) * 0.4);
        g.add(s);
      }
      for (const [x, z] of [[-0.25, 0.2], [0.25, 0.2], [-0.25, -0.2], [0.25, -0.2]]) {
        const l = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), glass()); l.rotation.x = Math.PI; l.position.set(x, 0.2, z); g.add(l);
      }
      g.add(body);
      return g;
    },
    gait: 'hop',
  },
  // a mossy, round grazer with obsidian spines down its back
  thornback: {
    name: 'Thornback', maxHp: 34, atk: 3, windup: 0.6, lunge: 15, recover: 0.95, reach: 2.6, combo: 1,
    speed: 5.0, sight: 15, radius: 0.95, top: 2.4,
    build() {
      const g = new THREE.Group();
      const moss = new THREE.MeshLambertMaterial({ color: 0x4f6a3a, flatShading: true });
      const dark = new THREE.MeshLambertMaterial({ color: 0x3a3228, flatShading: true });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), moss);
      body.scale.set(1.0, 0.75, 1.3); body.position.y = 0.95;
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), moss); head.position.set(0, 0.85, 1.15);
      const eye = new THREE.MeshBasicMaterial({ color: 0xff5a3a });
      for (const x of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eye); e.position.set(x, 0.98, 1.5); g.add(e); }
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7 - Math.abs(i - 2.5) * 0.08, 5), glass());
        s.position.set((i % 2 ? 0.15 : -0.15), 1.55, -0.75 + i * 0.3); s.rotation.x = -0.35;
        g.add(s);
      }
      for (const [x, z] of [[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.6], [0.5, -0.6]]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.5, 6), dark); l.position.set(x, 0.25, z); g.add(l);
      }
      g.add(body, head);
      return g;
    },
    gait: 'walk',
  },
};

export class FieldEnemy {
  constructor(scene, kind, pos, ground) {
    this.kind = KINDS[kind];
    this.ground = ground;
    this.scene = scene;
    this.model = this.kind.build();
    this.root = new THREE.Group();
    this.root.add(this.model);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(this.kind.radius * 1.1, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.renderOrder = 2;
    this.root.add(sh);
    scene.add(this.root);
    this.home = new THREE.Vector3(pos.x, 0, pos.z);
    this.pos = this.home.clone();
    this.target = this.home.clone();
    this.yaw = Math.random() * 6.3;
    this.t = Math.random() * 10;
    this.wait = Math.random() * 2;
    this.name = this.kind.name;
    this.radius = this.kind.radius;
    this.height = this.kind.top * 0.7;
    this.maxHp = this.kind.maxHp; this.hp = this.maxHp;
    this.alive = true;
    this.engaged = false;     // it's after you
    this.mode = 'idle';       // idle | chase | windup | lunge | recover | stagger | dying
    this.mt = 0;
    this.knock = new THREE.Vector3();
    // everything on it flashes white when hit, red while winding up
    this.mats = [];
    this.model.traverse((o) => { if (o.material && o.material.emissive) this.mats.push(o.material); });
    this.place();
  }

  place() {
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  set(mode) { this.mode = mode; this.mt = 0; }

  glow(r, g, b) { for (const m of this.mats) m.emissive.setRGB(r, g, b); }

  takeHit(dmg, from) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.engaged = true;
    this.flash = 0.15;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    const k = this.kind.maxHp > 20 ? 2.5 : 6;
    this.knock.set((dx / d) * k, 0, (dz / d) * k);
    if (this.hp <= 0) { this.set('dying'); this.alive = false; if (this.onDie) this.onDie(this); return; }
    // big ones only flinch out of a wind-up sometimes
    if (this.mode !== 'lunge' && this.mode !== 'windup' && (this.kind.maxHp < 20 ? Math.random() < 0.7 : Math.random() < 0.25)) this.set('stagger');
  }

  update(dt, player, busy) {
    const K = this.kind;
    this.t += dt; this.mt += dt;
    const m = this.model;
    if (this.mode === 'dying') {
      // tips over, sinks and fades
      m.rotation.x = Math.min(1.4, this.mt * 4);
      m.position.y = -this.mt * 0.6;
      this.root.scale.setScalar(Math.max(0.01, 1 - this.mt * 0.8));
      this.glow(0.6, 0.5, 0.9);
      this.pos.addScaledVector(this.knock, dt); this.knock.multiplyScalar(0.9);
      this.root.position.copy(this.pos);
      if (this.mt > 1.2) { this.scene.remove(this.root); this.mode = 'gone'; }
      return;
    }
    if (!this.alive) return;
    let moving = false;
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const near = Math.abs(player.pos.y - this.pos.y) < 4 && !player.locked && !busy && player.health > 0;
    if (!near && this.mode !== 'stagger') { if (this.mode !== 'idle') this.set('idle'); this.engaged = false; }
    // stop chasing when you get far enough away or it strays too far from home
    if (this.engaged && (d > K.sight * 2.2 || Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 40)) { this.engaged = false; this.set('idle'); }
    if (this.mode === 'idle' && near && d < K.sight) { this.engaged = true; this.set('chase'); }

    this.flash = Math.max(0, (this.flash || 0) - dt);
    switch (this.mode) {
      case 'idle': {
        const tx = this.target.x - this.pos.x, tz = this.target.z - this.pos.z, td = Math.hypot(tx, tz);
        if (td < 0.5) {
          this.wait -= dt;
          if (this.wait <= 0) {
            const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
            this.target.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
            this.wait = 1 + Math.random() * 2.5;
          }
        } else {
          this.turnTo(Math.atan2(tx, tz), dt * 3);
          this.step(1.6 * dt);
          moving = true;
        }
        break;
      }
      case 'chase':
        this.turnTo(Math.atan2(dx, dz), dt * 7);
        if (d > K.reach + K.radius) { this.step(K.speed * dt); moving = true; }
        else if (this.mt > 0.25) this.set('windup');
        break;
      case 'windup':
        // crouch, shake and glow: it's about to go
        this.turnTo(Math.atan2(dx, dz), dt * 4);
        m.scale.y = 1 - Math.min(1, this.mt / K.windup) * 0.2;
        m.position.x = Math.sin(this.t * 60) * 0.04;
        if (this.mt > K.windup) { this.set('lunge'); this.didHit = false; }
        break;
      case 'lunge': {
        const go = Math.max(0, 1 - this.mt / 0.25);
        this.step(K.lunge * go * dt);
        m.scale.y = 1.08;
        // one hit per lunge, if you're in front of it and not in the air above
        if (!this.didHit && d < K.radius + 0.75 && player.pos.y - this.pos.y < 1.6) {
          this.didHit = true;
          player.hurt(K.atk, this.pos.x, this.pos.z, K.maxHp > 20 ? 1.4 : 0.95);
        }
        if (this.mt > 0.3) {
          // quick ones go again straight away, now and then
          this.chain = (this.chain || 0) + 1;
          if (this.chain < K.combo && d < K.reach + K.radius + 1.5) { this.set('windup'); this.mt = K.windup * 0.45; }
          else { this.chain = 0; this.set('recover'); }
        }
        break;
      }
      case 'recover':
        m.scale.y = 1; m.position.x = 0;
        if (this.mt > K.recover) this.set('chase');
        break;
      case 'stagger':
        m.scale.y = 1; m.position.x = 0;
        m.rotation.x = -Math.max(0, 0.4 - this.mt) ;
        if (this.mt > 0.45) { m.rotation.x = 0; this.set('chase'); }
        break;
    }
    // being knocked back
    if (this.knock.lengthSq() > 0.01) {
      this.pos.x += this.knock.x * dt; this.pos.z += this.knock.z * dt;
      this.knock.multiplyScalar(Math.pow(0.02, dt));
    }
    this.place();
    if (this.flash > 0) this.glow(0.9, 0.9, 0.9);
    else if (this.mode === 'windup') { const k = 0.4 + 0.4 * Math.abs(Math.sin(this.t * 22)); this.glow(k, 0.08, 0.02); }
    else this.glow(0, 0, 0);
    // how it moves: hops, or a waddle
    if (this.mode === 'windup' || this.mode === 'lunge') return;
    if (K.gait === 'hop') {
      const h = moving ? Math.abs(Math.sin(this.t * 9)) : Math.abs(Math.sin(this.t * 2)) * 0.15;
      m.position.y = h * 0.35;
      m.scale.y = 1 + (moving ? (h < 0.2 ? -0.12 : 0.05) : 0);
    } else {
      m.position.y = moving ? Math.abs(Math.sin(this.t * 7)) * 0.08 : 0;
      m.rotation.z = moving ? Math.sin(this.t * 7) * 0.06 : Math.sin(this.t * 1.5) * 0.02;
    }
  }

  step(s) {
    const nx = this.pos.x + Math.sin(this.yaw) * s, nz = this.pos.z + Math.cos(this.yaw) * s;
    // don't walk off cliffs or up walls
    const h = this.ground(nx, nz);
    if (Math.abs(h - this.pos.y) > Math.max(0.6, Math.abs(s) * 1.5)) return;
    this.pos.x = nx; this.pos.z = nz;
  }

  turnTo(want, k) {
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, k);
  }

  remove() {
    this.alive = false;
    this.mode = 'gone';
    this.scene.remove(this.root);
  }
}
