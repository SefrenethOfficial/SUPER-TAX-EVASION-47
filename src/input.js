// Unified input: keyboard + mouse, gamepad, and touch.
// Exposes an analog move stick, camera deltas and three action buttons
// named after the N64 layout: A (jump), B (attack), Z (crouch / ground pound).

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };          // stick, y = forward
    this.cam = { x: 0, y: 0 };           // accumulated camera delta (radians-ish)
    this.zoom = 0;
    this.buttons = { A: false, B: false, Z: false };
    this.prev = { A: false, B: false, Z: false };
    this.pressed = { A: false, B: false, Z: false };
    this.mouseButtons = { B: false, Z: false };
    this.pointerLocked = false;
    this.usingGamepad = false;
    this.touch = { active: false, stickId: null, camId: null, sx: 0, sy: 0, x: 0, y: 0, A: false, B: false, Z: false, lastCam: null };

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      this.usingGamepad = false;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (e.button === 0) this.mouseButtons.B = true;
      if (e.button === 2) this.mouseButtons.Z = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseButtons.B = false;
      if (e.button === 2) this.mouseButtons.Z = false;
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.cam.x += e.movementX * 0.0035;
        this.cam.y += e.movementY * 0.0025;
      }
    });
    dom.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === dom;
    });

    this._setupTouch();
  }

  requestLock() {
    if (this.dom.requestPointerLock && !('ontouchstart' in window && navigator.maxTouchPoints > 0)) {
      try { this.dom.requestPointerLock(); } catch (_) { /* ignore */ }
    }
  }

  _setupTouch() {
    const ui = document.getElementById('touch');
    if (!ui) return;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    ui.classList.add('on');
    this.touch.active = true;
    const stick = ui.querySelector('.stick');
    const knob = ui.querySelector('.knob');
    const btn = (name) => {
      const el = ui.querySelector(`[data-btn="${name}"]`);
      const set = (v) => (e) => { e.preventDefault(); this.touch[name] = v; el.classList.toggle('down', v); };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false), { passive: false });
      el.addEventListener('touchcancel', set(false), { passive: false });
    };
    ['A', 'B', 'Z'].forEach(btn);

    const R = 55;
    addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('[data-btn]')) continue;
        if (t.clientX < innerWidth * 0.45 && this.touch.stickId === null) {
          this.touch.stickId = t.identifier;
          this.touch.sx = t.clientX; this.touch.sy = t.clientY;
          stick.style.left = `${t.clientX - 70}px`; stick.style.top = `${t.clientY - 70}px`;
          stick.classList.add('show');
        } else if (this.touch.camId === null) {
          this.touch.camId = t.identifier;
          this.touch.lastCam = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });
    addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stickId) {
          let dx = t.clientX - this.touch.sx, dy = t.clientY - this.touch.sy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          this.touch.x = dx / R; this.touch.y = -dy / R;
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === this.touch.camId) {
          this.cam.x += (t.clientX - this.touch.lastCam.x) * 0.006;
          this.cam.y += (t.clientY - this.touch.lastCam.y) * 0.004;
          this.touch.lastCam = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stickId) {
          this.touch.stickId = null; this.touch.x = 0; this.touch.y = 0;
          knob.style.transform = ''; stick.classList.remove('show');
        } else if (t.identifier === this.touch.camId) {
          this.touch.camId = null;
        }
      }
    };
    addEventListener('touchend', end, { passive: true });
    addEventListener('touchcancel', end, { passive: true });
  }

  update(dt) {
    const k = this.keys;
    let mx = 0, my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) my += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    // Keyboard is digital, so hold Alt / C to walk.
    const walk = k.has('AltLeft') || k.has('KeyC');
    let len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; if (walk) { mx *= 0.4; my *= 0.4; } }

    let A = k.has('Space');
    let B = k.has('KeyJ') || k.has('KeyX') || this.mouseButtons.B;
    let Z = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyK') || this.mouseButtons.Z;

    if (k.has('KeyQ')) this.cam.x -= 2.6 * dt;
    if (k.has('KeyE')) this.cam.x += 2.6 * dt;
    if (k.has('KeyR')) this.cam.y -= 1.5 * dt;
    if (k.has('KeyF')) this.cam.y += 1.5 * dt;

    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const gx = dz(p.axes[0] || 0), gy = -dz(p.axes[1] || 0);
      if (Math.hypot(gx, gy) > 0.01) { mx = gx; my = gy; this.usingGamepad = true; }
      const cx = dz(p.axes[2] || 0), cy = dz(p.axes[3] || 0);
      this.cam.x += cx * 3.0 * dt;
      this.cam.y += cy * 1.8 * dt;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      if (b(0)) { A = true; this.usingGamepad = true; }
      if (b(2) || b(1)) { B = true; this.usingGamepad = true; }
      if (b(6) || b(7) || b(4) || b(5)) { Z = true; this.usingGamepad = true; }
      break;
    }

    // Touch
    if (this.touch.active) {
      if (this.touch.stickId !== null) { mx = this.touch.x; my = this.touch.y; }
      A = A || this.touch.A; B = B || this.touch.B; Z = Z || this.touch.Z;
    }

    len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;

    this.buttons.A = A; this.buttons.B = B; this.buttons.Z = Z;
    for (const n of ['A', 'B', 'Z']) {
      this.pressed[n] = this.buttons[n] && !this.prev[n];
      this.prev[n] = this.buttons[n];
    }
  }

  consumeCam() {
    const c = { x: this.cam.x, y: this.cam.y, zoom: this.zoom };
    this.cam.x = 0; this.cam.y = 0; this.zoom = 0;
    return c;
  }
}
