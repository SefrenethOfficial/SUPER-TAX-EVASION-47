import * as THREE from 'three';
import { WEAPONS, ITEMS } from './items.js?v=53';
import { save, useItem } from './save.js?v=53';

// ---------------------------------------------------------------------------
// Real-time combat. Your moves are your attacks: the punch combo (punch,
// punch, kick), diving, the slide kick, the jump kick and the ground pound all
// hit whatever's in front of (or, for the ground pound, around) you. Attacks
// cost Stamina, which comes back quickly when you stop swinging; with none
// left your blows do nothing. Your weapon adds damage to every hit.
//
// Party members fight on their own: Vivian throws bolts of shadow at nearby
// enemies, Marrow rushes in and swings (see the stage for how they move).
//
// Things that can be hit ("foes") register here: { pos, radius, height, hp,
// maxHp, alive, name, takeHit(damage, fromPos) }.
// ---------------------------------------------------------------------------

// state -> [stamina cost, damage, when it can hit (s after it starts), reach]
const ATTACKS = {
  punch1: [1, 2, [0.02, 0.2], 1.0],
  punch2: [1, 2, [0.02, 0.2], 1.0],
  kick: [2, 3, [0.05, 0.32], 1.25],
  dive: [2, 3, [0.0, 0.6], 1.2],
  slidekick: [2, 3, [0.0, 0.45], 1.2],
  jumpkick: [1, 3, [0.03, 0.35], 1.2],
  gp_land: [2, 4, [0.0, 0.12], 0],        // all round you
};
const REGEN = 3.2, REGEN_DELAY = 0.7;

