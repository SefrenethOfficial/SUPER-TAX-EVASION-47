import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The shy ghost. At first it's just a dark figure floating up ahead. Get close
// and it backs away from you, always facing you, until it's pinned against the
// edge of its patch of beach. Corner it and the darkness fades off it: it's a
// shy ghost, and it talks to you.
// ---------------------------------------------------------------------------

const NOTICE = 15;       // starts backing off when you're this close
const FLEE_SPEED = 9.6;  // as fast as you run, so you can't just catch it in the open
const CORNER = 3.4;      // pinned and you're this close: cornered
const HOVER = 1.1;       // floats this high off the ground

export class ShyGhost {
  // model: the ghost's scene (materials already set up); region: { minX, maxX, minZ, maxZ };
  // ground(x, z) -> height
  constructor(scene, model, { pos, region, ground, height = 1.8 }) {
    this.ground = ground;
    this.region = region;
    this.root = new THREE.Group();
    // fit the model to `height` metres, feet at the root
    const box = new THREE.Box3().setFromObject(model);
    const k = height / (box.max.y - box.min.y);
    model.scale.multiplyScalar(k);
    model.position.y -= box.min.y * k;
    model.position.x -= ((box.min.x + box.max.x) / 2) * k;
    model.position.z -= ((box.min.z + box.max.z) / 2) * k;
    this.root.add(model);
    this.mats = [];
    model.traverse((o) => { if (o.isMesh) this.mats.push(o.material); });
    this.reveal = 0;          // 0 = a dark shape, 1 = fully seen
    this.setLook();
    // a faint shadow under it
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.root, this.shadow);
    this.pos = new THREE.Vector3(pos.x, 0, pos.z);
    this.yaw = 0;
    this.t = Math.random() * 10;
    this.state = 'lurk';
    this.pinned = false;
  }

  // Darkness: black and see-through, fading to its real colours.
  setLook() {
    const r = this.reveal;
    for (const m of this.mats) {
      m.color.setRGB(0.06 + 0.94 * r, 0.05 + 0.95 * r, 0.09 + 0.91 * r);
      m.transparent = r < 1;
      m.opacity = 0.78 + 0.22 * r;
      m.depthWrite = r >= 1;
    }
  }

  // Keep inside the region; returns true if it had to be pushed back in.
  clamp() {
    const R = this.region;
    const x = Math.max(R.minX, Math.min(R.maxX, this.pos.x)), z = Math.max(R.minZ, Math.min(R.maxZ, this.pos.z));
    const hit = x !== this.pos.x || z !== this.pos.z;
    this.pos.x = x; this.pos.z = z;
    return hit;
  }

  update(dt, player) {
    this.t += dt;
    const dx = this.pos.x - player.pos.x, dz = this.pos.z - player.pos.z, d = Math.hypot(dx, dz) || 1e-6;
    if (this.state === 'lurk' && d < NOTICE) this.state = 'flee';
    if (this.state === 'flee') {
      // back away, faster the closer you are
      const sp = FLEE_SPEED * Math.min(1, 0.3 + Math.max(0, NOTICE - d) / 9);
      if (d < NOTICE + 3) {
        this.pos.x += (dx / d) * sp * dt;
        this.pos.z += (dz / d) * sp * dt;
      }
      // pinned in a corner (or right up against an edge with you on top of it)
      const R = this.region;
      const atX = this.pos.x <= R.minX || this.pos.x >= R.maxX, atZ = this.pos.z <= R.minZ || this.pos.z >= R.maxZ;
      this.clamp();
      const ex = this.pos.x <= R.minX || this.pos.x >= R.maxX, ez = this.pos.z <= R.minZ || this.pos.z >= R.maxZ;
      this.pinned = ex || ez || atX || atZ;
      if ((ex && ez && d < CORNER) || (this.pinned && d < 2.4)) this.state = 'cornered';
    }
    // travelling with you: float along behind your shoulder
    let facing = Math.atan2(-dx, -dz);
    if (this.state === 'follow') {
      const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
      const tx = player.pos.x - s * 2.3 + c * 1.4, tz = player.pos.z - c * 2.3 - s * 1.4;
      const fx = tx - this.pos.x, fz = tz - this.pos.z, fd = Math.hypot(fx, fz);
      if (fd > 45) { this.pos.x = tx; this.pos.z = tz; }            // fell far behind: catch up
      else if (fd > 0.05) {
        const sp = Math.min(fd * 2.6, 18) * dt;
        this.pos.x += (fx / fd) * Math.min(sp, fd); this.pos.z += (fz / fd) * Math.min(sp, fd);
      }
      facing = fd > 1.2 ? Math.atan2(fx, fz) : player.yaw;
    }
    if (this.state === 'revealing') {
      this.reveal = Math.min(1, this.reveal + dt / 1.6);
      this.setLook();
      if (this.reveal >= 1) this.state = 'idle';
    }
    // always facing you (warily); a little sway and bob
    const want = facing;
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 5);
    let g = this.ground(this.pos.x, this.pos.z);
    if (!Number.isFinite(g) || g > 900) g = player.pos.y;     // off the map edge: hover at your height
    const shy = this.state === 'cornered' || this.state === 'revealing' ? 0.6 : 1;
    this.root.position.set(this.pos.x, g + HOVER * shy + Math.sin(this.t * 1.8) * 0.15, this.pos.z);
    this.root.rotation.set(Math.sin(this.t * 1.3) * 0.04, this.yaw, Math.sin(this.t * 0.9) * 0.05);
    this.shadow.position.set(this.pos.x, g + 0.04, this.pos.z);
    this.pos.y = g;
  }

  startReveal() { this.state = 'revealing'; }
}
