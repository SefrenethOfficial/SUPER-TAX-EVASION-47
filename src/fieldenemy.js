import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Enemies you meet out in the world. They wander near where they live, chase
// you when you come close, and touching one starts a turn-based battle with it.
// Beaten ones are gone; run away and they leave you be for a few seconds.
// ---------------------------------------------------------------------------

const glass = () => new THREE.MeshPhongMaterial({ color: 0x17151d, specular: 0x8f86c8, shininess: 110, flatShading: true });

// The kinds of enemy: how they look, move and fight.
export const KINDS = {
  // a little hopping shard of obsidian with glowing eyes
  shardling: {
    name: 'Shardling', maxHp: 8, maxSp: 4, atk: 2, attackText: 'slashes at you with a glassy edge',
    speed: 5.2, sight: 11, radius: 0.55, top: 1.9,
    picture: { height: 0.75, dist: 2.2 },
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
    name: 'Thornback', maxHp: 15, maxSp: 5, atk: 3, attackText: 'charges into you',
    speed: 4.2, sight: 13, radius: 0.95, top: 2.4,
    picture: { height: 1.0, dist: 3.2 },
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
    this.cool = 0;                 // after you run away, it leaves you alone for a bit
    this.alive = true;
    this.place();
  }

  place() {
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  // returns true when it touches you
  update(dt, player, busy) {
    if (!this.alive) return false;
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
    const K = this.kind;
    let moving = false;
    if (!busy) {
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      const sees = d < K.sight && Math.abs(player.pos.y - this.pos.y) < 4 && this.cool <= 0 && !player.locked;
      if (sees) {
        // chase
        this.turnTo(Math.atan2(dx, dz), dt * 6);
        const sp = K.speed;
        this.pos.x += Math.sin(this.yaw) * sp * dt; this.pos.z += Math.cos(this.yaw) * sp * dt;
        moving = true;
        if (d < K.radius + 0.7) return true;
      } else {
        // wander near home
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
          this.pos.x += Math.sin(this.yaw) * 1.6 * dt; this.pos.z += Math.cos(this.yaw) * 1.6 * dt;
          moving = true;
        }
      }
      this.place();
    }
    // how it moves: hops, or a waddle
    const m = this.model;
    if (K.gait === 'hop') {
      const h = moving ? Math.abs(Math.sin(this.t * 9)) : Math.abs(Math.sin(this.t * 2)) * 0.15;
      m.position.y = h * 0.35;
      m.scale.y = 1 + (moving ? (h < 0.2 ? -0.12 : 0.05) : 0);
    } else {
      m.position.y = moving ? Math.abs(Math.sin(this.t * 7)) * 0.08 : 0;
      m.rotation.z = moving ? Math.sin(this.t * 7) * 0.06 : Math.sin(this.t * 1.5) * 0.02;
    }
    return false;
  }

  turnTo(want, k) {
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, k);
  }

  // Battle stats for this enemy, fighting from where it is now.
  fighter(facing) {
    const K = this.kind;
    return { name: K.name, maxHp: K.maxHp, maxSp: K.maxSp, atk: K.atk, attackText: K.attackText, model: this.model, top: K.top,
      picture: { ...K.picture, yaw: facing } };
  }

  remove() {
    this.alive = false;
    this.scene.remove(this.root);
  }
}
