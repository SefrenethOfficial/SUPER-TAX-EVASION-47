import * as THREE from 'three';

// ---------------------------------------------------------------------------
// A blank area: a big flat floor with a faint grid, and nothing else. Just the
// character, to move around in while the game is rebuilt.
// ---------------------------------------------------------------------------

export const NAME = '';
export const MUSIC = null;

const SIZE = 200;   // the floor is SIZE x SIZE metres

export function build(world) {
  const scene = world.scene;
  scene.fog = new THREE.Fog(0xcfe3f3, 60, 180);

  // a light grey floor with a 1 m grid, so you can see yourself moving
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#bcbcbc'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  world.addBox([-SIZE / 2, -1, -SIZE / 2], [SIZE / 2, 0, SIZE / 2], world.mat(tex, { uvScale: 1 }));

  return {
    spawn: new THREE.Vector3(0, 0, 0),
    spawnYaw: 0,
  };
}
