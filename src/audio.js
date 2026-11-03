// Music and sound effects, all through Web Audio so music loops are gapless
// and start exactly on the beat. Browsers only allow audio after a click or
// key press, so call unlock() from the start screen.
const MUSIC_VOL = 0.45;
// Sound effects preloaded on unlock (assets/<name>.wav).
const SFX = ['coin', 'star-appears', 'spotted', 'hurt', 'whoa', 'yahoo', 'oof', 'hoohoo', 'here-we-go', 'haha'];

export class GameAudio {
  constructor(version) {
    this.version = version;
    this.ctx = null;
    this.buffers = {};     // name -> AudioBuffer
    this.loading = {};     // name -> Promise<AudioBuffer>
    this.want = null;      // music we want playing
    this.src = null;       // current music source
    this.muted = false;
    try { this.muted = localStorage.getItem('ste47-muted') === '1'; } catch (_) { /* storage blocked */ }
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.muted ? 0 : MUSIC_VOL;
        this.musicGain.connect(this.ctx.destination);
        for (const n of SFX) this.buffer(`${n}.wav`);
      } catch (_) { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.want && !this.src) this.music(this.want, true);
  }

  buffer(file) {
    if (this.buffers[file]) return Promise.resolve(this.buffers[file]);
    if (!this.loading[file]) {
      this.loading[file] = fetch(`assets/${file}?v=${this.version}`)
        .then((r) => r.arrayBuffer())
        .then((a) => this.ctx.decodeAudioData(a))
        .then((b) => (this.buffers[file] = b))
        .catch((e) => { console.warn('sound failed to load', file, e); delete this.loading[file]; return null; });
    }
    return this.loading[file];
  }

  stopMusic() {
    if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (_) { /* already stopped */ } }
    this.src = null;
  }

  // Switch background music (loops). Asking for the track already playing does nothing.
  music(file, force = false) {
    if (!force && file === this.want && this.src) return;
    this.want = file;
    this.stopMusic();
    if (!file || !this.ctx) return;
    this.buffer(file).then((buf) => {
      if (!buf || this.want !== file || this.src) return;
      const s = this.ctx.createBufferSource();
      s.buffer = buf; s.loop = true;
      s.connect(this.musicGain);
      s.start();
      this.src = s;
    });
  }

  // A one-off piece of music (stops the background track); done() when it ends.
  jingle(file, done) {
    this.want = null;
    this.stopMusic();
    let fired = false;
    const finish = () => { if (fired) return; fired = true; if (done) done(); };
    if (!this.ctx) { setTimeout(finish, 4000); return; }
    this.buffer(file).then((buf) => {
      if (!buf) { setTimeout(finish, 4000); return; }
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      s.connect(this.musicGain);
      s.onended = finish;
      s.start();
      this.src = s;
      setTimeout(finish, (buf.duration + 0.5) * 1000);   // backup if 'ended' never fires
    });
  }

  play(name, volume = 0.6) {
    const buf = this.buffers[name.includes('.') ? name : `${name}.wav`];
    if (this.muted || !this.ctx || !buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
    return true;
  }

  // A voice line: cuts off the previous one so they never pile up.
  voice(name, volume = 0.75) {
    const buf = this.buffers[`${name}.wav`];
    if (this.muted || !this.ctx || !buf) return;
    if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch (_) { /* done */ } }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
    this.voiceSrc = src;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.musicGain) this.musicGain.gain.value = this.muted ? 0 : MUSIC_VOL;
    try { localStorage.setItem('ste47-muted', this.muted ? '1' : '0'); } catch (_) { /* ignore */ }
    return this.muted;
  }
}
