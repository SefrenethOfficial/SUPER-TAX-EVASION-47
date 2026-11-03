import * as THREE from 'three';

// The world is a list of axis-aligned boxes. They are both the visuals and
// the collision, which keeps platforming precise and predictable.

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
  constructor(scene, version = '') {
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

    this.loader = new THREE.TextureLoader();
    this.version = version;
  }

  // Load a tiling pixel-art texture.
  tile(name) {
    const t = this.loader.load(`assets/${name}?v=${this.version}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.anisotropy = 8;
    return t;
  }

  // Material helper. uvScale = metres per texture repeat. strip = the path
  // texture spans the box's width once (grass edges on both sides).
  mat(map, { uvScale = 2, strip = false, color } = {}) {
    const m = new THREE.MeshLambertMaterial(map ? { map } : { color });
    m.userData.uvScale = uvScale;
    m.userData.strip = strip;
    return m;
  }

  // Add a solid box. `material` is one material, or { top, side, bottom }.
  addBox(min, max, material, { visible = true } = {}) {
    const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mats = material.isMaterial
      ? [material, material, material, material, material, material]
      : [material.side, material.side, material.top, material.bottom || material.side, material.side, material.side];
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z (4 vertices each).
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4), m = mats[face];
      const k = m.userData.uvScale || 2;
      const px = pos.getX(i) + cx, py = pos.getY(i) + cy, pz = pos.getZ(i) + cz;
      let u, v;
      if (face === 2 || face === 3) {
        if (m.userData.strip) {
          // run the strip along the box's long axis
          if (sz >= sx) { u = (px - min[0]) / sx; v = pz / k; } else { u = (pz - min[2]) / sz; v = px / k; }
          uv.setXY(i, u, v);
          continue;
        }
        u = px; v = pz;
      } else if (face < 2) { u = pz; v = py; } else { u = px; v = py; }
      uv.setXY(i, u / k, v / k);
    }
    const m = new THREE.Mesh(geo, mats);
    m.position.set(cx, cy, cz);
    m.castShadow = sy < 50;
    m.receiveShadow = true;
    m.visible = visible;
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
