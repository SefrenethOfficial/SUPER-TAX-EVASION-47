import * as THREE from 'three';
import { rockTexture } from '../textures.js?v=46';

// ---------------------------------------------------------------------------
// THE HOLLOW THRONE: up a pass in the west wall of the Obsidian Fieldlands, a
// gloomy plateau with a ruined ring of pillars and a throne. The Hollow Warden
// sits there. Step through the wall of fog at the ring's entrance and he rises:
// a real-time boss fight with two phases and its own music. Beat him and the fog clears
// and his blade is yours.
// ---------------------------------------------------------------------------

export const NAME = 'The Hollow Throne';
export const MUSIC = 'boss.mp3';                 // the Warden's song
export const PLATEAU = { x: -215, z: 404, r: 44, y: -8 };
export const ARENA = { x: -220, z: 404, r: 19 };
export const GATE = { x: ARENA.x + ARENA.r + 0.6, z: ARENA.z };   // the fog gate, on the east side

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function contains(x, z) { return Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU.r + 4 || (x < -150 && x > -186 && Math.abs(z - PLATEAU.z) < 9); }

// Carve the western pass and the plateau.
export function withThrone(height) {
  return (x, z) => {
    let h = height(x, z);
    const pm = (1 - smooth(-112, -100, x)) * smooth(-192, -180, x) * (1 - smooth(6, 10, Math.abs(z - PLATEAU.z)));
    h = lerp(h, lerp(-38, PLATEAU.y, smooth(-112, -182, x)) + 0.25 * Math.sin(z * 0.4), pm);
    const pl = 1 - smooth(PLATEAU.r * 0.85, PLATEAU.r, Math.hypot(x - PLATEAU.x, z - PLATEAU.z));
    h = lerp(h, PLATEAU.y + 0.2 * Math.sin(x * 0.3 + z * 0.2), pl);
    return h;
  };
}

// The Warden: a huge knight in blackened armour with a glowing slit for a face
// and an enormous sword.
function wardenModel() {
  const g = new THREE.Group();
  const iron = new THREE.MeshPhongMaterial({ color: 0x2c2c32, specular: 0x55555e, shininess: 30, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x18161a, flatShading: true });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x3a1a1c, side: THREE.DoubleSide, flatShading: true });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.32, 0.26, 1.6, 7), iron, s * 0.42, 0.8, 0);         // legs
    add(new THREE.BoxGeometry(0.5, 0.3, 0.75), dark, s * 0.42, 0.12, 0.1);              // boots
    add(new THREE.SphereGeometry(0.5, 8, 6), iron, s * 0.95, 3.05, 0);                    // pauldrons
    add(new THREE.CylinderGeometry(0.22, 0.2, 1.4, 7), iron, s * 1.05, 2.25, 0.05, 0, 0, s * 0.12);   // arms
  }
  add(new THREE.CylinderGeometry(0.85, 0.62, 1.6, 8), iron, 0, 2.35, 0);                // torso
  add(new THREE.CylinderGeometry(0.66, 0.7, 0.3, 8), dark, 0, 1.55, 0);                 // belt
  const crack = add(new THREE.BoxGeometry(0.12, 0.9, 0.05), ember, 0.15, 2.4, 0.72, 0, 0, 0.3);   // a glowing crack in the chest
  crack.visible = false;
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.75, 8), iron, 0, 3.55, 0);               // helm
  add(new THREE.ConeGeometry(0.44, 0.5, 8), iron, 0, 4.15, 0);
  add(new THREE.BoxGeometry(0.5, 0.07, 0.05), ember, 0, 3.6, 0.44);                      // eye slit
  // cape
  const cape = add(new THREE.PlaneGeometry(1.7, 2.6), cloth, 0, 2.0, -0.7, 0.12);
  // the greatsword, point down at his side
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.2, 0.06), iron); blade.position.y = -1.0;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.08), ember); edge.position.y = -1.0;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.16), dark); guard.position.y = 0.65;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), dark); grip.position.y = 1.0;
  sword.add(blade, edge, guard, grip);
  sword.position.set(1.35, 1.9, 0.5);
  sword.rotation.z = -0.08;
  g.add(sword);
  g.userData = { crack, cape, sword, edge };
  return g;
}

