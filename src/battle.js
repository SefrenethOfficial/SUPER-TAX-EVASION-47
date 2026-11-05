import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Turn-based battles. Exploring stops, the camera swings round to a side view
// of the fight, and the battle UI comes up:
//   - a battle slot for every fighter: a little checkered panel with their
//     Health and Stamina on it, and a live picture of them above it
//   - the command menu: Fight, Item, Run
// Pick with the stick / arrow keys and A (Space), or click. B goes back.
//
// Your party (you, plus anyone travelling with you) each take a turn, in order.
// Fight opens that fighter's moves; each attack costs Stamina: they go up,
// strike and come back. Then the enemy attacks one of you. A fighter at 0
// Health is down and skips their turns; you lose if the whole party is down.
// Everyone gets a little Stamina back every round.
// ---------------------------------------------------------------------------

const REGEN = 1;           // Stamina back at the end of each round
const RUN_SPEED = 8;

// Your moves. hits: the animation for each blow, when it lands (s after it
// starts), how long it lasts, and its damage range.
export const MOVES = [
  { name: 'Punch', cost: 2, desc: 'A quick jab. 2-3 damage.', hits: [{ state: 'punch1', at: 0.1, dur: 0.45, dmg: [2, 3] }] },
  { name: 'Kick', cost: 4, desc: 'A spinning kick. 4-5 damage.', hits: [{ state: 'kick', at: 0.22, dur: 0.6, dmg: [4, 5] }] },
  { name: 'Flurry', cost: 6, desc: 'Jab, jab, kick. Three hits of 2-3.', hits: [
    { state: 'punch1', at: 0.1, dur: 0.28, dmg: [2, 3] },
    { state: 'punch2', at: 0.1, dur: 0.28, dmg: [2, 3] },
    { state: 'kick', at: 0.22, dur: 0.6, dmg: [2, 3] }] },
  { name: 'Catch Breath', cost: 0, rest: 3, desc: 'Skip your attack and get 3 Stamina back.' },
];

// Fighter pictures are live: each frame, a head-and-shoulders view of each
// fighter is rendered straight into the game canvas, inside the picture frame
// above their battle slot (nothing is read back from the GPU).
const picCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
const tmpV = new THREE.Vector3(), tmpS = new THREE.Vector2();

export class Battle {
  // party: [{ name, hp, maxHp, sp, maxSp, pos (their spot), moves, picture, top,
  //           actor (the Player, run around with its own moves) or node (an Object3D,
  //           slid around) }]
  // enemy: { name, hp, maxHp, sp, maxSp, atk, attackText, pos, model, picture, top, intro }
  constructor({ ui, input, camera, party, enemy, fx, onEnd }) {
    this.ui = ui; this.input = input; this.camera = camera;
    this.party = party; this.player = party[0]; this.enemy = enemy; this.onEnd = onEnd; this.fx = fx;
    for (const f of party) {
      f.moves = f.moves || MOVES;
      if (f.node) { f.home = f.node.position.clone(); f.lift = f.home.y - f.pos.y; }
    }
    this.cur = 0;               // whose turn it is
    this.phase = 'menu'; this.pt = 0;
    this.wobble = 0; this.wobbleV = 0; this.fallen = 0;
    this.menu = 'main';
    this.sel = 0;
    this.lock = 0.3;             // ignore input for a moment so the starting press doesn't pick anything
    this.ending = false;
    this.t = 0;
    this.build();
    this.say(enemy.intro || `${enemy.name} stands in your way!`);
  }

  get me() { return this.party[this.cur]; }

  slot(f, cls) {
    const el = document.createElement('div');
    el.className = `bslot ${cls}`;
    el.innerHTML = `
      <div class="bpic"></div>
      <div class="bpanel">
        <div class="bname">${f.name}</div>
        <div class="bstat hp"><div class="row"><span class="lbl">Health</span><span class="num"></span></div><div class="bar"><i></i></div></div>
        <div class="bstat sp"><div class="row"><span class="lbl">Stamina</span><span class="num"></span></div><div class="bar"><i></i></div></div>
      </div>`;
    f.el = el;
    return el;
  }

  all() { return [...this.party, this.enemy]; }

  refresh() {
    for (const f of this.all()) {
      const set = (cls, v, m) => {
        f.el.querySelector(`.${cls} i`).style.width = `${(v / m) * 100}%`;
        f.el.querySelector(`.${cls} .num`).textContent = `${v} / ${m}`;
      };
      set('hp', f.hp, f.maxHp);
      set('sp', f.sp, f.maxSp);
      f.el.classList.toggle('down', f.hp <= 0);
    }
    this.party.forEach((f, i) => f.el.classList.toggle('active', this.phase === 'menu' && i === this.cur));
  }

