import * as THREE from 'three';
import { NPC } from '../npc.js?v=49';
import { save, flag, addItem, learn } from '../save.js?v=49';
import { plankTexture, rockTexture } from '../textures.js?v=49';

// ---------------------------------------------------------------------------
// LANTERN HOLLOW: a green valley east of the Obsidian Fieldlands, through a
// pass in the basin wall. In it stands the Sunken Lantern, a tavern with a
// fire to rest by, and the people who are left:
//   Hesta, the barkeep: rest by the fire (heals your party, and you'll come
//     round here if you're knocked out), and she'll spare you some supplies
//   Marrow, a sellsword: will join your party
//   Old Bruno, a retired guardsman: teaches Guard and Heavy Swing
// ---------------------------------------------------------------------------

export const NAME = 'Lantern Hollow';
export const CENTRE = { x: 222, z: 300 };
export const TAVERN = { x: 228, z: 300, w: 14, d: 10, h: 3.8 };    // footprint centre and size
export const FLOOR = -22;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Is (x, z) in the hollow (or its pass)?
export function contains(x, z) {
  return Math.hypot((x - CENTRE.x) / 50, (z - CENTRE.z) / 66) < 1 || (x > 120 && x < 186 && Math.abs(z - 280) < 10);
}

// Carve the pass and the valley out of the mountains east of the basin.
export function withHollow(height) {
  return (x, z) => {
    let h = height(x, z);
    // the pass: a corridor climbing gently from the basin floor
    const pm = smooth(100, 114, x) * (1 - smooth(182, 194, x)) * (1 - smooth(7, 11, Math.abs(z - 280)));
    h = lerp(h, lerp(-40, FLOOR, smooth(112, 184, x)) + 0.25 * Math.sin(x * 0.3), pm);
    // the valley floor, flattened round the tavern
    const e = Math.hypot((x - CENTRE.x) / 46, (z - CENTRE.z) / 62);
    const hm = 1 - smooth(0.8, 1.0, e);
    const valley = FLOOR + 1.2 * Math.sin(x * 0.08) * Math.sin(z * 0.07) + 0.4 * Math.sin(x * 0.21 + z * 0.17);
    const yard = 1 - smooth(11, 17, Math.hypot(x - TAVERN.x, z - TAVERN.z));
    h = lerp(h, lerp(valley, FLOOR, yard), hm);
    return h;
  };
}

// The Sunken Lantern's people and what they say.
function talkHesta(ctx) {
  const { game, partyHeal, setRest } = ctx;
  const first = !save.flags.metHesta;
  flag('metHesta');
  return game.talk([
    ...(first ? [
      { who: 'Hesta', text: "Well. A new face. Don't get many down this way, not since the fog came." },
      { who: 'Hesta', text: "Welcome to the Sunken Lantern. You look half-drowned, love. Sit by the fire a while." },
    ] : [{ who: 'Hesta', text: 'Back again? Come in, come in.' }]),
    { who: 'Hesta', text: 'What can I do for you?', choices: ['Rest by the fire', 'Any supplies to spare?', 'What is this place?', 'Goodbye'],
      then: (k) => {
        if (k === 0) return [{ who: '', text: 'You rest by the fire. Your party’s strength returns.', onShow: () => { partyHeal(); setRest(); } },
          { who: 'Hesta', text: "If you get yourself knocked about out there, you'll wake up here. I'll see to that." }];
        if (k === 1) {
          if (save.flags.hestaGave) return [{ who: 'Hesta', text: "That's all I can spare, love. Times are lean." }];
          return [{ who: 'Hesta', text: "Here. Herbs, a pot of my salve, and an ember flask. Throw that last one, don't drink it.",
            onShow: () => { flag('hestaGave'); addItem('herb', 2); addItem('salve', 1); addItem('ember', 1); game.toast('Got 2 Herbs, a Hearth Salve and an Ember Flask'); } }];
        }
        if (k === 2) return [
          { who: 'Hesta', text: 'Lantern Hollow. Folk lived here once. Farmers, mostly, working the fields out in the basin.' },
          { who: 'Hesta', text: "Then the Warden went strange, up on his throne past the western pass. The fog came, and the glass started growing out of the ground." },
          { who: 'Hesta', text: "Now it's me, Bruno, Marrow over there, and whoever washes in. If you're going west... don't. Or if you must, rest here first." },
        ];
        return [{ who: 'Hesta', text: 'Mind the glass out there.' }];
      } },
  ], { with: ctx.npc.root.position });
}

