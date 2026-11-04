import * as THREE from 'three';

// ---------------------------------------------------------------------------
// SM64-style cannons. Each one waits at the bottom of a hole in the ground.
// Drop into the hole and you climb in: the cannon rises to the top of the hole
// and the view switches to looking out past the barrel. Aim with the stick /
// WASD / mouse, press A (Space) to fire yourself out, or B to climb back out.
// ---------------------------------------------------------------------------

export const CANNON_SPEED = 62;

export class Cannon {
  // cfg: { x, y, z, top, yaw, pitch, speed }  (y = the bottom of the hole, top = the ground round it)
  constructor(scene, cfg) {
    this.pos = new THREE.Vector3(cfg.x, cfg.y, cfg.z);
    this.top = cfg.top ?? cfg.y;
    this.rise = 0;   // 0 = down in the hole, 1 = up at the top
    this.yaw = cfg.yaw || 0;
    this.pitch = cfg.pitch ?? 0.75;
    this.speed = cfg.speed || CANNON_SPEED;
    this.home = [this.yaw, this.pitch];
    this.cool = 0;
    this.active = false;
    const metal = new THREE.MeshLambertMaterial({ color: 0x2a2e3a });
    const rim = new THREE.MeshLambertMaterial({ color: 0x8a8f9c });
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.scale.setScalar(0.85);   // fits the 2.2 m holes
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.5, 16), rim);
    base.position.y = 0.25;
    this.group.add(base);
    // barrel pivots about a point just above the hole
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.8;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.6, 16, 1, true), metal);
    barrel.material.side = THREE.DoubleSide;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.9;
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.12, 8, 18), rim);
    muzzle.position.z = 2.2;
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), metal);
    back.position.z = -0.35;
    this.pivot.add(barrel, muzzle, back);
    this.group.add(this.pivot);
    scene.add(this.group);
    this.place();
  }

  dir(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  place() {
    this.pivot.rotation.set(-this.pitch, this.yaw, 0, 'YXZ');
  }

  // where the barrel's pivot sits (it rises out of the hole when you climb in)
  get mouth() { return this.pos.y + (this.top - 0.5 - this.pos.y) * this.rise; }

  near(player) {
    // anywhere down in the hole counts
    return Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < 2.2 && player.pos.y < this.pos.y + 0.35 && player.pos.y > this.pos.y - 1.5;
  }

  enter(player) {
    this.active = true;
    [this.yaw, this.pitch] = this.home;   // start aimed the default way
    this.place();
    player.setState('incannon');
    player.fwd = 0; player.vy = 0;
    player.pos.copy(this.pos);
    player.root.visible = false;
    player.blob.visible = false;
  }

  // Aim. move: stick (-1..1); look: mouse deltas (radians).
  aim(dt, move, look) {
    this.yaw -= move.x * 1.4 * dt + look.x;
    this.pitch = Math.max(0.05, Math.min(1.45, this.pitch + move.y * 0.9 * dt - look.y));
    this.place();
  }

  fire(player, fx) {
    const d = this.dir();
    const tip = new THREE.Vector3(this.pos.x, this.mouth + 0.8, this.pos.z).addScaledVector(d, 2.4);
    player.pos.set(tip.x, tip.y - 0.8, tip.z);
    player.launch(this.yaw, this.pitch, this.speed);
    fx.explode(tip);
    this.active = false;
    this.cool = 1.5;
  }

  exit(player) {
    this.active = false;
    this.cool = 1.2;
    this.left = true;
    player.root.visible = true;
    player.pos.set(this.pos.x, this.top + 0.1, this.pos.z);
    // hop backwards out of the hole
    player.yaw = this.yaw + Math.PI;
    player.bounce(12);
    player.fwd = 4.5;
  }

  // First-person view down the barrel.
  camera(cam) {
    const d = this.dir();
    // just past the muzzle, so you look out over the level, not at the barrel
    const eye = new THREE.Vector3(this.pos.x, this.mouth + 0.8, this.pos.z).addScaledVector(d, 2.7);
    eye.y += 0.35;
    cam.position.copy(eye);
    cam.lookAt(eye.clone().addScaledVector(d, 30));
  }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    // rise out of the hole while someone's aboard, sink back after
    const want = this.active ? 1 : 0;
    this.rise += Math.sign(want - this.rise) * Math.min(Math.abs(want - this.rise), dt * 2.5);
    this.group.position.y = this.mouth;
  }
}