  build() {
    const ui = this.ui;
    ui.innerHTML = '';
    const side = document.createElement('div');
    side.className = `bparty n${this.party.length}`;
    this.party.forEach((f) => side.append(this.slot(f, 'ally')));
    ui.append(side, this.slot(this.enemy, 'foe'));
    this.log = document.createElement('div');
    this.log.className = 'blog';
    this.cmds = document.createElement('div');
    this.cmds.className = 'bmenu';
    ui.append(this.log, this.cmds);
    this.showMenu('main');
    this.refresh();
    ui.classList.add('on');
  }

  say(text) { this.log.textContent = text; }

  ask() { return this.cur === 0 ? 'What will you do?' : `What will ${this.me.name} do?`; }

  showMenu(kind) {
    this.menu = kind;
    this.sel = 0;
    const P = this.me;
    const items = kind === 'main'
      ? [['Fight', () => this.showMenu('fight')], ['Item', () => this.showMenu('items')], ['Run', () => this.run()]]
      : kind === 'fight'
        ? [...P.moves.map((m) => [m.name, P.sp >= m.cost ? () => this.useMove(m) : null, m.cost ? `${m.cost} SP` : '', m.desc]), ['Back', () => this.showMenu('main'), '', '']]
        : [['(no items)', null], ['Back', () => this.showMenu('main')]];
    this.items = items;
    this.cmds.innerHTML = '';
    this.cmds.classList.toggle('wide', kind === 'fight');
    items.forEach(([label, fn, cost], i) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (cost) { const c = document.createElement('span'); c.className = 'cost'; c.textContent = cost; b.append(c); }
      b.disabled = !fn;
      b.addEventListener('mouseenter', () => { if (fn) { this.sel = i; this.highlight(); } });
      b.addEventListener('click', (e) => { e.stopPropagation(); if (fn && !this.ending && this.phase === 'menu') fn(); });
      this.cmds.append(b);
    });
    if (!items[this.sel][1]) this.sel = items.findIndex(([, fn]) => fn);
    this.highlight();
  }

  highlight() {
    [...this.cmds.children].forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    // in the moves list, describe the one you're on
    if (this.menu === 'fight') {
      const [, fn, , desc] = this.items[this.sel];
      this.say(desc ? (fn ? desc : `${desc} Not enough Stamina.`) : this.ask());
    } else if (this.menu === 'main' && (this.t > 0 || this.cur > 0)) this.say(this.ask());
  }

  // --- Turns -------------------------------------------------------------------------
  setPhase(p) { this.phase = p; this.pt = 0; this.refresh(); }

  busy(on) { this.cmds.classList.toggle('gone', on); }

  useMove(m) {
    const P = this.me;
    this.busy(true);
    this.menu = 'none';
    if (m.rest) {
      P.sp = Math.min(P.maxSp, P.sp + m.rest);
      this.popup(P, `+${m.rest} SP`, 'sp');
      this.say(this.cur === 0 ? 'You catch your breath.' : `${P.name} catches her breath.`);
      this.setPhase('rest');
      return;
    }
    P.sp -= m.cost;
    this.move = m;
    this.hitIndex = 0;
    this.dealt = 0;
    this.say(this.cur === 0 ? `You use ${m.name}!` : `${P.name} uses ${m.name}!`);
    this.setPhase('approach');
  }

  // where a fighter is right now
  at(f) { return f.actor ? f.actor.pos : f.node ? tmpV.set(f.node.position.x, f.node.position.y - (f.lift || 0), f.node.position.z) : f.pos; }

  // A number that pops up over a fighter and floats away.
  popup(f, text, cls) {
    const el = document.createElement('div');
    el.className = `bdmg ${cls}`;
    el.textContent = text;
    this.ui.append(el);
    const v = this.at(f).clone(); v.y += f.top ?? 2.3;
    v.project(this.camera);
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    setTimeout(() => el.remove(), 1100);
  }

  damage(f, n) {
    f.hp = Math.max(0, f.hp - n);
    this.popup(f, `-${n}`, f === this.enemy ? 'good' : 'bad');
    this.refresh();
    if (this.onDamage) this.onDamage(f);
  }

  // Move a fighter towards a point; true once there.
  goTo(f, x, z, near, dt) {
    if (f.actor) {
      const a = f.actor, dx = x - a.pos.x, dz = z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < near) { a.fwd = 0; return true; }
      a.yaw = Math.atan2(dx, dz);
      a.fwd = Math.min(RUN_SPEED, d * 6);
      return false;
    }
    const n = f.node.position, dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz);
    if (d < near) return true;
    const step = Math.min(d - near * 0.5, 9 * dt);
    n.x += (dx / d) * step; n.z += (dz / d) * step;
    f.node.rotation.y = Math.atan2(dx, dz);
    return false;
  }

  face(f) {
    const p = this.at(f), e = this.enemy.pos, yaw = Math.atan2(e.x - p.x, e.z - p.z);
    if (f.actor) f.actor.yaw = yaw; else f.node.rotation.y = yaw;
  }

  // the next fighter in the party who can still act, after `i`
  nextUp(i) {
    for (let k = i + 1; k < this.party.length; k++) if (this.party[k].hp > 0) return k;
    return -1;
  }

  toMenu() {
    this.setPhase('menu');
    this.busy(false);
    this.showMenu('main');
    this.say(this.ask());
  }

  turns(dt) {
    const P = this.me, E = this.enemy;
    this.pt += dt;
    switch (this.phase) {
      case 'approach': {
        // stop just in front of the enemy, on your side
        const home = P.pos, dx = home.x - E.pos.x, dz = home.z - E.pos.z, d = Math.hypot(dx, dz) || 1;
        const tx = E.pos.x + (dx / d) * 1.5, tz = E.pos.z + (dz / d) * 1.5;
        if (this.goTo(P, tx, tz, P.actor ? 0.2 : 0.1, dt) || this.pt > 2.5) {
          if (P.actor) P.actor.fwd = 0;
          this.face(P);
          this.startHit(P, this.move.hits[0]);
          this.setPhase('strike');
        }
        break;
      }
      case 'strike': {
        const h = this.move.hits[this.hitIndex];
        if (P.node) {   // a lunge for those without moves of their own
          const k = Math.sin(Math.min(1, this.pt / h.dur) * Math.PI);
          const e = E.pos, n = P.node.position, dx = e.x - n.x, dz = e.z - n.z, d = Math.hypot(dx, dz) || 1;
          P.node.position.set(this.lungeFrom.x + (dx / d) * k * 0.7, this.lungeFrom.y + k * 0.25, this.lungeFrom.z + (dz / d) * k * 0.7);
        }
        if (this.pt > h.at && !this.hit) {
          this.hit = true;
          const n = h.dmg[0] + Math.floor(Math.random() * (h.dmg[1] - h.dmg[0] + 1));
          this.dealt += n;
          this.damage(E, n);
          this.wobbleV += 4 + n;
          this.fx.shake(0.15 + n * 0.04);
        }
        if (this.pt > h.dur) {
          this.hit = false;
          this.hitIndex++;
          const next = this.move.hits[this.hitIndex];
          if (next && E.hp > 0) { this.face(P); this.startHit(P, next); this.pt = 0; }
          else { this.say(`${this.move.name} hits the ${E.name} for ${this.dealt}!`); this.setPhase('return'); }
        }
        break;
      }
      case 'return':
        if (this.goTo(P, P.pos.x, P.pos.z, P.actor ? 0.15 : 0.05, dt) || this.pt > 2.5) {
          if (P.actor) { P.actor.pos.x = P.pos.x; P.actor.pos.z = P.pos.z; P.actor.fwd = 0; } else P.node.position.copy(P.home);
          this.face(P);
          this.endTurn();
        }
        break;
      case 'rest':
        if (this.pt > 1.1) this.endTurn();
        break;
      case 'enemyTurn': {
        if (this.pt === dt) {
          const up = this.party.filter((f) => f.hp > 0);
          this.target = up[Math.floor(Math.random() * up.length)];
          this.say(`The ${E.name} ${E.attackText || 'attacks'}!`);
        }
        const T = this.target;
        if (this.pt > 0.45 && !this.swung) { this.swung = true; this.wobbleV -= 9; }   // lurch towards them
        if (this.pt > 0.75 && !this.hit) {
          this.hit = true;
          this.damage(T, E.atk);
          if (T.actor) { T.actor.anim.sq = -0.3; T.actor.invuln = 0.7; T.actor.say('hurt'); }
          else this.allyFlinch = 0.5;
          this.fx.shake(0.35);
          this.say(T === this.player ? `The ${E.name} hits you for ${E.atk}.` : `The ${E.name} hits ${T.name} for ${E.atk}.`);
        }
        if (this.allyFlinch > 0 && T.node) {
          this.allyFlinch -= dt;
          T.node.position.x = T.home.x + Math.sin(this.allyFlinch * 60) * 0.08 * this.allyFlinch * 2;
        }
        if (this.pt > 1.7) {
          this.hit = false; this.swung = false;
          if (T.node) T.node.position.copy(T.home);
          if (this.party.every((f) => f.hp <= 0)) { this.setPhase('lose'); break; }
          for (const f of this.party) if (f.hp > 0) f.sp = Math.min(f.maxSp, f.sp + REGEN);
          this.cur = this.party.findIndex((f) => f.hp > 0);
          this.toMenu();
        }
        break;
      }
      case 'win':
        if (this.pt === dt) this.say(`You defeated the ${E.name}!`);
        this.fallen = Math.min(1, this.fallen + dt * 2.2);
        if (this.pt > 2.0) { this.setPhase('done'); this.end(); }
        break;
      case 'lose':
        if (this.pt === dt) this.say(this.party.length > 1 ? 'Your party was knocked out...' : 'You were knocked out...');
        if (this.pt > 2.0) { this.setPhase('done'); this.end(); }
        break;
    }
    // the enemy wobbles on a spring when hit, and keels over when beaten
    this.wobbleV += (-60 * this.wobble - 5 * this.wobbleV) * dt;
    this.wobble += this.wobbleV * dt;
    if (E.model) {
      E.model.rotation.z = this.wobble * 0.12;
      E.model.rotation.x = this.fallen * -1.45;
    }
  }

  startHit(P, h) {
    if (P.actor) { P.actor.state = ''; P.actor.setState(h.state); }
    else this.lungeFrom = P.node.position.clone();
  }

  // after a fighter's move: the next one in the party, or the enemy
  endTurn() {
    if (this.enemy.hp <= 0) { this.setPhase('win'); return; }
    const n = this.nextUp(this.cur);
    if (n >= 0) { this.cur = n; this.toMenu(); } else this.setPhase('enemyTurn');
  }

  run() {
    this.ending = true;
    this.say('You got away safely!');
    this.cmds.classList.add('gone');
    setTimeout(() => this.end(), 900);
  }

  end() {
    this.ui.classList.remove('on');
    if (this.enemy.model) this.enemy.model.rotation.set(0, this.enemy.model.rotation.y, 0);
    for (const f of this.party) if (f.node) f.node.position.copy(f.home);
    this.onEnd({ won: this.enemy.hp <= 0, lost: this.party.every((f) => f.hp <= 0) });
  }

  // Draw the fighter pictures into their frames (call after the main render).
  renderPictures(renderer, scene) {
    const size = renderer.getSize(tmpS);
    const fog = scene.fog, near = fog && fog.near, far = fog && fog.far;
    if (fog) { fog.near = 1e4; fog.far = 2e4; }          // no mist in the pictures
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    for (const f of this.all()) {
      const el = f.el && f.el.querySelector('.bpic');
      if (!el || !f.picture) continue;
      const r = el.getBoundingClientRect();
      const b = 2;                                          // inside the frame's border
      const x = r.left + b, w = r.width - b * 2, h = r.height - b * 2, y = size.y - (r.bottom - b);
      if (w <= 0 || h <= 0) continue;
      const { height = 1.6, dist = 2.2, yaw = 0 } = f.picture;
      const at = this.at(f);
      const look = new THREE.Vector3(at.x, at.y + height, at.z);
      picCam.aspect = w / h; picCam.updateProjectionMatrix();
      picCam.position.set(look.x + Math.sin(yaw) * dist, look.y + 0.15, look.z + Math.cos(yaw) * dist);
      picCam.lookAt(look);
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.clear();
      renderer.render(scene, picCam);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
    renderer.autoClear = auto;
    if (fog) { fog.near = near; fog.far = far; }
  }

  update(dt) {
    this.t += dt;
    this.lock -= dt;
    const inp = this.input;
    this.turns(dt);
    if (this.lock <= 0 && !this.ending && this.phase === 'menu') {
      // stick / arrows: one step per push
      const y = inp.move.y;
      if (Math.abs(y) > 0.5 && !this.held) {
        this.held = true;
        const n = this.items.length;
        let s = this.sel;
        do { s = (s + (y > 0 ? -1 : 1) + n) % n; } while (!this.items[s][1] && s !== this.sel);
        this.sel = s;
        this.highlight();
      }
      if (Math.abs(y) < 0.3) this.held = false;
      if (inp.pressed.A) { const fn = this.items[this.sel][1]; if (fn) fn(); }
      else if (inp.pressed.B && this.menu !== 'main') this.showMenu('main');
    }
    // side-on view of the fight, drifting slightly
    const a = this.player.pos, b = this.enemy.pos;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const across = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const side = new THREE.Vector3(-across.z, 0, across.x);
    const sway = Math.sin(this.t * 0.4) * 0.4;
    this.camera.position.copy(mid).addScaledVector(side, 9).addScaledVector(across, sway - 0.6).add(new THREE.Vector3(0, 3.3, 0));
    this.camera.lookAt(mid.x - across.x * 0.6, mid.y + 1.1, mid.z - across.z * 0.6);
  }
}
