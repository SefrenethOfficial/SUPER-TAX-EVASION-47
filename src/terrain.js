import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Heightmap terrain. A regular grid of heights built from a height function;
// the same grid drives both the mesh and the collision (bilinear), so what
// you see is what you stand on.
//
// Texturing blends three tiles in the shader: grass on flat ground, cliff on
// steep faces, and a dirt path painted along polylines (the path tile's
// grass edges line up with the path's sides).
// ---------------------------------------------------------------------------

export class Terrain {
  // rock / rockZone: optional second cliff texture used inside a circle
  // (x, z, radius), e.g. red rock on a mountain.
  // sand / sandTop: optional sand texture on everything below sandTop (a beach).
  // grade: { sat, tint } colour grading for moodier areas (sat 1 = untouched).
  // fields: { x, z, r }: inside this circle the grass varies in big soft meadows.
  // sandMaxZ: no sand north of this (so low ground far inland stays grass).
  // groundZones: [{ x, z, r }, ...] (up to 6): flat ground inside these is the rock texture too (e.g. obsidian flats).
  // spans: { x: [[from, to, res], ...], z: [...] }: a grid that's finer in some
  //   places than others (e.g. fine in the middle of the world, coarser out in
  //   the wilds). Without it the grid is res everywhere.
  // biomes: { weights(x, z) -> [w0..w4], res, layers: [{ ground, cliff: [r, g, b] }, ...] }:
  //   up to five kinds of ground painted over everything else (snow, ash...),
  //   each with its own flat-ground texture and a tint for its cliffs.
  constructor({ minX, maxX, minZ, maxZ, res, height, paths = [], grass, cliff, path, rock = null, rockZone = null, sand = null, sandTop = -1e9, sandMaxZ = 1e9, grade = null, fields = null, groundZones = [], spans = null, biomes = null }) {
    this.groundZones = Array.from({ length: 6 }, (_, i) => (groundZones[i] ? new THREE.Vector3(groundZones[i].x, groundZones[i].z, groundZones[i].r) : new THREE.Vector3(0, 0, -1)));
    this.sandMaxZ = sandMaxZ;
    this.grade = grade || { sat: 1, tint: new THREE.Color(1, 1, 1) };
    this.uSat = { value: this.grade.sat };
    this.fieldZone = fields ? new THREE.Vector3(fields.x, fields.z, fields.r) : new THREE.Vector3(0, 0, -1);
    this.rock = rock || cliff; this.rockZone = rockZone || new THREE.Vector3(0, 0, -1);
    this.sand = sand || grass; this.sandTop = sandTop;
    this.minX = minX; this.minZ = minZ; this.res = res;
    // the grid lines along each axis
    const axis = (lo, hi, sp) => {
      const out = [];
      for (const [a, b, r] of sp || [[lo, hi, res]]) {
        const n = Math.max(1, Math.round((b - a) / r));
        for (let k = out.length && Math.abs(out[out.length - 1] - a) < 1e-6 ? 1 : 0; k <= n; k++) out.push(a + ((b - a) * k) / n);
      }
      return Float64Array.from(out);
    };
    this.xs = axis(minX, maxX, spans && spans.x);
    this.zs = axis(minZ, maxZ, spans && spans.z);
    this.nx = this.xs.length; this.nz = this.zs.length;
    this.maxX = this.xs[this.nx - 1]; this.maxZ = this.zs[this.nz - 1];
    this.minX = this.xs[0]; this.minZ = this.zs[0];
    // quick lookup of which cell a coordinate falls in (a table at 0.5 m steps)
    const table = (arr) => {
      const lo = arr[0], n = Math.ceil((arr[arr.length - 1] - lo) / 0.5) + 1, t = new Int32Array(n);
      let k = 0;
      for (let q = 0; q < n; q++) { const v = lo + q * 0.5; while (k < arr.length - 2 && arr[k + 1] <= v) k++; t[q] = k; }
      return t;
    };
    this.tx = table(this.xs); this.tz = table(this.zs);
    const N = this.nx * this.nz;
    this.h = new Float32Array(N);
    for (let j = 0; j < this.nz; j++) {
      const z = this.zs[j];
      for (let i = 0; i < this.nx; i++) this.h[j * this.nx + i] = height(this.xs[i], z);
    }
    this.biomes = biomes;
    if (biomes) this.biomeMaps = this.paintBiomes(biomes);
    this.mesh = this.buildMesh(paths, grass, cliff, path);
  }