// The fight itself, in real time. He walks you down and picks an attack; each
// one marks the ground red where it will land before it does, so watch the
// floor and get out of it. Below half Health his armour splits and fire pours
// out: he adds a ring of flame that rolls outward (jump it) and a rain of
// embers (keep moving).
const ATTACKS1 = ['slam', 'slam', 'sweep', 'sweep', 'leap'];
const ATTACKS2 = ['slam', 'sweep', 'leap', 'ring', 'ring', 'embers', 'embers'];
export class Warden {
  constructor(model, { scene, G, telegraph, fx }) {
    this.model = model; this.scene = scene; this.G = G; this.telegraph = telegraph; this.fx = fx;
    this.name = 'Hollow Warden';
    this.boss = true;
    this.pos = model.position;            // moves the model directly
    this.radius = 1.3; this.height = 4.2;
    this.maxHp = 90; this.hp = this.maxHp;
    this.alive = true; this.engaged = false;
    this.phase = 1;
    this.mode = 'wait'; this.mt = 0; this.yaw = model.rotation.y;
    this.marks = [];
    this.mats = [];
    model.traverse((o) => { if (o.material && o.material.emissive) this.mats.push(o.material); });
    this.last = '';
  }

  start() { this.engaged = true; this.set('walk'); }
  set(m) { this.mode = m; this.mt = 0; }
  clearMarks() { for (const m of this.marks) m.remove(); this.marks = []; }