function talkMarrow(ctx) {
  const { game, inParty, setParty } = ctx;
  if (inParty()) {
    return game.talk([{ who: 'Marrow', text: 'Something on your mind?', choices: ['Wait here for now', 'Lead on'],
      then: (k) => (k === 0 ? [{ who: 'Marrow', text: "Fine. I'll be at my table. Don't get yourself killed.", onShow: () => setParty(false) }] : [{ who: 'Marrow', text: 'Then let’s go.' }]) }],
    { with: ctx.npc.root.position });
  }
  const first = !save.flags.metMarrow;
  flag('metMarrow');
  return game.talk([
    ...(first ? [
      { who: 'Marrow', text: "Marrow. Sword for hire. Not that there's anyone left round here to hire me." },
      { who: 'Marrow', text: 'You came in from the beach? Then you got past the fog. More than most manage.' },
    ] : [{ who: 'Marrow', text: 'You again.' }]),
    { who: 'Marrow', text: 'Well? What do you want?', choices: ['Join me', 'Nothing'],
      then: (k) => (k === 0 ? [
        { who: 'Marrow', text: 'You? Ha.' },
        { who: 'Marrow', text: "...Fine. Beats drinking alone. I'll watch your back, and you don't ask about mine.", onShow: () => setParty(true) },
        { who: '', text: 'Marrow joined your party!' },
      ] : [{ who: 'Marrow', text: 'Suit yourself.' }]) },
  ], { with: ctx.npc.root.position });
}

function talkBruno(ctx) {
  const { game } = ctx;
  const armed = save.weapons.some((w) => w !== 'fists');
  const opts = [];
  if (!save.learned.includes('guard')) opts.push(['Teach me to Guard', 'guard']);
  if (!save.learned.includes('heavy')) opts.push(['Teach me Heavy Swing', 'heavy']);
  if (!opts.length) {
    return game.talk([{ who: 'Old Bruno', text: "I've nothing left to teach you. Go and use it." },
      { who: 'Old Bruno', text: "They say there's a hermit up on the plateau in the middle of the fieldlands who knows a trick or two. Take the path up its south side." }], { with: ctx.npc.root.position });
  }
  return game.talk([
    { who: 'Old Bruno', text: save.flags.metBruno ? 'Back for another lesson?' : "Old Bruno. Thirty years in the Warden's guard, before he... well. I can still teach a thing or two." },
    { who: 'Old Bruno', text: 'What do you want to learn?', choices: [...opts.map((o) => o[0]), 'Nothing for now'],
      then: (k) => {
        flag('metBruno');
        const pick = opts[k];
        if (!pick) return [{ who: 'Old Bruno', text: 'Come back when you do.' }];
        if (pick[1] === 'guard') return [
          { who: 'Old Bruno', text: 'Feet apart. Arms up. When it comes, you take it on the guard, not the face.' },
          { who: 'Old Bruno', text: 'Get low and set your feet. Crouch, and whatever hits you does half the hurt.' },
          { who: '', text: 'You learned Guard! Crouch to guard: blows do half damage and barely move you.', onShow: () => learn('guard') },
        ];
        if (!armed) return [{ who: 'Old Bruno', text: "Heavy Swing needs something heavy to swing. Come back with a weapon. There's driftwood enough on that beach." }];
        return [
          { who: 'Old Bruno', text: "Don't swing with your arms. Swing with your hips. Let the weight do the work." },
          { who: '', text: 'You learned Heavy Swing! The kick at the end of your punch combo now hits far harder.', onShow: () => learn('heavy') },
        ];
      } },
  ], { with: ctx.npc.root.position });
}

