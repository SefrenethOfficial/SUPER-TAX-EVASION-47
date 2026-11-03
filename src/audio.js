// Music and sound effects. Browsers only allow audio after a click or key
// press, so call unlock() from the start screen.
export class GameAudio {
  constructor(version) {
    this.version = version;
    this.ctx = null;
    this.buffers = {};
    this.tracks = {};
    this.current = null;
    this.unlocked = false;
    this.muted = false;
    try { this.muted = localStorage.getItem('ste47-muted') === '1'; } catch (_) { /* storage blocked */ }
  }

  track(file) {
    if (!this.tracks[file]) {
      const a = new Audio(`assets/${file}?v=${this.version}`);
      a.preload = 'auto';
      a.volume = 0.45;
      this.tracks[file] = a;
    }
    return this.tracks[file];
  }

  // Switch background music (loops). Same track keeps playing.
  music(file) {
    const a = file ? this.track(file) : null;
    if (this.current === a) return;
    if (this.current) { this.current.pause(); }
    this.current = a;
    if (!a) return;
    a.loop = true;
    a.currentTime = 0;
    a.muted = this.muted;
    if (this.unlocked) a.play().catch(() => {});
  }

  // Play a one-off piece of music (stops the background track); calls done() at the end.
  jingle(file, done) {
    this.music(null);
    const a = this.track(file);
    a.loop = false; a.currentTime = 0; a.muted = this.muted;
    let fired = false;
    const finish = () => { if (fired) return; fired = true; a.onended = null; if (done) done(); };
    a.onended = finish;
    // backup in case 'ended' never fires (blocked audio, muted tab, etc.)
    setTimeout(finish, ((isFinite(a.duration) && a.duration > 0 ? a.duration : 6.8) + 0.8) * 1000);
    a.play().catch(() => {});
  }

  unlock() {
    this.unlocked = true;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.load('coin', 'coin.wav');
      } catch (_) { this.ctx = null; }
    } else if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.current) this.current.play().catch(() => {});
  }

  async load(name, file) {
    try {
      const res = await fetch(`assets/${file}?v=${this.version}`);
      this.buffers[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) { console.warn('sound failed to load', file, e); }
  }

  play(name, volume = 0.6) {
    if (this.muted || !this.ctx || !this.buffers[name]) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    for (const a of Object.values(this.tracks)) a.muted = this.muted;
    try { localStorage.setItem('ste47-muted', this.muted ? '1' : '0'); } catch (_) { /* ignore */ }
    return this.muted;
  }
}
