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
  // --- The wilds ---------------------------------------------------------------------

  // Ashen Peaks: a lean hound of black rock, cracked with glowing embers. Fast,
  // bites twice, and bursts into flame when it dies.
  cinderhound: {
    name: 'Cinderhound', maxHp: 20, atk: 2, windup: 0.35, lunge: 13, recover: 0.55, reach: 1.9, combo: 2,
    speed: 7.6, sight: 16, radius: 0.6, top: 1.5, gait: 'run',
    build() {
      const g = new THREE.Group();
      const rock = new THREE.MeshLambertMaterial({ color: 0x232022, flatShading: true });
      const ember = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.3), rock); body.position.y = 0.85;
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), rock); chest.position.set(0, 0.92, 0.45);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.6), rock); head.position.set(0, 1.12, 0.95);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.45), rock); jaw.position.set(0, 0.92, 1.05);
      for (const x of [-0.14, 0.14]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), rock); ear.position.set(x, 1.4, 0.82); g.add(ear);
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), ember); e.position.set(x, 1.17, 1.26); g.add(e);
      }
      for (const [x, z] of [[0, 0.1], [0.12, -0.3], [-0.1, 0.45]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), ember); c.position.set(0, 0.9 + x, z); c.rotation.z = x * 2; g.add(c); }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 4), ember); tail.position.set(0, 1.05, -0.85); tail.rotation.x = -2.2;
      const legs = [];
      for (const [x, z] of [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.16), rock); l.position.set(x, 0.35, z); g.add(l); legs.push(l);
      }
      g.add(body, chest, head, jaw, tail);
      g.userData.legs = legs;
      return g;
    },
  },

  // Frostveil Pass: a hooded spirit of ice that floats out of reach and throws icicles.
  rimewraith: {
    name: 'Rimewraith', maxHp: 18, atk: 2, windup: 0.6, recover: 0.5, reach: 9, combo: 1,
    speed: 4.2, sight: 20, radius: 0.55, top: 2.6, gait: 'float', ranged: true, cool: 1.8,
    build() {
      const g = new THREE.Group();
      const robe = new THREE.MeshLambertMaterial({ color: 0x4e6c94, transparent: true, opacity: 0.92, flatShading: true });
      const dark = new THREE.MeshBasicMaterial({ color: 0x0c1220 });
      const ice = new THREE.MeshPhongMaterial({ color: 0xd8f0ff, specular: 0xffffff, shininess: 90, flatShading: true, transparent: true, opacity: 0.9 });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.9, 7, 1, true), robe); body.position.y = 1.1; body.rotation.x = Math.PI;
      body.material.side = THREE.DoubleSide;
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), robe); hood.position.y = 2.15; hood.scale.set(1, 1.15, 1);
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), dark); face.position.set(0, 2.1, 0.16);
      const eye = new THREE.MeshBasicMaterial({ color: 0x8ff0ff });
      for (const x of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), eye); e.position.set(x, 2.13, 0.4); g.add(e); }
      const crown = new THREE.Group();
      for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 4), ice); c.position.set(Math.cos(i * 1.256) * 0.5, 2.55, Math.sin(i * 1.256) * 0.5); crown.add(c); }
      for (const x of [-0.55, 0.55]) { const arm = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 5), robe); arm.position.set(x, 1.55, 0.15); arm.rotation.z = -Math.sign(x) * 2.6; g.add(arm); }
      g.add(body, hood, face, crown);
      g.userData.spin = crown;
      return g;
    },
  },

  // Mirefen Marsh: a broad, warty thing that lies under the water with only
  // ripples showing, then heaves up when you come close.
  boglurker: {
    name: 'Bog Lurker', maxHp: 30, atk: 3, windup: 0.55, lunge: 12, recover: 1.0, reach: 2.0, combo: 1,
    speed: 4.6, sight: 14, radius: 0.9, top: 1.5, gait: 'walk', hide: 'water', wake: 7,
    build() {
      const g = new THREE.Group();
      const skin = new THREE.MeshLambertMaterial({ color: 0x3e4a2a, flatShading: true });
      const belly = new THREE.MeshLambertMaterial({ color: 0x6a6a44, flatShading: true });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), skin); body.scale.set(1.25, 0.55, 1.35); body.position.y = 0.6;
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 0.9), belly); jaw.position.set(0, 0.4, 0.95);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.9), skin); top.position.set(0, 0.72, 0.95); top.rotation.x = -0.15;
      const eye = new THREE.MeshBasicMaterial({ color: 0xd8e04a });
      for (const x of [-0.38, 0.38]) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), skin); bulb.position.set(x, 1.0, 0.75); g.add(bulb);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eye); e.position.set(x, 1.06, 0.88); g.add(e);
      }
      for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), belly); w.position.set(Math.cos(i * 1.7) * 0.6, 0.95, Math.sin(i * 1.7) * 0.7 - 0.1); g.add(w); }
      for (const [x, z] of [[-0.75, 0.5], [0.75, 0.5], [-0.75, -0.6], [0.75, -0.6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 6), skin); l.position.set(x, 0.22, z); g.add(l); }
      g.add(body, jaw, top);
      return g;
    },
  },

  // Sunscorch Expanse: a sand-coloured armoured beetle. It burrows, tunnels
  // towards you under the sand, and bursts up beneath you.
  dunescuttler: {
    name: 'Dune Scuttler', maxHp: 26, atk: 3, windup: 0.5, lunge: 11, recover: 0.9, reach: 1.8, combo: 1,
    speed: 5.0, sight: 18, radius: 0.8, top: 1.3, gait: 'scuttle', burrow: true,
    build() {
      const g = new THREE.Group();
      const shell = new THREE.MeshPhongMaterial({ color: 0xa8643a, specular: 0x553322, shininess: 30, flatShading: true });
      const dark = new THREE.MeshLambertMaterial({ color: 0x3a2618, flatShading: true });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), shell); dome.scale.set(1, 0.75, 1.3); dome.position.y = 0.35;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.58, 1.9), dark); seam.position.y = 0.66;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.35), dark); head.position.set(0, 0.42, 0.98);
      for (const x of [-1, 1]) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 4), dark); m.position.set(x * 0.18, 0.4, 1.3); m.rotation.set(Math.PI / 2, 0, x * 0.5); g.add(m); }
      const eye = new THREE.MeshBasicMaterial({ color: 0xffe08a });
      for (const x of [-0.16, 0.16]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eye); e.position.set(x, 0.5, 1.15); g.add(e); }
      const legs = [];
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1, z = -0.5 + (i % 3) * 0.5;
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), dark); l.position.set(side * 0.75, 0.25, z); l.rotation.z = side * 0.6; g.add(l); legs.push(l);
      }
      g.add(dome, seam, head);
      g.userData.legs = legs;
      return g;
    },
  },

  // Emberleaf Woods: a walking stump with a crown of red leaves. It stands
  // perfectly still among the trees until you walk past it.
  barkling: {
    name: 'Barkling', maxHp: 32, atk: 3, windup: 0.6, lunge: 12, recover: 1.0, reach: 2.2, combo: 2,
    speed: 4.4, sight: 13, radius: 0.7, top: 2.6, gait: 'walk', hide: 'stump', wake: 4.5,
    build() {
      const g = new THREE.Group();
      const bark = new THREE.MeshLambertMaterial({ color: 0x5a4430, flatShading: true });
      const leaf = new THREE.MeshLambertMaterial({ color: 0xb8461e, flatShading: true });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.6, 7), bark); body.position.y = 1.15;
      const rings = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 7), new THREE.MeshLambertMaterial({ color: 0xa8865a })); rings.position.y = 1.96;
      const crown = new THREE.Group();
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), i % 2 ? leaf : new THREE.MeshLambertMaterial({ color: 0xd8862a, flatShading: true })); c.position.set(Math.cos(i * 1.6) * 0.3, 2.15 + (i % 2) * 0.15, Math.sin(i * 1.6) * 0.3); crown.add(c); }
      const eyes = new THREE.Group();
      const eye = new THREE.MeshBasicMaterial({ color: 0xffd23a });
      for (const x of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), eye); e.position.set(x, 1.55, 0.55); eyes.add(e); }
      const limbs = [];
      for (const x of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(x * 0.55, 1.6, 0);
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 5), bark); a.position.y = -0.5; a.rotation.z = x * 0.25; arm.add(a);
        const twig = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), bark); twig.position.set(x * 0.15, -1.05, 0.1); twig.rotation.x = 2.6; arm.add(twig);
        g.add(arm); limbs.push(arm);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 5), bark); leg.position.set(x * 0.3, 0.25, 0); g.add(leg); limbs.push(leg);
      }
      g.add(body, rings, crown, eyes);
      g.userData.limbs = limbs; g.userData.eyes = eyes;
      return g;
    },
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
    this.model.traverse((o) => { if (o.material && o.material.emissive && !this.mats.includes(o.material)) this.mats.push(o.material); });
    this.shots = [];
    this.shadow = sh;
    // the ones that lie in wait start hidden
    if (this.kind.hide) this.hideAway(true);
    this.place();
  }

  // Back into hiding: under the water (only ripples showing), or standing
  // still as a stump with its eyes and limbs tucked away.
  hideAway(now) {
    this.set('hidden'); this.hidden = true; this.engaged = false;
    const m = this.model, K = this.kind;
    if (K.hide === 'water') {
      m.position.y = -1.6; this.shadow.visible = false;
      if (!this.ripple) {
        this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 20), new THREE.MeshBasicMaterial({ color: 0xc8d0b0, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
        this.ripple.rotation.x = -Math.PI / 2;
        this.scene.add(this.ripple);
      }
      this.ripple.visible = true;
    } else {
      for (const l of m.userData.limbs) l.scale.setScalar(0.01);
      m.userData.eyes.scale.setScalar(0.01);
      m.position.y = -0.35;
    }
  }

  place() {
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  set(mode) { this.mode = mode; this.mt = 0; }

  glow(r, g, b) { for (const m of this.mats) m.emissive.setRGB(r, g, b); }

  takeHit(dmg, from) {
    if (!this.alive || this.untouchable) return;
    if (this.mode === 'hidden') this.set('emerge');
    this.hp = Math.max(0, this.hp - dmg);
    this.engaged = true;
    this.flash = 0.15;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    const k = this.kind.maxHp > 20 ? 2.5 : 6;
    this.knock.set((dx / d) * k, 0, (dz / d) * k);
    if (this.hp <= 0) {
      this.set('dying'); this.alive = false;
      // it bursts apart: every piece of it goes flying
      if (this.ripple) this.ripple.visible = false;
      if (this.gibs) { this.glow(0, 0, 0); this.model.rotation.set(0, 0, 0); this.gibs.shatter(this.model, new THREE.Vector3(from.x, this.pos.y + 0.4, from.z), this.kind.maxHp > 20 ? 5 : 7); }
      if (this.onDie) this.onDie(this);
      return;
    }
    // big ones only flinch out of a wind-up sometimes
    if (this.mode === 'emerge' || this.mode === 'burrow' || this.mode === 'erupt') return;
    if (this.mode !== 'lunge' && this.mode !== 'windup' && (this.kind.maxHp < 20 ? Math.random() < 0.7 : Math.random() < 0.25)) this.set('stagger');
  }

  update(dt, player, busy) {
    const K = this.kind;
    this.t += dt; this.mt += dt;
    const m = this.model;
    this.updateShots(dt, player);
    if (this.mode === 'dying' && this.gibs) { if (this.mt > 0.1) { this.scene.remove(this.root); this.mode = 'gone'; } return; }
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
    // lying in wait, rising out of hiding, or tunnelling under the sand
    if (this.special(dt, player, d, near)) { this.place(); this.afterPlace(); return; }
    if (!near && this.mode !== 'stagger') { if (this.mode !== 'idle') this.set('idle'); this.engaged = false; }
    // the hiding kind go back into hiding once they've given up on you
    if (K.hide && this.mode === 'idle' && this.mt > 4 && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) < 4) { this.hideAway(); this.place(); this.afterPlace(); return; }
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
        if (K.ranged) {
          // keep its distance: back off if you're close, close in if you're far, drift sideways
          const want = d < 6 ? -1 : d > 11 ? 1 : 0;
          if (want) { this.step(want * K.speed * dt); moving = true; }
          else { const sx = Math.cos(this.yaw) * Math.sin(this.t * 0.7) * K.speed * 0.5 * dt; this.pos.x += sx; moving = true; }
          if (this.mt > K.cool && d < 16) this.set('windup');
          break;
        }
        if (K.burrow && d > 5 && this.mt > 0.8) { this.set('burrow'); break; }
        if (d > K.reach + K.radius) { this.step(K.speed * dt); moving = true; }
        else if (this.mt > 0.25) this.set('windup');
        break;
      case 'windup':
        // crouch, shake and glow: it's about to go
        this.turnTo(Math.atan2(dx, dz), dt * 4);
        m.scale.y = 1 - Math.min(1, this.mt / K.windup) * 0.2;
        m.position.x = Math.sin(this.t * 60) * 0.04;
        if (this.mt > K.windup) {
          if (K.ranged) { this.shoot(player); m.position.x = 0; this.set('recover'); }
          else { this.set('lunge'); this.didHit = false; }
        }
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
    this.afterPlace();
    if (this.flash > 0) this.glow(0.9, 0.9, 0.9);
    else if (this.mode === 'windup') { const k = 0.4 + 0.4 * Math.abs(Math.sin(this.t * 22)); this.glow(k, 0.08, 0.02); }
    else this.glow(0, 0, 0);
    // how it moves: hops, or a waddle
    if (this.mode === 'windup' || this.mode === 'lunge') return;
    if (K.gait === 'float') {
      m.position.y = 0.6 + Math.sin(this.t * 2.2) * 0.15;
      if (m.userData.spin) m.userData.spin.rotation.y += dt * 1.5;
      m.rotation.x = moving ? 0.12 : 0;
    } else if (K.gait === 'run' || K.gait === 'scuttle') {
      const f = K.gait === 'run' ? 14 : 20, legs = m.userData.legs;
      legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(this.t * f + i * (K.gait === 'run' ? Math.PI * (i < 2 ? 1 : 0.5) : 2.1)) * 0.6 : 0; });
      m.position.y = moving && K.gait === 'run' ? Math.abs(Math.sin(this.t * f)) * 0.12 : 0;
    } else if (K.gait === 'hop') {
      const h = moving ? Math.abs(Math.sin(this.t * 9)) : Math.abs(Math.sin(this.t * 2)) * 0.15;
      m.position.y = h * 0.35;
      m.scale.y = 1 + (moving ? (h < 0.2 ? -0.12 : 0.05) : 0);
    } else {
      m.position.y = moving ? Math.abs(Math.sin(this.t * 7)) * 0.08 : 0;
      m.rotation.z = moving ? Math.sin(this.t * 7) * 0.06 : Math.sin(this.t * 1.5) * 0.02;
    }
  }

  // the ripples sit on the water, not on the mud under it
  afterPlace() {
    if (this.ripple && this.ripple.visible) {
      this.ripple.position.set(this.pos.x, Math.max(this.pos.y, this.waterY ?? 0.4) + 0.03, this.pos.z);
      const k = (this.t * 0.6) % 1;
      this.ripple.scale.setScalar(1 + k * 1.6);
      this.ripple.material.opacity = 0.4 * (1 - k);
    }
  }

  // Modes the special kinds have. Returns true if it handled this frame.
  special(dt, player, d, near) {
    const K = this.kind, m = this.model;
    switch (this.mode) {
      case 'hidden':
        // lying in wait: stays put until you come close
        if (K.hide === 'stump') m.rotation.z = 0;
        if (near && d < K.wake) this.set('emerge');
        return true;
      case 'emerge': {
        // heaves up out of the water / shakes itself awake, then comes for you
        const k = Math.min(1, this.mt / 0.7);
        this.turnTo(Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z), dt * 4);
        if (K.hide === 'water') {
          m.position.y = -1.6 + 1.6 * k;
          if (this.mt < dt * 1.5 && this.fx) this.fx.dust(this.pos.clone().setY(this.waterY ?? 0.4), 14);
          if (k >= 1) { this.ripple.visible = false; this.shadow.visible = true; }
        } else {
          m.position.y = -0.35 + 0.35 * k;
          m.rotation.z = Math.sin(this.t * 40) * 0.08 * (1 - k);
          for (const l of m.userData.limbs) l.scale.setScalar(Math.max(0.01, k));
          m.userData.eyes.scale.setScalar(Math.max(0.01, k));
        }
        if (k >= 1) { this.hidden = false; this.engaged = true; m.rotation.z = 0; this.set('chase'); }
        return true;
      }
      case 'burrow': {
        // digs in
        const k = Math.min(1, this.mt / 0.45);
        m.position.y = -1.4 * k;
        if (this.fx && Math.random() < 0.5) this.fx.dust(this.pos, 2);
        if (k >= 1) { this.untouchable = true; this.shadow.visible = false; this.set('tunnel'); }
        return true;
      }
      case 'tunnel': {
        // a trail of churned-up sand racing towards you
        this.turnTo(Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z), dt * 6);
        this.step(9.5 * dt);
        if (this.fx && Math.random() < 0.6) this.fx.dust(this.pos, 2);
        if (d < 1.0 || this.mt > 3) {
          this.set('erupt');
          if (this.telegraph) this.mark = this.telegraph(this.scene, { x: this.pos.x, y: this.pos.y, z: this.pos.z, r: 1.9 });
        }
        return true;
      }
      case 'erupt': {
        // the ground glows red under you... and up it comes
        if (this.mark) this.mark.set(Math.min(1, this.mt / 0.55));
        if (this.mt > 0.55) {
          if (this.mark) { this.mark.remove(); this.mark = null; }
          this.untouchable = false; this.shadow.visible = true;
          m.position.y = 0.4;
          if (this.fx) { this.fx.dust(this.pos, 16); this.fx.shake(0.2); }
          if (d < 1.9 + 0.3 && player.pos.y - this.pos.y < 1.8) player.hurt(K.atk + 1, this.pos.x, this.pos.z, 1.3);
          this.set('recover');
        }
        return true;
      }
    }
    return false;
  }

  // Throw an icicle where you're heading.
  shoot(player) {
    const from = this.pos.clone(); from.y += this.model.position.y + 1.7;
    const lead = new THREE.Vector3(Math.sin(player.yaw) * (player.fwd || 0) * 0.25, 0, Math.cos(player.yaw) * (player.fwd || 0) * 0.25);
    const to = player.pos.clone().add(lead); to.y += 1.0;
    const dir = to.sub(from).normalize();
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 5), new THREE.MeshPhongMaterial({ color: 0xd8f4ff, specular: 0xffffff, shininess: 100, flatShading: true }));
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(mesh);
    this.shots.push({ mesh, vel: dir.multiplyScalar(19), life: 2.5 });
  }

  updateShots(dt, player) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const p = s.mesh.position;
      const hit = player.health > 0 && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 0.7 && p.y > player.pos.y && p.y < player.pos.y + 2;
      if (hit) player.hurt(this.kind.atk, p.x - s.vel.x, p.z - s.vel.z, 0.9);
      if (hit || s.life <= 0 || p.y < this.ground(p.x, p.z)) {
        if (this.fx) this.fx.sparkle(p, 5);
        this.scene.remove(s.mesh);
        this.shots.splice(i, 1);
      }
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
    if (this.ripple) this.scene.remove(this.ripple);
    for (const s of this.shots) this.scene.remove(s.mesh);
    this.shots = [];
  }
}