  takeHit(dmg) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.12;
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.model.userData.crack.visible = true;
      this.model.userData.edge.material = new THREE.MeshBasicMaterial({ color: 0xffd060 });
      this.fx.explode(this.pos.clone().setY(this.pos.y + 2.5));
      if (this.onPhase) this.onPhase();
      this.clearMarks();
      this.set('roar');
    }
    if (this.hp <= 0) { this.alive = false; this.clearMarks(); this.set('dying'); if (this.onDie) this.onDie(); }
  }

  // hurt you if you're within r of (x, z) and (unless air is allowed) on the ground
  zone(P, x, z, r, dmg, { inner = 0, arc = 0, yaw = 0, jumpable = false } = {}) {
    const dx = P.pos.x - x, dz = P.pos.z - z, d = Math.hypot(dx, dz);
    if (d > r || d < inner) return false;
    if (arc) { const a = Math.atan2(dx, dz) - yaw; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > arc / 2) return false; }
    const lift = P.pos.y - this.G(P.pos.x, P.pos.z);
    if (lift > (jumpable ? 0.7 : 2.4)) return false;
    return P.hurt(dmg, x, z, dmg >= 4 ? 1.6 : 1.1);
  }

  pick() {
    const list = this.phase === 1 ? ATTACKS1 : ATTACKS2;
    let a;
    do a = list[Math.floor(Math.random() * list.length)]; while (a === this.last && Math.random() < 0.7);
    this.last = a;
    return a;
  }

  update(dt, P) {
    this.t = (this.t || 0) + dt; this.mt += dt;
    const ud = this.model.userData, sw = ud.sword, m = this.model;
    const y = PLATEAU.y;
    this.flash = Math.max(0, (this.flash || 0) - dt);
    for (const mat of this.mats) mat.emissive.setScalar(this.flash > 0 ? 0.7 : 0);
    if (this.mode === 'dying') {
      // falls to his knees and crumbles into embers
      m.position.y = y - Math.min(1.2, this.mt * 0.8);
      m.rotation.x = Math.min(0.5, this.mt * 0.4);
      if (Math.floor(this.mt * 8) !== Math.floor((this.mt - dt) * 8)) this.fx.sparkle(this.pos.clone().setY(y + 1 + Math.random() * 3), 6);
      return;
    }
    if (!this.engaged || !this.alive) return;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const face = (k) => { const want = Math.atan2(dx, dz); this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * k); };
    const fwd = (s) => {
      this.pos.x += Math.sin(this.yaw) * s; this.pos.z += Math.cos(this.yaw) * s;
      const ox = this.pos.x - ARENA.x, oz = this.pos.z - ARENA.z, od = Math.hypot(ox, oz), lim = ARENA.r - 2.5;
      if (od > lim) { this.pos.x = ARENA.x + (ox / od) * lim; this.pos.z = ARENA.z + (oz / od) * lim; }
    };
    const ahead = (k) => [this.pos.x + Math.sin(this.yaw) * k, this.pos.z + Math.cos(this.yaw) * k];
    const k01 = (a, b) => Math.max(0, Math.min(1, (this.mt - a) / (b - a)));
    const fast = this.phase === 2 ? 0.8 : 1;       // he's quicker when he's burning
    switch (this.mode) {
      case 'roar':
        sw.rotation.x = 2.6 * Math.min(1, this.mt * 3);
        if (this.mt < dt * 2) this.fx.shake(0.5);
        if (this.mt > 1.6) this.set('walk');
        break;
      case 'walk': {
        face(4);
        sw.rotation.x += (0 - sw.rotation.x) * Math.min(1, dt * 6);
        sw.rotation.y = 0;
        m.rotation.z = Math.sin(this.t * 5) * 0.03;
        if (d > 4.2) fwd((this.phase === 2 ? 4.2 : 3.4) * dt);
        // a beat between attacks, then choose one
        if (this.mt > 0.9 * fast || (d < 4.5 && this.mt > 0.4)) {
          const a = this.pick();
          if (a === 'slam' && d > 7) { if (this.mt > 2.5) this.set('leap'); break; }
          if (a === 'sweep' && d > 6.5) { if (this.mt > 2.5) this.set('leap'); break; }
          this.set(a);
        }
        break;
      }
      case 'slam': {
        // raise the sword high... and bring it straight down in front of him
        const W = 1.0 * fast;
        if (this.mt < W) face(3);
        const [x, z] = ahead(3.2);
        if (this.mt < dt * 1.5) this.marks.push(this.telegraph(this.scene, { x, y, z, r: 2.4 }));
        if (this.marks[0]) { this.marks[0].mesh.position.set(x, y + 0.08, z); this.marks[0].set(k01(0, W)); }
        sw.rotation.x = this.mt < W ? 2.6 * k01(0, W * 0.6) : 2.6 - 4.0 * k01(W, W + 0.12);
        if (this.mt >= W && !this.struck) {
          this.struck = true; this.clearMarks();
          this.fx.shake(0.45); this.fx.dust(new THREE.Vector3(x, y, z), 14);
          this.zone(P, x, z, 2.5, 3);
        }
        if (this.mt > W + 1.1) { this.struck = false; this.set('walk'); }
        break;
      }
      case 'sweep': {
        // the blade held out to one side, then swept round in front of him
        const W = 0.8 * fast;
        if (this.mt < W) face(3);
        if (this.mt < dt * 1.5) this.marks.push(this.telegraph(this.scene, { x: this.pos.x, y, z: this.pos.z, r: 5, inner: 0.5, arc: 2.6, yaw: this.yaw }));
        if (this.marks[0]) { this.marks[0].mesh.position.set(this.pos.x, y + 0.08, this.pos.z); this.marks[0].mesh.rotation.z = this.yaw - Math.PI / 2; this.marks[0].set(k01(0, W)); }
        sw.rotation.x = -1.5 * k01(0, 0.3);
        sw.rotation.y = this.mt < W ? 1.3 * k01(0, W * 0.7) : 1.3 - 2.8 * k01(W, W + 0.2);
        if (this.mt >= W + 0.08 && !this.struck) {
          this.struck = true; this.clearMarks();
          this.zone(P, this.pos.x, this.pos.z, 5, 2, { arc: 2.6, yaw: this.yaw, jumpable: true });
        }
        if (this.mt > W + 0.9) { this.struck = false; this.set('walk'); }
        break;
      }
      case 'leap': {
        // crouch, jump, and come down where you were standing
        const W = 0.6, AIR = 0.9;
        if (this.mt < W) {
          face(6);
          m.scale.y = 0.92 * (1 - 0.15 * k01(0, W));
          if (!this.to) { this.to = new THREE.Vector3(P.pos.x, y, P.pos.z); this.from = this.pos.clone(); }
          this.to.x += (P.pos.x - this.to.x) * Math.min(1, dt * 4); this.to.z += (P.pos.z - this.to.z) * Math.min(1, dt * 4);
          if (!this.marks[0]) this.marks.push(this.telegraph(this.scene, { x: this.to.x, y, z: this.to.z, r: 3.4 }));
          this.marks[0].mesh.position.set(this.to.x, y + 0.08, this.to.z);
          this.marks[0].set(k01(0, W + AIR));
          this.from.copy(this.pos);
        } else if (this.mt < W + AIR) {
          m.scale.y = 0.92;
          const k = k01(W, W + AIR);
          this.pos.x = this.from.x + (this.to.x - this.from.x) * k;
          this.pos.z = this.from.z + (this.to.z - this.from.z) * k;
          this.pos.y = y + Math.sin(k * Math.PI) * 7;
          sw.rotation.x = 2.6 * k;
          if (this.marks[0]) this.marks[0].set(k01(0, W + AIR));
        } else if (!this.struck) {
          this.struck = true; this.pos.y = y; this.clearMarks();
          sw.rotation.x = -1.4;
          this.fx.shake(0.6); this.fx.ring(this.pos); this.fx.dust(this.pos, 20);
          this.zone(P, this.pos.x, this.pos.z, 3.5, 4);
        }
        if (this.mt > W + AIR + 1.2) { this.struck = false; this.to = null; this.set('walk'); }
        break;
      }
      case 'ring': {
        // plants the sword: a ring of fire rolls out across the arena
        const W = 0.9;
        sw.rotation.x = this.mt < W ? 2.6 * k01(0, W * 0.6) : -1.6;
        if (this.mt < dt * 1.5) this.marks.push(this.telegraph(this.scene, { x: this.pos.x, y, z: this.pos.z, r: 2.0 }));
        if (this.marks[0] && this.mt < W) this.marks[0].set(k01(0, W));
        if (this.mt >= W && !this.fire) {
          this.clearMarks();
          this.fx.shake(0.4);
          const geo = new THREE.TorusGeometry(1, 0.06, 6, 64);
          const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.95 }));
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(this.pos.x, y + 0.3, this.pos.z);
          mesh.scale.set(1, 1, 6);     // a low wall
          this.scene.add(mesh);
          this.fire = { mesh, r: 1, hit: false, x: this.pos.x, z: this.pos.z };
        }
        if (this.fire) {
          const f = this.fire;
          f.r += dt * 8;
          f.mesh.scale.set(f.r, f.r, 6);
          f.mesh.material.opacity = Math.max(0, 0.95 - Math.max(0, f.r - 22) / 6);
          if (!f.hit) f.hit = this.zone(P, f.x, f.z, f.r + 0.45, 2, { inner: f.r - 0.45, jumpable: true });
          if (f.r > 28) { this.scene.remove(f.mesh); this.fire = null; this.set('walk'); }
        }
        break;
      }
      case 'embers': {
        // raises the blade and embers fall in burning circles round you
        sw.rotation.x = 2.8;
        if (this.mt < dt * 1.5) {
          this.drops = [];
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * 6.3, r = i === 0 ? 0 : 2 + Math.random() * 5;
            const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
            this.drops.push({ x, z, at: 0.9 + i * 0.18, done: false, mark: this.telegraph(this.scene, { x, y, z, r: 1.8 }) });
          }
        }
        for (const dr of this.drops) {
          if (dr.done) continue;
          dr.mark.set(Math.min(1, this.mt / dr.at));
          if (this.mt >= dr.at) {
            dr.done = true; dr.mark.remove();
            this.fx.explode(new THREE.Vector3(dr.x, y + 0.3, dr.z));
            this.zone(P, dr.x, dr.z, 1.9, 3);
          }
        }
        if (this.mt > 2.6) { this.drops = []; this.set('walk'); }
        break;
      }
    }
    if (this.mode !== 'leap') { this.pos.y = y; m.scale.y = 0.92 * (1 + Math.sin(this.t * 1.6) * 0.008); }
    m.rotation.y = this.yaw;
  }

  remove() {
    this.clearMarks();
    if (this.fire) { this.scene.remove(this.fire.mesh); this.fire = null; }
    for (const dr of this.drops || []) if (!dr.done) dr.mark.remove();
  }
}