export class Combat {
  constructor({ scene, camera, fx, hud }) {
    this.scene = scene; this.camera = camera; this.fx = fx;
    this.foes = [];
    this.allies = [];
    this.hud = hud;           // { floaters, bossBar }
    this.attackState = '';
    this.lastSpend = 0;
    this.t = 0;
    this.shots = [];          // bolts and thrown flasks in flight
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xb98cff });
    this.flaskMat = new THREE.MeshBasicMaterial({ color: 0xff8a30 });
  }

  add(foe) { this.foes.push(foe); return foe; }
  remove(foe) { this.foes = this.foes.filter((f) => f !== foe); if (foe.bar) { foe.bar.remove(); foe.bar = null; } }
  clear() { for (const f of this.foes) if (f.bar) f.bar.remove(); this.foes = []; this.allies = []; for (const s of this.shots) this.scene.remove(s.mesh); this.shots = []; }

  nearest(pos, range, filter = () => true) {
    let best = null, bd = range;
    for (const f of this.foes) {
      if (!f.alive || f.untouchable || !filter(f)) continue;
      const d = Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  // a number floating up from somewhere
  float(pos, text, cls = '') {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    this.hud.floaters.append(el);
    this.floats = this.floats || [];
    this.floats.push({ el, pos: pos.clone(), t: 0 });
  }

  hit(foe, dmg, from, cls = '') {
    if (!foe.alive) return;
    foe.takeHit(dmg, from);
    const p = foe.pos.clone(); p.y += foe.height + 0.3;
    this.float(p, `${dmg}`, cls);
    this.fx.shake(0.08 + Math.min(0.25, dmg * 0.03));
  }

  // --- Your attacks ---------------------------------------------------------------
  playerAttacks(dt, P) {
    const s = P.state;
    if (s !== this.attackState) {
      this.attackState = s;
      this.hitThisSwing = new Set();
      const A = ATTACKS[s];
      this.tired = false;
      if (A) {
        if (P.stamina >= A[0]) { P.stamina -= A[0]; this.lastSpend = this.t; }
        else { this.tired = true; this.lastSpend = this.t; if (this.onTired) this.onTired(); }
      }
    }
    const A = ATTACKS[s];
    if (!A || this.tired || P.t < A[2][0] || P.t > A[2][1]) return;
    const bonus = (WEAPONS[save.equipped] || WEAPONS.fists).atk;
    let dmg = A[1] + bonus, reach = A[3] + (bonus ? 0.35 : 0);
    // what the teachers showed you
    if (s === 'kick' && save.learned.includes('heavy')) dmg += 4;
    let radius = 1.05;
    let cx = P.pos.x + Math.sin(P.yaw) * reach, cz = P.pos.z + Math.cos(P.yaw) * reach;
    if (s === 'gp_land') {
      cx = P.pos.x; cz = P.pos.z;
      radius = save.learned.includes('skybreaker') ? 4.5 : 2.2;
      if (save.learned.includes('skybreaker')) dmg += 4;
      if (P.t < dt * 1.5 && save.learned.includes('skybreaker')) { this.fx.ring(P.pos); this.fx.shake(0.35); }
    }
    for (const f of this.foes) {
      if (!f.alive || f.untouchable || this.hitThisSwing.has(f)) continue;
      const d = Math.hypot(f.pos.x - cx, f.pos.z - cz);
      const dy = P.pos.y + 0.9 - (f.pos.y + f.height * 0.5);
      if (d < radius + f.radius && Math.abs(dy) < f.height * 0.5 + 1.2) {
        this.hitThisSwing.add(f);
        this.hit(f, dmg, P.pos, 'mine');
        if (f.hitSound !== false && P.say && Math.random() < 0.15) P.say('hoo');
      }
    }
  }

  // --- Party members --------------------------------------------------------------
  // ally: { kind: 'bolt' | 'melee', from() -> Vector3, every, dmg, range, cool, onMelee(foe) }
  addAlly(a) { a.cool = a.cool ?? 1; this.allies.push(a); return a; }

  allyAttacks(dt, P) {
    for (const a of this.allies) {
      if (a.active && !a.active()) continue;
      a.cool -= dt;
      if (a.cool > 0) continue;
      const target = this.nearest(P.pos, a.range, (f) => (f.engaged || f.boss) && !f.noAllies);
      if (!target) continue;
      a.cool = a.every;
      if (a.kind === 'bolt') {
        const from = a.from().clone(); from.y += 1.6;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), this.boltMat);
        m.position.copy(from);
        this.scene.add(m);
        this.shots.push({ mesh: m, target, speed: 16, dmg: target.boss ? Math.ceil(a.dmg / 2) : a.dmg, kind: 'bolt', life: 3 });   // (bosses shrug off half)
      } else if (a.onMelee) {
        a.onMelee(target, () => this.hit(target, target.boss ? Math.ceil(a.dmg / 2) : a.dmg, a.from(), 'ally'));
      }
    }
  }

  // Throw an Ember Flask at the nearest enemy.
  throwFlask(P) {
    const target = this.nearest(P.pos, 16);
    if (!target) return false;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), this.flaskMat);
    m.position.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
    this.scene.add(m);
    this.shots.push({ mesh: m, target, speed: 14, dmg: ITEMS.ember.damage, kind: 'flask', life: 3, arc: 0, start: m.position.clone() });
    return true;
  }

  shotsUpdate(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], m = s.mesh, T = s.target;
      s.life -= dt;
      const aim = T.pos.clone(); aim.y += T.height * 0.55;
      const d = aim.clone().sub(m.position), l = d.length();
      if (l < 0.6 || s.life <= 0 || !T.alive) {
        if (T.alive && l < 1.2) {
          if (s.kind === 'flask') {
            this.fx.explode(m.position);
            for (const f of this.foes) if (f.alive && !f.untouchable && f.pos.distanceTo(m.position) < 3 + f.radius) this.hit(f, s.dmg, m.position, 'mine');
          } else {
            this.fx.sparkle(m.position, 6);
            this.hit(T, s.dmg, m.position, 'ally');
          }
        }
        this.scene.remove(m);
        this.shots.splice(i, 1);
        continue;
      }
      m.position.addScaledVector(d, Math.min(1, (s.speed * dt) / l));
      if (s.kind === 'bolt') m.scale.setScalar(1 + Math.sin(this.t * 30) * 0.2);
      else m.position.y += Math.sin(Math.min(1, (3 - s.life) / 1.0) * Math.PI) * dt * 4;
    }
  }

  // --- Quick items: 1 Herb, 2 Hearth Salve, 3 Tonic, 4 Ember Flask --------------------
  quickUse(id, P) {
    const it = ITEMS[id];
    if (!it || !save.items[id]) { this.float(P.pos.clone().setY(P.pos.y + 2.4), `No ${it ? it.name : 'item'}s`, 'note'); return; }
    if (it.damage) {
      if (!this.throwFlask(P)) { this.float(P.pos.clone().setY(P.pos.y + 2.4), 'Nothing to throw at', 'note'); return; }
      useItem(id);
      return;
    }
    if (it.heal && P.health >= 8) { this.float(P.pos.clone().setY(P.pos.y + 2.4), 'Already at full Health', 'note'); return; }
    if (it.stamina && P.stamina >= P.maxStamina) { this.float(P.pos.clone().setY(P.pos.y + 2.4), 'Already full of Stamina', 'note'); return; }
    useItem(id);
    if (it.heal) { const n = Math.min(it.heal, 8 - P.health); P.health += n; this.float(P.pos.clone().setY(P.pos.y + 2.4), `+${n}`, 'heal'); if (P.onHurt) P.onHurt(P.health); }
    if (it.stamina) { P.stamina = Math.min(P.maxStamina, P.stamina + it.stamina); this.float(P.pos.clone().setY(P.pos.y + 2.4), `+${it.stamina} SP`, 'sp'); }
    this.fx.sparkle(P.pos, 8);
  }

  update(dt, P) {
    this.t += dt;
    if (this.t - this.lastSpend > REGEN_DELAY) P.stamina = Math.min(P.maxStamina, P.stamina + REGEN * dt);
    if (!P.locked) { this.playerAttacks(dt, P); this.allyAttacks(dt, P); }
    this.shotsUpdate(dt);
    // floating numbers and health bars over enemies
    const v = new THREE.Vector3();
    const W = innerWidth, H = innerHeight;
    if (this.floats) {
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t += dt;
        v.copy(f.pos); v.y += f.t * 1.2;
        v.project(this.camera);
        const on = v.z < 1;
        f.el.style.display = on ? '' : 'none';
        f.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -50%)`;
        f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 0.5) / 0.5));
        if (f.t > 1) { f.el.remove(); this.floats.splice(i, 1); }
      }
    }
    for (const f of this.foes) {
      if (f.boss) continue;
      const show = f.alive && !f.untouchable && !f.hidden && (f.hp < f.maxHp || f.engaged) && Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z) < 30;
      if (!show) { if (f.bar) f.bar.style.display = 'none'; continue; }
      if (!f.bar) {
        f.bar = document.createElement('div');
        f.bar.className = 'foebar';
        f.bar.innerHTML = '<i></i>';
        this.hud.floaters.append(f.bar);
      }
      v.copy(f.pos); v.y += f.height + 0.55;
      v.project(this.camera);
      f.bar.style.display = v.z < 1 ? '' : 'none';
      f.bar.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -50%)`;
      f.bar.firstChild.style.width = `${(f.hp / f.maxHp) * 100}%`;
    }
    // a boss's bar along the bottom of the screen
    const boss = this.foes.find((f) => f.boss && f.alive && f.engaged);
    const bb = this.hud.bossBar;
    bb.classList.toggle('on', !!boss);
    if (boss) {
      bb.querySelector('.bname').textContent = boss.name;
      bb.querySelector('i').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }
  }
}

// --- Telegraphs: red marks on the ground where an attack is about to land -------------
export function telegraph(scene, { x, y, z, r, inner = 0, arc = null, yaw = 0 }) {
  const geo = arc ? new THREE.RingGeometry(inner, r, 32, 1, -arc / 2, arc) : new THREE.RingGeometry(inner, r, 40);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3a20, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  if (arc) m.rotation.z = yaw - Math.PI / 2;
  m.position.set(x, y + 0.08, z);
  m.renderOrder = 3;
  scene.add(m);
  return {
    mesh: m,
    set(k) { m.material.opacity = 0.15 + 0.4 * k; },
    remove() { scene.remove(m); m.geometry.dispose(); },
  };
}
