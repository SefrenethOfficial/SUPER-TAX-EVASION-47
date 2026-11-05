import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Items, weapons and the moves you can learn.
// ---------------------------------------------------------------------------

// Consumables. use: what it does in battle (on the fighter using it, or the enemy).
export const ITEMS = {
  herb: { name: 'Herb', desc: 'A bitter leaf. Restores 4 Health.', heal: 4 },
  tonic: { name: 'Tonic', desc: 'A fizzing drink. Restores 5 Stamina.', stamina: 5 },
  ember: { name: 'Ember Flask', desc: 'A flask of trapped fire. Throw it for 7 damage.', damage: 7 },
  salve: { name: 'Hearth Salve', desc: 'Warm ointment from the tavern. Restores 8 Health.', heal: 8 },
};

// Weapons: extra damage on every blow you land.
export const WEAPONS = {
  fists: { name: 'Bare Fists', desc: 'Just your hands.', atk: 0 },
  club: { name: 'Driftwood Club', desc: 'A heavy branch from the wreck. +1 damage per hit.', atk: 1 },
  dagger: { name: 'Obsidian Dagger', desc: 'Black glass, wickedly sharp. +2 damage per hit.', atk: 2 },
  blade: { name: 'Ashen Blade', desc: "The Warden's sword, still warm. +4 damage per hit.", atk: 4 },
};

// Moves a teacher can show you, on top of Punch, Kick, Flurry and Catch Breath.
export const LEARNABLE = {
  guard: { name: 'Guard', cost: 1, guard: true, desc: 'Brace yourself: take half damage until your next turn.' },
  heavy: { name: 'Heavy Swing', cost: 5, desc: 'Put your whole weight into it. 6-8 damage.', hits: [{ state: 'kick', at: 0.25, dur: 0.7, dmg: [6, 8] }] },
  skybreaker: { name: 'Skybreaker', cost: 7, desc: 'Leap and come crashing down. 9-11 damage.', hits: [{ state: 'punch2', at: 0.2, dur: 0.4, dmg: [3, 3] }, { state: 'kick', at: 0.2, dur: 0.6, dmg: [6, 8] }] },
};

// A small model of each weapon, in metres, held by the grip at the origin with
// the blade / head along +Y.
export function weaponMesh(id) {
  const g = new THREE.Group();
  if (id === 'club') {
    const wood = new THREE.MeshLambertMaterial({ color: 0x6e5a44, flatShading: true });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.75, 6), wood); shaft.position.y = 0.3;
    const knot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), wood); knot.position.y = 0.66;
    g.add(shaft, knot);
  } else if (id === 'dagger') {
    const glass = new THREE.MeshPhongMaterial({ color: 0x17151d, specular: 0x9a90d0, shininess: 120, flatShading: true });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), new THREE.MeshLambertMaterial({ color: 0x3a2c22 }));
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 4), glass); blade.position.y = 0.29;
    g.add(grip, blade);
  } else if (id === 'blade') {
    const iron = new THREE.MeshPhongMaterial({ color: 0x3a3a40, specular: 0x666670, shininess: 40 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xff7a2a });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6), new THREE.MeshLambertMaterial({ color: 0x2a201a }));
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.07), iron); guard.position.y = 0.13;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.025), iron); blade.position.y = 0.68;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, 0.03), glow); edge.position.y = 0.66;
    g.add(grip, guard, blade, edge);
  }
  return g;
}
