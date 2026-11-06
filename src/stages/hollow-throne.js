import * as THREE from 'three';
import { rockTexture } from '../textures.js?v=51';

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

// The Warden: a huge knight in blackened armour with a glowing slit for a face,
// horns on his helm and an enormous two-handed sword. He's built as a rig of
// joints (hips, torso, head, shoulders, elbows, hips, knees, sword) so he can
// be posed and animated.
function wardenModel() {
  const g = new THREE.Group();
  const iron = new THREE.MeshPhongMaterial({ color: 0x34343b, specular: 0x6a6a76, shininess: 40, flatShading: true });
  const trim = new THREE.MeshPhongMaterial({ color: 0x5a4a32, specular: 0x9a8050, shininess: 60, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x18161a, flatShading: true });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x3a1a1c, side: THREE.DoubleSide, flatShading: true });
  const J = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const M = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  const hips = J(g, 0, HIP_Y, 0);
  M(hips, new THREE.CylinderGeometry(0.68, 0.72, 0.36, 8), dark, 0, 0, 0);                         // belt
  M(hips, new THREE.BoxGeometry(0.34, 0.26, 0.12), trim, 0, 0.02, 0.7);                              // buckle
  for (const s of [-1, 0, 1]) M(hips, new THREE.BoxGeometry(0.46, 0.66, 0.08), iron, s * 0.44, -0.4, 0.58 - Math.abs(s) * 0.18, 0.12, -s * 0.45, 0);   // tassets
  const leg = (s) => {
    const th = J(hips, s * 0.38, -0.12, 0);
    M(th, new THREE.CylinderGeometry(0.3, 0.25, 0.9, 7), iron, 0, -0.45, 0);
    M(th, new THREE.SphereGeometry(0.25, 7, 5), trim, 0, -0.9, 0.08);                                // knee cop
    const kn = J(th, 0, -0.9, 0);
    M(kn, new THREE.CylinderGeometry(0.24, 0.19, 0.72, 7), iron, 0, -0.38, 0);
    M(kn, new THREE.BoxGeometry(0.46, 0.26, 0.8), dark, 0, -0.74, 0.12);                             // sabaton
    return [th, kn];
  };
  const [thL, knL] = leg(-1), [thR, knR] = leg(1);
  const torso = J(hips, 0, 0.16, 0);
  M(torso, new THREE.CylinderGeometry(0.9, 0.62, 1.5, 8), iron, 0, 0.75, 0);                         // breastplate
  M(torso, new THREE.BoxGeometry(0.16, 1.2, 0.1), trim, 0, 0.8, 0.82, -0.12);                        // a ridge down the front
  const crack = M(torso, new THREE.BoxGeometry(0.12, 0.9, 0.05), ember, 0.22, 0.85, 0.8, -0.1, 0, 0.3);   // a glowing crack in the chest
  crack.visible = false;
  M(torso, new THREE.CylinderGeometry(0.46, 0.58, 0.26, 8), dark, 0, 1.55, 0);                       // gorget
  const head = J(torso, 0, 1.62, 0);
  M(head, new THREE.CylinderGeometry(0.4, 0.45, 0.74, 8), iron, 0, 0.37, 0);                         // helm
  M(head, new THREE.ConeGeometry(0.42, 0.42, 8), iron, 0, 0.94, 0);
  M(head, new THREE.BoxGeometry(0.52, 0.07, 0.05), ember, 0, 0.4, 0.43);                             // eye slit
  for (const s of [-1, 1]) {
    M(head, new THREE.ConeGeometry(0.09, 0.75, 5), dark, s * 0.5, 0.75, 0, 0, 0, -s * 1.0);          // horns
  }
  const capeJ = J(torso, 0, 1.45, -0.62);
  const cape = M(capeJ, new THREE.PlaneGeometry(1.9, 2.9, 1, 4), cloth, 0, -1.45, 0);
  const arm = (s) => {
    const sh = J(torso, s * 1.02, 1.36, 0);
    const p = M(sh, new THREE.SphereGeometry(0.54, 8, 6), iron, s * 0.1, 0.12, 0); p.scale.set(1, 0.8, 1.05);   // pauldron
    M(sh, new THREE.BoxGeometry(0.7, 0.1, 0.9), trim, s * 0.12, 0.42, 0, 0, 0, s * 0.35);
    M(sh, new THREE.CylinderGeometry(0.22, 0.2, 0.78, 7), iron, 0, -0.42, 0);
    const el = J(sh, 0, -0.82, 0);
    M(el, new THREE.CylinderGeometry(0.21, 0.17, 0.72, 7), iron, 0, -0.36, 0);
    M(el, new THREE.BoxGeometry(0.32, 0.3, 0.34), dark, 0, -0.76, 0);                                // gauntlet
    const hand = J(el, 0, -0.8, 0);
    return [sh, el, hand];
  };
  const [shL, elL] = arm(-1), [shR, elR, handR] = arm(1);
  // the greatsword in his right hand, blade along the hand's +Z
  const sword = J(handR, 0, 0, 0);
  const sw = new THREE.Group(); sw.rotation.x = Math.PI / 2; sword.add(sw);
  M(sw, new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), dark, 0, 0, 0);                             // grip
  M(sw, new THREE.SphereGeometry(0.1, 6, 5), trim, 0, -0.45, 0);                                     // pommel
  M(sw, new THREE.BoxGeometry(1.15, 0.15, 0.2), trim, 0, 0.45, 0);                                   // crossguard
  M(sw, new THREE.BoxGeometry(0.5, 3.3, 0.1), iron, 0, 2.15, 0);                                    // blade
  { const pt = M(sw, new THREE.ConeGeometry(0.36, 0.55, 4), iron, 0, 4.07, 0, 0, Math.PI / 4); pt.scale.z = 0.2; }                      // point
  const edge = M(sw, new THREE.BoxGeometry(0.06, 3.1, 0.12), ember, 0, 2.1, 0);
  const tip = J(sw, 0, 3.9, 0);
  g.userData = { crack, cape, capeJ, edge, tip, rig: { hips, torso, head, capeJ, shL, shR, elL, elR, thL, thR, knL, knR, sword } };
  return g;
}
const HIP_Y = 1.86;

