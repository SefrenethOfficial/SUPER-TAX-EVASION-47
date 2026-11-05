import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Turn-based battles. Exploring stops, the camera swings round to a side view
// of the two fighters, and the battle UI comes up:
//   - a battle slot for each side: a little checkered panel with the fighter's
//     Health and Stamina on it, and a picture of the fighter above it
//   - the command menu: Fight, Item, Run
// Pick with the stick / arrow keys and A (Space), or click. B goes back.
// ---------------------------------------------------------------------------

const PORTRAIT = 128;

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
  constructor({ ui, input, camera, player, enemy, onEnd }) {
    this.ui = ui; this.input = input; this.camera = camera;
    this.player = player; this.enemy = enemy; this.onEnd = onEnd;
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
    const items = kind === 'main'
      ? [['Fight', () => this.fight()], ['Item', () => this.showMenu('items')], ['Run', () => this.run()]]
      : [['(no items)', null], ['Back', () => this.showMenu('main')]];
    this.items = items;
    this.cmds.innerHTML = '';
    items.forEach(([label, fn], i) => {
      const b = document.createElement('button');
      b.textContent = label;
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
  }

  // Fight does nothing yet.
  fight() {}

  run() {
    this.ending = true;
    this.say('You got away safely!');
    this.cmds.classList.add('gone');
    setTimeout(() => this.end(), 900);
  }

  end() {
    this.ui.classList.remove('on');
    this.onEnd();
  }

  update(dt) {
    this.t += dt;
    this.lock -= dt;
    const inp = this.input;
    if (this.lock <= 0 && !this.ending) {
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
