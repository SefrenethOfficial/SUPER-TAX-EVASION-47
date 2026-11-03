import * as THREE from 'three';

// ---------------------------------------------------------------------------
// SUNNY SPIRE HILL
// A terraced grassy hill with an orange-rock spire on top. Ledges spiral up
// the spire to the star at the summit. Off to the sides: a floating island,
// a two-wall chimney, trees and boulders.
//
// Everything solid is an axis-aligned box: world.addBox(min, max, material).
// ---------------------------------------------------------------------------

export const NAME = 'Sunny Spire Hill';
export const MUSIC = 'sunny-spire-hill.mp3';

export function build(world, coins) {
  const grass = world.mat(world.tile('grass.webp'), { uvScale: 2.5 });
  const cliff = world.mat(world.tile('cliff.png'), { uvScale: 2 });
  const path = world.mat(world.tile('path.png'), { uvScale: 3, strip: true });
  const rock = world.mat(world.tile('rock.png'), { uvScale: 2 });

  const terrace = { top: grass, side: cliff };
  const pathed = { top: path, side: cliff };
  const box = (min, max, m) => world.addBox(min, max, m);

  // --- Ground ---------------------------------------------------------------
  box([-100, -4, -100], [100, 0, 100], terrace);
  // dirt path from spawn to the hill
  box([-2, -1, -36], [2, 0.02, -6], pathed);

  // --- Hill: three terraces around (0, 20) ------------------------------------
  const C = 20;
  // Tier 1 (top 3)
  box([-20, 0, C - 16], [20, 3, C + 16], terrace);
  box([-16, 0, C - 20], [16, 3, C + 20], terrace);
  // stairs up the south face
  for (let i = 0; i < 12; i++) box([-2, 0, -6 + i * 0.5], [2, 0.25 * (i + 1), 0], pathed);
  // path along the tier-1 ledge: south band, then up the east band
  box([-2, 2, 0], [17, 3.02, 4.5], pathed);
  box([13.5, 2, 1], [17.5, 3.02, 18], pathed);
  // stairs up to tier 2 on the east side
  for (let i = 0; i < 10; i++) box([13, 3, 18], [18 - 0.5 * i, 3.25 + 0.25 * i, 22], pathed);

  // Tier 2 (top 5.5)
  box([-13, 0, C - 11], [13, 5.5, C + 13], terrace);
  box([-10, 0, C - 14], [10, 5.5, C + 16], terrace);
  // rock step on the west side up to tier 3
  box([-10.5, 5.5, 19], [-8.3, 7, 21.2], rock);

  // Tier 3 (top 8.5)
  box([-7, 0, C - 7], [7, 8.5, C + 7], terrace);
  box([-5, 0, C - 9], [5, 8.5, C + 9], terrace);

  // --- The spire --------------------------------------------------------------
  const SPIRE_TOP = 24;
  box([-2.5, 0, C - 2.5], [2.5, SPIRE_TOP, C + 2.5], { top: grass, side: rock });
  // spiral ledges, starting on the south face and climbing anticlockwise
  const ledges = [];
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 4);
    const x = Math.cos(a) * 4, z = C + Math.sin(a) * 4, top = 9.7 + i * 1.15;
    box([x - 0.95, top - 0.6, z - 0.95], [x + 0.95, top, z + 0.95], rock);
    ledges.push([x, top, z]);
  }

  // --- Floating island to the east, reached by stepping stones -----------------
  const stones = [[23.5, 4.3, 30], [27, 5.6, 26.5], [30.5, 6.9, 23]];
  for (const [x, y, z] of stones) box([x - 1.2, y - 0.6, z - 1.2], [x + 1.2, y, z + 1.2], rock);
  box([32, 5, 14], [40, 8, 24], terrace);

  // --- Wall-kick chimney to the west -------------------------------------------
  box([-28, 0, 14], [-27, 11, 26], terrace);
  box([-24.5, 0, 14], [-23.5, 11, 26], terrace);

  // --- Boulders ---------------------------------------------------------------
  for (const [x, z, w, h, d] of [[-25, -12, 3, 2.2, 3], [22, -20, 2.5, 1.8, 2.5], [-8, 47, 4, 2.5, 3], [35, 38, 3, 3, 3], [-40, 8, 3.5, 2, 2.5]]) {
    box([x - w / 2, 0, z - d / 2], [x + w / 2, h, z + d / 2], rock);
  }

  // --- Trees (trunks are solid, leaves are decoration) -------------------------
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f2a, flatShading: true });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x3fae33, flatShading: true });
  const tree = (x, y, z, s = 1) => {
    box([x - 0.3 * s, y, z - 0.3 * s], [x + 0.3 * s, y + 2.4 * s, z + 0.3 * s], cliff);
    for (const [r, h, yy, m] of [[1.9, 2.6, 2.6, leafMat], [1.4, 2.2, 3.9, leafMat2]]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 7), m);
      c.position.set(x, y + yy * s, z);
      c.castShadow = true;
      world.scene.add(c);
    }
  };
  for (const [x, z, s] of [[-12, -15, 1], [12, -18, 1.2], [-30, -5, 1.1], [30, -8, 1], [-35, 30, 1.3], [25, 46, 1.1], [-18, 50, 1], [44, 2, 1.2], [-6, -42, 0.9], [8, -40, 1]]) tree(x, 0, z, s);
  tree(-17, 3, 34, 0.9);
  tree(18.8, 3, 30, 0.9);
  tree(37, 8, 16, 0.8);

  // --- Coins ------------------------------------------------------------------
  coins.line([0, 0.9, -30], [0, 0.9, -10], 6);                 // along the path
  for (let i = 1; i < 12; i += 3) coins.add(0, 0.25 * (i + 1) + 0.9, -6 + i * 0.5 + 0.25); // stairs
  coins.line([4, 3.9, 2.25], [13, 3.9, 2.25], 5);               // tier-1 south ledge
  coins.line([15.5, 3.9, 6], [15.5, 3.9, 15], 4);               // tier-1 east ledge
  for (let i = 2; i < 10; i += 3) coins.add(17.75 - 0.5 * i, 3.25 + 0.25 * i + 0.9, 20); // stairs 2
  coins.ring(0, 6.4, 32.5, 2, 6);                               // tier 2, north side
  coins.add(-9.4, 7.9, 20.1);                                   // rock step
  for (let i = 1; i < 13; i += 2) coins.add(ledges[i][0], ledges[i][1] + 0.9, ledges[i][2]); // spire
  coins.ring(0, SPIRE_TOP + 0.9, C, 1.7, 8);                     // summit
  for (const [x, y, z] of stones) coins.add(x, y + 0.9, z);
  coins.ring(36, 8.9, 19, 2.2, 8);                              // island
  coins.line([-25.75, 2, 20], [-25.75, 10, 20], 5);             // up the chimney
  coins.line([-27.5, 11.9, 17], [-27.5, 11.9, 23], 3);          // on the chimney wall
  coins.ring(-30, 0.9, -5, 2.6, 5);                             // round a tree

  return {
    spawn: new THREE.Vector3(0, 0, -32),
    spawnYaw: 0,
    star: new THREE.Vector3(0, SPIRE_TOP + 1.3, C),
  };
}
