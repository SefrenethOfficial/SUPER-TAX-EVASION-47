import * as THREE from 'three';
import { rockTexture } from '../textures.js?v=45';

// ---------------------------------------------------------------------------
// THE HOLLOW THRONE: up a pass in the west wall of the Obsidian Fieldlands, a
// gloomy plateau with a ruined ring of pillars and a throne. The Hollow Warden
// sits there. Step through the wall of fog at the ring's entrance and he rises:
// a boss fight with two phases and its own music. Beat him and the fog clears
// and his blade is yours.
// ---------------------------------------------------------------------------

export const NAME = 'The Hollow Throne';
export const MUSIC = 'boss.mp3';                 // the Warden's song
export const PLATEAU = { x: -215, z: 404, r: 44, y: -8 };
export const ARENA = { x: -220, z: 404, r: 19 };
export const GATE = { x: ARENA.x + ARENA.r + 0.6, z: ARENA.z };   // the fog gate, on the east side

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function contains(x, z) { return Math.hypot(x - PLATEAU.x, z - PLATEAU.z) < PLATEAU.r + 4 || (x < -150 && x > -186 && Math.abs(z - PLATEAU.z) < 9); }

// Carve the western pass and the plateau.
export function withThrone(height) {
  return (x, z) => {
    let h = height(x, z);
    const pm = (1 - smooth(-112, -100, x)) * smooth(-192, -180, x) * (1 - smooth(6, 10, Math.abs(z - PLATEAU.z)));
    h = lerp(h, lerp(-38, PLATEAU.y, smooth(-112, -182, x)) + 0.25 * Math.sin(z * 0.4), pm);
    const pl = 1 - smooth(PLATEAU.r * 0.85, PLATEAU.r, Math.hypot(x - PLATEAU.x, z - PLATEAU.z));
    h = lerp(h, PLATEAU.y + 0.2 * Math.sin(x * 0.3 + z * 0.2), pl);
    return h;
  };
}

// The Warden: a huge knight in blackened armour with a glowing slit for a face
// and an enormous sword.
function wardenModel() {
  const g = new THREE.Group();
  const iron = new THREE.MeshPhongMaterial({ color: 0x2c2c32, specular: 0x55555e, shininess: 30, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x18161a, flatShading: true });
  const ember = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x3a1a1c, side: THREE.DoubleSide, flatShading: true });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.32, 0.26, 1.6, 7), iron, s * 0.42, 0.8, 0);         // legs
    add(new THREE.BoxGeometry(0.5, 0.3, 0.75), dark, s * 0.42, 0.12, 0.1);              // boots
    add(new THREE.SphereGeometry(0.5, 8, 6), iron, s * 0.95, 3.05, 0);                    // pauldrons
    add(new THREE.CylinderGeometry(0.22, 0.2, 1.4, 7), iron, s * 1.05, 2.25, 0.05, 0, 0, s * 0.12);   // arms
  }
  add(new THREE.CylinderGeometry(0.85, 0.62, 1.6, 8), iron, 0, 2.35, 0);                // torso
  add(new THREE.CylinderGeometry(0.66, 0.7, 0.3, 8), dark, 0, 1.55, 0);                 // belt
  const crack = add(new THREE.BoxGeometry(0.12, 0.9, 0.05), ember, 0.15, 2.4, 0.72, 0, 0, 0.3);   // a glowing crack in the chest
  crack.visible = false;
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.75, 8), iron, 0, 3.55, 0);               // helm
  add(new THREE.ConeGeometry(0.44, 0.5, 8), iron, 0, 4.15, 0);
  add(new THREE.BoxGeometry(0.5, 0.07, 0.05), ember, 0, 3.6, 0.44);                      // eye slit
  // cape
  const cape = add(new THREE.PlaneGeometry(1.7, 2.6), cloth, 0, 2.0, -0.7, 0.12);
  // the greatsword, point down at his side
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.2, 0.06), iron); blade.position.y = -1.0;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.08), ember); edge.position.y = -1.0;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.16), dark); guard.position.y = 0.65;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), dark); grip.position.y = 1.0;
  sword.add(blade, edge, guard, grip);
  sword.position.set(1.35, 1.9, 0.5);
  sword.rotation.z = -0.08;
  g.add(sword);
  g.userData = { crack, cape, sword, edge };
  return g;
}

