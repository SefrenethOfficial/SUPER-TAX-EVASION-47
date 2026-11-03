// Music and sound effects. Browsers only allow audio after a click or key
// press, so call unlock() from the start screen.
export class GameAudio {
  constructor(version, music) {
    this.version = version;
    this.ctx = null;
    this.buffers = {};
    this.music = new Audio(`assets/${music}?v=${version}`);
    this.music.loop = true;
    this.music.volume = 0.45;
    this.music.preload = 'auto';
    this.muted = false;
    try { this.muted = localStorage.getItem('ste47-muted') === '1'; } catch (_) { /* storage blocked */ }
    this.music.muted = this.muted;
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.load('coin', 'coin.wav');
      } catch (_) { this.ctx = null; }
    } else if (this.ctx.state === 'suspended') this.ctx.resume();
    this.music.play().catch(() => {});
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
    this.music.muted = this.muted;
    try { localStorage.setItem('ste47-muted', this.muted ? '1' : '0'); } catch (_) { /* ignore */ }
    return this.muted;
  }
}