// Build the valley: the tavern, its people, lanterns along the road.
// ctx: { world, scene, G, box, rng }
export function build(ctx) {
  const { scene, G, box } = ctx;
  const T = TAVERN, y0 = FLOOR;
  const planks = plankTexture(), stoneT = rockTexture();
  const wall = new THREE.MeshLambertMaterial({ map: planks, color: 0xb8a48a });
  const dark = new THREE.MeshLambertMaterial({ map: planks, color: 0x7a6650 });
  const stone = new THREE.MeshLambertMaterial({ map: stoneT, color: 0xb0aca4 });
  const x0 = T.x - T.w / 2, x1 = T.x + T.w / 2, z0 = T.z - T.d / 2, z1 = T.z + T.d / 2, th = 0.3, door = 1.4;
  // floor, walls (a door in the west wall), ceiling
  box([x0, y0 - 1, z0], [x1, y0 + 0.2, z1], dark);
  const fy = y0 + 0.2;
  box([x0, fy, z0], [x1, fy + T.h, z0 + th], wall);                 // south
  box([x0, fy, z1 - th], [x1, fy + T.h, z1], wall);                 // north
  box([x1 - th, fy, z0], [x1, fy + T.h, z1], wall);                 // east
  box([x0, fy, z0], [x0 + th, fy + T.h, T.z - door], wall);         // west, either side of the door
  box([x0, fy, T.z + door], [x0 + th, fy + T.h, z1], wall);
  box([x0, fy + 2.6, T.z - door], [x0 + th, fy + T.h, T.z + door], wall);
  box([x0 - 0.3, fy + T.h, z0 - 0.3], [x1 + 0.3, fy + T.h + 0.25, z1 + 0.3], dark);   // ceiling
  // a pitched roof on top (just for looks)
  {
    const roofMat = new THREE.MeshLambertMaterial({ map: planks, color: 0x5a3e2e, side: THREE.DoubleSide });
    const half = T.d / 2 + 0.8, rise = 2.2, len = Math.hypot(half, rise);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(T.w + 1.2, len), roofMat);
      r.position.set(T.x, fy + T.h + 0.25 + rise / 2, T.z + s * half / 2);
      r.rotation.x = -Math.PI / 2 + s * Math.atan2(rise, half) * -1;
      r.rotation.order = 'YXZ';
      scene.add(r);
    }
    for (const xx of [x0 - 0.6, x1 + 0.6]) {   // gable ends
      const g = new THREE.Shape(); g.moveTo(-half, 0); g.lineTo(half, 0); g.lineTo(0, rise); g.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(g), new THREE.MeshLambertMaterial({ map: planks, color: 0xa08a70, side: THREE.DoubleSide }));
      m.position.set(xx, fy + T.h + 0.25, T.z); m.rotation.y = Math.PI / 2;
      scene.add(m);
    }
  }
  // inside: the bar, tables and stools, the fireplace
  box([T.x + 2.4, fy, z0 + 1.4], [T.x + 3.2, fy + 1.1, z1 - 1.4], dark);           // bar counter
  box([T.x + 2.3, fy + 1.1, z0 + 1.3], [T.x + 3.3, fy + 1.18, z1 - 1.3], wall);
  for (const [tx, tz] of [[T.x - 3.6, T.z - 2.2], [T.x - 0.6, T.z - 2.4], [T.x - 3.2, T.z + 2.4]]) {
    box([tx - 0.7, fy, tz - 0.55], [tx + 0.7, fy + 0.8, tz + 0.55], wall);
    for (const [sx, sz] of [[-1.05, 0], [1.05, 0]]) box([tx + sx - 0.22, fy, tz + sz - 0.22], [tx + sx + 0.22, fy + 0.48, tz + sz + 0.22], dark);
  }
  box([T.x - 1.4, fy, z1 - 1.2], [T.x + 1.0, fy + 2.4, z1 - th], stone);             // fireplace
  box([T.x - 1.6, fy + 2.4, z1 - 1.4], [T.x + 1.2, fy + 2.6, z1 - th], stone);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff8a30 }));
  fire.position.set(T.x - 0.2, fy + 0.45, z1 - 1.35);
  scene.add(fire);
  const fireLight = new THREE.PointLight(0xff9a50, 26, 14, 1.6);
  fireLight.position.set(T.x - 0.2, fy + 1.2, z1 - 2.0);
  const lamp = new THREE.PointLight(0xffd090, 14, 16, 1.6);
  lamp.position.set(T.x, fy + T.h - 0.6, T.z);
  scene.add(fireLight, lamp);
  // barrels behind the bar, a sign over the door
  for (const bz of [z0 + 1.0, z1 - 1.7]) box([x1 - 1.1, fy, bz - 0.35], [x1 - 0.4, fy + 0.9, bz + 0.35], dark);
  box([x0 - 0.5, fy + 2.75, T.z - 1.2], [x0 - 0.35, fy + 3.45, T.z + 1.2], dark);
  const signGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  signGlow.position.set(x0 - 0.9, fy + 2.5, T.z + 1.6);
  scene.add(signGlow);
  // lanterns on posts along the road in from the pass
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  for (const [lx, lz] of [[186, 286], [196, 291], [206, 296], [214, 299]]) {
    const ly = G(lx, lz);
    box([lx - 0.08, ly - 0.3, lz - 0.08], [lx + 0.08, ly + 2.2, lz + 0.08], dark);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), lanternMat);
    l.position.set(lx, ly + 2.35, lz);
    scene.add(l);
  }

  // the people
  const npcs = {
    hesta: new NPC(scene, { name: 'Hesta', pos: { x: T.x + 4.4, y: fy, z: T.z }, yaw: -Math.PI / 2, look: { skin: 0xd2a888, shirt: 0x7a3a3a, pants: 0x4a3a30, apron: 0xd8ccb0, hat: 'none', height: 1.7 } }),
    marrow: new NPC(scene, { name: 'Marrow', pos: { x: T.x - 0.6, y: fy, z: T.z - 3.6 }, yaw: 0, look: { skin: 0xb08664, shirt: 0x3a4050, pants: 0x2e2a28, hat: 'hood', hatColor: 0x2c3038, cloak: 0x2c3038, lantern: true, sword: true, height: 1.95 } }),
    bruno: new NPC(scene, { name: 'Old Bruno', pos: { x: T.x - 3.0, y: fy, z: z1 - 1.8 }, yaw: Math.PI, look: { skin: 0xc09474, shirt: 0x5a5a48, pants: 0x3a3630, beard: 0xd8d8d0, hat: 'cap', hatColor: 0x4a4a40, height: 1.75 } }),
  };
  let t = 0;
  return {
    npcs,
    talks: { hesta: talkHesta, marrow: talkMarrow, bruno: talkBruno },
    // where you come round after resting here
    restSpot: new THREE.Vector3(T.x - 1.5, fy, T.z), restYaw: Math.PI / 2,
    update(dt, player) {
      t += dt;
      fireLight.intensity = 24 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2;
      fire.scale.set(1 + Math.sin(t * 11) * 0.08, 1 + Math.sin(t * 9) * 0.15, 1);
      for (const n of Object.values(npcs)) if (!n.following) n.update(dt, player);
    },
  };
}
