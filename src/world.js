import * as THREE from 'three';

// The world is a list of axis-aligned boxes. They are both the visuals and
// the collision, which keeps platforming precise and predictable.

function checkerTexture(a, b, n = 8, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * s, y * s, s, s);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.anisotropy = 8;
  return t;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#2a6fd6');
  grad.addColorStop(0.55, '#7fb8f0');
  grad.addColorStop(1, '#d9eefc');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.boxes = [];
    this.meshes = [];

    scene.background = skyTexture();
    scene.fog = new THREE.Fog(0xcfe6f7, 60, 190);

    const hemi = new THREE.HemisphereLight(0xdff0ff, 0x5a7a3a, 1.3);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 150;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // Ground: a big grassy checkerboard.
    const groundTex = checkerTexture('#5fbf3c', '#52ad33', 2, 64);
    const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
    groundMat.userData.uvScale = 6;
    this.addBox([-100, -4, -100], [100, 0, 100], groundMat);

    // A small "test yard" next to spawn so every move has something to try on.
    const stone = (c) => new THREE.MeshLambertMaterial({ color: c });
    const blockTex = checkerTexture('#e8d6a8', '#d8c290', 2, 64);
    const sharedBlock = new THREE.MeshLambertMaterial({ map: blockTex });
    const blockMat = () => sharedBlock;

    // Low steps (walk-up height)
    for (let i = 0; i < 6; i++) {
      this.addBox([-6 - i * 1.2, 0, 8], [-4.8 - i * 1.2, 0.25 * (i + 1), 11], blockMat());
    }
    // Ledge-grab platform (just out of single-jump reach on top, grab the edge)
    this.addBox([6, 0, 8], [11, 2.6, 13], blockMat());
    // Higher platform reachable with a double/triple jump or backflip
    this.addBox([13, 0, 8], [17, 4.2, 12], blockMat());
    // Wall-kick chimney: two tall walls facing each other
    this.addBox([-20, 0, -6], [-19, 14, 6], stone(0xb9a37a));
    this.addBox([-15.5, 0, -6], [-14.5, 14, 6], stone(0xb9a37a));
    this.addBox([-27, 13.4, -6], [-19, 14, 6], blockMat());
    // Floating stepping stones
    const stones = [[0, 3, -12], [4, 4.5, -15], [8, 6, -17], [12, 7.5, -16], [15, 9, -12]];
    for (const [x, y, z] of stones) this.addBox([x - 1.2, y - 0.5, z - 1.2], [x + 1.2, y, z + 1.2], blockMat());
    // A tower to ground-pound off of
    this.addBox([18, 0, -8], [22, 9, -4], stone(0xc7b18a));
    // Long-jump gap: two runways with a pit between
    this.addBox([-12, 0, 18], [-2, 1.5, 22], blockMat());
    this.addBox([5.5, 0, 18], [15.5, 1.5, 22], blockMat());

    // Decorative: distant hills and a ring of clouds.
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x4f9a35 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 130 + (i % 3) * 15;
      const h = new THREE.Mesh(new THREE.SphereGeometry(25 + (i % 4) * 8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
      h.position.set(Math.cos(a) * r, -2, Math.sin(a) * r);
      h.scale.y = 0.6;
      scene.add(h);
    }
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666 });
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 3, 10, 8), cloudMat);
        s.position.set(j * 5 - 7, Math.random() * 2, Math.random() * 3);
        g.add(s);
      }
      const a = (i / 10) * Math.PI * 2 + 0.3;
      g.position.set(Math.cos(a) * 110, 45 + Math.random() * 15, Math.sin(a) * 110);
      g.lookAt(0, g.position.y, 0);
      scene.add(g);
    }
  }

  addBox(min, max, material) {
    const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    // World-space UVs so checker textures tile at a constant size.
    if (material.map) {
      const k = material.userData.uvScale || 2;
      const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const px = pos.getX(i) + (min[0] + max[0]) / 2;
        const py = pos.getY(i) + (min[1] + max[1]) / 2;
        const pz = pos.getZ(i) + (min[2] + max[2]) / 2;
        const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
        let u, v;
        if (ay > 0.5) { u = px; v = pz; } else if (ax > 0.5) { u = pz; v = py; } else { u = px; v = py; }
        uv.setXY(i, u / k, v / k);
      }
    }
    const m = new THREE.Mesh(geo, material);
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    m.castShadow = sy < 50;
    m.receiveShadow = true;
    this.scene.add(m);
    this.meshes.push(m);
    const box = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), mesh: m };
    this.boxes.push(box);
    return box;
  }

  // Is any box occupying the vertical segment (x, y0..y1, z)?
  blocked(x, y0, y1, z) {
    for (const b of this.boxes) {
      if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z && b.max.y > y0 && b.min.y < y1) return true;
    }
    return false;
  }

  // Highest floor top under point (x,z) that is at or below `y`.
  floorBelow(x, z, y, margin = 0) {
    let best = -Infinity;
    for (const b of this.boxes) {
      if (x < b.min.x - margin || x > b.max.x + margin || z < b.min.z - margin || z > b.max.z + margin) continue;
      if (b.max.y <= y && b.max.y > best) best = b.max.y;
    }
    return best;
  }
}
