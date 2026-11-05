import * as THREE from 'three';

// ---------------------------------------------------------------------------
// People: simple low-poly figures built from primitives, with a few options for
// clothes, hats and props. They breathe, and turn to look at you when you come
// near. Talking to them is up to the area (see interact() in the stage files).
// ---------------------------------------------------------------------------

const lam = (c, flat = true) => new THREE.MeshLambertMaterial({ color: c, flatShading: flat });

// look: { skin, shirt, pants, hat: 'none'|'hood'|'cap'|'helmet'|'wide', hatColor, beard, apron, lantern, cloak, height }
export function personModel(look = {}) {
  const L = { skin: 0xc8a07a, shirt: 0x6a4a3a, pants: 0x3a3530, hat: 'none', hatColor: 0x4a3a2a, height: 1.85, ...look };
  const g = new THREE.Group();
  const skin = lam(L.skin), shirt = lam(L.shirt), pants = lam(L.pants);
  const parts = {};
  // legs
  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.82, 6), pants); leg.position.set(x, 0.41, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.28), lam(0x2a221c)); boot.position.set(x, 0.06, 0.04);
    g.add(leg, boot);
  }
  // body
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.68, 8), shirt); torso.position.y = 1.15;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 8), lam(0x2e241c)); belt.position.y = 0.85;
  g.add(torso, belt);
  parts.torso = torso;
  if (L.apron) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.6, 0.03), lam(L.apron)); a.position.set(0, 0.95, 0.23); g.add(a); }
  if (L.cloak) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.15, 8, 1, true, Math.PI * 0.15, Math.PI * 1.7), new THREE.MeshLambertMaterial({ color: L.cloak, side: THREE.DoubleSide, flatShading: true }));
    c.position.y = 0.95; c.rotation.y = Math.PI; g.add(c);
  }
  // arms
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.32, 1.42, 0);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.62, 6), shirt); up.position.y = -0.3;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), skin); hand.position.y = -0.64;
    arm.add(up, hand); arm.rotation.z = s * 0.12;
    g.add(arm);
    parts[s < 0 ? 'armL' : 'armR'] = arm;
  }
  // head
  const head = new THREE.Group(); head.position.y = 1.62;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin); skull.position.y = 0.06; skull.scale.y = 1.1;
  const eye = lam(0x1a1410, false);
  for (const x of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eye); e.position.set(x, 0.1, 0.17); head.add(e); }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), skin); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.05, 0.2);
  head.add(skull, nose);
  if (L.beard) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 7), lam(L.beard)); b.rotation.x = Math.PI; b.position.set(0, -0.08, 0.1); head.add(b); }
  const hc = lam(L.hatColor);
  if (L.hat === 'hood') { const h = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), hc); h.position.y = 0.08; h.rotation.x = -0.3; head.add(h); }
  if (L.hat === 'cap') { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.12, 10), hc); h.position.y = 0.22; head.add(h); }
  if (L.hat === 'wide') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12), hc); brim.position.y = 0.18;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.22, 10), hc); top.position.y = 0.3;
    head.add(brim, top);
  }
  if (L.hat === 'helmet') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshPhongMaterial({ color: 0x5a5d64, shininess: 50 }));
    h.position.y = 0.08; head.add(h);
  }
  g.add(head);
  parts.head = head;
  if (L.lantern) {
    const lan = new THREE.Group();
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), lam(0x3a3228));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    lan.add(cage, glow); lan.position.set(0, -0.82, 0.08);
    parts.armR.add(lan);
  }
  if (L.sword) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.12), new THREE.MeshPhongMaterial({ color: 0x8a8c94, shininess: 60 }));
    sw.position.set(-0.3, 0.75, -0.2); sw.rotation.z = 0.25; g.add(sw);
  }
  const k = L.height / 1.85;
  g.scale.setScalar(k);
  g.userData.parts = parts;
  return g;
}

export class NPC {
  // opts: { pos, yaw, ground(x, z), look, name }
  constructor(scene, { pos, yaw = 0, ground, look = {}, name = '' }) {
    this.name = name;
    this.model = personModel(look);
    this.root = new THREE.Group();
    this.root.add(this.model);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.renderOrder = 2;
    this.root.add(sh);
    this.pos = new THREE.Vector3(pos.x, ground ? ground(pos.x, pos.z) : pos.y, pos.z);
    if (pos.y !== undefined) this.pos.y = pos.y;
    this.root.position.copy(this.pos);
    this.yaw = this.homeYaw = yaw;
    this.root.rotation.y = yaw;
    this.t = Math.random() * 10;
    scene.add(this.root);
  }

  near(player, r = 2.6) { return Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < r && Math.abs(player.pos.y - this.pos.y) < 2; }

  update(dt, player) {
    this.t += dt;
    const p = this.model.userData.parts;
    p.torso.scale.y = 1 + Math.sin(this.t * 1.8) * 0.015;
    // turn to look at you when you're close
    const close = this.near(player, 6);
    const want = close ? Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z) : this.homeYaw;
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 3);
    this.root.rotation.y = this.yaw;
    p.head.rotation.x = Math.sin(this.t * 0.7) * 0.04;
  }
}
