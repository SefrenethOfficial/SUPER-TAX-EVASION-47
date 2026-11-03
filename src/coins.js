import * as THREE from 'three';

// Spinning collectible coins. Touch one to collect it.
const PICKUP_RADIUS = 0.85;
const SIZE = 0.75;

export class Coins {
  constructor(scene, texture, fx) {
    this.scene = scene;
    this.fx = fx;
    this.count = 0;
    this.onCollect = () => {};
    this.items = [];
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    this.geo = new THREE.PlaneGeometry(SIZE, SIZE);
    this.mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, alphaTest: 0.5 });
    this.audio = null;
    this.sound = null;   // optional () => bool; falls back to a synth ding
  }

  // Coins are drawn as one instanced mesh, created on the first update.
  add(x, y, z) {
    const m = { position: new THREE.Vector3(x, y, z), rotation: { y: Math.random() * Math.PI } };
    this.items.push({ m, base: y, alive: true, phase: Math.random() * 6 });
  }

  ensureMesh() {
    if (this.mesh) return;
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, Math.max(1, this.items.length));
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1);
    this._zero = new THREE.Vector3(0, 0, 0); this._up = new THREE.Vector3(0, 1, 0);
  }

  line(from, to, n) {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0 : i / (n - 1);
      this.add(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k);
    }
  }

  ring(cx, y, cz, r, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    }
  }

  get total() { return this.items.length; }

  update(dt, playerPos) {
    this.ensureMesh();
    const px = playerPos.x, py = playerPos.y + 0.8, pz = playerPos.z;
    for (let i = 0; i < this.items.length; i++) {
      const c = this.items[i];
      if (!c.alive) { this.mesh.setMatrixAt(i, this._m4.compose(c.m.position, this._q, this._zero)); continue; }
      c.phase += dt;
      c.m.rotation.y += dt * 5;
      c.m.position.y = c.base + Math.sin(c.phase * 2.5) * 0.05;
      const dx = c.m.position.x - px, dy = c.m.position.y - py, dz = c.m.position.z - pz;
      if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS && Math.abs(dy) < 1.15) {
        c.alive = false;
        this.count++;
        this.fx.sparkle(c.m.position);
        if (!(this.sound && this.sound())) this.ding();
        this.onCollect(this.count);
      }
      if (c.alive) this.mesh.setMatrixAt(i, this._m4.compose(c.m.position, this._q.setFromAxisAngle(this._up, c.m.rotation.y), this._s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Unlock audio after a user gesture (browsers block it before that).
  unlockAudio() {
    if (this.audio) return;
    try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { this.audio = null; }
  }

  ding() {
    const ac = this.audio;
    if (!ac) return;
    const t = ac.currentTime;
    const gain = ac.createGain();
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    for (const [f, at] of [[1318.5, 0], [1975.5, 0.07]]) {
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(f, t + at);
      const g = ac.createGain();
      g.gain.setValueAtTime(at ? 0 : 0.5, t);
      g.gain.setValueAtTime(0.5, t + at);
      o.connect(g); g.connect(gain);
      o.start(t + at); o.stop(t + (at ? 0.36 : 0.075));
    }
  }
}
