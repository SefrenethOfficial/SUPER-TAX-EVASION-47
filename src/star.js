import * as THREE from 'three';

// A star: spins in place, collected by touching it. If `drop` is set it
// floats down from above first (e.g. when the boss is beaten).
export class Star {
  // ghost: a star you already have shows see-through blue (still collectable)
  constructor(scene, model, pos, fx, { drop = false, ghost = false } = {}) {
    this.fx = fx;
    this.scene = scene;
    this.onGet = () => {};
    this.got = false;
    this.mesh = new THREE.Group();
    const m = model.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.6 / Math.max(size.x, size.y);
    m.scale.setScalar(k);
    m.position.set(-(box.min.x + box.max.x) / 2 * k, -(box.min.y + box.max.y) / 2 * k, -(box.min.z + box.max.z) / 2 * k);
    m.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.material = o.material.clone();
      o.material.emissiveIntensity = 0.6;
      if (ghost) {
        o.material.color.set(0x6fa8ff); o.material.emissive?.set(0x1a3a8a);
        o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false;
      }
    });
    this.mesh.add(m);
    this.base = pos.clone();
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
    this.light = new THREE.PointLight(0xffe07a, 8, 8, 1.5);
    this.light.position.copy(pos);
    scene.add(this.light);
    this.t = 0;
    this.dropping = drop;
    if (drop) this.mesh.position.y = pos.y + 7;
  }

  update(dt, playerPos) {
    this.t += dt;
    if (this.held) return;
    if (this.got) return;
    this.mesh.rotation.y += dt * 2.4;
    if (this.dropping) {
      this.mesh.position.y -= dt * 3;
      if (Math.random() < 0.4) this.fx.sparkle(this.mesh.position, 1);
      if (this.mesh.position.y <= this.base.y) { this.mesh.position.y = this.base.y; this.dropping = false; this.t = 0; }
      this.light.position.copy(this.mesh.position);
      return;
    }
    this.mesh.position.y = this.base.y + Math.sin(this.t * 2) * 0.15;
    this.light.position.copy(this.mesh.position);
    const dx = this.mesh.position.x - playerPos.x, dz = this.mesh.position.z - playerPos.z;
    const dy = this.mesh.position.y - (playerPos.y + 0.8);
    if (dx * dx + dz * dz < 1.2 * 1.2 && Math.abs(dy) < 1.5) {
      this.got = true;
      for (let i = 0; i < 3; i++) this.fx.sparkle(this.mesh.position, 14);
      this.onGet();
    }
  }

  // During the celebration the star is held above the player's head.
  hold(pos, dt) {
    this.held = true;
    this.mesh.position.lerp(pos, 1 - Math.exp(-12 * dt));
    this.mesh.rotation.y += dt * 3;
    this.light.position.copy(this.mesh.position);
  }
}
