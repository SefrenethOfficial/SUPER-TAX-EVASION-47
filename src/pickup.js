import * as THREE from 'three';
import { save, store, addItem, addWeapon } from './save.js?v=54';
import { ITEMS, WEAPONS, weaponMesh } from './items.js?v=54';

// ---------------------------------------------------------------------------
// Things lying about to pick up: a glinting light over the spot, and the item
// itself (weapons show their model). Walk up and press E. Each one has an id
// so it stays gone once taken.
// ---------------------------------------------------------------------------

const glintMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.85, depthWrite: false });

export class Pickup {
  // opts: { id, item | weapon, count, pos (on the ground) }
  constructor(scene, { id, item, weapon, count = 1, pos }) {
    this.id = id; this.item = item; this.weapon = weapon; this.count = count;
    this.pos = pos.clone();
    this.taken = save.taken.includes(id);
    this.root = new THREE.Group();
    this.root.position.copy(pos);
    if (weapon) {
      const w = weaponMesh(weapon);
      w.rotation.z = Math.PI / 2.2; w.position.y = 0.12;
      this.root.add(w);
    } else {
      const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: item === 'herb' ? 0x5c8a3a : item === 'ember' ? 0xb84a1a : 0x7a6a9a }));
      pouch.scale.y = 0.8; pouch.position.y = 0.13;
      this.root.add(pouch);
    }
    this.glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glintMat);
    this.glint.position.y = 0.9;
    this.root.add(this.glint);
    this.t = Math.random() * 6;
    if (!this.taken) scene.add(this.root);
    this.scene = scene;
  }

  get label() { return this.weapon ? WEAPONS[this.weapon].name : (this.count > 1 ? `${ITEMS[this.item].name} x${this.count}` : ITEMS[this.item].name); }

  near(player) { return !this.taken && Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < 1.8 && Math.abs(player.pos.y - this.pos.y) < 2.5; }

  take() {
    this.taken = true;
    if (this.weapon) addWeapon(this.weapon); else addItem(this.item, this.count);
    if (!save.taken.includes(this.id)) save.taken.push(this.id);
    store();
    this.scene.remove(this.root);
    return this.label;
  }

  update(dt) {
    if (this.taken) return;
    this.t += dt;
    this.glint.rotation.y += dt * 2;
    this.glint.position.y = 0.85 + Math.sin(this.t * 2.5) * 0.1;
    this.glint.scale.setScalar(0.8 + Math.abs(Math.sin(this.t * 3.1)) * 0.5);
  }
}