// The fight itself: attacks for each phase. Some hit the whole party, some are
// wound up a turn ahead (Guard is a good idea then).
export function wardenFighter(model, yaw) {
  let turn = 0;
  const P1 = [
    { text: 'brings his greatsword down', dmg: 3 },
    { text: 'sweeps his blade across your party', dmg: 2, all: true },
    { text: 'raises his blade high', charge: true, then: { text: 'brings it crashing down', dmg: 6 } },
  ];
  const P2 = [
    { text: 'swings his burning blade', dmg: 4 },
    { text: 'erupts in a wave of fire', dmg: 3, all: true },
    { text: 'draws the fire into his blade', charge: true, then: { text: 'unleashes a storm of embers', dmg: 6, all: true } },
  ];
  let phase = 1;
  return {
    name: 'Hollow Warden', maxHp: 60, maxSp: 12, atk: 3, model, top: 5.2, music: MUSIC,
    intro: 'The Hollow Warden rises from his throne.',
    picture: { height: 3.6, dist: 4.6, yaw },
    choose() {
      turn++;
      const set = phase === 1 ? P1 : P2;
      if (turn % 3 === 0) return set[2];                       // every third turn: a big wind-up
      return Math.random() < (phase === 1 ? 0.65 : 0.55) ? set[0] : set[1];
    },
    onHalf() {
      phase = 2;
      model.userData.crack.visible = true;
      model.userData.edge.material = new THREE.MeshBasicMaterial({ color: 0xffd060 });
      return "The Warden's armour splits open. Fire pours out from inside!";
    },
  };
}

