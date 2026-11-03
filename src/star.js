import * as THREE from 'three';

// The stage's star: spins at the goal, collected by touching it.
export class Star {
  constructor(scene, pos, fx) {
    this.fx = fx;
    this.onGet = () => {};
    this.got = false;
    const shape = new THREE.Shape();
    const R = 0.75, r = 0.32;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 ? r : R;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 2 });
    geo.center();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x7a5600, metalness: 0.35, roughness: 0.3 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.base = pos.clone();
    this.mesh.position.copy(pos);
    scene.add(this.mesh);
    this.light = new THREE.PointLight(0xffe07a, 6, 7, 1.5);
    this.light.position.copy(pos);
    scene.add(this.light);
    this.t = 0;
  }

  update(dt, playerPos) {
    if (this.got) return;
    this.t += dt;
    this.mesh.rotation.y += dt * 2.2;
    this.mesh.position.y = this.base.y + Math.sin(this.t * 2) * 0.12;
    const dx = this.mesh.position.x - playerPos.x, dz = this.mesh.position.z - playerPos.z;
    const dy = this.mesh.position.y - (playerPos.y + 0.8);
    if (dx * dx + dz * dz < 1.1 * 1.1 && Math.abs(dy) < 1.3) {
      this.got = true;
      this.mesh.visible = false;
      this.light.visible = false;
      for (let i = 0; i < 3; i++) this.fx.sparkle(this.mesh.position, 14);
      this.onGet();
    }
  }
}