// Build the plateau: the ring of pillars, the throne, braziers, the fog gate,
// and the Warden. ctx: { scene, G, box, rng }
export function build(ctx) {
  const { scene, G, box, rng } = ctx;
  const stoneMat = new THREE.MeshLambertMaterial({ map: rockTexture(), color: 0x8a8680 });
  const y = PLATEAU.y;
  // ruined ring: pillars, some broken short, with low walls between
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.25) continue;   // the gap where the gate is
    const x = ARENA.x + Math.cos(a) * ARENA.r, z = ARENA.z + Math.sin(a) * ARENA.r;
    const h = rng() < 0.35 ? 1.5 + rng() * 2 : 6 + rng() * 2;
    box([x - 0.8, y - 1, z - 0.8], [x + 0.8, y + h, z + 0.8], stoneMat);
    // a wall to the next pillar
    const a2 = ((i + 1) / N) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a2), Math.cos(a2))) < 0.25) continue;
    const steps = 6;
    for (let k = 1; k < steps; k++) {
      const aa = a + ((a2 - a) * k) / steps, wx = ARENA.x + Math.cos(aa) * ARENA.r, wz = ARENA.z + Math.sin(aa) * ARENA.r;
      box([wx - 0.7, y - 1, wz - 0.7], [wx + 0.7, y + 2.4 + rng() * 0.6, wz + 0.7], stoneMat);
    }
  }
  // the throne, at the far side
  const tx = ARENA.x - ARENA.r + 4.5;
  box([tx - 2.2, y - 1, ARENA.z - 2.4], [tx + 1.8, y + 0.6, ARENA.z + 2.4], stoneMat);       // dais
  box([tx - 2.0, y + 0.6, ARENA.z - 1.4], [tx - 0.9, y + 5.5, ARENA.z + 1.4], stoneMat);     // back
  box([tx - 0.9, y + 0.6, ARENA.z - 1.4], [tx + 0.9, y + 1.6, ARENA.z + 1.4], stoneMat);     // seat
  for (const s of [-1, 1]) box([tx - 0.9, y + 1.6, ARENA.z + s * 1.4 - 0.25], [tx + 0.9, y + 2.4, ARENA.z + s * 1.4 + 0.25], stoneMat);
  // braziers either side of the entrance and the throne
  const braziers = [];
  for (const [bx, bz] of [[GATE.x - 1.5, GATE.z - 4.5], [GATE.x - 1.5, GATE.z + 4.5], [tx + 2.5, ARENA.z - 4], [tx + 2.5, ARENA.z + 4]]) {
    box([bx - 0.4, y - 0.5, bz - 0.4], [bx + 0.4, y + 1.3, bz + 0.4], stoneMat);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
    f.position.set(bx, y + 1.7, bz);
    scene.add(f);
    const l = new THREE.PointLight(0xff8a3a, 14, 18, 1.6);
    l.position.set(bx, y + 2.4, bz);
    scene.add(l);
    braziers.push({ f, l });
  }

  // the fog gate: a wall of slowly swirling mist you can't walk through until
  // you choose to step into it
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g2 = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128, yy = Math.random() * 128, r = 10 + Math.random() * 26;
    const gr = g2.createRadialGradient(x, yy, 0, x, yy, r);
    gr.addColorStop(0, 'rgba(235,235,240,0.35)'); gr.addColorStop(1, 'rgba(235,235,240,0)');
    g2.fillStyle = gr;
    for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { g2.beginPath(); g2.arc(x + dx, yy + dy, r, 0, Math.PI * 2); g2.fill(); }
  }
  const fogTex = new THREE.CanvasTexture(c);
  fogTex.wrapS = fogTex.wrapT = THREE.RepeatWrapping;
  const fogMat = new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, color: 0xe8e8f0 });
  const fogWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fogMat);
  fogWall.position.set(GATE.x, y + 3, GATE.z);
  fogWall.rotation.y = Math.PI / 2;
  scene.add(fogWall);
  const fogWall2 = fogWall.clone(); fogWall2.material = fogMat.clone(); fogWall2.position.x += 0.25;
  scene.add(fogWall2);
  const gateBox = box([GATE.x - 0.3, y - 1, GATE.z - 3], [GATE.x + 0.3, y + 6, GATE.z + 3], stoneMat, { visible: false });

  // the Warden, seated
  const warden = wardenModel();
  const seatPos = new THREE.Vector3(tx + 0.2, y + 0.55, ARENA.z);
  const standPos = new THREE.Vector3(ARENA.x - 6, y, ARENA.z);
  warden.position.copy(seatPos);
  warden.rotation.y = Math.PI / 2;     // facing the entrance (+x)
  warden.scale.setScalar(0.92);
  scene.add(warden);

  let t = 0, rise = 0, risen = false;
  return {
    warden, standPos, gateBox, fogWall, fogWall2,
    gateIn: new THREE.Vector3(GATE.x - 3.5, y, GATE.z),      // where you step to through the fog
    playerSpot: new THREE.Vector3(ARENA.x + 7, y, ARENA.z),
    rise() { risen = true; },
    // the fog closes behind you once you're in
    sealGate() { fogWall.visible = fogWall2.visible = true; gateBox.min.set(GATE.x - 0.3, y - 1, GATE.z - 3); gateBox.max.set(GATE.x + 0.3, y + 6, GATE.z + 3); },
    passGate() { gateBox.min.set(9999, 9999, 9999); gateBox.max.set(9999, 9999, 9999); },
    openGate() {
      fogWall.visible = fogWall2.visible = false;
      gateBox.min.set(9999, 9999, 9999); gateBox.max.set(9999, 9999, 9999);
      if (gateBox.mesh) gateBox.mesh.visible = false;
    },
    remove() { scene.remove(warden); },
    update(dt) {
      t += dt;
      fogTex.offset.set(t * 0.02, t * 0.05);
      fogWall2.material.map.offset.set(-t * 0.03, t * 0.04);
      for (const b of braziers) { b.l.intensity = 12 + Math.sin(t * 12 + b.f.position.x) * 2.5; b.f.scale.y = 1 + Math.sin(t * 10 + b.f.position.z) * 0.15; }
      // rising from the throne and stepping down
      if (risen && rise < 1 && !this.fighting) {
        rise = Math.min(1, rise + dt / 2.2);
        const k = rise * rise * (3 - 2 * rise);
        warden.position.lerpVectors(seatPos, standPos, k);
        warden.position.y += Math.sin(k * Math.PI) * 0.6;
      }
      const ud = warden.userData;
      ud.cape.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.05;
      if (rise >= 1) warden.scale.y = 0.92 * (1 + Math.sin(t * 1.6) * 0.008);
    },
    get standing() { return rise >= 1; },
  };
}