// Poses for the rig: hy hips up/down, tx lean, ty twist, hd head, s?x/s?z
// shoulders (forward/out), e? elbows, t? thighs, k? knees, sw the sword's tilt in his hand.
const POSE_KEYS = ['hy', 'tx', 'ty', 'hd', 'sLx', 'sLz', 'sRx', 'sRz', 'eL', 'eR', 'tL', 'tR', 'kL', 'kR', 'sw'];
const base = { hy: 0, tx: 0.08, ty: 0, hd: 0, sLx: -0.2, sLz: -0.15, sRx: -0.35, sRz: 0.2, eL: -0.3, eR: -0.5, tL: 0, tR: 0, kL: 0.05, kR: 0.05, sw: 1.7 };
const pose = (o) => ({ ...base, ...o });
const P_ = {
  idle: pose({}),
  sit: pose({ hy: -0.75, tx: 0.05, tL: -1.5, tR: -1.5, kL: 1.5, kR: 1.5, sRx: -0.9, eR: -0.6, sLx: -0.9, sLz: -0.35, eL: -0.9, sw: 2.95 }),
  raise: pose({ tx: -0.1, sRx: -3.0, sRz: 0.1, eR: -0.3, sLx: -2.9, sLz: -0.4, eL: -0.4, sw: 0.8, hy: -0.1, tL: -0.3, kL: 0.4 }),
  strike: pose({ hy: -0.35, tx: 0.5, sRx: -0.9, sRz: 0.05, eR: -0.2, sLx: -0.85, sLz: -0.45, eL: -0.3, tL: -0.7, kL: 0.9, tR: 0.35, kR: 0.3, sw: 1.4, hd: 0.2 }),
  sweepA: pose({ hy: -0.25, ty: 1.1, sRx: -1.45, sRz: 0.7, eR: -0.15, sLx: -0.4, sLz: -0.6, kL: 0.4, kR: 0.4, tL: -0.2, sw: 1.6 }),
  sweepB: pose({ hy: -0.3, ty: -1.3, tx: 0.2, sRx: -1.45, sRz: 0.25, eR: -0.1, sLx: -0.6, sLz: -0.9, kL: 0.5, kR: 0.5, tR: -0.3, sw: 1.6 }),
  crouch: pose({ hy: -0.65, tx: 0.55, tL: -1.0, tR: -1.0, kL: 1.7, kR: 1.7, sRx: -0.6, eR: -0.9, sLx: -0.5, eL: -0.6, sw: 1.7 }),
  air: pose({ tx: -0.15, sRx: -3.0, eR: -0.3, sLx: -2.8, sLz: -0.4, eL: -0.4, sw: 0.8, tL: -0.9, kL: 1.3, tR: -0.4, kR: 1.0 }),
  thrustA: pose({ hy: -0.3, ty: 0.7, tx: 0.1, sRx: -1.2, sRz: 0.35, eR: -1.7, sLx: -1.3, sLz: -0.2, eL: -0.6, sw: 2.9, tL: -0.6, kL: 0.8, tR: 0.4, kR: 0.4 }),
  thrustB: pose({ hy: -0.4, ty: -0.2, tx: 0.4, sRx: -1.55, sRz: 0.05, eR: 0, sLx: -0.4, sLz: -0.7, sw: 1.55, tL: -1.0, kL: 1.0, tR: 0.6, kR: 0.4 }),
  plant: pose({ hy: -0.25, tx: 0.25, sRx: -0.95, sRz: 0.05, eR: -0.5, sLx: -0.95, sLz: -0.4, eL: -0.6, sw: 2.95, kL: 0.3, kR: 0.3 }),
  roar: pose({ tx: -0.35, hd: -0.55, sRx: -0.7, sRz: 1.0, sLx: -0.7, sLz: -1.0, eL: -0.4, eR: -0.4, sw: 0.6, hy: -0.15, kL: 0.3, kR: 0.3 }),
  kneel: pose({ hy: -0.95, tx: 0.55, hd: 0.6, tL: -1.5, kL: 1.5, tR: 0.3, kR: 1.9, sRx: -0.95, eR: -0.6, sLx: -0.3, sLz: -0.2, eL: -0.2, sw: 2.95 }),
};

