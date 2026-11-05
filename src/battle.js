import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Turn-based battles. Exploring stops, the camera swings round to a side view
// of the two fighters, and the battle UI comes up:
//   - a battle slot for each side: a little checkered panel with the fighter's
//     Health and Stamina on it, and a picture of the fighter above it
//   - the command menu: Fight, Item, Run
// Pick with the stick / arrow keys and A (Space), or click. B goes back.
//
// Fight opens your moves. Each attack costs Stamina: you run up, strike, and
// run back; then the enemy takes its turn. Catch Breath skips your attack to
// get Stamina back. Stamina also comes back a little every round.
// ---------------------------------------------------------------------------

const PORTRAIT = 128;
const REGEN = 1;           // Stamina back at the end of each round

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
const RUN_SPEED = 8;

// A head-and-shoulders picture of a fighter, rendered from the live scene.
export function portrait(renderer, scene, target, { height = 1.6, dist = 2.2, yaw = 0 } = {}) {
  const rt = new THREE.WebGLRenderTarget(PORTRAIT, PORTRAIT, { colorSpace: THREE.SRGBColorSpace });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const look = target.clone().add(new THREE.Vector3(0, height, 0));
  cam.position.copy(look).add(new THREE.Vector3(Math.sin(yaw) * dist, 0.15, Math.cos(yaw) * dist));
  cam.lookAt(look);
  const fog = scene.fog;
  scene.fog = null;                       // no mist in the picture
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const px = new Uint8Array(PORTRAIT * PORTRAIT * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, PORTRAIT, PORTRAIT, px);
  renderer.setRenderTarget(null);
  scene.fog = fog;
  rt.dispose();
  const c = document.createElement('canvas');
  c.width = c.height = PORTRAIT;
  const g = c.getContext('2d');
  const img = g.createImageData(PORTRAIT, PORTRAIT);
  for (let y = 0; y < PORTRAIT; y++) img.data.set(px.subarray((PORTRAIT - 1 - y) * PORTRAIT * 4, (PORTRAIT - y) * PORTRAIT * 4), y * PORTRAIT * 4);
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

export class Battle {
  // fighters: { player: { name, hp, maxHp, sp, maxSp, pos, picture }, enemy: { ...same } }
  // player.actor = the Player (moved and animated during attacks); enemy.model =
  // its 3D object (wobbles when hit). fx = shake / dust.
  constructor({ ui, input, camera, player, enemy, fx, onEnd }) {
    this.ui = ui; this.input = input; this.camera = camera;
    this.player = player; this.enemy = enemy; this.onEnd = onEnd; this.fx = fx;
    this.phase = 'menu'; this.pt = 0;
    this.wobble = 0; this.wobbleV = 0; this.fallen = 0;
    this.menu = 'main';
    this.sel = 0;
    this.lock = 0.3;             // ignore input for a moment so the starting press doesn't pick anything
    this.ending = false;
    this.t = 0;
    this.build();
    this.say(`${enemy.name} stands in your way!`);
  }

  slot(f, side) {
    const el = document.createElement('div');
    el.className = `bslot ${side}`;
    el.innerHTML = `
      <img class="bpic" src="${f.picture}" alt="">
      <div class="bpanel">
        <div class="bname">${f.name}</div>
        <div class="bstat hp"><span class="lbl">Health</span><div class="bar"><i></i></div><span class="num"></span></div>
        <div class="bstat sp"><span class="lbl">Stamina</span><div class="bar"><i></i></div><span class="num"></span></div>
      </div>`;
    f.el = el;
    return el;
  }

  refresh() {
    for (const f of [this.player, this.enemy]) {
      const set = (cls, v, m) => {
        f.el.querySelector(`.${cls} i`).style.width = `${(v / m) * 100}%`;
        f.el.querySelector(`.${cls} .num`).textContent = `${v} / ${m}`;
      };
      set('hp', f.hp, f.maxHp);
      set('sp', f.sp, f.maxSp);
    }
  }

  build() {
    const ui = this.ui;
    ui.innerHTML = '';
    ui.append(this.slot(this.player, 'left'), this.slot(this.enemy, 'right'));
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

  showMenu(kind) {
    this.menu = kind;
    this.sel = 0;
    const P = this.player;
    const items = kind === 'main'
      ? [['Fight', () => this.showMenu('fight')], ['Item', () => this.showMenu('items')], ['Run', () => this.run()]]
      : kind === 'fight'
        ? [...MOVES.map((m) => [m.name, P.sp >= m.cost ? () => this.useMove(m) : null, m.cost ? `${m.cost} SP` : '', m.desc]), ['Back', () => this.showMenu('main'), '', '']]
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
      b.addEventListener('click', (e) => { e.stopPropagation(); if (fn && !this.ending) fn(); });
      this.cmds.append(b);
    });
    if (!items[this.sel][1]) this.sel = items.findIndex(([, fn]) => fn);
    this.highlight();
  }

  highlight() {
    [...this.cmds.children].forEach((b, i) => b.classList.toggle('sel', i === this.sel));
    // in the moves list, describe the one you're on
    if (this.menu === 'fight') {
      const [name, fn, , desc] = this.items[this.sel];
      this.say(desc ? (fn ? desc : `${desc} Not enough Stamina.`) : 'What will you do?');
    } else if (this.menu === 'main' && this.t > 0) this.say('What will you do?');
  }

  // --- Turns -------------------------------------------------------------------------
  setPhase(p) { this.phase = p; this.pt = 0; }

  busy(on) { this.cmds.classList.toggle('gone', on); }

  useMove(m) {
    const P = this.player;
    this.busy(true);
    this.menu = 'none';
    if (m.rest) {
      P.sp = Math.min(P.maxSp, P.sp + m.rest);
      this.refresh();
      this.popup(P, `+${m.rest} SP`, 'sp');
      this.say('You catch your breath.');
      this.setPhase('rest');
      return;
    }
    P.sp -= m.cost;
    this.refresh();
    this.move = m;
    this.hitIndex = 0;
    this.dealt = 0;
    this.say(`You use ${m.name}!`);
    this.setPhase('approach');
  }

  // A number that pops up over a fighter and floats away.
  popup(f, text, cls) {
    const el = document.createElement('div');
    el.className = `bdmg ${cls}`;
    el.textContent = text;
    this.ui.append(el);
    const v = f.pos.clone(); v.y += 2.3;
    v.project(this.camera);
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    setTimeout(() => el.remove(), 1100);
  }

  damage(f, n) {
    f.hp = Math.max(0, f.hp - n);
    this.popup(f, `-${n}`, f === this.player ? 'bad' : 'good');
    this.refresh();
    if (this.onDamage) this.onDamage(f);
  }

  // Run the actor towards a point; true once there.
  runTo(actor, x, z, near) {
    const dx = x - actor.pos.x, dz = z - actor.pos.z, d = Math.hypot(dx, dz);
    if (d < near) { actor.fwd = 0; return true; }
    actor.yaw = Math.atan2(dx, dz);
    actor.fwd = Math.min(RUN_SPEED, d * 6);
    return false;
  }

  faceEnemy() {
    const a = this.player.actor, e = this.enemy.pos;
    a.yaw = Math.atan2(e.x - a.pos.x, e.z - a.pos.z);
  }

  turns(dt) {
    const P = this.player, E = this.enemy, a = P.actor;
    this.pt += dt;
    switch (this.phase) {
      case 'approach':
        if (this.runTo(a, E.pos.x, E.pos.z, 1.5) || this.pt > 2.5) { a.fwd = 0; this.faceEnemy(); a.setState(this.move.hits[0].state); this.setPhase('strike'); }
        break;
      case 'strike': {
        const h = this.move.hits[this.hitIndex];
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
          if (next && E.hp > 0) { this.faceEnemy(); a.state = ''; a.setState(next.state); this.pt = 0; }
          else { this.say(`${this.move.name} hits the ${E.name} for ${this.dealt}!`); this.setPhase('return'); }
        }
        break;
      }
      case 'return':
        if (this.runTo(a, P.pos.x, P.pos.z, 0.15) || this.pt > 2.5) {
          a.pos.x = P.pos.x; a.pos.z = P.pos.z; a.fwd = 0; this.faceEnemy();
          this.setPhase(E.hp <= 0 ? 'win' : 'enemyTurn');
        }
        break;
      case 'rest':
        if (this.pt > 1.1) this.setPhase('enemyTurn');
        break;
      case 'enemyTurn':
        if (this.pt === dt) this.say(`The ${E.name} ${E.attackText || 'attacks'}!`);
        if (this.pt > 0.45 && !this.swung) { this.swung = true; this.wobbleV -= 9; }   // lurch towards you
        if (this.pt > 0.75 && !this.hit) {
          this.hit = true;
          this.damage(P, E.atk);
          a.anim.sq = -0.3; a.invuln = 0.7;
          a.say('hurt');
          this.fx.shake(0.35);
          this.say(`The ${E.name} hits you for ${E.atk}.`);
        }
        if (this.pt > 1.7) {
          this.hit = false; this.swung = false;
          if (P.hp <= 0) { this.setPhase('lose'); break; }
          P.sp = Math.min(P.maxSp, P.sp + REGEN);
          this.refresh();
          this.setPhase('menu');
          this.say('What will you do?');
          this.busy(false);
          this.showMenu('main');
        }
        break;
      case 'win':
        if (this.pt === dt) this.say(`You defeated the ${E.name}!`);
        this.fallen = Math.min(1, this.fallen + dt * 2.2);
        if (this.pt > 2.0) { this.setPhase('done'); this.end(); }
        break;
      case 'lose':
        if (this.pt === dt) this.say('You were knocked out...');
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

  run() {
    this.ending = true;
    this.say('You got away safely!');
    this.cmds.classList.add('gone');
    setTimeout(() => this.end(), 900);
  }

  end() {
    this.ui.classList.remove('on');
    if (this.enemy.model) this.enemy.model.rotation.set(0, this.enemy.model.rotation.y, 0);   // the dummy stands back up
    this.onEnd({ won: this.enemy.hp <= 0, lost: this.player.hp <= 0 });
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
    // side-on view of the two fighters, drifting slightly
    const a = this.player.pos, b = this.enemy.pos;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const across = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const side = new THREE.Vector3(-across.z, 0, across.x);
    const sway = Math.sin(this.t * 0.4) * 0.4;
    this.camera.position.copy(mid).addScaledVector(side, 8.5).addScaledVector(across, sway).add(new THREE.Vector3(0, 3.2, 0));
    this.camera.lookAt(mid.x, mid.y + 1.1, mid.z);
  }
}
