// ---------------------------------------------------------------------------
// Dialogue box: a speaker's name, text that types itself out, and optional
// choices. A (Space), B or a click skips the typing, then moves on. Choices are
// picked with the stick / arrow keys and A, or clicked.
//
//   const pick = await dialogue.say([
//     { who: 'Ghost', text: 'Hello...' },
//     { who: 'Ghost', text: 'Want to learn?', choices: ['Yes', 'No'] },
//   ]);   // pick = index of the last choice made (or -1)
// ---------------------------------------------------------------------------

const CPS = 48;   // characters per second

export class Dialogue {
  constructor(el, input) {
    this.el = el; this.input = input;
    this.active = false;
    el.innerHTML = '<div class="dname"></div><div class="dtext"></div><div class="dchoices"></div><div class="dnext">▼</div>';
    this.nameEl = el.querySelector('.dname');
    this.textEl = el.querySelector('.dtext');
    this.choiceEl = el.querySelector('.dchoices');
    el.addEventListener('click', (e) => { e.stopPropagation(); if (!this.line?.choices) this.advance(); });
  }

  say(lines) {
    this.lines = lines; this.i = -1; this.pick = -1;
    this.active = true;
    this.el.classList.add('on');
    this.lock = 0.25;
    return new Promise((res) => { this.done = res; this.next(); });
  }

  next() {
    this.i++;
    if (this.i >= this.lines.length) { this.close(); return; }
    this.line = this.lines[this.i];
    this.shown = 0;
    this.nameEl.textContent = this.line.who || '';
    this.nameEl.style.display = this.line.who ? '' : 'none';
    this.textEl.textContent = '';
    this.choiceEl.innerHTML = '';
    this.el.classList.remove('ready', 'choosing');
    if (this.line.onShow) this.line.onShow();
  }

  typed() { return this.shown >= this.line.text.length; }

  showChoices() {
    this.sel = 0;
    this.el.classList.add('choosing');
    this.line.choices.forEach((c, k) => {
      const b = document.createElement('button');
      b.textContent = c;
      b.addEventListener('mouseenter', () => { this.sel = k; this.mark(); });
      b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(k); });
      this.choiceEl.append(b);
    });
    this.mark();
  }

  mark() { [...this.choiceEl.children].forEach((b, k) => b.classList.toggle('sel', k === this.sel)); }

  choose(k) {
    this.pick = k;
    if (this.line.then) { const more = this.line.then(k); if (more) this.lines.splice(this.i + 1, 0, ...more); }
    this.next();
  }

  advance() {
    if (!this.active) return;
    if (!this.typed()) { this.shown = this.line.text.length; this.textEl.textContent = this.line.text; this.ready(); return; }
    if (this.line.choices) return;
    this.next();
  }

  ready() {
    if (this.line.choices) { if (!this.el.classList.contains('choosing')) this.showChoices(); }
    else this.el.classList.add('ready');
  }

  close() {
    this.active = false;
    this.el.classList.remove('on', 'ready', 'choosing');
    const d = this.done; this.done = null;
    if (d) d(this.pick);
  }

  update(dt) {
    if (!this.active) return;
    this.lock -= dt;
    if (!this.typed()) {
      this.shown = Math.min(this.line.text.length, this.shown + CPS * dt);
      this.textEl.textContent = this.line.text.slice(0, Math.floor(this.shown));
      if (this.typed()) this.ready();
    }
    if (this.lock > 0) return;
    const inp = this.input;
    if (this.line.choices && this.typed()) {
      const y = inp.move.y;
      if (Math.abs(y) > 0.5 && !this.held) {
        this.held = true;
        const n = this.line.choices.length;
        this.sel = (this.sel + (y > 0 ? -1 : 1) + n) % n;
        this.mark();
      }
      if (Math.abs(y) < 0.3) this.held = false;
      if (inp.pressed.A) this.choose(this.sel);
      return;
    }
    if (inp.pressed.A || inp.pressed.B) this.advance();
  }
}