function applyPose(model, p) {
  const r = model.userData.rig;
  r.hips.position.y = HIP_Y + p.hy;
  r.torso.rotation.set(p.tx, p.ty, 0);
  r.head.rotation.x = p.hd;
  r.shL.rotation.set(p.sLx, 0, p.sLz); r.shR.rotation.set(p.sRx, 0, p.sRz);
  r.elL.rotation.x = p.eL; r.elR.rotation.x = p.eR;
  r.thL.rotation.x = p.tL; r.thR.rotation.x = p.tR;
  r.knL.rotation.x = p.kL; r.knR.rotation.x = p.kR;
  r.sword.rotation.x = p.sw;
}
const blendPose = (cur, want, k) => { for (const key of POSE_KEYS) cur[key] += (want[key] - cur[key]) * k; return cur; };

// The fight itself, in real time, and it's hard. He walks you down and strings
// attacks together; every one marks the ground red where it will land just
// before it does, so watch the floor and get out of it (or jump, for the low
// ones). After each string he needs a breath: that's when to hit him.
//   a three-swing combo (two sweeps and an overhead slam), a slam that sends
//   eruptions racing across the floor, a full spin (jump it), a leap that comes
//   down on you, and a lunging thrust across the arena.
// Below half Health his armour splits and fire pours out: everything's faster,
// he spins and leaps twice, and he adds rolling rings of fire (jump them) and
// a rain of embers (keep moving).
export class Warden {
  constructor(model, { scene, G, telegraph, fx, gibs }) {
    this.model = model; this.scene = scene; this.G = G; this.telegraph = telegraph; this.fx = fx; this.gibs = gibs;
    this.name = 'Hollow Warden';
    this.boss = true;
    this.pos = model.position;            // moves the model directly
    this.radius = 1.3; this.height = 4.4;
    this.maxHp = 160; this.hp = this.maxHp;
    this.alive = true; this.engaged = false;
    this.phase = 1;
    this.mode = 'wait'; this.mt = 0; this.yaw = model.rotation.y;
    this.marks = [];
    this.fires = [];
    this.cur = { ...P_.idle };
    this.mats = [];
    model.traverse((o) => { if (o.material && o.material.emissive && !this.mats.includes(o.material)) this.mats.push(o.material); });
    this.last = '';
    this.t = 0;
  }

  start() { this.engaged = true; this.set('walk'); }
  set(m) { this.mode = m; this.mt = 0; }
  clearMarks() { for (const m of this.marks) m.remove(); this.marks = []; }
  mark(o) { const m = this.telegraph(this.scene, { y: PLATEAU.y, ...o }); this.marks.push(m); return m; }
  get fast() { return this.phase === 2 ? 0.72 : 1; }

