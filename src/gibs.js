import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Pieces flying off things that die: each part keeps its look, gets flung,
// spins, falls, bounces on the ground and settles, then (optionally) sinks
// away. ground(x, z) -> height.
// ---------------------------------------------------------------------------
export class Gibs {
  constructor(scene, ground) { this.scene = scene; this.ground = ground; this.list = []; }

  // Fling an object (taken out of whatever it was part of, keeping where it was in the world).
  fling(obj, vel, { spin = 10, life = 4 } = {}) {
    this.scene.attach(obj);
    this.list.push({ m: obj, vel: vel.clone(), spin: new THREE.Vector3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin), life, t: 0, rest: false });
  }

  // Break a model into its separate meshes and throw them all outward from `from`.
  shatter(model, from, power = 6) {
    const parts = [];
    model.traverse((o) => { if (o.isMesh && !o.userData.noGib) parts.push(o); });
    model.updateMatrixWorld(true);
    const c = new THREE.Vector3();
    for (const o of parts) {
      o.getWorldPosition(c);
      const d = c.clone().sub(from); d.y = Math.max(0.3, d.y); d.normalize();
      this.fling(o, d.multiplyScalar(power * (0.6 + Math.random() * 0.8)).add(new THREE.Vector3(0, 3 + Math.random() * 3, 0)), { spin: 14, life: 3 + Math.random() });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i], m = g.m;
      g.t += dt;
      if (!g.rest) {
        g.vel.y -= 22 * dt;
        m.position.addScaledVector(g.vel, dt);
        m.rotation.x += g.spin.x * dt; m.rotation.y += g.spin.y * dt; m.rotation.z += g.spin.z * dt;
        const fy = this.ground(m.position.x, m.position.z);
        if (Number.isFinite(fy) && m.position.y < fy + 0.1) {
          m.position.y = fy + 0.1;
          g.vel.y = Math.abs(g.vel.y) * 0.3; g.vel.x *= 0.55; g.vel.z *= 0.55; g.spin.multiplyScalar(0.5);
          if (g.vel.length() < 1) g.rest = true;
        }
      }
      // sink into the ground at the end
      if (g.t > g.life) m.position.y -= dt * 0.5;
      if (g.t > g.life + 1.5) { this.scene.remove(m); this.list.splice(i, 1); }
    }
  }
}