// Build the plateau: the ring of pillars, the throne, braziers, the fog gate,
// and the Warden. ctx: { scene, G, box, rng }
export function build(ctx) {
  const { scene, G, box, rng } = ctx;
  const stoneMat = new THREE.MeshLambertMaterial({ map: rockTexture(), color: 0x8a8680 });
  const y = PLATEAU.y;
  // ruined ring: pillars, some broken short, with low walls between
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.25) continue;   // the gap where the gate is
    const x = ARENA.x + Math.cos(a) * ARENA.r, z = ARENA.z + Math.sin(a) * ARENA.r;
    const h = rng() < 0.35 ? 1.5 + rng() * 2 : 6 + rng() * 2;
    box([x - 0.8, y - 1, z - 0.8], [x + 0.8, y + h, z + 0.8], stoneMat);
    // a wall to the next pillar
    const a2 = ((i + 1) / N) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a2), Math.cos(a2))) < 0.25) continue;
    const steps = 6;
    for (let k = 1; k < steps; k++) {
      const aa = a + ((a2 - a) * k) / steps, wx = ARENA.x + Math.cos(aa) * ARENA.r, wz = ARENA.z + Math.sin(aa) * ARENA.r;
      box([wx - 0.7, y - 1, wz - 0.7], [wx + 0.7, y + 2.4 + rng() * 0.6, wz + 0.7], stoneMat);
    }
  }
  // the throne, at the far side
  const tx = ARENA.x - ARENA.r + 4.5;
  box([tx - 2.2, y - 1, ARENA.z - 2.4], [tx + 1.8, y + 0.6, ARENA.z + 2.4], stoneMat);       // dais
  box([tx - 2.0, y + 0.6, ARENA.z - 1.4], [tx - 0.9, y + 5.5, ARENA.z + 1.4], stoneMat);     // back
  box([tx - 0.9, y + 0.6, ARENA.z - 1.4], [tx + 0.9, y + 1.6, ARENA.z + 1.4], stoneMat);     // seat
  for (const s of [-1, 1]) box([tx - 0.9, y + 1.6, ARENA.z + s * 1.4 - 0.25], [tx + 0.9, y + 2.4, ARENA.z + s * 1.4 + 0.25], stoneMat);
  // braziers either side of the entrance and the throne
  const braziers = [];
  for (const [bx, bz] of [[GATE.x - 1.5, GATE.z - 4.5], [GATE.x - 1.5, GATE.z + 4.5], [tx + 2.5, ARENA.z - 4], [tx + 2.5, ARENA.z + 4]]) {
    box([bx - 0.4, y - 0.5, bz - 0.4], [bx + 0.4, y + 1.3, bz + 0.4], stoneMat);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
    f.position.set(bx, y + 1.7, bz);
    scene.add(f);
    const l = new THREE.PointLight(0xff8a3a, 14, 18, 1.6);
    l.position.set(bx, y + 2.4, bz);
    scene.add(l);
    braziers.push({ f, l });
  }

  // the fog gate: a wall of slowly swirling mist you can't walk through until
  // you choose to step into it
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g2 = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128, yy = Math.random() * 128, r = 10 + Math.random() * 26;
    const gr = g2.createRadialGradient(x, yy, 0, x, yy, r);
    gr.addColorStop(0, 'rgba(235,235,240,0.35)'); gr.addColorStop(1, 'rgba(235,235,240,0)');
    g2.fillStyle = gr;
    for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { g2.beginPath(); g2.arc(x + dx, yy + dy, r, 0, Math.PI * 2); g2.fill(); }
  }
  const fogTex = new THREE.CanvasTexture(c);
  fogTex.wrapS = fogTex.wrapT = THREE.RepeatWrapping;
  const fogMat = new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, color: 0xe8e8f0 });
  const fogWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fogMat);
  fogWall.position.set(GATE.x, y + 3, GATE.z);
  fogWall.rotation.y = Math.PI / 2;
  scene.add(fogWall);
  const fogWall2 = fogWall.clone(); fogWall2.material = fogMat.clone(); fogWall2.position.x += 0.25;
  scene.add(fogWall2);
  const gateBox = box([GATE.x - 0.3, y - 1, GATE.z - 3], [GATE.x + 0.3, y + 6, GATE.z + 3], stoneMat, { visible: false });

  // the Warden, seated
  const warden = wardenModel();
  const seatPos = new THREE.Vector3(tx + 0.2, y + 0.55, ARENA.z);
  const standPos = new THREE.Vector3(ARENA.x - 6, y, ARENA.z);
  warden.position.copy(seatPos);
  warden.rotation.y = Math.PI / 2;     // facing the entrance (+x)
  warden.scale.setScalar(0.92);
  scene.add(warden);

  let t = 0, rise = 0, risen = false;
  return {
    warden, standPos, gateBox, fogWall, fogWall2,
    gateIn: new THREE.Vector3(GATE.x - 3.5, y, GATE.z),      // where you step to through the fog
    playerSpot: new THREE.Vector3(ARENA.x + 7, y, ARENA.z),
    rise() { risen = true; },
    openGate() {
      fogWall.visible = fogWall2.visible = false;
      gateBox.min.set(9999, 9999, 9999); gateBox.max.set(9999, 9999, 9999);
      if (gateBox.mesh) gateBox.mesh.visible = false;
    },
    remove() { scene.remove(warden); },
    update(dt) {
      t += dt;
      fogTex.offset.set(t * 0.02, t * 0.05);
      fogWall2.material.map.offset.set(-t * 0.03, t * 0.04);
      for (const b of braziers) { b.l.intensity = 12 + Math.sin(t * 12 + b.f.position.x) * 2.5; b.f.scale.y = 1 + Math.sin(t * 10 + b.f.position.z) * 0.15; }
      // rising from the throne and stepping down
      if (risen && rise < 1) {
        rise = Math.min(1, rise + dt / 2.2);
        const k = rise * rise * (3 - 2 * rise);
        warden.position.lerpVectors(seatPos, standPos, k);
        warden.position.y += Math.sin(k * Math.PI) * 0.6;
      }
      const ud = warden.userData;
      ud.cape.rotation.x = 0.12 + Math.sin(t * 1.3) * 0.05;
      if (rise >= 1) warden.scale.y = 0.92 * (1 + Math.sin(t * 1.6) * 0.008);
    },
    get standing() { return rise >= 1; },
  };
}