  takeHit(dmg) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.12;
    if (this.hp <= 0) { this.alive = false; this.stop(); this.set('dying'); if (this.onDie) this.onDie(); return; }
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.model.userData.crack.visible = true;
      this.model.userData.edge.material = new THREE.MeshBasicMaterial({ color: 0xffd060 });
      this.stop();
      this.set('roar');
      if (this.onPhase) this.onPhase();
    }
  }

  stop() { this.clearMarks(); this.seq = null; }

  // hurt you if you're within r of (x, z) and (for the low ones) on the ground
  zone(P, x, z, r, dmg, { inner = 0, arc = 0, yaw = 0, jumpable = false } = {}) {
    const dx = P.pos.x - x, dz = P.pos.z - z, d = Math.hypot(dx, dz);
    if (d > r || d < inner) return false;
    if (arc) { const a = Math.atan2(dx, dz) - yaw; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > arc / 2) return false; }
    const lift = P.pos.y - this.G(P.pos.x, P.pos.z);
    if (lift > (jumpable ? 0.7 : 2.6)) return false;
    return P.hurt(dmg + (this.phase === 2 ? 1 : 0), x, z, dmg >= 4 ? 1.7 : 1.15);
  }

  ahead(k) { return [this.pos.x + Math.sin(this.yaw) * k, this.pos.z + Math.cos(this.yaw) * k]; }
  face(P, k, dt) { const want = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z); this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * k); }
  fwd(s) {
    this.pos.x += Math.sin(this.yaw) * s; this.pos.z += Math.cos(this.yaw) * s;
    const ox = this.pos.x - ARENA.x, oz = this.pos.z - ARENA.z, od = Math.hypot(ox, oz), lim = ARENA.r - 2.5;
    if (od > lim) { this.pos.x = ARENA.x + (ox / od) * lim; this.pos.z = ARENA.z + (oz / od) * lim; }
  }

  // Which attack next: depends how far away you are, and his phase.
  pick(d) {
    const p2 = this.phase === 2;
    let list = d > 9 ? ['leap', 'thrust', 'thrust'] : d > 5 ? ['slam', 'thrust', 'leap', 'spin'] : ['combo', 'combo', 'spin', 'slam'];
    if (p2) list = [...list, 'ring', 'embers'];
    let a;
    do a = list[Math.floor(Math.random() * list.length)]; while (a === this.last && Math.random() < 0.75);
    this.last = a;
    return a;
  }

  // An attack is a string of steps. Each: wind up into a pose for w seconds
  // (turning to follow you at `track`, showing its marks), then snap into the
  // strike pose and hit, then hold for `after` seconds.
  build(a, P) {
    const f = this.fast, y = PLATEAU.y, S = [];
    const swing = (wind, strike, w, dmg, opts = {}) => ({
      wind, strike, w: w * f, after: (opts.after ?? 0.2) * f, track: opts.track ?? 5,
      show: () => this.mark({ x: this.pos.x, z: this.pos.z, r: 5.2, inner: 0.6, arc: 2.7, yaw: this.yaw }),
      follow: (m) => { m.mesh.position.set(this.pos.x, y + 0.08, this.pos.z); m.mesh.rotation.z = this.yaw - Math.PI / 2; },
      hit: () => { this.fwd(1.2); this.zone(P, this.pos.x, this.pos.z, 5.2, dmg, { arc: 2.7, yaw: this.yaw, jumpable: true }); this.trail(); },
    });
    const slam = (w, dmg, extra) => ({
      wind: P_.raise, strike: P_.strike, w: w * f, after: 0.35 * f, track: 4,
      show: () => { const [x, z] = this.ahead(3.4); return this.mark({ x, z, r: 2.7 }); },
      follow: (m) => { const [x, z] = this.ahead(3.4); m.mesh.position.set(x, y + 0.08, z); },
      hit: () => {
        const [x, z] = this.ahead(3.4);
        this.fx.shake(0.5); this.fx.dust(new THREE.Vector3(x, y, z), 16); this.fx.ring(new THREE.Vector3(x, y + 0.2, z));
        this.zone(P, x, z, 2.8, dmg);
        if (extra) extra(x, z);
      },
    });
    if (a === 'combo') {
      S.push(swing(P_.sweepA, P_.sweepB, 0.5, 3), swing(P_.sweepB, P_.sweepA, 0.38, 3), slam(0.6, 5));
      this.recover = 1.0 * f;
    } else if (a === 'slam') {
      // ...and a line of eruptions racing away from where it lands
      S.push(slam(0.85, 5, (x, z) => {
        const dx = Math.sin(this.yaw), dz = Math.cos(this.yaw);
        for (let i = 1; i <= 6; i++) {
          const ex = x + dx * i * 2.1, ez = z + dz * i * 2.1;
          const m = this.mark({ x: ex, z: ez, r: 1.4 });
          this.fires.push({ at: this.t + 0.18 + i * 0.11, x: ex, z: ez, r: 1.5, dmg: 3, mark: m });
        }
      }));
      this.recover = 1.2 * f;
    } else if (a === 'spin') {
      const spins = this.phase === 2 ? 2 : 1;
      for (let i = 0; i < spins; i++) S.push({
        wind: P_.sweepA, strike: P_.sweepB, w: (i ? 0.35 : 0.75) * f, after: 0.1, track: 3, spin: true,
        show: () => this.mark({ x: this.pos.x, z: this.pos.z, r: 5.4, inner: 0.6 }),
        follow: (m) => m.mesh.position.set(this.pos.x, y + 0.08, this.pos.z),
        hit: () => { this.spinT = 0.45; this.zone(P, this.pos.x, this.pos.z, 5.4, 4, { jumpable: true }); this.trail(); },
      });
      this.recover = 1.0 * f;
    } else if (a === 'leap') {
      const n = this.phase === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) S.push({ leap: true, w: (i ? 0.35 : 0.55) * f, air: 0.75 * f, after: 0.4 * f });
      this.recover = 1.3 * f;
    } else if (a === 'thrust') {
      S.push({
        wind: P_.thrustA, strike: P_.thrustB, w: 0.65 * f, after: 0.5 * f, track: 6, dash: 13,
        show: () => { const ms = []; for (let i = 1; i <= 6; i++) { const [x, z] = this.ahead(i * 2.2); ms.push(this.mark({ x, z, r: 1.3 })); } return ms; },
        follow: (ms) => ms.forEach((m, i) => { const [x, z] = this.ahead((i + 1) * 2.2); m.mesh.position.set(x, y + 0.08, z); }),
        hit: () => { this.dashLeft = 13; this.dashHit = false; },
      });
      this.recover = 1.1 * f;
    } else if (a === 'ring') {
      S.push({
        wind: P_.raise, strike: P_.plant, w: 0.8 * f, after: 1.0, track: 2,
        show: () => this.mark({ x: this.pos.x, z: this.pos.z, r: 2.2 }),
        follow: () => {},
        hit: () => { this.fx.shake(0.4); this.rings = [{ r: 1, hit: false, x: this.pos.x, z: this.pos.z, delay: 0 }, { r: 1, hit: false, x: this.pos.x, z: this.pos.z, delay: 0.9 }]; this.ringMeshes(); },
      });
      this.recover = 1.6;
    } else if (a === 'embers') {
      S.push({
        wind: P_.roar, strike: P_.raise, w: 0.5 * f, after: 2.0, track: 1,
        show: () => null, follow: () => {},
        hit: () => {
          for (let i = 0; i < 10; i++) {
            const at = this.t + 0.7 + i * 0.16;
            this.fires.push({ at, x: 0, z: 0, r: 1.8, dmg: 3, aim: true, k: i });
          }
        },
      });
      this.recover = 0.8;
    }
    return S;
  }

  // a streak of embers off the blade as it swings
  trail() { const p = new THREE.Vector3(); this.model.userData.tip.getWorldPosition(p); this.fx.sparkle(p, this.phase === 2 ? 10 : 5); }

  ringMeshes() {
    for (const R of this.rings) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 64), new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.95 }));
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(R.x, PLATEAU.y + 0.3, R.z);
      mesh.visible = false;
      this.scene.add(mesh);
      R.mesh = mesh;
    }
  }

  update(dt, P) {
    this.t += dt; this.mt += dt;
    const m = this.model, ud = m.userData, y = PLATEAU.y;
    this.flash = Math.max(0, (this.flash || 0) - dt);
    for (const mat of this.mats) mat.emissive.setScalar(this.flash > 0 ? 0.6 : 0);
    ud.capeJ.rotation.x = 0.12 + Math.sin(this.t * 1.3) * 0.05 + Math.min(0.5, (this.speed || 0) * 0.08);
    let want = P_.idle, rate = 6;
    this.speed = 0;
    // things already set going: eruptions, embers and rings of fire
    this.updateFires(dt, P);
    if (this.mode === 'dying') {
      blendPose(this.cur, P_.kneel, Math.min(1, dt * 3));
      applyPose(m, this.cur);
      this.pos.y = y;
      if (this.mt > 1 && Math.floor(this.mt * 6) !== Math.floor((this.mt - dt) * 6)) this.fx.sparkle(this.pos.clone().setY(y + 1 + Math.random() * 3), 8);
      // on his knees, his head comes away from his shoulders and rolls; the
      // sword falls from his hand; then the rest of him comes apart in embers
      const r = ud.rig;
      if (this.gibs && this.mt > 1.2 && !this.beheaded) {
        this.beheaded = true;
        const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        this.gibs.fling(r.head, f.clone().multiplyScalar(2.5).add(new THREE.Vector3(0, 4, 0)), { spin: 6, life: 30 });
        this.fx.explode(this.pos.clone().setY(y + 3.2));
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), new THREE.MeshBasicMaterial({ color: 0xff7a20 }));
        neck.position.y = 1.6; r.torso.add(neck);
      }
      if (this.gibs && this.mt > 1.9 && !this.dropped) {
        this.dropped = true;
        this.gibs.fling(r.sword, new THREE.Vector3(Math.cos(this.yaw) * 2, 1, -Math.sin(this.yaw) * 2), { spin: 3, life: 30 });
      }
      if (this.gibs && this.mt > 2.5 && !this.crumbled) {
        this.crumbled = true;
        this.gibs.shatter(this.model, this.pos.clone().setY(y + 1.5), 4);
        this.fx.explode(this.pos.clone().setY(y + 2));
      }
      return;
    }
    if (!this.engaged || !this.alive) { applyPose(m, this.cur); return; }
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (this.phase === 2 && Math.random() < dt * 6) this.trail();
    switch (this.mode) {
      case 'roar': {
        // throws his arms out: a burst of fire all round him
        want = P_.roar; rate = 5;
        if (this.mt < dt * 1.5) this.mark({ x: this.pos.x, z: this.pos.z, r: 4.5 });
        if (this.marks[0]) this.marks[0].set(Math.min(1, this.mt / 0.9));
        if (this.mt > 0.9 && !this.burst) {
          this.burst = true; this.clearMarks();
          this.fx.explode(this.pos.clone().setY(y + 2.5)); this.fx.shake(0.7);
          this.zone(P, this.pos.x, this.pos.z, 4.5, 3);
        }
        if (this.mt > 1.8) this.set('walk');
        break;
      }
      case 'walk': {
        this.face(P, 5, dt);
        const sp = this.phase === 2 ? 4.8 : 3.8;
        if (d > 3.6) { this.fwd(sp * dt); this.speed = sp; }
        // stride
        const ph = this.t * 6.5, w = Math.min(1, this.speed / 3);
        want = { ...P_.idle, tL: Math.sin(ph) * 0.55 * w, tR: -Math.sin(ph) * 0.55 * w, kL: 0.1 + Math.max(0, -Math.sin(ph)) * 0.8 * w, kR: 0.1 + Math.max(0, Math.sin(ph)) * 0.8 * w,
          hy: -Math.abs(Math.cos(ph)) * 0.08 * w, ty: Math.sin(ph) * 0.12 * w, sLx: -0.2 - Math.sin(ph) * 0.35 * w };
        rate = 10;
        if (this.mt > 0.55 * this.fast || (d < 4.5 && this.mt > 0.25)) {
          this.seq = this.build(this.pick(d), P); this.si = 0; this.set('attack'); this.stepT = 0; this.stepMarks = null; this.struck = false;
        }
        break;
      }
      case 'attack': {
        const st = this.seq && this.seq[this.si];
        if (!st) { this.set('recover'); break; }
        this.stepT += dt;
        if (st.leap) { want = this.leapStep(st, dt, P); rate = 12; }
        else {
          if (this.stepT < dt * 1.5 && !this.stepMarks) this.stepMarks = st.show();
          if (this.stepT < st.w) {
            // winding up: follow you, glow the marks brighter
            this.face(P, st.track, dt);
            want = st.wind; rate = 7;
            const k = Math.min(1, this.stepT / st.w);
            if (this.stepMarks) { st.follow(this.stepMarks); [].concat(this.stepMarks).forEach((mk) => mk.set(k)); }
          } else {
            if (!this.struck) {
              this.struck = true;
              [].concat(this.stepMarks || []).forEach((mk) => mk.remove());
              this.marks = this.marks.filter((mk) => ![].concat(this.stepMarks || []).includes(mk));
              st.hit();
            }
            want = st.strike; rate = 24;
          }
          // the thrust: a lunge straight ahead, hitting anything in the way
          if (this.struck && this.dashLeft > 0) {
            const s = Math.min(this.dashLeft, 45 * dt);
            this.dashLeft -= s; this.fwd(s); this.speed = 12;
            if (!this.dashHit) this.dashHit = this.zone(P, this.pos.x, this.pos.z, 2.0, 4);
            if (Math.random() < 0.5) this.fx.dust(this.pos, 2);
          }
          // the spin: round he goes
          if (this.spinT > 0) { this.spinT -= dt; this.yaw -= dt * (Math.PI * 2) / 0.45; }
          if (this.stepT >= st.w + st.after && !(this.dashLeft > 0)) { this.si++; this.stepT = 0; this.stepMarks = null; this.struck = false; }
        }
        break;
      }
      case 'recover':
        // catching his breath, sword down: your opening
        want = { ...P_.plant, hy: -0.3, tx: 0.35 + Math.sin(this.t * 3) * 0.04, hd: 0.3 }; rate = 5;
        if (this.mt > this.recover) this.set('walk');
        break;
    }
    if (this.mode !== 'attack' || !(this.seq && this.seq[this.si] && this.seq[this.si].leap)) this.pos.y = y;
    blendPose(this.cur, want, Math.min(1, dt * rate));
    applyPose(m, this.cur);
    m.rotation.y = this.yaw;
  }

  // crouch, jump, and come down where you're standing
  leapStep(st, dt, P) {
    const y = PLATEAU.y, t = this.stepT;
    if (t < st.w) {
      this.face(P, 8, dt);
      if (!this.to) { this.to = new THREE.Vector3(P.pos.x, y, P.pos.z); this.from = this.pos.clone(); this.lm = this.mark({ x: P.pos.x, z: P.pos.z, r: 3.9 }); }
      this.to.x += (P.pos.x - this.to.x) * Math.min(1, dt * 5); this.to.z += (P.pos.z - this.to.z) * Math.min(1, dt * 5);
      this.lm.mesh.position.set(this.to.x, y + 0.08, this.to.z);
      this.lm.set(t / (st.w + st.air));
      this.from.copy(this.pos);
      return P_.crouch;
    }
    if (t < st.w + st.air) {
      const k = (t - st.w) / st.air;
      // keep homing in a little while he's in the air
      this.to.x += (P.pos.x - this.to.x) * Math.min(1, dt * 1.5); this.to.z += (P.pos.z - this.to.z) * Math.min(1, dt * 1.5);
      this.lm.mesh.position.set(this.to.x, y + 0.08, this.to.z);
      this.lm.set(Math.min(1, t / (st.w + st.air)));
      this.pos.x = this.from.x + (this.to.x - this.from.x) * k;
      this.pos.z = this.from.z + (this.to.z - this.from.z) * k;
      this.pos.y = y + Math.sin(k * Math.PI) * 8;
      this.yaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z) || this.yaw;
      return P_.air;
    }
    if (!this.landed) {
      this.landed = true; this.pos.y = y;
      this.lm.remove(); this.marks = this.marks.filter((mk) => mk !== this.lm);
      this.fx.shake(0.7); this.fx.ring(this.pos); this.fx.dust(this.pos, 22);
      this.zone(P, this.pos.x, this.pos.z, 3.9, 6);
    }
    this.pos.y = y;
    if (t > st.w + st.air + st.after) { this.landed = false; this.to = null; this.si++; this.stepT = 0; }
    return P_.strike;
  }

  updateFires(dt, P) {
    const y = PLATEAU.y;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const F = this.fires[i];
      // embers pick their spot when they're about to start falling: on you, and round you
      if (F.aim && !F.mark && this.t > F.at - 1.0) {
        const a = Math.random() * 6.3, r = F.k % 3 === 0 ? 0 : 1.5 + Math.random() * 4;
        F.x = P.pos.x + Math.cos(a) * r; F.z = P.pos.z + Math.sin(a) * r;
        F.mark = this.telegraph(this.scene, { x: F.x, y, z: F.z, r: F.r });
        F.from = this.t;
      }
      if (F.mark) F.mark.set(Math.min(1, (this.t - (F.from ?? F.at - 0.3)) / Math.max(0.2, F.at - (F.from ?? F.at - 0.3))));
      if (this.t >= F.at) {
        if (F.mark) F.mark.remove();
        this.marks = this.marks.filter((mk) => mk !== F.mark);
        this.fx.explode(new THREE.Vector3(F.x, y + 0.3, F.z));
        if (this.alive) this.zone(P, F.x, F.z, F.r + 0.1, F.dmg);
        this.fires.splice(i, 1);
      }
    }
    if (this.rings) {
      let live = 0;
      for (const R of this.rings) {
        if (R.done) continue;
        live++;
        if (R.delay > 0) { R.delay -= dt; continue; }
        R.mesh.visible = true;
        R.r += dt * 9;
        R.mesh.scale.set(R.r, R.r, 6);
        R.mesh.material.opacity = Math.max(0, 0.95 - Math.max(0, R.r - 22) / 6);
        if (!R.hit && this.alive) R.hit = this.zone(P, R.x, R.z, R.r + 0.45, 3, { inner: R.r - 0.45, jumpable: true });
        if (R.r > 28) { this.scene.remove(R.mesh); R.done = true; }
      }
      if (!live) this.rings = null;
    }
  }

  remove() {
    this.clearMarks();
    for (const F of this.fires) if (F.mark) F.mark.remove();
    this.fires = [];
    for (const R of this.rings || []) this.scene.remove(R.mesh);
    this.rings = null;
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

  // the fog gate: a curtain of slowly swirling mist hanging across the whole
  // gap in the ring, following its curve, with soft edges and puffs of fog
  // rolling along the bottom. You can't walk through it until you choose to
  // step into it.
  const puff = (n, a0, a1) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g2 = c.getContext('2d');
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 128, yy = Math.random() * 128, r = 10 + Math.random() * 26;
      const gr = g2.createRadialGradient(x, yy, 0, x, yy, r);
      gr.addColorStop(0, `rgba(235,235,240,${a0})`); gr.addColorStop(1, `rgba(235,235,240,${a1})`);
      g2.fillStyle = gr;
      for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { g2.beginPath(); g2.arc(x + dx, yy + dy, r, 0, Math.PI * 2); g2.fill(); }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  // fades the curtain out at its sides and towards the top
  const edge = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g2 = c.getContext('2d'), img = g2.createImageData(64, 64);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
      const u = i / 63, v = 1 - j / 63;                              // v: 0 at the bottom
      const side = Math.min(1, Math.min(u, 1 - u) / 0.18);
      const top = 1 - Math.pow(Math.max(0, (v - 0.45) / 0.55), 1.4);
      const k = Math.round(255 * side * side * Math.max(0, top));
      img.data.set([k, k, k, 255], (j * 64 + i) * 4);
    }
    g2.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  })();
  const GAP = 0.41;                    // half the gap in the ring, as an angle
  const curtain = [];
  for (const [r, op, sx] of [[ARENA.r - 0.5, 0.7, 3], [ARENA.r, 0.75, 4], [ARENA.r + 0.5, 0.6, 5]]) {
    const map = puff(90, 0.35, 0);
    map.repeat.set(sx, 1.2);
    const mat = new THREE.MeshBasicMaterial({ map, alphaMap: edge, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, color: 0xe4e4ec });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 8, 24, 1, true, Math.PI / 2 - GAP, GAP * 2), mat);
    m.position.set(ARENA.x, y + 3.6, ARENA.z);
    m.renderOrder = 4;
    scene.add(m);
    curtain.push(m);
  }
  // puffs rolling along the foot of it
  const puffTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g2 = c.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(235,235,242,0.9)'); gr.addColorStop(0.5, 'rgba(235,235,242,0.35)'); gr.addColorStop(1, 'rgba(235,235,242,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const puffs = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.5, depthWrite: false, color: 0xdcdce4 }));
    const a = -GAP + Math.random() * GAP * 2, r = ARENA.r + (Math.random() - 0.5) * 1.6;
    s.userData = { a, r, ph: Math.random() * 6.3, h: 0.6 + Math.random() * 2.2, k: 2.5 + Math.random() * 2.5 };
    s.scale.setScalar(s.userData.k);
    s.renderOrder = 5;
    scene.add(s);
    puffs.push(s);
  }
  const fogParts = [...curtain, ...puffs];
  // what stops you walking through: a row of blocks along the curve
  const gateBoxes = [];
  for (let i = 0; i <= 9; i++) {
    const a = -GAP + (i / 9) * GAP * 2, x = ARENA.x + Math.cos(a) * ARENA.r, z = ARENA.z + Math.sin(a) * ARENA.r;
    const b = box([x - 0.6, y - 1, z - 1.0], [x + 0.6, y + 8, z + 1.0], stoneMat, { visible: false });
    b.home = [b.min.clone(), b.max.clone()];
    gateBoxes.push(b);
  }
  const gateSolid = (on) => { for (const b of gateBoxes) { if (on) { b.min.copy(b.home[0]); b.max.copy(b.home[1]); } else { b.min.set(9999, 9999, 9999); b.max.set(9999, 9999, 9999); } } };

  // the Warden, seated, head bowed
  const warden = wardenModel();
  const seatPos = new THREE.Vector3(tx + 0.2, y + 0.55, ARENA.z);
  const daisPos = new THREE.Vector3(tx + 1.0, y + 0.6, ARENA.z);
  const standPos = new THREE.Vector3(ARENA.x - 6, y, ARENA.z);
  warden.position.copy(seatPos);
  warden.rotation.y = Math.PI / 2;     // facing the entrance (+x)
  warden.scale.setScalar(0.92);
  const seated = { ...P_.sit, hd: 0.55 };
  const cur = { ...seated };
  applyPose(warden, cur);
  scene.add(warden);

  // Rising, as a little scene (seconds from the start):
  //   0 - 1.0   he stirs: lifts his head, the slit of his eyes catching the light
  //   1.0 - 2.3 grips the sword and pushes himself up off the throne
  //   2.3 - 3.7 steps down off the dais and walks out towards you
  //   3.7 - 4.7 throws his arms out and roars
  const RISE = 4.7;
  let t = 0, rt = -1, onRoar = null, roared = false;
  const ease = (k) => k * k * (3 - 2 * k);
  const seg = (a, b2) => Math.max(0, Math.min(1, (rt - a) / (b2 - a)));
  return {
    warden, standPos, seatPos, RISE, pose: cur,
    gateIn: new THREE.Vector3(GATE.x - 3.5, y, GATE.z),      // where you step to through the fog
    playerSpot: new THREE.Vector3(ARENA.x + 7, y, ARENA.z),
    rise(roar) { rt = 0; onRoar = roar; },
    // standing just outside the fog, anywhere along it
    nearGate(P) {
      const dx = P.pos.x - ARENA.x, dz = P.pos.z - ARENA.z, d = Math.hypot(dx, dz);
      return d > ARENA.r + 0.3 && d < ARENA.r + 3.5 && Math.abs(Math.atan2(dz, dx)) < GAP + 0.03 && Math.abs(P.pos.y - y) < 3;
    },
    // the fog closes behind you once you're in
    sealGate() { for (const f of fogParts) f.visible = true; gateSolid(true); },
    passGate() { gateSolid(false); },
    openGate() { for (const f of fogParts) f.visible = false; gateSolid(false); },
    remove() { scene.remove(warden); },
    update(dt) {
      t += dt;
      curtain.forEach((m, i) => m.material.map.offset.set(t * (0.015 + i * 0.008) * (i % 2 ? -1 : 1), t * (0.04 + i * 0.01)));
      for (const s of puffs) {
        const u = s.userData;
        u.a += dt * 0.02 * Math.sin(u.ph); if (Math.abs(u.a) > GAP) u.ph += Math.PI;
        s.position.set(ARENA.x + Math.cos(u.a) * u.r, y + u.h + Math.sin(t * 0.7 + u.ph) * 0.3, ARENA.z + Math.sin(u.a) * u.r);
        s.material.rotation = t * 0.1 + u.ph;
        s.scale.setScalar(u.k * (1 + Math.sin(t * 0.5 + u.ph) * 0.12));
      }
      for (const b of braziers) { b.l.intensity = 12 + Math.sin(t * 12 + b.f.position.x) * 2.5; b.f.scale.y = 1 + Math.sin(t * 10 + b.f.position.z) * 0.15; }
      if (rt >= 0 && rt < RISE && !this.fighting) {
        rt += dt;
        let want;
        if (rt < 1.0) {
          // stirring
          want = { ...seated, hd: 0.55 - 0.75 * ease(seg(0.2, 1.0)), sRx: -0.9 - 0.2 * ease(seg(0.5, 1.0)) };
          warden.position.copy(seatPos);
        } else if (rt < 2.3) {
          // pushing up on the sword
          const k = ease(seg(1.0, 2.3));
          want = {};
          const mid = { ...P_.crouch, sw: 3.0, sRx: -0.8, eR: -0.7, hd: -0.2 };
          for (const key of POSE_KEYS) want[key] = k < 0.5 ? seated[key] + (mid[key] - seated[key]) * (k * 2) : mid[key] + (P_.plant[key] - mid[key]) * (k * 2 - 1);
          warden.position.lerpVectors(seatPos, daisPos, k);
        } else if (rt < 3.7) {
          // stepping down and walking out
          const k = seg(2.3, 3.7), ph = rt * 6.5;
          want = { ...P_.idle, tL: Math.sin(ph) * 0.5, tR: -Math.sin(ph) * 0.5, kL: 0.1 + Math.max(0, -Math.sin(ph)) * 0.7, kR: 0.1 + Math.max(0, Math.sin(ph)) * 0.7, hy: -Math.abs(Math.cos(ph)) * 0.07, sLx: -0.2 - Math.sin(ph) * 0.3 };
          warden.position.lerpVectors(daisPos, standPos, ease(k));
          warden.position.y = lerp(daisPos.y, standPos.y, Math.min(1, k * 3));   // off the dais in the first stride
        } else {
          // the roar
          want = P_.roar;
          warden.position.copy(standPos);
          if (!roared) { roared = true; if (onRoar) onRoar(); }
        }
        blendPose(cur, want, Math.min(1, dt * (rt > 3.7 ? 6 : 8)));
        applyPose(warden, cur);
      }
      if (!this.fighting) warden.userData.capeJ.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.05;
    },
    get standing() { return rt >= RISE; },
  };
}

// For tests and tooling: build the Warden on his own and pose him.
export const rig = { wardenModel, applyPose, POSES: P_ };