  // index of the grid cell containing coordinate v along an axis (-1 outside)
  cell(arr, table, v) {
    if (v < arr[0] || v >= arr[arr.length - 1]) return -1;
    let k = table[Math.floor((v - arr[0]) / 0.5)];
    while (k < arr.length - 2 && arr[k + 1] <= v) k++;
    while (k > 0 && arr[k] > v) k--;
    return k;
  }

  // The biome weights painted into two small textures (rgba + r) covering the whole grid.
  paintBiomes({ weights, res = 4 }) {
    const w = Math.ceil((this.maxX - this.minX) / res) + 1, h = Math.ceil((this.maxZ - this.minZ) / res) + 1;
    const a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const W = weights(this.minX + i * res, this.minZ + j * res), k = (j * w + i) * 4;
        a[k] = W[0] * 255; a[k + 1] = W[1] * 255; a[k + 2] = W[2] * 255; a[k + 3] = W[3] * 255;
        b[k] = W[4] * 255; b[k + 3] = 255;
      }
    }
    const tex = (data) => { const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
    return { a: tex(a), b: tex(b), box: new THREE.Vector4(this.minX, this.minZ, (w - 1) * res, (h - 1) * res) };
  }

  // Bilinear height. Outside the grid counts as a tall wall.
  // Change the colour grading (e.g. as the weather clears).
  setGrade(sat, r, g, b) { this.uSat.value = sat; this.grade.tint.setRGB(r, g, b); }

  height(x, z) {
    const i = this.cell(this.xs, this.tx, x), j = this.cell(this.zs, this.tz, z);
    if (i < 0 || j < 0) return 999;
    const tx = (x - this.xs[i]) / (this.xs[i + 1] - this.xs[i]), tz = (z - this.zs[j]) / (this.zs[j + 1] - this.zs[j]);
    const n = this.nx, k = j * n + i, H = this.h;
    const a = H[k] + (H[k + 1] - H[k]) * tx;
    const b = H[k + n] + (H[k + n + 1] - H[k + n]) * tx;
    return a + (b - a) * tz;
  }

  // Height gradient (dh/dx, dh/dz).
  gradient(x, z, out = { x: 0, z: 0 }) {
    const i = Math.max(0, this.cell(this.xs, this.tx, x));
    const e = (this.xs[Math.min(this.nx - 1, i + 1)] - this.xs[i]) * 0.75 || this.res * 0.75;
    out.x = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
    out.z = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
    return out;
  }

  buildMesh(paths, grassTex, cliffTex, pathTex) {
    const { nx, nz, xs, zs } = this;
    const N = nx * nz;
    const pos = new Float32Array(N * 3);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = xs[i]; pos[k * 3 + 1] = this.h[k]; pos[k * 3 + 2] = zs[j];
      }
    }
    const lowI = (v, arr, t) => Math.max(0, v <= arr[0] ? 0 : v >= arr[arr.length - 1] ? arr.length - 1 : this.cell(arr, t, v));
    const highI = (v, arr, t) => Math.min(arr.length - 1, (v >= arr[arr.length - 1] ? arr.length - 1 : lowI(v, arr, t) + 1));
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let w = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx[w++] = a; idx[w++] = c; idx[w++] = b;
        idx[w++] = b; idx[w++] = c; idx[w++] = d;
      }
    }

    // Path painting: per-vertex weight + strip UVs (u across, v along).
    const pw = new Float32Array(N), puv = new Float32Array(N * 2);
    const best = new Float32Array(N).fill(Infinity);
    for (const p of paths) {
      const hw = p.width / 2;
      let along = 0;
      for (let s = 0; s < p.points.length - 1; s++) {
        const [ax, az] = p.points[s], [bx, bz] = p.points[s + 1];
        const sx = bx - ax, sz = bz - az, len = Math.hypot(sx, sz);
        if (len < 1e-6) continue;
        const ux = sx / len, uz = sz / len;
        const i0 = lowI(Math.min(ax, bx) - hw, xs, this.tx), i1 = highI(Math.max(ax, bx) + hw, xs, this.tx);
        const j0 = lowI(Math.min(az, bz) - hw, zs, this.tz), j1 = highI(Math.max(az, bz) + hw, zs, this.tz);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const x = xs[i], z = zs[j];
            const rx = x - ax, rz = z - az;
            const t = Math.max(0, Math.min(len, rx * ux + rz * uz));
            const lat = rx * -uz + rz * ux;             // signed side distance
            const dx = rx - ux * t, dz = rz - uz * t, d = Math.hypot(dx, dz);
            const k = j * nx + i;
            if (d < hw * 1.15 && d < best[k]) {
              best[k] = d;
              pw[k] = d < hw ? 1 : 0;
              puv[k * 2] = Math.max(0, Math.min(1, lat / (2 * hw) + 0.5));
              puv[k * 2 + 1] = (along + t) / p.width;
            }
          }
        }
        along += len;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPath', new THREE.BufferAttribute(pw, 1));
    geo.setAttribute('aPathUV', new THREE.BufferAttribute(puv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.grassMap = { value: grassTex };
      sh.uniforms.cliffMap = { value: cliffTex };
      sh.uniforms.pathMap = { value: pathTex };
      sh.uniforms.rockMap = { value: this.rock };
      sh.uniforms.rockZone = { value: this.rockZone };
      sh.uniforms.sandMap = { value: this.sand };
      sh.uniforms.sandTop = { value: this.sandTop };
      sh.uniforms.gradeSat = this.uSat;
      sh.uniforms.fieldZone = { value: this.fieldZone };
      sh.uniforms.sandMaxZ = { value: this.sandMaxZ };
      sh.uniforms.groundZones = { value: this.groundZones };
      sh.uniforms.gradeTint = { value: this.grade.tint };
      const B = this.biomes, BM = this.biomeMaps;
      const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
      sh.uniforms.biomeA = { value: BM ? BM.a : blank };
      sh.uniforms.biomeB = { value: BM ? BM.b : blank };
      sh.uniforms.biomeBox = { value: BM ? BM.box : new THREE.Vector4(0, 0, 1, 1) };
      for (let k = 0; k < 5; k++) {
        const L = B && B.layers[k];
        sh.uniforms['bGround' + k] = { value: L ? L.ground : grassTex };
        sh.uniforms['bCliff' + k] = { value: new THREE.Vector3(...(L ? L.cliff : [1, 1, 1])) };
        sh.uniforms['bScale' + k] = { value: L ? (L.scale || 3) : 3 };
      }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aPath; attribute vec2 aPathUV;
varying float vPath; varying vec2 vPathUV; varying vec3 vWPos; varying vec3 vWN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vPath = aPath; vPathUV = aPathUV; vWPos = position; vWN = normal;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D grassMap; uniform sampler2D cliffMap; uniform sampler2D pathMap; uniform sampler2D rockMap; uniform vec3 rockZone;
uniform sampler2D biomeA; uniform sampler2D biomeB; uniform vec4 biomeBox;
uniform sampler2D bGround0; uniform sampler2D bGround1; uniform sampler2D bGround2; uniform sampler2D bGround3; uniform sampler2D bGround4;
uniform vec3 bCliff0; uniform vec3 bCliff1; uniform vec3 bCliff2; uniform vec3 bCliff3; uniform vec3 bCliff4;
uniform float bScale0; uniform float bScale1; uniform float bScale2; uniform float bScale3; uniform float bScale4;
uniform sampler2D sandMap; uniform float sandTop; uniform float gradeSat; uniform vec3 gradeTint; uniform vec3 fieldZone; uniform float sandMaxZ; uniform vec3 groundZones[6];
float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
varying float vPath; varying vec2 vPathUV; varying vec3 vWPos; varying vec3 vWN;`)
        .replace('#include <map_fragment>', `
vec3 tn = normalize(vWN);
vec4 g = texture2D(grassMap, vWPos.xz / 2.5);
// large-scale tint so the field doesn't look tiled
float tint = 0.88 + 0.12 * sin(vWPos.x * 0.06) * sin(vWPos.z * 0.05 + 1.7) + 0.06 * sin(vWPos.x * 0.013 + vWPos.z * 0.021);
g.rgb *= vec3(tint, 0.96 + 0.06 * tint, tint);
// meadows: big soft swathes of lighter, sunnier grass and cooler, deeper green
if (fieldZone.z > 0.0) {
  float inF = 1.0 - smoothstep(fieldZone.z - 20.0, fieldZone.z, distance(vWPos.xz, fieldZone.xy));
  float n1 = sin(vWPos.x * 0.021 + sin(vWPos.z * 0.017) * 2.0) * 0.5 + 0.5;
  float n2 = sin(vWPos.z * 0.029 + vWPos.x * 0.012 + 1.3) * 0.5 + 0.5;
  float n3 = sin(vWPos.x * 0.083 + vWPos.z * 0.061) * 0.5 + 0.5;
  vec3 meadow = mix(vec3(0.86, 0.98, 0.84), vec3(1.14, 1.12, 0.8), n1 * n2) * (0.95 + 0.1 * n3);
  g.rgb = mix(g.rgb, g.rgb * meadow, inF);
}
// sand below the beach line, with a wobbly edge
float sandEdge = sandTop + 0.5 * sin(vWPos.x * 0.21) + 0.35 * sin(vWPos.z * 0.17 + vWPos.x * 0.05);
g = mix(g, texture2D(sandMap, vWPos.xz / 3.0), (1.0 - smoothstep(sandEdge - 0.35, sandEdge + 0.35, vWPos.y)) * (1.0 - smoothstep(sandMaxZ - 15.0, sandMaxZ, vWPos.z)));
// rock ground zones (obsidian flats), with ragged edges
float inG = 0.0;
for (int k = 0; k < 6; k++) {
  vec3 zn = groundZones[k];
  if (zn.z > 0.0) {
    float wob = 2.5 * sin(atan(vWPos.z - zn.y, vWPos.x - zn.x) * 5.0 + zn.x) + 1.5 * sin(vWPos.x * 0.3 + vWPos.z * 0.2);
    inG = max(inG, 1.0 - smoothstep(zn.z * 0.75, zn.z, distance(vWPos.xz, zn.xy) + wob));
  }
}
g = mix(g, texture2D(rockMap, vWPos.xz / 3.0) * vec4(1.15, 1.15, 1.2, 1.0), inG);
vec2 cuv = abs(tn.x) > abs(tn.z) ? vWPos.zy : vWPos.xy;
vec4 c = texture2D(cliffMap, cuv / 2.0);
float inRock = 1.0 - step(rockZone.z, distance(vWPos.xz, rockZone.xy));
c = mix(c, texture2D(rockMap, cuv / 2.0), inRock);
// the wilds: each biome paints its own ground over the flat, and tints the cliffs
vec2 buv = (vWPos.xz - biomeBox.xy) / biomeBox.zw;
vec4 wa = texture2D(biomeA, buv); float w4 = texture2D(biomeB, buv).r;
float wsum = min(1.0, wa.r + wa.g + wa.b + wa.a + w4);
if (wsum > 0.003) {
  vec4 bg = texture2D(bGround0, vWPos.xz / bScale0) * wa.r + texture2D(bGround1, vWPos.xz / bScale1) * wa.g
          + texture2D(bGround2, vWPos.xz / bScale2) * wa.b + texture2D(bGround3, vWPos.xz / bScale3) * wa.a
          + texture2D(bGround4, vWPos.xz / bScale4) * w4;
  float tot = max(0.001, wa.r + wa.g + wa.b + wa.a + w4);
  g = mix(g, bg / tot, wsum);
  vec3 ct = (bCliff0 * wa.r + bCliff1 * wa.g + bCliff2 * wa.b + bCliff3 * wa.a + bCliff4 * w4) / tot;
  c.rgb = mix(c.rgb, c.rgb * ct, wsum);
}
vec4 p = texture2D(pathMap, vPathUV);
// out in the wilds a path is the same ground, trodden down
if (wsum > 0.003) p = mix(p, mix(p, g * 0.8, 0.75), wsum);
float steep = smoothstep(0.45, 0.62, 1.0 - tn.y);
vec4 col = mix(g, p, smoothstep(0.35, 0.65, vPath) * (1.0 - steep));
col = mix(col, c, steep);
float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
col.rgb = mix(vec3(lum), col.rgb, gradeSat) * gradeTint;
diffuseColor *= col;`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }
}
