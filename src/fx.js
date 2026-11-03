import * as THREE from 'three';

// Dust puffs, ground-pound shockwave and camera shake.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.trauma = 0;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.pool = [];
    for (let i = 0; i < 80; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xe8dcc0, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, life: 0, max: 1, v: new THREE.Vector3() });
    }
    this.next = 0;
    this.rings = [];
  }

  dust(pos, n = 4) {
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.next];
      this.next = (this.next + 1) % this.pool.length;
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      p.s.position.set(pos.x + Math.cos(a) * 0.2, pos.y + 0.15 + Math.random() * 0.2, pos.z + Math.sin(a) * 0.2);
      p.v.set(Math.cos(a) * sp, 0.6 + Math.random() * 1.2, Math.sin(a) * sp);
      p.life = p.max = 0.45 + Math.random() * 0.3;
      p.s.visible = true;
    }
  }

  ring(pos) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.95, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, pos.y + 0.05, pos.z);
    this.scene.add(m);
    this.rings.push({ m, t: 0 });
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  update(dt) {
    for (const p of this.pool) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const k = p.life / p.max;
      p.s.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(1 - 3 * dt);
      const sc = 0.25 + (1 - k) * 0.6;
      p.s.scale.set(sc, sc, sc);
      p.s.material.opacity = k * 0.8;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / 0.45;
      r.m.scale.setScalar(1 + k * 4);
      r.m.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }
}
