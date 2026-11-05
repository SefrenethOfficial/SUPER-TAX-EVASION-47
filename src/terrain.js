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
  constructor({ minX, maxX, minZ, maxZ, res, height, paths = [], grass, cliff, path, rock = null, rockZone = null, sand = null, sandTop = -1e9, grade = null }) {
    this.grade = grade || { sat: 1, tint: new THREE.Color(1, 1, 1) };
    this.rock = rock || cliff; this.rockZone = rockZone || new THREE.Vector3(0, 0, -1);
    this.sand = sand || grass; this.sandTop = sandTop;
    this.minX = minX; this.minZ = minZ; this.res = res;
    this.nx = Math.ceil((maxX - minX) / res) + 1;
    this.nz = Math.ceil((maxZ - minZ) / res) + 1;
    this.maxX = minX + (this.nx - 1) * res;
    this.maxZ = minZ + (this.nz - 1) * res;
    const N = this.nx * this.nz;
    this.h = new Float32Array(N);
    for (let j = 0; j < this.nz; j++) {
      const z = minZ + j * res;
      for (let i = 0; i < this.nx; i++) this.h[j * this.nx + i] = height(minX + i * res, z);
    }
    this.mesh = this.buildMesh(paths, grass, cliff, path);
  }

  // Bilinear height. Outside the grid counts as a tall wall.
  height(x, z) {
    const fx = (x - this.minX) / this.res, fz = (z - this.minZ) / this.res;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return 999;
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const n = this.nx, k = j * n + i, H = this.h;
    const a = H[k] + (H[k + 1] - H[k]) * tx;
    const b = H[k + n] + (H[k + n + 1] - H[k + n]) * tx;
    return a + (b - a) * tz;
  }

  // Height gradient (dh/dx, dh/dz).
  gradient(x, z, out = { x: 0, z: 0 }) {
    const e = this.res * 0.75;
    out.x = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
    out.z = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
    return out;
  }

  buildMesh(paths, grassTex, cliffTex, pathTex) {
    const { nx, nz, res, minX, minZ } = this;
    const N = nx * nz;
    const pos = new Float32Array(N * 3);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        pos[k * 3] = minX + i * res; pos[k * 3 + 1] = this.h[k]; pos[k * 3 + 2] = minZ + j * res;
      }
    }
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
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - hw - minX) / res));
        const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + hw - minX) / res));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz) - hw - minZ) / res));
        const j1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz) + hw - minZ) / res));
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const x = minX + i * res, z = minZ + j * res;
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
      sh.uniforms.gradeSat = { value: this.grade.sat };
      sh.uniforms.gradeTint = { value: this.grade.tint };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aPath; attribute vec2 aPathUV;
varying float vPath; varying vec2 vPathUV; varying vec3 vWPos; varying vec3 vWN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vPath = aPath; vPathUV = aPathUV; vWPos = position; vWN = normal;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D grassMap; uniform sampler2D cliffMap; uniform sampler2D pathMap; uniform sampler2D rockMap; uniform vec3 rockZone;
uniform sampler2D sandMap; uniform float sandTop; uniform float gradeSat; uniform vec3 gradeTint;
varying float vPath; varying vec2 vPathUV; varying vec3 vWPos; varying vec3 vWN;`)
        .replace('#include <map_fragment>', `
vec3 tn = normalize(vWN);
vec4 g = texture2D(grassMap, vWPos.xz / 2.5);
// large-scale tint so the field doesn't look tiled
float tint = 0.88 + 0.12 * sin(vWPos.x * 0.06) * sin(vWPos.z * 0.05 + 1.7) + 0.06 * sin(vWPos.x * 0.013 + vWPos.z * 0.021);
g.rgb *= vec3(tint, 0.96 + 0.06 * tint, tint);
// sand below the beach line, with a wobbly edge
float sandEdge = sandTop + 0.5 * sin(vWPos.x * 0.21) + 0.35 * sin(vWPos.z * 0.17 + vWPos.x * 0.05);
g = mix(g, texture2D(sandMap, vWPos.xz / 3.0), 1.0 - smoothstep(sandEdge - 0.35, sandEdge + 0.35, vWPos.y));
vec2 cuv = abs(tn.x) > abs(tn.z) ? vWPos.zy : vWPos.xy;
vec4 c = texture2D(cliffMap, cuv / 2.0);
float inRock = 1.0 - step(rockZone.z, distance(vWPos.xz, rockZone.xy));
c = mix(c, texture2D(rockMap, cuv / 2.0), inRock);
vec4 p = texture2D(pathMap, vPathUV);
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
